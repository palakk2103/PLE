// Usage (from /backend): node tests/auditFixesE2E.mjs
// Regression checks for the Nov 2026 client/Director audit fixes: security holes (backdoor logins,
// wallet credit, public test-data route), money correctness (chat offers, RFQ quotes),
// B2B login/refresh, Source Now negotiation, RFQ vendor assignment, delivery check, Enquire Now
// variant and vendor conversations. In-memory MongoDB, Razorpay stubbed.
import { createRequire } from 'module';
import { pathToFileURL, fileURLToPath } from 'url';
import http from 'http';
import path from 'path';
import crypto from 'crypto';

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = `${BACKEND}/src`;
const reqB = createRequire(`${BACKEND}/package.json`);
const imp = (p) => import(pathToFileURL(`${SRC}/${p}`).href);

const { MongoMemoryReplSet } = reqB('mongodb-memory-server');
const mem = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
process.env.MONGO_URI = mem.getUri('ple_audit_fixes');
Object.assign(process.env, {
    SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', SMTP_USER: 'x', SMTP_PASS: 'x', FIREBASE_SERVICE_ACCOUNT: '',
    SHIPROCKET_EMAIL: '', SHIPROCKET_PASSWORD: '', NODE_ENV: 'development',
    RAZORPAY_KEY_ID: 'rzp_test_dummy', RAZORPAY_KEY_SECRET: 'testsecret',
});

