// Usage (from /backend): node tests/sourceNowPaymentE2E.mjs
// Source Now: accepting a Final Proposal must create a proper order (GST split, vendor groups,
// address, atomic stock reservation) and start a Razorpay payment; the request is "Confirmed"
// only after the payment is verified. Also checks the hardened /payments/verify + /payments/retry.
// In-memory MongoDB; Razorpay is stubbed (signatures are real HMACs with a test secret).
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
process.env.MONGO_URI = mem.getUri('ple_source_now_pay');
Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', SMTP_USER: 'x', SMTP_PASS: 'x', FIREBASE_SERVICE_ACCOUNT: '', SHIPROCKET_EMAIL: '', SHIPROCKET_PASSWORD: '', NODE_ENV: 'development', RAZORPAY_KEY_ID: 'rzp_test_dummy', RAZORPAY_KEY_SECRET: 'test_secret_123' });
delete process.env.PLATFORM_GST_STATE;

const mongoose = (await import(pathToFileURL(reqB.resolve('mongoose')).href)).default;
const rzpSvc = await imp('services/razorpay.service.js');
let rzpSeq = 0;
let gatewayDown = false;
const createdRzp = [];
rzpSvc.__setRazorpayClientForTests({
    orders: {
        create: async (o) => {
            if (gatewayDown) throw { error: { description: 'stubbed gateway outage' } };
            const r = { id: `order_TEST${++rzpSeq}`, amount: o.amount, currency: o.currency };
            createdRzp.push({ ...r, receipt: o.receipt });
            return r;
        },
    },
    payments: { fetch: async (id) => ({ id, method: 'upi', bank: undefined }) },
});
const { default: app } = await imp('app.js');
const { signAccessToken } = await imp('config/jwt.js');
await mongoose.connect(process.env.MONGO_URI);
const server = http.createServer(app);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/api`;

const M = {};
for (const n of ['User', 'Vendor', 'ManagedShop', 'Product', 'Order', 'Invoice', 'ProductRequest', 'Address']) M[n] = (await imp(`models/${n}.model.js`)).default;

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
const sign = (orderId, paymentId) => crypto.createHmac('sha256', 'test_secret_123').update(`${orderId}|${paymentId}`).digest('hex');

// ── seed
const pw = '$2a$12$abcdefghijklmnopqrstuuDummyHashNotUsedForLoginxxxxxxxx';
const ins = async (Model, doc) => (await Model.collection.insertOne({ createdAt: new Date(), updatedAt: new Date(), ...doc })).insertedId;
const BUYER = await ins(M.User, { name: 'Bina Buyer', email: 'bina@example.com', password: pw, role: 'b2bAdmin', isActive: true, isVerified: true, phone: '9000000003', companyName: 'Bina Traders' });
const OTHER = await ins(M.User, { name: 'Other Buyer', email: 'other@example.com', password: pw, role: 'customer', isActive: true, isVerified: true, phone: '9000000004' });
const ADDR = await ins(M.Address, { userId: BUYER, name: 'Office', fullName: 'Bina Buyer', phone: '9000000003', address: '5 Brigade Rd', city: 'Bengaluru', state: 'Karnataka', zipCode: '560001', country: 'India', isDefault: true });
const OTHER_ADDR = await ins(M.Address, { userId: OTHER, name: 'Home', fullName: 'Other', phone: '9000000004', address: 'x', city: 'Pune', state: 'Maharashtra', zipCode: '411001', country: 'India' });
const VEND = await ins(M.Vendor, { name: 'Kumar', storeName: 'Kumar Cables', email: 'kumar@example.com', password: pw, status: 'approved', isVerified: true, isActive: true, gstNumber: '29ABCDE1234F1Z5', commissionRate: 10 });
const SHOP = await ins(M.ManagedShop, { name: 'PLE Shop', status: 'active', gst: '27ABCDE1234F1Z5' });
const mkProduct = (extra) => ins(M.Product, { price: 999, stock: 'in_stock', isActive: true, isVisible: true, approvalStatus: 'approved', gstMode: 'custom', gstRate: 18, taxIncluded: false, ...extra });
const P_V = await mkProduct({ name: 'Cable (USB-C) 2m', slug: 'cable-usbc-vendor', vendorId: VEND, stockQuantity: 50 });
const P_S = await mkProduct({ name: 'Cable (USB-C) 2m', slug: 'cable-usbc-shop', shopId: SHOP, listingType: 'admin_managed_listing', stockQuantity: 20 });
const mkRequest = (requestId, extra = {}) => ins(M.ProductRequest, {
    requestId, userId: BUYER, productName: 'Cable (USB-C) 2m', category: 'Accessories', quantity: 15, expectedBudget: 8000, status: 'Final Proposal',
    selectedFulfillment: { pleQuantity: 5, vendors: [{ vendorId: VEND, quantity: 10, price: 500 }], finalPrice: 400 },
    timeline: [], auditLog: [], ...extra,
});
await mkRequest('REQ-100001');

const T = signAccessToken({ id: String(BUYER), role: 'b2bAdmin', name: 'Bina Buyer', email: 'bina@example.com' });
const T2 = signAccessToken({ id: String(OTHER), role: 'customer', name: 'Other', email: 'other@example.com' });
const stock = async (id) => (await M.Product.findById(id).lean())?.stockQuantity;
console.log('In-memory DB ready.\n');

// 1. Validation
{
    const r = await api(T, 'POST', '/user/product-requests/REQ-100001/confirm', {});
    check('Confirm: address required', r.status === 400 && /address/i.test(r.body?.message), `${r.status} ${r.body?.message}`);
    const r2 = await api(T, 'POST', '/user/product-requests/REQ-100001/confirm', { addressId: String(OTHER_ADDR) });
    check("Confirm: can't use someone else's address", r2.status === 400, `${r2.status} ${r2.body?.message}`);
    const r3 = await api(T2, 'POST', '/user/product-requests/REQ-100001/confirm', { addressId: String(OTHER_ADDR) });
    check("Confirm: other user can't confirm my request", r3.status === 404, r3.status);
    check('Confirm: failed attempts reserved no stock', (await stock(P_V)) === 50 && (await stock(P_S)) === 20, [await stock(P_V), await stock(P_S)]);
    check('Confirm: failed attempts created no order', (await M.Order.countDocuments({})) === 0, await M.Order.countDocuments({}));
}

// 2. Accept proposal -> order + Razorpay order, NOT confirmed yet
let first;
{
    const r = await api(T, 'POST', '/user/product-requests/REQ-100001/confirm', { addressId: String(ADDR) });
    first = r.data;
    check('Confirm: 201 with razorpay order', r.status === 201 && r.data?.razorpayOrder?.id === 'order_TEST1', `${r.status} ${r.body?.message} ${JSON.stringify(r.data?.razorpayOrder)}`);
    const o = await M.Order.findOne({ orderId: r.data?.order?.orderId }).lean();
    // vendor: 10 x 500 = 5000, GST 900 (KA seller -> KA buyer: CGST 450 + SGST 450)
    // PLE shop: 5 x 400 = 2000, GST 360 (MH shop -> KA buyer: IGST 360)
    check('Order: subtotal 7000, GST 1260, total 8260', o?.subtotal === 7000 && o?.tax === 1260 && o?.total === 8260, [o?.subtotal, o?.tax, o?.total]);
    check('Razorpay amount = total in paise (826000)', r.data?.razorpayOrder?.amount === 826000 && r.data?.razorpayOrder?.key === 'rzp_test_dummy', r.data?.razorpayOrder);
    check('Order: GST split CGST 450 / SGST 450 / IGST 360', o?.taxBreakdown?.cgst === 450 && o?.taxBreakdown?.sgst === 450 && o?.taxBreakdown?.igst === 360, o?.taxBreakdown);
    check('Order: place of supply Karnataka', o?.placeOfSupply?.code === '29', o?.placeOfSupply);
    check('Order: two seller groups with names', o?.vendorItems?.length === 2 && o.vendorItems.some((v) => v.vendorName === 'Kumar Cables') && o.vendorItems.some((v) => v.vendorName === 'PLE Shop'), o?.vendorItems?.map((v) => v.vendorName));
    check('Order: shipping address from saved address', o?.shippingAddress?.city === 'Bengaluru' && o?.shippingAddress?.email === 'bina@example.com', o?.shippingAddress);
    check('Order: online payment pending (not "wallet")', o?.paymentMethod === 'card' && o?.paymentStatus === 'pending' && o?.paymentDetails?.razorpayOrderId === 'order_TEST1', [o?.paymentMethod, o?.paymentStatus, o?.paymentDetails?.razorpayOrderId]);
    check('Order: linked to request, type product_request', o?.orderType === 'product_request', o?.orderType);
    check('Stock reserved (50->40, 20->15)', (await stock(P_V)) === 40 && (await stock(P_S)) === 15, [await stock(P_V), await stock(P_S)]);
    const req = await M.ProductRequest.findOne({ requestId: 'REQ-100001' }).lean();
    check('Request: NOT confirmed until paid', req?.status === 'Final Proposal' && String(req?.associatedOrderId) === String(o?._id), [req?.status, String(req?.associatedOrderId)]);
    check('No invoice before payment', (await M.Invoice.countDocuments({ orderId: o?._id })) === 0, await M.Invoice.countDocuments({ orderId: o?._id }));
}

// 3. Retry (e.g. closed the payment window) re-uses the order
{
    const r = await api(T, 'POST', '/user/product-requests/REQ-100001/confirm', { addressId: String(ADDR) });
    check('Re-confirm: same order, fresh payment', r.status === 200 && r.data?.order?.orderId === first?.order?.orderId && r.data?.razorpayOrder?.id === 'order_TEST2', [r.status, r.data?.order?.orderId, r.data?.razorpayOrder?.id]);
    check('Re-confirm: stock not reserved twice', (await stock(P_V)) === 40 && (await stock(P_S)) === 15, [await stock(P_V), await stock(P_S)]);
    check('Re-confirm: still one order', (await M.Order.countDocuments({})) === 1, await M.Order.countDocuments({}));
}

// 4. Hardened verification
const orderId = first?.order?.orderId;
{
    const pay = 'pay_TESTok';
    const other = await api(T2, 'POST', '/user/payments/verify', { orderId, razorpay_order_id: 'order_TEST2', razorpay_payment_id: pay, razorpay_signature: sign('order_TEST2', pay) });
    check("Verify: another user can't touch my order", other.status === 404, other.status);
    const stale = await api(T, 'POST', '/user/payments/verify', { orderId, razorpay_order_id: 'order_TEST1', razorpay_payment_id: pay, razorpay_signature: sign('order_TEST1', pay) });
    check('Verify: payment for a different gateway order rejected', stale.status === 400 && /does not belong/i.test(stale.body?.message), `${stale.status} ${stale.body?.message}`);
    const bad = await api(T, 'POST', '/user/payments/verify', { orderId, razorpay_order_id: 'order_TEST2', razorpay_payment_id: pay, razorpay_signature: 'deadbeef' });
    check('Verify: bad signature rejected', bad.status === 400, `${bad.status} ${bad.body?.message}`);
    let req = await M.ProductRequest.findOne({ requestId: 'REQ-100001' }).lean();
    check('Request still not confirmed after failed verify', req?.status === 'Final Proposal', req?.status);

    // Retry after a failure creates a new gateway order on the same order
    const again = await api(T, 'POST', '/user/product-requests/REQ-100001/confirm', { addressId: String(ADDR) });
    const rzpId = again.data?.razorpayOrder?.id;
    check('Re-confirm after failed payment works', again.status === 200 && rzpId === 'order_TEST3', [again.status, rzpId, again.body?.message]);

    const ok = await api(T, 'POST', '/user/payments/verify', { orderId, razorpay_order_id: rzpId, razorpay_payment_id: pay, razorpay_signature: sign(rzpId, pay) });
    check('Verify: correct payment -> 200', ok.status === 200, `${ok.status} ${ok.body?.message}`);
    const o = await M.Order.findOne({ orderId }).lean();
    check('Order paid with payment details', o?.paymentStatus === 'paid' && o?.paymentDetails?.razorpayPaymentId === pay && o?.paymentDetails?.amount === 8260, [o?.paymentStatus, o?.paymentDetails?.razorpayPaymentId, o?.paymentDetails?.amount]);
    req = await M.ProductRequest.findOne({ requestId: 'REQ-100001' }).lean();
    check('Request Confirmed after payment', req?.status === 'Confirmed' && req.timeline.some((t) => t.status === 'Confirmed' && /Payment received/.test(t.comment)), [req?.status, req?.timeline?.map((t) => t.status)]);
    check('Invoice generated after payment', (await M.Invoice.countDocuments({ orderId: o?._id })) === 1, await M.Invoice.countDocuments({ orderId: o?._id }));

    const dup = await api(T, 'POST', '/user/payments/verify', { orderId, razorpay_order_id: rzpId, razorpay_payment_id: pay, razorpay_signature: sign(rzpId, pay) });
    check('Verify: double submit is idempotent (200)', dup.status === 200, `${dup.status} ${dup.body?.message}`);
    const dup2 = await api(T, 'POST', '/user/payments/verify', { orderId, razorpay_order_id: rzpId, razorpay_payment_id: 'pay_OTHER', razorpay_signature: sign(rzpId, 'pay_OTHER') });
    check('Verify: second, different payment on paid order rejected', dup2.status === 409, `${dup2.status} ${dup2.body?.message}`);
    const after = await api(T, 'POST', '/user/product-requests/REQ-100001/confirm', { addressId: String(ADDR) });
    check('Confirm after paid -> 400', after.status === 400 && /already confirmed/i.test(after.body?.message), `${after.status} ${after.body?.message}`);
    const retry = await api(T, 'POST', '/user/payments/retry', { orderId });
    check('Retry on paid order -> 400', retry.status === 400, retry.status);
    const retryOther = await api(T2, 'POST', '/user/payments/retry', { orderId });
    check("Retry: another user can't start a payment on my order", retryOther.status === 404, retryOther.status);
}

// 5. Stock ran out between proposal and acceptance -> clean failure, nothing reserved
{
    await mkRequest('REQ-100002', { selectedFulfillment: { pleQuantity: 0, vendors: [{ vendorId: VEND, quantity: 999, price: 500 }], finalPrice: 500 } });
    const before = [await stock(P_V), await M.Order.countDocuments({})];
    const r = await api(T, 'POST', '/user/product-requests/REQ-100002/confirm', { addressId: String(ADDR) });
    check('Insufficient stock -> 400', r.status === 400 && /insufficient/i.test(r.body?.message), `${r.status} ${r.body?.message}`);
    check('Insufficient stock: nothing reserved, no order', (await stock(P_V)) === before[0] && (await M.Order.countDocuments({})) === before[1], [await stock(P_V), await M.Order.countDocuments({})]);
}

// 6. Gateway down -> 502, no order / stock change; works once it is back
{
    await mkRequest('REQ-100003', { selectedFulfillment: { pleQuantity: 0, vendors: [{ vendorId: VEND, quantity: 2, price: 500 }], finalPrice: 500 } });
    const before = [await stock(P_V), await M.Order.countDocuments({})];
    gatewayDown = true;
    const r = await api(T, 'POST', '/user/product-requests/REQ-100003/confirm', { addressId: String(ADDR) });
    gatewayDown = false;
    check('Gateway down -> 502 with clear message', r.status === 502 && /payment/i.test(r.body?.message), `${r.status} ${r.body?.message}`);
    check('Gateway down: no order, no stock reserved', (await stock(P_V)) === before[0] && (await M.Order.countDocuments({})) === before[1], [await stock(P_V), await M.Order.countDocuments({})]);
    const ok = await api(T, 'POST', '/user/product-requests/REQ-100003/confirm', { shippingAddress: { address: '9 MG Rd', city: 'Mumbai', state: 'Maharashtra', zipCode: '400001' } });
    const o = await M.Order.findOne({ orderId: ok.data?.order?.orderId }).lean();
    check('Inline address works; KA seller -> MH buyer = IGST 180', ok.status === 201 && o?.taxBreakdown?.igst === 180 && o?.total === 1180, [ok.status, o?.taxBreakdown, o?.total]);
}

// 7. Over Razorpay's per-transaction limit -> clear 400, nothing reserved
{
    await M.Product.updateOne({ _id: P_V }, { $set: { stockQuantity: 5000 } });
    await mkRequest('REQ-100004', { selectedFulfillment: { pleQuantity: 0, vendors: [{ vendorId: VEND, quantity: 1000, price: 500 }], finalPrice: 500 } });
    const r = await api(T, 'POST', '/user/product-requests/REQ-100004/confirm', { addressId: String(ADDR) });
    check('Above ₹5,00,000 -> 400 limit message', r.status === 400 && /limit/i.test(r.body?.message), `${r.status} ${r.body?.message}`);
    check('Above limit: stock untouched', (await stock(P_V)) === 5000, await stock(P_V));
}

// 8. Regular checkout (non-Source-Now) online payment still works with the hardened verify
{
    const r = await api(T2, 'POST', '/user/orders', { items: [{ productId: String(P_V), quantity: 1 }], shippingAddress: { name: 'Other', email: 'other@example.com', phone: '9000000004', address: 'x', city: 'Pune', state: 'Maharashtra', zipCode: '411001', country: 'India' }, paymentMethod: 'card' });
    const o = await M.Order.findOne({ userId: OTHER }).sort({ createdAt: -1 }).lean();
    const rzpId = o?.paymentDetails?.razorpayOrderId;
    check('Checkout: card order gets a Razorpay order', r.status < 300 && /^order_TEST/.test(rzpId || '') && o?.paymentStatus === 'pending', [r.status, r.body?.message, rzpId, o?.paymentStatus]);
    const mine = await api(T, 'POST', '/user/payments/verify', { orderId: o?.orderId, razorpay_order_id: rzpId, razorpay_payment_id: 'pay_C1', razorpay_signature: sign(rzpId, 'pay_C1') });
    check("Checkout: someone else can't verify it", mine.status === 404, mine.status);
    const ok = await api(T2, 'POST', '/user/payments/verify', { orderId: o?.orderId, razorpay_order_id: rzpId, razorpay_payment_id: 'pay_C1', razorpay_signature: sign(rzpId, 'pay_C1') });
    const paid = await M.Order.findById(o?._id).lean();
    check('Checkout: owner verifies -> paid', ok.status === 200 && paid?.paymentStatus === 'paid', [ok.status, ok.body?.message, paid?.paymentStatus]);
}

console.log(`\n${pass} passed, ${fail} failed`);
server.close();
await mongoose.disconnect();
await mem.stop();
process.exit(fail ? 1 : 0);
