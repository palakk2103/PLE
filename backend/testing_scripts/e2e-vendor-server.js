/**
 * Isolated backend (with Socket.io) for browser-testing the vendor panel features of Phase 4:
 * payout accounts, LOA, store profile, serviceability, vendor registration drafts.
 * In-memory MongoDB; Razorpay / Shiprocket / email / Cloudinary are never contacted.
 *   - Seller  vee@example.com / Passw0rd!   "Vee Electronics" (log in at /vendor/login)
 *       * still on the OLD single bank account (migrates on first visit), wallet ₹20,000,
 *         two earlier paid payouts to that account
 *   - Admin   admin@example.com / Passw0rd! (API login, super admin)
 * Usage: node testing_scripts/e2e-vendor-server.js [port]
 */
process.env.JWT_SECRET = 'e2e-secret';
process.env.JWT_REFRESH_SECRET = 'e2e-refresh';
process.env.NODE_ENV = 'test';
process.env.CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5180';
process.env.STORE_IMAGE_URL_PREFIXES = 'https://res.cloudinary.test/'; // the Cloudinary stub's host
for (const k of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SHIPROCKET_EMAIL', 'SHIPROCKET_PASSWORD']) process.env[k] = '';

import http from 'node:http';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const port = Number(process.argv[2] || 5064);
const repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
await mongoose.connect(repl.getUri('e2e_vendor'));

const M = (n) => import(`../src/models/${n}.model.js`).then((m) => m.default || m[n]);
const [Vendor, Admin, VendorWallet, WithdrawalRequest] = await Promise.all(['Vendor', 'Admin', 'VendorWallet', 'WithdrawalRequest'].map(M));

const PASSWORD = 'Passw0rd!';
await Admin.create({ name: 'Admin', email: 'admin@example.com', password: PASSWORD, role: 'superadmin', isActive: true });
const vendor = await Vendor.create({ name: 'Vee', email: 'vee@example.com', password: PASSWORD, storeName: 'Vee Electronics', status: 'approved', isVerified: true, commissionRate: 10, gstNumber: '27ABCDE1234F1Z5', ownerName: 'Vikram Rao', businessName: 'Vee Electronics Pvt Ltd', businessType: 'Private Limited', verificationStatus: 'Approved', businessAddress: '12 MG Road, Camp', city: 'Pune', state: 'Maharashtra', pincode: '411001', rating: 4.5, reviewCount: 12 });
// the old single account, written straight to the collection (no bankAccounts yet), dated at registration
await Vendor.collection.updateOne({ _id: vendor._id }, { $set: { createdAt: new Date('2026-01-15T00:00:00Z'), bankDetails: { accountName: 'Vee Electronics', accountNumber: '123456789012', bankName: 'HDFC Bank', ifscCode: 'HDFC0001234', upiId: '', branchName: 'Pune', accountType: 'current' } } });
await VendorWallet.create({ vendorId: vendor._id, available: 20000, onHold: 0, reserved: 0, withdrawn: 2500, totalEarnings: 22500 });
const old = { accountName: 'Vee Electronics', accountNumber: '123456789012', ifscCode: 'HDFC0001234', bankName: 'HDFC Bank' };
await WithdrawalRequest.collection.insertMany([
    { withdrawalId: 'WR-20261001-1111', vendorId: vendor._id, requestedAmount: 1000, eligibleAmountAtRequest: 1000, status: 'paid', paidAmount: 1000, paidAt: new Date('2026-10-01'), bankDetailsSnapshot: old, paymentMethod: 'bank_transfer', createdAt: new Date('2026-10-01'), updatedAt: new Date('2026-10-01') },
    { withdrawalId: 'WR-20261015-2222', vendorId: vendor._id, requestedAmount: 1500, eligibleAmountAtRequest: 1500, status: 'paid', paidAmount: 1500, paidAt: new Date('2026-10-15'), bankDetailsSnapshot: old, paymentMethod: 'bank_transfer', createdAt: new Date('2026-10-15'), updatedAt: new Date('2026-10-15') },
]);

// Cloudinary is stubbed: uploads succeed offline with placeholder URLs
// Products for the compare feature: two vendors + the PLE shop, laptops with differing specs
const [Category, Brand, Product, ManagedShop] = await Promise.all(['Category', 'Brand', 'Product', 'ManagedShop'].map(M));
const cat = await Category.collection.insertOne({ name: 'Laptops', slug: 'laptops', isActive: true, status: 'approved', createdAt: new Date(), updatedAt: new Date() });
const brand = await Brand.collection.insertOne({ name: 'Acme', isActive: true, status: 'approved', createdAt: new Date(), updatedAt: new Date() });
const wen = await Vendor.create({ name: 'Wen', email: 'wen@example.com', password: PASSWORD, storeName: 'Wen Traders', status: 'approved', isVerified: false, rating: 3.8, reviewCount: 4 });
const shop = await ManagedShop.collection.insertOne({ name: 'PLE Own Store', status: 'active', createdAt: new Date(), updatedAt: new Date() });
const spec = (label, value, unit) => ({ key: label.toLowerCase(), label, type: 'text', value, unit });
const mkP = (name, extra) => Product.collection.insertOne({
    name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), price: 50000, stock: 'in_stock', stockQuantity: 10, isActive: true, isVisible: true,
    approvalStatus: 'approved', categoryId: cat.insertedId, brandId: brand.insertedId, vendorId: vendor._id, rating: 4.2, reviewCount: 30, createdAt: new Date(), updatedAt: new Date(), ...extra,
});
await mkP('Acme Book 14', { price: 52000, originalPrice: 65000, warrantyPeriod: '1 year', specifications: { features: [spec('RAM', '16', 'GB'), spec('Processor', 'Core i5'), spec('Touchscreen', false)], additional: [spec('Weight', '1.4', 'kg')] } });
await mkP('Acme Book 15', { price: 61000, vendorId: wen._id, rating: 4.7, reviewCount: 90, specifications: { features: [spec('RAM', '32', 'GB'), spec('Processor', 'Core i5'), spec('Touchscreen', true)] } });
await mkP('PLE Own Laptop', { price: 40000, vendorId: undefined, shopId: shop.insertedId, specifications: { features: [spec('RAM', '8', 'GB'), spec('Processor', 'Core i3')] } });
await mkP('Acme Book 13', { price: 45000, stock: 'out_of_stock', stockQuantity: 0, specifications: { features: [spec('RAM', '16', 'GB')] } });

