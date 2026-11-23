import crypto from 'crypto';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';
import { sendEmail } from './email.service.js';
import { isValidEmail } from './b2bRegistration.service.js';

/**
 * Save-as-draft + resume (email code, or emailed single-use link) for a multi-field registration form.
 * One implementation shared by B2B and vendor registration; each passes its own config:
 *
 *   Model            Mongoose model with the draft fields (email, status, currentStep, completedSteps, data,
 *                    tokenHash, otp*, resumeLink*, expiresAt)
 *   tag              log prefix, e.g. 'B2B-DRAFT'
 *   envPrefix        env override prefix for TTLs, e.g. 'B2B_DRAFT' -> B2B_DRAFT_TTL_DAYS ...
 *   label            human name used in emails, e.g. 'B2B registration'
 *   maxStep          highest step number (1 for a single-page form)
 *   stepNames        { 1: 'Company details', ... }
 *   subjectName      what the draft is for, from the saved form (company / store name)
 *   resumeUrl(base, token, email)  full link the email contains
 *   assertEmailFree(email)         throws 409 when an account already exists
 *   scrub(data)      removes secrets (passwords...) before anything is stored
 *   saveEmailError   message when the email is invalid on save
 *   brandColor       email button colour
 *   notSaved         what is never stored, for the email, e.g. 'passwords and secret keys'
 */
