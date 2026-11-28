// Usage (from /backend): node tests/ordersBulkE2E.mjs
// Order placing and bulk ordering: B2B bulk-slab pricing + MOQ (server and storefront use the same
// rule), stock (out of stock, oversell under concurrency, variant stock, restored on cancel),
// loyalty points (redeemed, restored on cancel), undeliverable pincode, and vendor Bulk Orders
// (own products only, atomic stock, GST, catalogue price). In-memory MongoDB; courier stubbed.
// Payments are not exercised here: every order uses Cash on Delivery.
import { createRequire } from 'module';
import { pathToFileURL, fileURLToPath } from 'url';
import http from 'http';
import path from 'path';

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = `${BACKEND}/src`;
const FRONT = path.resolve(BACKEND, '..', 'frontend', 'src');
const reqB = createRequire(`${BACKEND}/package.json`);
const imp = (p) => import(pathToFileURL(`${SRC}/${p}`).href);

const { MongoMemoryReplSet } = reqB('mongodb-memory-server');
const mem = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
process.env.MONGO_URI = mem.getUri('ple_orders_bulk');
Object.assign(process.env, {
    SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', SMTP_USER: 'x', SMTP_PASS: 'x', FIREBASE_SERVICE_ACCOUNT: '',
    SHIPROCKET_EMAIL: '', SHIPROCKET_PASSWORD: '', NODE_ENV: 'development',
    RAZORPAY_KEY_ID: 'rzp_test_dummy', RAZORPAY_KEY_SECRET: 'x',
});

