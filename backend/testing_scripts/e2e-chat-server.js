/**
 * Isolated backend (with Socket.io) for browser-testing Enquire Now chat, ticks, and the admin
 * chat hub / Direct RFQ monitor. In-memory MongoDB; nothing external is touched.
 *   - Business buyer  ravi@example.com / Passw0rd!   (log in at /b2b/login)
 *   - Seller          vee@example.com  / Passw0rd!   (store "Vee Electronics", /vendor/login)
 *   - Admin           admin@example.com / Passw0rd!  (API login; super admin)
 *   - Product "Vee Headphones" (visible to business buyers) + 3 direct RFQs
 * Usage: node testing_scripts/e2e-chat-server.js [port]
 */
process.env.JWT_SECRET = 'e2e-secret';
process.env.JWT_REFRESH_SECRET = 'e2e-refresh';
process.env.NODE_ENV = 'test';
for (const k of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SHIPROCKET_EMAIL', 'SHIPROCKET_PASSWORD']) process.env[k] = '';

import http from 'node:http';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const port = Number(process.argv[2] || 5063);
const repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
await mongoose.connect(repl.getUri('e2e_chat'));

const M = (n) => import(`../src/models/${n}.model.js`).then((m) => m.default || m[n]);
const [User, Admin, Vendor, Category, Product, DirectRFQ] = await Promise.all(['User', 'Admin', 'Vendor', 'Category', 'Product', 'DirectRFQ'].map(M));

const PASSWORD = 'Passw0rd!';
const companyId = new mongoose.Types.ObjectId();
await mongoose.connection.collection('b2bcompanies').insertOne({ _id: companyId, companyName: 'Acme Pvt Ltd', businessEmail: 'asha@example.com', verificationStatus: 'Approved', isActive: true, createdAt: new Date(), updatedAt: new Date() });
const ravi = await User.create({ name: 'Ravi Staff', firstName: 'Ravi', lastName: 'Staff', email: 'ravi@example.com', password: PASSWORD, phone: '9000000011', isVerified: true, isActive: true, role: 'b2bEmployee', companyId, companyName: 'Acme Pvt Ltd' });
const zoya = await User.create({ name: 'Zoya Buyer', email: 'zoya@example.com', password: PASSWORD, phone: '9000000012', isVerified: true, isActive: true, role: 'b2bEmployee', companyId, companyName: 'Acme Pvt Ltd' });
await Admin.create({ name: 'Admin', email: 'admin@example.com', password: PASSWORD, role: 'superadmin', isActive: true });
const vendor = await Vendor.create({ name: 'Vee', email: 'vee@example.com', password: PASSWORD, storeName: 'Vee Electronics', status: 'approved', isVerified: true, commissionRate: 10 });
const vendor2 = await Vendor.create({ name: 'Bolt', email: 'bolt@example.com', password: PASSWORD, storeName: 'Bolt Industries', status: 'approved', isVerified: true, commissionRate: 10 });
const cat = await Category.create({ name: 'Audio', slug: 'audio', isActive: true });
const product = await Product.create({ name: 'Vee Headphones', slug: 'vee-headphones', vendorId: vendor._id, categoryId: cat._id, price: 1500, stockQuantity: 20, stock: 'in_stock', description: 'Wireless headphones', images: [], salesChannel: 'BOTH', approvalStatus: 'approved', isActive: true, isVisible: true, gstMode: 'custom', gstRate: 18 });

// Admin-managed (platform-owned) product: B2B RFQs on it must go to the Super Admin, not to a vendor
const { default: ManagedShop } = await import('../src/models/ManagedShop.model.js');
const shop = await ManagedShop.create({ name: 'PLE Own Store', status: 'active' });
const adminProduct = await Product.create({ name: 'PLE Own Keyboard', slug: 'ple-own-keyboard', shopId: shop._id, categoryId: cat._id, price: 800, stockQuantity: 50, stock: 'in_stock', description: 'Keyboard', images: [], salesChannel: 'BOTH', approvalStatus: 'approved', isActive: true, isVisible: true, gstMode: 'custom', gstRate: 18 });

const msg = (type, id, name, text, extra = {}) => ({ senderId: id, senderType: type, senderName: name, message: text, ...extra });
await DirectRFQ.create({ directRfqId: 'DRFQ-AAA111', employeeId: ravi._id, companyId, vendorId: vendor._id, productId: product._id, quantity: 10, targetPrice: 1200, status: 'Negotiating', requirementDetails: 'Need 10 headsets for the support team.', messages: [msg('Employee', ravi._id, 'Ravi Staff', 'Can you do 1,200 each for 10?'), msg('Vendor', vendor._id, 'Vee Electronics', 'We can do 1,350 each.', { priceOffer: 1350 }), msg('Employee', ravi._id, 'Ravi Staff', 'How about 1,280?', { priceOffer: 1280 })] });
await DirectRFQ.create({ directRfqId: 'DRFQ-BBB222', employeeId: zoya._id, companyId, vendorId: vendor2._id, customProductName: 'Industrial Bolts M12', quantity: 500, targetPrice: 12, status: 'Pending Vendor', messages: [] });
await DirectRFQ.create({ directRfqId: 'DRFQ-CCC333', employeeId: ravi._id, companyId, vendorId: vendor2._id, customProductName: 'Safety Gloves', quantity: 100, targetPrice: 50, status: 'PO Generated', finalAgreedPrice: 45, messages: [msg('Vendor', vendor2._id, 'Bolt Industries', 'Agreed at 45.', { priceOffer: 45 })] });

const { default: app } = await import('../src/app.js');
const { initSocket } = await import('../src/config/socket.js');
const server = http.createServer(app);
initSocket(server);
server.listen(port, '127.0.0.1', () => {
    console.log(JSON.stringify({ ready: true, port, productId: String(product._id), adminProductId: String(adminProduct._id) }));
});
