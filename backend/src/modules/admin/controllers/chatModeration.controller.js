import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import ChatViolation from '../../../models/ChatViolation.model.js';
import ChatReport from '../../../models/ChatReport.model.js';
import User from '../../../models/User.model.js';
import Vendor from '../../../models/Vendor.model.js';

/**
 * GET /api/admin/chat-moderation/violations
 * Returns paginated list of chat violations for admin review.
 */
export const getChatViolations = asyncHandler(async (req, res) => {
    const page     = Math.max(1, parseInt(req.query.page  || '1', 10));
    const limit    = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const skip     = (page - 1) * limit;

    // Optional filters
    const filter = {};
    if (req.query.category)   filter.category   = req.query.category;
    if (req.query.action)     filter.action      = req.query.action;
    if (req.query.senderType) filter.senderType  = req.query.senderType;
    if (req.query.direction)  filter.direction   = req.query.direction;
    if (req.query.vendorId)   filter.vendorId    = req.query.vendorId;
    if (req.query.status)     filter.status      = req.query.status;

    // Date range filter
    if (req.query.from || req.query.to) {
        filter.createdAt = {};
        if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
        if (req.query.to)   filter.createdAt.$lte = new Date(req.query.to);
    }

    const [violations, total] = await Promise.all([
        ChatViolation.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('vendorId', 'storeName name')
            .populate('reviewedBy', 'name email')
            .lean(),
        ChatViolation.countDocuments(filter),
    ]);

    res.status(200).json(new ApiResponse(200, {
        violations,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    }, 'Chat violations fetched.'));
});

/**
 * POST /api/admin/chat-moderation/violations/:id/action
 * Admin resolves, warns, mutes sender, or dismisses violation.
 */
export const takeViolationAction = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { action, muteDurationHours, notes } = req.body;

    const violation = await ChatViolation.findById(id);
    if (!violation) throw new ApiError(404, 'Violation record not found.');

    if (action === 'MUTE') {
        const hours = Number(muteDurationHours) || 24;
        const muteUntil = new Date(Date.now() + hours * 3600 * 1000);

        if (violation.senderType === 'vendor') {
            await Vendor.findByIdAndUpdate(violation.senderId, {
                chatMutedUntil: muteUntil,
                chatRestrictionReason: notes || 'Chat communication violation',
            });
        } else {
            await User.findByIdAndUpdate(violation.senderId, {
                chatMutedUntil: muteUntil,
                chatRestrictionReason: notes || 'Chat communication violation',
            });
        }
        violation.actionTaken = 'MUTED';
        violation.status = 'RESOLVED';
    } else if (action === 'WARN') {
        violation.actionTaken = 'WARNED';
        violation.status = 'RESOLVED';
    } else if (action === 'DISMISS') {
        violation.actionTaken = 'DISMISSED';
        violation.status = 'DISMISSED';
    } else {
        violation.actionTaken = 'RESOLVED';
        violation.status = 'RESOLVED';
    }

    violation.adminNotes = notes || '';
    violation.reviewedBy = req.user.id;
    violation.reviewedAt = new Date();
    await violation.save();

    res.status(200).json(new ApiResponse(200, violation, 'Action recorded successfully.'));
});

/**
 * GET /api/admin/chat-moderation/reports
 * Returns paginated user-submitted abuse reports.
 */
export const getChatReports = asyncHandler(async (req, res) => {
    const page  = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const skip  = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.reason) filter.reason = req.query.reason;

    const [reports, total] = await Promise.all([
        ChatReport.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('reviewedBy', 'name email')
            .lean(),
        ChatReport.countDocuments(filter),
    ]);

    res.status(200).json(new ApiResponse(200, {
        reports,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    }, 'Chat reports fetched.'));
});

/**
 * POST /api/admin/chat-moderation/reports/:id/action
 * Admin resolves or dismisses a user-submitted chat report.
 */
export const takeReportAction = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { action, muteDurationHours, notes } = req.body;

    const report = await ChatReport.findById(id);
    if (!report) throw new ApiError(404, 'Report not found.');

    if (action === 'MUTE') {
        const hours = Number(muteDurationHours) || 24;
        const muteUntil = new Date(Date.now() + hours * 3600 * 1000);

        if (report.reportedUserType === 'vendor') {
            await Vendor.findByIdAndUpdate(report.reportedUserId, {
                chatMutedUntil: muteUntil,
                chatRestrictionReason: notes || 'Chat abuse report confirmed',
            });
        } else {
            await User.findByIdAndUpdate(report.reportedUserId, {
                chatMutedUntil: muteUntil,
                chatRestrictionReason: notes || 'Chat abuse report confirmed',
            });
        }
        report.actionTaken = 'MUTED';
        report.status = 'RESOLVED';
    } else if (action === 'WARN') {
        report.actionTaken = 'WARNED';
        report.status = 'RESOLVED';
    } else if (action === 'DISMISS') {
        report.actionTaken = 'DISMISSED';
        report.status = 'DISMISSED';
    } else {
        report.actionTaken = 'RESOLVED';
        report.status = 'RESOLVED';
    }

    report.adminNotes = notes || '';
    report.reviewedBy = req.user.id;
    report.reviewedAt = new Date();
    await report.save();

    res.status(200).json(new ApiResponse(200, report, 'Report updated successfully.'));
});

/**
 * GET /api/admin/chat-moderation/stats
 * Returns aggregated violation stats for the admin dashboard.
 */
export const getChatViolationStats = asyncHandler(async (req, res) => {
    const [categoryBreakdown, actionBreakdown, recentCount, openReportsCount] = await Promise.all([
        ChatViolation.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]),
        ChatViolation.aggregate([
            { $group: { _id: '$action', count: { $sum: 1 } } },
        ]),
        ChatViolation.countDocuments({
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        }),
        ChatReport.countDocuments({ status: 'OPEN' }),
    ]);

    const totalViolations = await ChatViolation.countDocuments();

    res.status(200).json(new ApiResponse(200, {
        totalViolations,
        last24Hours: recentCount,
        openReports: openReportsCount,
        byCategory: categoryBreakdown,
        byAction: actionBreakdown,
    }, 'Chat moderation stats fetched.'));
});
