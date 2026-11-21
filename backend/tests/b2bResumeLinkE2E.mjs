// Usage (from /backend): node tests/b2bResumeLinkE2E.mjs
// B2B registration resume link: the first draft save emails a single-use link; opening it on
// another device restores the draft at the saved step; links expire, can't be reused, are
// replaced by newer links, and the "send me a link" endpoint never reveals which emails exist.
// In-memory MongoDB; the emailed link is captured from the non-production console log.
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
process.env.MONGO_URI = mem.getUri('ple_b2b_resume');
Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', SMTP_USER: 'x', SMTP_PASS: 'x', FIREBASE_SERVICE_ACCOUNT: '', NODE_ENV: 'development', CLIENT_URL: 'https://shop.example.com/' });

// Capture emailed links from the dev log line
const links = [];
const origLog = console.log;
console.log = (...args) => {
    const line = args.join(' ');
    const m = line.match(/\[B2B-DRAFT\] \(non-production\) resume link for (\S+): (\S+)/);
    if (m) links.push({ email: m[1], url: m[2] });
    else origLog(...args);
};
const linkFor = (email) => [...links].reverse().find((l) => l.email === email);
const tokenOf = (l) => l && new URL(l.url).searchParams.get('resume');

const mongoose = (await import(pathToFileURL(reqB.resolve('mongoose')).href)).default;
const { default: app } = await imp('app.js');
await mongoose.connect(process.env.MONGO_URI);
const server = http.createServer(app);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/api/b2b-user/auth`;
const Draft = (await imp('models/B2BRegistrationDraft.model.js')).default;

let pass = 0, fail = 0;
const check = (name, cond, actual) => {
    cond ? pass++ : fail++;
    origLog(`${cond ? '✅' : '❌'} ${name} → ${typeof actual === 'string' ? actual : JSON.stringify(actual)}`);
};
const post = async (p, body) => {
    const res = await fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    let json = null;
    try { json = await res.json(); } catch { /* none */ }
    return { status: res.status, body: json, data: json?.data };
};

const EMAIL = 'founder@acme-traders.example.com';
const draftBody = (extra = {}) => ({
    email: EMAIL, currentStep: 2, completedSteps: [1],
    data: { form: { companyName: 'Acme <Traders>', businessEmail: EMAIL, password: 'Secret#123', secretKey: 'S3cr3t' }, docs: { gst: { url: 'https://cdn.example.com/gst.pdf' } }, employees: [] },
    ...extra,
});
origLog('In-memory DB ready.\n');

// 1. First save emails a link
let ownerToken, link1;
{
    const r = await post('/draft/save', draftBody());
    ownerToken = r.data?.draftToken;
    link1 = linkFor(EMAIL);
    check('First save: 201 + resumeLinkSent', r.status === 201 && r.data?.resumeLinkSent === true, `${r.status} ${r.body?.message}`);
    check('Link emailed to the draft email, points at /b2b/register', !!link1 && link1.url.startsWith('https://shop.example.com/b2b/register?resume=') && link1.url.includes(`email=${encodeURIComponent(EMAIL)}`), link1?.url?.slice(0, 80));
    check('Link token is 64 hex chars', /^[a-f0-9]{64}$/.test(tokenOf(link1) || ''), tokenOf(link1)?.length);
    const stored = await Draft.findOne({ email: EMAIL }).select('+resumeLinkHash +resumeLinkExpiresAt').lean();
    check('Only a hash of the link token is stored', stored?.resumeLinkHash && stored.resumeLinkHash !== tokenOf(link1) && stored.resumeLinkHash.length === 64, stored?.resumeLinkHash?.slice(0, 8));
    const days = (new Date(stored.resumeLinkExpiresAt) - Date.now()) / 86400000;
    check('Link valid ~7 days', days > 6.9 && days <= 7, days.toFixed(2));

    const before = links.length;
    const upd = await post('/draft/save', draftBody({ draftToken: ownerToken, currentStep: 3, completedSteps: [1, 2] }));
    check('Later saves by the owner do not send more emails', upd.status === 200 && links.length === before, [upd.status, links.length - before]);
}

// 2. Open the link (another device)
{
    const bad = await post('/draft/resume-link', { email: EMAIL, token: 'f'.repeat(64) });
    check('Wrong token -> 400', bad.status === 400 && /invalid, already used or expired/.test(bad.body?.message), `${bad.status} ${bad.body?.message}`);
    const junk = await post('/draft/resume-link', { email: EMAIL, token: 'abc' });
    check('Malformed token -> 400', junk.status === 400, junk.status);
    const otherEmail = await post('/draft/resume-link', { email: 'someone@example.com', token: tokenOf(link1) });
    check('Right token, wrong email -> 400', otherEmail.status === 400, otherEmail.status);

    const r = await post('/draft/resume-link', { email: EMAIL, token: tokenOf(link1) });
    check('Valid link -> draft restored at saved step', r.status === 200 && r.data?.currentStep === 3 && JSON.stringify(r.data?.completedSteps) === '[1,2]' && r.data?.data?.form?.companyName === 'Acme <Traders>', [r.status, r.data?.currentStep, r.data?.completedSteps]);
    check('Uploaded docs come back', r.data?.data?.docs?.gst?.url === 'https://cdn.example.com/gst.pdf', r.data?.data?.docs);
    check('Secrets were never stored / returned', !('password' in (r.data?.data?.form || {})) && !('secretKey' in (r.data?.data?.form || {})), Object.keys(r.data?.data?.form || {}));
    const newOwner = r.data?.draftToken;
    check('New ownership token issued', /^[a-f0-9]{64}$/.test(newOwner || '') && newOwner !== ownerToken, newOwner?.slice(0, 8));
    const load = await post('/draft/load', { email: EMAIL, draftToken: newOwner });
    check('New device can keep loading/saving with its token', load.status === 200, load.status);
    const save = await post('/draft/save', draftBody({ draftToken: newOwner, currentStep: 4, completedSteps: [1, 2, 3] }));
    check('New device can save progress', save.status === 200 && save.data?.currentStep === 4, [save.status, save.data?.currentStep]);
    const old = await post('/draft/load', { email: EMAIL, draftToken: ownerToken });
    check('Old browser token no longer works (ownership moved)', old.status === 403, old.status);
    ownerToken = newOwner;

    const reuse = await post('/draft/resume-link', { email: EMAIL, token: tokenOf(link1) });
    check('Same link cannot be used twice', reuse.status === 400, reuse.status);
}

// 3. "Email me a link" endpoint
{
    const before = links.length;
    const unknown = await post('/draft/send-link', { email: 'nobody@example.com' });
    const generic = 'If a saved registration exists for this email, we have emailed a link to continue it.';
    check('Unknown email: same generic answer, nothing sent', unknown.status === 200 && unknown.body?.message === generic && links.length === before, [unknown.status, links.length - before]);
    const badEmail = await post('/draft/send-link', { email: 'not-an-email' });
    check('Invalid email -> 400', badEmail.status === 400, badEmail.status);

    // the first link was sent < 60s ago -> cooldown applies even though it was used
    const cool = await post('/draft/send-link', { email: EMAIL });
    check('Cooldown: no second email within 60s, same generic answer', cool.status === 200 && cool.body?.message === generic && links.length === before, [cool.status, links.length - before]);

    await Draft.updateOne({ email: EMAIL }, { $set: { resumeLinkSentAt: new Date(Date.now() - 120000) } });
    const r = await post('/draft/send-link', { email: ' Founder@ACME-traders.example.com ' });
    const link2 = linkFor(EMAIL);
    check('Request a new link (email case/space-insensitive)', r.status === 200 && links.length === before + 1 && tokenOf(link2) !== tokenOf(link1), [r.status, links.length - before]);

    await Draft.updateOne({ email: EMAIL }, { $set: { resumeLinkSentAt: new Date(Date.now() - 120000) } });
    await post('/draft/send-link', { email: EMAIL });
    const link3 = linkFor(EMAIL);
    const oldLink = await post('/draft/resume-link', { email: EMAIL, token: tokenOf(link2) });
    check('A newer link cancels the previous one', oldLink.status === 400, oldLink.status);

    await Draft.updateOne({ email: EMAIL }, { $set: { resumeLinkExpiresAt: new Date(Date.now() - 1000) } });
    const expired = await post('/draft/resume-link', { email: EMAIL, token: tokenOf(link3) });
    check('Expired link -> 400', expired.status === 400, expired.status);
}

// 4. Submitted registrations can't be reopened by link
{
    await Draft.updateOne({ email: EMAIL }, { $set: { resumeLinkSentAt: new Date(Date.now() - 120000) } });
    await post('/draft/send-link', { email: EMAIL });
    const link4 = linkFor(EMAIL);
    await Draft.updateOne({ email: EMAIL }, { $set: { status: 'Submitted' } });
    const r = await post('/draft/resume-link', { email: EMAIL, token: tokenOf(link4) });
    check('Submitted registration: link refused', r.status === 400, r.status);
    const before = links.length;
    await Draft.updateOne({ email: EMAIL }, { $set: { resumeLinkSentAt: new Date(Date.now() - 120000) } });
    await post('/draft/send-link', { email: EMAIL });
    check('Submitted registration: no new links sent', links.length === before, links.length - before);
}

// 5. OTP resume still works (regression)
{
    const E2 = 'otp-user@example.com';
    await post('/draft/save', { ...draftBody(), email: E2, data: { form: { businessEmail: E2 } } });
    const req = await post('/draft/request-otp', { email: E2 });
    const d = await Draft.findOne({ email: E2 }).select('+otpHash').lean();
    check('OTP flow still works alongside links', req.status === 200 && !!d?.otpHash, [req.status, !!d?.otpHash]);
}

origLog(`\n${pass} passed, ${fail} failed`);
server.close();
await mongoose.disconnect();
await mem.stop();
process.exit(fail ? 1 : 0);
