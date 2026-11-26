// Usage (from /backend): node tests/vendorAnalyticsE2E.mjs
// Seller panel > Analytics (GET /api/vendor/analytics/overview): sales, net sales after refunds, average
// order value, commission / earnings, top products, returns, stock alerts, custom date range and the
// "vs previous period" growth. Checked two ways: (1) a small dataset whose every number was counted by
// hand, (2) 80 random orders recomputed independently in plain JavaScript.
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
process.env.MONGO_URI = mem.getUri('ple_vendor_analytics');
Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', SMTP_USER: 'x', SMTP_PASS: 'x', FIREBASE_SERVICE_ACCOUNT: '', SHIPROCKET_EMAIL: '', SHIPROCKET_PASSWORD: '', NODE_ENV: 'development' });

const mongoose = (await import(pathToFileURL(reqB.resolve('mongoose')).href)).default;
const { default: app } = await imp('app.js');
const { signAccessToken } = await imp('config/jwt.js');
await mongoose.connect(process.env.MONGO_URI);
const server = http.createServer(app);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/api`;

const M = {};
for (const x of ['Admin', 'Vendor', 'User', 'Order', 'Product', 'ReturnRequest', 'Commission']) M[x] = (await imp(`models/${x}.model.js`)).default;

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
const mkVendor = (name, storeName) => ins(M.Vendor, { name, storeName, email: `${name.toLowerCase()}@example.com`, password: pw, status: 'approved', isActive: true, isVerified: true });
const V =await mkVendor('Vee', 'Vee Electronics');
const W = await mkVendor('Wen', 'Wen Traders');
const EMPTY = await mkVendor('New', 'Brand New');
const u1 = await ins(M.User, { name: 'u1', email: 'u1@example.com', password: pw, role: 'customer', isActive: true });
const tok = (id, role = 'vendor') => signAccessToken({ id: String(id), role });
const TV = tok(V), TW = tok(W), TE = tok(EMPTY), TA = tok(ADMIN, 'admin');

const PA = new mongoose.Types.ObjectId(), PB = new mongoose.Types.ObjectId();
let oid = 0;
const line = (vendorId, price, quantity, discount = 0, prod = null) => ({ productId: prod?.id || new mongoose.Types.ObjectId(), vendorId, name: prod?.name || 'x', price, quantity, discount });
const mkOrder = ({ status, lines, at = '2026-11-10T08:00:00Z', deleted = false, groupStatus = {} }) => {
    oid += 1;
    const byVendor = new Map();
    for (const l of lines) { const k = String(l.vendorId); byVendor.set(k, [...(byVendor.get(k) || []), l]); }
    return ins(M.Order, {
        orderId: `ORD-VAN-${oid}`, userId: u1, status, paymentMethod: 'upi', paymentStatus: 'paid', items: lines,
        vendorItems: [...byVendor.entries()].map(([k, items]) => ({ vendorId: new mongoose.Types.ObjectId(k), items, status: groupStatus[k] || 'pending' })),
        total: 0, isDeleted: deleted, createdAt: new Date(at), updatedAt: new Date(at),
    });
};
const Alpha = { id: PA, name: 'Alpha' }, Beta = { id: PB, name: 'Beta' };
const vs = (s) => ({ [String(V)]: s });

const o1 = await mkOrder({ status: 'delivered', lines: [line(V, 1000, 2, 100, Alpha)], groupStatus: vs('delivered') });                              // 1900
await mkOrder({ status: 'processing', lines: [line(V, 500, 1, 0, Beta), line(W, 700, 1)], groupStatus: vs('processing') });                          // V 500, W 700
await mkOrder({ status: 'cancelled', lines: [line(V, 800, 1)], groupStatus: vs('cancelled') });                                                      // cancelled
const o4 = await mkOrder({ status: 'returned', lines: [line(V, 250, 1)], groupStatus: vs('delivered') });                                            // returned
await mkOrder({ status: 'delivered', lines: [line(V, 400, 1, 0, Alpha), line(W, 100, 1)], groupStatus: vs('cancelled') });                           // V's part cancelled, W 100 sold
await mkOrder({ status: 'delivered', lines: [line(V, 300, 1, 0, Alpha)], at: '2026-11-11T08:00:00Z', groupStatus: vs('delivered') });                // 300 on 11 Nov
await mkOrder({ status: 'delivered', lines: [line(V, 150, 2, 0, Beta)], at: '2026-10-31T19:00:00Z', groupStatus: vs('delivered') });                 // 300; 1 Nov 00:30 IST
await mkOrder({ status: 'delivered', lines: [line(V, 9999, 1)], deleted: true });                                                                    // deleted: ignored
await mkOrder({ status: 'delivered', lines: [line(V, 1000, 1)], at: '2026-10-20T08:00:00Z', groupStatus: vs('delivered') });                         // previous period: 1000
await mkOrder({ status: 'cancelled', lines: [line(V, 600, 1)], at: '2026-10-25T08:00:00Z', groupStatus: vs('cancelled') });                          // previous period, not sold

const comm = (vendorId, extra) => ins(M.Commission, { orderId: new mongoose.Types.ObjectId(), vendorId, subtotal: 1000, commissionRate: 10, commission: 100, vendorEarnings: 900, status: 'pending', clearanceStatus: 'pending_delivery', ...extra });
await comm(V, { commission: 190, vendorEarnings: 1710 });
await comm(V, { commission: 50, vendorEarnings: 450, status: 'paid', clearanceStatus: 'settled' });
await comm(V, { commission: 10, vendorEarnings: 90, status: 'cancelled', clearanceStatus: 'cancelled' });
await comm(V, { commission: 20, vendorEarnings: 180, clearanceStatus: 'refunded' });
await comm(W, { commission: 70, vendorEarnings: 630 });

const ret = (vendorId, orderId, extra) => ins(M.ReturnRequest, { orderId, reason: 'r', vendorId, items: [{ price: 500, quantity: 1 }], ...extra });
await ret(V, o1, { status: 'pending', refundStatus: 'pending' });                                // value 500, pending refund 500
await ret(V, o1, { status: 'completed', refundStatus: 'processed', refundAmount: 250 });         // value 250, refunded 250 on a SOLD order
await ret(V, o1, { status: 'rejected', items: [{ price: 300, quantity: 1 }] });                  // rejected
await ret(V, o4, { status: 'completed', refundStatus: 'processed', refundAmount: 100 });         // refunded 100 but order already excluded from sales
await ret(W, new mongoose.Types.ObjectId(), { status: 'pending', refundStatus: 'pending' });

const prod = (vendorId, extra) => ins(M.Product, { name: 'p', slug: `p-${Math.random()}`, price: 1, categoryId: new mongoose.Types.ObjectId(), vendorId, isActive: true, stock: 'in_stock', approvalStatus: 'approved', ...extra });
await prod(V, {}); await prod(V, {}); await prod(V, { stock: 'low_stock' }); await prod(V, { stock: 'out_of_stock' }); await prod(V, { stock: 'out_of_stock' }); await prod(W, {});
console.log('In-memory DB ready.\n');

const NOV = 'from=2026-11-01&to=2026-11-30';
const api = (t, q = '') => get(t, `/vendor/analytics/overview?${q}`);

// 1. Hand-counted numbers
{
    const r = await api(TV, NOV);
    const d = r.data || {}, s = d.summary || {};
    check('Loads for the seller (200)', r.status === 200, `${r.status} ${r.body?.message}`);
    check('Sales = 1900 + 500 + 300 + 300 = 3000 (cancelled, returned, own-cancelled part, deleted excluded)', s.totalRevenue === 3000, s.totalRevenue);
    check('Sold orders 4, average order value 750', s.totalOrders === 4 && s.averageOrderValue === 750, [s.totalOrders, s.averageOrderValue]);
    check('Cancelled orders 1 of 7 placed -> 14.3%', s.cancelledOrders === 1 && s.cancelRate === 14.3, [s.cancelledOrders, s.cancelRate]);
    check('Net sales = 3000 - 250 refunded on sold orders = 2750 (the 100 refunded on an already-excluded returned order is NOT deducted twice)', s.refundsOnSales === 250 && s.netSales === 2750, [s.refundsOnSales, s.netSales]);
    check('Earnings: commission 240, net 2160, pending 1710, paid 450', s.commission === 240 && s.netEarnings === 2160 && s.pendingEarnings === 1710 && s.paidEarnings === 450, [s.commission, s.netEarnings, s.pendingEarnings, s.paidEarnings]);
    check('Products 5, low stock 1, out of stock 2', s.totalProducts === 5 && s.lowStockProducts === 1 && s.outOfStockProducts === 2, [s.totalProducts, s.lowStockProducts, s.outOfStockProducts]);
    check('Returns: 4 total (1 pending, 2 completed, 1 rejected), value 850, refunded 350, pending refund 500, rate 57.1%', d.returns?.totalReturns === 4 && d.returns.pendingReturns === 1 && d.returns.completedReturns === 2 && d.returns.rejectedReturns === 1 && d.returns.returnValue === 850 && d.returns.refundedAmount === 350 && d.returns.pendingRefundAmount === 500 && d.returns.returnRate === 57.1, d.returns);
    check('Timeseries by India day: 1 Nov 300/1, 10 Nov 2400/2, 11 Nov 300/1', JSON.stringify(d.timeseries) === JSON.stringify([{ date: '2026-11-01', revenue: 300, orders: 1 }, { date: '2026-11-10', revenue: 2400, orders: 2 }, { date: '2026-11-11', revenue: 300, orders: 1 }]), d.timeseries);
    const st = Object.fromEntries((d.statusBreakdown || []).map((x) => [x.status, x.count]));
    check('Status breakdown (sold orders): delivered 3, processing 1', st.delivered === 3 && st.processing === 1 && Object.keys(st).length === 2, st);
    check('Top products: Alpha 3 pcs / 2200, then Beta 3 pcs / 800 (cancelled part not counted)', JSON.stringify((d.topProducts || []).map((p) => [p.name, p.quantity, p.revenue])) === JSON.stringify([['Alpha', 3, 2200], ['Beta', 3, 800]]), d.topProducts);
    check('Growth vs previous period (Oct): sales 1000 -> +200%, orders 1 -> +300%', d.comparison?.previousRevenue === 1000 && d.comparison.previousOrders === 1 && d.comparison.revenueChange === 200 && d.comparison.ordersChange === 300, d.comparison);
    check('Response says it is a custom range', d.range?.period === 'custom', d.range);
}

// 2. Isolation, empty seller, access control
{
    const w = await api(TW, NOV);
    check('Another seller only sees their own numbers (W: sales 700 + 100 = 800, 2 orders, commission 70, 1 return)', w.data?.summary.totalRevenue === 800 && w.data.summary.totalOrders === 2 && w.data.summary.commission === 70 && w.data.returns.totalReturns === 1 && w.data.topProducts.length === 2, [w.data?.summary.totalRevenue, w.data?.summary.commission]);
    const e = await api(TE, NOV);
    const s = e.data?.summary || {};
    check('Seller with no activity: zeros, no NaN, growth is null (not a fake 100%)', e.status === 200 && s.totalRevenue === 0 && s.averageOrderValue === 0 && s.cancelRate === 0 && s.netSales === 0 && e.data.returns.returnRate === 0 && e.data.timeseries.length === 0 && e.data.topProducts.length === 0 && e.data.comparison.revenueChange === null, e.data?.comparison);
    check('No token -> 401', (await api(null, NOV)).status === 401, 401);
    const asAdmin = await api(TA, NOV);
    check('An admin token cannot use the seller endpoint (401/403)', [401, 403].includes(asAdmin.status), asAdmin.status);
}

// 3. Date handling
{
    const nov = await api(TV, 'from=2026-11-01&to=2026-11-01');
    check('Single day 1 Nov (IST) includes the order placed 00:30 IST (UTC 31 Oct 19:00): sales 300', nov.data?.summary.totalRevenue === 300 && nov.data.summary.totalOrders === 1, nov.data?.summary.totalRevenue);
    const oct = await api(TV, 'from=2026-10-01&to=2026-10-31');
    check('October: sales 1000 (only the 20 Oct order), 2 placed / 1 cancelled', oct.data?.summary.totalRevenue === 1000 && oct.data.summary.cancelledOrders === 1, [oct.data?.summary.totalRevenue, oct.data?.summary.cancelledOrders]);
    check('Only "from" -> 400', (await api(TV, 'from=2026-11-01')).status === 400, 400);
    check('"from" after "to" -> 400', (await api(TV, 'from=2026-11-30&to=2026-11-01')).status === 400, 400);
    check('Invalid date -> 400', (await api(TV, 'from=nope&to=2026-11-01')).status === 400, 400);
    const bogus = await api(TV, 'period=bogus');
    check('Unknown period falls back to this month (200)', bogus.status === 200 && bogus.data.range.period === 'month', bogus.data?.range);
    // period=today: one order placed right now
    await mkOrder({ status: 'delivered', lines: [line(V, 123, 1)], at: new Date().toISOString(), groupStatus: vs('delivered') });
    const today = await api(TV, 'period=today');
    check('period=today counts the order placed just now (123, 1 order)', today.data?.summary.totalRevenue === 123 && today.data.summary.totalOrders === 1 && today.data.range.period === 'today', [today.data?.summary.totalRevenue, today.data?.summary.totalOrders]);
    for (const p of ['week', 'month', 'year']) {
        const r = await api(TV, `period=${p}`);
        check(`period=${p} works and includes today's order`, r.status === 200 && r.data.summary.totalRevenue >= 123 && r.data.range.period === p, [r.status, r.data?.summary.totalRevenue]);
    }
}

