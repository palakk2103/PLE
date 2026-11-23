// Usage (from /backend): node tests/vendorDraftE2E.mjs
// Vendor registration draft: save the form, get an emailed single-use resume link, resume on another
// device (or by emailed code), secrets never stored, no email discovery, draft cleared on submit.
// In-memory MongoDB; Cloudinary stubbed; the emailed link/code is captured from the dev log.
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
process.env.MONGO_URI = mem.getUri('ple_vendor_draft');
Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', SMTP_USER: 'x', SMTP_PASS: 'x', FIREBASE_SERVICE_ACCOUNT: '', SHIPROCKET_EMAIL: '', SHIPROCKET_PASSWORD: '', NODE_ENV: 'development', CLIENT_URL: 'https://shop.example.com/' });

const links = [];
const otps = [];
const origLog = console.log;
console.log = (...args) => {
    const line = args.join(' ');
    let m = line.match(/\[VENDOR-DRAFT\] \(non-production\) resume link for (\S+): (\S+)/);
    if (m) { links.push({ email: m[1], url: m[2] }); return; }
    m = line.match(/\[VENDOR-DRAFT\] \(non-production\) resume OTP for (\S+): (\d{6})/);
    if (m) { otps.push({ email: m[1], otp: m[2] }); return; }
    origLog(...args);
};
const linkFor = (email) => [...links].reverse().find((l) => l.email === email);
const otpFor = (email) => [...otps].reverse().find((l) => l.email === email)?.otp;
const tokenOf = (l) => l && new URL(l.url).searchParams.get('resume');

