/**
 * API tests for the 4-step B2B registration + email-verified drafts.
 * Run against the isolated server:  node testing_scripts/e2e-server.js 5055 > /tmp/e2e.log &
 *                                    node testing_scripts/test-b2b-registration.js http://localhost:5055 /tmp/e2e.log
 */
import fs from 'node:fs';

const base = process.argv[2] || 'http://localhost:5055';
const logFile = process.argv[3] || '/tmp/e2e.log';
const API = `${base}/api/b2b-user/auth`;
let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  ' + extra}`); };

const post = async (path, body, headers = {}) => {
    const r = await fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
};
const upload = async (name, bytes, type) => {
    const fd = new FormData();
    fd.append('file', new Blob([bytes], { type }), name);
    const r = await fetch(`${API}/upload-registration-doc`, { method: 'POST', body: fd });
    return { status: r.status, body: await r.json().catch(() => ({})) };
};
const readOtp = (email) => {
    const m = [...fs.readFileSync(logFile, 'utf8').matchAll(new RegExp(`resume OTP for ${email}: (\\d{6})`, 'g'))];
    return m.length ? m[m.length - 1][1] : null;
};

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
const doc = (n) => ({ url: `https://example.test/${n}.pdf`, fileName: `${n}.pdf`, mimeType: 'application/pdf', size: 100 });
const stamp = Date.now();

const payload = (tag, gst) => ({
    version: 2,
    companyData: {
        companyName: `Test Co ${tag}`, businessType: 'Private Limited Company', businessEmail: `co-${tag}-${stamp}@example.test`,
        businessPhone: '9876543210', secretKey: 'secret123',
        addressDetails: { line1: '1 Test Rd', country: 'India', state: 'Maharashtra', city: 'Mumbai', pincode: '400001' },
        addressProof: doc('addr'),
        bankDetails: { accountHolderName: 'Test Co', bankName: 'HDFC', accountNumber: '123456789012', ifscCode: 'HDFC0001234', branchName: 'BKC', accountType: 'Current' },
        bankDocumentType: 'bank_statement', bankDocument: doc('bank'),
        gstRegistered: gst,
        ...(gst ? { gstNumber: '27AAPCG9838F1Z1', gstDetails: { legalName: 'Test Co' }, gstCertificate: doc('gst') } : {}),
        companyRegistrationProof: doc('reg'), acceptanceExecutionDocument: doc('agr'),
    },
    signatoryData: { fullName: 'Sig Nator', designation: 'Director', email: `sig-${tag}-${stamp}@example.test`, mobile: '9876500001', identityDocument: doc('id'), authorisationDocument: doc('auth'), declarationAccepted: true },
    adminData: { adminName: 'Sig Nator', adminEmail: `sig-${tag}-${stamp}@example.test`, adminPhone: '9876500001', sameAsSignatory: true, password: 'Passw0rd1', confirmPassword: 'Passw0rd1' },
    employees: [],
});

// ---- uploads ----
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
let r = await upload('a.png', PNG, 'image/png');
ok(r.status === 200 && r.body.data?.url, 'valid PNG upload accepted', JSON.stringify(r.body));
r = await upload('evil.exe', Buffer.from('MZ....'), 'application/octet-stream');
ok(r.status === 400, 'invalid file type rejected', JSON.stringify(r));
r = await upload('fake.pdf', Buffer.from('not really a pdf at all'), 'application/pdf');
ok(r.status === 400, 'extension/content mismatch rejected', JSON.stringify(r));
r = await upload('big.pdf', Buffer.concat([PDF, Buffer.alloc(5.5 * 1024 * 1024)]), 'application/pdf');
ok(r.status === 400, 'oversized file rejected', JSON.stringify(r));

