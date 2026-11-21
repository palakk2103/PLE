// Usage (from /backend): node tests/gstOrderE2E.mjs
// End-to-end: place real orders through the API (in-memory MongoDB) and check that
// CGST+SGST / IGST is decided by seller state vs delivery state on the order, the
// checkout estimate, the invoice JSON and the invoice PDF. Never touches Atlas / email / push.
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
process.env.MONGO_URI = mem.getUri('ple_gst_e2e');
process.env.SMTP_HOST = '127.0.0.1';
process.env.SMTP_PORT = '1';
process.env.SMTP_USER = 'nobody';
process.env.SMTP_PASS = 'nobody';
process.env.FIREBASE_SERVICE_ACCOUNT = '';
process.env.SHIPROCKET_EMAIL = '';
process.env.SHIPROCKET_PASSWORD = '';
process.env.NODE_ENV = 'development';
delete process.env.PLATFORM_GST_STATE;

const mongoose = (await import(pathToFileURL(reqB.resolve('mongoose')).href)).default;
const { default: app } = await imp('app.js');
const { signAccessToken } = await imp('config/jwt.js');
await mongoose.connect(process.env.MONGO_URI);
const server = http.createServer(app);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/api`;

const M = {};
for (const n of ['User', 'Vendor', 'ManagedShop', 'Product', 'Order', 'Invoice', 'Coupon']) M[n] = (await imp(`models/${n}.model.js`)).default;

let pass = 0, fail = 0;
const check = (name, cond, actual) => {
    cond ? pass++ : fail++;
    console.log(`${cond ? '✅' : '❌'} ${name} → ${typeof actual === 'string' ? actual : JSON.stringify(actual)}`);
};
const api = async (token, method, p, body, raw = false) => {
    const res = await fetch(BASE + p, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (raw) return { status: res.status, buf: Buffer.from(await res.arrayBuffer()) };
    let json = null;
    try { json = await res.json(); } catch { /* none */ }
    return { status: res.status, body: json, data: json?.data };
};

// ── seed
const pw = '$2a$12$abcdefghijklmnopqrstuuDummyHashNotUsedForLoginxxxxxxxx';
const CUST = (await M.User.collection.insertOne({ name: 'Gst Buyer', email: 'gstbuyer@example.com', password: pw, role: 'customer', isActive: true, isVerified: true, phone: '9000000000', createdAt: new Date() })).insertedId;
const mkVendor = async (name, extra) => (await M.Vendor.collection.insertOne({ name, storeName: name, email: `${name.replace(/\s/g, '').toLowerCase()}@e2e.test`, password: pw, status: 'approved', isVerified: true, isActive: true, defaultGstRate: 18, shippingEnabled: false, createdAt: new Date(), ...extra })).insertedId;
const V_MH = await mkVendor('Mumbai Seller', { gstNumber: '27ABCDE1234F1Z5', address: { state: 'Karnataka' } }); // GSTIN wins
const V_KA = await mkVendor('Bengaluru Seller', { state: 'Karnataka' });
const V_NONE = await mkVendor('Stateless Seller', {});
const SHOP = (await M.ManagedShop.collection.insertOne({ name: 'PLE Store', status: 'active', gst: '29ABCDE1234F1Z5', address: 'Whitefield, Bengaluru', createdAt: new Date() })).insertedId;

const mkProduct = async (name, extra) => (await M.Product.collection.insertOne({ name, slug: name.toLowerCase().replace(/\s/g, '-'), price: 1000, stockQuantity: 100, stock: 'in_stock', isActive: true, isVisible: true, approvalStatus: 'approved', gstMode: 'custom', gstRate: 18, taxIncluded: false, createdAt: new Date(), ...extra })).insertedId;
const P_MH = await mkProduct('MH Phone', { vendorId: V_MH, listingType: 'vendor_direct' });
const P_KA = await mkProduct('KA Phone', { vendorId: V_KA, listingType: 'vendor_direct' });
const P_NONE = await mkProduct('Unknown Phone', { vendorId: V_NONE, listingType: 'vendor_direct' });
const P_SHOP = await mkProduct('Shop Phone', { shopId: SHOP, listingType: 'admin_managed_listing', vendorId: V_KA });

const T = signAccessToken({ id: String(CUST), role: 'customer', name: 'Gst Buyer', email: 'gstbuyer@example.com' });
const addr = (state) => ({ name: 'Gst Buyer', email: 'gstbuyer@example.com', phone: '9000000000', address: '1 Test Street', city: 'X', state, zipCode: '560001', country: 'India' });
const order = async (productIds, state, couponCode) => {
    const r = await api(T, 'POST', '/user/orders', { items: productIds.map((productId) => ({ productId: String(productId), quantity: 1 })), shippingAddress: addr(state), paymentMethod: 'cod', ...(couponCode ? { couponCode } : {}) });
    if (r.status >= 300) return { error: `${r.status} ${r.body?.message} ${JSON.stringify(r.body?.errors || '')}` };
    return M.Order.findOne({ userId: CUST }).sort({ createdAt: -1, _id: -1 }).lean();
};

console.log('In-memory DB ready.\n');

// 1. Intra-state: Karnataka seller -> Karnataka buyer
{
    const o = await order([P_KA], 'Karnataka');
    const it = o?.items?.[0];
    check('Intra-state order placed', !!it, o?.error || o?.orderId);
    check('Intra: supplyType INTRA_STATE', it?.supplyType === 'INTRA_STATE', it?.supplyType);
    check('Intra: CGST 90 + SGST 90 on ₹1000 @18%', it?.cgstAmount === 90 && it?.sgstAmount === 90 && it?.igstAmount === 0, [it?.cgstAmount, it?.sgstAmount, it?.igstAmount]);
    check('Intra: total tax unchanged (180)', o?.tax === 180, o?.tax);
    check('Intra: order taxBreakdown', o?.taxBreakdown?.cgst === 90 && o?.taxBreakdown?.sgst === 90, o?.taxBreakdown);
    check('Intra: place of supply stored', o?.placeOfSupply?.code === '29', o?.placeOfSupply);
    check('Intra: vendor group carries seller state', o?.vendorItems?.[0]?.sellerStateCode === '29', o?.vendorItems?.[0]?.sellerState);

    const inv = await api(T, 'GET', `/user/orders/${o.orderId}/invoice`);
    check('Intra: invoice fetched', inv.status === 200, inv.status);
    check('Intra: invoice line split', inv.data?.items?.[0]?.cgstAmount === 90 && inv.data?.items?.[0]?.sgstAmount === 90, inv.data?.items?.[0]);
    check('Intra: invoice summary split', inv.data?.financialSummary?.cgst === 90 && inv.data?.financialSummary?.sgst === 90 && inv.data?.financialSummary?.igst === 0, inv.data?.financialSummary);
    check('Intra: customer sees seller supply type', inv.data?.sellers?.[0]?.supplyType === 'INTRA_STATE', inv.data?.sellers?.[0]);
    check('Intra: customer invoice still hides commission', inv.data?.financialSummary?.totalPlatformCommission === undefined, 'hidden');

    const pdf = await api(T, 'GET', `/user/orders/${o.orderId}/invoice/pdf`, null, true);
    check('Intra: invoice PDF downloads', pdf.status === 200 && pdf.buf.slice(0, 4).toString() === '%PDF', `${pdf.status} ${pdf.buf.length} bytes`);
}

// 2. Inter-state: Maharashtra seller (by GSTIN) -> Karnataka buyer
{
    const o = await order([P_MH], 'Karnataka');
    const it = o?.items?.[0];
    check('Inter: GSTIN beats pickup address (seller = MH)', o?.vendorItems?.[0]?.sellerStateCode === '27', o?.vendorItems?.[0]?.sellerState);
    check('Inter: supplyType INTER_STATE', it?.supplyType === 'INTER_STATE', it?.supplyType);
    check('Inter: IGST 180', it?.igstAmount === 180 && it?.cgstAmount === 0 && it?.sgstAmount === 0, [it?.cgstAmount, it?.sgstAmount, it?.igstAmount]);
    const inv = await api(T, 'GET', `/user/orders/${o.orderId}/invoice`);
    check('Inter: invoice IGST', inv.data?.financialSummary?.igst === 180, inv.data?.financialSummary);
}

// 3. Mixed cart: one intra, one inter, one admin-managed shop (KA by GSTIN), buyer in Karnataka
{
    const o = await order([P_KA, P_MH, P_SHOP], 'karnataka');
    check('Mixed: lowercase state accepted', o?.placeOfSupply?.code === '29', o?.placeOfSupply || o?.error);
    check('Mixed: totals CGST 180 / SGST 180 / IGST 180', o?.taxBreakdown?.cgst === 180 && o?.taxBreakdown?.sgst === 180 && o?.taxBreakdown?.igst === 180, o?.taxBreakdown);
    check('Mixed: total tax 540 = sum of splits', o?.tax === 540, o?.tax);
    const shopLine = o?.items?.find((i) => String(i.productId) === String(P_SHOP));
    check('Mixed: managed shop resolved from its GSTIN -> INTRA', shopLine?.supplyType === 'INTRA_STATE', shopLine?.supplyType);
    const inv = await api(T, 'GET', `/user/orders/${o.orderId}/invoice`);
    const shopSeller = inv.data?.sellers?.find((s) => s.storeName === 'PLE Store');
    check('Mixed: managed shop named on invoice (not "Vendor Store")', !!shopSeller, inv.data?.sellers?.map((s) => s.storeName));
}

// 4. Seller with no state data -> GST shown unsplit, totals intact
{
    const o = await order([P_NONE], 'Karnataka');
    const it = o?.items?.[0];
    check('Unknown seller: supplyType UNKNOWN', it?.supplyType === 'UNKNOWN', it?.supplyType);
    check('Unknown seller: tax still charged in full', o?.tax === 180 && o?.taxBreakdown?.unsplit === 180, [o?.tax, o?.taxBreakdown]);
    const inv = await api(T, 'GET', `/user/orders/${o.orderId}/invoice`);
    check('Unknown seller: invoice keeps GST as unsplit', inv.data?.financialSummary?.unsplitGst === 180, inv.data?.financialSummary);
}

// 5. Old order (placed before this feature, no split stored) -> invoice backfills
{
    const o = await order([P_KA], 'Karnataka');
    await M.Order.updateOne({ _id: o._id }, { $unset: { 'items.$[].supplyType': 1, 'items.$[].cgstAmount': 1, 'items.$[].sgstAmount': 1, 'items.$[].igstAmount': 1, taxBreakdown: 1, placeOfSupply: 1 } });
    await M.Invoice.deleteOne({ orderId: o._id });
    const inv = await api(T, 'GET', `/user/orders/${o.orderId}/invoice`);
    check('Legacy order: invoice derives split from addresses', inv.data?.financialSummary?.cgst === 90 && inv.data?.financialSummary?.sgst === 90, inv.data?.financialSummary);

    // Pre-existing invoice without split → lazy backfill on regeneration path
    await M.Invoice.updateOne({ orderId: o._id }, { $unset: { 'items.$[].supplyType': 1, 'items.$[].cgstAmount': 1, 'items.$[].sgstAmount': 1, 'financialSummary.cgst': 1, 'financialSummary.sgst': 1 } });
    const { generateInvoiceForOrder } = await imp('services/invoice.service.js');
    await generateInvoiceForOrder(String(o._id));
    const after = await M.Invoice.findOne({ orderId: o._id }).lean();
    check('Legacy invoice: split backfilled in place', after?.items?.[0]?.supplyType === 'INTRA_STATE' && after?.financialSummary?.cgst === 90, [after?.items?.[0]?.supplyType, after?.financialSummary?.cgst]);
}

// 6. Checkout estimate exposes the split before ordering
{
    const r = await api(null, 'POST', '/shipping/estimate', { items: [{ productId: String(P_KA), quantity: 1 }, { productId: String(P_MH), quantity: 1 }], shippingAddress: { state: 'Karnataka', zipCode: '560001' } });
    const g = r.data?.gst;
    check('Estimate: place of supply', g?.placeOfSupply?.code === '29', g?.placeOfSupply || `${r.status} ${r.body?.message}`);
    check('Estimate: KA product INTRA', g?.byProduct?.[String(P_KA)]?.supplyType === 'INTRA_STATE', g?.byProduct?.[String(P_KA)]);
    check('Estimate: MH product INTER', g?.byProduct?.[String(P_MH)]?.supplyType === 'INTER_STATE', g?.byProduct?.[String(P_MH)]);
    const r2 = await api(null, 'POST', '/shipping/estimate', { items: [{ productId: String(P_KA), quantity: 1 }], shippingAddress: {} });
    check('Estimate: no address -> UNKNOWN (no crash)', r2.data?.gst?.byProduct?.[String(P_KA)]?.supplyType === 'UNKNOWN', r2.data?.gst);
}

// 7. Coupon: GST is charged on the value AFTER the coupon (Sec. 15(3) CGST Act)
{
    await M.Coupon.create({ code: 'TENOFF', type: 'percentage', value: 10, isActive: true });
    await M.Coupon.create({ code: 'BIGFLAT', type: 'fixed', value: 5000, isActive: true });
    await M.Coupon.create({ code: 'ODD', type: 'fixed', value: 100, isActive: true });

    // KA (intra) Rs.1000 + MH (inter) Rs.1000, buyer in Karnataka, 10% coupon = Rs.200 -> Rs.100 per line
    const o = await order([P_KA, P_MH], 'Karnataka', 'TENOFF');
    check('Coupon: order placed', !!o?.items, o?.error || o?.orderId);
    const ka = o?.items?.find((i) => String(i.productId) === String(P_KA));
    const mh = o?.items?.find((i) => String(i.productId) === String(P_MH));
    check('Coupon: discount spread per line (100 + 100)', ka?.discount === 100 && mh?.discount === 100, [ka?.discount, mh?.discount]);
    check('Coupon: taxable value is post-coupon (900)', ka?.taxableAmount === 900 && mh?.taxableAmount === 900, [ka?.taxableAmount, mh?.taxableAmount]);
    check('Coupon: GST 162 per line (18% of 900)', ka?.gstAmount === 162 && mh?.gstAmount === 162, [ka?.gstAmount, mh?.gstAmount]);
    check('Coupon: split follows reduced GST (CGST 81 / SGST 81 / IGST 162)', ka?.cgstAmount === 81 && ka?.sgstAmount === 81 && mh?.igstAmount === 162, [ka?.cgstAmount, ka?.sgstAmount, mh?.igstAmount]);
    check('Coupon: order tax 324 and taxBreakdown agrees', o?.tax === 324 && o?.taxBreakdown?.cgst + o?.taxBreakdown?.sgst + o?.taxBreakdown?.igst === 324, [o?.tax, o?.taxBreakdown]);
    check('Coupon: total = 2000 - 200 + 324 = 2124', o?.total === 2124, o?.total);
    const vKA = o?.vendorItems?.find((v) => String(v.vendorId) === String(V_KA));
    check('Coupon: vendor group carries its coupon share + reduced tax', vKA?.discount === 100 && vKA?.tax === 162, [vKA?.discount, vKA?.tax]);
    const inv = await api(T, 'GET', `/user/orders/${o.orderId}/invoice`);
    const fs = inv.data?.financialSummary;
    check('Coupon: invoice tax 324, discount 200, total 2124', fs?.tax === 324 && fs?.discount === 200 && fs?.grandTotal === 2124, fs && { tax: fs.tax, discount: fs.discount, grandTotal: fs.grandTotal });
    const pdf = await api(T, 'GET', `/user/orders/${o.orderId}/invoice/pdf`, null, true);
    check('Coupon: invoice PDF renders', pdf.status === 200 && pdf.buf.slice(0, 4).toString() === '%PDF', `${pdf.status} ${pdf.buf.length} bytes`);

    // Rs.100 fixed over 3 lines -> 33.33 + 33.33 + 33.34 (rounding remainder on the last line)
    const o3 = await order([P_KA, P_MH, P_NONE], 'Karnataka', 'ODD');
    const shares = (o3?.items || []).map((i) => i.discount);
    check('Coupon: Rs.100 over 3 lines sums exactly', Math.round(shares.reduce((x, y) => x + y, 0) * 100) === 10000 && shares[2] === 33.34, shares);

    // Fixed coupon bigger than the cart is capped at the goods value
    const o2 = await order([P_KA], 'Karnataka', 'BIGFLAT');
    check('Coupon: oversized fixed coupon capped at subtotal, GST 0', o2?.items?.[0]?.discount === 1000 && o2?.tax === 0 && o2?.total === 0, [o2?.items?.[0]?.discount, o2?.tax, o2?.total, o2?.error]);

    // No coupon -> unchanged behaviour
    const o4 = await order([P_KA], 'Karnataka');
    check('No coupon: GST still on full price (180), discount 0', o4?.tax === 180 && (o4?.items?.[0]?.discount || 0) === 0, [o4?.tax, o4?.items?.[0]?.discount]);
}

console.log(`\n${pass} passed, ${fail} failed`);
server.close();
await mongoose.disconnect();
await mem.stop();
process.exit(fail ? 1 : 0);
