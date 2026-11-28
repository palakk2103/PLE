// Usage (from /backend): node tests/purchaseHistoryE2E.mjs
// B2B admin purchase history, end to end: employees place real orders (wallet / COD / card),
// one is cancelled (wallet refund), one is delivered and partly returned (vendor refunds to the
// wallet). Then every admin view -- summary, overview, orders, order detail, returns, wallet
// ledger -- is checked against hand-computed numbers, plus company isolation, auth, filters,
// paging and India-time date ranges. In-memory MongoDB; Razorpay stubbed.
process.env.TZ = 'UTC'; // a typical cloud server; the date filters must not depend on it
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
process.env.MONGO_URI = mem.getUri('ple_purchase_history');
Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', SMTP_USER: 'x', SMTP_PASS: 'x', FIREBASE_SERVICE_ACCOUNT: '', SHIPROCKET_EMAIL: '', SHIPROCKET_PASSWORD: '', NODE_ENV: 'development', RAZORPAY_KEY_ID: 'rzp_test_dummy', RAZORPAY_KEY_SECRET: 'x' });

const mongoose = (await import(pathToFileURL(reqB.resolve('mongoose')).href)).default;
const rzpSvc = await imp('services/razorpay.service.js');
let rzpSeq = 0;
rzpSvc.__setRazorpayClientForTests({ orders: { create: async (o) => ({ id: `order_PH${++rzpSeq}`, amount: o.amount, currency: 'INR' }) }, payments: { fetch: async () => null } });
const { default: app } = await imp('app.js');
const { signAccessToken } = await imp('config/jwt.js');
await mongoose.connect(process.env.MONGO_URI);
const server = http.createServer(app);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/api`;

const M = {};
for (const n of ['User', 'Vendor', 'Product', 'Order', 'Wallet', 'WalletTransaction', 'ReturnRequest', 'Address', 'Category']) M[n] = (await imp(`models/${n}.model.js`)).default;

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
console.log(`Server timezone offset: ${new Date().getTimezoneOffset()} min (0 = UTC)\n`);

// ── seed: company A (admin, Ravi, Meera, Zed[inactive]); company B (admin, Bob)
const pw = '$2a$12$abcdefghijklmnopqrstuuDummyHashNotUsedForLoginxxxxxxxx';
const ins = async (Model, doc) => (await Model.collection.insertOne({ createdAt: new Date(), updatedAt: new Date(), ...doc })).insertedId;
const CA = new mongoose.Types.ObjectId();
const CB = new mongoose.Types.ObjectId();
const user = (name, email, role, companyId, extra = {}) => ins(M.User, { name, email, password: pw, role, companyId, isActive: true, isVerified: true, phone: '9000000000', department: 'Ops', ...extra });
const ADMIN = await user('Asha Admin', 'asha@example.com', 'b2bAdmin', CA);
const RAVI = await user('Ravi Staff', 'ravi@example.com', 'b2bEmployee', CA, { designation: 'Buyer' });
const MEERA = await user('Meera Rao', 'meera@example.com', 'b2bEmployee', CA, { department: 'Finance', designation: 'Accountant' });
const ZED = await user('Zed Inactive', 'zed@example.com', 'b2bEmployee', CA, { isActive: false });
const ADMIN_B = await user('Bob Admin', 'bobadmin@example.com', 'b2bAdmin', CB);
const BOB = await user('Bob Staff', 'bob@example.com', 'b2bEmployee', CB);
await ins(M.Wallet, { userId: ADMIN, balance: 100000, totalCredit: 100000, totalDebit: 0, isFrozen: false });
for (const u of [RAVI, MEERA, BOB]) {
    await ins(M.Address, { userId: u, name: 'Office', fullName: 'Staff', phone: '9000000000', address: '1 Rd', city: 'Pune', state: 'Maharashtra', zipCode: '411001', country: 'India', isDefault: true });
}
const VEND = await ins(M.Vendor, { name: 'Volt', storeName: 'Volt Supplies', email: 'volt@example.com', password: pw, status: 'approved', isVerified: true, isActive: true, gstNumber: '27ABCDE1234F1Z5', shippingEnabled: false });
const CAT = await ins(M.Category, { name: 'Furniture', slug: 'furniture', isActive: true });
const P = await ins(M.Product, { categoryId: CAT, name: 'Office Chair', slug: 'office-chair', price: 1000, stockQuantity: 1000, stock: 'in_stock', isActive: true, isVisible: true, approvalStatus: 'approved', gstMode: 'custom', gstRate: 18, vendorId: VEND, listingType: 'vendor_direct' });

const tok = (id, role, companyId) => signAccessToken({ id: String(id), role, email: `${id}@example.com`, ...(companyId ? { companyId: String(companyId) } : {}) });
const TA = tok(ADMIN, 'b2bAdmin', CA);
const TR = tok(RAVI, 'b2bEmployee', CA);
const TM = tok(MEERA, 'b2bEmployee', CA);
const TB_ADMIN = tok(ADMIN_B, 'b2bAdmin', CB);
const TB = tok(BOB, 'b2bEmployee', CB);
const TV = tok(VEND, 'vendor');
const addr = { name: 'Staff', email: 'staff@example.com', phone: '9000000000', address: '1 Rd', city: 'Pune', state: 'Maharashtra', zipCode: '411001', country: 'India' };
const buy = (token, qty, paymentMethod) => api(token, 'POST', '/user/orders', { items: [{ productId: String(P), quantity: qty }], shippingAddress: addr, paymentMethod });
const lastOrder = (uid) => M.Order.findOne({ userId: uid }).sort({ createdAt: -1, _id: -1 }).lean();
const A = '/b2b-user/admin';
console.log('In-memory DB ready.\n');

// ── build the scenario through the real endpoints
let O1, O2, O3, O4, OM, OB, RET;
{
    for (const [id, amt] of [[RAVI, 50000], [MEERA, 5000]]) {
        const r = await api(TA, 'POST', `${A}/employees/${id}/allot-wallet`, { amount: amt });
        if (r.status !== 200) console.log('allot failed', r.status, r.body?.message);
    }
    await buy(TR, 2, 'wallet'); O1 = await lastOrder(RAVI);   // 2 x 1,180 = 2,360 from wallet
    await buy(TR, 1, 'cod'); O2 = await lastOrder(RAVI);      // 1,180 COD
    await buy(TR, 1, 'wallet'); O3 = await lastOrder(RAVI);   // 1,180 wallet, then cancelled
    const cancel = await api(TR, 'PATCH', `/user/orders/${O3.orderId}/cancel`, { reason: 'Ordered by mistake' });
    if (cancel.status !== 200) console.log('cancel failed', cancel.status, cancel.body?.message);
    O3 = await M.Order.findById(O3._id).lean();
    await buy(TR, 1, 'card'); O4 = await lastOrder(RAVI);     // online payment never completed
    await buy(TM, 1, 'cod'); OM = await lastOrder(MEERA);     // Meera: 1,180 COD
    await buy(TB, 1, 'cod'); OB = await lastOrder(BOB);       // other company
    // O1 delivered, then Ravi returns 1 of its 2 chairs; the vendor approves and refunds to the wallet
    await M.Order.updateOne({ _id: O1._id }, { $set: { status: 'delivered', deliveredAt: new Date(), 'paymentDetails.razorpaySignature': 'SECRET-SIG', idempotencyKey: 'idem-1' } });
    O1 = await M.Order.findById(O1._id).lean();
    const ret = await api(TR, 'POST', `/user/orders/${O1.orderId}/returns`, { reason: 'One chair arrived damaged', items: [{ orderItemId: String(O1.items[0]._id), quantity: 1 }] });
    if (ret.status >= 300) console.log('return failed', ret.status, ret.body?.message);
    RET = await M.ReturnRequest.findOne({ orderId: O1._id }).lean();
    const a1 = await api(TV, 'PATCH', `/vendor/return-requests/${RET._id}/status`, { status: 'approved' });
    const a2 = await api(TV, 'PATCH', `/vendor/return-requests/${RET._id}/status`, { status: 'completed', refundStatus: 'processed' });
    if (a1.status !== 200 || a2.status !== 200) console.log('vendor return steps failed', a1.status, a1.body?.message, a2.status, a2.body?.message, JSON.stringify(a2.body?.errors));
    RET = await M.ReturnRequest.findById(RET._id).lean();
}
const ravi = async () => (await M.User.findById(RAVI).lean()).b2bWalletBalance;

// 0. Scenario sanity (so later failures point at the right thing)
{
    check('Setup: 4 orders for Ravi, wallet/COD/cancelled/card', (await M.Order.countDocuments({ userId: RAVI })) === 4 && O1.walletAmountUsed === 2360 && O3.status === 'cancelled' && O4.paymentStatus === 'pending', [O1.walletAmountUsed, O3.status, O4.paymentStatus]);
    check('Setup: companyId stamped on orders', [O1, O2, O3, O4, OM].every((o) => String(o.companyId) === String(CA)) && String(OB.companyId) === String(CB), [O1.companyId, OB.companyId]);
    check('Setup: return refund of ₹1,180 processed to the wallet', RET?.refundAmount === 1180 && RET?.refundStatus === 'processed' && String(RET?.companyId) === String(CA), [RET?.refundAmount, RET?.refundStatus, RET?.companyId]);
    check('Setup: Ravi wallet = 50,000 - 2,360 - 1,180 + 1,180 + 1,180', (await ravi()) === 48820, await ravi());
}

// 1. Company summary
{
    const r = await api(TA, 'GET', `${A}/employees/purchases/summary`);
    const t = r.data?.totals;
    check('Summary: 200 and 3 employees (company B excluded)', r.status === 200 && t?.employees === 3 && r.data?.items?.length === 3, [r.status, t?.employees]);
    check('Summary totals: orders 5, placed 3, cancelled 1', t?.totalOrders === 5 && t?.placedOrders === 3 && t?.cancelledOrders === 1, t);
    check('Summary totals: gross 4,720 / wallet 2,360 / refunded 1,180 / net 3,540', t?.grossSpent === 4720 && t?.walletSpent === 2360 && t?.refundedAmount === 1180 && t?.netSpent === 3540, t);
    check('Summary totals: 1 return, wallet balances left 53,820', t?.totalReturns === 1 && t?.walletBalanceRemaining === 53820, [t?.totalReturns, t?.walletBalanceRemaining]);
    const rows = r.data?.items || [];
    check('Rows sorted by net spend: Ravi, Meera, Zed', rows.map((x) => x.employee.name).join(',') === 'Ravi Staff,Meera Rao,Zed Inactive', rows.map((x) => x.employee.name));
    const rs = rows[0]?.stats;
    check('Ravi: 4 orders, 2 placed, 1 cancelled, 1 delivered, 3 items', rs?.totalOrders === 4 && rs?.placedOrders === 2 && rs?.cancelledOrders === 1 && rs?.deliveredOrders === 1 && rs?.itemsPurchased === 3, rs);
    check('Ravi: gross 3,540, refunded 1,180, net 2,360, 1 return', rs?.grossSpent === 3540 && rs?.refundedAmount === 1180 && rs?.netSpent === 2360 && rs?.totalReturns === 1, rs);
    check('Unpaid card order does not count as spend', rs?.grossSpent === 3540, rs?.grossSpent);
    const zs = rows[2]?.stats;
    check('Employee with no orders: zeros, not missing', zs?.totalOrders === 0 && zs?.netSpent === 0 && zs?.lastOrderAt === null, zs);
    check('Employee details exposed without secrets', !('password' in rows[0].employee) && rows[0].employee.email === 'ravi@example.com', Object.keys(rows[0].employee));

    const asc = await api(TA, 'GET', `${A}/employees/purchases/summary?sortBy=name&order=asc`);
    check('Sort by name asc', asc.data?.items?.map((x) => x.employee.name).join(',') === 'Meera Rao,Ravi Staff,Zed Inactive', asc.data?.items?.map((x) => x.employee.name));
    const byOrders = await api(TA, 'GET', `${A}/employees/purchases/summary?sortBy=totalOrders&order=desc`);
    check('Sort by orders desc', byOrders.data?.items?.[0]?.employee?.name === 'Ravi Staff', byOrders.data?.items?.[0]?.employee?.name);
    const s = await api(TA, 'GET', `${A}/employees/purchases/summary?search=financ`);
    check('Search matches department', s.data?.items?.length === 1 && s.data.items[0].employee.name === 'Meera Rao', s.data?.items?.map((x) => x.employee.name));
    const sx = await api(TA, 'GET', `${A}/employees/purchases/summary?search=${encodeURIComponent('.*')}`);
    check('Search text is not treated as a regex', sx.status === 200 && sx.data?.items?.length === 0, [sx.status, sx.data?.items?.length]);
    const inactive = await api(TA, 'GET', `${A}/employees/purchases/summary?status=inactive`);
    check('Filter inactive employees', inactive.data?.items?.length === 1 && inactive.data.items[0].employee.name === 'Zed Inactive', inactive.data?.items?.length);
    const pg = await api(TA, 'GET', `${A}/employees/purchases/summary?page=2&limit=2`);
    check('Paging: page 2 of 2 has 1 row, totals still cover everyone', pg.data?.items?.length === 1 && pg.data?.pages === 2 && pg.data?.totals?.employees === 3, [pg.data?.items?.length, pg.data?.pages, pg.data?.totals?.employees]);
    const bad = await api(TA, 'GET', `${A}/employees/purchases/summary?from=not-a-date`);
    check('Bad date -> 400', bad.status === 400, `${bad.status} ${bad.body?.message}`);
    const bAdmin = await api(TB_ADMIN, 'GET', `${A}/employees/purchases/summary`);
    check("Company B sees only its own employee and orders", bAdmin.data?.items?.length === 1 && bAdmin.data?.totals?.totalOrders === 1 && bAdmin.data?.totals?.grossSpent === 1180, [bAdmin.data?.items?.length, bAdmin.data?.totals]);
}

// 2. Employee overview
{
    const r = await api(TA, 'GET', `${A}/employees/${RAVI}/overview`);
    const w = r.data?.wallet;
    check('Overview: employee, stats and 4 recent orders', r.status === 200 && r.data?.employee?.name === 'Ravi Staff' && r.data?.stats?.netSpent === 2360 && r.data?.recentOrders?.length === 4, [r.status, r.data?.recentOrders?.length]);
    check('Overview wallet: balance 48,820, allotted 50,000, refunded back 2,360, debited 3,540', w?.currentBalance === 48820 && w?.totalAllotted === 50000 && w?.totalRefundedToWallet === 2360 && w?.totalDebited === 3540, w);
    check('Overview: wallet ledger reconciles (50,000 + 2,360 - 3,540 = 48,820)', w?.totalAllotted + w?.totalRefundedToWallet - w?.totalDebited === w?.currentBalance, w);
    check('Overview: includes this month spending summary', r.data?.spending?.appliesTo === true && r.data?.spending?.ordersThisMonth >= 1, r.data?.spending);
    const bad = await api(TA, 'GET', `${A}/employees/not-an-id/overview`);
    check('Overview: bad id -> 400', bad.status === 400, bad.status);
    const other = await api(TA, 'GET', `${A}/employees/${BOB}/overview`);
    check("Overview: other company's employee -> 404", other.status === 404, other.status);
    const adminId = await api(TA, 'GET', `${A}/employees/${ADMIN}/overview`);
    check('Overview: an admin id is not an employee -> 404', adminId.status === 404, adminId.status);
}

// 3. Orders list
{
    const r = await api(TA, 'GET', `${A}/employees/${RAVI}/orders`);
    check('Orders: 4, newest first, with item lines and totals', r.status === 200 && r.data?.total === 4 && r.data?.items?.[0]?.orderId === O4.orderId && r.data?.items?.every((o) => o.items?.length === 1 && typeof o.total === 'number'), [r.status, r.data?.total, r.data?.items?.[0]?.orderId]);
    const f1 = await api(TA, 'GET', `${A}/employees/${RAVI}/orders?status=cancelled`);
    check('Filter status=cancelled', f1.data?.total === 1 && f1.data.items[0].orderId === O3.orderId, f1.data?.total);
    const f2 = await api(TA, 'GET', `${A}/employees/${RAVI}/orders?paymentMethod=wallet`);
    check('Filter paymentMethod=wallet', f2.data?.total === 2, f2.data?.total);
    const f3 = await api(TA, 'GET', `${A}/employees/${RAVI}/orders?paymentStatus=pending`);
    check('Filter paymentStatus=pending (COD + card)', f3.data?.total === 2, f3.data?.total);
    const f4 = await api(TA, 'GET', `${A}/employees/${RAVI}/orders?search=${encodeURIComponent(O2.orderId.slice(4, 14))}`);
    check('Search by order id', f4.data?.items?.some((o) => o.orderId === O2.orderId), f4.data?.total);
    const f5 = await api(TA, 'GET', `${A}/employees/${RAVI}/orders?limit=2&page=2`);
    check('Paging: page 2 of 2', f5.data?.items?.length === 2 && f5.data?.pages === 2 && f5.data?.page === 2, [f5.data?.items?.length, f5.data?.pages]);
    const all = await api(TA, 'GET', `${A}/employees/${RAVI}/orders?status=all&paymentMethod=all&paymentStatus=all`);
    check("'all' filters mean no filter", all.data?.total === 4, all.data?.total);
    const lim = await api(TA, 'GET', `${A}/employees/${RAVI}/orders?limit=100000`);
    check('Limit capped at 100', lim.data?.limit === 100, lim.data?.limit);
    const other = await api(TA, 'GET', `${A}/employees/${BOB}/orders`);
    check("Other company's employee orders -> 404", other.status === 404, other.status);
}

// 4. Order detail
{
    const r = await api(TA, 'GET', `${A}/employees/${RAVI}/orders/${O1.orderId}`);
    const d = r.data;
    check('Detail: order, payment breakdown (all wallet, ₹0 online)', r.status === 200 && d?.order?.orderId === O1.orderId && d?.payment?.method === 'wallet' && d?.payment?.walletAmountUsed === 2360 && d?.payment?.onlineAmount === 0, [r.status, d?.payment]);
    check('Detail: gateway signature and idempotency key never exposed', !JSON.stringify(d).includes('SECRET-SIG') && !JSON.stringify(d).includes('idem-1'), 'hidden');
    check('Detail: the return and its refund are attached', d?.returns?.length === 1 && d.returns[0].refundAmount === 1180 && d.returns[0].refundStatus === 'processed', d?.returns?.map((x) => [x.refundAmount, x.refundStatus]));
    const types = (d?.walletTransactions || []).map((t) => `${t.type}:${t.transactionCategory}:${t.amount}`);
    check('Detail: wallet payment debit + return refund credit for this order', types.includes('debit:order_payment:2360') && types.includes('credit:refund:1180'), types);
    const o2 = await api(TA, 'GET', `${A}/employees/${RAVI}/orders/${O2.orderId}`);
    check('Detail COD: ₹1,180 payable online/cash, no wallet', o2.data?.payment?.method === 'cod' && o2.data?.payment?.walletAmountUsed === 0 && o2.data?.payment?.onlineAmount === 1180, o2.data?.payment);
    const o3 = await api(TA, 'GET', `${A}/employees/${RAVI}/orders/${O3.orderId}`);
    const t3 = (o3.data?.walletTransactions || []).map((t) => `${t.type}:${t.amount}`);
    check('Detail cancelled order: wallet debit then refund credit both visible', o3.data?.order?.status === 'cancelled' && t3.includes('debit:1180') && t3.includes('credit:1180'), t3);
    const o4 = await api(TA, 'GET', `${A}/employees/${RAVI}/orders/${O4.orderId}`);
    check('Detail card order: gateway order id visible, signature not', o4.data?.payment?.gateway?.razorpayOrderId === O4.paymentDetails.razorpayOrderId && !('razorpaySignature' in (o4.data?.payment?.gateway || {})), o4.data?.payment?.gateway);
    const wrongEmp = await api(TA, 'GET', `${A}/employees/${MEERA}/orders/${O1.orderId}`);
    check("An order is not reachable via another employee's id", wrongEmp.status === 404, wrongEmp.status);
    const otherCo = await api(TA, 'GET', `${A}/employees/${BOB}/orders/${OB.orderId}`);
    check("Other company's order -> 404", otherCo.status === 404, otherCo.status);
    const crossCo = await api(TB_ADMIN, 'GET', `${A}/employees/${RAVI}/orders/${O1.orderId}`);
    check("Company B admin can't open company A's order", crossCo.status === 404, crossCo.status);
}

// 5. Returns
{
    const r = await api(TA, 'GET', `${A}/employees/${RAVI}/returns`);
    const x = r.data?.items?.[0];
    check('Returns: 1 return with order number, refund amount/status/destination', r.status === 200 && r.data?.total === 1 && x?.refundAmount === 1180 && x?.refundStatus === 'processed' && x?.orderId?.orderId === O1.orderId && !!x?.returnId, [r.status, x?.returnId, x?.refundAmount, x?.refundStatus]);
    check('Returns: refund lines show the returned item', x?.items?.length === 1 && x.items[0].quantity === 1 && x.items[0].name === 'Office Chair', x?.items);
    const f = await api(TA, 'GET', `${A}/employees/${RAVI}/returns?refundStatus=failed`);
    check('Returns: refundStatus filter', f.data?.total === 0, f.data?.total);
    const none = await api(TA, 'GET', `${A}/employees/${MEERA}/returns`);
    check('Returns: employee with none -> empty list', none.status === 200 && none.data?.total === 0, none.data?.total);
    const other = await api(TA, 'GET', `${A}/employees/${BOB}/returns`);
    check("Returns: other company's employee -> 404", other.status === 404, other.status);
}

// 6. Wallet ledger
{
    const r = await api(TA, 'GET', `${A}/employees/${RAVI}/wallet-transactions`);
    const tx = r.data?.items || [];
    check('Ledger: 5 entries, balance 48,820', r.status === 200 && r.data?.total === 5 && r.data?.currentBalance === 48820, [r.status, r.data?.total, r.data?.currentBalance]);
    check('Ledger: newest entry balance equals current balance (running balance is consistent)', tx[0]?.balanceAfterTransaction === 48820, tx.map((t) => t.balanceAfterTransaction));
    const chrono = [...tx].reverse();
    let running = 0, ok = true;
    for (const t of chrono) { running += t.type === 'credit' ? t.amount : -t.amount; if (Math.round(running * 100) / 100 !== t.balanceAfterTransaction) ok = false; }
    check('Ledger: every running balance matches credits minus debits', ok, chrono.map((t) => [t.type, t.amount, t.balanceAfterTransaction]));
    const allot = tx.find((t) => t.transactionCategory === 'b2b_allotment');
    check('Ledger: allotment shows who gave it', allot?.amount === 50000 && allot?.performedBy?.name === 'Asha Admin', [allot?.amount, allot?.performedBy]);
    const orderTx = tx.find((t) => t.transactionCategory === 'order_payment' && t.amount === 2360);
    check('Ledger: order payment links to the order id', orderTx?.orderId?.orderId === O1.orderId, orderTx?.orderId);
    const c = await api(TA, 'GET', `${A}/employees/${RAVI}/wallet-transactions?type=credit`);
    check('Ledger filter: credits = allotment + 2 refunds', c.data?.total === 3, c.data?.total);
    const d = await api(TA, 'GET', `${A}/employees/${RAVI}/wallet-transactions?type=debit`);
    check('Ledger filter: debits = 2 order payments', d.data?.total === 2, d.data?.total);
    const cat = await api(TA, 'GET', `${A}/employees/${RAVI}/wallet-transactions?category=refund`);
    check('Ledger filter: category=refund', cat.data?.total === 2, cat.data?.total);
    const pg = await api(TA, 'GET', `${A}/employees/${RAVI}/wallet-transactions?limit=2&page=3`);
    check('Ledger paging: page 3 of 3 has 1 entry', pg.data?.items?.length === 1 && pg.data?.pages === 3, [pg.data?.items?.length, pg.data?.pages]);
    const m = await api(TA, 'GET', `${A}/employees/${MEERA}/wallet-transactions`);
    check("Meera's ledger shows only her allotment", m.data?.total === 1 && m.data?.currentBalance === 5000, [m.data?.total, m.data?.currentBalance]);
    const other = await api(TA, 'GET', `${A}/employees/${BOB}/wallet-transactions`);
    check("Other company's ledger -> 404", other.status === 404, other.status);
}

// 7. Dates are India days (IST), whatever the server timezone
{
    // Meera's order placed at 01:30 IST on 11 Nov 2026 (= 20:00 UTC on 10 Nov)
    await M.Order.collection.updateOne({ _id: OM._id }, { $set: { createdAt: new Date('2026-11-10T20:00:00Z') } });
    const q = (from, to) => api(TA, 'GET', `${A}/employees/${MEERA}/orders?from=${from}&to=${to}`);
    const on11 = await q('2026-11-11', '2026-11-11');
    check('Order at 01:30 IST on 11 Nov is found by the 11 Nov filter', on11.data?.total === 1, on11.data?.total);
    const on10 = await q('2026-11-10', '2026-11-10');
    check('...and not by the 10 Nov filter', on10.data?.total === 0, on10.data?.total);
    // 23:30 IST on 11 Nov = 18:00 UTC on 11 Nov
    await M.Order.collection.updateOne({ _id: OM._id }, { $set: { createdAt: new Date('2026-11-11T18:00:00Z') } });
    const late11 = await q('2026-11-11', '2026-11-11');
    check('Order at 23:30 IST on 11 Nov is inside the 11 Nov filter', late11.data?.total === 1, late11.data?.total);
    const on12 = await q('2026-11-12', '2026-11-12');
    check('...and not in the 12 Nov filter', on12.data?.total === 0, on12.data?.total);
    const range = await api(TA, 'GET', `${A}/employees/purchases/summary?from=2026-11-11&to=2026-11-11`);
    check('Summary honours the same India-day range', range.data?.totals?.totalOrders === 1 && range.data?.totals?.grossSpent === 1180, range.data?.totals);
    const bad = await api(TA, 'GET', `${A}/employees/${MEERA}/orders?to=31-02-2026x`);
    check('Bad "to" date -> 400', bad.status === 400, bad.status);
}

// 8. Auth
{
    const paths = [`/employees/purchases/summary`, `/employees/${RAVI}/overview`, `/employees/${RAVI}/orders`, `/employees/${RAVI}/orders/${O1.orderId}`, `/employees/${RAVI}/returns`, `/employees/${RAVI}/wallet-transactions`];
    const anon = await Promise.all(paths.map((p) => api(null, 'GET', A + p)));
    check('All 6 endpoints require login (401)', anon.every((r) => r.status === 401), anon.map((r) => r.status));
    const emp = await Promise.all(paths.map((p) => api(TR, 'GET', A + p)));
    check('Employees cannot open any admin purchase view (403)', emp.every((r) => r.status === 403), emp.map((r) => r.status));
    const nonB2b = await api(signAccessToken({ id: String(new mongoose.Types.ObjectId()), role: 'customer' }), 'GET', `${A}/employees/purchases/summary`);
    check('Normal customers are refused', nonB2b.status === 403 || nonB2b.status === 401, nonB2b.status);
}

console.log(`\n${pass} passed, ${fail} failed`);
server.close();
await mongoose.disconnect();
await mem.stop();
process.exit(fail ? 1 : 0);
