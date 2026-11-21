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
for (const n of ['User', 'Vendor', 'ManagedShop', 'Product', 'Order', 'Invoice']) M[n] = (await imp(`models/${n}.model.js`)).default;

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
const order = async (productIds, state) => {
    const r = await api(T, 'POST', '/user/orders', { items: productIds.map((productId) => ({ productId: String(productId), quantity: 1 })), shippingAddress: addr(state), paymentMethod: 'cod' });
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

console.log(`\n${pass} passed, ${fail} failed`);
server.close();
await mongoose.disconnect();
await mem.stop();
process.exit(fail ? 1 : 0);
