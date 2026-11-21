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
const vendor = await Vendor.create({ name: 'Vee', email: 'vee@example.com', password: PASSWORD, storeName: 'Vee Electronics', status: 'approved', isVerified: true, commissionRate: 10, gstNumber: '27ABCDE1234F1Z5' });
// the old single account, written straight to the collection (no bankAccounts yet), dated at registration
await Vendor.collection.updateOne({ _id: vendor._id }, { $set: { createdAt: new Date('2026-01-15T00:00:00Z'), bankDetails: { accountName: 'Vee Electronics', accountNumber: '123456789012', bankName: 'HDFC Bank', ifscCode: 'HDFC0001234', upiId: '', branchName: 'Pune', accountType: 'current' } } });
await VendorWallet.create({ vendorId: vendor._id, available: 20000, onHold: 0, reserved: 0, withdrawn: 2500, totalEarnings: 22500 });
const old = { accountName: 'Vee Electronics', accountNumber: '123456789012', ifscCode: 'HDFC0001234', bankName: 'HDFC Bank' };
await WithdrawalRequest.collection.insertMany([
    { withdrawalId: 'WR-20261001-1111', vendorId: vendor._id, requestedAmount: 1000, eligibleAmountAtRequest: 1000, status: 'paid', paidAmount: 1000, paidAt: new Date('2026-10-01'), bankDetailsSnapshot: old, paymentMethod: 'bank_transfer', createdAt: new Date('2026-10-01'), updatedAt: new Date('2026-10-01') },
    { withdrawalId: 'WR-20261015-2222', vendorId: vendor._id, requestedAmount: 1500, eligibleAmountAtRequest: 1500, status: 'paid', paidAmount: 1500, paidAt: new Date('2026-10-15'), bankDetailsSnapshot: old, paymentMethod: 'bank_transfer', createdAt: new Date('2026-10-15'), updatedAt: new Date('2026-10-15') },
]);

const { default: app } = await import('../src/app.js');
const { initSocket } = await import('../src/config/socket.js');
const server = http.createServer(app);
initSocket(server);
server.listen(port, '127.0.0.1', () => {
    console.log(JSON.stringify({ ready: true, port, vendorId: String(vendor._id) }));
});
