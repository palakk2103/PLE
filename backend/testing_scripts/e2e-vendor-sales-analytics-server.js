/**
 * Isolated backend for browser-testing Seller panel > Analytics (/vendor/analytics).
 * In-memory MongoDB with the hand-counted dataset of tests/vendorAnalyticsE2E.mjs for seller "Vee Electronics":
 *   Nov 2026: sales 3000 from 4 sold orders, net sales 2750, commission 240, earnings 2160 (pending 1710, paid 450),
 *   4 returns, top products Alpha 2200 / Beta 800, 1 low-stock + 2 out-of-stock products.
 * The seller login needs an email-OTP, so browser tests skip it: the token printed below goes into
 * localStorage as `vendor-token`.
 * Usage: node testing_scripts/e2e-vendor-sales-analytics-server.js [port]
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
const [Vendor, Order, Commission, ReturnRequest, Product] = await Promise.all(['Vendor', 'Order', 'Commission', 'ReturnRequest', 'Product'].map(M));
const { signAccessToken } = await import('../src/config/jwt.js');

const DAY = new Date('2026-11-10T08:00:00Z');
const mk = (name, storeName) => Vendor.collection.insertOne({ name, storeName, email: `${name.toLowerCase()}@example.com`, password: 'x', status: 'approved', isActive: true, isVerified: true, createdAt: DAY, updatedAt: DAY }).then((r) => r.insertedId);
const V = await mk('Vee', 'Vee Electronics');
const W = await mk('Wen', 'Wen Traders');
const vendorToken = signAccessToken({ id: String(V), role: 'vendor' });

const PA = new mongoose.Types.ObjectId(), PB = new mongoose.Types.ObjectId();
let n = 0;
const line = (vendorId, price, quantity, discount = 0, prod = null) => ({ productId: prod?.id || new mongoose.Types.ObjectId(), vendorId, name: prod?.name || 'Item', price, quantity, discount });
const Alpha = { id: PA, name: 'Alpha' }, Beta = { id: PB, name: 'Beta' };
const order = (status, lines, at = DAY, groupStatus = 'pending', deleted = false) => {
    const by = new Map();
    for (const l of lines) by.set(String(l.vendorId), [...(by.get(String(l.vendorId)) || []), l]);
    return Order.collection.insertOne({
        orderId: `ORD-VAN-${++n}`, status, paymentMethod: 'upi', paymentStatus: 'paid', items: lines, total: 0, isDeleted: deleted,
        vendorItems: [...by.entries()].map(([k, items]) => ({ vendorId: new mongoose.Types.ObjectId(k), items, status: k === String(V) ? groupStatus : 'pending' })),
        createdAt: new Date(at), updatedAt: new Date(at),
    }).then((r) => r.insertedId);
};
const o1 = await order('delivered', [line(V, 1000, 2, 100, Alpha)], DAY, 'delivered');
await order('processing', [line(V, 500, 1, 0, Beta), line(W, 700, 1)], DAY, 'processing');
await order('cancelled', [line(V, 800, 1)], DAY, 'cancelled');
const o4 = await order('returned', [line(V, 250, 1)], DAY, 'delivered');
await order('delivered', [line(V, 400, 1, 0, Alpha), line(W, 100, 1)], DAY, 'cancelled');
await order('delivered', [line(V, 300, 1, 0, Alpha)], '2026-11-11T08:00:00Z', 'delivered');
await order('delivered', [line(V, 150, 2, 0, Beta)], '2026-10-31T19:00:00Z', 'delivered');
await order('delivered', [line(V, 9999, 1)], DAY, 'pending', true);
await order('delivered', [line(V, 1000, 1)], '2026-10-20T08:00:00Z', 'delivered');
await order('cancelled', [line(V, 600, 1)], '2026-10-25T08:00:00Z', 'cancelled');

const comm = (vendorId, extra) => Commission.collection.insertOne({ orderId: new mongoose.Types.ObjectId(), vendorId, subtotal: 1000, commissionRate: 10, commission: 100, vendorEarnings: 900, status: 'pending', clearanceStatus: 'pending_delivery', createdAt: DAY, updatedAt: DAY, ...extra });
await comm(V, { commission: 190, vendorEarnings: 1710 });
await comm(V, { commission: 50, vendorEarnings: 450, status: 'paid', clearanceStatus: 'settled' });
await comm(V, { commission: 10, vendorEarnings: 90, status: 'cancelled', clearanceStatus: 'cancelled' });
await comm(V, { commission: 20, vendorEarnings: 180, clearanceStatus: 'refunded' });
const ret = (orderId, extra) => ReturnRequest.collection.insertOne({ orderId, reason: 'r', vendorId: V, items: [{ price: 500, quantity: 1 }], createdAt: DAY, updatedAt: DAY, ...extra });
await ret(o1, { status: 'pending', refundStatus: 'pending' });
await ret(o1, { status: 'completed', refundStatus: 'processed', refundAmount: 250 });
await ret(o1, { status: 'rejected', items: [{ price: 300, quantity: 1 }] });
await ret(o4, { status: 'completed', refundStatus: 'processed', refundAmount: 100 });
const prod = (extra) => Product.collection.insertOne({ name: 'p', slug: `p-${Math.random()}`, price: 1, categoryId: new mongoose.Types.ObjectId(), vendorId: V, isActive: true, stock: 'in_stock', approvalStatus: 'approved', createdAt: DAY, updatedAt: DAY, ...extra });
await prod({}); await prod({}); await prod({ stock: 'low_stock' }); await prod({ stock: 'out_of_stock' }); await prod({ stock: 'out_of_stock' });

const { default: app } = await import('../src/app.js');
const server = http.createServer(app);
server.listen(port, '127.0.0.1', () => console.log(JSON.stringify({ ready: true, port, vendorId: String(V), vendorToken })));
