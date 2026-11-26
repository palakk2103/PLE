import mongoose from 'mongoose';
import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import User from '../../../models/User.model.js';
import POSignatory from '../../../models/POSignatory.model.js';
import CompanyPO, { PO_TYPES, USAGE_POLICIES } from '../../../models/CompanyPO.model.js';
import { uploadLocalFileToCloudinaryAndCleanupWithType, cleanupLocalFiles } from '../../../services/upload.service.js';
import { getCompanyId } from './employee.controller.js';
import {
    round2,
    newPlePoId,
    sha256OfFile,
    pushHistory,
    parseDate,
    parseMoney,
    cleanText,
    activationProblems,
    assertNoProblems,
    signatoryProblems,
} from '../../../services/companyPO.service.js';

const SUPPORTED_CURRENCIES = ['INR']; // other currencies only once conversion policy exists (spec section 12)
// Fields that can still be edited once a PO is live. Value, number, dates, type and signatory
// need a formal amendment (Phase 4) so the original authorization is never silently changed.
const LIVE_EDITABLE = ['title', 'department', 'ownerUserId', 'purchaseScope', 'paymentTerms'];

const toView = (po, { withHistory = false } = {}) => {
    const o = po.toObject({ virtuals: true });
    const view = {
        ...o,
        id: String(o._id),
        availableAmount: po.availableAmount,
        usageStatus: po.usageStatus,
        lifecycleStatus: po.effectiveLifecycleStatus, // expiry applied
        storedLifecycleStatus: po.lifecycleStatus,
    };
    delete view.__v;
    if (!withHistory) delete view.history;
    return view;
};

const findOwn = async (req, { populate = false } = {}) => {
    const companyId = await getCompanyId(req);
    if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Purchase order not found.');
    let q = CompanyPO.findOne({ _id: req.params.id, companyId });
    if (populate) q = q.populate('signatoryId', 'fullName designation department approvalLimit verificationStatus effectiveFrom effectiveTo');
    const po = await q;
    if (!po) throw new ApiError(404, 'Purchase order not found.');
    return { companyId, po };
};

const loadSignatory = async (companyId, signatoryId) => {
    if (!signatoryId) return null;
    if (!mongoose.isValidObjectId(signatoryId)) throw new ApiError(400, 'Selected signatory is invalid.');
    const s = await POSignatory.findOne({ _id: signatoryId, companyId });
    if (!s) throw new ApiError(400, 'Selected signatory does not belong to your company.');
    return s;
};

const stringList = (value) =>
    Array.isArray(value) ? [...new Set(value.map((v) => String(v).trim()).filter(Boolean))].slice(0, 50) : [];

/** Validates an allocation block; named users must belong to this company. */
const readAllocation = async (companyId, a = {}) => {
    const mode = a.mode || 'company';
    if (!['company', 'departments', 'users'].includes(mode)) throw new ApiError(400, 'Choose a valid allocation mode.');
    if (mode === 'company') return { mode, departments: [], userIds: [] };
    if (mode === 'departments') {
        const departments = stringList(a.departments);
        if (!departments.length) throw new ApiError(400, 'Select at least one department.');
        return { mode, departments, userIds: [] };
    }
    const ids = [...new Set((a.userIds || []).map(String))];
    if (!ids.length) throw new ApiError(400, 'Select at least one employee.');
    if (!ids.every((id) => mongoose.isValidObjectId(id))) throw new ApiError(400, 'One or more selected employees are invalid.');
    const found = await User.countDocuments({ _id: { $in: ids }, companyId, role: { $in: ['b2bAdmin', 'b2bEmployee'] } });
    if (found !== ids.length) throw new ApiError(400, 'One or more selected employees do not belong to your company.');
    return { mode, departments: [], userIds: ids };
};

const readScope = (s = {}) => ({
    notes: cleanText(s.notes, { max: 1000, label: 'Purchase scope notes' }),
    categories: stringList(s.categories),
    vendorIds: (s.vendorIds || []).filter((id) => mongoose.isValidObjectId(id)),
});

/* ───────────────────────────── list / stats ───────────────────────────── */

