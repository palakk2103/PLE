/**
 * Isolated backend for browser-testing B2B employee spending limits and wallet requests.
 * In-memory MongoDB; nothing external is touched.
 *   - Company admin  asha@example.com / Passw0rd!  (b2bAdmin, company wallet ₹10,000)
 *   - Employee       ravi@example.com / Passw0rd!  monthly limit ₹8,000, per-order ₹5,000,
 *                    already spent ₹4,720 this month, wallet ₹20,000
 *   - Product "Office Chair" ₹1,000 + 18% GST
 * Usage: node testing_scripts/e2e-spending-server.js [port]
 */
process.env.JWT_SECRET = 'e2e-secret';
process.env.JWT_REFRESH_SECRET = 'e2e-refresh';
process.env.NODE_ENV = 'test';
for (const k of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SHIPROCKET_EMAIL', 'SHIPROCKET_PASSWORD', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET']) process.env[k] = '';

import http from 'node:http';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const port = Number(process.argv[2] || 5059);
const repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
await mongoose.connect(repl.getUri('e2e_spending'));

const M = (n) => import(`../src/models/${n}.model.js`).then((m) => m.default || m[n]);
const [User, Vendor, Category, Product, Address, Order] = await Promise.all(['User', 'Vendor', 'Category', 'Product', 'Address', 'Order'].map(M));

const PASSWORD = 'Passw0rd!';
const companyId = new mongoose.Types.ObjectId();
await mongoose.connection.collection('b2bcompanies').insertOne({ _id: companyId, companyName: 'Acme Pvt Ltd', businessEmail: 'asha@example.com', verificationStatus: 'Approved', isActive: true, createdAt: new Date(), updatedAt: new Date() });
const admin = await User.create({ name: 'Asha Admin', firstName: 'Asha', lastName: 'Admin', email: 'asha@example.com', password: PASSWORD, phone: '9000000010', isVerified: true, isActive: true, role: 'b2bAdmin', companyId, companyName: 'Acme Pvt Ltd' });
const emp = await User.create({ name: 'Ravi Staff', firstName: 'Ravi', lastName: 'Staff', email: 'ravi@example.com', password: PASSWORD, phone: '9000000011', isVerified: true, isActive: true, role: 'b2bEmployee', companyId, companyName: 'Acme Pvt Ltd', b2bWalletBalance: 20000, b2bSpendingLimit: 8000, b2bPerOrderSpendingLimit: 5000, department: 'Ops', designation: 'Buyer' });
await mongoose.connection.collection('wallets').insertOne({ userId: admin._id, balance: 10000, totalCredit: 10000, totalDebit: 0, isFrozen: false, createdAt: new Date(), updatedAt: new Date() });
await Address.create({ userId: emp._id, name: 'Office', fullName: 'Ravi Staff', phone: '9000000011', address: '1 FC Road', city: 'Pune', state: 'Maharashtra', zipCode: '411004', country: 'India', isDefault: true });
const vendor = await Vendor.create({ name: 'Volt', email: 'volt@example.com', password: PASSWORD, storeName: 'Volt Supplies', status: 'approved', isVerified: true, gstNumber: '27ABCDE1234F1Z5', shippingEnabled: false });
const cat = await Category.create({ name: 'Furniture', slug: 'furniture', isActive: true });
const product = await Product.create({ name: 'Office Chair', slug: 'office-chair', vendorId: vendor._id, categoryId: cat._id, price: 1000, stockQuantity: 500, stock: 'in_stock', description: 'Ergonomic chair', images: [], salesChannel: 'BOTH', approvalStatus: 'approved', isActive: true, isVisible: true, gstMode: 'custom', gstRate: 18 });
const item = { productId: product._id, vendorId: vendor._id, name: 'Office Chair', price: 1000, quantity: 4, gstAmount: 720 };
await Order.create({ orderId: 'ORD-E2E-SPEND-1', userId: emp._id, companyId, items: [item], vendorItems: [{ vendorId: vendor._id, vendorName: 'Volt Supplies', items: [item], subtotal: 4000, tax: 720, shipping: 0, discount: 0, status: 'pending' }], shippingAddress: { name: 'Ravi', phone: '9000000011', address: '1 FC Road', city: 'Pune', state: 'Maharashtra', zipCode: '411004', country: 'India' }, paymentMethod: 'cod', paymentStatus: 'pending', status: 'pending', subtotal: 4000, tax: 720, shipping: 0, total: 4720, orderType: 'b2b' });

const { default: app } = await import('../src/app.js');
http.createServer(app).listen(port, '127.0.0.1', () => {
    console.log(JSON.stringify({ ready: true, port, productId: String(product._id), employeeId: String(emp._id), adminId: String(admin._id) }));
});
