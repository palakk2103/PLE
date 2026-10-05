import { logActivity } from '../services/auditLog.service.js';

const EXCLUDED_PATHS = [
    '/auth/login',
    '/auth/refresh-token',
    '/auth/logout',
    '/audit-logs', // reading audit logs
];

const MODULE_MAP = [
    { pattern: /\/orders/i, module: 'ORDERS', entityType: 'Order' },
    { pattern: /\/products/i, module: 'PRODUCTS', entityType: 'Product' },
    { pattern: /\/categories/i, module: 'CATEGORIES', entityType: 'Category' },
    { pattern: /\/brands/i, module: 'BRANDS', entityType: 'Brand' },
    { pattern: /\/vendors/i, module: 'VENDORS', entityType: 'Vendor' },
    { pattern: /\/delivery/i, module: 'DELIVERY', entityType: 'Delivery' },
    { pattern: /\/customers/i, module: 'CUSTOMERS', entityType: 'Customer' },
    { pattern: /\/b2b/i, module: 'B2B', entityType: 'B2BUser' },
    { pattern: /\/returns?/i, module: 'RETURNS', entityType: 'Return' },
    { pattern: /\/support/i, module: 'SUPPORT', entityType: 'SupportTicket' },
    { pattern: /\/cms/i, module: 'CMS', entityType: 'CMS' },
    { pattern: /\/marketing/i, module: 'MARKETING', entityType: 'Marketing' },
    { pattern: /\/settings/i, module: 'SETTINGS', entityType: 'Setting' },
    { pattern: /\/account-team/i, module: 'ACCOUNT_TEAM', entityType: 'Admin' },
];

/**
 * Universal audit middleware for Admin mutations (POST, PUT, PATCH, DELETE).
 * Captures all operational actions performed by Super Admin and Account Team members.
 */
export const auditAdminMutation = (req, res, next) => {
    // Only capture mutation methods
    const method = req.method.toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        return next();
    }

    const path = req.originalUrl || req.url || '';
    if (EXCLUDED_PATHS.some(excluded => path.includes(excluded))) {
        return next();
    }

    // Intercept finish event to know status and record log
    res.on('finish', async () => {
        // If the controller already explicitly logged this action, don't duplicate
        if (req._auditLogged) return;

        // Only log authenticated admin/account_team requests
        if (!req.user) return;

        // Skip client errors (400, 401, 404, etc.) unless requested or critical
        if (res.statusCode >= 400 && res.statusCode < 500 && res.statusCode !== 403) {
            return;
        }

        try {
            let matchedModule = 'ADMIN_OPERATION';
            let matchedEntityType = 'System';
            for (const item of MODULE_MAP) {
                if (item.pattern.test(path)) {
                    matchedModule = item.module;
                    matchedEntityType = item.entityType;
                    break;
                }
            }

            let actionVerb = 'UPDATED';
            if (method === 'DELETE') actionVerb = 'DELETED';
            else if (method === 'POST') actionVerb = 'CREATED';
            else if (path.includes('/status')) actionVerb = 'STATUS_CHANGED';

            const action = `${matchedModule}_${actionVerb}`;
            const targetId = req.params?.id || req.params?.customerId || req.params?.orderId || req.body?.id || null;

            const actorName = req.user.name || req.user.email || 'Admin User';
            const actorRole = req.user.role === 'superadmin' ? 'Super Admin' : (req.user.identityId || 'Account Team');

            const status = res.statusCode < 400 ? 'SUCCESS' : 'FAILURE';
            const description = `${actorName} (${actorRole}) performed ${method} operation on ${matchedModule}${targetId ? ` (ID: ${targetId})` : ''} via ${path}`;

            await logActivity({
                actor: req.user,
                action,
                module: matchedModule,
                entityType: matchedEntityType,
                entityId: targetId,
                description,
                req,
                status,
                metadata: {
                    endpoint: path,
                    method,
                    statusCode: res.statusCode,
                    params: req.params,
                    body: req.body
                }
            });
        } catch (err) {
            console.warn('[AuditLoggerMiddleware] Error recording audit log:', err.message);
        }
    });

    next();
};
