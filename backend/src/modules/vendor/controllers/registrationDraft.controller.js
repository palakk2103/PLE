import ApiError from '../../../utils/ApiError.js';
import Vendor from '../../../models/Vendor.model.js';
import VendorRegistrationDraft from '../../../models/VendorRegistrationDraft.model.js';
import { createRegistrationDraftHandlers } from '../../../services/registrationDraft.factory.js';

// Only these text fields of the registration form can be saved. Passwords and the bank
// account number are deliberately absent (re-entered when the vendor resumes), and nothing
// outside this list is stored, so a draft can't be used as free storage.
const FIELDS = [
    'name', 'email', 'phone', 'storeName', 'storeDescription', 'businessType', 'gstRegistered',
    'businessName', 'tradeName', 'gstNumber', 'panNumber', 'ownerName', 'businessAddress', 'city', 'state', 'pincode',
    'bankAccountName', 'bankName', 'bankIfscCode', 'bankBranchName', 'bankAccountType', 'bankUpiId', 'bankProofType',
];
const ADDRESS_FIELDS = ['street', 'city', 'state', 'zipCode', 'country'];
const MAX_LEN = 500;

const scrub = (data = {}) => {
    const src = data?.form && typeof data.form === 'object' ? data.form : {};
    const form = {};
    for (const key of FIELDS) {
        const v = src[key];
        if (typeof v === 'string') form[key] = v.slice(0, MAX_LEN);
        else if (typeof v === 'boolean') form[key] = v;
    }
    if (src.address && typeof src.address === 'object') {
        form.address = {};
        for (const key of ADDRESS_FIELDS) {
            if (typeof src.address[key] === 'string') form.address[key] = src.address[key].slice(0, MAX_LEN);
        }
    }
    return { form };
};

const assertEmailFree = async (email) => {
    if (await Vendor.findOne({ email }).select('_id')) throw new ApiError(409, 'A vendor account with this email is already registered.');
};

export const {
    saveDraft, requestDraftOtp, verifyDraftOtp, loadDraft, sendDraftResumeLink, resumeDraftFromLink, discardDraft,
} = createRegistrationDraftHandlers({
    Model: VendorRegistrationDraft,
    tag: 'VENDOR-DRAFT',
    envPrefix: 'VENDOR_DRAFT',
    label: 'vendor registration',
    maxStep: 1,
    stepNames: { 1: 'your saved form' },
    subjectName: (form) => form.storeName,
    resumeUrl: (base, token, email) => `${base}/vendor/register?resume=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`,
    assertEmailFree,
    scrub,
    saveEmailError: 'Enter a valid email before saving a draft.',
    notSaved: 'passwords, bank account numbers and uploaded documents',
    brandColor: '#7B0A0A',
});

// Called once a registration is actually submitted: the draft has served its purpose.
export const clearVendorDraft = (email) =>
    VendorRegistrationDraft.deleteOne({ email: String(email || '').trim().toLowerCase() }).catch(() => null);
