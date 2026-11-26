// Usage (from /backend): node tests/vendorsAnalyticsE2E.mjs
// Admin > Vendor Analytics (GET /api/admin/analytics/vendors): per-vendor orders, sales value, commission /
// earnings (pending, paid), returns and refunds. Checked two ways: (1) a small dataset whose every number was
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
process.env.MONGO_URI = mem.getUri('ple_vendors_analytics');
Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', SMTP_USER: 'x', SMTP_PASS: 'x', FIREBASE_SERVICE_ACCOUNT: '', SHIPROCKET_EMAIL: '', SHIPROCKET_PASSWORD: '', NODE_ENV: 'development' });

const mongoose = (await import(pathToFileURL(reqB.resolve('mongoose')).href)).default;
const { default: app } = await imp('app.js');
const { signAccessToken } = await imp('config/jwt.js');
await mongoose.connect(process.env.MONGO_URI);
const server = http.createServer(app);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/api`;

const M = {};
for (const x of ['Admin', 'Vendor', 'User', 'Order', 'ReturnRequest', 'Commission']) M[x] = (await imp(`models/${x}.model.js`)).default;

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
const DAY = new Date('2026-11-10T08:00:00Z');
const ins = async (Model, doc) => (await Model.collection.insertOne({ createdAt: DAY, updatedAt: DAY, ...doc })).insertedId;
const ADMIN = await ins(M.Admin, { name: 'Admin', email: 'admin@example.com', password: pw, role: 'admin', isActive: true, status: 'active' });
const mkVendor = (name, storeName, status = 'approved', extra = {}) => ins(M.Vendor, { name, storeName, email: `${name.toLowerCase()}@example.com`, password: pw, status, isActive: true, ...extra });
const V = await mkVendor('Vee', 'Vee Electronics', 'approved', { commissionRate: 10 });
const W = await mkVendor('Wen', 'Wen Traders');
const EMPTY = await mkVendor('New', 'Brand New');
const PEND = await mkVendor('Pend', 'Pending Co', 'pending');
const GONE = await mkVendor('Gone', 'Deleted Co', 'deleted');
const u1 = await ins(M.User, { name: 'u1', email: 'u1@example.com', password: pw, role: 'customer', isActive: true });
const TA = signAccessToken({ id: String(ADMIN), role: 'admin' });
const TV = signAccessToken({ id: String(V), role: 'vendor' });

let oid = 0;
const line = (vendorId, price, quantity, discount = 0) => ({ productId: new mongoose.Types.ObjectId(), vendorId, name: 'x', price, quantity, discount });
const mkOrder = ({ status, lines, at = '2026-11-10T08:00:00Z', deleted = false, groupStatus = {} }) => {
    oid += 1;
    const byVendor = new Map();
    for (const l of lines) { const k = String(l.vendorId); byVendor.set(k, [...(byVendor.get(k) || []), l]); }
    return ins(M.Order, {
        orderId: `ORD-VA-${oid}`, userId: u1, status, paymentMethod: 'upi', paymentStatus: 'paid', items: lines,
        vendorItems: [...byVendor.entries()].map(([k, items]) => ({ vendorId: new mongoose.Types.ObjectId(k), items, status: groupStatus[k] || 'pending' })),
        total: 0, isDeleted: deleted, createdAt: new Date(at), updatedAt: new Date(at),
    });
};

// ---- hand-counted dataset ----
await mkOrder({ status: 'delivered', lines: [line(V, 1000, 2, 100)] });                                                    // V 1900
await mkOrder({ status: 'processing', lines: [line(V, 500, 1), line(W, 700, 1)] });                                       // V 500, W 700
await mkOrder({ status: 'cancelled', lines: [line(V, 800, 1)] });                                                         // V cancelled
await mkOrder({ status: 'returned', lines: [line(V, 250, 1)] });                                                          // V returned
await mkOrder({ status: 'delivered', lines: [line(W, 999, 1)] });                                                         // W 999
await mkOrder({ status: 'delivered', lines: [line(V, 9999, 1)], deleted: true });                                       // deleted: ignored
await mkOrder({ status: 'delivered', lines: [line(V, 400, 1), line(W, 100, 1)], groupStatus: { [String(V)]: 'cancelled' } }); // V's part cancelled, W 100 sold
await mkOrder({ status: 'delivered', lines: [line(V, 150, 2)], at: '2026-10-31T19:00:00Z' });                            // V 300; 1 Nov 00:30 IST
await mkOrder({ status: 'delivered', lines: [line(PEND, 5000, 1)] });                                                     // pending vendor: hidden by default
await mkOrder({ status: 'delivered', lines: [line(GONE, 777, 1)] });                                                      // deleted vendor: never listed

const comm = (vendorId, extra) => ins(M.Commission, { orderId: new mongoose.Types.ObjectId(), vendorId, subtotal: 1000, commissionRate: 10, commission: 100, vendorEarnings: 900, status: 'pending', clearanceStatus: 'pending_delivery', ...extra });
await comm(V, { commission: 190, vendorEarnings: 1710 });                                                                 // pending
await comm(V, { commission: 50, vendorEarnings: 450, status: 'paid', clearanceStatus: 'settled' });                       // paid
await comm(V, { commission: 10, vendorEarnings: 90, status: 'cancelled', clearanceStatus: 'cancelled' });                // excluded
await comm(V, { commission: 20, vendorEarnings: 180, clearanceStatus: 'refunded' });                                      // excluded (refunded)
await comm(W, { commission: 70, vendorEarnings: 630 });                                                                   // pending

const ret = (vendorId, extra) => ins(M.ReturnRequest, { orderId: new mongoose.Types.ObjectId(), reason: 'r', vendorId, items: [{ price: 500, quantity: 1 }], ...extra });
await ret(V, { status: 'pending', refundStatus: 'pending' });                                // value 500, pending refund 500
await ret(V, { status: 'completed', refundStatus: 'processed', refundAmount: 250 });         // value 250, refunded 250
await ret(V, { status: 'rejected', items: [{ price: 300, quantity: 1 }] });                  // rejected: no value
await ret(W, { status: 'pending', refundStatus: 'pending' });                                // W: value 500, pending 500
console.log('In-memory DB ready.\n');

const byId = (d) => Object.fromEntries((d?.vendors || []).map((v) => [v.id, v]));

// 1. Hand-counted numbers
{
    const r = await get(TA, '/admin/analytics/vendors');
    const d = r.data || {};
    const rows = byId(d);
    check('Loads for an admin (200)', r.status === 200, `${r.status} ${r.body?.message}`);
    check('Default list: approved vendors only (V, W, EMPTY) — no pending, no deleted', d.vendors?.length === 3 && !rows[PEND] && !rows[GONE], d.vendors?.map((v) => v.storeName));
    const v = rows[V];
    check('V orders: 6 (deleted order ignored), 3 sold, 1 cancelled, 1 returned', v?.orders.total === 6 && v.orders.sold === 3 && v.orders.cancelled === 1 && v.orders.returned === 1, v?.orders);
    check('V sales value = 1900 + 500 + 300 = 2700 (own lines, after coupon; cancelled/returned/vendor-cancelled group excluded)', v?.orders.salesValue === 2700, v?.orders.salesValue);
    check('V average order value 900, cancel rate 16.7%', v?.orders.averageOrderValue === 900 && v.orders.cancelRate === 16.7, [v?.orders.averageOrderValue, v?.orders.cancelRate]);
    check('V earnings: commission 240, net 2160, pending 1710, paid 450 (cancelled and refunded ledger rows excluded)', JSON.stringify(v?.earnings) === JSON.stringify({ commission: 240, netEarnings: 2160, pending: 1710, paid: 450 }), v?.earnings);
    check('V returns: 3 total, 1 pending, 1 completed, 1 rejected, value 750, refunded 250, pending refund 500, rate 50%', v?.returns.total === 3 && v.returns.pending === 1 && v.returns.completed === 1 && v.returns.rejected === 1 && v.returns.returnValue === 750 && v.returns.refundedAmount === 250 && v.returns.pendingRefundAmount === 500 && v.returns.returnRate === 50, v?.returns);
    check('V details: store name, email and commission rate come through', v?.storeName === 'Vee Electronics' && v.email === 'vee@example.com' && v.commissionRate === 10, [v?.storeName, v?.email, v?.commissionRate]);
    const w = rows[W];
    check('W: 3 orders, 3 sold, sales 700 + 999 + 100 = 1799, avg 599.67', w?.orders.total === 3 && w.orders.sold === 3 && w.orders.salesValue === 1799 && w.orders.averageOrderValue === 599.67, w?.orders);
    check('W earnings: commission 70, net 630, pending 630, paid 0; one pending return worth 500, rate 33.3%', w?.earnings.commission === 70 && w.earnings.pending === 630 && w.earnings.paid === 0 && w.returns.total === 1 && w.returns.returnValue === 500 && w.returns.returnRate === 33.3, [w?.earnings, w?.returns]);
    const e = rows[EMPTY];
    check('Vendor with no activity: zeros, no NaN / division by zero', e && e.orders.total === 0 && e.orders.averageOrderValue === 0 && e.orders.cancelRate === 0 && e.returns.returnRate === 0 && e.earnings.netEarnings === 0, e);
    check('Sorted by sales value, highest first (V 2700, W 1799, EMPTY 0)', d.vendors?.map((x) => x.id).join() === [V, W, EMPTY].map(String).join(), d.vendors?.map((x) => x.orders.salesValue));
    const t = d.totals || {};
    check('Totals: 3 vendors, 2 active, 6 sold orders, sales 4499', t.vendors === 3 && t.activeVendors === 2 && t.orders === 6 && t.salesValue === 4499, t);
    check('Totals: commission 310, net 2790, pending 2340, paid 450', t.commission === 310 && t.netEarnings === 2790 && t.pendingEarnings === 2340 && t.paidEarnings === 450, t);
    check('Totals: 4 returns, value 1250, refunded 250, pending refund 1000', t.returns === 4 && t.returnValue === 1250 && t.refundedAmount === 250 && t.pendingRefundAmount === 1000, t);
}

// 2. Filters
{
    const all = await get(TA, '/admin/analytics/vendors?status=all');
    check('status=all lists approved + pending vendors but never deleted ones', all.data?.vendors?.length === 4 && !!byId(all.data)[PEND] && !byId(all.data)[GONE], all.data?.vendors?.map((v) => v.storeName));
    check('Pending vendor row carries its own sales (5000)', byId(all.data)[PEND]?.orders.salesValue === 5000, byId(all.data)[PEND]?.orders);
    const pend = await get(TA, '/admin/analytics/vendors?status=pending');
    check('status=pending lists only the pending vendor', pend.data?.vendors?.length === 1 && pend.data.vendors[0].id === String(PEND), pend.data?.vendors?.map((v) => v.storeName));
    const s = await get(TA, '/admin/analytics/vendors?search=wen');
    check('search=wen finds only Wen Traders; totals follow the filtered list', s.data?.vendors?.length === 1 && s.data.vendors[0].id === String(W) && s.data.totals.salesValue === 1799, s.data?.totals);
    const rx = await get(TA, '/admin/analytics/vendors?search=' + encodeURIComponent('.*'));
    check('search treats regex characters literally (".*" matches nothing, no error)', rx.status === 200 && rx.data.vendors.length === 0, [rx.status, rx.data?.vendors?.length]);
    check('Invalid status -> 400', (await get(TA, '/admin/analytics/vendors?status=bogus')).status === 400, 400);
}

// 3. Date range in India time (orders, commissions and returns all filtered)
{
    const nov = await get(TA, '/admin/analytics/vendors?from=2026-11-01');
    check('From 1 Nov (IST) includes the order at 00:30 IST on 1 Nov (UTC 31 Oct 19:00)', byId(nov.data)[V]?.orders.total === 6 && byId(nov.data)[V].orders.salesValue === 2700, byId(nov.data)[V]?.orders);
    const oct = await get(TA, '/admin/analytics/vendors?to=2026-10-31');
    check('To 31 Oct (IST): nothing at all (orders, commissions, returns)', oct.data?.totals.salesValue === 0 && oct.data.totals.commission === 0 && oct.data.totals.returns === 0 && oct.data.vendors.length === 3, oct.data?.totals);
    const later = await get(TA, '/admin/analytics/vendors?from=2026-11-05');
    const lv = byId(later.data)[V];
    check('From 5 Nov: V has 5 orders, 2 sold, sales 2400; commissions and returns still inside the range', lv?.orders.total === 5 && lv.orders.sold === 2 && lv.orders.salesValue === 2400 && lv.earnings.netEarnings === 2160 && lv.returns.total === 3, [lv?.orders, lv?.earnings.netEarnings]);
    const one = await get(TA, '/admin/analytics/vendors?from=2026-11-10&to=2026-11-10');
    check('Single day 10 Nov (IST) works (from == to)', one.status === 200 && byId(one.data)[V]?.orders.salesValue === 2400, byId(one.data)[V]?.orders);
    check('Invalid date -> 400', (await get(TA, '/admin/analytics/vendors?from=nope')).status === 400, 400);
}

// 4. Access control
{
    check('No token -> 401', (await get(null, '/admin/analytics/vendors')).status === 401, 401);
    const asVendor = await get(TV, '/admin/analytics/vendors');
    check('A vendor token cannot read admin vendor analytics (401/403)', [401, 403].includes(asVendor.status), asVendor.status);
}

// 5. Independent recomputation over random data (plain JS over raw documents)
{
    const X = await mkVendor('X', 'Random Co');
    const Y = await mkVendor('Y', 'Other Co');
    let seed = 7;
    const rnd = (n) => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed % n; };
    const statuses = ['pending', 'processing', 'shipped', 'delivered', 'delivered', 'cancelled', 'returned'];
    for (let i = 0; i < 80; i += 1) {
        const lines = [];
        for (let k = 0, n = 1 + rnd(3); k < n; k += 1) lines.push(line(rnd(2) ? Y : X, 100 + rnd(900), 1 + rnd(4), rnd(3) === 0 ? rnd(50) : 0));
        await mkOrder({
            status: statuses[rnd(statuses.length)], lines, deleted: rnd(15) === 0,
            groupStatus: rnd(6) === 0 ? { [String(X)]: 'cancelled' } : {},
            at: `2026-11-${String(1 + rnd(20)).padStart(2, '0')}T${String(rnd(24)).padStart(2, '0')}:00:00Z`,
        });
    }
    const raw = await M.Order.collection.find({ isDeleted: { $ne: true } }).toArray();
    const expected = (vid) => {
        const e = { total: 0, sold: 0, value: 0, cancelled: 0, returned: 0 };
        for (const o of raw) {
            const g = o.vendorItems.find((x) => String(x.vendorId) === String(vid));
            if (!g) continue;
            e.total += 1;
            if (o.status === 'cancelled') e.cancelled += 1;
            if (o.status === 'returned') e.returned += 1;
            if (['cancelled', 'returned'].includes(o.status) || g.status === 'cancelled') continue;
            e.sold += 1;
            e.value += g.items.reduce((s, l) => s + l.price * l.quantity - (l.discount || 0), 0);
        }
        return e;
    };
    const r = await get(TA, '/admin/analytics/vendors');
    const rows = byId(r.data);
    for (const [label, vid] of [['X', X], ['Y', Y]]) {
        const e = expected(vid); const o = rows[vid]?.orders;
        check(`Random data ${label} (${e.total} orders): total / sold / cancelled / returned match`, o?.total === e.total && o.sold === e.sold && o.cancelled === e.cancelled && o.returned === e.returned, [o, e]);
        check(`Random data ${label}: sales value matches to the paisa`, Math.abs(o.salesValue - e.value) < 0.01, [o.salesValue, e.value]);
    }
    const sumRows = r.data.vendors.reduce((s, v) => s + v.orders.salesValue, 0);
    check('Random data: totals.salesValue equals the sum of the rows', Math.abs(r.data.totals.salesValue - sumRows) < 0.01, [r.data.totals.salesValue, sumRows]);
}

console.log(`\nSUMMARY ${JSON.stringify({ PASS: pass, FAIL: fail })}`);
await mongoose.disconnect();
server.close();
await mem.stop();
process.exit(fail ? 1 : 0);
