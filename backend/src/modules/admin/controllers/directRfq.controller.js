import mongoose from 'mongoose';
import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import { DirectRFQ } from '../../../models/DirectRFQ.model.js';
import User from '../../../models/User.model.js';
import Vendor from '../../../models/Vendor.model.js';
import B2BCompany from '../../../models/B2BCompany.model.js';
import { istDateRangeFilter } from '../../../utils/istDateRange.js';

/**
 * Super Admin monitoring of direct employee -> vendor RFQs.
 * STRICTLY READ-ONLY: only GET handlers exist, and the router refuses every other method
 * (see admin.routes.js). Admins can see the whole negotiation but never take part in it.
 */

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const STATUSES = ['Pending Vendor', 'Negotiating', 'Vendor Accepted', 'Pending Admin Approval', 'PO Generated', 'Rejected'];

const parsePaging = (query, def = 20) => {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || def));
    return { page, limit, skip: (page - 1) * limit };
};

const summarize = (d) => {
    const messages = Array.isArray(d.messages) ? d.messages : [];
    const last = messages[messages.length - 1];
    const offers = messages.filter((m) => Number(m.priceOffer) > 0);
    return {
        id: String(d._id),
        directRfqId: d.directRfqId,
        status: d.status,
        employee: d.employeeId && typeof d.employeeId === 'object' ? { id: String(d.employeeId._id), name: d.employeeId.name, email: d.employeeId.email } : null,
        company: d.companyId && typeof d.companyId === 'object' ? { id: String(d.companyId._id), name: d.companyId.companyName } : null,
        vendor: d.vendorId && typeof d.vendorId === 'object' ? { id: String(d.vendorId._id), storeName: d.vendorId.storeName || d.vendorId.name } : null,
        productName: d.productId?.name || d.customProductName || '',
        category: d.category || '',
        quantity: d.quantity,
        targetPrice: d.targetPrice,
        targetTotal: round2(Number(d.quantity || 0) * Number(d.targetPrice || 0)),
        finalAgreedPrice: d.finalAgreedPrice ?? null,
        expectedDeliveryDate: d.expectedDeliveryDate || null,
        messageCount: messages.length,
        lastMessageAt: last?.createdAt || null,
        lastOffer: offers.length ? offers[offers.length - 1].priceOffer : null,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
    };
};

const POPULATE = [
    { path: 'employeeId', select: 'name email department designation' },
    { path: 'companyId', select: 'companyName' },
    { path: 'vendorId', select: 'storeName name email' },
    { path: 'productId', select: 'name image' },
];

// GET /api/admin/direct-rfqs
export const listDirectRFQs = asyncHandler(async (req, res) => {
    const { status, vendorId, companyId, employeeId, search } = req.query;
    const { page, limit, skip } = parsePaging(req.query);

    const filter = { ...istDateRangeFilter(req.query) };
    if (status && status !== 'all') {
        if (!STATUSES.includes(status)) throw new ApiError(400, `Status must be one of: ${STATUSES.join(', ')}`);
        filter.status = status;
    }
    for (const [key, val] of [['vendorId', vendorId], ['companyId', companyId], ['employeeId', employeeId]]) {
        if (!val) continue;
        if (!mongoose.isValidObjectId(val)) throw new ApiError(400, `Invalid ${key}.`);
        filter[key] = val;
    }
    if (search) {
        const rx = new RegExp(escapeRegex(String(search).trim()), 'i');
        const [users, vendors, companies] = await Promise.all([
            User.find({ $or: [{ name: rx }, { email: rx }] }).distinct('_id'),
            Vendor.find({ $or: [{ storeName: rx }, { name: rx }] }).distinct('_id'),
            B2BCompany.find({ companyName: rx }).distinct('_id'),
        ]);
        filter.$or = [
            { directRfqId: rx }, { customProductName: rx }, { category: rx },
            { employeeId: { $in: users } }, { vendorId: { $in: vendors } }, { companyId: { $in: companies } },
        ];
    }

    const [rows, total] = await Promise.all([
        DirectRFQ.find(filter).populate(POPULATE).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
        DirectRFQ.countDocuments(filter),
    ]);

    res.status(200).json(new ApiResponse(200, {
        items: rows.map(summarize),
        total, page, limit, pages: Math.ceil(total / limit) || 0,
    }, 'Direct RFQs fetched.'));
});

// GET /api/admin/direct-rfqs/stats
export const getDirectRFQStats = asyncHandler(async (req, res) => {
    const filter = istDateRangeFilter(req.query);
    const [byStatus, totals] = await Promise.all([
        DirectRFQ.aggregate([{ $match: filter }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
        DirectRFQ.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    targetValue: { $sum: { $multiply: ['$quantity', '$targetPrice'] } },
                    agreedValue: { $sum: { $multiply: ['$quantity', { $ifNull: ['$finalAgreedPrice', 0] }] } },
                    messages: { $sum: { $size: { $ifNull: ['$messages', []] } } },
                },
            },
        ]),
    ]);
    const statusCounts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const r of byStatus) statusCounts[r._id] = r.n;
    const t = totals[0] || {};
    res.status(200).json(new ApiResponse(200, {
        total: t.total || 0,
        statusCounts,
        targetValue: round2(t.targetValue),
        agreedValue: round2(t.agreedValue),
        totalMessages: t.messages || 0,
    }, 'Direct RFQ stats fetched.'));
});

// GET /api/admin/direct-rfqs/:id   (:id = DRFQ-XXXXXX or the database id)
export const getDirectRFQDetail = asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const query = mongoose.isValidObjectId(id) ? { $or: [{ directRfqId: id }, { _id: id }] } : { directRfqId: id };
    const d = await DirectRFQ.findOne(query).populate(POPULATE).lean();
    if (!d) throw new ApiError(404, 'Direct RFQ not found.');

    res.status(200).json(new ApiResponse(200, {
        ...summarize(d),
        requirementDetails: d.requirementDetails || '',
        attachment: d.attachment || null,
        readOnly: true,
        messages: (d.messages || []).map((m) => ({
            id: String(m._id),
            senderType: m.senderType,
            senderName: m.senderName,
            message: m.message,
            priceOffer: m.priceOffer ?? null,
            attachments: m.attachments || [],
            createdAt: m.createdAt,
        })),
    }, 'Direct RFQ fetched.'));
});
