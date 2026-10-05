import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import AuditLog from '../../../models/AuditLog.model.js';

// GET /api/admin/audit-logs
export const getAuditLogs = asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 25));
    const skip = (page - 1) * limit;

    const {
        q,
        module: moduleFilter,
        action: actionFilter,
        status: statusFilter,
        role: roleFilter,
        identityId: identityIdFilter,
        startDate,
        endDate
    } = req.query;

    const filter = {};

    if (q) {
        const queryRegex = new RegExp(q.trim(), 'i');
        filter.$or = [
            { actorName: queryRegex },
            { actorIdentityId: queryRegex },
            { description: queryRegex },
            { entityId: queryRegex },
            { action: queryRegex }
        ];
    }

    if (moduleFilter && moduleFilter !== 'all') {
        filter.module = moduleFilter.toUpperCase();
    }

    if (actionFilter && actionFilter !== 'all') {
        filter.action = actionFilter.toUpperCase();
    }

    if (statusFilter && statusFilter !== 'all') {
        filter.status = statusFilter.toUpperCase();
    }

    if (roleFilter && roleFilter !== 'all') {
        filter.actorRole = roleFilter.toLowerCase();
    }

    if (identityIdFilter && identityIdFilter !== 'all') {
        filter.actorIdentityId = new RegExp(identityIdFilter.trim(), 'i');
    }

    if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) {
            filter.createdAt.$gte = new Date(startDate);
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filter.createdAt.$lte = end;
        }
    }

    const [logs, total] = await Promise.all([
        AuditLog.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        AuditLog.countDocuments(filter)
    ]);

    return res.status(200).json(new ApiResponse(200, {
        logs,
        total,
        page,
        totalPages: Math.ceil(total / limit)
    }, 'Audit logs retrieved successfully.'));
});

// GET /api/admin/audit-logs/filters
export const getAuditLogFilters = asyncHandler(async (req, res) => {
    const [modules, actions] = await Promise.all([
        AuditLog.distinct('module'),
        AuditLog.distinct('action')
    ]);

    return res.status(200).json(new ApiResponse(200, {
        modules: modules.filter(Boolean).sort(),
        actions: actions.filter(Boolean).sort()
    }, 'Audit log filter options fetched.'));
});

// GET /api/admin/audit-logs/:id
export const getAuditLogById = asyncHandler(async (req, res) => {
    const log = await AuditLog.findById(req.params.id).lean();
    if (!log) throw new ApiError(404, 'Audit log entry not found.');
    return res.status(200).json(new ApiResponse(200, log, 'Audit log fetched.'));
});

export default {
    getAuditLogs,
    getAuditLogFilters,
    getAuditLogById
};
