// Usage (from /backend): node tests/spendingLimitsE2E.mjs
// B2B employee spending limits: per-order + calendar-month (India time) limits on the full order
// total, any payment method; enforced on checkout, Source Now and B2B RFQ; race-safe; admin can
// set / validate them; employee + admin can see usage. In-memory MongoDB, Razorpay stubbed.
import { createRequire } from 'module';
import { pathToFileURL, fileURLToPath } from 'url';
import http from 'http';
import path from 'path';

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = `${BACKEND}/src`;
const reqB = createRequire(`${BACKEND}/package.json`);
const imp = (p) => import(pathToFileURL(`${SRC}/${p}`).href);

const { MongoMemoryReplSet } = reqB('mongodb-memory-server');
const mem = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
process.env.MONGO_URI = mem.getUri('ple_spend_limits');
Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', SMTP_USER: 'x', SMTP_PASS: 'x', FIREBASE_SERVICE_ACCOUNT: '', SHIPROCKET_EMAIL: '', SHIPROCKET_PASSWORD: '', NODE_ENV: 'development', RAZORPAY_KEY_ID: 'rzp_test_dummy', RAZORPAY_KEY_SECRET: 'x' });

const mongoose = (await import(pathToFileURL(reqB.resolve('mongoose')).href)).default;
const rzpSvc = await imp('services/razorpay.service.js');
let seq = 0;
rzpSvc.__setRazorpayClientForTests({ orders: { create: async (o) => ({ id: `order_T${++seq}`, amount: o.amount, currency: 'INR' }) }, payments: { fetch: async () => null } });
const limits = await imp('services/b2bSpendingLimit.service.js');
const { default: app } = await imp('app.js');
const { signAccessToken } = await imp('config/jwt.js');
await mongoose.connect(process.env.MONGO_URI);
const server = http.createServer(app);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/api`;

const M = {};
for (const n of ['User', 'Vendor', 'Product', 'Order', 'ProductRequest', 'Address']) M[n] = (await imp(`models/${n}.model.js`)).default;

let pass = 0, fail = 0;
const check = (name, cond, actual) => {
    cond ? pass++ : fail++;
    console.log(`${cond ? '✅' : '❌'} ${name} → ${typeof actual === 'string' ? actual : JSON.stringify(actual)}`);
};
const api = async (token, method, p, body) => {
    const res = await fetch(BASE + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    let json = null;
    try { json = await res.json(); } catch { /* none */ }
    return { status: res.status, body: json, data: json?.data };
};

// ── seed
const pw = '$2a$12$abcdefghijklmnopqrstuuDummyHashNotUsedForLoginxxxxxxxx';
const ins = async (Model, doc) => (await Model.collection.insertOne({ createdAt: new Date(), updatedAt: new Date(), ...doc })).insertedId;
const COMPANY = new mongoose.Types.ObjectId();
const ADMIN = await ins(M.User, { name: 'Asha Admin', email: 'asha@example.com', password: pw, role: 'b2bAdmin', companyId: COMPANY, isActive: true, isVerified: true, phone: '9000000010', b2bPerOrderSpendingLimit: 100 });
const EMP = await ins(M.User, { name: 'Ravi Staff', email: 'ravi@example.com', password: pw, role: 'b2bEmployee', companyId: COMPANY, isActive: true, isVerified: true, phone: '9000000011', b2bPerOrderSpendingLimit: 5000, b2bSpendingLimit: 8000, b2bWalletBalance: 50000 });
await ins(M.Address, { userId: EMP, name: 'Office', fullName: 'Ravi', phone: '9000000011', address: '1 Rd', city: 'Pune', state: 'Maharashtra', zipCode: '411001', country: 'India', isDefault: true });
const VEND = await ins(M.Vendor, { name: 'V', storeName: 'Volt Supplies', email: 'volt@example.com', password: pw, status: 'approved', isVerified: true, isActive: true, gstNumber: '27ABCDE1234F1Z5', shippingEnabled: false });
const P = await ins(M.Product, { name: 'Office Chair', slug: 'office-chair', price: 1000, stockQuantity: 1000, stock: 'in_stock', isActive: true, isVisible: true, approvalStatus: 'approved', gstMode: 'custom', gstRate: 18, vendorId: VEND, listingType: 'vendor_direct' });

const TE = signAccessToken({ id: String(EMP), role: 'b2bEmployee', name: 'Ravi Staff', email: 'ravi@example.com', companyId: String(COMPANY) });
const TA = signAccessToken({ id: String(ADMIN), role: 'b2bAdmin', name: 'Asha Admin', email: 'asha@example.com', companyId: String(COMPANY) });
const addr = { name: 'Ravi', email: 'ravi@example.com', phone: '9000000011', address: '1 Rd', city: 'Pune', state: 'Maharashtra', zipCode: '411001', country: 'India' };
// each unit = 1000 + 18% GST = 1180
const buy = (token, qty, paymentMethod = 'cod') => api(token, 'POST', '/user/orders', { items: [{ productId: String(P), quantity: qty }], shippingAddress: addr, paymentMethod });
const lastOrder = (uid) => M.Order.findOne({ userId: uid }).sort({ createdAt: -1, _id: -1 }).lean();
const orderCount = () => M.Order.countDocuments({ userId: EMP });
console.log('In-memory DB ready.\n');

// 0. Month window (India time)
{
    const w = limits.monthWindowIST(new Date('2026-11-30T20:00:00Z')); // = 1 Dec 01:30 IST
    check('Month window uses India time (30 Nov 20:00 UTC is December in IST)', w.start.toISOString() === '2026-11-30T18:30:00.000Z' && w.end.toISOString() === '2026-12-31T18:30:00.000Z', [w.start, w.end]);
}

// 1. Per-order limit, any payment method
{
    const r = await buy(TE, 5, 'cod'); // 5900 > 5000
    check('Per-order: ₹5,900 COD order blocked by ₹5,000 limit', r.status === 400 && /per-order spending limit of ₹5,000/.test(r.body?.message), `${r.status} ${r.body?.message}`);
    const r2 = await buy(TE, 5, 'card');
    check('Per-order: card payment blocked too (not just wallet)', r2.status === 400 && /per-order/.test(r2.body?.message), `${r2.status} ${r2.body?.message}`);
    check('Per-order: no order created', (await orderCount()) === 0, await orderCount());
    const stock = (await M.Product.findById(P).lean()).stockQuantity;
    check('Per-order: no stock taken', stock === 1000, stock);
}

// 2. Monthly limit
{
    const a = await buy(TE, 4, 'cod'); // 4720
    check('Monthly: ₹4,720 order OK', a.status === 201, `${a.status} ${a.body?.message}`);
    const b = await buy(TE, 3, 'wallet'); // 3540 -> 8260 > 8000
    check('Monthly: next ₹3,540 blocked, shows ₹3,280 left', b.status === 400 && /monthly spending limit of ₹8,000/.test(b.body?.message) && /₹3,280 left/.test(b.body?.message), `${b.status} ${b.body?.message}`);
    const wallet = (await M.User.findById(EMP).lean()).b2bWalletBalance;
    check('Monthly: blocked wallet order did not debit wallet', wallet === 50000, wallet);
    const c = await buy(TE, 2, 'wallet'); // 2360 -> 7080
    check('Monthly: ₹2,360 wallet order OK (total ₹7,080)', c.status === 201, `${c.status} ${c.body?.message}`);

    const s = await api(TE, 'GET', '/user/spending-limits');
    check('Employee sees usage: spent 7080, remaining 920', s.data?.spentThisMonth === 7080 && s.data?.remainingThisMonth === 920 && s.data?.perOrderLimit === 5000 && s.data?.appliesTo === true, s.data);
}

// 3. What counts toward the month
{
    const first = await M.Order.findOne({ userId: EMP, total: 4720 });
    await M.Order.updateOne({ _id: first._id }, { $set: { status: 'cancelled' } });
    let s = await api(TE, 'GET', '/user/spending-limits');
    check('Cancelled order no longer counts (7080 -> 2360)', s.data?.spentThisMonth === 2360, s.data?.spentThisMonth);
    const lastMonth = new Date(Date.now() - 40 * 24 * 3600 * 1000);
    await M.Order.collection.insertOne({ orderId: 'ORD-OLD', userId: EMP, total: 7000, status: 'delivered', paymentStatus: 'paid', createdAt: lastMonth, updatedAt: lastMonth });
    await M.Order.collection.insertOne({ orderId: 'ORD-FAILED', userId: EMP, total: 3000, status: 'pending', paymentStatus: 'failed', createdAt: new Date(), updatedAt: new Date() });
    s = await api(TE, 'GET', '/user/spending-limits');
    check("Last month's and failed-payment orders don't count", s.data?.spentThisMonth === 2360, s.data?.spentThisMonth);
    const d = await buy(TE, 4, 'card'); // 4720 -> 7080 (card: unpaid but counts)
    check('Room freed by cancellation can be used again', d.status === 201, `${d.status} ${d.body?.message}`);
    s = await api(TE, 'GET', '/user/spending-limits');
    check('Unpaid online order counts toward the month', s.data?.spentThisMonth === 7080, s.data?.spentThisMonth);
}

// 4. Two orders at the same moment can't both slip under the limit (remaining 920 -> raise to allow exactly one 1180 order)
{
    await M.User.updateOne({ _id: EMP }, { $set: { b2bSpendingLimit: 7080 + 1500 } });
    const before = await orderCount();
    const results = await Promise.all([buy(TE, 1, 'cod'), buy(TE, 1, 'cod'), buy(TE, 1, 'cod')]);
    const ok = results.filter((r) => r.status === 201).length;
    check('Concurrent: exactly one of three ₹1,180 orders fits in ₹1,500', ok === 1 && (await orderCount()) === before + 1, [results.map((r) => r.status), (await orderCount()) - before]);
    const s = await api(TE, 'GET', '/user/spending-limits');
    check('Concurrent: month total stays within limit', s.data?.spentThisMonth <= 8580, s.data?.spentThisMonth);
}

// 5. B2B admin is not limited by employee limits
{
    const r = await buy(TA, 1, 'cod');
    check('Company admin not subject to employee limits', r.status === 201, `${r.status} ${r.body?.message}`);
    const s = await api(TA, 'GET', '/user/spending-limits');
    check('Admin summary says limits do not apply', s.data?.appliesTo === false, s.data?.appliesTo);
}

// 6. Admin sets / validates limits
{
    const bad = await api(TA, 'PUT', `/b2b-user/admin/employees/${EMP}`, { b2bSpendingLimit: -5 });
    check('Admin: negative limit rejected', bad.status === 400, `${bad.status} ${bad.body?.message}`);
    const bad2 = await api(TA, 'PUT', `/b2b-user/admin/employees/${EMP}`, { b2bPerOrderSpendingLimit: 'abc' });
    check('Admin: non-number limit rejected', bad2.status === 400, `${bad2.status} ${bad2.body?.message}`);
    const up = await api(TA, 'PUT', `/b2b-user/admin/employees/${EMP}`, { b2bPerOrderSpendingLimit: 20000, b2bSpendingLimit: 50000 });
    check('Admin: limits updated', up.status === 200 && up.data?.b2bPerOrderSpendingLimit === 20000 && up.data?.b2bSpendingLimit === 50000, [up.status, up.data?.b2bPerOrderSpendingLimit, up.data?.b2bSpendingLimit]);
    const ov = await api(TA, 'GET', `/b2b-user/admin/employees/${EMP}/overview`);
    check('Admin overview shows monthly usage', ov.status === 200 && ov.data?.spending?.monthlyLimit === 50000 && ov.data?.spending?.spentThisMonth > 0, [ov.status, ov.data?.spending, ov.body?.message]);
    const cr = await api(TA, 'POST', '/b2b-user/admin/employees', { firstName: 'Neha', lastName: 'New', email: 'neha@example.com', b2bPerOrderSpendingLimit: 3000, b2bSpendingLimit: 10000 });
    const neha = await M.User.findOne({ email: 'neha@example.com' }).lean();
    check('Admin: create employee with both limits', cr.status === 201 && neha?.b2bPerOrderSpendingLimit === 3000 && neha?.b2bSpendingLimit === 10000, [cr.status, cr.body?.message, neha?.b2bPerOrderSpendingLimit, neha?.b2bSpendingLimit]);
    const zero = await api(TA, 'PUT', `/b2b-user/admin/employees/${EMP}`, { b2bPerOrderSpendingLimit: '', b2bSpendingLimit: 0 });
    check('Admin: empty/0 means no limit', zero.status === 200 && zero.data?.b2bPerOrderSpendingLimit === 0 && zero.data?.b2bSpendingLimit === 0, [zero.status, zero.data?.b2bPerOrderSpendingLimit]);
    const big = await buy(TE, 30, 'cod'); // 35,400 with no limits
    check('No limits -> large order allowed', big.status === 201, `${big.status} ${big.body?.message}`);
}

// 7. Source Now respects the limit too
{
    await M.User.updateOne({ _id: EMP }, { $set: { b2bPerOrderSpendingLimit: 2000 } });
    await M.ProductRequest.collection.insertOne({ requestId: 'REQ-900001', userId: EMP, productName: 'Office Chair', category: 'Furniture', quantity: 5, expectedBudget: 5000, status: 'Final Proposal', selectedFulfillment: { pleQuantity: 0, vendors: [{ vendorId: VEND, quantity: 5, price: 900 }], finalPrice: 900 }, timeline: [], auditLog: [], createdAt: new Date() });
    const before = await orderCount();
    const rzpBefore = seq;
    const addrDoc = await M.Address.findOne({ userId: EMP }).lean();
    const r = await api(TE, 'POST', '/user/product-requests/REQ-900001/confirm', { addressId: String(addrDoc._id) });
    check('Source Now: ₹5,310 blocked by ₹2,000 per-order limit', r.status === 400 && /per-order/.test(r.body?.message), `${r.status} ${r.body?.message}`);
    check('Source Now: no order / payment started', (await orderCount()) === before && seq === rzpBefore, [await orderCount() - before, seq - rzpBefore]);
}

console.log(`\n${pass} passed, ${fail} failed`);
server.close();
await mongoose.disconnect();
await mem.stop();
process.exit(fail ? 1 : 0);