const buildFilter = (companyId, q) => {
    const now = new Date();
    const filter = { companyId };
    const and = [];

    if (q.q) {
        const rx = new RegExp(String(q.q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        and.push({ $or: [{ poNumber: rx }, { title: rx }, { plePoId: rx }] });
    }
    if (q.poType && PO_TYPES.includes(q.poType)) filter.poType = q.poType;
    if (q.department) filter.department = String(q.department);
    if (q.signatoryId && mongoose.isValidObjectId(q.signatoryId)) filter.signatoryId = q.signatoryId;
    if (q.pleReviewStatus) filter.pleReviewStatus = String(q.pleReviewStatus);
    if (q.minValue) filter.originalValue = { ...(filter.originalValue || {}), $gte: Number(q.minValue) };
    if (q.maxValue) filter.originalValue = { ...(filter.originalValue || {}), $lte: Number(q.maxValue) };
    if (q.expiresBefore) {
        const d = new Date(q.expiresBefore);
        if (!Number.isNaN(d.getTime())) filter.expiryDate = { $lte: d };
    }

    // Lifecycle status with expiry applied.
    if (q.status === 'expired') {
        and.push({ lifecycleStatus: 'active', expiryDate: { $lt: now } });
    } else if (q.status === 'active') {
        and.push({ lifecycleStatus: 'active', $or: [{ expiryDate: null }, { expiryDate: { $gte: now } }] });
    } else if (q.status && ['draft', 'pending_company_approval', 'awaiting_signature', 'revoked', 'closed'].includes(q.status)) {
        filter.lifecycleStatus = q.status;
    }

    // Usage status (derived from amounts).
    const avail = { $subtract: [{ $subtract: ['$originalValue', '$consumedAmount'] }, '$reservedAmount'] };
    if (q.usage === 'unused') and.push({ consumedAmount: 0, reservedAmount: 0 });
    else if (q.usage === 'reserved') and.push({ reservedAmount: { $gt: 0 }, consumedAmount: 0, $expr: { $gt: [avail, 0] } });
    else if (q.usage === 'partially_used') and.push({ consumedAmount: { $gt: 0 }, $expr: { $gt: [avail, 0] } });
    else if (q.usage === 'exhausted') and.push({ $expr: { $lte: [avail, 0] } });

    // "Available for checkout" = active, not expired, balance left.
    if (q.availableForCheckout === 'true') {
        and.push({ lifecycleStatus: 'active', $or: [{ expiryDate: null }, { expiryDate: { $gte: now } }], $expr: { $gt: [avail, 0] } });
    }

    if (and.length) filter.$and = and;
    return filter;
};

export const listCompanyPOs = asyncHandler(async (req, res) => {
    const companyId = await getCompanyId(req);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const filter = buildFilter(companyId, req.query);

    const [rows, total] = await Promise.all([
        CompanyPO.find(filter)
            .populate('signatoryId', 'fullName designation verificationStatus effectiveTo')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
        CompanyPO.countDocuments(filter),
    ]);
    res.status(200).json(
        new ApiResponse(200, { items: rows.map((p) => toView(p)), page, limit, total, pages: Math.ceil(total / limit) }, 'Purchase orders fetched.')
    );
});

/** Dashboard numbers (spec section 15). Only PO records that are live count toward value. */
export const getCompanyPOStats = asyncHandler(async (req, res) => {
    const companyId = await getCompanyId(req);
    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const all = await CompanyPO.find({ companyId }).select(
        'originalValue consumedAmount reservedAmount lifecycleStatus expiryDate department'
    ).limit(10000);

    const stats = {
        total: all.length,
        active: 0,
        expired: 0,
        revoked: 0,
        draft: 0,
        unused: 0,
        partiallyUsed: 0,
        exhausted: 0,
        expiringIn30Days: 0,
        activeValue: 0,
        availableValue: 0,
        reservedValue: 0,
        consumedValue: 0,
        byDepartment: {},
    };
    for (const po of all) {
        const status = po.effectiveLifecycleStatus;
        if (status === 'active') {
            stats.active += 1;
            stats.activeValue += po.originalValue;
            stats.availableValue += po.availableAmount;
            stats.reservedValue += po.reservedAmount;
            stats.consumedValue += po.consumedAmount;
            if (po.expiryDate && po.expiryDate <= soon) stats.expiringIn30Days += 1;
            const usage = po.usageStatus;
            if (usage === 'unused') stats.unused += 1;
            else if (usage === 'partially_used') stats.partiallyUsed += 1;
            else if (usage === 'exhausted') stats.exhausted += 1;
            const dept = po.department || 'Unassigned';
            stats.byDepartment[dept] = round2((stats.byDepartment[dept] || 0) + po.originalValue);
        } else if (status === 'expired') stats.expired += 1;
        else if (status === 'revoked') stats.revoked += 1;
        else if (status === 'draft') stats.draft += 1;
    }
    for (const k of ['activeValue', 'availableValue', 'reservedValue', 'consumedValue']) stats[k] = round2(stats[k]);
    res.status(200).json(new ApiResponse(200, stats, 'PO stats fetched.'));
});

export const getCompanyPO = asyncHandler(async (req, res) => {
    const { po } = await findOwn(req, { populate: true });
    res.status(200).json(new ApiResponse(200, toView(po, { withHistory: true }), 'Purchase order fetched.'));
});

/* ───────────────────────────── create / edit ───────────────────────────── */

export const createCompanyPO = asyncHandler(async (req, res) => {
    const companyId = await getCompanyId(req);
    const b = req.body || {};

    if (!PO_TYPES.includes(b.poType)) throw new ApiError(400, 'Choose a valid PO type.');
    if (!USAGE_POLICIES.includes(b.usagePolicy)) throw new ApiError(400, 'Choose a valid usage policy.');
    const currency = String(b.currency || 'INR').toUpperCase();
    if (!SUPPORTED_CURRENCIES.includes(currency)) throw new ApiError(400, `Currency ${currency} is not supported yet.`);

    const poNumber = cleanText(b.poNumber, { min: 1, max: 80, label: 'PO number' });
    const duplicate = await CompanyPO.findOne({ companyId, poNumber }).select('_id');
    if (duplicate) throw new ApiError(409, `PO number "${poNumber}" is already registered in your company.`);

    const issueDate = parseDate(b.issueDate, 'Issue date');
    if (issueDate > new Date()) throw new ApiError(400, 'Issue date cannot be in the future.');
    const expiryDate = b.expiryDate ? parseDate(b.expiryDate, 'Expiry date') : null;
    if (expiryDate && expiryDate <= issueDate) throw new ApiError(400, 'Expiry date must be after the issue date.');

    const signatory = await loadSignatory(companyId, b.signatoryId);
    const allocation = await readAllocation(companyId, b.allocation);

    const po = new CompanyPO({
        companyId,
        plePoId: newPlePoId(),
        poNumber,
        title: cleanText(b.title, { min: 2, max: 200, label: 'PO title' }),
        poType: b.poType,
        department: cleanText(b.department, { max: 120, label: 'Department' }),
        ownerUserId: req.user.id,
        issueDate,
        expiryDate,
        currency,
        originalValue: parseMoney(b.originalValue, 'Original authorized value'),
        signatoryId: signatory?._id || null,
        usagePolicy: b.usagePolicy,
        allocation,
        purchaseScope: readScope(b.purchaseScope),
        paymentTerms: cleanText(b.paymentTerms, { max: 300, label: 'Payment terms' }),
        lifecycleStatus: 'draft',
        createdBy: req.user.id,
    });
    pushHistory(po, 'PO_CREATED', req, { after: { poNumber, originalValue: po.originalValue, poType: po.poType } });
    try {
        await po.save();
    } catch (err) {
        if (err?.code === 11000) throw new ApiError(409, `PO number "${poNumber}" is already registered in your company.`);
        throw err;
    }
    res.status(201).json(new ApiResponse(201, toView(po, { withHistory: true }), 'PO saved as draft. Upload the document, then activate it.'));
});

export const updateCompanyPO = asyncHandler(async (req, res) => {
    const { companyId, po } = await findOwn(req);
    if (['revoked', 'closed'].includes(po.lifecycleStatus)) throw new ApiError(400, `A ${po.lifecycleStatus} PO cannot be edited.`);
    const isDraft = po.lifecycleStatus === 'draft';
    const b = req.body || {};

    const allowed = isDraft
        ? [...LIVE_EDITABLE, 'poNumber', 'poType', 'issueDate', 'expiryDate', 'originalValue', 'currency', 'signatoryId', 'usagePolicy']
        : LIVE_EDITABLE;
    const blocked = Object.keys(b).filter((k) => !allowed.includes(k) && !['allocation'].includes(k) && b[k] !== undefined);
    if (blocked.length) {
        throw new ApiError(400, `${blocked.join(', ')} cannot be changed once a PO is live. Register a new/amended PO instead.`);
    }

    const before = {};
    const after = {};
    const set = (key, value) => {
        before[key] = po[key];
        after[key] = value;
        po[key] = value;
    };

    if (b.title !== undefined) set('title', cleanText(b.title, { min: 2, max: 200, label: 'PO title' }));
    if (b.department !== undefined) set('department', cleanText(b.department, { max: 120, label: 'Department' }));
    if (b.paymentTerms !== undefined) set('paymentTerms', cleanText(b.paymentTerms, { max: 300, label: 'Payment terms' }));
    if (b.purchaseScope !== undefined) set('purchaseScope', readScope(b.purchaseScope));
    if (b.allocation !== undefined) set('allocation', await readAllocation(companyId, b.allocation));
    if (b.ownerUserId !== undefined) {
        if (!mongoose.isValidObjectId(b.ownerUserId) || !(await User.exists({ _id: b.ownerUserId, companyId }))) {
            throw new ApiError(400, 'Selected owner does not belong to your company.');
        }
        set('ownerUserId', b.ownerUserId);
    }

    if (isDraft) {
        if (b.poNumber !== undefined) {
            const poNumber = cleanText(b.poNumber, { min: 1, max: 80, label: 'PO number' });
            if (poNumber !== po.poNumber) {
                if (await CompanyPO.exists({ companyId, poNumber, _id: { $ne: po._id } })) {
                    throw new ApiError(409, `PO number "${poNumber}" is already registered in your company.`);
                }
                set('poNumber', poNumber);
            }
        }
        if (b.poType !== undefined) {
            if (!PO_TYPES.includes(b.poType)) throw new ApiError(400, 'Choose a valid PO type.');
            set('poType', b.poType);
        }
        if (b.usagePolicy !== undefined) {
            if (!USAGE_POLICIES.includes(b.usagePolicy)) throw new ApiError(400, 'Choose a valid usage policy.');
            set('usagePolicy', b.usagePolicy);
        }
        if (b.currency !== undefined) {
            const c = String(b.currency).toUpperCase();
            if (!SUPPORTED_CURRENCIES.includes(c)) throw new ApiError(400, `Currency ${c} is not supported yet.`);
            set('currency', c);
        }
        if (b.originalValue !== undefined) set('originalValue', parseMoney(b.originalValue, 'Original authorized value'));
        if (b.issueDate !== undefined) set('issueDate', parseDate(b.issueDate, 'Issue date'));
        if (b.expiryDate !== undefined) set('expiryDate', b.expiryDate ? parseDate(b.expiryDate, 'Expiry date') : null);
        if (b.signatoryId !== undefined) {
            const s = await loadSignatory(companyId, b.signatoryId);
            set('signatoryId', s?._id || null);
        }
        if (po.issueDate > new Date()) throw new ApiError(400, 'Issue date cannot be in the future.');
        if (po.expiryDate && po.expiryDate <= po.issueDate) throw new ApiError(400, 'Expiry date must be after the issue date.');
    }

    if (!Object.keys(after).length) throw new ApiError(400, 'Nothing to update.');
    pushHistory(po, 'PO_UPDATED', req, { before, after });
    try {
        await po.save();
    } catch (err) {
        if (err?.code === 11000) throw new ApiError(409, 'That PO number is already registered in your company.');
        throw err;
    }
    res.status(200).json(new ApiResponse(200, toView(po, { withHistory: true }), 'PO updated.'));
});

/* ───────────────────────────── document / lifecycle ───────────────────────────── */

/** Upload the original PO document. Every upload is a NEW version; earlier versions are kept. */
export const uploadPODocument = asyncHandler(async (req, res) => {
    if (!req.file?.path) throw new ApiError(400, 'PO document is required.');
    try {
        const { po } = await findOwn(req);
        if (['revoked', 'closed'].includes(po.lifecycleStatus)) throw new ApiError(400, `A ${po.lifecycleStatus} PO cannot take new documents.`);
        const sha256 = await sha256OfFile(req.file.path);
        const uploaded = await uploadLocalFileToCloudinaryAndCleanupWithType(req.file.path, 'b2b/po/documents', 'auto');
        const version = (po.documents.at(-1)?.version || 0) + 1;
        po.documents.push({
            version,
            url: uploaded.url,
            fileName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
            sha256,
            uploadedAt: new Date(),
            uploadedBy: req.user.id,
        });
        pushHistory(po, version === 1 ? 'PO_DOCUMENT_UPLOADED' : 'PO_DOCUMENT_VERSIONED', req, { after: { version, sha256 } });
        await po.save();
        res.status(200).json(new ApiResponse(200, toView(po, { withHistory: true }), `Document uploaded (version ${version}).`));
    } catch (err) {
        await cleanupLocalFiles([req.file?.path]).catch(() => null);
        throw err;
    }
});

export const activateCompanyPO = asyncHandler(async (req, res) => {
    const { companyId, po } = await findOwn(req);
    if (po.lifecycleStatus === 'active') throw new ApiError(400, 'This PO is already active.');
    if (!['draft', 'pending_company_approval', 'awaiting_signature'].includes(po.lifecycleStatus)) {
        throw new ApiError(400, `A ${po.lifecycleStatus} PO cannot be activated.`);
    }
    const signatory = await loadSignatory(companyId, po.signatoryId);
    const problems = activationProblems(po, signatory);

    if (problems.length) {
        // Signature missing/invalid: the PO is incomplete and waits for a valid signatory instead of staying silent.
        if (po.lifecycleStatus === 'draft' && po.documents.length && !signatory) {
            po.lifecycleStatus = 'awaiting_signature';
            pushHistory(po, 'PO_AWAITING_SIGNATURE', req, { note: problems.join(' ') });
            await po.save();
        }
        assertNoProblems(problems);
    }

    po.lifecycleStatus = 'active';
    po.activatedAt = new Date();
    pushHistory(po, 'PO_ACTIVATED', req);
    await po.save();
    res.status(200).json(new ApiResponse(200, toView(po, { withHistory: true }), 'PO is now active in your registry.'));
});

export const revokeCompanyPO = asyncHandler(async (req, res) => {
    const { po } = await findOwn(req);
    const reason = cleanText(req.body?.reason, { min: 3, max: 300, label: 'Reason' });
    if (['revoked', 'closed'].includes(po.lifecycleStatus)) throw new ApiError(400, `PO is already ${po.lifecycleStatus}.`);
    if (po.reservedAmount > 0) {
        throw new ApiError(400, 'This PO has value reserved against open orders. Resolve those orders before revoking.');
    }
    po.lifecycleStatus = 'revoked';
    po.revokedAt = new Date();
    po.revokeReason = reason;
    pushHistory(po, 'PO_REVOKED', req, { note: reason });
    await po.save();
    res.status(200).json(new ApiResponse(200, toView(po, { withHistory: true }), 'PO revoked. It can no longer be used for new orders.'));
});

export const closeCompanyPO = asyncHandler(async (req, res) => {
    const { po } = await findOwn(req);
    if (po.lifecycleStatus !== 'active') throw new ApiError(400, 'Only an active PO can be closed.');
    if (po.reservedAmount > 0) throw new ApiError(400, 'This PO still has value reserved against open orders.');
    po.lifecycleStatus = 'closed';
    pushHistory(po, 'PO_CLOSED', req, { note: String(req.body?.reason || '').trim().slice(0, 300) });
    await po.save();
    res.status(200).json(new ApiResponse(200, toView(po, { withHistory: true }), 'PO closed.'));
});

/** Preview why a PO is or is not ready, without changing anything (used by the Add PO screen). */
export const checkCompanyPOReadiness = asyncHandler(async (req, res) => {
    const { companyId, po } = await findOwn(req);
    const signatory = await loadSignatory(companyId, po.signatoryId);
    const problems = activationProblems(po, signatory);
    res.status(200).json(new ApiResponse(200, { ready: problems.length === 0, problems }, 'Readiness checked.'));
});

// Re-exported so the checkout phase can reuse the same signatory rules.
export { signatoryProblems };