const mongoose = (await import(pathToFileURL(reqB.resolve('mongoose')).href)).default;
const { deliveryManager } = await imp('modules/delivery/deliveryManager.js');
const realGetQuote = deliveryManager.getQuote?.bind(deliveryManager);
const { default: app } = await imp('app.js');
const { signAccessToken } = await imp('config/jwt.js');
const serverPricing = await imp('utils/b2bPricing.js');
const storefrontPricing = await import(pathToFileURL(`${FRONT}/shared/utils/b2bPricing.js`).href);
await mongoose.connect(process.env.MONGO_URI);
const server = http.createServer(app);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/api`;

const M = {};
for (const n of ['User', 'Vendor', 'Product', 'Order', 'B2BCompany']) M[n] = (await imp(`models/${n}.model.js`)).default;

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
const COMPANY = await ins(M.B2BCompany, { companyName: 'Acme', businessEmail: 'acme@example.com', verificationStatus: 'Approved' });
const B2B = await ins(M.User, { name: 'Asha Admin', email: 'asha@example.com', password: pw, role: 'b2bAdmin', companyId: COMPANY, isActive: true, isVerified: true, phone: '9000000010' });
const CUST = await ins(M.User, { name: 'Cara', email: 'cara@example.com', password: pw, role: 'customer', isActive: true, isVerified: true, phone: '9000000012', loyaltyPointsBalance: 500 });
const VEND = await ins(M.Vendor, { name: 'V', storeName: 'Volt Supplies', email: 'volt@example.com', password: pw, status: 'approved', isVerified: true, isActive: true, gstNumber: '27ABCDE1234F1Z5', shippingEnabled: false });
const OTHER_VEND = await ins(M.Vendor, { name: 'O', storeName: 'Other Store', email: 'other@example.com', password: pw, status: 'approved', isVerified: true, isActive: true, shippingEnabled: false });

const base = { stock: 'in_stock', isActive: true, isVisible: true, approvalStatus: 'approved', gstMode: 'custom', gstRate: 18, vendorId: VEND, listingType: 'vendor_direct' };
// Slabs saved in "wrong" order and overlapping on purpose: 10+ @850 before 50+ @800.
const BULK = await ins(M.Product, { ...base, name: 'Office Chair', slug: 'chair', price: 1000, stockQuantity: 1000, b2bEnabled: true, b2bWholesalePrice: 900, b2bMinOrderQty: 5, b2bBulkPricingSlabs: [{ minQty: 10, pricePerUnit: 850 }, { minQty: 50, pricePerUnit: 800 }] });
const GAP = await ins(M.Product, { ...base, name: 'Desk', slug: 'desk', price: 1000, stockQuantity: 1000, b2bEnabled: true, b2bWholesalePrice: 900, b2bBulkPricingSlabs: [{ minQty: 10, maxQty: 20, pricePerUnit: 850 }] });
const OFF = await ins(M.Product, { ...base, name: 'Lamp', slug: 'lamp', price: 1000, stockQuantity: 1000, b2bEnabled: false, b2bWholesalePrice: 500 });
const LAST3 = await ins(M.Product, { ...base, name: 'Rare Item', slug: 'rare', price: 100, stockQuantity: 3 });
const GONE = await ins(M.Product, { ...base, name: 'Sold Out', slug: 'gone', price: 100, stockQuantity: 0, stock: 'out_of_stock' });
const SHIRT = await ins(M.Product, { ...base, name: 'Shirt', slug: 'shirt', price: 500, stockQuantity: 10, variants: { attributes: [{ name: 'color', values: ['Red', 'Blue'] }], prices: { 'color=red': 500, 'color=blue': 500 }, stockMap: { 'color=red': 2, 'color=blue': 8 } } });
const OTHERS = await ins(M.Product, { ...base, vendorId: OTHER_VEND, name: 'Their Product', slug: 'theirs', price: 100, stockQuantity: 50 });
const PEN = await ins(M.Product, { ...base, name: 'Pen', slug: 'pen', price: 100, stockQuantity: 50 });
const PAD = await ins(M.Product, { ...base, name: 'Notepad', slug: 'pad', price: 100, stockQuantity: 5 });
// A seller that ships by courier (shipping on, pickup pincode set), so the courier is asked about the pincode.
const SHIPPER = await ins(M.Vendor, { name: 'S', storeName: 'Ship Co', email: 'ship@example.com', password: pw, status: 'approved', isVerified: true, isActive: true, shippingEnabled: true, pincode: '411001' });
const PARCEL = await ins(M.Product, { ...base, vendorId: SHIPPER, name: 'Parcel Item', slug: 'parcel', price: 100, stockQuantity: 50 });

const T = {
    b2b: signAccessToken({ id: String(B2B), role: 'b2bAdmin', email: 'asha@example.com', companyId: String(COMPANY) }),
    cust: signAccessToken({ id: String(CUST), role: 'customer', email: 'cara@example.com' }),
    vend: signAccessToken({ id: String(VEND), role: 'vendor', email: 'volt@example.com' }),
};
const addr = { name: 'Asha', email: 'asha@example.com', phone: '9000000010', address: '1 Rd', city: 'Pune', state: 'Maharashtra', zipCode: '411001', country: 'India' };
const order = (token, productId, quantity, extra = {}) => api(token, 'POST', '/user/orders', { items: [{ productId: String(productId), quantity, ...(extra.variant ? { variant: extra.variant } : {}) }], shippingAddress: addr, paymentMethod: 'cod', ...(extra.body || {}) });
const unitPrice = async (orderId) => (await M.Order.findOne({ orderId }).lean())?.items?.[0]?.price;
const stockOf = async (id) => (await M.Product.findById(id).lean());
console.log('In-memory DB ready.\n');

// 1. B2B bulk pricing + MOQ at checkout
{
    const moq = await order(T.b2b, BULK, 3);
    check('MOQ: 3 units below the minimum of 5 is refused', moq.status === 400 && /Minimum order quantity/.test(moq.body?.message), `${moq.status} ${moq.body?.message}`);
    const a = await order(T.b2b, BULK, 5);
    check('5 units → wholesale ₹900', a.status === 201 && await unitPrice(a.data?.orderId) === 900, `${a.status} price=${await unitPrice(a.data?.orderId)}`);
    const b = await order(T.b2b, BULK, 20);
    check('20 units → slab ₹850', b.status === 201 && await unitPrice(b.data?.orderId) === 850, `${b.status} price=${await unitPrice(b.data?.orderId)}`);
    const c = await order(T.b2b, BULK, 60);
    check('60 units → best slab ₹800 even though the 10+ slab is saved first', c.status === 201 && await unitPrice(c.data?.orderId) === 800, `${c.status} price=${await unitPrice(c.data?.orderId)}`);
    const d = await order(T.b2b, GAP, 30);
    check('Above a slab\'s max quantity → back to wholesale ₹900', d.status === 201 && await unitPrice(d.data?.orderId) === 900, `${d.status} price=${await unitPrice(d.data?.orderId)}`);
    const e = await order(T.b2b, OFF, 10);
    check('B2B selling off → normal price ₹1000 (wholesale ignored)', e.status === 201 && await unitPrice(e.data?.orderId) === 1000, `${e.status} price=${await unitPrice(e.data?.orderId)}`);
    const f = await order(T.cust, BULK, 20);
    check('Retail customer pays the normal price ₹1000, no MOQ', f.status === 201 && await unitPrice(f.data?.orderId) === 1000, `${f.status} price=${await unitPrice(f.data?.orderId)}`);
}

// 2. Storefront and server use the same price rule
{
    const products = [
        { b2bEnabled: true, b2bWholesalePrice: 900, b2bBulkPricingSlabs: [{ minQty: 10, pricePerUnit: 850 }, { minQty: 50, pricePerUnit: 800 }] },
        { b2bEnabled: true, b2bWholesalePrice: 900, b2bBulkPricingSlabs: [{ minQty: 10, maxQty: 20, pricePerUnit: 850 }] },
        { b2bEnabled: true, b2bBulkPricingSlabs: [{ minQty: 5, pricePerUnit: 700 }, { minQty: 0, pricePerUnit: 1 }, { minQty: 8, pricePerUnit: -5 }] },
        { b2bEnabled: false, b2bWholesalePrice: 500 },
        { b2bEnabled: true },
        null,
    ];
    let mismatches = 0;
    for (const p of products) for (const q of [1, 4, 5, 9, 10, 20, 21, 49, 50, 51, 500]) {
        const s = serverPricing.resolveB2BUnitPrice(p, 1000, q);
        const f = storefrontPricing.resolveB2BUnitPrice(p, 1000, q);
        if (s !== f) { mismatches++; console.log('   mismatch', JSON.stringify(p), q, s, f); }
    }
    check('Cart price rule == checkout price rule (66 cases)', mismatches === 0, `${mismatches} mismatches`);
}

// 3. Stock
{
    const gone = await order(T.cust, GONE, 1);
    check('Out-of-stock product refused', gone.status === 400 && /out of stock/i.test(gone.body?.message), `${gone.status} ${gone.body?.message}`);
    const results = await Promise.all([order(T.cust, LAST3, 2), order(T.cust, LAST3, 2), order(T.cust, LAST3, 2)]);
    const ok = results.filter((r) => r.status === 201).length;
    const left = (await stockOf(LAST3)).stockQuantity;
    check('3 buyers × 2 units of the last 3 at once: exactly one order, no oversell', ok === 1 && left === 1, `orders=${ok} stockLeft=${left} statuses=${results.map((r) => r.status).join(',')}`);

    const noColor = await order(T.cust, SHIRT, 1);
    check('Variant must be chosen', noColor.status === 400 && /select/i.test(noColor.body?.message), `${noColor.status} ${noColor.body?.message}`);
    const tooMany = await order(T.cust, SHIRT, 3, { variant: { color: 'Red' } });
    check('Variant stock enforced (only 2 red)', tooMany.status === 400 && /Only 2 units/.test(tooMany.body?.message), `${tooMany.status} ${tooMany.body?.message}`);
    const red = await order(T.cust, SHIRT, 2, { variant: { color: 'Red' } });
    const after = await stockOf(SHIRT);
    check('Variant order takes variant + total stock', red.status === 201 && after.variants.stockMap['color=red'] === 0 && after.stockQuantity === 8, `${red.status} red=${after.variants.stockMap['color=red']} total=${after.stockQuantity}`);

    const cancel = await api(T.cust, 'PATCH', `/user/orders/${red.data?.orderId}/cancel`, { reason: 'test' });
    const back = await stockOf(SHIRT);
    check('Cancelling returns variant + total stock', cancel.status === 200 && back.variants.stockMap['color=red'] === 2 && back.stockQuantity === 10 && back.stock !== 'out_of_stock', `${cancel.status} red=${back.variants.stockMap['color=red']} total=${back.stockQuantity} ${back.stock}`);
    const again = await api(T.cust, 'PATCH', `/user/orders/${red.data?.orderId}/cancel`, { reason: 'twice' });
    const twice = await stockOf(SHIRT);
    check('Cancelling twice does not add stock twice', again.status === 400 && twice.stockQuantity === 10, `${again.status} total=${twice.stockQuantity}`);
}

// 4. Loyalty points
{
    const o = await order(T.cust, PEN, 1, { body: { loyaltyPointsToRedeem: 100 } }); // ₹100 item, max 50% → 100 pts × ₹0.20 = ₹20
    const doc = await M.Order.findOne({ orderId: o.data?.orderId }).lean();
    const bal = (await M.User.findById(CUST).lean()).loyaltyPointsBalance;
    check('Redeem 100 points → ₹20 off, balance 500 → 400', o.status === 201 && doc?.loyaltyDiscount === 20 && doc?.loyaltyPointsRedeemed === 100 && bal === 400, `${o.status} discount=${doc?.loyaltyDiscount} redeemed=${doc?.loyaltyPointsRedeemed} balance=${bal}`);
    await api(T.cust, 'PATCH', `/user/orders/${o.data?.orderId}/cancel`, { reason: 'test' });
    const back = (await M.User.findById(CUST).lean()).loyaltyPointsBalance;
    check('Cancelling gives the 100 points back', back === 500, back);

    const capped = await order(T.cust, PEN, 1, { body: { loyaltyPointsToRedeem: 10000 } });
    const cdoc = await M.Order.findOne({ orderId: capped.data?.orderId }).lean();
    check('Asking for too many points is capped at 50% of the order (₹50 = 250 points)', capped.status === 201 && cdoc?.loyaltyDiscount === 50 && cdoc?.loyaltyPointsRedeemed === 250, `${capped.status} discount=${cdoc?.loyaltyDiscount} redeemed=${cdoc?.loyaltyPointsRedeemed}`);
    await M.User.updateOne({ _id: CUST }, { $set: { loyaltyPointsBalance: 60 } });
    const short = await order(T.cust, PEN, 1, { body: { loyaltyPointsToRedeem: 100 } });
    const kept = (await M.User.findById(CUST).lean()).loyaltyPointsBalance;
    check('Redeeming more points than you have is refused, balance unchanged', short.status === 400 && kept === 60, `${short.status} balance=${kept} ${short.body?.message}`);
}

// 5. Undeliverable pincode
{
    let quoteCalls = 0;
    deliveryManager.getQuote = async () => { quoteCalls++; return { isServiceable: false, isCodAvailable: false, reason: 'No courier' }; };
    const r = await order(T.cust, PARCEL, 1);
    check('Courier says "not serviceable" → order refused with a clear message', r.status === 400 && /cannot deliver to pincode 411001/.test(r.body?.message), `${r.status} ${r.body?.message} courierCalls=${quoteCalls}`);
    deliveryManager.getQuote = async () => ({ isServiceable: true, isCodAvailable: true, applicableRate: 120, selectedCourier: { courier_name: 'X' } });
    const free = await order(T.cust, PARCEL, 1); // ₹100 meets the vendor's ₹100 free-shipping threshold
    const fdoc = await M.Order.findOne({ orderId: free.data?.orderId }).lean();
    check('Deliverable + free-shipping threshold met → still free, not the courier rate of ₹120', free.status === 201 && fdoc?.shipping === 0, `${free.status} shipping=${fdoc?.shipping}`);
    deliveryManager.getQuote = async () => { throw new Error('courier down'); };
    const r2 = await order(T.cust, PARCEL, 1);
    check('Courier service down → order still accepted (not blocked)', r2.status === 201, `${r2.status} ${r2.body?.message || ''}`);
    if (realGetQuote) deliveryManager.getQuote = realGetQuote;
}

// 6. Vendor Bulk Orders
{
    const row = (items, extra = {}) => ({ customer: { name: 'Ravi', phone: '9000000099' }, shippingAddress: { address: '2 Rd', city: 'Pune', state: 'Maharashtra', zipCode: '411002' }, items, ...extra });
    const theirsBefore = (await stockOf(OTHERS)).stockQuantity;
    const padBefore = (await stockOf(PAD)).stockQuantity;
    const r = await api(T.vend, 'POST', '/vendor/orders/bulk', { orders: [
        row([{ productId: String(OTHERS), quantity: 5 }]),                     // 1: another vendor's product
        row([{ productId: String(PAD), quantity: 999 }]),                       // 2: not enough stock
        row([{ productId: String(PAD), quantity: 2 }, { productId: String(LAST3), quantity: 999 }]), // 3: 2nd item fails → 1st must not keep stock
        row([{ productId: String(PAD), quantity: 2, price: 0 }]),              // 4: blank price → catalogue ₹100, GST 18%
        row([{ name: 'notepad', quantity: 1 }]),                                    // 5: matched by name (case-insensitive)
        row([{ name: 'Custom Gift Box', quantity: 1 }]),                        // 6: not in catalogue, no price
        row([{ name: 'Custom Gift Box', quantity: 1, price: 250 }]),            // 7: not in catalogue, priced
        row([{ productId: String(PAD), quantity: 1.5 }]),                       // 8: fractional quantity
    ] });
    const errs = Object.fromEntries((r.data?.errors || []).map((e) => [e.row, e.message]));
    const made = Object.fromEntries((r.data?.createdOrders || []).map((o) => [o.row, o]));
    check("Another vendor's product is refused", /not in your catalogue/.test(errs[1] || ''), errs[1]);
    check("...and that vendor's stock is untouched", (await stockOf(OTHERS)).stockQuantity === theirsBefore, (await stockOf(OTHERS)).stockQuantity);
    check('Not enough stock → row refused (no more silent 0)', /Not enough stock/.test(errs[2] || ''), errs[2]);
    check('Failed row keeps no stock taken by its earlier items', /Not enough stock/.test(errs[3] || ''), errs[3]);
    const o4 = made[4] && await M.Order.findOne({ orderId: made[4].orderId }).lean();
    check('Blank price uses catalogue price; GST 18% added (200 + 36 = 236)', o4?.items?.[0]?.price === 100 && o4?.tax === 36 && o4?.total === 236 && o4?.taxBreakdown?.cgst === 18 && o4?.taxBreakdown?.sgst === 18, o4 ? `price=${o4.items[0].price} tax=${o4.tax} total=${o4.total} cgst=${o4.taxBreakdown?.cgst}` : 'no order');
    check('Product matched by name', !!made[5], made[5] ? 'created' : errs[5]);
    check('Item not in catalogue needs a price', /Enter a unit price/.test(errs[6] || ''), errs[6]);
    const o7 = made[7] && await M.Order.findOne({ orderId: made[7].orderId }).lean();
    check('Priced custom item accepted with no GST (no known rate)', o7?.total === 250 && o7?.tax === 0, o7 ? `total=${o7.total} tax=${o7.tax}` : errs[7]);
    check('Fractional quantity refused', /whole number/.test(errs[8] || ''), errs[8]);
    const padAfter = (await stockOf(PAD)).stockQuantity;
    check('Notepad stock reduced only by the orders that were created (2 + 1)', padAfter === padBefore - 3, `${padBefore} → ${padAfter}`);
    check('Summary counts', r.status === 200 && r.data?.successCount === 3 && r.data?.failedCount === 5, `${r.status} ok=${r.data?.successCount} failed=${r.data?.failedCount}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
await mongoose.disconnect();
await mem.stop();
server.close();
process.exit(fail ? 1 : 0);
