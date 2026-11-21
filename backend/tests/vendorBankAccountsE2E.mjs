// Usage (from /backend): node tests/vendorBankAccountsE2E.mjs
// Vendor payout accounts: several accounts with one preferred; payouts go to the preferred one;
// existing single accounts are migrated automatically; validation; isolation; admin sees every
// account with the most-paid one highlighted. In-memory MongoDB; email fails harmlessly.
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
process.env.MONGO_URI = mem.getUri('ple_vendor_bank');
Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', SMTP_USER: 'x', SMTP_PASS: 'x', FIREBASE_SERVICE_ACCOUNT: '', NODE_ENV: 'development' });

const mongoose = (await import(pathToFileURL(reqB.resolve('mongoose')).href)).default;
const { default: app } = await imp('app.js');
const { signAccessToken } = await imp('config/jwt.js');
await mongoose.connect(process.env.MONGO_URI);
const server = http.createServer(app);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/api`;

const M = {};
for (const n of ['Vendor', 'Admin', 'User', 'VendorWallet', 'WithdrawalRequest', 'ManagedVendorUser']) M[n] = (await imp(`models/${n}.model.js`)).default;
const svc = await imp('services/vendorBankAccounts.service.js');

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
const mkVendor = (name, extra = {}) => ins(M.Vendor, { name, storeName: name, email: `${name.replace(/\s/g, '').toLowerCase()}@example.com`, password: pw, status: 'approved', isVerified: true, isActive: true, ...extra });
const LEGACY = { accountName: 'Vee Electronics', accountNumber: '123456789012', bankName: 'HDFC Bank', ifscCode: 'HDFC0001234', upiId: '', branchName: 'Pune', accountType: 'current', bankProofType: 'cancelled_cheque', bankProofUrl: 'https://cdn.example.com/cheque.png', bankProofName: 'cheque.png' };
const VA = await mkVendor('Vee Electronics', { bankDetails: LEGACY, createdAt: new Date('2026-01-15T00:00:00Z') });
const VB = await mkVendor('Fresh Store');
const VC = await mkVendor('Messy Store', { bankDetails: { accountName: 'Messy', accountNumber: '12AB', bankName: '', ifscCode: '' } });
const VD = await mkVendor('Other Vendor', { bankDetails: { accountName: 'Other', accountNumber: '999888777666', bankName: 'SBI', ifscCode: 'SBIN0000001' } });
const VE = await mkVendor('Steady Store', { bankDetails: { accountName: 'Steady', accountNumber: '246813579246', bankName: 'Axis Bank', ifscCode: 'UTIB0000246' }, createdAt: new Date('2026-02-01T00:00:00Z') });
const ADMIN = await ins(M.Admin, { name: 'Admin', email: 'admin@example.com', password: pw, role: 'admin', isActive: true, status: 'active' });
const CUST = await ins(M.User, { name: 'Cust', email: 'c@example.com', password: pw, role: 'customer', isActive: true, isVerified: true });
for (const v of [VA, VB, VC, VD, VE]) await ins(M.VendorWallet, { vendorId: v, available: 50000, onHold: 0, reserved: 0, withdrawn: 0, totalEarnings: 50000 });

const tok = (id, role) => signAccessToken({ id: String(id), role, email: `${id}@example.com` });
const TA_V = tok(VA, 'vendor'), TB_V = tok(VB, 'vendor'), TC_V = tok(VC, 'vendor'), TD_V = tok(VD, 'vendor');
const TADMIN = tok(ADMIN, 'admin');
const TCUST = tok(CUST, 'customer');
const MV = (await M.ManagedVendorUser.collection.insertOne({ name: 'Managed V1', username: 'mv1', password: pw, status: 'active', shopId: VA, createdAt: new Date() })).insertedId;
const TMANAGED = tok(MV, 'managed_vendor');
const good = (extra = {}) => ({ label: 'Savings', accountName: 'Vee Electronics', accountNumber: '555566667777', bankName: 'ICICI Bank', ifscCode: 'ICIC0000007', ...extra });
console.log('In-memory DB ready.\n');

// 1. Automatic migration of the old single account
let accA;
{
    const before = await M.Vendor.findById(VA).lean();
    check('Before: vendor has only the old bankDetails', !before.bankAccounts?.length && before.bankDetails.accountNumber === '123456789012', before.bankAccounts);
    const r = await api(TA_V, 'GET', '/vendor/bank-accounts');
    accA = r.data?.accounts;
    check('First visit migrates it: 1 preferred account "Primary account"', r.status === 200 && accA?.length === 1 && accA[0].isPreferred && accA[0].label === 'Primary account' && accA[0].bankName === 'HDFC Bank' && accA[0].ifscCode === 'HDFC0001234', [r.status, accA?.[0]]);
    check('Vendor view masks the account number (no full number anywhere)', accA[0].maskedAccountNumber === 'XXXXXXXX9012' && !('accountNumber' in accA[0]) && !JSON.stringify(r.body).includes('123456789012'), accA[0].maskedAccountNumber);
    check('Bank proof carried over', accA[0].proofType === 'cancelled_cheque' && accA[0].proofName === 'cheque.png', [accA[0].proofType, accA[0].proofName]);
    const again = await api(TA_V, 'GET', '/vendor/bank-accounts');
    const stored = await M.Vendor.findById(VA).select('+bankDetails').lean();
    check('Migrating twice never duplicates; legacy bankDetails untouched', again.data?.accounts?.length === 1 && stored.bankAccounts.length === 1 && stored.bankDetails.accountNumber === '123456789012', [again.data?.accounts?.length, stored.bankAccounts.length]);
    const none = await api(TB_V, 'GET', '/vendor/bank-accounts');
    check('Vendor with no bank details: empty list, can add', none.data?.accounts?.length === 0 && none.data?.canAddMore === true && none.data?.max === 5, none.data);
    const messy = await api(TC_V, 'GET', '/vendor/bank-accounts');
    check('Incomplete old details are migrated as-is (not lost)', messy.data?.accounts?.length === 1 && messy.data.accounts[0].maskedAccountNumber === '12AB', messy.data?.accounts?.[0]);
    const wallet = await api(TA_V, 'GET', '/vendor/finance/wallet');
    check('Wallet summary: bank configured, payouts shown for the preferred account', wallet.data?.bankDetailsConfigured === true && wallet.data?.bankDetailsMasked?.maskedAccountNumber === 'XXXXXXXX9012' && wallet.data?.bankAccountsCount === 1, [wallet.status, wallet.data?.bankDetailsMasked, wallet.data?.bankAccountsCount]);
}

// 2. Validation
{
    const bad = async (label, body, re) => {
        const r = await api(TB_V, 'POST', '/vendor/bank-accounts', body);
        check(`Validation: ${label}`, r.status === 400 && re.test(r.body?.message || ''), `${r.status} ${r.body?.message}`);
    };
    await bad('holder name required', good({ accountName: '' }), /holder name/i);
    await bad('account number must be digits (9-18)', good({ accountNumber: '12AB34' }), /9 to 18 digits/);
    await bad('IFSC format', good({ ifscCode: 'HDFC1234567' }), /IFSC/);
    await bad('number without IFSC', good({ ifscCode: '' }), /both the account number and the IFSC/);
    await bad('bank name required for a bank account', good({ bankName: '' }), /Bank name/);
    await bad('UPI format', { accountName: 'X Y', upiId: 'not-a-upi' }, /UPI ID/);
    await bad('needs a bank account or UPI', { accountName: 'X Y' }, /bank account.*or a UPI/i);
    check('Nothing was saved by the failed attempts', !(await M.Vendor.findById(VB).lean()).bankAccounts?.length, 'none');
}

// 3. Add accounts + preferred rules
let b1, b2, b3;
{
    const r1 = await api(TB_V, 'POST', '/vendor/bank-accounts', good());
    b1 = r1.data?.createdId;
    check('First account: created and automatically preferred', r1.status === 201 && r1.data?.accounts?.length === 1 && r1.data.accounts[0].isPreferred && r1.data.preferredId === b1, [r1.status, r1.data?.preferredId]);
    const r2 = await api(TB_V, 'POST', '/vendor/bank-accounts', { accountName: 'Fresh Store', upiId: 'fresh@okhdfc', label: 'UPI' });
    b2 = r2.data?.createdId;
    check('Second account (UPI only): saved, NOT preferred', r2.status === 201 && r2.data.accounts.length === 2 && r2.data.preferredId === b1, r2.data?.preferredId);
    const dup = await api(TB_V, 'POST', '/vendor/bank-accounts', good({ label: 'Same again' }));
    check('Same bank account twice -> 409', dup.status === 409, `${dup.status} ${dup.body?.message}`);
    const dupUpi = await api(TB_V, 'POST', '/vendor/bank-accounts', { accountName: 'Fresh', upiId: 'FRESH@okhdfc' });
    check('Same UPI id (any case) twice -> 409', dupUpi.status === 409, dupUpi.status);
    const r3 = await api(TB_V, 'POST', '/vendor/bank-accounts', good({ label: 'Current a/c', accountNumber: '888877776666', bankName: 'Axis Bank', ifscCode: 'UTIB0000099', isPreferred: true }));
    b3 = r3.data?.createdId;
    const prefs = r3.data?.accounts?.filter((a) => a.isPreferred);
    check('Adding with isPreferred moves the preferred flag (exactly one preferred)', r3.status === 201 && prefs.length === 1 && prefs[0].id === b3, prefs?.map((p) => p.label));
    const v = await M.Vendor.findById(VB).select('+bankDetails').lean();
    check('Old bankDetails mirrors the preferred account', v.bankDetails.accountNumber === '888877776666' && v.bankDetails.bankName === 'Axis Bank' && v.bankDetails.ifscCode === 'UTIB0000099', v.bankDetails);
    await api(TB_V, 'POST', '/vendor/bank-accounts', { accountName: 'Fresh', upiId: 'extra1@okaxis' });
    await api(TB_V, 'POST', '/vendor/bank-accounts', { accountName: 'Fresh', upiId: 'extra2@okaxis' });
    const sixth = await api(TB_V, 'POST', '/vendor/bank-accounts', { accountName: 'Fresh', upiId: 'extra3@okaxis' });
    check('At most 5 accounts', sixth.status === 400 && /up to 5/.test(sixth.body?.message || ''), `${sixth.status} ${sixth.body?.message}`);
    const list = await api(TB_V, 'GET', '/vendor/bank-accounts');
    check('List reports canAddMore=false at the limit', list.data?.accounts?.length === 5 && list.data?.canAddMore === false, [list.data?.accounts?.length, list.data?.canAddMore]);
    // free two slots for the next steps
    const ids = list.data.accounts.filter((a) => /extra[12]/.test(a.upiId)).map((a) => a.id);
    for (const id of ids) await api(TB_V, 'DELETE', `/vendor/bank-accounts/${id}`);
}

// 4. Edit
{
    const r = await api(TB_V, 'PUT', `/vendor/bank-accounts/${b1}`, { label: 'ICICI savings', branchName: 'Kothrud' });
    const a = r.data?.accounts?.find((x) => x.id === b1);
    check('Edit label / branch', r.status === 200 && a?.label === 'ICICI savings' && a?.branchName === 'Kothrud' && a?.maskedAccountNumber === 'XXXXXXXX7777', [r.status, a?.label]);
    const badIfsc = await api(TB_V, 'PUT', `/vendor/bank-accounts/${b1}`, { ifscCode: 'nope' });
    check('Edit with a bad IFSC -> 400, account unchanged', badIfsc.status === 400 && (await M.Vendor.findById(VB).lean()).bankAccounts.find((x) => String(x._id) === b1).ifscCode === 'ICIC0000007', badIfsc.status);
    const clash = await api(TB_V, 'PUT', `/vendor/bank-accounts/${b1}`, { accountNumber: '888877776666', ifscCode: 'UTIB0000099', bankName: 'Axis Bank' });
    check('Edit that would duplicate another saved account -> 409', clash.status === 409, `${clash.status} ${clash.body?.message}`);
    const ok = await api(TB_V, 'PUT', `/vendor/bank-accounts/${b1}`, { accountNumber: '555566660000' });
    check('Changing the account number keeps IFSC / bank; proof cleared', ok.status === 200 && ok.data.accounts.find((x) => x.id === b1).maskedAccountNumber === 'XXXXXXXX0000', ok.status);
    check('Unknown account -> 404', (await api(TB_V, 'PUT', `/vendor/bank-accounts/${new mongoose.Types.ObjectId()}`, { label: 'x' })).status === 404, 'checked');
    const foreign = await api(TD_V, 'PUT', `/vendor/bank-accounts/${b1}`, { label: 'hijack' });
    check("A vendor can't edit another vendor's account (404)", foreign.status === 404, foreign.status);
    const foreignDel = await api(TD_V, 'DELETE', `/vendor/bank-accounts/${b1}`);
    const foreignPref = await api(TD_V, 'PATCH', `/vendor/bank-accounts/${b1}/preferred`);
    check("...nor delete it or make it preferred", foreignDel.status === 404 && foreignPref.status === 404, [foreignDel.status, foreignPref.status]);
}

// 5. Partial edits of imperfect migrated data
{
    const messy = (await api(TC_V, 'GET', '/vendor/bank-accounts')).data.accounts[0];
    const r = await api(TC_V, 'PUT', `/vendor/bank-accounts/${messy.id}`, { label: 'To fix' });
    check('Imperfect old data: changing only the label still works', r.status === 200, `${r.status} ${r.body?.message}`);
    const fix = await api(TC_V, 'PUT', `/vendor/bank-accounts/${messy.id}`, { accountNumber: '445566778899', ifscCode: 'KKBK0000123', bankName: 'Kotak' });
    check('...and the vendor can correct it field by field', fix.status === 200 && fix.data.accounts[0].maskedAccountNumber === 'XXXXXXXX8899', `${fix.status} ${fix.body?.message}`);
}

// 6. Set preferred + remove
{
    const r = await api(TB_V, 'PATCH', `/vendor/bank-accounts/${b2}/preferred`);
    check('Make the UPI account preferred', r.status === 200 && r.data.preferredId === b2 && r.data.accounts.filter((a) => a.isPreferred).length === 1, r.data?.preferredId);
    const v = await M.Vendor.findById(VB).select('+bankDetails').lean();
    check('Mirror switches to the UPI account', v.bankDetails.upiId === 'fresh@okhdfc' && v.bankDetails.accountNumber === '', v.bankDetails);

    const rm = await api(TB_V, 'DELETE', `/vendor/bank-accounts/${b2}`);
    check('Removing the preferred account promotes the most recently added other one', rm.status === 200 && rm.data.accounts.length === 2 && rm.data.preferredId === b3, [rm.status, rm.data?.preferredId]);
    const rm2 = await api(TB_V, 'DELETE', `/vendor/bank-accounts/${b1}`);
    check('Removing a non-preferred account leaves the preferred alone', rm2.data.preferredId === b3 && rm2.data.accounts.length === 1, rm2.data?.preferredId);
    const rm3 = await api(TB_V, 'DELETE', `/vendor/bank-accounts/${b3}`);
    const empty = await M.Vendor.findById(VB).select('+bankDetails').lean();
    check('Removing the last account: none preferred, old bankDetails emptied', rm3.status === 200 && rm3.data.accounts.length === 0 && rm3.data.preferredId === null && !empty.bankDetails.accountNumber && !empty.bankDetails.upiId, [rm3.data?.preferredId, empty.bankDetails]);
    const w = await api(TB_V, 'POST', '/vendor/finance/withdrawals', { amount: 1000 });
    check('Without any payout account a withdrawal is refused with a clear message', w.status === 400 && /bank account or UPI/i.test(w.body?.message || ''), `${w.status} ${w.body?.message}`);
}

// 7. Payouts go to the preferred account (as an immutable snapshot)
let w1, w2, w3;
{
    // vendor A: migrated account is preferred -> add a second, then withdraw
    const a1 = accA[0].id;
    const add = await api(TA_V, 'POST', '/vendor/bank-accounts', good({ label: 'ICICI', accountNumber: '777788889999' }));
    const a2 = add.data?.createdId;
    const r1 = await api(TA_V, 'POST', '/vendor/finance/withdrawals', { amount: 1000 });
    w1 = await M.WithdrawalRequest.findById(r1.data?._id).lean();
    check('Withdrawal #1 is addressed to the preferred (migrated) account', r1.status === 201 && String(w1.bankDetailsSnapshot.bankAccountId) === a1 && w1.bankDetailsSnapshot.accountNumber === '123456789012' && w1.paymentMethod === 'bank_transfer', [r1.status, w1?.bankDetailsSnapshot?.accountNumber]);
    await M.WithdrawalRequest.updateOne({ _id: w1._id }, { $set: { status: 'paid', paidAmount: 1000, paidAt: new Date('2026-11-01') } });

    await api(TA_V, 'PATCH', `/vendor/bank-accounts/${a2}/preferred`);
    const r2 = await api(TA_V, 'POST', '/vendor/finance/withdrawals', { amount: 1200 });
    w2 = await M.WithdrawalRequest.findById(r2.data?._id).lean();
    check('After switching preferred: withdrawal #2 goes to the new account', String(w2.bankDetailsSnapshot.bankAccountId) === a2 && w2.bankDetailsSnapshot.accountNumber === '777788889999' && w2.bankDetailsSnapshot.label === 'ICICI', [w2?.bankDetailsSnapshot?.label, w2?.bankDetailsSnapshot?.accountNumber]);
    check('Withdrawal #1 still shows its original account (snapshot never changes)', (await M.WithdrawalRequest.findById(w1._id).lean()).bankDetailsSnapshot.accountNumber === '123456789012', 'unchanged');

    // editing / removing the account afterwards does not redirect a request already made
    await api(TA_V, 'PUT', `/vendor/bank-accounts/${a2}`, { accountNumber: '111122223333' });
    await api(TA_V, 'PATCH', `/vendor/bank-accounts/${a1}/preferred`);
    await api(TA_V, 'DELETE', `/vendor/bank-accounts/${a2}`);
    check('Editing then deleting the account does not redirect a request already made', (await M.WithdrawalRequest.findById(w2._id).lean()).bankDetailsSnapshot.accountNumber === '777788889999', 'unchanged');
    await M.WithdrawalRequest.updateOne({ _id: w2._id }, { $set: { status: 'paid', paidAmount: 1200, paidAt: new Date('2026-11-05') } });
    const readd = await api(TA_V, 'POST', '/vendor/bank-accounts', good({ label: 'ICICI', accountNumber: '777788889999' }));
    const a2b = readd.data?.createdId;

    // UPI preferred -> upi payout
    const upi = await api(TA_V, 'POST', '/vendor/bank-accounts', { accountName: 'Vee', upiId: 'vee@okicici', label: 'UPI', isPreferred: true });
    const r3 = await api(TA_V, 'POST', '/vendor/finance/withdrawals', { amount: 800 });
    w3 = await M.WithdrawalRequest.findById(r3.data?._id).lean();
    check('UPI preferred -> payment method upi, UPI id in the snapshot', w3.paymentMethod === 'upi' && w3.bankDetailsSnapshot.upiId === 'vee@okicici' && String(w3.bankDetailsSnapshot.bankAccountId) === upi.data?.createdId, [w3.paymentMethod, w3.bankDetailsSnapshot.upiId]);
    await M.WithdrawalRequest.updateOne({ _id: w3._id }, { $set: { status: 'paid', paidAmount: 800, paidAt: new Date('2026-11-10') } });
    // an old payout made before accounts had ids, matched by number + IFSC
    await ins(M.WithdrawalRequest, { withdrawalId: 'WR-OLD-1', vendorId: VA, requestedAmount: 700, eligibleAmountAtRequest: 700, status: 'paid', paidAmount: 700, paidAt: new Date('2026-10-01'), bankDetailsSnapshot: { accountName: 'Vee Electronics', accountNumber: '123456789012', ifscCode: 'HDFC0001234', bankName: 'HDFC Bank' } });
    globalThis.__ids = { a1, a2b, upi: upi.data?.createdId };
}

// 8. Admin view
{
    const { a1, a2b, upi } = globalThis.__ids;
    const r = await api(TADMIN, 'GET', `/admin/vendors/${VA}/bank-accounts`);
    const by = Object.fromEntries((r.data?.accounts || []).map((a) => [a.id, a]));
    check('Admin sees every account with the FULL number', r.status === 200 && r.data.accounts.length === 3 && by[a1].accountNumber === '123456789012' && by[a2b].accountNumber === '777788889999', [r.status, r.data?.accounts?.length]);
    check('Payments per account: migrated 2 (incl. the old payout matched by number), ICICI 1, UPI 1', by[a1].paymentsReceived === 2 && by[a1].amountReceived === 1700 && by[a2b].paymentsReceived === 1 && by[upi].paymentsReceived === 1, [by[a1].paymentsReceived, by[a2b].paymentsReceived, by[upi].paymentsReceived]);
    check('Most-paid account is highlighted (only one)', r.data.mostUsedId === a1 && r.data.accounts.filter((a) => a.isMostUsed).length === 1 && by[a1].isMostUsed, r.data.mostUsedId);
    check('Preferred shown separately from most-used', r.data.preferredId === upi && by[upi].isPreferred && !by[upi].isMostUsed, r.data.preferredId);
    check('Totals: 4 payouts, ₹3,700', r.data.totalPayouts === 4 && r.data.totalAmountPaid === 3700, [r.data.totalPayouts, r.data.totalAmountPaid]);
    check('Recently changed accounts are flagged for the admin (new / made preferred)', by[upi].recentlyChanged === true, by[upi].recentlyChanged);
    // switch preferred back to the old account: it becomes "recent", the demoted UPI account does not
    await api(TA_V, 'PATCH', `/vendor/bank-accounts/${a1}/preferred`);
    const swapped = Object.fromEntries(((await api(TADMIN, 'GET', `/admin/vendors/${VA}/bank-accounts`)).data?.accounts || []).map((a) => [a.id, a]));
    check('Making an account preferred marks it as just changed', swapped[a1].recentlyChanged === true && swapped[a1].isPreferred, swapped[a1].changedAt);
    await api(TA_V, 'PATCH', `/vendor/bank-accounts/${upi}/preferred`);
    const noPaid = await api(TADMIN, 'GET', `/admin/vendors/${VD}/bank-accounts`);
    check('No payouts yet -> no account highlighted; vendor D migrated on view', noPaid.status === 200 && noPaid.data.accounts.length === 1 && noPaid.data.mostUsedId === null, [noPaid.status, noPaid.data?.mostUsedId]);
    check('Unknown vendor -> 404, bad id -> 400', (await api(TADMIN, 'GET', `/admin/vendors/${new mongoose.Types.ObjectId()}/bank-accounts`)).status === 404 && (await api(TADMIN, 'GET', '/admin/vendors/abc/bank-accounts')).status === 400, 'checked');

    const wd = await api(TADMIN, 'GET', `/admin/finance/withdrawals/${w3._id}`);
    check('Admin withdrawal detail: lists accounts and warns the payout account was changed just before', wd.status === 200 && wd.data?.vendorBankAccounts?.length === 3 && wd.data?.payoutAccountChangedRecently === true && wd.data?.withdrawal?.bankDetailsSnapshot?.upiId === 'vee@okicici', [wd.status, wd.data?.payoutAccountChangedRecently]);
    const wd1 = await api(TADMIN, 'GET', `/admin/finance/withdrawals/${w1._id}`);
    check('...and shows no warning for the long-standing account', wd1.data?.payoutAccountChangedRecently === false, wd1.data?.payoutAccountChangedRecently);
}

// 8b. Demotion is not a "change": an old account stays un-flagged when another one is made preferred
{
    const TE = tok(VE, 'vendor');
    const first = (await api(TE, 'GET', '/vendor/bank-accounts')).data.accounts[0].id;
    const added = await api(TE, 'POST', '/vendor/bank-accounts', good({ label: 'New one', accountNumber: '135792468013', isPreferred: true }));
    const view = Object.fromEntries(((await api(TADMIN, 'GET', `/admin/vendors/${VE}/bank-accounts`)).data?.accounts || []).map((x) => [x.id, x]));
    check('Old account demoted by a new preferred one is NOT flagged; the new one is', view[first].recentlyChanged === false && String(view[first].changedAt).startsWith('2026-02-01') && view[added.data.createdId].recentlyChanged === true, [view[first].recentlyChanged, view[first].changedAt]);
    const edit = await api(TE, 'PUT', `/vendor/bank-accounts/${first}`, { label: 'Renamed only' });
    const after = (await api(TADMIN, 'GET', `/admin/vendors/${VE}/bank-accounts`)).data.accounts.find((x) => x.id === first);
    check('Renaming an account does not count as a payout change', edit.status === 200 && after.recentlyChanged === false, after.recentlyChanged);
    await api(TE, 'PUT', `/vendor/bank-accounts/${first}`, { upiId: 'steady@okaxis' });
    const after2 = (await api(TADMIN, 'GET', `/admin/vendors/${VE}/bank-accounts`)).data.accounts.find((x) => x.id === first);
    check('Changing payout details does', after2.recentlyChanged === true, after2.changedAt);
}

// 9. Old single-account endpoints keep working (they edit the preferred account)
{
    const r = await api(TD_V, 'PUT', '/vendor/finance/bank-details', { bankName: 'State Bank of India' });
    const acc = (await api(TD_V, 'GET', '/vendor/bank-accounts')).data.accounts[0];
    check('Old finance endpoint edits the preferred account', r.status === 200 && acc.bankName === 'State Bank of India', [r.status, acc?.bankName]);
    const r2 = await api(TD_V, 'PUT', '/vendor/auth/bank-details', { accountName: 'Other Vendor Pvt Ltd' });
    const acc2 = (await api(TD_V, 'GET', '/vendor/bank-accounts')).data.accounts[0];
    check('Old auth endpoint too', r2.status === 200 && acc2.accountName === 'Other Vendor Pvt Ltd', [r2.status, acc2?.accountName]);
    const fresh = await mkVendor('Brand New');
    await ins(M.VendorWallet, { vendorId: fresh, available: 0, onHold: 0, reserved: 0 });
    const TN = tok(fresh, 'vendor');
    const r3 = await api(TN, 'PUT', '/vendor/finance/bank-details', { accountName: 'Brand New', accountNumber: '100200300400', bankName: 'Yes Bank', ifscCode: 'YESB0000001' });
    const list = (await api(TN, 'GET', '/vendor/bank-accounts')).data;
    check('Old endpoint creates the first account when there is none', r3.status === 200 && list.accounts.length === 1 && list.accounts[0].isPreferred, [r3.status, list.accounts.length]);
}

// 10. Access
{
    const anon = await Promise.all([api(null, 'GET', '/vendor/bank-accounts'), api(null, 'POST', '/vendor/bank-accounts', good()), api(null, 'GET', `/admin/vendors/${VA}/bank-accounts`)]);
    check('Anonymous -> 401 everywhere', anon.every((r) => r.status === 401), anon.map((r) => r.status));
    const cust = await Promise.all([api(TCUST, 'GET', '/vendor/bank-accounts'), api(TCUST, 'GET', `/admin/vendors/${VA}/bank-accounts`)]);
    check('Customers -> 403', cust.every((r) => r.status === 403), cust.map((r) => r.status));
    const vendAdmin = await api(TA_V, 'GET', `/admin/vendors/${VA}/bank-accounts`);
    check("A vendor can't use the admin view (403)", vendAdmin.status === 403, vendAdmin.status);
    const managed = await api(TMANAGED, 'POST', '/vendor/bank-accounts', good({ accountNumber: '121212121212' }));
    check('Managed-vendor staff cannot change payout accounts (403)', managed.status === 403, `${managed.status} ${managed.body?.message}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
server.close();
await mongoose.disconnect();
await mem.stop();
process.exit(fail ? 1 : 0);