export const createRegistrationDraftHandlers = (cfg) => {
    const {
        Model, tag, envPrefix, label, maxStep, stepNames, subjectName, resumeUrl, assertEmailFree, scrub,
        saveEmailError = 'Enter a valid email before saving a draft.', brandColor = '#AE020B',
        notSaved = 'passwords and secret keys',
    } = cfg;

    const DRAFT_TTL_DAYS = Number(process.env[`${envPrefix}_TTL_DAYS`]) || 30;
    const OTP_TTL_MS = Number(process.env[`${envPrefix}_OTP_TTL_MS`]) || 10 * 60 * 1000;
    const OTP_RESEND_MS = 30 * 1000;
    const MAX_OTP_ATTEMPTS = 5;
    const RESUME_LINK_TTL_MS = Number(process.env[`${envPrefix}_LINK_TTL_MS`]) || 7 * 24 * 60 * 60 * 1000;
    const RESUME_LINK_RESEND_MS = 60 * 1000;

    const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
    const newToken = () => crypto.randomBytes(32).toString('hex');
    const expiry = () => new Date(Date.now() + DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000);
    const normEmail = (e) => String(e || '').trim().toLowerCase();
    const clampStep = (n) => Math.min(Math.max(parseInt(n, 10) || 1, 1), maxStep);

    const serialize = (draft) => ({
        email: draft.email,
        status: draft.status,
        currentStep: draft.currentStep,
        completedSteps: draft.completedSteps,
        data: draft.data,
        updatedAt: draft.updatedAt,
        expiresAt: draft.expiresAt
    });

    const esc = (str) => String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const clientUrl = () => String(process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const stepLabel = (draft) => (maxStep > 1
        ? `step ${draft.currentStep} of ${maxStep} (${stepNames[draft.currentStep] || `Step ${draft.currentStep}`})`
        : (stepNames[1] || 'your saved form'));

    /**
     * Issue a fresh single-use resume link for the draft (any earlier link stops working) and email it.
     * Only the token's hash is stored. Saves the draft; the email is sent in the background.
     */
    const sendResumeLink = async (draft) => {
        const token = newToken();
        const linkExpires = new Date(Math.min(Date.now() + RESUME_LINK_TTL_MS, new Date(draft.expiresAt).getTime()));
        draft.resumeLinkHash = sha256(token);
        draft.resumeLinkExpiresAt = linkExpires;
        draft.resumeLinkSentAt = new Date();
        await draft.save();

        const url = resumeUrl(clientUrl(), token, draft.email);
        const name = subjectName(draft.data?.form || {});
        const where = stepLabel(draft);
        const until = linkExpires.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[${tag}] (non-production) resume link for ${draft.email}: ${url}`);
        }
        // Fire-and-forget: a slow mail server must not delay saving the draft.
        Promise.resolve().then(() => sendEmail({
            to: draft.email,
            subject: `Continue your ${label}`,
            text: `Your ${label}${name ? ` for ${name}` : ''} is saved at ${where}. Continue here: ${url} (valid until ${until}, works once). ${notSaved[0].toUpperCase()}${notSaved.slice(1)} are not saved, so you will re-enter them.`,
            html: `<p>Your ${label}${name ? ` for <strong>${esc(name)}</strong>` : ''} is saved at <strong>${esc(where)}</strong>.</p>`
                + `<p><a href="${esc(url)}" style="display:inline-block;padding:10px 18px;background:${brandColor};color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">Continue registration</a></p>`
                + `<p style="font-size:12px;color:#666">This link works once and is valid until ${esc(until)}. For security, ${esc(notSaved)} are not saved, so you'll re-enter them. If you didn't start this registration, ignore this email.</p>`,
        })).catch((err) => console.error('Failed to send draft resume link:', err?.message));
        return { token, url };
    };

    // POST .../draft/save  { email, draftToken?, currentStep, completedSteps, data }
    const saveDraft = asyncHandler(async (req, res) => {
        const email = normEmail(req.body.email);
        if (!isValidEmail(email)) throw new ApiError(400, saveEmailError);
        const step = clampStep(req.body.currentStep);
        const completedSteps = Array.isArray(req.body.completedSteps)
            ? [...new Set(req.body.completedSteps.map(Number).filter((n) => n >= 1 && n <= maxStep))]
            : [];
        const data = scrub(req.body.data);

        let draft = await Model.findOne({ email }).select('+tokenHash');
        if (!draft) {
            await assertEmailFree(email);
            const token = newToken();
            draft = await Model.create({
                email, currentStep: step, completedSteps, data, tokenHash: sha256(token), expiresAt: expiry()
            });
            // First save: email a link so the user can continue later from any device.
            await sendResumeLink(draft).catch((e) => console.error('Resume link error:', e?.message));
            return res.status(201).json(new ApiResponse(201, { draftToken: token, resumeLinkSent: true, ...serialize(draft) }, 'Draft saved. We emailed you a link to continue later.'));
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

    // POST .../draft/request-otp  { email }
    // Always answers the same way so the endpoint cannot be used to discover which emails have drafts.
    const requestDraftOtp = asyncHandler(async (req, res) => {
        const email = normEmail(req.body.email);
        if (!isValidEmail(email)) throw new ApiError(400, 'Enter a valid email address.');
        const generic = new ApiResponse(200, null, 'If a saved registration exists for this email, a verification code has been sent.');

        const draft = await Model.findOne({ email }).select('+otpSentAt');
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
            console.log(`[${tag}] (non-production) resume OTP for ${email}: ${otp}`);
        }
        try {
            await sendEmail({
                to: email,
                subject: `Your ${label} resume code`,
                html: `<p>Your verification code to resume your ${label} is <strong>${otp}</strong>.</p><p>It expires in 10 minutes. If you did not request this, ignore this email.</p>`
            });
        } catch (err) {
            console.error('Failed to send draft OTP email:', err.message);
        }
        res.status(200).json(generic);
    });

    // POST .../draft/verify-otp  { email, otp }
    const verifyDraftOtp = asyncHandler(async (req, res) => {
        const email = normEmail(req.body.email);
        const otp = String(req.body.otp || '').trim();
        const fail = () => new ApiError(400, 'Invalid or expired verification code.');
        if (!isValidEmail(email) || !/^\d{6}$/.test(otp)) throw fail();

        const draft = await Model.findOne({ email }).select('+otpHash +otpExpiresAt +otpAttempts +tokenHash');
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

    // POST .../draft/load  { email, draftToken }  - same-browser resume using the saved token
    const loadDraft = asyncHandler(async (req, res) => {
        const email = normEmail(req.body.email);
        const draft = await Model.findOne({ email }).select('+tokenHash');
        if (!draft || !req.body.draftToken || sha256(req.body.draftToken) !== draft.tokenHash) {
            throw new ApiError(403, 'Draft not found or you are not authorised to access it. Verify your email to resume.');
        }
        res.status(200).json(new ApiResponse(200, serialize(draft), 'Draft loaded.'));
    });

    // POST .../draft/send-link  { email }
    // Emails a fresh resume link. Same answer whether or not a draft exists (no email discovery).
    const sendDraftResumeLink = asyncHandler(async (req, res) => {
        const email = normEmail(req.body.email);
        if (!isValidEmail(email)) throw new ApiError(400, 'Enter a valid email address.');
        const generic = new ApiResponse(200, null, 'If a saved registration exists for this email, we have emailed a link to continue it.');

        const draft = await Model.findOne({ email, status: 'Draft' }).select('+resumeLinkSentAt');
        if (!draft) return res.status(200).json(generic);
        if (draft.resumeLinkSentAt && Date.now() - draft.resumeLinkSentAt.getTime() < RESUME_LINK_RESEND_MS) {
            return res.status(200).json(generic);
        }
        await sendResumeLink(draft);
        res.status(200).json(generic);
    });

    // POST .../draft/resume-link  { email, token }
    // Opens a draft from the emailed link: single use, expires; hands out a new ownership token.
    const resumeDraftFromLink = asyncHandler(async (req, res) => {
        const email = normEmail(req.body.email);
        const token = String(req.body.token || '');
        const invalid = () => new ApiError(400, 'This link is invalid, already used or expired. Request a new link or a verification code.');
        if (!isValidEmail(email) || !/^[a-f0-9]{64}$/.test(token)) throw invalid();

        // Consume atomically so the same link can't be opened twice.
        const draft = await Model.findOneAndUpdate(
            { email, status: 'Draft', resumeLinkHash: sha256(token), resumeLinkExpiresAt: { $gt: new Date() } },
            { $unset: { resumeLinkHash: 1, resumeLinkExpiresAt: 1 } },
            { new: true }
        ).select('+tokenHash');
        if (!draft) throw invalid();

        const ownerToken = newToken();
        draft.tokenHash = sha256(ownerToken);
        draft.expiresAt = expiry();
        await draft.save();
        res.status(200).json(new ApiResponse(200, { draftToken: ownerToken, ...serialize(draft) }, 'Draft restored.'));
    });

    // POST .../draft/discard  { email, draftToken }
    const discardDraft = asyncHandler(async (req, res) => {
        const email = normEmail(req.body.email);
        const draft = await Model.findOne({ email }).select('+tokenHash');
        if (!draft || !req.body.draftToken || sha256(req.body.draftToken) !== draft.tokenHash) {
            throw new ApiError(403, 'Not authorised to discard this draft.');
        }
        await draft.deleteOne();
        res.status(200).json(new ApiResponse(200, null, 'Draft discarded.'));
    });

    return { saveDraft, requestDraftOtp, verifyDraftOtp, loadDraft, sendDraftResumeLink, resumeDraftFromLink, discardDraft };
};
