import ApiError from '../../../utils/ApiError.js';
import B2BCompany from '../../../models/B2BCompany.model.js';
import User from '../../../models/User.model.js';
import B2BRegistrationDraft from '../../../models/B2BRegistrationDraft.model.js';
import { createRegistrationDraftHandlers } from '../../../services/registrationDraft.factory.js';

// Secrets are never stored in a draft; the user re-enters them at submission.
const SECRET_KEYS = ['password', 'confirmPassword', 'secretKey', 'confirmSecretKey'];
const scrub = (data = {}) => {
    const form = { ...(data.form || {}) };
    SECRET_KEYS.forEach((k) => delete form[k]);
    const employees = Array.isArray(data.employees)
        ? data.employees.map(({ password, ...rest }) => rest)
        : [];
    return { form, docs: data.docs || {}, employees };
};

const assertEmailFree = async (email) => {
    const [company, user] = await Promise.all([
        B2BCompany.findOne({ businessEmail: email }).select('_id'),
        User.findOne({ email }).select('_id')
    ]);
    if (company || user) throw new ApiError(409, 'A B2B account with this email is already registered.');
};

// The save / resume-by-code / resume-by-link logic is shared with vendor registration.
export const {
    saveDraft, requestDraftOtp, verifyDraftOtp, loadDraft, sendDraftResumeLink, resumeDraftFromLink, discardDraft,
} = createRegistrationDraftHandlers({
    Model: B2BRegistrationDraft,
    tag: 'B2B-DRAFT',
    envPrefix: 'B2B_DRAFT',
    label: 'B2B registration',
    maxStep: 4,
    stepNames: { 1: 'Company details', 2: 'Documents', 3: 'Employees', 4: 'Review & submit' },
    subjectName: (form) => form.companyName,
    resumeUrl: (base, token, email) => `${base}/b2b/register?resume=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`,
    assertEmailFree,
    scrub,
    saveEmailError: 'Enter a valid company email before saving a draft.',
    notSaved: 'passwords and secret keys',
});
