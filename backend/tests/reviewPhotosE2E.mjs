// Usage (from /backend): node tests/reviewPhotosE2E.mjs
// End-to-end for review photos: customer uploads photos (multipart) -> gets URLs -> submits the
// review with those URLs -> admin / vendor / public listings show the photos (and the vendor for admin).
// In-memory MongoDB; Cloudinary is stubbed (no real upload). Never touches Atlas / email.
import { createRequire } from 'module';
import { pathToFileURL, fileURLToPath } from 'url';
import http from 'http';
import path from 'path';
import fs from 'fs';

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = `${BACKEND}/src`;
const reqB = createRequire(`${BACKEND}/package.json`);
const imp = (p) => import(pathToFileURL(`${SRC}/${p}`).href);

const { MongoMemoryReplSet } = reqB('mongodb-memory-server');
const mem = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
process.env.MONGO_URI = mem.getUri('ple_review_photos');
Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', SMTP_USER: 'x', SMTP_PASS: 'x', FIREBASE_SERVICE_ACCOUNT: '', SHIPROCKET_EMAIL: '', SHIPROCKET_PASSWORD: '', NODE_ENV: 'development' });

const mongoose = (await import(pathToFileURL(reqB.resolve('mongoose')).href)).default;
const { default: cloudinary } = await imp('config/cloudinary.js');
let uploadCalls = [];
let failUploads = false;
cloudinary.uploader.upload = async (filePath, opts) => {
    uploadCalls.push({ filePath, folder: opts?.folder });
    if (failUploads) throw new Error('stubbed cloudinary outage');
    return { secure_url: `https://res.cloudinary.test/${opts.folder}/${path.basename(filePath)}`, public_id: path.basename(filePath), resource_type: 'image' };
};
const { default: app } = await imp('app.js');
const { signAccessToken } = await imp('config/jwt.js');
await mongoose.connect(process.env.MONGO_URI);
const server = http.createServer(app);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/api`;

const M = {};
for (const n of ['User', 'Admin', 'Vendor', 'ManagedShop', 'Product', 'Order', 'Review']) M[n] = (await imp(`models/${n}.model.js`)).default;

let pass = 0, fail = 0;
const check = (name, cond, actual) => {
    cond ? pass++ : fail++;
    console.log(`${cond ? '✅' : '❌'} ${name} → ${typeof actual === 'string' ? actual : JSON.stringify(actual)}`);
};
const call = async (token, method, p, { json, form } = {}) => {
    const res = await fetch(BASE + p, {
        method,
        headers: { ...(json ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: form || (json ? JSON.stringify(json) : undefined),
    });
    let body = null;
    try { body = await res.json(); } catch { /* none */ }
    return { status: res.status, body, data: body?.data };
};

// 1x1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const photoForm = (n, { type = 'image/png', name = 'photo', bytes = PNG } = {}) => {
    const f = new FormData();
    for (let i = 0; i < n; i += 1) f.append('images', new Blob([bytes], { type }), `${name}${i + 1}.${type === 'image/png' ? 'png' : 'txt'}`);
    return f;
};
const TMP = path.join(BACKEND, 'uploads', 'tmp');
const tmpCount = () => (fs.existsSync(TMP) ? fs.readdirSync(TMP).length : 0);

// ── seed
const pw = '$2a$12$abcdefghijklmnopqrstuuDummyHashNotUsedForLoginxxxxxxxx';
const ins = async (Model, doc) => (await Model.collection.insertOne({ createdAt: new Date(), ...doc })).insertedId;
const CUST = await ins(M.User, { name: 'Riya Reviewer', email: 'riya@example.com', password: pw, role: 'customer', isActive: true, isVerified: true, phone: '9000000002' });
const ADMIN = await ins(M.Admin, { name: 'Admin', email: 'admin@example.com', password: pw, role: 'admin', isActive: true, status: 'active' });
const VEND = await ins(M.Vendor, { name: 'Vee', storeName: 'Vee Electronics', email: 'vee@example.com', password: pw, status: 'approved', isVerified: true, isActive: true });
const SHOP = await ins(M.ManagedShop, { name: 'PLE Own Store', status: 'active' });
const mkProduct = (name, extra) => ins(M.Product, { name, slug: name.toLowerCase().replace(/\s/g, '-'), price: 500, stockQuantity: 10, isActive: true, isVisible: true, approvalStatus: 'approved', ...extra });
const P1 = await mkProduct('Vee Headphones', { vendorId: VEND });
const P2 = await mkProduct('Shop Lamp', { shopId: SHOP, listingType: 'admin_managed_listing' });
const P3 = await mkProduct('Vee Charger', { vendorId: VEND });
const mkOrder = (productId, status = 'delivered') => ins(M.Order, { orderId: `ORD-RV-${Math.random().toString(36).slice(2, 8)}`, userId: CUST, items: [{ productId, name: 'x', price: 500, quantity: 1 }], status, total: 500 });
const O1 = await mkOrder(P1);
const O2 = await mkOrder(P2);
const O3 = await mkOrder(P3, 'processing');

const T = signAccessToken({ id: String(CUST), role: 'customer', name: 'Riya Reviewer', email: 'riya@example.com' });
const TA = signAccessToken({ id: String(ADMIN), role: 'admin' });
const TV = signAccessToken({ id: String(VEND), role: 'vendor' });
console.log('In-memory DB ready.\n');

// 1. Upload
let urls = [];
{
    const before = tmpCount();
    const r = await call(T, 'POST', '/user/reviews/images', { form: photoForm(2) });
    urls = r.data?.urls || [];
    check('Upload: 2 photos -> 201 with 2 URLs', r.status === 201 && urls.length === 2, `${r.status} ${JSON.stringify(r.data || r.body?.message)}`);
    check('Upload: stored in "reviews" folder', uploadCalls.length === 2 && uploadCalls.every((c) => c.folder === 'reviews'), uploadCalls.map((c) => c.folder));
    check('Upload: temp files cleaned up', tmpCount() === before, `${before} -> ${tmpCount()}`);

    const none = await call(null, 'POST', '/user/reviews/images', { form: photoForm(1) });
    check('Upload: requires login (401)', none.status === 401, none.status);
    const txt = await call(T, 'POST', '/user/reviews/images', { form: photoForm(1, { type: 'text/plain', bytes: Buffer.from('hello') }) });
    check('Upload: non-image rejected (400)', txt.status === 400, `${txt.status} ${txt.body?.message}`);
    const four = await call(T, 'POST', '/user/reviews/images', { form: photoForm(4) });
    check('Upload: more than 3 photos rejected (400)', four.status === 400, `${four.status} ${four.body?.message}`);
    const empty = await call(T, 'POST', '/user/reviews/images', { form: new FormData() });
    check('Upload: no file -> 400', empty.status === 400, `${empty.status} ${empty.body?.message}`);
    const big = await call(T, 'POST', '/user/reviews/images', { form: photoForm(1, { bytes: Buffer.alloc(6 * 1024 * 1024, 1) }) });
    check('Upload: >5MB rejected (400)', big.status === 400, `${big.status} ${big.body?.message}`);

    failUploads = true;
    const b2 = tmpCount();
    const down = await call(T, 'POST', '/user/reviews/images', { form: photoForm(2) });
    failUploads = false;
    check('Upload: storage outage -> 502, not a fake URL', down.status === 502 && !down.data?.urls, `${down.status} ${down.body?.message}`);
    check('Upload: temp files cleaned up after failure', tmpCount() === b2, `${b2} -> ${tmpCount()}`);
}

// 2. Submit review with the URLs
let reviewId;
{
    const el = await call(T, 'GET', `/user/reviews/eligibility/${P1}`);
    check('Eligibility: delivered + not reviewed -> eligible with orderId', el.data?.eligible === true && String(el.data?.orderId) === String(O1), el.data);
    const el3 = await call(T, 'GET', `/user/reviews/eligibility/${P3}`);
    check('Eligibility: not delivered -> not eligible', el3.data?.eligible === false && !el3.data?.alreadyReviewed, el3.data);
    const elAnon = await call(null, 'GET', `/user/reviews/eligibility/${P1}`);
    check('Eligibility: requires login', elAnon.status === 401, elAnon.status);
    const elBad = await call(T, 'GET', '/user/reviews/eligibility/not-an-id');
    check('Eligibility: bad id -> 400', elBad.status === 400, elBad.status);
    const bad = await call(T, 'POST', '/user/reviews', { json: { productId: String(P1), orderId: String(O1), rating: 5, comment: 'Great sound quality', images: [{}] } });
    check('Review: raw File objects ({}) rejected with clear 400 (was a crash)', bad.status === 400 && /upload/i.test(bad.body?.message || ''), `${bad.status} ${bad.body?.message}`);
    const js = await call(T, 'POST', '/user/reviews', { json: { productId: String(P1), orderId: String(O1), rating: 5, comment: 'Great sound quality', images: ['javascript:alert(1)'] } });
    check('Review: non-http URL rejected', js.status === 400, `${js.status} ${js.body?.message}`);
    const many = await call(T, 'POST', '/user/reviews', { json: { productId: String(P1), orderId: String(O1), rating: 5, comment: 'Great sound quality', images: ['https://a.test/1.png', 'https://a.test/2.png', 'https://a.test/3.png', 'https://a.test/4.png'] } });
    check('Review: >3 photo URLs rejected', many.status === 400, `${many.status} ${many.body?.message}`);

    const ok = await call(T, 'POST', '/user/reviews', { json: { productId: String(P1), orderId: String(O1), rating: 5, comment: 'Great sound quality', images: urls } });
    reviewId = ok.data?._id;
    check('Review: with photos -> 201', ok.status === 201, `${ok.status} ${ok.body?.message}`);
    const saved = await M.Review.findById(reviewId).lean();
    check('Review: photo URLs saved', JSON.stringify(saved?.images) === JSON.stringify(urls), saved?.images);
    check('Review: pending approval', saved?.isApproved === false, saved?.isApproved);
    const elAfter = await call(T, 'GET', `/user/reviews/eligibility/${P1}`);
    check('Eligibility: after reviewing -> alreadyReviewed, pending', elAfter.data?.eligible === false && elAfter.data?.alreadyReviewed === true && elAfter.data?.reviewStatus === 'pending', elAfter.data);

    const noPhotos = await call(T, 'POST', '/user/reviews', { json: { productId: String(P2), orderId: String(O2), rating: 4, comment: 'Nice lamp, works well' } });
    check('Review: without photos still works', noPhotos.status === 201 && Array.isArray(noPhotos.data?.images) && noPhotos.data.images.length === 0, `${noPhotos.status} ${noPhotos.body?.message}`);

    const notDelivered = await call(T, 'POST', '/user/reviews', { json: { productId: String(P3), orderId: String(O3), rating: 4, comment: 'Not yet delivered', images: urls } });
    check('Review: still blocked for undelivered order', notDelivered.status === 403, notDelivered.status);
}

// 3. Admin sees photos + vendor
{
    const r = await call(TA, 'GET', '/admin/reviews?limit=50');
    const rows = r.data?.reviews || [];
    const withPhotos = rows.find((x) => String(x.id) === String(reviewId));
    check('Admin: list loads', r.status === 200 && rows.length === 2, `${r.status} ${rows.length}`);
    check('Admin: photos included', JSON.stringify(withPhotos?.images) === JSON.stringify(urls), withPhotos?.images);
    check('Admin: vendor store name shown', withPhotos?.vendorName === 'Vee Electronics' && withPhotos?.vendorType === 'vendor', [withPhotos?.vendorName, withPhotos?.vendorType]);
    const shopRow = rows.find((x) => x.productName === 'Shop Lamp');
    check('Admin: managed shop shown as vendor', shopRow?.vendorName === 'PLE Own Store' && shopRow?.vendorType === 'managed_shop', [shopRow?.vendorName, shopRow?.vendorType]);
    check('Admin: productId still a plain id string', withPhotos?.productId === String(P1), withPhotos?.productId);
    const s = await call(TA, 'GET', '/admin/reviews?search=Vee%20Headphones');
    check('Admin: search by product still works', s.data?.reviews?.length === 1, s.data?.reviews?.length);
}

// 4. Vendor sees photos on their product's review
{
    const r = await call(TV, 'GET', '/vendor/reviews?limit=50');
    const row = (r.data?.reviews || []).find((x) => String(x.id) === String(reviewId));
    check('Vendor: review with photos visible', r.status === 200 && JSON.stringify(row?.images) === JSON.stringify(urls), `${r.status} ${JSON.stringify(row?.images)}`);
    check('Vendor: does not see managed-shop review', !(r.data?.reviews || []).some((x) => x.productName === 'Shop Lamp'), (r.data?.reviews || []).map((x) => x.productName));
}

// 5. Public product page after approval
{
    const before = await call(null, 'GET', `/user/reviews/product/${P1}`);
    check('Public: hidden until approved', (before.data?.reviews || []).length === 0, before.data?.reviews?.length);
    const ap = await call(TA, 'PATCH', `/admin/reviews/${reviewId}/status`, { json: { status: 'approved' } });
    check('Admin: approve', ap.status === 200, `${ap.status} ${ap.body?.message}`);
    const after = await call(null, 'GET', `/user/reviews/product/${P1}`);
    check('Public: approved review shows photos', JSON.stringify(after.data?.reviews?.[0]?.images) === JSON.stringify(urls), after.data?.reviews?.[0]?.images);
}

console.log(`\n${pass} passed, ${fail} failed`);
server.close();
await mongoose.disconnect();
await mem.stop();
process.exit(fail ? 1 : 0);
