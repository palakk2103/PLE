// Usage (from /backend): node tests/walletRequestsE2E.mjs
// B2B employee wallet top-up requests: employee asks (amount + reason), company admin approves
// (full or partial; money moves admin wallet -> employee atomically) or rejects; notifications;
// company isolation; double-approve race; plus regression on direct allotment.
// In-memory MongoDB; email delivery fails harmlessly (SMTP points nowhere).
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
process.env.MONGO_URI = mem.getUri('ple_wallet_requests');
Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', SMTP_USER: 'x', SMTP_PASS: 'x', FIREBASE_SERVICE_ACCOUNT: '', NODE_ENV: 'development' });

const mongoose = (await import(pathToFileURL(reqB.resolve('mongoose')).href)).default;
const { default: app } = await imp('app.js');
const { signAccessToken } = await imp('config/jwt.js');
await mongoose.connect(process.env.MONGO_URI);
const server = http.createServer(app);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/api`;

const M = {};
for (const n of ['User', 'Wallet', 'WalletTransaction', 'WalletRequest', 'Notification']) M[n] = (await imp(`models/${n}.model.js`)).default;

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

// ── seed: company A (2 admins, 2 employees), company B (1 admin)
const pw = '$2a$12$abcdefghijklmnopqrstuuDummyHashNotUsedForLoginxxxxxxxx';
const ins = async (Model, doc) => (await Model.collection.insertOne({ createdAt: new Date(), updatedAt: new Date(), ...doc })).insertedId;
const CA = new mongoose.Types.ObjectId();
const CB = new mongoose.Types.ObjectId();
const user = (name, email, role, companyId, extra = {}) => ins(M.User, { name, email, password: pw, role, companyId, isActive: true, isVerified: true, phone: '9000000000', ...extra });
const ADMIN = await user('Asha Admin', 'asha@example.com', 'b2bAdmin', CA);
const ADMIN2 = await user('Arun Admin', 'arun@example.com', 'b2bAdmin', CA);
const EMP = await user('Ravi Staff', 'ravi@example.com', 'b2bEmployee', CA, { b2bWalletBalance: 100 });
const EMP2 = await user('Meera Staff', 'meera@example.com', 'b2bEmployee', CA, { b2bWalletBalance: 0 });
const ADMIN_B = await user('Bob Admin', 'bob@example.com', 'b2bAdmin', CB);
await ins(M.Wallet, { userId: ADMIN, balance: 10000, totalCredit: 10000, totalDebit: 0, isFrozen: false });
await ins(M.Wallet, { userId: ADMIN_B, balance: 50000, totalCredit: 50000, totalDebit: 0, isFrozen: false });

const tok = (id, role, email, companyId) => signAccessToken({ id: String(id), role, email, companyId: String(companyId) });
const TA = tok(ADMIN, 'b2bAdmin', 'asha@example.com', CA);
const TE = tok(EMP, 'b2bEmployee', 'ravi@example.com', CA);
const TE2 = tok(EMP2, 'b2bEmployee', 'meera@example.com', CA);
const TB = tok(ADMIN_B, 'b2bAdmin', 'bob@example.com', CB);
const bal = async () => ({
    admin: (await M.Wallet.findOne({ userId: ADMIN }).lean()).balance,
    emp: (await M.User.findById(EMP).lean()).b2bWalletBalance,
    empMirror: (await M.Wallet.findOne({ userId: EMP }).lean())?.balance,
});
console.log('In-memory DB ready.\n');

// 1. Employee creates requests
let R1, R2, R3;
{
    const zero = await api(TE, 'POST', '/b2b-user/employee/wallet-requests', { amount: 0, reason: 'Office supplies' });
    check('Create: amount must be > 0', zero.status === 400, `${zero.status} ${zero.body?.message}`);
    const huge = await api(TE, 'POST', '/b2b-user/employee/wallet-requests', { amount: 2000000, reason: 'Office supplies' });
    check('Create: above ₹10,00,000 rejected', huge.status === 400, `${huge.status} ${huge.body?.message}`);
    const short = await api(TE, 'POST', '/b2b-user/employee/wallet-requests', { amount: 500, reason: 'pls' });
    check('Create: reason required (min 5 chars)', short.status === 400 && /Reason/.test(short.body?.message), `${short.status} ${short.body?.message}`);
    const asAdmin = await api(TA, 'POST', '/b2b-user/employee/wallet-requests', { amount: 500, reason: 'Office supplies' });
    check('Create: admins cannot create requests', asAdmin.status === 403, asAdmin.status);
    const anon = await api(null, 'POST', '/b2b-user/employee/wallet-requests', { amount: 500, reason: 'Office supplies' });
    check('Create: requires login', anon.status === 401, anon.status);

    const a = await api(TE, 'POST', '/b2b-user/employee/wallet-requests', { amount: 3000, reason: 'Printer toner for the Pune office' });
    R1 = a.data?._id;
    check('Create: 201 pending with request number', a.status === 201 && a.data?.status === 'pending' && /^WR-\d{6}-[0-9A-F]{6}$/.test(a.data?.requestNumber), `${a.status} ${a.data?.requestNumber}`);
    const notes = await M.Notification.find({ title: 'New wallet request' }).lean();
    check('Create: both company admins notified (not company B)', notes.length === 2 && notes.every((n) => [String(ADMIN), String(ADMIN2)].includes(String(n.recipientId))), notes.map((n) => String(n.recipientId)));
    check('Create: notification text has name, amount, reason', /Ravi Staff requested ₹3,000: "Printer toner/.test(notes[0]?.message || ''), notes[0]?.message);

    R2 = (await api(TE, 'POST', '/b2b-user/employee/wallet-requests', { amount: 20000, reason: 'Laptop accessories for new joiners' })).data?._id;
    R3 = (await api(TE, 'POST', '/b2b-user/employee/wallet-requests', { amount: 800, reason: 'Courier charges this week' })).data?._id;
    const fourth = await api(TE, 'POST', '/b2b-user/employee/wallet-requests', { amount: 100, reason: 'Tea and snacks' });
    check('Create: max 3 pending per employee', fourth.status === 400 && /3 pending/.test(fourth.body?.message), `${fourth.status} ${fourth.body?.message}`);

    const mine = await api(TE, 'GET', '/b2b-user/employee/wallet-requests');
    check('Employee lists own requests + balance', mine.status === 200 && mine.data?.requests?.length === 3 && mine.data?.walletBalance === 100 && mine.data?.pendingCount === 3, [mine.status, mine.data?.requests?.length, mine.data?.walletBalance]);
    const other = await api(TE2, 'GET', '/b2b-user/employee/wallet-requests');
    check("Other employee doesn't see them", other.data?.requests?.length === 0, other.data?.requests?.length);
}

// 2. Admin views + company isolation
{
    const r = await api(TA, 'GET', '/b2b-user/admin/wallet-requests');
    check('Admin: list with employee details + summary', r.status === 200 && r.data?.requests?.length === 3 && r.data?.requests[0]?.employeeId?.name === 'Ravi Staff' && r.data?.summary?.pending === 3 && r.data?.summary?.pendingAmount === 23800 && r.data?.companyWalletBalance === 10000, [r.status, r.data?.summary, r.data?.companyWalletBalance]);
    const f = await api(TA, 'GET', '/b2b-user/admin/wallet-requests?status=approved');
    check('Admin: status filter', f.data?.requests?.length === 0, f.data?.requests?.length);
    const b = await api(TB, 'GET', '/b2b-user/admin/wallet-requests');
    check("Company B admin can't see company A requests", b.data?.requests?.length === 0, b.data?.requests?.length);
    const bApprove = await api(TB, 'POST', `/b2b-user/admin/wallet-requests/${R1}/approve`, {});
    check("Company B admin can't approve company A request", bApprove.status === 404, bApprove.status);
    const empApprove = await api(TE, 'POST', `/b2b-user/admin/wallet-requests/${R1}/approve`, {});
    check("Employee can't approve", empApprove.status === 403, empApprove.status);
}

// 3. Insufficient company balance -> nothing changes
{
    const before = await bal();
    const r = await api(TA, 'POST', `/b2b-user/admin/wallet-requests/${R2}/approve`, {});
    check('Approve ₹20,000 with ₹10,000 company balance -> 400 with amounts', r.status === 400 && /₹10,000 available, ₹20,000 needed/.test(r.body?.message), `${r.status} ${r.body?.message}`);
    const after = await bal();
    const req = await M.WalletRequest.findById(R2).lean();
    check('Insufficient: request still pending, no money moved', req.status === 'pending' && after.admin === before.admin && after.emp === before.emp, [req.status, before, after]);
}

// 4. Partial approval + race
{
    const results = await Promise.all([
        api(TA, 'POST', `/b2b-user/admin/wallet-requests/${R1}/approve`, { amount: 2500, note: 'Approved 2,500 for now' }),
        api(TA, 'POST', `/b2b-user/admin/wallet-requests/${R1}/approve`, { amount: 2500, note: 'Approved 2,500 for now' }),
        api(TA, 'POST', `/b2b-user/admin/wallet-requests/${R1}/approve`, { amount: 2500, note: 'Approved 2,500 for now' }),
    ]);
    const ok = results.filter((r) => r.status === 200);
    check('Three simultaneous approvals: exactly one succeeds, others 409', ok.length === 1 && results.filter((r) => r.status === 409).length === 2, results.map((r) => `${r.status} ${r.body?.message}`));
    const b = await bal();
    const req = await M.WalletRequest.findById(R1).lean();
    const approvedByAsha = String(req.decidedBy) === String(ADMIN);
    check('Partial approve: request approved for ₹2,500 with note + ledger link', req.status === 'approved' && req.approvedAmount === 2500 && req.decisionNote === 'Approved 2,500 for now' && !!req.walletTransactionId && req.employeeBalanceAfter === 2600 && approvedByAsha, [req.status, req.approvedAmount, req.employeeBalanceAfter, approvedByAsha]);
    check('Money moved once: admin 10,000 -> 7,500, employee 100 -> 2,600 (mirror wallet too)', b.admin === 7500 && b.emp === 2600 && b.empMirror === 2600, b);
    const credit = await M.WalletTransaction.findById(req.walletTransactionId).lean();
    const debit = await M.WalletTransaction.findOne({ userId: ADMIN, type: 'debit' }).lean();
    check('Ledger: employee credit + admin debit recorded', credit?.type === 'credit' && credit?.amount === 2500 && credit?.transactionCategory === 'b2b_allotment' && debit?.amount === 2500 && /WR-/.test(credit?.description || ''), [credit?.amount, debit?.amount, credit?.description]);
    const n = await M.Notification.findOne({ recipientId: EMP, title: 'Wallet request approved' }).lean();
    check('Employee notified of partial approval with note', /approved for ₹2,500 \(you asked for ₹3,000\)/.test(n?.message || '') && /Note: Approved 2,500 for now/.test(n?.message || ''), n?.message);
    const again = await api(TA, 'POST', `/b2b-user/admin/wallet-requests/${R1}/approve`, {});
    check('Approve again -> 409', again.status === 409, `${again.status} ${again.body?.message}`);
    const rej = await api(TA, 'POST', `/b2b-user/admin/wallet-requests/${R1}/reject`, { note: 'changed my mind' });
    check('Reject an approved request -> 409', rej.status === 409, `${rej.status} ${rej.body?.message}`);
    const over = await api(TA, 'POST', `/b2b-user/admin/wallet-requests/${R3}/approve`, { amount: -5 });
    check('Approve with negative amount -> 400', over.status === 400, `${over.status} ${over.body?.message}`);
    const more = await api(TA, 'POST', `/b2b-user/admin/wallet-requests/${R3}/approve`, { amount: 900 });
    check('Approve more than requested (₹900 > ₹800) -> 400', more.status === 400 && /at most the requested ₹800/.test(more.body?.message), `${more.status} ${more.body?.message}`);
}

// 5. Reject + cancel
{
    const noNote = await api(TA, 'POST', `/b2b-user/admin/wallet-requests/${R2}/reject`, {});
    check('Reject needs a reason', noNote.status === 400, `${noNote.status} ${noNote.body?.message}`);
    const r = await api(TA, 'POST', `/b2b-user/admin/wallet-requests/${R2}/reject`, { note: 'Please raise a purchase order instead' });
    check('Reject -> rejected with reason', r.status === 200 && r.data?.status === 'rejected' && r.data?.decisionNote === 'Please raise a purchase order instead', [r.status, r.data?.status]);
    const n = await M.Notification.findOne({ recipientId: EMP, title: 'Wallet request rejected' }).lean();
    check('Employee notified of rejection with reason', /Reason: Please raise a purchase order instead/.test(n?.message || ''), n?.message);

    const otherCancel = await api(TE2, 'POST', `/b2b-user/employee/wallet-requests/${R3}/cancel`);
    check("Another employee can't cancel my request", otherCancel.status === 404, otherCancel.status);
    const cancel = await api(TE, 'POST', `/b2b-user/employee/wallet-requests/${R3}/cancel`);
    check('Employee cancels own pending request', cancel.status === 200 && cancel.data?.status === 'cancelled', [cancel.status, cancel.data?.status]);
    const cancelApproved = await api(TE, 'POST', `/b2b-user/employee/wallet-requests/${R1}/cancel`);
    check("Can't cancel an approved request", cancelApproved.status === 409, cancelApproved.status);
    const approveCancelled = await api(TA, 'POST', `/b2b-user/admin/wallet-requests/${R3}/approve`, {});
    check("Admin can't approve a cancelled request", approveCancelled.status === 409, approveCancelled.status);
    const again = await api(TE, 'POST', '/b2b-user/employee/wallet-requests', { amount: 100, reason: 'Tea and snacks' });
    check('Slots free again after decisions', again.status === 201, `${again.status} ${again.body?.message}`);
}

// 6. Inactive employee
{
    const r = (await api(TE2, 'POST', '/b2b-user/employee/wallet-requests', { amount: 500, reason: 'Travel to client site' })).data?._id;
    await M.User.updateOne({ _id: EMP2 }, { $set: { isActive: false } });
    const ap = await api(TA, 'POST', `/b2b-user/admin/wallet-requests/${r}/approve`, {});
    check('Approve for inactive employee -> 400', ap.status === 400 && /inactive/i.test(ap.body?.message), `${ap.status} ${ap.body?.message}`);
    await M.User.updateOne({ _id: EMP2 }, { $set: { isActive: true } });
}

// 7. Regression: direct allotment (refactored to the same atomic transfer)
{
    const before = await bal();
    const r = await api(TA, 'POST', `/b2b-user/admin/employees/${EMP}/allot-wallet`, { amount: 1000 });
    const after = await bal();
    check('Direct allotment still works', r.status === 200 && after.admin === before.admin - 1000 && after.emp === before.emp + 1000 && r.data?.employeeBalance === after.emp, [r.status, before, after, r.data?.employeeBalance]);
    const tooMuch = await api(TA, 'POST', `/b2b-user/admin/employees/${EMP}/allot-wallet`, { amount: 999999 });
    const after2 = await bal();
    check('Over-allotment fails with nothing moved', tooMuch.status === 400 && after2.admin === after.admin && after2.emp === after.emp, [tooMuch.status, tooMuch.body?.message]);
    // Concurrent order debit + allotment must not overwrite each other
    await Promise.all([
        api(TA, 'POST', `/b2b-user/admin/employees/${EMP}/allot-wallet`, { amount: 10 }),
        M.User.updateOne({ _id: EMP }, { $inc: { b2bWalletBalance: -5 } }),
    ]);
    const after3 = await bal();
    check('Allotment uses $inc (concurrent debit not lost)', after3.emp === after.emp + 10 - 5, [after.emp, after3.emp]);
}

console.log(`\n${pass} passed, ${fail} failed`);
server.close();
await mongoose.disconnect();
await mem.stop();
process.exit(fail ? 1 : 0);
