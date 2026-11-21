/**
 * Isolated backend for browser-testing the B2B admin purchase history screens.
 * In-memory MongoDB; Razorpay stubbed. The scenario is created through the real API:
 *   - Company admin  asha@example.com / Passw0rd!   (company wallet Rs.100,000)
 *   - Employees      ravi@example.com (wallet/COD/cancelled/card orders + a partial return refunded to
 *                    the wallet), meera@example.com (1 COD order), zed@example.com (inactive, no orders)
 * Usage: node testing_scripts/e2e-purchase-server.js [port]
 */
process.env.JWT_SECRET = 'e2e-secret';
process.env.JWT_REFRESH_SECRET = 'e2e-refresh';
process.env.NODE_ENV = 'test';
process.env.RAZORPAY_KEY_ID = 'rzp_test_dummy';
process.env.RAZORPAY_KEY_SECRET = 'x';
for (const k of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SHIPROCKET_EMAIL', 'SHIPROCKET_PASSWORD']) process.env[k] = '';

import http from 'node:http';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const port = Number(process.argv[2] || 5060);
const repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
await mongoose.connect(repl.getUri('e2e_purchase'));

const rzp = await import('../src/services/razorpay.service.js');
let seq = 0;
rzp.__setRazorpayClientForTests({ orders: { create: async (o) => ({ id: `order_E2EPH${++seq}`, amount: o.amount, currency: 'INR' }) }, payments: { fetch: async () => null } });

const M = (n) => import(`../src/models/${n}.model.js`).then((m) => m.default || m[n]);
const [User, Vendor, Category, Product, Address, Order, Wallet, ReturnRequest] = await Promise.all(['User', 'Vendor', 'Category', 'Product', 'Address', 'Order', 'Wallet', 'ReturnRequest'].map(M));
const { signAccessToken } = await import('../src/config/jwt.js');

const PASSWORD = 'Passw0rd!';
const companyId = new mongoose.Types.ObjectId();
await mongoose.connection.collection('b2bcompanies').insertOne({ _id: companyId, companyName: 'Acme Pvt Ltd', businessEmail: 'asha@example.com', verificationStatus: 'Approved', isActive: true, createdAt: new Date(), updatedAt: new Date() });
const mk = (name, email, role, extra = {}) => User.create({ name, email, password: PASSWORD, phone: '9000000000', isVerified: true, isActive: true, role, companyId, companyName: 'Acme Pvt Ltd', department: 'Ops', ...extra });
const admin = await mk('Asha Admin', 'asha@example.com', 'b2bAdmin');
const ravi = await mk('Ravi Staff', 'ravi@example.com', 'b2bEmployee', { designation: 'Buyer' });
const meera = await mk('Meera Rao', 'meera@example.com', 'b2bEmployee', { department: 'Finance', designation: 'Accountant' });
await mk('Zed Inactive', 'zed@example.com', 'b2bEmployee', { isActive: false });
await Wallet.create({ userId: admin._id, balance: 100000, totalCredit: 100000, totalDebit: 0, isFrozen: false });
for (const u of [ravi, meera]) await Address.create({ userId: u._id, name: 'Office', fullName: u.name, phone: '9000000000', address: '1 FC Road', city: 'Pune', state: 'Maharashtra', zipCode: '411004', country: 'India', isDefault: true });
const vendor = await Vendor.create({ name: 'Volt', email: 'volt@example.com', password: PASSWORD, storeName: 'Volt Supplies', status: 'approved', isVerified: true, gstNumber: '27ABCDE1234F1Z5', shippingEnabled: false });
const cat = await Category.create({ name: 'Furniture', slug: 'furniture', isActive: true });
const product = await Product.create({ name: 'Office Chair', slug: 'office-chair', vendorId: vendor._id, categoryId: cat._id, price: 1000, stockQuantity: 500, stock: 'in_stock', description: 'Ergonomic chair', images: [], salesChannel: 'BOTH', approvalStatus: 'approved', isActive: true, isVisible: true, gstMode: 'custom', gstRate: 18 });

const { default: app } = await import('../src/app.js');
const server = http.createServer(app);
await new Promise((r) => server.listen(port, '127.0.0.1', r));

// ── scenario through the real API
const base = `http://127.0.0.1:${port}/api`;
const tok = (u, role) => signAccessToken({ id: String(u._id), role, email: u.email, companyId: String(companyId) });
const call = async (token, method, p, body) => {
    const res = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json().catch(() => null) };
};
const TA = tok(admin, 'b2bAdmin'), TR = tok(ravi, 'b2bEmployee'), TM = tok(meera, 'b2bEmployee');
const TV = signAccessToken({ id: String(vendor._id), role: 'vendor' });
const addr = { name: 'Staff', email: 'staff@example.com', phone: '9000000000', address: '1 FC Road', city: 'Pune', state: 'Maharashtra', zipCode: '411004', country: 'India' };
const buy = (t, qty, pm) => call(t, 'POST', '/user/orders', { items: [{ productId: String(product._id), quantity: qty }], shippingAddress: addr, paymentMethod: pm });
const last = (u) => Order.findOne({ userId: u._id }).sort({ createdAt: -1, _id: -1 }).lean();

await call(TA, 'POST', `/b2b-user/admin/employees/${ravi._id}/allot-wallet`, { amount: 50000 });
await call(TA, 'POST', `/b2b-user/admin/employees/${meera._id}/allot-wallet`, { amount: 5000 });
await buy(TR, 2, 'wallet'); const o1 = await last(ravi);
await buy(TR, 1, 'cod');
await buy(TR, 1, 'wallet'); const o3 = await last(ravi);
await call(TR, 'PATCH', `/user/orders/${o3.orderId}/cancel`, { reason: 'Ordered by mistake' });
await buy(TR, 1, 'card');
await buy(TM, 1, 'cod');
await Order.updateOne({ _id: o1._id }, { $set: { status: 'delivered', deliveredAt: new Date() } });
await call(TR, 'POST', `/user/orders/${o1.orderId}/returns`, { reason: 'One chair arrived damaged', items: [{ orderItemId: String(o1.items[0]._id), quantity: 1 }] });
const ret = await ReturnRequest.findOne({ orderId: o1._id }).lean();
await call(TV, 'PATCH', `/vendor/return-requests/${ret._id}/status`, { status: 'approved' });
await call(TV, 'PATCH', `/vendor/return-requests/${ret._id}/status`, { status: 'completed', refundStatus: 'processed' });

console.log(JSON.stringify({ ready: true, port, raviId: String(ravi._id), o1: o1.orderId }));