// 4. Independent recomputation over random data
{
    const X = await mkVendor('X', 'Random Co');
    const Y = await mkVendor('Y', 'Other Co');
    const TX = tok(X);
    let seed = 11;
    const rnd = (n) => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed % n; };
    const statuses = ['pending', 'processing', 'shipped', 'delivered', 'delivered', 'cancelled', 'returned'];
    const gs = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    for (let i = 0; i < 80; i += 1) {
        const lines = [];
        for (let k = 0, n = 1 + rnd(3); k < n; k += 1) lines.push(line(rnd(2) ? Y : X, 100 + rnd(900), 1 + rnd(4), rnd(3) === 0 ? rnd(50) : 0));
        await mkOrder({
            status: statuses[rnd(statuses.length)], lines, deleted: rnd(15) === 0,
            groupStatus: { [String(X)]: gs[rnd(gs.length)] },
            at: `2026-11-${String(1 + rnd(20)).padStart(2, '0')}T${String(rnd(24)).padStart(2, '0')}:00:00Z`,
        });
    }
    const raw = await M.Order.collection.find({ isDeleted: { $ne: true }, 'vendorItems.vendorId': X }).toArray();
    const istDay = (d) => new Date(d.getTime() + 5.5 * 3600000).toISOString().slice(0, 10);
    const exp = { total: 0, cancelled: 0, sold: 0, value: 0, days: new Map() };
    for (const o of raw) {
        const g = o.vendorItems.find((x) => String(x.vendorId) === String(X));
        exp.total += 1;
        if (o.status === 'cancelled') exp.cancelled += 1;
        if (['cancelled', 'returned'].includes(o.status) || g.status === 'cancelled') continue;
        const goods = g.items.reduce((s, l) => s + l.price * l.quantity - (l.discount || 0), 0);
        exp.sold += 1; exp.value += goods;
        const k = istDay(o.createdAt);
        const cur = exp.days.get(k) || { revenue: 0, orders: 0 };
        exp.days.set(k, { revenue: cur.revenue + goods, orders: cur.orders + 1 });
    }
    const r = await api(TX, NOV);
    const s = r.data.summary;
    check(`Random data (${exp.total} orders): sold / cancelled match the independent count`, s.totalOrders === exp.sold && s.cancelledOrders === exp.cancelled, [s.totalOrders, exp.sold, s.cancelledOrders, exp.cancelled]);
    check('Random data: sales matches to the paisa', Math.abs(s.totalRevenue - exp.value) < 0.01, [s.totalRevenue, exp.value]);
    const seriesOk = r.data.timeseries.length === exp.days.size && r.data.timeseries.every((p) => exp.days.get(p.date)?.orders === p.orders && Math.abs(exp.days.get(p.date).revenue - p.revenue) < 0.01);
    check('Random data: every India-day bucket (revenue and orders) matches', seriesOk, r.data.timeseries.length);
    check('Random data: status breakdown adds up to sold orders; days add up to total sales', r.data.statusBreakdown.reduce((a, x) => a + x.count, 0) === exp.sold && Math.abs(r.data.timeseries.reduce((a, p) => a + p.revenue, 0) - s.totalRevenue) < 0.01, exp.sold);
    const top = r.data.topProducts;
    check('Random data: top products sorted by revenue, at most 5, and not above total sales', top.length <= 5 && top.every((p, i) => i === 0 || top[i - 1].revenue >= p.revenue) && top.reduce((a, p) => a + p.revenue, 0) <= s.totalRevenue + 0.01, top.map((p) => p.revenue));
}

console.log(`\nSUMMARY ${JSON.stringify({ PASS: pass, FAIL: fail })}`);
await mongoose.disconnect();
server.close();
await mem.stop();
process.exit(fail ? 1 : 0);
