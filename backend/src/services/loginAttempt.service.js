import { ApiError } from '../utils/ApiError.js';

export const ATTEMPT_CONFIG = {
    vendor: {
        maxAttempts: 5,
        lockoutMinutes: 15,
        label: 'Vendor',
        lockoutMessage: 'Too many failed login attempts. Your account has been temporarily locked for 15 minutes. Please try again later.'
    },
    admin: {
        maxAttempts: 3,
        lockoutMinutes: 15,
        label: 'Super Admin',
        lockoutMessage: 'Too many failed login attempts. Super Admin access has been temporarily locked for 15 minutes. Please try again later.'
    },
    admin_org: {
        maxAttempts: 3,
        lockoutMinutes: 15,
        label: 'Organizational terminal',
        lockoutMessage: 'Too many failed login attempts. Organizational terminal access has been temporarily locked for 15 minutes. Please try again later.'
    }
};

// In-memory tracker for attempts (also tracks attempts for invalid/non-existent emails/usernames)
const memoryAttempts = new Map();

// Periodic cleanup of stale memory records every 30 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of memoryAttempts.entries()) {
        if (now - (data.lastAttemptAt || 0) > 60 * 60 * 1000) {
            memoryAttempts.delete(key);
        }
    }
}, 30 * 60 * 1000).unref();

const formatRemainingTime = (lockUntilDate) => {
    const remainingMs = new Date(lockUntilDate).getTime() - Date.now();
    if (remainingMs <= 0) return 'a few moments';
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    if (remainingSeconds < 60) {
        return `${remainingSeconds} seconds`;
    }
    const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
    return remainingMinutes > 1 ? `${remainingMinutes} minutes` : '1 minute';
};

/**
 * Check if the given identifier or document is currently locked out.
 * Throws an ApiError(401) if locked.
 */
export const checkLoginLockout = (scope, identifier, doc = null) => {
    const now = new Date();
    const key = `${scope}:${String(identifier || '').trim().toLowerCase()}`;

    // 1. Check database document lockout if present
    if (doc && doc.lockUntil) {
        if (new Date(doc.lockUntil) > now) {
            const timeText = formatRemainingTime(doc.lockUntil);
            throw new ApiError(401, `Account is temporarily locked due to too many failed login attempts. Please try again in ${timeText}.`);
        } else {
            // Lock expired, reset
            doc.lockUntil = null;
            doc.loginAttempts = 0;
        }
    }

    // 2. Check in-memory lockout
    const memData = memoryAttempts.get(key);
    if (memData && memData.lockUntil) {
        if (new Date(memData.lockUntil) > now) {
            const timeText = formatRemainingTime(memData.lockUntil);
            throw new ApiError(401, `Account is temporarily locked due to too many failed login attempts. Please try again in ${timeText}.`);
        } else {
            // Lock expired, clear memory
            memoryAttempts.delete(key);
        }
    }
};

/**
 * Record a failed login attempt and increment counters.
 * Throws an ApiError(401) with remaining attempts or lockout message.
 */
export const handleFailedLogin = async ({ scope, identifier, doc = null, defaultMessage = 'Invalid credentials.' }) => {
    const config = ATTEMPT_CONFIG[scope] || ATTEMPT_CONFIG.vendor;
    const key = `${scope}:${String(identifier || '').trim().toLowerCase()}`;
    const now = new Date();
    const lockoutMs = config.lockoutMinutes * 60 * 1000;

    let currentAttempts = 0;
    if (doc && typeof doc.loginAttempts === 'number') {
        currentAttempts = doc.loginAttempts;
    }
    const memData = memoryAttempts.get(key);
    if (memData && typeof memData.attempts === 'number') {
        currentAttempts = Math.max(currentAttempts, memData.attempts);
    }

    currentAttempts += 1;

    if (currentAttempts >= config.maxAttempts) {
        const lockUntilDate = new Date(now.getTime() + lockoutMs);

        memoryAttempts.set(key, {
            attempts: currentAttempts,
            lockUntil: lockUntilDate,
            lastAttemptAt: now.getTime()
        });

        if (doc) {
            doc.loginAttempts = currentAttempts;
            doc.lockUntil = lockUntilDate;
            try {
                await doc.save({ validateBeforeSave: false });
            } catch (err) {
                console.error('[LoginAttempt] Error saving doc lockout:', err.message);
            }
        }

        throw new ApiError(401, config.lockoutMessage);
    } else {
        memoryAttempts.set(key, {
            attempts: currentAttempts,
            lockUntil: null,
            lastAttemptAt: now.getTime()
        });

        if (doc) {
            doc.loginAttempts = currentAttempts;
            try {
                await doc.save({ validateBeforeSave: false });
            } catch (err) {
                console.error('[LoginAttempt] Error saving doc attempts:', err.message);
            }
        }

        const remaining = config.maxAttempts - currentAttempts;
        const attemptWord = remaining === 1 ? 'attempt' : 'attempts';
        throw new ApiError(401, `${defaultMessage} ${remaining} ${attemptWord} remaining.`);
    }
};

/**
 * Reset failed attempts and clear lockout on successful login.
 */
export const handleSuccessfulLogin = async ({ scope, identifier, doc = null }) => {
    const key = `${scope}:${String(identifier || '').trim().toLowerCase()}`;
    memoryAttempts.delete(key);

    if (doc) {
        const hasAttempts = doc.loginAttempts > 0 || doc.lockUntil;
        if (hasAttempts) {
            doc.loginAttempts = 0;
            doc.lockUntil = null;
            try {
                await doc.save({ validateBeforeSave: false });
            } catch (err) {
                console.error('[LoginAttempt] Error resetting doc attempts on success:', err.message);
            }
        }
    }
};
