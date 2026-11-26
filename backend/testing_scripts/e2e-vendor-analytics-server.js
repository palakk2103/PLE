/**
 * Isolated backend for browser-testing Admin > Vendor Analytics (/ple-ops-desk/vendors/analytics).
 * In-memory MongoDB with a small hand-counted dataset (same numbers as tests/vendorsAnalyticsE2E.mjs):
 *   Vee Electronics: 3 sold orders, sales 2700, commission 240, net 2160 (pending 1710, paid 450), 3 returns
 *   Wen Traders:     3 sold orders, sales 1799, commission 70,  net 630 (pending 630), 1 return
 *   Brand New:       no activity;  Pending Co: pending vendor (hidden by default)
 *   - Admin  admin@example.com / Passw0rd!  (log in at /ple-ops-desk/login)
 * Usage: node testing_scripts/e2e-vendor-analytics-server.js [port]
 */
process.env.JWT_SECRET = 'e2e-secret';
process.env.JWT_REFRESH_SECRET = 'e2e-refresh';
process.env.NODE_ENV = 'test';
process.env.CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
for (const k of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SHIPROCKET_EMAIL', 'SHIPROCKET_PASSWORD']) process.env[k] = '';

import http from 'node:http';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const port = Number(process.argv[2] || 5000);
const repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
await mongoose.connect(repl.getUri('e2e_vendor_analytics'));

const M = (n) => import(`../src/models/${n}.model.js`).then((m) => m.default || m[n]);
const [Vendor, Admin, Order, Commission, ReturnRequest] = await Promise.all(['Vendor', 'Admin', 'Order', 'Commission', 'ReturnRequest'].map(M));
const PASSWORD = 'Passw0rd!';
const admin = await Admin.create({ name: 'Admin', email: 'admin@example.com', password: PASSWORD, role: 'superadmin', isActive: true });
// The super-admin login screen also asks for an identity ID and a personal secret, so browser tests
// skip it: this token (printed below) is put straight into localStorage as `adminToken`.
const { signAccessToken } = await import('../src/config/jwt.js');
const adminToken = signAccessToken({ id: String(admin._id), role: 'superadmin' });

const DAY = new Date('2026-11-10T08:00:00Z');
const mk = (name, storeName, status = 'approved', extra = {}) => Vendor.collection.insertOne({ name, storeName, email: `${name.toLowerCase()}@example.com`, password: 'x', status, isActive: true, createdAt: DAY, updatedAt: DAY, ...extra }).then((r) => r.insertedId);
const V = await mk('Vee', 'Vee Electronics', 'approved', { commissionRate: 10 });
const W = await mk('Wen', 'Wen Traders');
await mk('New', 'Brand New');
const P = await mk('Pend', 'Pending Co', 'pending');

let n = 0;
const line = (vendorId, price, quantity, discount = 0) => ({ productId: new mongoose.Types.ObjectId(), vendorId, name: 'Item', price, quantity, discount });
const order = (status, lines, at = DAY, groupStatus = {}, deleted = false) => {
    const by = new Map();
    for (const l of lines) by.set(String(l.vendorId), [...(by.get(String(l.vendorId)) || []), l]);
    return Order.collection.insertOne({
        orderId: `ORD-VA-${++n}`, status, paymentMethod: 'upi', paymentStatus: 'paid', items: lines, total: 0, isDeleted: deleted,
        vendorItems: [...by.entries()].map(([k, items]) => ({ vendorId: new mongoose.Types.ObjectId(k), items, status: groupStatus[k] || 'pending' })),
        createdAt: new Date(at), updatedAt: new Date(at),
    });
};
await order('delivered', [line(V, 1000, 2, 100)]);
await order('processing', [line(V, 500, 1), line(W, 700, 1)]);
await order('cancelled', [line(V, 800, 1)]);
await order('returned', [line(V, 250, 1)]);
await order('delivered', [line(W, 999, 1)]);
await order('delivered', [line(V, 9999, 1)], DAY, {}, true);
await order('delivered', [line(V, 400, 1), line(W, 100, 1)], DAY, { [String(V)]: 'cancelled' });
await order('delivered', [line(V, 150, 2)], '2026-10-31T19:00:00Z');
await order('delivered', [line(P, 5000, 1)]);

const comm = (vendorId, extra) => Commission.collection.insertOne({ orderId: new mongoose.Types.ObjectId(), vendorId, subtotal: 1000, commissionRate: 10, commission: 100, vendorEarnings: 900, status: 'pending', clearanceStatus: 'pending_delivery', createdAt: DAY, updatedAt: DAY, ...extra });
await comm(V, { commission: 190, vendorEarnings: 1710 });
await comm(V, { commission: 50, vendorEarnings: 450, status: 'paid', clearanceStatus: 'settled' });
await comm(V, { commission: 10, vendorEarnings: 90, status: 'cancelled', clearanceStatus: 'cancelled' });
await comm(W, { commission: 70, vendorEarnings: 630 });
const ret = (vendorId, extra) => ReturnRequest.collection.insertOne({ orderId: new mongoose.Types.ObjectId(), reason: 'r', vendorId, items: [{ price: 500, quantity: 1 }], createdAt: DAY, updatedAt: DAY, ...extra });
await ret(V, { status: 'pending', refundStatus: 'pending' });
await ret(V, { status: 'completed', refundStatus: 'processed', refundAmount: 250 });
await ret(V, { status: 'rejected', items: [{ price: 300, quantity: 1 }] });
await ret(W, { status: 'pending', refundStatus: 'pending' });

const { default: app } = await import('../src/app.js');
const server = http.createServer(app);
server.listen(port, '127.0.0.1', () => console.log(JSON.stringify({ ready: true, port, adminToken })));