const mongoose = (await import(pathToFileURL(reqB.resolve('mongoose')).href)).default;
const { default: cloudinary } = await imp('config/cloudinary.js');
let n = 0;
cloudinary.uploader.upload = async (filePath, opts) => { n += 1; return { secure_url: `https://res.cloudinary.test/${opts.folder}/f${n}`, public_id: `${opts.folder}/f${n}`, resource_type: 'raw' }; };
const { default: app } = await imp('app.js');
await mongoose.connect(process.env.MONGO_URI);
const server = http.createServer(app);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/api/vendor/auth`;
const Draft = (await imp('models/VendorRegistrationDraft.model.js')).default;
const Vendor = (await imp('models/Vendor.model.js')).default;

let pass = 0, fail = 0;
const check = (name, cond, actual) => {
    cond ? pass++ : fail++;
    origLog(`${cond ? '✅' : '❌'} ${name} → ${typeof actual === 'string' ? actual : JSON.stringify(actual)}`);
};
const post = async (p, body, form) => {
    const res = await fetch(BASE + p, { method: 'POST', headers: form ? {} : { 'Content-Type': 'application/json' }, body: form || JSON.stringify(body) });
    let json = null;
    try { json = await res.json(); } catch { /* none */ }
    return { status: res.status, body: json, data: json?.data };
};
const settle = () => new Promise((r) => setTimeout(r, 200));

const EMAIL = 'vendor.draft@example.com';
const formFields = () => ({
    name: 'Vikram Rao', email: EMAIL, phone: '9876501234', storeName: 'Vee <Electronics>', businessType: 'Private Limited', gstRegistered: false,
    businessName: 'Vee Pvt Ltd', ownerName: 'Vikram Rao', city: 'Pune', state: 'Maharashtra', pincode: '411001',
    bankAccountName: 'Vee Pvt Ltd', bankName: 'HDFC Bank', bankIfscCode: 'HDFC0001234', bankProofType: 'cancelled_cheque', bankAccountType: 'Current',
    address: { street: '12 MG Road', city: 'Pune', state: 'Maharashtra', zipCode: '411001', country: 'India' },
});
const draftBody = (extra = {}) => ({
    email: EMAIL, currentStep: 1, completedSteps: [1],
    data: { form: { ...formFields(), password: 'Secret#123', confirmPassword: 'Secret#123', bankAccountNumber: '123456789012', confirmAccountNumber: '123456789012' } },
    ...extra,
});
origLog('In-memory DB ready.\n');

// 1. First save
let token1;
{
    const bad = await post('/draft/save', { ...draftBody(), email: 'not-an-email' });
    check('Save with an invalid email -> 400', bad.status === 400, `${bad.status} ${bad.body?.message}`);

    const r = await post('/draft/save', draftBody());
    token1 = r.data?.draftToken;
    check('First save -> 201 with an ownership token and resumeLinkSent', r.status === 201 && /^[a-f0-9]{64}$/.test(token1 || '') && r.data?.resumeLinkSent === true, `${r.status} ${r.body?.message}`);
    check('Resume link points at the vendor register page with a 64-char token', /^https:\/\/shop\.example\.com\/vendor\/register\?resume=[a-f0-9]{64}&email=/.test(linkFor(EMAIL)?.url || ''), linkFor(EMAIL)?.url);

    const stored = await Draft.findOne({ email: EMAIL }).select('+resumeLinkHash +tokenHash').lean();
    const raw = JSON.stringify(stored);
    check('Stored: no password, no bank account number', !/Secret#123|123456789012|confirmPassword/.test(raw), Object.keys(stored.data.form));
    check('Stored: the raw link token and owner token are hashed, never kept', !raw.includes(tokenOf(linkFor(EMAIL))) && !raw.includes(token1) && stored.resumeLinkHash?.length === 64, 'hashes only');
    check('Stored: ordinary fields kept (store name, address, bank name)', stored.data.form.storeName === 'Vee <Electronics>' && stored.data.form.address?.city === 'Pune' && stored.data.form.bankName === 'HDFC Bank', stored.data.form.storeName);
}

// 2. Whitelist and size limits
{
    const r = await post('/draft/save', { ...draftBody(), draftToken: token1, data: { form: { ...formFields(), isAdmin: true, role: 'admin', junk: { a: 1 }, storeDescription: 'x'.repeat(5000) } } });
    const stored = await Draft.findOne({ email: EMAIL }).lean();
    check('Unknown fields are dropped, long text truncated', r.status === 200 && !('isAdmin' in stored.data.form) && !('role' in stored.data.form) && !('junk' in stored.data.form) && stored.data.form.storeDescription.length === 500, Object.keys(stored.data.form).length);
    const back = await post('/draft/save', { ...draftBody(), draftToken: token1 });
    check('Owner can keep saving with their token (200, no second email)', back.status === 200 && links.filter((l) => l.email === EMAIL).length === 1, back.status);
    const steal = await post('/draft/save', { ...draftBody(), draftToken: 'a'.repeat(64) });
    const none = await post('/draft/save', draftBody());
    check('Someone without the token cannot overwrite the draft (409)', steal.status === 409 && none.status === 409, `${steal.status}/${none.status}`);
}

// 3. Resume by link on "another device"
let ownerToken2;
{
    const link = linkFor(EMAIL);
    const bad = await post('/draft/resume-link', { email: EMAIL, token: 'f'.repeat(64) });
    check('A wrong link token is refused (400)', bad.status === 400, bad.status);
    const wrongEmail = await post('/draft/resume-link', { email: 'someone.else@example.com', token: tokenOf(link) });
    check('The link only works for its own email (400)', wrongEmail.status === 400, wrongEmail.status);

    const ok = await post('/draft/resume-link', { email: EMAIL, token: tokenOf(link) });
    ownerToken2 = ok.data?.draftToken;
    check('Opening the link restores the form and hands out a new token', ok.status === 200 && ok.data?.data?.form?.storeName === 'Vee <Electronics>' && ownerToken2 && ownerToken2 !== token1, `${ok.status} ${ok.body?.message}`);
    check('Restored form has no password / account number', !ok.data?.data?.form?.password && !ok.data?.data?.form?.bankAccountNumber, Object.keys(ok.data?.data?.form || {}).length);
    const again = await post('/draft/resume-link', { email: EMAIL, token: tokenOf(link) });
    check('The same link cannot be used twice (400)', again.status === 400, again.status);
    const oldTok = await post('/draft/load', { email: EMAIL, draftToken: token1 });
    check('The first device token stops working after a resume (403)', oldTok.status === 403, oldTok.status);
    const newTok = await post('/draft/load', { email: EMAIL, draftToken: ownerToken2 });
    check('The new token loads the draft', newTok.status === 200, newTok.status);
}

// 4. Fresh links, expiry, no email discovery
{
    await Draft.updateOne({ email: EMAIL }, { $set: { resumeLinkSentAt: new Date(Date.now() - 120000) } }); // past the 60s cooldown
    const before = links.length;
    const generic1 = await post('/draft/send-link', { email: EMAIL });
    const generic2 = await post('/draft/send-link', { email: 'nobody@example.com' });
    await settle();
    check('Send-link answers identically for a known and an unknown email', generic1.status === 200 && generic2.status === 200 && generic1.body?.message === generic2.body?.message, generic1.body?.message);
    check('A link was sent only for the real draft', links.length === before + 1 && !linkFor('nobody@example.com'), links.length - before);
    const again = await post('/draft/send-link', { email: EMAIL });
    await settle();
    check('Asking again within a minute does not send another', again.status === 200 && links.length === before + 1, links.length - before);
    const sub = await post('/draft/send-link', { email: 'bad' });
    check('Send-link with an invalid email -> 400', sub.status === 400, sub.status);

    await Draft.updateOne({ email: EMAIL }, { $set: { resumeLinkExpiresAt: new Date(Date.now() - 1000) } });
    const expired = await post('/draft/resume-link', { email: EMAIL, token: tokenOf(linkFor(EMAIL)) });
    check('An expired link is refused (400)', expired.status === 400, expired.status);
    await Draft.updateOne({ email: EMAIL }, { $set: { resumeLinkSentAt: new Date(Date.now() - 120000) } });
    await post('/draft/send-link', { email: EMAIL });
    await settle();
    const fresh = linkFor(EMAIL);
    const ok = await post('/draft/resume-link', { email: EMAIL, token: tokenOf(fresh) });
    check('A newly sent link works', ok.status === 200, ok.status);
    ownerToken2 = ok.data?.draftToken;
}

// 5. Resume by emailed code
{
    const unknown = await post('/draft/request-otp', { email: 'nobody@example.com' });
    const known = await post('/draft/request-otp', { email: EMAIL });
    check('Request-code answers identically for known and unknown emails', unknown.body?.message === known.body?.message && known.status === 200, known.body?.message);
    const code = otpFor(EMAIL);
    check('A 6-digit code was issued only for the real draft', /^\d{6}$/.test(code || '') && !otpFor('nobody@example.com'), code);
    const wrong = await post('/draft/verify-otp', { email: EMAIL, otp: code === '000000' ? '111111' : '000000' });
    check('Wrong code refused (400)', wrong.status === 400, wrong.status);
    const ok = await post('/draft/verify-otp', { email: EMAIL, otp: code });
    check('Right code restores the draft with a new token', ok.status === 200 && ok.data?.draftToken && ok.data?.data?.form?.storeName, `${ok.status}`);
    const reuse = await post('/draft/verify-otp', { email: EMAIL, otp: code });
    check('A code cannot be reused (400)', reuse.status === 400, reuse.status);
    ownerToken2 = ok.data?.draftToken;
}

// 6. Existing vendor email, discard
{
    await Vendor.create({ name: 'Taken', email: 'taken@example.com', password: 'Passw0rd!', storeName: 'Taken Store' });
    const r = await post('/draft/save', { ...draftBody(), email: 'taken@example.com' });
    check('Cannot start a draft for an email that is already a vendor (409)', r.status === 409, `${r.status} ${r.body?.message}`);
    const bad = await post('/draft/discard', { email: EMAIL, draftToken: 'b'.repeat(64) });
    check('Discard needs the ownership token (403)', bad.status === 403, bad.status);
    const other = await post('/draft/save', { ...draftBody(), email: 'second@example.com' });
    const ok = await post('/draft/discard', { email: 'second@example.com', draftToken: other.data?.draftToken });
    check('Owner can discard their draft', ok.status === 200 && !(await Draft.findOne({ email: 'second@example.com' })), ok.status);
}

// 7. Submitting the real registration clears the draft
{
    const f = new FormData();
    const fields = { ...formFields(), password: 'Passw0rd!', phone: '9876501234', bankAccountNumber: '123456789012', gstRegistered: 'false', address: JSON.stringify(formFields().address) };
    for (const [k, v] of Object.entries(fields)) f.append(k, String(v));
    const pdf = () => new Blob([Buffer.from('%PDF-1.4\n%%EOF')], { type: 'application/pdf' });
    for (const k of ['identityProof', 'bankProof', 'registrationProof']) f.append(k, pdf(), `${k}.pdf`);
    const r = await post('/register', null, f);
    check('Submitting the real registration works (201)', r.status === 201, `${r.status} ${r.body?.message}`);
    check('...and the saved draft is gone', r.status === 201 && !(await Draft.findOne({ email: EMAIL })), 'cleared');
    const after = await post('/draft/resume-link', { email: EMAIL, token: tokenOf(linkFor(EMAIL)) });
    check('...so an old link no longer opens anything (400)', after.status === 400, after.status);
}

origLog(`\nSUMMARY ${JSON.stringify({ PASS: pass, FAIL: fail })}`);
await mongoose.disconnect();
server.close();
await mem.stop();
process.exit(fail ? 1 : 0);
