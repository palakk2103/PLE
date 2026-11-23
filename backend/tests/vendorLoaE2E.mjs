// Usage (from /backend): node tests/vendorLoaE2E.mjs
// End-to-end for the vendor LOA (Letter of Authorization): upload, one-per-vendor, view, replace
// (back to pending, old cloud file removed), delete, file-type limits, isolation, admin review.
// In-memory MongoDB; Cloudinary is stubbed. Never touches Atlas / email.
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
process.env.MONGO_URI = mem.getUri('ple_vendor_loa');
Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', SMTP_USER: 'x', SMTP_PASS: 'x', FIREBASE_SERVICE_ACCOUNT: '', SHIPROCKET_EMAIL: '', SHIPROCKET_PASSWORD: '', NODE_ENV: 'development' });

const mongoose = (await import(pathToFileURL(reqB.resolve('mongoose')).href)).default;
const { default: cloudinary } = await imp('config/cloudinary.js');
const uploads = [];
const destroyed = [];
let failUploads = false;
let n = 0;
cloudinary.uploader.upload = async (filePath, opts) => {
    if (failUploads) throw new Error('stubbed cloudinary outage');
    n += 1;
    const id = `${opts.folder}/file${n}`;
    uploads.push({ folder: opts.folder, id });
    return { secure_url: `https://res.cloudinary.test/${id}`, public_id: id, resource_type: 'raw' };
};
cloudinary.uploader.destroy = async (id) => { destroyed.push(id); return { result: 'ok' }; };