// ---- registration validation ----
let p = payload('v', false);
p.companyData.bankDetails.ifscCode = 'BAD';
p.adminData.password = 'weak'; p.adminData.confirmPassword = 'other';
p.signatoryData.declarationAccepted = false;
r = await post('/register', p);
ok(r.status === 400 && /IFSC/.test(r.body.message) && /declaration/.test(r.body.message) && /Passwords do not match/.test(r.body.message), 'invalid IFSC / password mismatch / missing declaration rejected', JSON.stringify(r.body));

p = payload('gstyes', true);
delete p.companyData.gstCertificate; p.companyData.gstNumber = 'INVALID';
r = await post('/register', p);
ok(r.status === 400 && /GSTIN/.test(r.body.message) && /GST certificate/.test(r.body.message), 'GST=Yes requires valid GSTIN + certificate (backend)', JSON.stringify(r.body));

// ---- GST = No registers without GST data (stale GST data in payload is discarded) ----
p = payload('gstno', false);
p.companyData.gstNumber = '27AAPCG9838F1Z1'; p.companyData.gstCertificate = doc('stale');
r = await post('/register', p);
ok(r.status === 201, 'GST=No registration succeeds without GST fields', JSON.stringify(r.body));
ok(r.body.data?.company?.gstRegistered === false && !r.body.data.company.gstNumber && !r.body.data.company.gstCertificate, 'GST=No persists gstRegistered=false and drops stale GST data', JSON.stringify(r.body.data?.company));
ok(r.body.data?.company?.verificationStatus === 'Pending Verification', 'new registration is Pending Verification (not active)');
ok(r.body.data?.company?.adminInfo?.sameAsSignatory === true && r.body.data.company.authorisedSignatory?.declaration?.acceptedAt, 'same-as-signatory + declaration timestamp persisted');
ok(!!r.body.data?.company?.bankStatement?.url && !r.body.data.company.cancelledCheque?.url, 'bank statement stored as bankStatement');
const dupEmail = p.companyData.businessEmail;
r = await post('/register', p);
ok(r.status === 400, 'duplicate registration rejected', JSON.stringify(r.body));
const login = await post('/login', { businessEmail: p.adminData.adminEmail, password: 'Passw0rd1' });
ok(login.status === 403, 'unapproved company cannot log in (existing rule preserved)', JSON.stringify(login.body));

// ---- GST = Yes ----
p = payload('gstyes2', true);
r = await post('/register', p);
ok(r.status === 201 && r.body.data.company.gstRegistered === true && r.body.data.company.gstNumber === '27AAPCG9838F1Z1' && r.body.data.company.gstCertificate?.url, 'GST=Yes registration persists GST data', JSON.stringify(r.body));

// ---- legacy payload still works ----
const legacyTag = `legacy-${stamp}`;
r = await post('/register', {
    companyData: { companyName: 'Legacy Co', gstNumber: '27AAPCG9838F1Z1', businessEmail: `${legacyTag}@example.test`, businessPhone: '9876543210', businessAddress: '1 Old Rd', businessType: 'Proprietorship', secretKey: 'secret123', acceptanceExecutionDocument: doc('agr') },
    adminData: { adminName: 'Old Admin', adminEmail: `admin-${legacyTag}@example.test`, adminPhone: '9876543210', password: 'abcdef' },
});
ok(r.status === 201, 'legacy (v1) payload still accepted', JSON.stringify(r.body));

// ---- drafts ----
const dEmail = `draft-${stamp}@example.test`;
const dData = { form: { businessEmail: dEmail, companyName: 'Draft Co', password: 'Secret123', secretKey: 'zzzzzz' }, docs: { addressProof: doc('addr') }, employees: [{ name: 'E', email: 'e@x.test', password: 'pw' }] };
r = await post('/draft/save', { email: dEmail, currentStep: 2, completedSteps: [1], data: dData });
ok(r.status === 201 && r.body.data.draftToken, 'draft saved, ownership token issued', JSON.stringify(r.body));
const token = r.body.data.draftToken;
ok(!JSON.stringify(r.body.data.data).includes('Secret123') && !JSON.stringify(r.body.data.data).includes('zzzzzz') && r.body.data.data.employees[0].password === undefined, 'passwords / secret keys never stored in draft');

