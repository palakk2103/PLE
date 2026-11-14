/**
 * Regression + admin-flow checks around the B2B registration change.
 * Needs the isolated server started with a short OTP TTL:
 *   B2B_DRAFT_OTP_TTL_MS=3000 node testing_scripts/e2e-server.js 5055 /tmp/seed.json > /tmp/e2e.log &
 *   node testing_scripts/test-b2b-regression.js http://localhost:5055 /tmp/e2e.log
 */
process.env.JWT_SECRET = 'e2e-secret';
process.env.JWT_REFRESH_SECRET = 'e2e-refresh';
import fs from 'node:fs';
const { signAccessToken } = await import('../src/config/jwt.js');

const base = process.argv[2] || 'http://localhost:5055';
const logFile = process.argv[3] || '/tmp/e2e.log';
let pass = 0, fail = 0;
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${c ? '' : '  ' + x}`); };
const call = async (method, path, body, token) => {
    const r = await fetch(`${base}/api${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => ({})) };
};
const seed = JSON.parse(fs.readFileSync(process.env.SEED_FILE, 'utf8'));
const doc = (n) => ({ url: `https://example.test/${n}.pdf`, fileName: `${n}.pdf`, mimeType: 'application/pdf', size: 100 });
const stamp = Date.now();
const tag = `reg-${stamp}`;
const adminEmail = `admin-${tag}@example.test`;
const empEmail = `emp-${tag}@example.test`;

const reg = (t, gst, extra = {}) => ({
    version: 2,
    companyData: {
        companyName: `Reg Co ${t}`, businessType: 'Private Limited Company', businessEmail: `co-${t}-${stamp}@example.test`, businessPhone: '9876543210', secretKey: 'secret123',
        addressDetails: { line1: '1 Rd', country: 'India', state: 'MH', city: 'Mumbai', pincode: '400001' }, addressProof: doc('addr'),
        bankDetails: { accountHolderName: 'Reg Co', bankName: 'HDFC', accountNumber: '123456789012', ifscCode: 'HDFC0001234', branchName: 'BKC', accountType: 'Current' },
        bankDocumentType: 'cancelled_cheque', bankDocument: doc('cheque'),
        gstRegistered: gst, ...(gst ? { gstNumber: '27AAPCG9838F1Z1', gstDetails: { legalName: 'Reg Co', registrationType: 'Regular', state: 'MH' }, gstCertificate: doc('gst') } : {}),
        companyRegistrationProof: doc('reg'), acceptanceExecutionDocument: doc('agr'),
    },
    signatoryData: { fullName: 'Sig', designation: 'Director', email: `sig-${t}-${stamp}@example.test`, mobile: '9876500001', identityDocument: doc('id'), authorisationDocument: doc('auth'), declarationAccepted: true },
    adminData: { adminName: 'Adm', adminEmail: extra.adminEmail || `adm-${t}-${stamp}@example.test`, adminPhone: '9876500002', sameAsSignatory: false, password: 'Passw0rd1', confirmPassword: 'Passw0rd1' },
    employees: extra.employees || [],
});

// ---- registration with GST=Yes + cheque + employee ----
let r = await call('POST', '/b2b-user/auth/register', reg('main', true, { adminEmail, employees: [{ name: 'Emp One', email: empEmail, phone: '9876500003', designation: 'Buyer', password: 'EmpPass1' }] }));
ok(r.status === 201, 'register GST=Yes + cancelled cheque + employee', JSON.stringify(r.body));
const company = r.body.data?.company;
ok(company?.cancelledCheque?.url && !company.bankStatement?.url && company.bankDocumentType === 'cancelled_cheque', 'cancelled cheque stored in cancelledCheque');
ok(company?.gstRegistered === true && company.gstDetails?.legalName === 'Reg Co', 'GST=Yes details persisted');
const cid = company._id;

// ---- admin side ----
const loginRes = await call('POST', '/admin/auth/login', { identityId: seed.admin.identityId, email: seed.admin.email, password: seed.password, personalSecret: seed.secret });
const sa = loginRes.body.data?.accessToken;
const adminId = JSON.parse(Buffer.from(sa.split('.')[1], 'base64url').toString()).id;
r = await call('GET', '/admin/b2b-users', null, null);
ok(r.status === 401, 'admin list requires auth');
r = await call('GET', '/admin/b2b-users', null, signAccessToken({ id: seed.customer.id, role: 'customer', email: seed.customer.email }));
ok(r.status === 403, 'customer token forbidden from admin B2B list', String(r.status));
r = await call('GET', `/admin/b2b-users/${cid}`, null, sa);
ok(r.status === 200 && r.body.data.company.bankDetails.accountNumber === '123456789012', 'superadmin sees full account number');
ok(r.body.data.employees.length === 1 && r.body.data.admin.email === adminEmail, 'detail returns employee + admin');
const adm = signAccessToken({ id: adminId, role: 'admin', email: 'a@e2e.test' });
r = await call('GET', `/admin/b2b-users/${cid}`, null, adm);
ok(r.status === 200 && /^\*+9012$/.test(r.body.data.company.bankDetails.accountNumber), 'plain admin role gets masked account number', JSON.stringify(r.body.data?.company?.bankDetails || r.body));
r = await call('GET', '/admin/b2b-users?status=pending', null, adm);
ok(r.status === 200 && JSON.stringify(r.body).includes('9012') && !JSON.stringify(r.body).includes('123456789012'), 'list endpoint masks account number too');
r = await call('GET', '/admin/b2b-users/drafts', null, sa);
ok(r.status === 200 && Array.isArray(r.body.data), 'admin drafts list');
r = await call('GET', '/admin/b2b-users/drafts', null, signAccessToken({ id: seed.customer.id, role: 'customer', email: seed.customer.email }));
ok(r.status === 403, 'drafts list forbidden to non-admins');

