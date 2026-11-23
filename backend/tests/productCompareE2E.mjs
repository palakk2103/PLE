// Usage (from /backend): node tests/productCompareE2E.mjs
// Product comparison: 2-4 products side by side with prices, ratings, unified spec rows (differences
// flagged) and public seller details. Hidden products are reported, never leaked; no private seller data.
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
process.env.MONGO_URI = mem.getUri('ple_compare');
Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', SMTP_USER: 'x', SMTP_PASS: 'x', FIREBASE_SERVICE_ACCOUNT: '', SHIPROCKET_EMAIL: '', SHIPROCKET_PASSWORD: '', NODE_ENV: 'development' });

const mongoose = (await import(pathToFileURL(reqB.resolve('mongoose')).href)).default;
const { default: app } = await imp('app.js');
await mongoose.connect(process.env.MONGO_URI);
const server = http.createServer(app);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/api`;

const M = {};
for (const x of ['Vendor', 'ManagedShop', 'Product', 'Category', 'Brand']) M[x] = (await imp(`models/${x}.model.js`)).default;

let pass = 0, fail = 0;
const check = (name, cond, actual) => {
    cond ? pass++ : fail++;
    console.log(`${cond ? '✅' : '❌'} ${name} → ${typeof actual === 'string' ? actual : JSON.stringify(actual)}`);
};
const get = async (p) => {
    const res = await fetch(BASE + p);
    let body = null;
    try { body = await res.json(); } catch { /* none */ }
    return { status: res.status, body, data: body?.data };
};

const pw = '$2a$12$abcdefghijklmnopqrstuuDummyHashNotUsedForLoginxxxxxxxx';
const ins = async (Model, doc) => (await Model.collection.insertOne({ createdAt: new Date(), updatedAt: new Date(), ...doc })).insertedId;
const CAT = await ins(M.Category, { name: 'Laptops', slug: 'laptops', isActive: true, status: 'approved' });
const CAT2 = await ins(M.Category, { name: 'Phones', slug: 'phones', isActive: true, status: 'approved' });
const BR = await ins(M.Brand, { name: 'Acme', isActive: true, status: 'approved' });
const V1 = await ins(M.Vendor, {
    name: 'Vikram Rao', storeName: 'Vee Electronics', email: 'vee-private@example.com', password: pw, phone: '9876501234', status: 'approved', isVerified: true, isActive: true,
    rating: 4.5, reviewCount: 12, storeLogo: 'https://cdn.test/vee.png', joinDate: new Date('2025-03-01'), city: 'Pune', state: 'Maharashtra',
    gstNumber: '27ABCDE1234F1Z5', panNumber: 'QWERT5678Y', verificationStatus: 'Approved', storeProfile: { tagline: 'Genuine electronics since 2010' },
    bankDetails: { accountNumber: '123456789012', ifscCode: 'HDFC0001234' },
});
const V2 = await ins(M.Vendor, { name: 'Wen', storeName: 'Wen Traders', email: 'wen@example.com', password: pw, status: 'approved', isVerified: false, isActive: true, rating: 3.8, reviewCount: 4, storeProfile: { tagline: 'Call me on 9876543210' } });
const SHOP = await ins(M.ManagedShop, { name: 'PLE Own Store', logo: 'https://cdn.test/ple.png', status: 'active' });

const spec = (label, value, unit) => ({ key: label.toLowerCase().replace(/\s/g, '_'), label, type: 'text', value, unit });
const mk = (name, extra) => ins(M.Product, {
    name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), price: 50000, stock: 'in_stock', stockQuantity: 10, isActive: true, isVisible: true,
    approvalStatus: 'approved', categoryId: CAT, brandId: BR, vendorId: V1, rating: 4.2, reviewCount: 30, images: ['https://cdn.test/p.png'], ...extra,
});
const A = await mk('Acme Book 14', {
    price: 52000, originalPrice: 65000, warrantyPeriod: '1 year', variants: { colors: ['Silver', 'Black'], sizes: [] },
    specifications: { features: [spec('RAM', '16', 'GB'), spec('Processor', 'Core i5'), spec('Touchscreen', false)], additional: [spec('Weight', '1.4', 'kg')], whatsInBox: ['Laptop', 'Charger'] },
});
const B = await mk('Acme Book 15', {
    price: 61000, vendorId: V2, rating: 4.7, reviewCount: 90, stock: 'out_of_stock', stockQuantity: 0,
    specifications: { features: [spec('ram', '32', 'GB'), spec('Processor', 'core i5'), spec('Touchscreen', true)], itemDetails: [spec('Colour', 'Grey')] },
});
const C = await mk('PLE Own Laptop', { price: 40000, vendorId: undefined, shopId: SHOP, categoryId: CAT2, specifications: { features: [spec('RAM', '8', 'GB')] } });
const D = await mk('Acme Book 13', { price: 45000 });
const HIDDEN = await mk('Pending Book', { approvalStatus: 'pending' });
const INACTIVE = await mk('Retired Book', { isActive: false });
const DRAFT = await mk('Draft Book', { publicationStatus: 'draft' });
console.log('In-memory DB ready.\n');

const ids = (...x) => x.map(String).join(',');
const sid = String;

// 1. Basic comparison
{
    const r = await get(`/products/compare?ids=${ids(A, B)}`);
    check('Compare two products -> 200', r.status === 200 && r.data?.products?.length === 2, `${r.status} ${r.body?.message}`);
    const [pa, pb] = r.data?.products || [];
    check('Products come back in the order asked', pa?.id === sid(A) && pb?.id === sid(B), [pa?.name, pb?.name]);
    check('Price, MRP and discount', pa?.price === 52000 && pa.originalPrice === 65000 && pa.discountPercent === 20 && pb?.originalPrice === null && pb.discountPercent === 0, { p: pa?.price, mrp: pa?.originalPrice, d: pa?.discountPercent });
    check('Rating, reviews, brand, category, warranty', pb?.rating === 4.7 && pb.reviewCount === 90 && pa?.brand === 'Acme' && pa.category === 'Laptops' && pa.warranty === '1 year', pa);
    check('Stock status: in stock vs out of stock', pa?.stock === 'in_stock' && pb?.stock === 'out_of_stock', [pa?.stock, pb?.stock]);
    check('Variants (colours) included', JSON.stringify(pa?.variants?.colors) === JSON.stringify(['Silver', 'Black']), pa?.variants);

    const rows = Object.fromEntries((r.data?.specRows || []).map((x) => [x.label.toLowerCase(), x]));
    check('Spec rows are unified case-insensitively (RAM vs ram)', rows.ram?.values?.[0] === '16 GB' && rows.ram.values[1] === '32 GB' && rows.ram.differs === true, rows.ram);
    check('Same value differing only by case is NOT a difference', rows.processor?.differs === false, rows.processor);
    check('Booleans shown as Yes / No and flagged as different', rows.touchscreen?.values?.join('|') === 'No|Yes' && rows.touchscreen.differs, rows.touchscreen?.values);
    check('A spec only one product has is null for the other (and counts as different)', rows.weight?.values?.[1] === null && rows.weight.differs === true && rows.colour?.values?.[0] === null, [rows.weight?.values, rows.colour?.values]);
    check("What's in the box row", rows["what's in the box"]?.values?.[0] === 'Laptop, Charger', rows["what's in the box"]?.values);
    check('Spec rows for same category flagged', r.data?.sameCategory === true && r.data.unavailable.length === 0, [r.data?.sameCategory, r.data?.unavailable]);
}

// 2. Seller details
{
    const r = await get(`/products/compare?ids=${ids(A, B, C)}`);
    const [pa, pb, pc] = r.data?.products || [];
    check('Seller: store name, logo, rating, verified, location, member since', pa?.seller?.name === 'Vee Electronics' && pa.seller.logo.endsWith('vee.png') && pa.seller.rating === 4.5 && pa.seller.isVerified === true && pa.seller.location === 'Pune, Maharashtra' && !!pa.seller.memberSince && pa.seller.id === sid(V1), pa?.seller);
    check('Seller: GST-verified flag and tagline (no GST number)', pa?.seller?.gstVerified === true && pa.seller.tagline === 'Genuine electronics since 2010', [pa?.seller?.gstVerified, pa?.seller?.tagline]);
    check('Different sellers are told apart', pb?.seller?.name === 'Wen Traders' && pb.seller.isVerified === false && pb.seller.id === sid(V2), pb?.seller?.name);
    check('A tagline with a phone number is hidden', pb?.seller?.tagline === '', pb?.seller?.tagline);
    check('PLE-owned product shows the PLE shop as seller', pc?.seller?.type === 'ple_shop' && pc.seller.name === 'PLE Own Store' && pc.seller.id === sid(SHOP), pc?.seller);
    check('Mixed categories flagged', r.data?.sameCategory === false, r.data?.sameCategory);
    const s = JSON.stringify(r.body);
    const leaks = ['9876501234', 'vee-private@example.com', '27ABCDE1234F1Z5', 'QWERT5678Y', '123456789012', 'HDFC0001234', 'passw', 'password'].filter((x) => s.includes(x));
    check('NO phone / email / GST number / PAN / bank details in the response', leaks.length === 0, leaks);
}

// 3. Availability, limits, validation
{
    const r = await get(`/products/compare?ids=${ids(A, HIDDEN, INACTIVE, DRAFT)}`);
    check('Unapproved / inactive / draft products are reported, not shown', r.status === 200 && r.data.products.length === 1 && r.data.unavailable.length === 3 && !JSON.stringify(r.body).includes('Pending Book'), { shown: r.data?.products?.map((p) => p.name), unavailable: r.data?.unavailable?.length });
    const gone = await get(`/products/compare?ids=${ids(A, new mongoose.Types.ObjectId())}`);
    check('An id that does not exist is reported as unavailable', gone.status === 200 && gone.data.unavailable.length === 1 && gone.data.products.length === 1, gone.status);
    const four = await get(`/products/compare?ids=${ids(A, B, C, D)}`);
    check('Four products is allowed', four.status === 200 && four.data.products.length === 4, four.status);
    const five = await get(`/products/compare?ids=${ids(A, B, C, D, HIDDEN)}`);
    check('Five products rejected (400)', five.status === 400 && /at most 4/.test(five.body?.message), `${five.status} ${five.body?.message}`);
    const one = await get(`/products/compare?ids=${ids(A)}`);
    check('One product rejected (400)', one.status === 400 && /at least 2/.test(one.body?.message), `${one.status} ${one.body?.message}`);
    const dup = await get(`/products/compare?ids=${ids(A, A)}`);
    check('The same product twice counts once (400, need 2)', dup.status === 400, dup.status);
    const none = await get('/products/compare');
    check('No ids rejected (400)', none.status === 400, none.status);
    const bad = await get(`/products/compare?ids=${ids(A)},not-an-id`);
    check('A malformed id rejected (400)', bad.status === 400 && /invalid/i.test(bad.body?.message), `${bad.status} ${bad.body?.message}`);
    const inj = await get(`/products/compare?ids[$ne]=1`);
    check('Operator injection in ids rejected (400)', inj.status === 400, inj.status);
    const sp = await get(`/products/compare?ids=${ids(A, B)}`);
    check('Public: works without logging in', sp.status === 200, sp.status);
    const detail = await get(`/products/${A}`);
    check('/products/:id still works (route order intact)', detail.status === 200 && detail.data?.name === 'Acme Book 14', detail.status);
}

console.log(`\nSUMMARY ${JSON.stringify({ PASS: pass, FAIL: fail })}`);
await mongoose.disconnect();
server.close();
await mem.stop();
process.exit(fail ? 1 : 0);
