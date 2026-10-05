import AuditLog from '../models/AuditLog.model.js';

const SENSITIVE_KEYS = new Set([
    'password',
    'passwordhash',
    'personalsecret',
    'personalsecrethash',
    'secret',
    'token',
    'accesstoken',
    'refreshtoken',
    'refreshtokenhash',
    'otp',
    'twofactorotp',
    'authorization'
]);

/**
 * Recursively sanitize metadata to guarantee no credentials or secrets are logged
 */
export const sanitizeMetadata = (obj, depth = 0) => {
    if (!obj || typeof obj !== 'object' || depth > 4) return obj;
    if (Array.isArray(obj)) {
        return obj.slice(0, 20).map(item => sanitizeMetadata(item, depth + 1));
    }
    const clean = {};
    for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (SENSITIVE_KEYS.has(lowerKey)) {
            clean[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
            clean[key] = sanitizeMetadata(value, depth + 1);
        } else {
            clean[key] = value;
        }
    }
    return clean;
};

/**
 * Extract client IP from Express request safely
 */
export const getClientIp = (req) => {
    if (!req) return 'N/A';
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0];
    }
    return req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'N/A';
};

/**
 * Asynchronously record an activity/audit log without throwing
 * @param {Object} params
 * @param {Object} [params.actor] - User/Admin object or token payload ({ _id/id, name, email, role, identityId, userType })
 * @param {string} params.action - e.g. 'LOGIN_SUCCESS', 'IDENTITY_PROVISIONED', 'ORDER_STATUS_UPDATED'
 * @param {string} params.module - e.g. 'AUTH', 'ACCOUNT_TEAM', 'ORDERS', 'PRODUCTS', 'CATALOG'
 * @param {string} [params.entityType] - e.g. 'Admin', 'Order', 'Product'
 * @param {string} [params.entityId] - target entity identifier
 * @param {string} [params.description] - human-readable summary
 * @param {Object} [params.req] - Express request for IP and User-Agent capture
 * @param {'SUCCESS'|'FAILURE'|'WARNING'} [params.status='SUCCESS']
 * @param {Object} [params.metadata] - safe extra payload details
 */
export const logActivity = async ({
    actor,
    action,
    module,
    entityType,
    entityId,
    description,
    req,
    status = 'SUCCESS',
    metadata = {}
}) => {
    try {
        if (req) req._auditLogged = true;
        const actorUserId = actor?._id || actor?.id || null;
        const actorIdentityId = actor?.identityId || (actor?.role === 'superadmin' ? 'SUPER_ADMIN' : 'N/A');
        const actorName = actor?.name || actor?.email || 'System';
        const actorRole = actor?.role || 'admin';
        const actorUserType = actor?.userType || (actor?.role === 'superadmin' ? 'superadmin' : 'account_team');

        const ipAddress = getClientIp(req);
        const userAgent = req?.headers ? req.headers['user-agent'] || 'Unknown' : 'N/A';

        const cleanMetadata = sanitizeMetadata(metadata);

        await AuditLog.create({
            actorUserId,
            actorIdentityId,
            actorName,
            actorRole,
            actorUserType,
            action,
            module,
            entityType,
            entityId: entityId ? String(entityId) : undefined,
            description,
            ipAddress,
            userAgent,
            status,
            metadata: cleanMetadata
        });
    } catch (err) {
        // Never let audit log recording throw an uncaught exception in the business request
        console.error('[AuditLog] Failed to record log entry:', err?.message || err);
    }
};

export default {
    logActivity,
    sanitizeMetadata,
    getClientIp
};
