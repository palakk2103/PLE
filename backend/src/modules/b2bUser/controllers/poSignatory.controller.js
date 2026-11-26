import mongoose from 'mongoose';
import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import POSignatory from '../../../models/POSignatory.model.js';
import CompanyPO from '../../../models/CompanyPO.model.js';
import { PO_TYPES } from '../../../models/CompanyPO.model.js';
import { uploadLocalFileToCloudinaryAndCleanupWithType, cleanupLocalFiles } from '../../../services/upload.service.js';
import { getCompanyId } from './employee.controller.js';
import { cleanText, parseDate, parseMoney, pushHistory, sha256OfFile } from '../../../services/companyPO.service.js';

const AUTHORITY_BASES = ['board_resolution', 'delegation_of_authority', 'power_of_attorney', 'other'];
const SIGNATURE_METHODS = ['wet_ink_scan', 'e_signature', 'digital_certificate'];
const ADMIN_SETTABLE_STATUSES = ['unverified', 'pending_verification', 'verified', 'suspended', 'revoked'];

const toView = (s) => {
    const o = s.toObject();
    return { ...o, id: String(o._id), effectiveStatus: s.effectiveStatus() };
};

const stringList = (value, label) => {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) throw new ApiError(400, `${label} must be a list.`);
    return [...new Set(value.map((v) => String(v).trim()).filter(Boolean))].slice(0, 50);
};

const readScope = (scope = {}) => {
    const poTypes = stringList(scope.poTypes, 'Scope PO types');
    const bad = poTypes.filter((t) => !PO_TYPES.includes(t));
    if (bad.length) throw new ApiError(400, `Unknown PO type in scope: ${bad.join(', ')}.`);
    return { departments: stringList(scope.departments, 'Scope departments'), poTypes };
};

const parseLimit = (value) => {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null; // no limit recorded
    return parseMoney(value, 'Approval limit');
};

const findOwn = async (req) => {
    const companyId = await getCompanyId(req);
    if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Signatory not found.');
    const signatory = await POSignatory.findOne({ _id: req.params.id, companyId });
    if (!signatory) throw new ApiError(404, 'Signatory not found.');
    return { companyId, signatory };
};

export const listSignatories = asyncHandler(async (req, res) => {
    const companyId = await getCompanyId(req);
    const list = await POSignatory.find({ companyId }).sort({ createdAt: -1 });
    res.status(200).json(new ApiResponse(200, list.map(toView), 'Signatories fetched.'));
});

export const getSignatory = asyncHandler(async (req, res) => {
    const { signatory } = await findOwn(req);
    res.status(200).json(new ApiResponse(200, toView(signatory), 'Signatory fetched.'));
});

export const createSignatory = asyncHandler(async (req, res) => {
    const companyId = await getCompanyId(req);
    const b = req.body || {};
    if (!AUTHORITY_BASES.includes(b.authorityBasis)) throw new ApiError(400, 'Choose a valid authority basis.');
    const signatureMethod = b.signatureMethod || 'wet_ink_scan';
    if (!SIGNATURE_METHODS.includes(signatureMethod)) throw new ApiError(400, 'Choose a valid signature method.');

    const effectiveFrom = parseDate(b.effectiveFrom, 'Effective-from date');
    const effectiveTo = b.effectiveTo ? parseDate(b.effectiveTo, 'Effective-to date') : null;
    if (effectiveTo && effectiveTo <= effectiveFrom) throw new ApiError(400, 'Effective-to date must be after effective-from date.');

    const signatory = new POSignatory({
        companyId,
        fullName: cleanText(b.fullName, { min: 2, max: 120, label: 'Full legal name' }),
        designation: cleanText(b.designation, { min: 2, max: 120, label: 'Designation' }),
        department: cleanText(b.department, { max: 120, label: 'Department' }),
        employeeRef: cleanText(b.employeeRef, { max: 60, label: 'Employee reference' }),
        authorityBasis: b.authorityBasis,
        approvalLimit: parseLimit(b.approvalLimit) ?? null,
        scope: readScope(b.scope),
        effectiveFrom,
        effectiveTo,
        signatureMethod,
        verificationStatus: 'unverified',
        createdBy: req.user.id,
    });
    pushHistory(signatory, 'SIGNATORY_ADDED', req);
    await signatory.save();
    res.status(201).json(new ApiResponse(201, toView(signatory), 'Signatory added.'));
});

