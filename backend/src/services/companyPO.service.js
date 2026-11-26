import crypto from 'crypto';
import fs from 'fs';
import ApiError from '../utils/ApiError.js';

/**
 * Shared rules for the company PO registry (spec sections 6, 7, 12).
 * Pure helpers: no DB access except where a Mongoose doc is passed in.
 */

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const inr = (n) => `₹${round2(n).toLocaleString('en-IN')}`;

export const newPlePoId = () =>
    `PLEPO-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

export const sha256OfFile = (filePath) =>
    new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        fs.createReadStream(filePath)
            .on('error', reject)
            .on('data', (chunk) => hash.update(chunk))
            .on('end', () => resolve(hash.digest('hex')));
    });

/** Append one entry to a document's append-only history. */
export const pushHistory = (doc, action, req, { note, before, after } = {}) => {
    doc.history.push({
        action,
        actorId: req.user?.id,
        actorRole: req.user?.role,
        at: new Date(),
        note,
        before,
        after,
    });
};

export const parseDate = (value, label) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw new ApiError(400, `${label} is not a valid date.`);
    return d;
};

export const cleanText = (value, { min = 0, max = 200, label }) => {
    const t = String(value ?? '').trim();
    if (t.length < min) throw new ApiError(400, `${label} is required.`);
    if (t.length > max) throw new ApiError(400, `${label} can be at most ${max} characters.`);
    return t;
};

export const parseMoney = (value, label) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) throw new ApiError(400, `${label} must be more than 0.`);
    if (n > 1e11) throw new ApiError(400, `${label} is too large.`);
    return round2(n);
};

/**
 * Can this signatory authorize a PO with these details? Returns a list of problems (empty = OK).
 * A PO must not become eligible for use until every problem is resolved (spec section 7).
 */
export const signatoryProblems = (signatory, { value, poType, department, now = new Date() }) => {
    if (!signatory) return ['No authorized signatory is linked to this PO.'];
    const problems = [];
    const status = signatory.effectiveStatus(now);
    if (status !== 'verified') {
        problems.push(`Signatory "${signatory.fullName}" is ${status.replace(/_/g, ' ')}; authority must be verified.`);
    }
    if (signatory.effectiveFrom && signatory.effectiveFrom > now) {
        problems.push(`Signatory "${signatory.fullName}" authority starts on ${signatory.effectiveFrom.toISOString().slice(0, 10)}.`);
    }
    if (signatory.approvalLimit != null && value > signatory.approvalLimit) {
        problems.push(`PO value ${inr(value)} is above the signatory's approval limit of ${inr(signatory.approvalLimit)}.`);
    }
    const depts = signatory.scope?.departments || [];
    if (depts.length && !depts.includes(department)) {
        problems.push(`Signatory's scope does not cover department "${department || 'not set'}".`);
    }
    const types = signatory.scope?.poTypes || [];
    if (types.length && !types.includes(poType)) {
        problems.push(`Signatory's scope does not cover PO type "${poType}".`);
    }
    return problems;
};

/** Everything that must hold before a PO can move to Active in the registry. */
export const activationProblems = (po, signatory, now = new Date()) => {
    const problems = [];
    if (!po.documents?.length) problems.push('Upload the original PO document before activating.');
    if (po.issueDate > now) problems.push('Issue date is in the future.');
    if (po.expiryDate && po.expiryDate < now) problems.push('PO has already expired.');
    problems.push(...signatoryProblems(signatory, { value: po.originalValue, poType: po.poType, department: po.department, now }));
    return problems;
};

export const assertNoProblems = (problems, message = 'PO cannot be activated.') => {
    if (problems.length) throw new ApiError(400, `${message} ${problems.join(' ')}`);
};
