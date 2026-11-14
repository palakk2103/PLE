import crypto from 'crypto';
import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import B2BCompany from '../../../models/B2BCompany.model.js';
import User from '../../../models/User.model.js';
import B2BRegistrationDraft from '../../../models/B2BRegistrationDraft.model.js';
import { sendEmail } from '../../../services/email.service.js';
import { isValidEmail } from '../../../services/b2bRegistration.service.js';

const DRAFT_TTL_DAYS = Number(process.env.B2B_DRAFT_TTL_DAYS) || 30;
const OTP_TTL_MS = Number(process.env.B2B_DRAFT_OTP_TTL_MS) || 10 * 60 * 1000;
const OTP_RESEND_MS = 30 * 1000;
const MAX_OTP_ATTEMPTS = 5;

const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
const newToken = () => crypto.randomBytes(32).toString('hex');
const expiry = () => new Date(Date.now() + DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000);
const normEmail = (e) => String(e || '').trim().toLowerCase();

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

const serialize = (draft) => ({
    email: draft.email,
    status: draft.status,
    currentStep: draft.currentStep,
    completedSteps: draft.completedSteps,
    data: draft.data,
    updatedAt: draft.updatedAt,
    expiresAt: draft.expiresAt
});

const assertEmailFree = async (email) => {
    const [company, user] = await Promise.all([
        B2BCompany.findOne({ businessEmail: email }).select('_id'),
        User.findOne({ email }).select('_id')
    ]);
    if (company || user) throw new ApiError(409, 'A B2B account with this email is already registered.');
};

// POST /api/b2b-user/auth/draft/save  { email, draftToken?, currentStep, completedSteps, data }
export const saveDraft = asyncHandler(async (req, res) => {
    const email = normEmail(req.body.email);
    if (!isValidEmail(email)) throw new ApiError(400, 'Enter a valid company email before saving a draft.');
    const step = Math.min(Math.max(parseInt(req.body.currentStep, 10) || 1, 1), 4);
    const completedSteps = Array.isArray(req.body.completedSteps)
        ? [...new Set(req.body.completedSteps.map(Number).filter((n) => n >= 1 && n <= 4))]
        : [];
    const data = scrub(req.body.data);

    let draft = await B2BRegistrationDraft.findOne({ email }).select('+tokenHash');
    if (!draft) {
        await assertEmailFree(email);
        const token = newToken();
        draft = await B2BRegistrationDraft.create({
            email, currentStep: step, completedSteps, data, tokenHash: sha256(token), expiresAt: expiry()
        });
        return res.status(201).json(new ApiResponse(201, { draftToken: token, ...serialize(draft) }, 'Draft saved.'));
    }

    // A draft already exists for this email: only its owner (token holder) may overwrite it.
    const presented = req.body.draftToken ? sha256(req.body.draftToken) : null;
    if (!presented || presented !== draft.tokenHash) {
        throw new ApiError(409, 'A saved draft already exists for this email. Resume it with the verification code sent to the email.');
    }
    draft.currentStep = step;
    draft.completedSteps = completedSteps;
    draft.data = data;
    draft.markModified('data');
    draft.expiresAt = expiry();
    await draft.save();
    res.status(200).json(new ApiResponse(200, serialize(draft), 'Draft saved.'));
});

// POST /api/b2b-user/auth/draft/request-otp  { email }
// Always answers the same way so the endpoint cannot be used to discover which emails have drafts.
export const requestDraftOtp = asyncHandler(async (req, res) => {
    const email = normEmail(req.body.email);
    if (!isValidEmail(email)) throw new ApiError(400, 'Enter a valid email address.');
    const generic = new ApiResponse(200, null, 'If a saved registration exists for this email, a verification code has been sent.');

    const draft = await B2BRegistrationDraft.findOne({ email }).select('+otpSentAt');
    if (!draft) return res.status(200).json(generic);
    if (draft.otpSentAt && Date.now() - draft.otpSentAt.getTime() < OTP_RESEND_MS) {
        return res.status(200).json(generic);
    }

    const otp = String(crypto.randomInt(100000, 1000000));
    draft.otpHash = sha256(`${email}:${otp}`);
    draft.otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
    draft.otpAttempts = 0;
    draft.otpSentAt = new Date();
    await draft.save();

    if (process.env.NODE_ENV !== 'production') {
        console.log(`[B2B-DRAFT] (non-production) resume OTP for ${email}: ${otp}`);
    }
    try {
        await sendEmail({
            to: email,
            subject: 'Your B2B registration resume code',
            html: `<p>Your verification code to resume your B2B registration is <strong>${otp}</strong>.</p><p>It expires in 10 minutes. If you did not request this, ignore this email.</p>`
        });
    } catch (err) {
        console.error('Failed to send draft OTP email:', err.message);
    }
    res.status(200).json(generic);
});

// POST /api/b2b-user/auth/draft/verify-otp  { email, otp }
export const verifyDraftOtp = asyncHandler(async (req, res) => {
    const email = normEmail(req.body.email);
    const otp = String(req.body.otp || '').trim();
    const fail = () => new ApiError(400, 'Invalid or expired verification code.');
    if (!isValidEmail(email) || !/^\d{6}$/.test(otp)) throw fail();

    const draft = await B2BRegistrationDraft.findOne({ email }).select('+otpHash +otpExpiresAt +otpAttempts +tokenHash');
    if (!draft || !draft.otpHash || !draft.otpExpiresAt || draft.otpExpiresAt < new Date()) throw fail();
    if (draft.otpAttempts >= MAX_OTP_ATTEMPTS) {
        throw new ApiError(429, 'Too many incorrect attempts. Request a new code.');
    }
    if (sha256(`${email}:${otp}`) !== draft.otpHash) {
        draft.otpAttempts += 1;
        await draft.save();
        throw fail();
    }

    const token = newToken();
    draft.tokenHash = sha256(token);
    draft.otpHash = undefined;
    draft.otpExpiresAt = undefined;
    draft.otpAttempts = 0;
    draft.expiresAt = expiry();
    await draft.save();
    res.status(200).json(new ApiResponse(200, { draftToken: token, ...serialize(draft) }, 'Draft restored.'));
});

// POST /api/b2b-user/auth/draft/load  { email, draftToken }  - same-browser resume using the saved token
export const loadDraft = asyncHandler(async (req, res) => {
    const email = normEmail(req.body.email);
    const draft = await B2BRegistrationDraft.findOne({ email }).select('+tokenHash');
    if (!draft || !req.body.draftToken || sha256(req.body.draftToken) !== draft.tokenHash) {
        throw new ApiError(403, 'Draft not found or you are not authorised to access it. Verify your email to resume.');
    }
    res.status(200).json(new ApiResponse(200, serialize(draft), 'Draft loaded.'));
});

// POST /api/b2b-user/auth/draft/discard  { email, draftToken }
export const discardDraft = asyncHandler(async (req, res) => {
    const email = normEmail(req.body.email);
    const draft = await B2BRegistrationDraft.findOne({ email }).select('+tokenHash');
    if (!draft || !req.body.draftToken || sha256(req.body.draftToken) !== draft.tokenHash) {
        throw new ApiError(403, 'Not authorised to discard this draft.');
    }
    await draft.deleteOne();
    res.status(200).json(new ApiResponse(200, null, 'Draft discarded.'));
});