export const updateSignatory = asyncHandler(async (req, res) => {
    const { signatory } = await findOwn(req);
    const b = req.body || {};
    const before = {};
    const after = {};
    const set = (key, value) => {
        before[key] = signatory[key];
        after[key] = value;
        signatory[key] = value;
    };

    if (b.fullName !== undefined) set('fullName', cleanText(b.fullName, { min: 2, max: 120, label: 'Full legal name' }));
    if (b.designation !== undefined) set('designation', cleanText(b.designation, { min: 2, max: 120, label: 'Designation' }));
    if (b.department !== undefined) set('department', cleanText(b.department, { max: 120, label: 'Department' }));
    if (b.employeeRef !== undefined) set('employeeRef', cleanText(b.employeeRef, { max: 60, label: 'Employee reference' }));
    if (b.authorityBasis !== undefined) {
        if (!AUTHORITY_BASES.includes(b.authorityBasis)) throw new ApiError(400, 'Choose a valid authority basis.');
        set('authorityBasis', b.authorityBasis);
    }
    if (b.signatureMethod !== undefined) {
        if (!SIGNATURE_METHODS.includes(b.signatureMethod)) throw new ApiError(400, 'Choose a valid signature method.');
        set('signatureMethod', b.signatureMethod);
    }
    if (b.approvalLimit !== undefined) set('approvalLimit', parseLimit(b.approvalLimit));
    if (b.scope !== undefined) set('scope', readScope(b.scope));
    if (b.effectiveFrom !== undefined) set('effectiveFrom', parseDate(b.effectiveFrom, 'Effective-from date'));
    if (b.effectiveTo !== undefined) set('effectiveTo', b.effectiveTo ? parseDate(b.effectiveTo, 'Effective-to date') : null);
    if (signatory.effectiveTo && signatory.effectiveTo <= signatory.effectiveFrom) {
        throw new ApiError(400, 'Effective-to date must be after effective-from date.');
    }

    if (!Object.keys(after).length) throw new ApiError(400, 'Nothing to update.');

    // Changing authority details invalidates an earlier verification: it has to be re-reviewed.
    const authorityChanged = ['authorityBasis', 'approvalLimit', 'scope', 'effectiveFrom', 'effectiveTo'].some((k) => k in after);
    if (authorityChanged && signatory.verificationStatus === 'verified') {
        signatory.verificationStatus = 'pending_verification';
        after.verificationStatus = 'pending_verification';
    }

    pushHistory(signatory, 'SIGNATORY_UPDATED', req, { before, after });
    await signatory.save();
    res.status(200).json(new ApiResponse(200, toView(signatory), 'Signatory updated.'));
});

/** Upload the authority evidence (board resolution, delegation letter, ...). Stored privately-by-role: only returned to company admins. */
export const uploadEvidence = asyncHandler(async (req, res) => {
    if (!req.file?.path) throw new ApiError(400, 'Evidence document is required.');
    let signatory;
    try {
        ({ signatory } = await findOwn(req));
        const sha256 = await sha256OfFile(req.file.path);
        const uploaded = await uploadLocalFileToCloudinaryAndCleanupWithType(req.file.path, 'b2b/po/signatory-evidence', 'auto');
        signatory.evidenceDocument = {
            url: uploaded.url,
            fileName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
            sha256,
            uploadedAt: new Date(),
            uploadedBy: req.user.id,
        };
        // New evidence has to be reviewed again.
        if (signatory.verificationStatus === 'verified') signatory.verificationStatus = 'pending_verification';
        pushHistory(signatory, 'SIGNATORY_EVIDENCE_UPLOADED', req, { after: { sha256 } });
        await signatory.save();
        res.status(200).json(new ApiResponse(200, toView(signatory), 'Evidence uploaded.'));
    } catch (err) {
        await cleanupLocalFiles([req.file?.path]).catch(() => null);
        throw err;
    }
});

/**
 * Company admin records the outcome of reviewing the authority evidence.
 * 'verified' needs evidence on file. For wet-ink uploads this is a document review, not a
 * cryptographic verification (spec section 7) and the history entry says so.
 */
export const setVerificationStatus = asyncHandler(async (req, res) => {
    const { signatory } = await findOwn(req);
    const { status, note } = req.body || {};
    if (!ADMIN_SETTABLE_STATUSES.includes(status)) throw new ApiError(400, 'Choose a valid verification status.');
    if (status === 'verified' && !signatory.evidenceDocument?.url) {
        throw new ApiError(400, 'Upload the authority evidence document before marking the signatory as verified.');
    }
    if (status === 'verified' && signatory.effectiveTo && signatory.effectiveTo < new Date()) {
        throw new ApiError(400, 'This signatory\'s authority has already ended.');
    }
    const before = signatory.verificationStatus;
    signatory.verificationStatus = status;
    pushHistory(signatory, status === 'verified' ? 'SIGNATORY_AUTHORITY_VERIFIED' : 'SIGNATORY_STATUS_CHANGED', req, {
        before: { verificationStatus: before },
        after: { verificationStatus: status },
        note: [status === 'verified' && signatory.signatureMethod === 'wet_ink_scan' ? 'Document review (not cryptographic verification).' : '', String(note || '').trim().slice(0, 300)]
            .filter(Boolean)
            .join(' '),
    });
    await signatory.save();
    res.status(200).json(new ApiResponse(200, toView(signatory), 'Signatory status updated.'));
});

/** Signatories are never deleted (audit trail). Revoke instead; refused while linked to an active PO. */
export const revokeSignatory = asyncHandler(async (req, res) => {
    const { companyId, signatory } = await findOwn(req);
    const inUse = await CompanyPO.countDocuments({
        companyId,
        signatoryId: signatory._id,
        lifecycleStatus: { $in: ['active', 'pending_company_approval', 'awaiting_signature'] },
    });
    if (inUse) {
        throw new ApiError(400, `This signatory is linked to ${inUse} live PO(s). Revoke or reassign those POs first.`);
    }
    signatory.verificationStatus = 'revoked';
    pushHistory(signatory, 'SIGNATORY_REVOKED', req, { note: String(req.body?.reason || '').trim().slice(0, 300) });
    await signatory.save();
    res.status(200).json(new ApiResponse(200, toView(signatory), 'Signatory revoked.'));
});