// ---- login blocked until approval; then approve ----
r = await call('POST', '/b2b-user/auth/login', { businessEmail: adminEmail, password: 'Passw0rd1' });
ok(r.status === 403, 'login blocked while pending');
r = await call('POST', '/b2b-user/auth/login', { businessEmail: empEmail, password: 'EmpPass1' });
ok(r.status === 403, 'employee login blocked while pending');
r = await call('PATCH', `/admin/b2b-users/${cid}/status`, { status: 'approved' }, sa);
ok(r.status === 200, 'admin approves', JSON.stringify(r.body));
r = await call('GET', `/admin/b2b-users/${cid}`, null, sa);
ok(r.body.data.company.verificationStatus === 'Approved', 'status persisted as Approved');
r = await call('POST', '/b2b-user/auth/login', { businessEmail: adminEmail, password: 'Passw0rd1' });
ok(r.status === 200 && r.body.data.accessToken, 'b2b admin login works after approval', JSON.stringify(r.body).slice(0, 200));
const bTok = r.body.data?.accessToken;
r = await call('POST', '/b2b-user/auth/login', { businessEmail: adminEmail, password: 'wrong' });
ok(r.status === 401, 'wrong password rejected');
r = await call('POST', '/b2b-user/auth/login', { businessEmail: empEmail, password: 'EmpPass1' });
ok(r.status === 200 && r.body.data.accessToken, 'employee login works after approval');
const eTok = r.body.data?.accessToken;

// ---- existing b2b dashboard / employee permissions ----
r = await call('GET', '/b2b-user/admin/dashboard', null, bTok);
ok(r.status === 200, 'b2b admin dashboard loads', String(r.status));
r = await call('GET', '/b2b-user/admin/company', null, bTok);
ok(r.status === 200, 'b2b admin company profile loads', String(r.status));
r = await call('GET', '/b2b-user/admin/employees', null, bTok);
ok(r.status === 200 && JSON.stringify(r.body).includes(empEmail), 'b2b admin lists employee');
r = await call('GET', '/b2b-user/admin/employees', null, eTok);
ok(r.status === 403, 'employee blocked from admin-only employee management');
r = await call('POST', '/b2b-user/admin/employees', { firstName: 'Emp', lastName: 'Two', name: 'Emp Two', email: `emp2-${tag}@example.test`, phone: '9876500004', designation: 'Buyer', password: 'EmpPass2' }, bTok);
ok(r.status === 201 || r.status === 200, 'existing create-employee endpoint still works', JSON.stringify(r.body).slice(0, 150));
r = await call('GET', '/b2b-user/employee/direct-rfq', null, eTok);
ok(r.status === 200, 'employee dashboard endpoint accessible', String(r.status));

// ---- reject + resubmit flows ----
r = await call('POST', '/b2b-user/auth/register', reg('rej', false));
const rejId = r.body.data.company._id;
r = await call('PATCH', `/admin/b2b-users/${rejId}/status`, { status: 'rejected', reason: 'bad docs' }, sa);
ok(r.status === 200, 'admin rejects');
r = await call('GET', `/admin/b2b-users/${rejId}`, null, sa);
ok(r.body.data.company.verificationStatus === 'Rejected', 'status persisted as Rejected');
r = await call('POST', '/b2b-user/auth/register', reg('rsub', false));
const rsId = r.body.data.company._id;
r = await call('POST', `/admin/b2b-users/${rsId}/request-resubmit`, { reason: 'reupload', notes: 'reupload', documents: ['acceptanceExecutionDocument'], docs: ['acceptanceExecutionDocument'] }, sa);
ok(r.status === 200, 'admin requests re-upload', JSON.stringify(r.body).slice(0, 150));

// ---- draft expiry (OTP TTL = 3s in this run) ----
const dEmail = `exp-${tag}@example.test`;
r = await call('POST', '/b2b-user/auth/draft/save', { email: dEmail, currentStep: 1, data: { form: { businessEmail: dEmail } } });
ok(r.status === 201, 'draft created for expiry test');
await call('POST', '/b2b-user/auth/draft/request-otp', { email: dEmail });
await new Promise((x) => setTimeout(x, 400));
const otp = [...fs.readFileSync(logFile, 'utf8').matchAll(new RegExp(`resume OTP for ${dEmail}: (\\d{6})`, 'g'))].pop()?.[1];
await new Promise((x) => setTimeout(x, 3500));
r = await call('POST', '/b2b-user/auth/draft/verify-otp', { email: dEmail, otp });
ok(r.status === 400 && /expired/i.test(r.body.message), 'expired OTP rejected', JSON.stringify(r.body));
r = await call('POST', '/b2b-user/auth/draft/load', { email: dEmail, draftToken: 'not-a-real-token' });
ok(r.status === 403, 'invalid resume token rejected');

// ---- unrelated flows ----
r = await call('POST', '/user/auth/login', { email: seed.customer.email, password: seed.password });
ok(r.status === 200, 'B2C customer login unaffected', JSON.stringify(r.body).slice(0, 120));
r = await call('GET', '/agreement-template/active');
ok(r.status === 200 || r.status === 404, 'agreement template endpoint unaffected', String(r.status));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
