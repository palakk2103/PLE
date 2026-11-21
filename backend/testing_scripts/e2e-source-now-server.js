/**
 * Isolated backend for browser-testing Source Now "Accept & Pay" with Razorpay.
 * In-memory MongoDB; Razorpay is stubbed (no real gateway calls). A test-only endpoint
 * GET /__test/sign?order=<rzpOrderId>&payment=<paymentId> returns a valid checkout signature so a
 * stubbed window.Razorpay in the browser can complete a "payment" through the real verify API.
 *   - Customer sam@example.com / Passw0rd!  (saved address in Karnataka)
 *   - Request REQ-200001 in "Final Proposal": 10 x ₹500 from Kumar Cables (Karnataka GSTIN)
 * Usage: node testing_scripts/e2e-source-now-server.js [port]
 */
process.env.JWT_SECRET = 'e2e-secret';
process.env.JWT_REFRESH_SECRET = 'e2e-refresh';
process.env.NODE_ENV = 'test';
process.env.RAZORPAY_KEY_ID = 'rzp_test_dummy';
process.env.RAZORPAY_KEY_SECRET = 'e2e_rzp_secret';
for (const k of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SHIPROCKET_EMAIL', 'SHIPROCKET_PASSWORD']) process.env[k] = '';
delete process.env.PLATFORM_GST_STATE;

import http from 'node:http';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const port = Number(process.argv[2] || 5058);
const repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
await mongoose.connect(repl.getUri('e2e_source_now'));

const rzp = await import('../src/services/razorpay.service.js');
let seq = 0;
rzp.__setRazorpayClientForTests({
    orders: { create: async (o) => ({ id: `order_E2E${++seq}`, amount: o.amount, currency: o.currency }) },
    payments: { fetch: async (id) => ({ id, method: 'upi' }) },
});

const M = (n) => import(`../src/models/${n}.model.js`).then((m) => m.default || m[n]);
const [User, Vendor, Product, Address, ProductRequest, Category] = await Promise.all(['User', 'Vendor', 'Product', 'Address', 'ProductRequest', 'Category'].map(M));

const PASSWORD = 'Passw0rd!';
const customer = await User.create({ name: 'Sam Sourcer', email: 'sam@example.com', password: PASSWORD, phone: '9000000005', isVerified: true, isActive: true, role: 'customer' });
await Address.create({ userId: customer._id, name: 'Office', fullName: 'Sam Sourcer', phone: '9000000005', address: '5 Brigade Rd', city: 'Bengaluru', state: 'Karnataka', zipCode: '560001', country: 'India', isDefault: true });
const vendor = await Vendor.create({ name: 'Kumar', email: 'kumar@example.com', password: PASSWORD, storeName: 'Kumar Cables', status: 'approved', isVerified: true, gstNumber: '29ABCDE1234F1Z5', commissionRate: 10 });
const cat = await Category.create({ name: 'Electrical', slug: 'electrical', isActive: true });
const product = await Product.create({ name: 'Industrial Cable 10m', slug: 'industrial-cable-10m', vendorId: vendor._id, categoryId: cat._id, price: 650, stockQuantity: 100, stock: 'in_stock', description: 'Cable', images: [], approvalStatus: 'approved', isActive: true, isVisible: true, gstMode: 'custom', gstRate: 18 });
await ProductRequest.create({
    requestId: 'REQ-200001', userId: customer._id, productName: 'Industrial Cable 10m', category: 'Electrical', quantity: 10, expectedBudget: 6000,
    status: 'Final Proposal', selectedFulfillment: { pleQuantity: 0, vendors: [{ vendorId: vendor._id, quantity: 10, price: 500 }], finalPrice: 500, notes: 'Ships in 3 days' },
});

const { default: app } = await import('../src/app.js');
const testRoutes = (req, res) => {
    const u = new URL(req.url, 'http://x');
    const signature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${u.searchParams.get('order')}|${u.searchParams.get('payment')}`).digest('hex');
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ signature }));
};
http.createServer((req, res) => (req.url.startsWith('/__test/sign') ? testRoutes(req, res) : app(req, res))).listen(port, '127.0.0.1', () => {
    console.log(JSON.stringify({ ready: true, port, productId: String(product._id), requestId: 'REQ-200001' }));
});