r = await post('/draft/save', { email: dEmail, currentStep: 1, data: { form: { businessEmail: dEmail, companyName: 'HIJACK' } } });
ok(r.status === 409, 'another user cannot overwrite an existing draft without its token', JSON.stringify(r.body));
r = await post('/draft/load', { email: dEmail, draftToken: 'a'.repeat(64) });
ok(r.status === 403, 'wrong token cannot read draft');
r = await post('/draft/load', { email: dEmail, draftToken: token });
ok(r.status === 200 && r.body.data.data.form.companyName === 'Draft Co' && r.body.data.currentStep === 2 && r.body.data.data.docs.addressProof.url, 'draft restored with fields, doc refs and current step');

r = await post('/draft/save', { email: dEmail, draftToken: token, currentStep: 3, completedSteps: [1, 2], data: dData });
ok(r.status === 200 && r.body.data.currentStep === 3, 'owner can update draft (progress saved)');

// OTP resume
r = await post('/draft/request-otp', { email: dEmail });
const other = await post('/draft/request-otp', { email: `nobody-${stamp}@example.test` });
ok(r.status === 200 && other.status === 200 && r.body.message === other.body.message, 'request-otp does not reveal whether a draft exists');
await new Promise((res) => setTimeout(res, 300));
const otp = readOtp(dEmail);
ok(!!otp, 'OTP generated (read from non-production server log)');
r = await post('/draft/verify-otp', { email: dEmail, otp: otp === '000000' ? '111111' : '000000' });
ok(r.status === 400, 'invalid OTP rejected', JSON.stringify(r.body));
r = await post('/draft/verify-otp', { email: dEmail, otp });
ok(r.status === 200 && r.body.data.draftToken && r.body.data.currentStep === 3, 'valid OTP restores draft and issues a new token', JSON.stringify(r.body));
const token2 = r.body.data.draftToken;
r = await post('/draft/verify-otp', { email: dEmail, otp });
ok(r.status === 400, 'OTP is single-use');
r = await post('/draft/load', { email: dEmail, draftToken: token });
ok(r.status === 403, 'old token invalidated after OTP resume');

// lockout after 5 wrong attempts
await new Promise((res) => setTimeout(res, 31000));
await post('/draft/request-otp', { email: dEmail });
await new Promise((res) => setTimeout(res, 300));
const otp2 = readOtp(dEmail);
let last;
for (let i = 0; i < 6; i++) last = await post('/draft/verify-otp', { email: dEmail, otp: otp2 === '123456' ? '654321' : '123456' });
last = await post('/draft/verify-otp', { email: dEmail, otp: otp2 });
ok(last.status === 429, 'OTP locked after too many wrong attempts', JSON.stringify(last));

// draft for already-registered email
r = await post('/draft/save', { email: dupEmail, currentStep: 1, data: { form: { businessEmail: dupEmail } } });
ok(r.status === 409, 'draft for an already-registered email is rejected (duplicate handling)', JSON.stringify(r.body));

// submit with draft token deletes the draft
const sEmail = `sub-${stamp}@example.test`;
p = payload('sub', false);
p.companyData.businessEmail = sEmail;
r = await post('/draft/save', { email: sEmail, currentStep: 4, data: { form: { businessEmail: sEmail } } });
const sTok = r.body.data.draftToken;
p.draftToken = 'b'.repeat(64);
r = await post('/register', p);
ok(r.status === 403, 'submit with wrong draft token rejected');
p.draftToken = sTok;
r = await post('/register', p);
ok(r.status === 201, 'submit with owned draft succeeds', JSON.stringify(r.body));
r = await post('/draft/load', { email: sEmail, draftToken: sTok });
ok(r.status === 403, 'draft removed after final submission');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
