// Usage (from /backend): node tests/vendorMonitoringE2E.mjs
// Admin vendor monitoring: product counts, orders and sales value, unique/repeat customers, payment-mode
// mix, returns and refunds, chat activity. Checked two ways: (1) a small dataset whose every number was
// counted by hand, (2) 80 random orders recomputed independently in plain JavaScript.
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
process.env.MONGO_URI = mem.getUri('ple_vendor_monitoring');
Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', SMTP_USER: 'x', SMTP_PASS: 'x', FIREBASE_SERVICE_ACCOUNT: '', SHIPROCKET_EMAIL: '', SHIPROCKET_PASSWORD: '', NODE_ENV: 'development' });

const mongoose = (await import(pathToFileURL(reqB.resolve('mongoose')).href)).default;
const { default: app } = await imp('app.js');
const { signAccessToken } = await imp('config/jwt.js');
await mongoose.connect(process.env.MONGO_URI);
const server = http.createServer(app);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/api`;

const M = {};
for (const x of ['Admin', 'Vendor', 'User', 'Order', 'Product', 'ReturnRequest', 'VendorChatThread', 'VendorChatMessage']) M[x] = (await imp(`models/${x}.model.js`)).default;

let pass = 0, fail = 0;
const check = (name, cond, actual) => {
    cond ? pass++ : fail++;
    console.log(`${cond ? '✅' : '❌'} ${name} → ${typeof actual === 'string' ? actual : JSON.stringify(actual)}`);
};
const get = async (token, p) => {
    const res = await fetch(BASE + p, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    let body = null;
    try { body = await res.json(); } catch { /* none */ }
    return { status: res.status, body, data: body?.data };
};

const pw = '$2a$12$abcdefghijklmnopqrstuuDummyHashNotUsedForLoginxxxxxxxx';
const now = () => new Date();
const ins = async (Model, doc) => (await Model.collection.insertOne({ createdAt: now(), updatedAt: now(), ...doc })).insertedId;
const ADMIN = await ins(M.Admin, { name: 'Admin', email: 'admin@example.com', password: pw, role: 'admin', isActive: true, status: 'active' });
const V = await ins(M.Vendor, { name: 'Vee', storeName: 'Vee Electronics', email: 'vee@example.com', password: pw, status: 'approved', isActive: true });
const W = await ins(M.Vendor, { name: 'Wen', storeName: 'Wen Traders', email: 'wen@example.com', password: pw, status: 'approved', isActive: true });
const EMPTY = await ins(M.Vendor, { name: 'New', storeName: 'Brand New', email: 'new@example.com', password: pw, status: 'approved', isActive: true });
const U = {};
for (const n of ['u1', 'u2', 'u3']) U[n] = await ins(M.User, { name: n, email: `${n}@example.com`, password: pw, role: 'customer', isActive: true });
const TA = signAccessToken({ id: String(ADMIN), role: 'admin' });
const TV = signAccessToken({ id: String(V), role: 'vendor' });

let oid = 0;
const line = (vendorId, price, quantity, discount = 0) => ({ productId: new mongoose.Types.ObjectId(), vendorId, name: 'x', price, quantity, discount });
const mkOrder = ({ user, guest, status, pay, paid, lines, at = '2026-11-10T08:00:00Z', deleted = false }) => {
    oid += 1;
    const byVendor = new Map();
    for (const l of lines) { const k = String(l.vendorId); byVendor.set(k, [...(byVendor.get(k) || []), l]); }
    return ins(M.Order, {
        orderId: `ORD-MON-${oid}`, userId: user || null, guestInfo: guest || undefined, status, paymentMethod: pay, paymentStatus: paid ? 'paid' : 'pending',
        items: lines, vendorItems: [...byVendor.entries()].map(([k, items]) => ({ vendorId: new mongoose.Types.ObjectId(k), items, status: 'pending' })),
        total: 0, isDeleted: deleted, createdAt: new Date(at), updatedAt: new Date(at),
    });
};

// ---- hand-counted dataset for V ----
await mkOrder({ user: U.u1, status: 'delivered', pay: 'upi', paid: true, lines: [line(V, 1000, 2, 100)] });                       // 1900
await mkOrder({ user: U.u1, status: 'processing', pay: 'cod', lines: [line(V, 500, 1), line(W, 700, 1)] });                     // 500 (W's 700 not V's)
await mkOrder({ user: U.u2, status: 'delivered', pay: 'card', paid: true, lines: [line(V, 200, 3), line(V, 400, 1)] });          // 1000
await mkOrder({ guest: { name: 'G', email: 'G@X.com' }, status: 'pending', pay: 'cod', lines: [line(V, 300, 1)] });              // 300
await mkOrder({ user: U.u3, status: 'cancelled', pay: 'upi', lines: [line(V, 800, 1)] });                                        // cancelled 800
await mkOrder({ user: U.u2, status: 'returned', pay: 'wallet', lines: [line(V, 250, 1)] });                                      // returned 250
await mkOrder({ user: U.u3, status: 'delivered', pay: 'wallet', lines: [line(W, 999, 1)] });                                     // not V's
await mkOrder({ user: U.u1, status: 'delivered', pay: 'upi', lines: [line(V, 9999, 1)], deleted: true });                         // deleted: ignored
await mkOrder({ guest: { name: 'NoContact' }, status: 'delivered', pay: 'upi', paid: true, lines: [line(W, 10, 1)] }); // guest with no email/phone must not break the aggregation
await mkOrder({ user: U.u2, status: 'delivered', pay: 'mixed', lines: [line(V, 150, 2)], at: '2026-10-31T19:00:00Z' });          // 300; 1 Nov 00:30 IST

const prod = (extra) => ins(M.Product, { name: 'p', slug: `p-${Math.random()}`, price: 1, categoryId: new mongoose.Types.ObjectId(), vendorId: V, isActive: true, stock: 'in_stock', approvalStatus: 'approved', ...extra });
await prod({}); await prod({ approvalStatus: 'pending' }); await prod({ approvalStatus: 'rejected' }); await prod({ stock: 'out_of_stock' }); await prod({ isActive: false }); await prod({ isSourceProduct: true });
await ins(M.Product, { name: 'w', slug: 'w-1', price: 1, categoryId: new mongoose.Types.ObjectId(), vendorId: W, isActive: true, approvalStatus: 'approved' });

const ret = (vendorId, extra) => ins(M.ReturnRequest, { orderId: new mongoose.Types.ObjectId(), reason: 'r', vendorId, items: [{ price: 500, quantity: 1 }], ...extra });
await ret(V, { status: 'pending', refundStatus: 'pending' });                                   // value 500, pending refund 500
await ret(V, { status: 'completed', refundStatus: 'processed', refundAmount: 250 });          // value 250, refunded 250
await ret(V, { status: 'rejected', items: [{ price: 300, quantity: 1 }] });                    // rejected: no value
await ret(W, { status: 'pending', refundStatus: 'pending' });                                  // someone else's

const thread = (vendorId, extra) => ins(M.VendorChatThread, { vendorId, customerName: 'c', status: 'active', lastActivity: new Date('2026-11-12T10:00:00Z'), ...extra });
const T1 = await thread(V, { productRef: new mongoose.Types.ObjectId() });
const T2 = await thread(V, { status: 'resolved' });
const T3 = await thread(V, { status: 'closed' });
const T4 = await thread(W, {});
const msg = (threadId) => ins(M.VendorChatMessage, { threadId, senderType: 'customer', text: 'hi' });
for (const [t, n] of [[T1, 3], [T2, 2], [T3, 1], [T4, 4]]) for (let i = 0; i < n; i += 1) await msg(t);
console.log('In-memory DB ready.\n');

// 1. Hand-counted numbers
{
    const r = await get(TA, `/admin/vendors/${V}/monitoring`);
    const d = r.data || {};
    check('Monitoring loads for an admin (200)', r.status === 200 && d.vendor?.storeName === 'Vee Electronics', `${r.status} ${r.body?.message}`);
    check('Products: 5 total (draft source product excluded), 2 live, 1 pending, 1 rejected, 1 out of stock', JSON.stringify(d.products) === JSON.stringify({ total: 5, live: 2, pendingApproval: 1, rejected: 1, outOfStock: 1 }), d.products);
    check('Orders: 7 total (deleted and other vendors\' excluded), 5 sold, 1 cancelled, 1 returned', d.orders?.total === 7 && d.orders.sold === 5 && d.orders.cancelled === 1 && d.orders.returned === 1, [d.orders?.total, d.orders?.sold, d.orders?.cancelled, d.orders?.returned]);
    check('Sales value = 1900 + 500 + 1000 + 300 + 300 = 4000 (only this vendor\'s lines, after coupon)', d.orders?.salesValue === 4000, d.orders?.salesValue);
    check('Average order value 800, cancelled value 800, returned value 250', d.orders?.averageOrderValue === 800 && d.orders.cancelledValue === 800 && d.orders.returnedValue === 250, [d.orders?.averageOrderValue, d.orders?.cancelledValue, d.orders?.returnedValue]);
    check('Customers: 3 unique (u1, u2, guest), 2 repeat (u1, u2)', d.customers?.unique === 3 && d.customers.repeat === 2, d.customers);
    const pay = Object.fromEntries((d.payments || []).map((p) => [p.method, p]));
    check('Payment mix: upi 1 / 1900, cod 2 / 800, card 1 / 1000, mixed 1 / 300; no wallet (not sold)', pay.upi?.orders === 1 && pay.upi.value === 1900 && pay.cod?.orders === 2 && pay.cod.value === 800 && pay.card?.orders === 1 && pay.card.value === 1000 && pay.mixed?.orders === 1 && pay.mixed.value === 300 && !pay.wallet, d.payments);
    check('Payment shares: cod 40%, others 20%; paid orders upi 1, card 1, cod 0', pay.cod?.sharePercent === 40 && pay.upi.sharePercent === 20 && pay.upi.paidOrders === 1 && pay.card.paidOrders === 1 && pay.cod.paidOrders === 0, [pay.cod?.sharePercent, pay.upi?.sharePercent]);
    check('Returns: 3 total, 1 pending, 1 completed, 1 rejected, value 750, refunded 250, pending refund 500, rate 42.9%', d.returns?.total === 3 && d.returns.pending === 1 && d.returns.completed === 1 && d.returns.rejected === 1 && d.returns.returnValue === 750 && d.returns.refundedAmount === 250 && d.returns.pendingRefundAmount === 500 && d.returns.returnRate === 42.9, d.returns);
    check('Chats: 3 threads (1 active, 1 resolved, 1 closed), 1 enquiry, 6 messages, last activity set', d.chats?.total === 3 && d.chats.active === 1 && d.chats.resolved === 1 && d.chats.closed === 1 && d.chats.enquiries === 1 && d.chats.messages === 6 && !!d.chats.lastActivity, d.chats);
    const st = Object.fromEntries((d.orders?.byStatus || []).map((s) => [s.status, s]));
    check('Orders by status: delivered 3 / 3200, processing 1, pending 1, cancelled 1, returned 1', st.delivered?.orders === 3 && st.delivered.value === 3200 && st.processing?.orders === 1 && st.pending?.orders === 1 && st.cancelled?.orders === 1 && st.returned?.orders === 1, d.orders?.byStatus);
}

{
    const w = await get(TA, `/admin/vendors/${W}/monitoring`);
    check('A guest order with no email and no phone does not break monitoring (was a 500)', w.status === 200 && w.data.customers.unique >= 2, `${w.status} ${w.body?.message}`);
}

// 2. Date range in India time
{
    const nov = await get(TA, `/admin/vendors/${V}/monitoring?from=2026-11-01`);
    check('From 1 Nov (IST) includes the order placed 00:30 IST on 1 Nov (UTC 31 Oct 19:00)', nov.data?.orders?.total === 7 && nov.data.orders.salesValue === 4000, [nov.data?.orders?.total, nov.data?.orders?.salesValue]);
    const oct = await get(TA, `/admin/vendors/${V}/monitoring?to=2026-10-31`);
    check('To 31 Oct (IST) excludes it: nothing before November', oct.data?.orders?.total === 0 && oct.data.orders.salesValue === 0 && oct.data.customers.unique === 0, [oct.data?.orders?.total]);
    const later = await get(TA, `/admin/vendors/${V}/monitoring?from=2026-11-05`);
    check('From 5 Nov: 6 orders, 4 sold, sales 3700, customers 3', later.data?.orders?.total === 6 && later.data.orders.sold === 4 && later.data.orders.salesValue === 3700 && later.data.customers.unique === 3, [later.data?.orders?.total, later.data?.orders?.salesValue]);
    const bad = await get(TA, `/admin/vendors/${V}/monitoring?from=not-a-date`);
    check('Invalid date rejected (400)', bad.status === 400, bad.status);
    check('Product count is not date-filtered', later.data?.products?.total === 5, later.data?.products?.total);
}

// 3. Empty vendor, access control
{
    const e = await get(TA, `/admin/vendors/${EMPTY}/monitoring`);
    check('A vendor with no activity returns zeros (no errors, no division by zero)', e.status === 200 && e.data.orders.total === 0 && e.data.orders.averageOrderValue === 0 && e.data.returns.returnRate === 0 && e.data.payments.length === 0 && e.data.chats.total === 0 && e.data.products.total === 0, e.data?.orders);
    check('Unknown vendor -> 404', (await get(TA, `/admin/vendors/${new mongoose.Types.ObjectId()}/monitoring`)).status === 404, 404);
    check('Malformed vendor id -> 400', (await get(TA, '/admin/vendors/not-an-id/monitoring')).status === 400, 400);
    check('No token -> 401', (await get(null, `/admin/vendors/${V}/monitoring`)).status === 401, 401);
    const asVendor = await get(TV, `/admin/vendors/${V}/monitoring`);
    check('A vendor token cannot read admin monitoring (401/403)', [401, 403].includes(asVendor.status), asVendor.status);
}

// 4. Independent recomputation over random data (different method: plain JS over raw documents)
{
    const X = await ins(M.Vendor, { name: 'X', storeName: 'Random Co', email: 'x@example.com', password: pw, status: 'approved', isActive: true });
    const Y = await ins(M.Vendor, { name: 'Y', storeName: 'Other Co', email: 'y@example.com', password: pw, status: 'approved', isActive: true });
    let seed = 42;
    const rnd = (n) => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed % n; };
    const statuses = ['pending', 'processing', 'shipped', 'delivered', 'delivered', 'cancelled', 'returned'];
    const pays = ['upi', 'cod', 'card', 'wallet', 'bank', 'mixed'];
    const users = Object.values(U);
    for (let i = 0; i < 80; i += 1) {
        const lines = [];
        for (let k = 0, n = 1 + rnd(3); k < n; k += 1) lines.push(line(rnd(3) === 0 ? Y : X, 100 + rnd(900), 1 + rnd(4), rnd(3) === 0 ? rnd(50) : 0));
        if (!lines.some((l) => String(l.vendorId) === String(X)) && rnd(2)) lines.push(line(X, 50 + rnd(50), 1));
        const g = rnd(4) === 0;
        await mkOrder({ user: g ? null : users[rnd(users.length)], guest: g ? { name: 'g', email: `guest${rnd(5)}@example.com` } : undefined, status: statuses[rnd(statuses.length)], pay: pays[rnd(pays.length)], lines, deleted: rnd(15) === 0, at: `2026-11-${String(1 + rnd(20)).padStart(2, '0')}T${String(rnd(24)).padStart(2, '0')}:00:00Z` });
    }
    const all = await M.Order.collection.find({ 'vendorItems.vendorId': X, isDeleted: { $ne: true } }).toArray();
    const exp = { total: 0, sold: 0, value: 0, cust: new Map(), pay: new Map() };
    for (const o of all) {
        exp.total += 1;
        if (['cancelled', 'returned'].includes(o.status)) continue;
        const goods = o.items.filter((l) => String(l.vendorId) === String(X)).reduce((s, l) => s + l.price * l.quantity - (l.discount || 0), 0);
        exp.sold += 1; exp.value += goods;
        const key = o.userId ? `u:${o.userId}` : `g:${o.guestInfo.email.toLowerCase()}`;
        exp.cust.set(key, (exp.cust.get(key) || 0) + 1);
        const p = exp.pay.get(o.paymentMethod) || { orders: 0, value: 0 };
        exp.pay.set(o.paymentMethod, { orders: p.orders + 1, value: p.value + goods });
    }
    const r = await get(TA, `/admin/vendors/${X}/monitoring`);
    const d = r.data;
    check(`Random data (${exp.total} orders): total / sold match the independent count`, d.orders.total === exp.total && d.orders.sold === exp.sold, [d.orders.total, exp.total, d.orders.sold, exp.sold]);
    check('Random data: sales value matches to the paisa', Math.abs(d.orders.salesValue - exp.value) < 0.01, [d.orders.salesValue, exp.value]);
    check('Random data: unique and repeat customers match', d.customers.unique === exp.cust.size && d.customers.repeat === [...exp.cust.values()].filter((n) => n > 1).length, [d.customers, exp.cust.size]);
    const payOk = d.payments.length === exp.pay.size && d.payments.every((p) => exp.pay.get(p.method)?.orders === p.orders && Math.abs(exp.pay.get(p.method).value - p.value) < 0.01);
    check('Random data: every payment mode count and value matches', payOk, d.payments.map((p) => `${p.method}:${p.orders}`));
    check('Random data: payment orders add up to sold orders', d.payments.reduce((s, p) => s + p.orders, 0) === d.orders.sold, d.orders.sold);
    check('Random data: status buckets add up to the total', d.orders.byStatus.reduce((s, x) => s + x.orders, 0) === d.orders.total, d.orders.total);
}

console.log(`\nSUMMARY ${JSON.stringify({ PASS: pass, FAIL: fail })}`);
await mongoose.disconnect();
server.close();
await mem.stop();
process.exit(fail ? 1 : 0);
