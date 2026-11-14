import ApiError from '../utils/ApiError.js';

export const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const ACCOUNT_REGEX = /^[0-9]{9,18}$/;
export const PINCODE_REGEX = /^[1-9][0-9]{5}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export const normalizeMobile = (value = '') => {
    const digits = String(value).replace(/\D/g, '');
    return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
};
export const isValidMobile = (v) => /^[6-9]\d{9}$/.test(normalizeMobile(v));
export const isValidEmail = (v) => EMAIL_REGEX.test(String(v || '').trim());

const ALLOWED_DOC_MIMES = ['application/pdf', 'image/jpeg', 'image/png'];
const hasDoc = (d) => !!(d && typeof d === 'object' && d.url);

/** Keep only the known document fields so clients cannot inject arbitrary keys. */
export const sanitizeDoc = (d) => {
    if (!hasDoc(d)) return undefined;
    return {
        url: String(d.url),
        fileName: String(d.fileName || '').slice(0, 200),
        mimeType: String(d.mimeType || ''),
        size: Number(d.size) || 0,
        uploadedAt: d.uploadedAt ? new Date(d.uploadedAt) : new Date()
    };
};

/**
 * Validate the v2 (4-step) registration payload. Returns a list of {field, message}.
 * GST rules are enforced here (not only in the UI): GST = No never requires GST data.
 */
export const validateV2Registration = ({ companyData = {}, signatoryData = {}, adminData = {} }) => {
    const errors = [];
    const add = (field, message) => errors.push({ field, message });
    const req = (v) => String(v ?? '').trim().length > 0;

    // Step 1 - company
    if (!req(companyData.companyName)) add('companyName', 'Company name is required.');
    if (!req(companyData.businessType)) add('businessType', 'Business type is required.');
    if (!isValidEmail(companyData.businessEmail)) add('businessEmail', 'A valid company email is required.');
    if (!isValidMobile(companyData.businessPhone)) add('businessPhone', 'A valid 10-digit company contact number is required.');

    const a = companyData.addressDetails || {};
    if (!req(a.line1)) add('addressLine1', 'Address Line 1 is required.');
    if (!req(a.country)) add('country', 'Country is required.');
    if (!req(a.state)) add('state', 'State is required.');
    if (!req(a.city)) add('city', 'City is required.');
    if (!PINCODE_REGEX.test(String(a.pincode || '').trim())) add('pincode', 'A valid 6-digit pincode is required.');
    if (!hasDoc(companyData.addressProof)) add('addressProof', 'Address proof is required.');

    const b = companyData.bankDetails || {};
    if (!req(b.accountHolderName)) add('accountHolderName', 'Account holder name is required.');
    if (!req(b.bankName)) add('bankName', 'Bank name is required.');
    if (!ACCOUNT_REGEX.test(String(b.accountNumber || '').trim())) add('accountNumber', 'Account number must be 9-18 digits.');
    if (!IFSC_REGEX.test(String(b.ifscCode || '').trim().toUpperCase())) add('ifscCode', 'Invalid IFSC code.');
    if (!req(b.branchName)) add('branchName', 'Branch name is required.');
    if (!['Current', 'Savings', 'Other'].includes(b.accountType)) add('accountType', 'Account type is required.');
    if (!['bank_statement', 'cancelled_cheque'].includes(companyData.bankDocumentType)) {
        add('bankDocumentType', 'Select Bank Statement or Cancelled Cheque.');
    } else if (!hasDoc(companyData.bankDocument)) {
        add('bankDocument', 'Upload the selected bank document.');
    }

    if (typeof companyData.gstRegistered !== 'boolean') {
        add('gstRegistered', 'Please answer whether you have GST registration.');
    } else if (companyData.gstRegistered) {
        if (!GST_REGEX.test(String(companyData.gstNumber || '').trim().toUpperCase())) add('gstNumber', 'Enter a valid GSTIN.');
        if (!req(companyData.gstDetails?.legalName)) add('gstLegalName', 'Legal business name is required.');
        if (!hasDoc(companyData.gstCertificate)) add('gstCertificate', 'GST certificate is required.');
    }

    if (!hasDoc(companyData.companyRegistrationProof)) add('companyRegistrationProof', 'Company registration proof is required.');
    if (!hasDoc(companyData.acceptanceExecutionDocument)) add('acceptanceExecutionDocument', 'Signed Acceptance & Execution Agreement is required.');

    // Step 2 - signatory
    if (!req(signatoryData.fullName)) add('sigName', 'Full legal name is required.');
    if (!req(signatoryData.designation)) add('sigDesignation', 'Designation is required.');
    if (!isValidEmail(signatoryData.email)) add('sigEmail', 'A valid official email is required.');
    if (!isValidMobile(signatoryData.mobile)) add('sigMobile', 'A valid 10-digit mobile number is required.');
    if (!hasDoc(signatoryData.identityDocument)) add('sigIdentity', 'Identity document is required.');
    if (!hasDoc(signatoryData.authorisationDocument)) add('sigAuthorisation', 'Authorisation document is required.');
    if (signatoryData.declarationAccepted !== true) add('sigDeclaration', 'You must accept the declaration.');

    // Step 3 - admin
    if (!req(adminData.adminName)) add('adminName', 'Admin name is required.');
    if (!isValidEmail(adminData.adminEmail)) add('adminEmail', 'A valid admin email is required.');
    if (!isValidMobile(adminData.adminPhone)) add('adminPhone', 'A valid admin mobile number is required.');
    if (!PASSWORD_REGEX.test(String(adminData.password || ''))) {
        add('password', 'Password must be 8+ characters with upper-case, lower-case and a number.');
    }
    if (adminData.password !== adminData.confirmPassword) add('confirmPassword', 'Passwords do not match.');
    if (String(companyData.secretKey || '').length < 6) add('secretKey', 'Secret key must be at least 6 characters.');

    return errors;
};

export const assertValidDocMime = (mime) => {
    if (!ALLOWED_DOC_MIMES.includes(mime)) throw new ApiError(400, 'Invalid file type. Only PDF, JPG and PNG files are allowed.');
};

// Magic-byte check so a renamed executable cannot pass as a PDF/image.
export const matchesMagicBytes = (buf, ext) => {
    if (!buf || buf.length < 4) return false;
    if (ext === 'pdf') return buf.slice(0, 4).toString('latin1') === '%PDF';
    if (ext === 'png') return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    if (ext === 'jpg' || ext === 'jpeg') return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    return false;
};
