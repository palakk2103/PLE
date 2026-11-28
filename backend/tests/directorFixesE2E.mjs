// Usage (from /backend): node tests/directorFixesE2E.mjs
// Fixes from the Director's 27 Nov 2026 report and the follow-up audit: payment safety, abandoned
// payments, test OTPs, campaigns, B2B application status, company deactivation, Source Now.
// In-memory MongoDB; Razorpay stubbed; email, push and courier disabled.
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
process.env.MONGO_URI = mem.getUri('ple_director_fixes');
Object.assign(process.env, {
    SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', SMTP_USER: 'x', SMTP_PASS: 'x', FIREBASE_SERVICE_ACCOUNT: '',
    SHIPROCKET_EMAIL: '', SHIPROCKET_PASSWORD: '', NODE_ENV: 'development', ALLOW_DEV_OTP: '',
    RAZORPAY_KEY_ID: 'rzp_test_dummy', RAZORPAY_KEY_SECRET: 'testsecret',
});

const mongoose = (await import(pathToFileURL(reqB.resolve('mongoose')).href)).default;
const rzpSvc = await imp('services/razorpay.service.js');
const rzpOrders = new Map();
let seq = 0;
rzpSvc.__setRazorpayClientForTests({
    orders: {
        create: async (o) => { const id = `order_D${++seq}`; rzpOrders.set(id, { id, ...o, status: 'created', amount_paid: 0 }); return { id, amount: o.amount, currency: 'INR' }; },
        fetch: async (id) => { const o = rzpOrders.get(id); if (!o) throw new Error('not found'); return o; },
    },
    payments: { fetch: async () => null },
});
const { default: app } = await imp('app.js');
const { signAccessToken } = await imp('config/jwt.js');
const { releaseAbandonedPayments } = await imp('services/abandonedPayment.service.js');
const { isDevOtpAllowed } = await imp('utils/devOtp.js');
const { validateV2Registration } = await imp('services/b2bRegistration.service.js');
await mongoose.connect(process.env.MONGO_URI);
const server = http.createServer(app);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/api`;

const M = {};
for (const n of ['User', 'Vendor', 'Product', 'Order', 'B2BCompany', 'ProductRequest', 'Campaign', 'Wallet']) M[n] = (await imp(`models/${n}.model.js`)).default;

let pass = 0, fail = 0;
const check = (name, cond, actual) => {
    cond ? pass++ : fail++;
    console.log(`${cond ? '✅' : '❌'} ${name} → ${typeof actual === 'string' ? actual : JSON.stringify(actual)}`);
};
const api = async (token, method, p, body, headers = {}) => {
    const res = await fetch(BASE + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
    let json = null;
    try { json = await res.json(); } catch { /* none */ }
    return { status: res.status, body: json, data: json?.data, message: json?.message };
};
const sign = (orderId, paymentId) => crypto.createHmac('sha256', 'testsecret').update(`${orderId}|${paymentId}`).digest('hex');
const ins = async (Model, doc) => (await Model.collection.insertOne({ createdAt: new Date(), updatedAt: new Date(), ...doc })).insertedId;

// ── seed
const pw = 'x';
const COMPANY = await ins(M.B2BCompany, { companyName: 'Acme', businessEmail: 'acme@example.com', verificationStatus: 'Approved', status: 'Active' });
const BUYER = await ins(M.User, { name: 'Asha', email: 'asha@example.com', password: pw, role: 'b2bAdmin', companyId: COMPANY, isActive: true, isVerified: true, phone: '9000000010' });
const CUST = await ins(M.User, { name: 'Cara', email: 'cara@example.com', password: pw, role: 'customer', isActive: true, isVerified: false, phone: '9000000012', otp: '999111', otpExpiry: new Date(Date.now() + 600000) });
await ins(M.Wallet, { userId: BUYER, balance: 500, totalCredit: 500, totalDebit: 0, isFrozen: false });
const VEND = await ins(M.Vendor, { name: 'V', storeName: 'Volt', email: 'volt@example.com', password: pw, status: 'approved', isVerified: true, isActive: true, gstNumber: '27ABCDE1234F1Z5', shippingEnabled: false });
const VEND_PENDING = await ins(M.Vendor, { name: 'P', storeName: 'Pending Co', email: 'pend@example.com', password: pw, status: 'pending', isVerified: true });
const PRODUCT = await ins(M.Product, { name: 'Chair', slug: 'chair', price: 1000, stockQuantity: 100, stock: 'in_stock', lowStockThreshold: 5, isActive: true, isVisible: true, approvalStatus: 'approved', gstMode: 'custom', gstRate: 18, vendorId: VEND, listingType: 'vendor_direct' });

const buyer = signAccessToken({ id: String(BUYER), role: 'b2bAdmin', email: 'asha@example.com', companyId: String(COMPANY) });
const addr = { name: 'Asha', email: 'asha@example.com', phone: '9000000010', address: '1 Rd', city: 'Pune', state: 'Maharashtra', zipCode: '411001', country: 'India' };
const place = (paymentMethod, walletAmountToUse = 0) => api(buyer, 'POST', '/user/orders', { items: [{ productId: String(PRODUCT), quantity: 1 }], shippingAddress: addr, paymentMethod, walletAmountToUse, shippingOption: 'standard' });
const stock = async () => (await M.Product.findById(PRODUCT).lean()).stockQuantity;
const walletBalance = async () => (await M.Wallet.findOne({ userId: BUYER }).lean()).balance;
const latest = () => M.Order.findOne({ userId: BUYER }).sort({ _id: -1 }).lean();

// ── payment methods
for (const m of ['upi', 'bank']) {
    const r = await place(m);
    check(`"${m}" without a payment step is rejected`, r.status === 400, [r.status, r.message]);
}
let r = await place('cod', 100);
check('Wallet + Cash on Delivery is rejected, wallet untouched', r.status === 400 && (await walletBalance()) === 500 && (await stock()) === 100, [r.status, r.message]);

r = await place('card', 200);
let o = await latest();
const charged = rzpOrders.get(o?.paymentDetails?.razorpayOrderId)?.amount;
check('Wallet + "card": gateway charges only the remainder', r.status === 201 && o.paymentMethod === 'mixed' && Number(charged) === Math.round((o.total - 200) * 100), { method: o?.paymentMethod, total: o?.total, charged });

// ── payment arriving for a cancelled order
await place('card');
o = await latest();
await api(buyer, 'PATCH', `/user/orders/${o.orderId}/cancel`, { reason: 'changed my mind' });
const payId = 'pay_late_1';
r = await api(buyer, 'POST', '/user/payments/verify', { orderId: o.orderId, razorpay_order_id: o.paymentDetails.razorpayOrderId, razorpay_payment_id: payId, razorpay_signature: sign(o.paymentDetails.razorpayOrderId, payId) });
let after = await M.Order.findById(o._id).lean();
check('Payment for a cancelled order is not accepted', r.status === 409 && after.status === 'cancelled' && after.paymentStatus !== 'pending', [r.status, r.message, after.paymentStatus]);
check('...and the money is refunded', after.paymentStatus === 'refunded', after.refundDetails);

// ── abandoned online payments
const before = await stock();
await place('card');
const stale = await latest();
await place('card', 100);
const staleMixed = await latest();
await place('card');
const paidAtGateway = await latest();
await place('cod');
const codOrder = await latest();
rzpOrders.get(paidAtGateway.paymentDetails.razorpayOrderId).amount_paid = 100;
const walletBeforeRelease = await walletBalance();
let run = await releaseAbandonedPayments();
check('A recent unpaid order is left alone', run.released === 0, run);
const later = new Date(Date.now() + 40 * 60 * 1000);
// earlier unpaid order from the wallet + card check is also due
const dueExpected = await M.Order.countDocuments({ status: 'pending', paymentStatus: 'pending', paymentMethod: { $in: ['card', 'mixed'] } });
run = await releaseAbandonedPayments({ now: later });
const statusOf = async (x) => (await M.Order.findById(x._id).lean()).status;
check('Unpaid online orders are cancelled after the timeout', (await statusOf(stale)) === 'cancelled' && (await statusOf(staleMixed)) === 'cancelled' && run.released === dueExpected - 1, { run, dueExpected });
check('An order with money at the gateway is NOT released', (await statusOf(paidAtGateway)) === 'pending', await statusOf(paidAtGateway));
check('Cash on Delivery orders are never released', (await statusOf(codOrder)) === 'pending', await statusOf(codOrder));
check('Stock comes back (only the paid-at-gateway and COD units stay reserved)', (await stock()) === before + 1 - 2, { before, now: await stock() });
check('Wallet money used on released orders is returned', (await walletBalance()) === walletBeforeRelease + 300, { walletBeforeRelease, now: await walletBalance() });
run = await releaseAbandonedPayments({ now: later });
check('Running again changes nothing', run.released === 0, run);

// ── fixed test OTP
check('Dev OTP is off unless switched on', isDevOtpAllowed() === false, isDevOtpAllowed());
r = await api(null, 'POST', '/user/auth/verify-otp', { email: 'cara@example.com', otp: '123456' });
check('123456 does not sign in a customer on a "development" server', r.status === 400 && !r.data?.accessToken, [r.status, r.message]);
process.env.ALLOW_DEV_OTP = 'true';
process.env.NODE_ENV = 'production';
check('Dev OTP stays off in production even if switched on', isDevOtpAllowed() === false, isDevOtpAllowed());
process.env.NODE_ENV = 'development';
process.env.ALLOW_DEV_OTP = '';

// ── campaigns
await ins(M.Campaign, { name: 'Old deal', slug: 'old', type: 'daily_deal', isActive: true, startDate: new Date('2020-01-01'), endDate: new Date('2020-01-02') });
await ins(M.Campaign, { name: 'Fest', slug: 'fest', type: 'festival', isActive: true });
await ins(M.Campaign, { name: 'Live deal', slug: 'live', type: 'daily_deal', isActive: true });
r = await api(null, 'GET', '/campaigns?type=daily_deal');
check('Campaign list filters by type and hides ended campaigns', r.data?.map((c) => c.slug).join() === 'live', r.data?.map((c) => c.slug));

// ── registration number
const errs = validateV2Registration({ companyData: { companyRegistrationNumber: '  ' } });
check('Company Registration Number is required by the server', JSON.stringify(errs).includes('companyRegistrationNumber'), 'validated');

// ── Source Now
const body = { productName: 'Projector', category: 'Electronics', quantity: 2, expectedBudget: 5000, description: 'HD' };
const [a, b] = await Promise.all([api(buyer, 'POST', '/user/product-requests', body), api(buyer, 'POST', '/user/product-requests', body)]);
const c = await api(buyer, 'POST', '/user/product-requests', { ...body, productName: ' projector ' });
check('Double submit creates only one request', (await M.ProductRequest.countDocuments({ userId: BUYER })) === 1, [a.status, b.status, c.status]);
r = await api(buyer, 'POST', '/user/product-requests', { ...body, quantity: 3 });
check('A different request is still accepted', r.status === 201, r.status);
r = await api(buyer, 'POST', '/user/product-requests', { ...body, productName: 'Speaker', requestType: 'SHOP_SPECIFIC', targetEntityType: 'Vendor', targetEntityId: String(VEND_PENDING) });
check('A pending vendor cannot be targeted', r.status === 400, [r.status, r.message]);

// ── B2B application status
const mkCompany = async (email, verificationStatus) => {
    const company = await ins(M.B2BCompany, { companyName: email, businessEmail: email, businessPhone: '9000000020', companyAddress: 'x', companyType: 'Other', gstRegistered: false, ownerSecretKey: 'x', verificationStatus, status: 'Active', bankDetails: { accountNumber: '123456789012', bankName: 'HDFC' }, addressProof: { url: 'https://cdn.example.com/a.pdf', fileName: 'a.pdf' } });
    await M.User.create({ name: 'Owner', email, password: 'Owner#Pass1', role: 'b2bAdmin', companyId: company, isActive: true, isVerified: true, phone: `90000${Math.floor(10000 + Math.random() * 89999)}` });
    return company;
};
const PENDING = await mkCompany('pending@example.com', 'Pending Verification');
const login = (email, password = 'Owner#Pass1') => api(null, 'POST', '/b2b-user/auth/login', { businessEmail: email, password });
r = await login('pending@example.com', 'wrong-password');
check('Wrong password gives no application details', r.status === 401 && !r.data, [r.status, r.message]);
r = await login('pending@example.com');
const appToken = r.data?.applicationToken;
check('Pending company gets a clear status and an application token', r.status === 403 && r.data?.applicationStatus === 'Pending Verification' && !!appToken, [r.status, r.message]);
const H = { 'x-application-token': appToken };
r = await api(null, 'GET', '/b2b-user/auth/application', null, H);
check('Applicant sees the submitted details, bank number masked', r.status === 200 && r.data?.details?.bank === 'HDFC ****9012' && !JSON.stringify(r.data).includes('123456789012') && r.data?.documents?.[0]?.state === 'received', r.data?.details);
r = await api(appToken, 'GET', '/user/orders');
check('The application token is not a login token', r.status === 401, r.status);
r = await api(null, 'GET', '/b2b-user/auth/application', null, { 'x-application-token': buyer });
check('A login token is not an application token', r.status === 401, r.status);
r = await api(null, 'POST', '/b2b-user/auth/application/messages', { message: 'Which document is wrong?' }, H);
check('Applicant can send a message', r.status === 201 && r.data?.length === 1, [r.status, r.message]);

const Admin = (await imp('models/Admin.model.js')).default;
const ADMIN = await ins(Admin, { name: 'Root', email: 'root@example.com', password: pw, role: 'superadmin', isActive: true, status: 'active' });
const admin = signAccessToken({ id: String(ADMIN), role: 'superadmin', email: 'root@example.com' });
r = await api(admin, 'POST', `/admin/b2b-users/${PENDING}/messages`, { message: 'Please re-send the address proof.' });
check('Admin can reply', r.status === 201 && r.data?.length === 2, [r.status, r.message]);
r = await api(admin, 'PATCH', `/admin/b2b-users/${PENDING}/status`, { status: 'rejected', reason: 'Address proof unreadable' });
r = await login('pending@example.com');
const view = await api(null, 'GET', '/b2b-user/auth/application', null, { 'x-application-token': r.data?.applicationToken });
check('Rejected applicant sees the reason and the conversation', view.data?.status === 'Rejected' && view.data?.reason === 'Address proof unreadable' && view.data?.messages?.length === 2, [view.data?.status, view.data?.reason]);

// ── company deactivation
await mkCompany('live@example.com', 'Approved');
r = await login('live@example.com');
const liveToken = r.data?.accessToken;
const liveRefresh = r.data?.refreshToken;
check('Approved company can sign in', r.status === 200 && !!liveToken, [r.status, r.message]);
const LIVE = (await M.B2BCompany.findOne({ businessEmail: 'live@example.com' }).lean())._id;
await api(admin, 'PATCH', `/admin/b2b-users/${LIVE}/status`, { status: 'inactive', reason: 'Unpaid dues' });
r = await login('live@example.com');
check('Deactivated company cannot sign in and gets the status page', r.status === 403 && r.data?.applicationStatus === 'Deactivated', [r.status, r.message]);
r = await api(liveToken, 'GET', '/user/orders');
check('Deactivated company loses its existing session', r.status === 403, [r.status, r.message]);
r = await api(null, 'POST', '/b2b-user/auth/refresh', { refreshToken: liveRefresh });
check('...and cannot refresh it', r.status === 403, r.status);

// ── RFQ: purchase order GST and vendor privacy
const { quotationPricing } = await imp('utils/quoteTax.js');
const { toVendorRfqView } = await imp('modules/vendor/controllers/vendorRfq.controller.js');
const { toDeliveryDate } = await imp('utils/deliveryEstimate.js');
let q = quotationPricing({ quotedTotal: 207500, taxDetails: '18% GST extra' });
check('"18% GST extra" is 18 percent, not Rs.18', q.tax === 37350 && q.total === 244850, q);
q = quotationPricing({ quotedTotal: 118, taxDetails: '18% GST extra', product: { gstMode: 'custom', gstRate: 5 } });
check('A catalogue product uses its own GST rate', q.tax === 5.9 && q.total === 123.9, q);
q = quotationPricing({ quotedTotal: 118, taxDetails: 'Inclusive of 18% GST' });
check('An inclusive price is not taxed twice', q.tax === 18 && q.total === 118 && q.subtotal === 100, q);
q = quotationPricing({ quotedTotal: 500, taxDetails: '' });
check('No tax text keeps the agreed amount', q.tax === 0 && q.total === 500, q);
const vendorView = toVendorRfqView({ quotations: [{ vendorId: 'a', vendorName: 'Mine' }, { vendorId: 'b', vendorName: 'Rival' }], approvalHistory: [
    { action: 'Vendor Quotation Submitted', updatedBy: 'b', notes: 'Vendor Rival submitted quotation of Rs. 999' },
    { action: 'Vendor Quotation Selected', updatedBy: 'adm', notes: 'Selected quotation from vendor Rival (Total: Rs. 999)' },
    { action: 'Sent for B2B Approval', updatedBy: 'adm', notes: 'Vendor Rival quotation sent' },
    { action: 'Vendor Quotation Submitted', updatedBy: 'a', notes: 'Vendor Mine submitted quotation of Rs. 100' },
] }, 'a');
check('A vendor never sees a rival name or price in the RFQ history', !/Rival|999/.test(JSON.stringify(vendorView)) && JSON.stringify(vendorView).includes('Rs. 100'), vendorView.approvalHistory);
check('Free-text delivery estimates do not become invalid dates', toDeliveryDate('3-5 business days') === undefined && toDeliveryDate('10 days') === undefined && toDeliveryDate('2027-01-05') instanceof Date, 'ok');

console.log(`\n${pass} passed, ${fail} failed`);
server.close();
await mongoose.disconnect();
await mem.stop();
process.exit(fail ? 1 : 0);