// Activity for the admin "Monitoring" tab: orders in several statuses / payment modes, a return, chats
const [User, Order, ReturnRequest, VendorChatThread, VendorChatMessage] = await Promise.all(['User', 'Order', 'ReturnRequest', 'VendorChatThread', 'VendorChatMessage'].map(M));
const custs = [];
for (const n of ['Asha', 'Bhanu', 'Chirag']) custs.push(await User.create({ name: n, email: `${n.toLowerCase()}@example.com`, password: PASSWORD, role: 'customer', isActive: true, isVerified: true }));
let n = 0;
const ln = (price, quantity, discount = 0) => ({ productId: undefined, vendorId: vendor._id, name: 'Item', price, quantity, discount });
const place = (user, status, pay, paid, lines, at) => Order.collection.insertOne({
    orderId: `ORD-DEMO-${++n}`, userId: user._id, status, paymentMethod: pay, paymentStatus: paid ? 'paid' : 'pending', items: lines,
    vendorItems: [{ vendorId: vendor._id, items: lines, status: 'pending' }], total: 0, createdAt: new Date(at), updatedAt: new Date(at),
});
await place(custs[0], 'delivered', 'upi', true, [ln(1000, 2, 100)], '2026-11-10T08:00:00Z');
await place(custs[0], 'processing', 'cod', false, [ln(500, 1)], '2026-11-12T08:00:00Z');
await place(custs[1], 'delivered', 'card', true, [ln(200, 3), ln(400, 1)], '2026-11-14T08:00:00Z');
await place(custs[2], 'cancelled', 'upi', false, [ln(800, 1)], '2026-11-15T08:00:00Z');
await place(custs[1], 'returned', 'wallet', true, [ln(250, 1)], '2026-11-16T08:00:00Z');
await ReturnRequest.collection.insertOne({ orderId: (await Order.findOne({ orderId: 'ORD-DEMO-5' }))._id, reason: 'Damaged', vendorId: vendor._id, status: 'pending', refundStatus: 'pending', items: [{ price: 250, quantity: 1 }], createdAt: new Date('2026-11-17T08:00:00Z'), updatedAt: new Date('2026-11-17T08:00:00Z') });
const th1 = await VendorChatThread.create({ vendorId: vendor._id, customerUserId: custs[0]._id, customerName: 'Asha', status: 'active', productName: 'Acme Book 14', lastMessage: 'Is it in stock?', lastActivity: new Date('2026-11-18T09:00:00Z') });
for (const [who, text] of [['customer', 'Is it in stock?'], ['vendor', 'Yes, ships tomorrow.'], ['customer', 'Great, thanks!']]) await VendorChatMessage.create({ threadId: th1._id, senderType: who, message: text });
const th2 = await VendorChatThread.create({ vendorId: vendor._id, customerUserId: custs[1]._id, customerName: 'Bhanu', status: 'closed', lastMessage: 'Thanks', lastActivity: new Date('2026-11-13T09:00:00Z') });
await VendorChatMessage.create({ threadId: th2._id, senderType: 'customer', message: 'Thanks' });

const { default: cloudinary } = await import('../src/config/cloudinary.js');
let stubN = 0;
cloudinary.uploader.upload = async (filePath, opts) => {
    stubN += 1;
    const id = `${opts?.folder || 'f'}/stub${stubN}`;
    return { secure_url: `https://res.cloudinary.test/${id}`, public_id: id, resource_type: 'raw' };
};
cloudinary.uploader.destroy = async () => ({ result: 'ok' });

const { default: app } = await import('../src/app.js');
const { initSocket } = await import('../src/config/socket.js');
const server = http.createServer(app);
initSocket(server);
server.listen(port, '127.0.0.1', () => {
    console.log(JSON.stringify({ ready: true, port, vendorId: String(vendor._id) }));
});