const { default: app } = await imp('app.js');
const { signAccessToken } = await imp('config/jwt.js');
await mongoose.connect(process.env.MONGO_URI);
const server = http.createServer(app);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/api`;

const M = {};
for (const x of ['Admin', 'Vendor', 'VendorDocument', 'Notification']) M[x] = (await imp(`models/${x}.model.js`)).default;

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
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const form = (fields, file) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(fields)) f.append(k, v);
    if (file) f.append('file', new Blob([file.bytes], { type: file.type }), file.name);
    return f;
};
const waitFor = async (fn, ms = 3000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 50)); } return false; };
const TMP = path.join(BACKEND, 'uploads', 'tmp');
const tmpCount = () => (fs.existsSync(TMP) ? fs.readdirSync(TMP).length : 0);

const pw = '$2a$12$abcdefghijklmnopqrstuuDummyHashNotUsedForLoginxxxxxxxx';
const ins = async (Model, doc) => (await Model.collection.insertOne({ createdAt: new Date(), updatedAt: new Date(), ...doc })).insertedId;
const ADMIN = await ins(M.Admin, { name: 'Admin', email: 'admin@example.com', password: pw, role: 'admin', isActive: true, status: 'active' });
const V1 = await ins(M.Vendor, { name: 'Vee', storeName: 'Vee Electronics', email: 'vee@example.com', password: pw, status: 'approved', isVerified: true, isActive: true });
const V2 = await ins(M.Vendor, { name: 'Wen', storeName: 'Wen Traders', email: 'wen@example.com', password: pw, status: 'approved', isVerified: true, isActive: true });
const TV1 = signAccessToken({ id: String(V1), role: 'vendor' });
const TV2 = signAccessToken({ id: String(V2), role: 'vendor' });
const TA = signAccessToken({ id: String(ADMIN), role: 'admin' });
console.log('In-memory DB ready.\n');

// 1. Upload
let loaId;
{
    const before = tmpCount();
    const r = await call(TV1, 'POST', '/vendor/documents', { form: form({ category: 'LOA' }, { bytes: PDF, type: 'application/pdf', name: 'loa.pdf' }) });
    loaId = r.data?._id;
    check('Upload LOA without a name -> 201, default name', r.status === 201 && r.data?.category === 'LOA' && /Letter of Authorization/.test(r.data?.name), `${r.status} ${r.data?.name || r.body?.message}`);
    check('Upload: stored under vendors/documents, pending, version 1', uploads.at(-1)?.folder === 'vendors/documents' && r.data?.status === 'pending' && r.data?.version === 1, r.data?.status);
    check('Upload: temp file cleaned up', tmpCount() === before, `${before} -> ${tmpCount()}`);
    await waitFor(async () => (await M.Notification.countDocuments({ recipientType: 'admin', title: /LOA/ })) >= 1);
    const admins = await M.Notification.countDocuments({ recipientType: 'admin', title: /LOA/ });
    check('Upload: admins notified', admins === 1, admins);

    const dup = await call(TV1, 'POST', '/vendor/documents', { form: form({ category: 'LOA' }, { bytes: PNG, type: 'image/png', name: 'again.png' }) });
    check('Second LOA rejected (409, use Replace)', dup.status === 409 && /Replace/i.test(dup.body?.message || ''), `${dup.status} ${dup.body?.message}`);
    check('Second LOA: still one record, no extra upload', (await M.VendorDocument.countDocuments({ vendorId: V1, category: 'LOA' })) === 1 && tmpCount() === before, tmpCount());

    const bad = await call(TV2, 'POST', '/vendor/documents', { form: form({ category: 'LOA' }, { bytes: Buffer.from('hello'), type: 'text/plain', name: 'loa.txt' }) });
    check('LOA as .txt rejected (400)', bad.status === 400, `${bad.status} ${bad.body?.message}`);
    const word = await call(TV2, 'POST', '/vendor/documents', { form: form({ category: 'LOA' }, { bytes: Buffer.from('x'), type: 'application/msword', name: 'loa.doc' }) });
    check('LOA as Word rejected (400)', word.status === 400, `${word.status} ${word.body?.message}`);
    const nofile = await call(TV2, 'POST', '/vendor/documents', { form: form({ category: 'LOA' }) });
    check('LOA without a file rejected (400)', nofile.status === 400, `${nofile.status}`);
    check('Rejected uploads leave no record and no temp files', (await M.VendorDocument.countDocuments({ vendorId: V2 })) === 0 && tmpCount() === before, tmpCount());

    const other = await call(TV1, 'POST', '/vendor/documents', { form: form({ name: 'GST cert', category: 'Certificate' }, { bytes: Buffer.from('x'), type: 'application/msword', name: 'gst.doc' }) });
    check('Other categories unchanged (Word still allowed)', other.status === 201, `${other.status} ${other.body?.message}`);
    const noName = await call(TV1, 'POST', '/vendor/documents', { form: form({ category: 'License' }, { bytes: PDF, type: 'application/pdf', name: 'l.pdf' }) });
    check('Other categories still need a name (400)', noName.status === 400, `${noName.status}`);
    const anon = await call(null, 'POST', '/vendor/documents', { form: form({ category: 'LOA' }, { bytes: PDF, type: 'application/pdf', name: 'a.pdf' }) });
    check('Upload requires login (401)', anon.status === 401, anon.status);
}

// 2. Isolation: another vendor can have their own LOA, cannot touch this one
{
    const r2 = await call(TV2, 'POST', '/vendor/documents', { form: form({ category: 'LOA' }, { bytes: PNG, type: 'image/png', name: 'wen.png' }) });
    check('Another vendor can upload their own LOA (PNG)', r2.status === 201, `${r2.status} ${r2.body?.message}`);
    const mine = await call(TV1, 'GET', '/vendor/documents');
    check('List shows only own documents', mine.status === 200 && mine.data.every((d) => String(d.vendorId) === String(V1)) && mine.data.some((d) => d.category === 'LOA'), mine.data?.length);
    const steal = await call(TV2, 'PUT', `/vendor/documents/${loaId}`, { form: form({}, { bytes: PDF, type: 'application/pdf', name: 'x.pdf' }) });
    check("Cannot replace another vendor's LOA (404)", steal.status === 404, steal.status);
    const del = await call(TV2, 'DELETE', `/vendor/documents/${loaId}`);
    check("Cannot delete another vendor's LOA (404)", del.status === 404, del.status);
}

// 3. Admin reviews it, then the vendor replaces it
{
    const adminList = await call(TA, 'GET', `/admin/vendors/${V1}/documents`);
    check('Admin sees the LOA in the vendor documents', adminList.status === 200 && adminList.data.some((d) => d.category === 'LOA'), adminList.status);
    const ok = await call(TA, 'PATCH', `/admin/vendors/documents/${loaId}/status`, { json: { status: 'approved' } });
    check('Admin approves the LOA', ok.status === 200 && ok.data?.status === 'approved', `${ok.status} ${ok.body?.message}`);

    const oldDoc = await M.VendorDocument.findById(loaId).lean();
    const before = tmpCount();
    const r = await call(TV1, 'PUT', `/vendor/documents/${loaId}`, { form: form({}, { bytes: PNG, type: 'image/png', name: 'signed.png' }) });
    check('Replace -> 200, same id', r.status === 200 && String(r.data?._id) === String(loaId), `${r.status} ${r.body?.message}`);
    check('Replace: new file URL, name and type', r.data?.fileUrl !== oldDoc.fileUrl && r.data?.fileName === 'signed.png' && r.data?.fileType === 'image/png', r.data?.fileUrl);
    check('Replace: back to pending, version 2, replacedAt set', r.data?.status === 'pending' && r.data?.version === 2 && !!r.data?.replacedAt, `${r.data?.status} v${r.data?.version}`);
    check('Replace: old cloud file deleted, new one kept', destroyed.includes(oldDoc.filePublicId) && !destroyed.includes(r.data?.filePublicId), destroyed);
    check('Replace: temp file cleaned up', tmpCount() === before, `${before} -> ${tmpCount()}`);
    check('Replace: still exactly one LOA', (await M.VendorDocument.countDocuments({ vendorId: V1, category: 'LOA' })) === 1, 'one');
    await waitFor(async () => (await M.Notification.countDocuments({ recipientType: 'admin', title: /LOA replaced/ })) >= 1);
    check('Replace: admins notified again', (await M.Notification.countDocuments({ recipientType: 'admin', title: /LOA replaced/ })) === 1, 'notified');

    const bad = await call(TV1, 'PUT', `/vendor/documents/${loaId}`, { form: form({}, { bytes: Buffer.from('x'), type: 'text/plain', name: 'x.txt' }) });
    check('Replace LOA with .txt rejected (400)', bad.status === 400, `${bad.status}`);
    const none = await call(TV1, 'PUT', `/vendor/documents/${loaId}`, { form: form({}) });
    check('Replace without a file rejected (400)', none.status === 400, `${none.status}`);
    const after = await M.VendorDocument.findById(loaId).lean();
    check('Failed replaces change nothing', after.version === 2 && after.fileUrl === r.data.fileUrl, after.version);

    failUploads = true;
    const outage = await call(TV1, 'PUT', `/vendor/documents/${loaId}`, { form: form({}, { bytes: PDF, type: 'application/pdf', name: 'z.pdf' }) });
    failUploads = false;
    const still = await M.VendorDocument.findById(loaId).lean();
    check('Cloud outage: replace fails, old file and record untouched', outage.status >= 400 && still.fileUrl === r.data.fileUrl && still.version === 2 && !destroyed.includes(r.data.filePublicId), `${outage.status}`);
    check('Cloud outage: no leftover temp files', tmpCount() === before, tmpCount());

    const rej = await call(TA, 'PATCH', `/admin/vendors/documents/${loaId}/status`, { json: { status: 'rejected' } });
    const again = await call(TV1, 'PUT', `/vendor/documents/${loaId}`, { form: form({ expiryDate: '2027-03-01' }, { bytes: PDF, type: 'application/pdf', name: 'fixed.pdf' }) });
    check('Rejected LOA can be replaced -> pending again, expiry set', rej.status === 200 && again.data?.status === 'pending' && again.data?.version === 3 && String(again.data?.expiryDate).startsWith('2027-03-01'), `${again.status} ${again.data?.status}`);
    const clear = await call(TV1, 'PUT', `/vendor/documents/${loaId}`, { form: form({ expiryDate: '' }, { bytes: PDF, type: 'application/pdf', name: 'f2.pdf' }) });
    check('Replace can clear the expiry date', clear.data?.expiryDate === null, clear.data?.expiryDate);
    const badDate = await call(TV1, 'PUT', `/vendor/documents/${loaId}`, { form: form({ expiryDate: 'not-a-date' }, { bytes: PDF, type: 'application/pdf', name: 'f3.pdf' }) });
    check('Replace with an invalid date rejected (400)', badDate.status === 400, badDate.status);
}

// 4. Delete, then upload again
{
    const cur = await M.VendorDocument.findById(loaId).lean();
    const d = await call(TV1, 'DELETE', `/vendor/documents/${loaId}`);
    check('Delete LOA -> 200', d.status === 200, `${d.status} ${d.body?.message}`);
    check('Delete: record gone and cloud file removed', !(await M.VendorDocument.findById(loaId)) && destroyed.includes(cur.filePublicId), destroyed.at(-1));
    const gone = await call(TV1, 'PUT', `/vendor/documents/${loaId}`, { form: form({}, { bytes: PDF, type: 'application/pdf', name: 'x.pdf' }) });
    check('Replace of a deleted LOA -> 404', gone.status === 404, gone.status);
    const fresh = await call(TV1, 'POST', '/vendor/documents', { form: form({ category: 'LOA' }, { bytes: PDF, type: 'application/pdf', name: 'new.pdf' }) });
    check('After deleting, a new LOA can be uploaded', fresh.status === 201 && fresh.data?.version === 1, `${fresh.status}`);

    // A regular document can be replaced too (any type allowed)
    const cert = (await call(TV1, 'GET', '/vendor/documents')).data.find((x) => x.category === 'Certificate');
    const rc = await call(TV1, 'PUT', `/vendor/documents/${cert._id}`, { form: form({ name: 'GST certificate 2026' }, { bytes: Buffer.from('y'), type: 'application/msword', name: 'gst2.doc' }) });
    check('Regular documents can be replaced and renamed', rc.status === 200 && rc.data?.name === 'GST certificate 2026' && rc.data?.status === 'pending', `${rc.status} ${rc.body?.message}`);
}

// 5. Data integrity: the unique index backs the one-LOA rule even under a race
{
    await M.VendorDocument.syncIndexes();
    const base = { vendorId: V2, name: 'dup', category: 'LOA', fileUrl: 'https://x/y', filePublicId: 'p', fileName: 'a.pdf', fileType: 'application/pdf', fileSize: 1 };
    let dupErr = null;
    try { await M.VendorDocument.create(base); } catch (e) { dupErr = e; }
    check('Database refuses a second LOA for the same vendor', dupErr?.code === 11000, dupErr?.code || 'no error');
    const ok = await M.VendorDocument.create({ ...base, vendorId: V1, category: 'Other' }).then(() => true).catch(() => false);
    check('Index does not limit other categories', ok, ok);
}

console.log(`\nSUMMARY ${JSON.stringify({ PASS: pass, FAIL: fail })}`);
await mongoose.disconnect();
server.close();
await mem.stop();
process.exit(fail ? 1 : 0);
