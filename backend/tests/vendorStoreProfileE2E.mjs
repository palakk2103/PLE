// Usage (from /backend): node tests/vendorStoreProfileE2E.mjs
// End-to-end for the vendor store profile: vendor sets theme / logo / banner / tagline / about / hours,
// the customer-facing seller page shows them with the vendor's real name, GST number and address,
// and never leaks private details. In-memory MongoDB; never touches Atlas / email.
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
process.env.MONGO_URI = mem.getUri('ple_store_profile');
Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', SMTP_USER: 'x', SMTP_PASS: 'x', FIREBASE_SERVICE_ACCOUNT: '', SHIPROCKET_EMAIL: '', SHIPROCKET_PASSWORD: '', NODE_ENV: 'development', STORE_IMAGE_URL_PREFIXES: 'https://res.cloudinary.test/' });

const mongoose = (await import(pathToFileURL(reqB.resolve('mongoose')).href)).default;
const { default: app } = await imp('app.js');
const { signAccessToken } = await imp('config/jwt.js');
await mongoose.connect(process.env.MONGO_URI);
const server = http.createServer(app);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/api`;

const M = {};
for (const x of ['Vendor', 'ManagedShop', 'ManagedVendorUser']) M[x] = (await imp(`models/${x}.model.js`)).default;

let pass = 0, fail = 0;
const check = (name, cond, actual) => {
    cond ? pass++ : fail++;
    console.log(`${cond ? '✅' : '❌'} ${name} → ${typeof actual === 'string' ? actual : JSON.stringify(actual)}`);
};
const call = async (token, method, p, json) => {
    const res = await fetch(BASE + p, {
        method,
        headers: { ...(json ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: json ? JSON.stringify(json) : undefined,
    });
    let body = null;
    try { body = await res.json(); } catch { /* none */ }
    return { status: res.status, body, data: body?.data };
};

const pw = '$2a$12$abcdefghijklmnopqrstuuDummyHashNotUsedForLoginxxxxxxxx';
const ins = async (Model, doc) => (await Model.collection.insertOne({ createdAt: new Date(), updatedAt: new Date(), ...doc })).insertedId;
const V1 = await ins(M.Vendor, {
    name: 'Vikram Rao', ownerName: 'Vikram Rao', storeName: 'Vee Electronics', email: 'vee-private@example.com', password: pw, phone: '9876501234',
    status: 'approved', isVerified: true, isActive: true, rating: 4.5, reviewCount: 10,
    businessName: 'Vee Electronics Pvt Ltd', tradeName: 'Vee Store', businessType: 'Private Limited',
    gstNumber: '27abcde1234f1z5', panNumber: 'QWERT5678Y', verificationStatus: 'Approved',
    businessAddress: '12 MG Road, Camp', city: 'Pune', state: 'Maharashtra', pincode: '411001',
    bankDetails: { accountName: 'Vee', accountNumber: '123456789012', ifscCode: 'HDFC0001234', bankName: 'HDFC' },
    documents: { gst: 'https://secret.example/gst.pdf' },
});
const V2 = await ins(M.Vendor, { name: 'Wen', storeName: 'Wen Traders', email: 'wen@example.com', password: pw, status: 'approved', isVerified: true, isActive: true });
const V3 = await ins(M.Vendor, { name: 'Pending Pat', storeName: 'Pending Store', email: 'pat@example.com', password: pw, status: 'pending', isActive: true });
const SHOP = await ins(M.ManagedShop, { name: 'PLE Own Store', status: 'active' });
const MV = await ins(M.ManagedVendorUser, { name: 'Managed', email: 'mv@example.com', password: pw, shopId: SHOP, status: 'active' });
const TV1 = signAccessToken({ id: String(V1), role: 'vendor' });
const TV2 = signAccessToken({ id: String(V2), role: 'vendor' });
const TMV = signAccessToken({ id: String(MV), role: 'managed_vendor' });
console.log('In-memory DB ready.\n');

const hasLeak = (obj) => {
    const s = JSON.stringify(obj);
    return ['9876501234', 'vee-private@example.com', 'QWERT5678Y', '123456789012', 'HDFC0001234', 'secret.example', 'passw'].filter((x) => s.includes(x));
};

// 1. Defaults before the vendor sets anything
{
    const pub = await call(null, 'GET', `/vendors/${V1}`);
    const sp = pub.data?.storeProfile;
    check('Public page: default theme when nothing set', pub.status === 200 && sp?.theme?.primaryColor === '#7B0A0A' && sp?.theme?.accentColor === '#F59E0B', sp?.theme);
    check('Public page: real name, business name, GST (upper-case), type', sp?.business?.ownerName === 'Vikram Rao' && sp.business.businessName === 'Vee Electronics Pvt Ltd' && sp.business.gstNumber === '27ABCDE1234F1Z5' && sp.business.businessType === 'Private Limited', sp?.business);
    check('Public page: GST marked verified when PLE approved the business', sp?.business?.gstVerified === true, sp?.business?.gstVerified);
    check('Public page: full address', sp?.business?.address?.text === '12 MG Road, Camp, Pune, Maharashtra 411001', sp?.business?.address?.text);
    check('Public page: NO phone / email / PAN / bank / documents leaked', hasLeak(pub.body).length === 0, hasLeak(pub.body));
    const bare = await call(null, 'GET', `/vendors/${V2}`);
    check('Vendor with no details: page still loads, empty address/GST', bare.status === 200 && !bare.data?.storeProfile?.business?.gstNumber && bare.data?.storeProfile?.business?.address === null, bare.data?.storeProfile?.business);
    const list = await call(null, 'GET', '/vendors/all');
    const row = list.data?.vendors?.find((v) => String(v.id) === String(V1));
    check('Seller LIST stays lean: no GST / address / profile', !!row && !row.storeProfile && !JSON.stringify(row).includes('27ABCDE'), Object.keys(row || {}));
    check('Not-approved vendor is not public (404)', (await call(null, 'GET', `/vendors/${V3}`)).status === 404, 404);
}

// 2. Vendor edits
let saved;
{
    const none = await call(null, 'GET', '/vendor/store-profile');
    check('Store profile needs login (401)', none.status === 401, none.status);
    const g = await call(TV1, 'GET', '/vendor/store-profile');
    check('Vendor loads their store profile with a public preview', g.status === 200 && g.data?.public?.business?.gstNumber === '27ABCDE1234F1Z5', g.status);

    const r = await call(TV1, 'PUT', '/vendor/store-profile', {
        storeLogo: 'https://res.cloudinary.test/logo.png', bannerUrl: 'https://res.cloudinary.test/banner.jpg',
        tagline: 'Genuine electronics since 2010', about: 'We sell laptops, phones and accessories with a 1-year warranty.',
        businessHours: 'Mon-Sat 10AM-7PM', theme: { primaryColor: '#1d4ed8', accentColor: '#f97316' },
    });
    saved = r.data;
    check('Save profile -> 200', r.status === 200, `${r.status} ${r.body?.message}`);
    check('Colours stored upper-case', saved?.public?.theme?.primaryColor === '#1D4ED8' && saved.public.theme.accentColor === '#F97316', saved?.public?.theme);

    const pub = await call(null, 'GET', `/vendors/${V1}`);
    const sp = pub.data?.storeProfile;
    check('Customer page shows the new theme, banner, tagline, about, hours', sp?.theme?.primaryColor === '#1D4ED8' && sp.bannerUrl.endsWith('banner.jpg') && sp.tagline === 'Genuine electronics since 2010' && /warranty/.test(sp.about) && sp.businessHours === 'Mon-Sat 10AM-7PM', sp);
    check('Customer page shows the new logo (dynamic from the vendor panel)', pub.data?.storeLogo === 'https://res.cloudinary.test/logo.png', pub.data?.storeLogo);
    check('Still no private data after saving a profile', hasLeak(pub.body).length === 0, hasLeak(pub.body));

    // partial update leaves the rest alone
    const part = await call(TV1, 'PUT', '/vendor/store-profile', { tagline: 'Trusted since 2010' });
    check('Partial update changes only that field', part.status === 200 && part.data?.public?.tagline === 'Trusted since 2010' && part.data.public.about === saved.public.about && part.data.public.theme.primaryColor === '#1D4ED8', part.data?.public?.tagline);
    const clear = await call(TV1, 'PUT', '/vendor/store-profile', { bannerUrl: '' });
    check('Banner can be removed', clear.status === 200 && clear.data?.public?.bannerUrl === '', clear.data?.public?.bannerUrl);
}

// 3. Validation and privacy rules
{
    const bad = async (label, body, re) => {
        const r = await call(TV1, 'PUT', '/vendor/store-profile', body);
        check(`Rejected: ${label} (400)`, r.status === 400 && (!re || re.test(r.body?.message || '')), `${r.status} ${r.body?.message}`);
    };
    await bad('empty update', {}, /Nothing/);
    await bad('bad colour', { theme: { primaryColor: 'blue' } }, /colour/i);
    await bad('colour without #', { theme: { accentColor: 'FF0000' } }, /colour/i);
    await bad('phone number in tagline', { tagline: 'Call me on 9876543210' }, /contact/i);
    await bad('email in about', { about: 'Mail me at me@shop.com for deals' }, /contact/i);
    await bad('link in about', { about: 'Visit https://my-own-site.com for cheaper prices' }, /contact/i);
    await bad('tagline too long', { tagline: 'x'.repeat(101) }, /100/);
    await bad('about too long', { about: 'x '.repeat(800) }, /1500/);
    await bad('banner that is not https', { bannerUrl: 'http://insecure.example/b.jpg' }, /https/);
    await bad('banner that is javascript:', { bannerUrl: 'javascript:alert(1)' }, /https/);
    await bad('logo that is not a link', { storeLogo: 'data/logos/logo.png' }, /https/);
    await bad('banner pasted from another website', { bannerUrl: 'https://tracker.example/pixel.gif' }, /uploaded here/);
    await bad('logo pasted from another website', { storeLogo: 'https://evil.example/logo.png' }, /uploaded here/);
    // an older, already-stored outside link is not rejected when the form sends it back unchanged
    await M.Vendor.collection.updateOne({ _id: V2 }, { $set: { storeLogo: 'https://old-host.example/logo.png' } });
    const keep = await call(TV2, 'PUT', '/vendor/store-profile', { storeLogo: 'https://old-host.example/logo.png', tagline: 'Still fine' });
    check('A stored older logo link can be re-saved unchanged', keep.status === 200 && keep.data?.storeLogo === 'https://old-host.example/logo.png', keep.status);
    const swap = await call(TV2, 'PUT', '/vendor/store-profile', { storeLogo: 'https://another-host.example/logo.png' });
    check('...but replacing it with another outside link is refused', swap.status === 400, swap.status);
    const after = await call(TV1, 'GET', '/vendor/store-profile');
    check('Rejected saves changed nothing', after.data?.public?.tagline === 'Trusted since 2010', after.data?.public?.tagline);

    // Identity fields cannot be changed through the store profile
    const sneaky = await call(TV1, 'PUT', '/vendor/store-profile', { tagline: 'ok', gstNumber: '29ZZZZZ9999Z1Z9', ownerName: 'Someone Else', businessAddress: 'Elsewhere', email: 'new@x.com', verificationStatus: 'Approved' });
    const doc = await M.Vendor.findById(V1).lean();
    check('GST / owner / address / email cannot be changed here', sneaky.status === 200 && doc.gstNumber === '27abcde1234f1z5' && doc.ownerName === 'Vikram Rao' && doc.businessAddress === '12 MG Road, Camp' && doc.email === 'vee-private@example.com', { gst: doc.gstNumber, owner: doc.ownerName });

    // Text saved before the rule existed is still filtered on the way out
    await M.Vendor.collection.updateOne({ _id: V2 }, { $set: { 'storeProfile.about': 'WhatsApp me 9876543210 for cheap deals', 'storeProfile.tagline': 'Fine tagline' } });
    const pubV2 = await call(null, 'GET', `/vendors/${V2}`);
    check('Old text with contact details is hidden from customers', pubV2.data?.storeProfile?.about === '' && pubV2.data.storeProfile.tagline === 'Fine tagline', pubV2.data?.storeProfile);
    await M.Vendor.collection.updateOne({ _id: V2 }, { $set: { 'storeProfile.theme.primaryColor': 'url(javascript:x)' } });
    const pubV2b = await call(null, 'GET', `/vendors/${V2}`);
    check('A corrupted colour falls back to the default theme', pubV2b.data?.storeProfile?.theme?.primaryColor === '#7B0A0A', pubV2b.data?.storeProfile?.theme);
}

// 4. Isolation and managed accounts
{
    const w = await call(TV2, 'PUT', '/vendor/store-profile', { tagline: 'Wen only' });
    const v1 = await call(null, 'GET', `/vendors/${V1}`);
    check("A vendor's edit never touches another vendor", w.status === 200 && v1.data?.storeProfile?.tagline === 'ok', v1.data?.storeProfile?.tagline);
    const mg = await call(TMV, 'PUT', '/vendor/store-profile', { tagline: 'nope' });
    check('Managed vendor cannot edit (403)', mg.status === 403, mg.status);
    const mg2 = await call(TMV, 'GET', '/vendor/store-profile');
    check('Managed vendor cannot load the editor (403)', mg2.status === 403, mg2.status);
    const shop = await call(null, 'GET', `/vendors/${SHOP}`);
    check('Managed PLE shop page still works', shop.status === 200 && shop.data?.isManagedShop === true, shop.status);
}

console.log(`\nSUMMARY ${JSON.stringify({ PASS: pass, FAIL: fail })}`);
await mongoose.disconnect();
server.close();
await mem.stop();
process.exit(fail ? 1 : 0);