const mongoose = (await import(pathToFileURL(reqB.resolve('mongoose')).href)).default;
const rzpSvc = await imp('services/razorpay.service.js');
const rzpOrders = new Map();
let seq = 0;
rzpSvc.__setRazorpayClientForTests({
    orders: {
        create: async (o) => { const id = `order_T${++seq}`; rzpOrders.set(id, { id, ...o, status: 'created', amount_paid: 0 }); return { id, amount: o.amount, currency: 'INR' }; },
        fetch: async (id) => { const o = rzpOrders.get(id); if (!o) throw new Error('not found'); return o; },
    },
    payments: { fetch: async () => null },
});
const { default: app } = await imp('app.js');
const { signAccessToken } = await imp('config/jwt.js');
await mongoose.connect(process.env.MONGO_URI);
const server = http.createServer(app);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/api`;

const M = {};
for (const n of ['User', 'Vendor', 'Product', 'RFQ', 'ProductRequest', 'VendorChatThread', 'B2BCompany', 'Wallet']) M[n] = (await imp(`models/${n}.model.js`)).default;
const Admin = (await imp('models/Admin.model.js')).default;

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
const sign = (orderId, paymentId) => crypto.createHmac('sha256', 'testsecret').update(`${orderId}|${paymentId}`).digest('hex');

// ── seed
const pw = '$2a$12$abcdefghijklmnopqrstuuDummyHashNotUsedForLoginxxxxxxxx';
const ins = async (Model, doc) => (await Model.collection.insertOne({ createdAt: new Date(), updatedAt: new Date(), ...doc })).insertedId;

const COMPANY = await ins(M.B2BCompany, { companyName: 'Acme Traders', businessEmail: 'acme@example.com', verificationStatus: 'Approved' });
const PENDING_CO = await ins(M.B2BCompany, { companyName: 'Newco', businessEmail: 'newco@example.com', verificationStatus: 'Pending Verification' });
const B2B_ADMIN = (await M.User.create({ name: 'Asha Admin', email: 'asha@example.com', password: 'Asha#Pass1', role: 'b2bAdmin', companyId: COMPANY, isActive: true, isVerified: true, phone: '9000000010' }))._id;
await M.User.create({ name: 'Nina New', email: 'nina@example.com', password: 'Nina#Pass1', role: 'b2bAdmin', companyId: PENDING_CO, isActive: true, isVerified: true, phone: '9000000013' });
const EMP = await ins(M.User, { name: 'Ravi Staff', email: 'ravi@example.com', password: pw, role: 'b2bEmployee', companyId: COMPANY, isActive: true, isVerified: true, phone: '9000000011', b2bWalletBalance: 1000 });
const CUST = await ins(M.User, { name: 'Cara Customer', email: 'cara@example.com', password: pw, role: 'customer', isActive: true, isVerified: true, phone: '9000000012' });
const VEND = await ins(M.Vendor, { name: 'V', storeName: 'Volt Supplies', email: 'volt@example.com', password: pw, status: 'approved', isVerified: true, isActive: true, gstNumber: '27ABCDE1234F1Z5', shippingEnabled: false });
const VEND_PENDING = await ins(M.Vendor, { name: 'P', storeName: 'Pending Co', email: 'pend@example.com', password: pw, status: 'pending', isVerified: true, isActive: true });
const P = await ins(M.Product, { name: 'Office Chair', slug: 'office-chair', price: 1000, stockQuantity: 100, stock: 'in_stock', isActive: true, isVisible: true, approvalStatus: 'approved', gstMode: 'custom', gstRate: 18, vendorId: VEND, listingType: 'vendor_direct' });

const T = {
    b2bAdmin: signAccessToken({ id: String(B2B_ADMIN), role: 'b2bAdmin', email: 'asha@example.com', companyId: String(COMPANY) }),
    emp: signAccessToken({ id: String(EMP), role: 'b2bEmployee', email: 'ravi@example.com', companyId: String(COMPANY) }),
    cust: signAccessToken({ id: String(CUST), role: 'customer', email: 'cara@example.com' }),
    vend: signAccessToken({ id: String(VEND), role: 'vendor', email: 'volt@example.com' }),
};
console.log('In-memory DB ready.\n');

// 1. Public test-data route is gone
{
    const r = await api(null, 'GET', '/setup-test-data');
    const made = await mongoose.connection.collection('managedvendorusers').countDocuments({ username: 'rahul' });
    check('GET /setup-test-data no longer exists and creates no login', r.status === 404 && made === 0, `${r.status} rahulAccounts=${made}`);
}

// 2. Wallet: self-credit and recharge rules
{
    const refund = await api(T.b2bAdmin, 'POST', '/wallet/refund', { amount: 100000 });
    check('POST /wallet/refund (self-credit any amount) removed', refund.status === 404, refund.status);
    const pay = await api(T.b2bAdmin, 'POST', '/wallet/pay', { amount: 10 });
    check('POST /wallet/pay removed', pay.status === 404, pay.status);

    const empR = await api(T.emp, 'POST', '/wallet/recharge', { amount: 500 });
    check('Employee cannot recharge (spends admin-allotted funds only)', empR.status === 403, empR.status);
    const custR = await api(T.cust, 'POST', '/wallet/recharge', { amount: 500 });
    check('B2C customer cannot recharge', custR.status === 403, custR.status);

    const ok = await api(T.b2bAdmin, 'POST', '/wallet/recharge', { amount: 500 });
    check('Company admin can start a recharge', ok.status === 200 && ok.data?.id, `${ok.status} ${ok.data?.id}`);

    // Pay ₹500, but claim ₹99,999 in the request body
    const order = rzpOrders.get(ok.data.id);
    Object.assign(order, { status: 'paid', amount_paid: order.amount });
    const verify = await api(T.b2bAdmin, 'POST', '/wallet/verify-payment', { razorpay_order_id: order.id, razorpay_payment_id: 'pay_1', razorpay_signature: sign(order.id, 'pay_1'), amount: 99999 });
    const bal = (await M.Wallet.findOne({ userId: B2B_ADMIN }).lean())?.balance;
    check('Credits what Razorpay charged (₹500), not the amount the browser sent', verify.status === 200 && bal === 500, `${verify.status} balance=${bal}`);

    const again = await api(T.b2bAdmin, 'POST', '/wallet/verify-payment', { razorpay_order_id: order.id, razorpay_payment_id: 'pay_1', razorpay_signature: sign(order.id, 'pay_1') });
    const bal2 = (await M.Wallet.findOne({ userId: B2B_ADMIN }).lean())?.balance;
    check('Replaying the same payment does not credit twice', again.status === 200 && bal2 === 500, `${again.status} balance=${bal2}`);

    rzpOrders.set('order_OTHER', { id: 'order_OTHER', amount: 100000, amount_paid: 100000, status: 'paid', notes: { purpose: 'wallet_recharge', userId: String(EMP) } });
    const foreign = await api(T.b2bAdmin, 'POST', '/wallet/verify-payment', { razorpay_order_id: 'order_OTHER', razorpay_payment_id: 'pay_2', razorpay_signature: sign('order_OTHER', 'pay_2') });
    check("Cannot claim someone else's payment", foreign.status === 400, `${foreign.status} ${foreign.body?.message}`);

    const badSig = await api(T.b2bAdmin, 'POST', '/wallet/verify-payment', { razorpay_order_id: order.id, razorpay_payment_id: 'pay_3', razorpay_signature: 'nope' });
    check('Bad signature rejected', badSig.status === 400, badSig.status);
}

// 3. Admin login: no backdoor passwords / secrets
const SA = await Admin.create({ name: 'Root', email: 'root@ple.test', password: 'Real#Pass123', role: 'superadmin', userType: 'superadmin', identityId: 'PLE-SA-000009', identityClass: 'superadmin', personalSecretHash: await Admin.hashPersonalSecret('RealSecret#1') });
{
    const bd = await api(null, 'POST', '/admin/auth/login', { identityId: 'PLE-SA-000009', password: 'admin@123', personalSecret: 'RealSecret#1', role: 'superadmin' });
    check('Backdoor password admin@123 rejected', bd.status === 401, `${bd.status} ${bd.body?.message}`);
    const bs = await api(null, 'POST', '/admin/auth/login', { identityId: 'PLE-SA-000009', password: 'Real#Pass123', personalSecret: 'PLE#Sec99', role: 'superadmin' });
    check('Backdoor secret PLE#Sec99 rejected', bs.status === 401, `${bs.status} ${bs.body?.message}`);
    const ok = await api(null, 'POST', '/admin/auth/login', { identityId: 'PLE-SA-000009', password: 'Real#Pass123', personalSecret: 'RealSecret#1', role: 'superadmin' });
    check('Real credentials still work', ok.status === 200 && ok.data?.accessToken, ok.status);
}

// 4. Account team: reset works; a plain admin cannot create or take over a Super Admin
{
    const TSA = signAccessToken({ id: String(SA._id), role: 'superadmin', email: 'root@ple.test' });
    const prov = await api(TSA, 'POST', '/admin/account-team/provision', { name: 'Tara Team', email: 'tara@ple.test', department: 'Ops', designation: 'Analyst', personalSecret: 'Tara#1', initialPassword: 'First#Pass1' });
    check('Super Admin provisions an account team member', prov.status === 201, `${prov.status} ${prov.body?.message}`);
    const memberId = prov.data?.id;
    const reset = await api(TSA, 'POST', `/admin/account-team/${memberId}/reset-credentials`, { newPassword: 'Second#Pass2' });
    const login = await api(null, 'POST', '/admin/auth/login', { identityId: prov.data?.identityId, password: 'Second#Pass2', personalSecret: 'Tara#1', role: 'account_team' });
    check('Password reset actually works (was hashed twice)', reset.status === 200 && login.status === 200, `reset=${reset.status} login=${login.status} ${login.body?.message || ''}`);

    const plain = await Admin.create({ name: 'Plain Admin', email: 'plain@ple.test', password: 'Plain#Pass1', role: 'admin', identityId: 'PLE-EMP-000777' });
    const TPA = signAccessToken({ id: String(plain._id), role: 'admin', email: 'plain@ple.test' });
    const mk = await api(TPA, 'POST', '/admin/account-team/provision', { role: 'superadmin', name: 'Sneaky', email: 'sneaky@ple.test', department: 'X', designation: 'Y', personalSecret: 'abcd', initialPassword: 'abcdef' });
    check('Plain admin cannot create a Super Admin', mk.status === 403, `${mk.status} ${mk.body?.message}`);
    const take = await api(TPA, 'POST', `/admin/account-team/${SA._id}/reset-credentials`, { newPassword: 'Hijack#123' });
    check("Plain admin cannot reset a Super Admin's password", take.status === 403, `${take.status} ${take.body?.message}`);
}

// 6. B2B login feedback + session refresh
{
    const pending = await api(null, 'POST', '/b2b-user/auth/login', { businessEmail: 'nina@example.com', password: 'Nina#Pass1' });
    check('Pending company gets a clear "under review" message', pending.status === 403 && /under review/i.test(pending.body?.message), `${pending.status} ${pending.body?.message}`);
    const ok = await api(null, 'POST', '/b2b-user/auth/login', { businessEmail: 'asha@example.com', password: 'Asha#Pass1' });
    check('B2B login returns a refresh token', ok.status === 200 && ok.data?.accessToken && ok.data?.refreshToken, ok.status);
    const ref = await api(null, 'POST', '/b2b-user/auth/refresh', { refreshToken: ok.data?.refreshToken });
    check('B2B session can be refreshed', ref.status === 200 && ref.data?.accessToken && ref.data?.refreshToken, `${ref.status} ${ref.body?.message || ''}`);
    const reuse = await api(null, 'POST', '/b2b-user/auth/refresh', { refreshToken: ok.data?.refreshToken });
    check('Old refresh token cannot be reused after rotation', reuse.status === 401, reuse.status);
    const me = await api(ref.data?.accessToken, 'GET', '/b2b-user/admin/profile');
    check('Refreshed token keeps the b2bAdmin role', me.status === 200, `${me.status} ${me.body?.message || ''}`);
}

// 7. Chat offer: GST from product rate, discount capped
{
    const thread = await ins(M.VendorChatThread, { vendorId: VEND, customerUserId: CUST, customerName: 'Cara', status: 'active', lastActivity: new Date() });
    const big = await api(T.vend, 'POST', `/vendor/chat/threads/${thread}/proposal`, { productId: String(P), quantity: 1, unitPrice: 500, discount: 600, deliveryCharge: 200 });
    check('Discount larger than product amount rejected', big.status === 400 && /Discount/.test(big.body?.message), `${big.status} ${big.body?.message}`);
    const ok = await api(T.vend, 'POST', `/vendor/chat/threads/${thread}/proposal`, { productId: String(P), quantity: 2, unitPrice: 500, discount: 100, tax: 1, deliveryCharge: 50 });
    // (1000 - 100) = 900 taxable, 18% = 162, + 50 delivery = 1112; the vendor's "tax: 1" is ignored
    check('GST is 18% of the taxable value, not what the vendor typed', ok.status === 201 && ok.data?.tax === 162 && ok.data?.finalAmount === 1112, `${ok.status} tax=${ok.data?.tax} final=${ok.data?.finalAmount}`);
}

// 8. B2B RFQ: vendor quote rules, admin assignment rules
{
    const TSA = signAccessToken({ id: String(SA._id), role: 'superadmin', email: 'root@ple.test' });
    const rfq = await M.RFQ.create({ rfqId: 'RFQ-T1', companyId: COMPANY, companyName: 'Acme Traders', quantity: 10, targetPrice: 100, status: 'Submitted', title: 'Chairs for office' });
    check('RFQ title is stored', (await M.RFQ.findById(rfq._id).lean()).title === 'Chairs for office', 'ok');

    const bad = await api(TSA, 'POST', `/admin/rfq/${rfq._id}/assign-vendors`, { vendorIds: [String(VEND), String(VEND_PENDING)] });
    check('Cannot invite a vendor that is not approved', bad.status === 400, `${bad.status} ${bad.body?.message}`);
    const ok = await api(TSA, 'POST', `/admin/rfq/${rfq._id}/assign-vendors`, { vendorIds: [String(VEND)] });
    check('Approved vendor assigned', ok.status === 200, ok.status);

    const low = await api(T.vend, 'POST', `/vendor/rfq/${rfq._id}/quote`, { unitPrice: 100, totalPrice: 500, deliveryTime: '5 days' });
    check('Quote total below unit price x quantity rejected', low.status === 400, `${low.status} ${low.body?.message}`);
    const q = await api(T.vend, 'POST', `/vendor/rfq/${rfq._id}/quote`, { unitPrice: 100, totalPrice: 1180, deliveryTime: '5 days' });
    check('Valid quote accepted', q.status === 200 || q.status === 201, q.status);

    // Re-inviting with a different list keeps the vendor who already quoted
    const v2 = await ins(M.Vendor, { name: 'V2', storeName: 'Second', email: 'v2@example.com', password: pw, status: 'approved', isVerified: true, isActive: true });
    await api(TSA, 'POST', `/admin/rfq/${rfq._id}/assign-vendors`, { vendorIds: [String(v2)] });
    const after = await M.RFQ.findById(rfq._id).lean();
    check('Vendor who already quoted keeps access after re-assignment', after.assignedVendorIds.map(String).includes(String(VEND)) && after.status === 'Quotations Received', `${after.assignedVendorIds.length} vendors, ${after.status}`);

    await M.RFQ.updateOne({ _id: rfq._id }, { $set: { status: 'Awaiting B2B Approval' } });
    const change = await api(T.vend, 'POST', `/vendor/rfq/${rfq._id}/quote`, { unitPrice: 200, totalPrice: 2360, deliveryTime: '5 days' });
    check('Vendor cannot change a quote once it is selected', change.status === 409, `${change.status} ${change.body?.message}`);
}

// 9. Source Now: a second change request is allowed and reaches the vendor's chat
{
    const thread = await ins(M.VendorChatThread, { vendorId: VEND, customerUserId: CUST, customerName: 'Cara', status: 'active', lastActivity: new Date() });
    await M.ProductRequest.create({ requestId: 'REQ-900001', userId: CUST, productName: 'Lab Stand', category: 'Other', quantity: 5, expectedBudget: 5000, status: 'Quotation Submitted', acceptedVendorId: VEND, chatThreadId: thread, assignedVendors: [{ vendorId: VEND }] });
    const a = await api(T.cust, 'POST', '/user/product-requests/REQ-900001/request-changes', { message: 'Can you do 900 each?', desiredPrice: 900 });
    const b = await api(T.cust, 'POST', '/user/product-requests/REQ-900001/request-changes', { message: 'Also need delivery in 3 days' });
    check('Second change request no longer returns Error 400', a.status === 200 && b.status === 200, `${a.status} ${b.status} ${b.body?.message || ''}`);
    const msgs = await mongoose.connection.collection('vendorchatmessages').countDocuments({ threadId: thread });
    check('Change requests are posted into the vendor chat', msgs === 2, msgs);
}

// 10. Real delivery check by pincode
{
    const bad = await api(null, 'GET', `/products/${P}/delivery-check?pincode=12345`);
    check('5-digit pincode rejected', bad.status === 400, bad.status);
    const ok = await api(null, 'GET', `/products/${P}/delivery-check?pincode=411001`);
    check('Delivery check answers from the shipping rules', ok.status === 200 && typeof ok.data?.serviceable === 'boolean' && ok.data?.estimatedDelivery, ok.data);
}

// 11. Enquire Now carries the selected variant
{
    const r = await api(T.emp, 'POST', '/user/chat/vendor/enquire', { productId: String(P), variant: { color: 'Red', size: 'M' } });
    const t = await M.VendorChatThread.findById(r.data?.thread?._id).lean();
    check('Enquiry thread stores the variant', r.status === 201 && t?.productVariant === 'Color: Red | Size: M', `${r.status} "${t?.productVariant}"`);
    const r2 = await api(T.emp, 'POST', '/user/chat/vendor/enquire', { productId: String(P), variant: { color: 'Blue', size: 'M' } });
    const t2 = await M.VendorChatThread.findById(r2.data?.thread?._id).lean();
    check('Asking about another variant updates the same chat', r2.status === 200 && String(t2?._id) === String(t?._id) && t2?.productVariant === 'Color: Blue | Size: M', `${r2.status} "${t2?.productVariant}"`);
}

// 12. Super Admin sees all of a vendor's conversations
{
    const TSA = signAccessToken({ id: String(SA._id), role: 'superadmin', email: 'root@ple.test' });
    const r = await api(TSA, 'GET', `/admin/vendors/${VEND}/conversations`);
    const types = new Set((r.data?.items || []).map((i) => i.type));
    check('Vendor conversations include B2B RFQs and Source Now', r.status === 200 && types.has('b2b_rfq') && types.has('source_now'), `${r.status} ${[...types].join(',')}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
await mongoose.disconnect();
await mem.stop();
server.close();
process.exit(fail ? 1 : 0);
