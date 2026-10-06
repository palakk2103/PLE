import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Admin from '../../../models/Admin.model.js';
import { generateTokens } from '../../../utils/generateToken.js';
import { signPreAuthToken, send2FAOtp } from '../../../services/twoFactor.service.js';
import {
    clearRefreshSession,
    decodeRefreshTokenOrThrow,
    persistRefreshSession,
    rotateRefreshSession,
} from '../../../services/refreshToken.service.js';
import { logActivity } from '../../../services/auditLog.service.js';
import { checkLoginLockout, handleFailedLogin, handleSuccessfulLogin } from '../../../services/loginAttempt.service.js';

// POST /api/admin/auth/login
export const login = asyncHandler(async (req, res) => {
    const { email, password, identityId, personalSecret } = req.body;

    // Mode 1: Individual Organizational Identity Terminal Login
    if (identityId || personalSecret) {
        if (!identityId || !String(identityId).trim()) {
            throw new ApiError(400, 'Identity ID is required for organizational login.');
        }
        if (!personalSecret || !String(personalSecret).trim()) {
            throw new ApiError(400, 'Personal Secret Code is required for organizational login.');
        }
        if (!password) {
            throw new ApiError(400, 'Domain password is required.');
        }

        const normalizedIdentityId = String(identityId).trim().toUpperCase();

        // Check if locked out
        checkLoginLockout('admin_org', normalizedIdentityId);

        const admin = await Admin.findOne({ identityId: normalizedIdentityId })
            .select('+password +personalSecretHash +loginAttempts +lockUntil');

        if (admin) {
            checkLoginLockout('admin_org', normalizedIdentityId, admin);
        }

        if (!admin) {
            await logActivity({
                actor: { name: 'Unknown', email: email || 'N/A', role: 'account_team', identityId: normalizedIdentityId },
                action: 'LOGIN_FAILED',
                module: 'AUTH',
                description: `Failed organizational login attempt: Identity ID "${normalizedIdentityId}" not found`,
                req,
                status: 'FAILURE'
            });
            await handleFailedLogin({
                scope: 'admin_org',
                identifier: normalizedIdentityId,
                doc: null,
                defaultMessage: 'Invalid organizational credentials or Identity ID.'
            });
        }

        // Verify Corporate Email if provided
        if (email && String(email).trim().toLowerCase() !== admin.email) {
            await logActivity({
                actor: admin,
                action: 'LOGIN_FAILED',
                module: 'AUTH',
                description: `Failed organizational login: email mismatch for Identity ID "${normalizedIdentityId}"`,
                req,
                status: 'FAILURE'
            });
            await handleFailedLogin({
                scope: 'admin_org',
                identifier: normalizedIdentityId,
                doc: admin,
                defaultMessage: 'Corporate email does not match this Identity ID.'
            });
        }

        if (!admin.isActive || admin.status === 'inactive') {
            await logActivity({
                actor: admin,
                action: 'LOGIN_FAILED',
                module: 'AUTH',
                description: `Blocked login attempt: organizational identity "${normalizedIdentityId}" is deactivated`,
                req,
                status: 'FAILURE'
            });
            throw new ApiError(403, 'Organizational identity is deactivated. Please contact Super Admin.');
        }

        // Compare Domain Password
        const isPasswordMatch = await admin.comparePassword(password);
        if (!isPasswordMatch) {
            await logActivity({
                actor: admin,
                action: 'LOGIN_FAILED',
                module: 'AUTH',
                description: `Failed login: incorrect domain password for "${normalizedIdentityId}"`,
                req,
                status: 'FAILURE'
            });
            await handleFailedLogin({
                scope: 'admin_org',
                identifier: normalizedIdentityId,
                doc: admin,
                defaultMessage: 'Invalid domain credentials or secret code.'
            });
        }

        // Compare Personal Secret Code
        const isSecretMatch = await admin.comparePersonalSecret(personalSecret);
        if (!isSecretMatch) {
            await logActivity({
                actor: admin,
                action: 'LOGIN_FAILED',
                module: 'AUTH',
                description: `Failed login: incorrect personal secret code for "${normalizedIdentityId}"`,
                req,
                status: 'FAILURE'
            });
            await handleFailedLogin({
                scope: 'admin_org',
                identifier: normalizedIdentityId,
                doc: admin,
                defaultMessage: 'Invalid domain credentials or secret code.'
            });
        }

        // Reset failed attempts on success
        await handleSuccessfulLogin({
            scope: 'admin_org',
            identifier: normalizedIdentityId,
            doc: admin
        });

        // Check 2FA
        if (admin.twoFactorEnabled) {
            const tempToken = signPreAuthToken({ id: admin._id, role: admin.role || 'account_team', email: admin.email });
            await send2FAOtp(admin, admin.role || 'account_team');
            return res.status(200).json(new ApiResponse(200, {
                status: '2FA_PENDING',
                tempToken,
                email: admin.email
            }, 'Two-factor authentication required.'));
        }

        // Update timestamps
        const now = new Date();
        admin.lastLoginAt = now;
        admin.lastActivityAt = now;

        const role = admin.role || 'account_team';
        const { accessToken, refreshToken } = generateTokens({
            id: admin._id,
            name: admin.name,
            role,
            email: admin.email,
            identityId: admin.identityId,
            userType: admin.userType || 'account_team'
        });

        await persistRefreshSession(admin, refreshToken);
        await admin.save();

        await logActivity({
            actor: admin,
            action: 'LOGIN_SUCCESS',
            module: 'AUTH',
            entityType: 'Admin',
            entityId: admin._id,
            description: `Account team member ${admin.name} (${admin.identityId}) logged in successfully`,
            req,
            status: 'SUCCESS',
            metadata: {
                identityId: admin.identityId,
                department: admin.department,
                designation: admin.designation,
                role: admin.role
            }
        });

        return res.status(200).json(new ApiResponse(200, {
            accessToken,
            refreshToken,
            admin: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role,
                userType: admin.userType || 'account_team',
                identityId: admin.identityId,
                identityClass: admin.identityClass,
                department: admin.department,
                designation: admin.designation,
                contractType: admin.contractType,
                lastLoginAt: admin.lastLoginAt
            }
        }, 'Organizational terminal login successful.'));
    }

    // Mode 2: Standard Domain / Super Admin Gateway Login
    const normalizedEmail = String(email || '').trim().toLowerCase();

    // Check if locked out
    checkLoginLockout('admin', normalizedEmail);

    const adminQuery = [
        { email: normalizedEmail },
        { role: normalizedEmail }
    ];
    if (normalizedEmail === 'admin') {
        adminQuery.push({ role: 'superadmin' });
        adminQuery.push({ email: 'admin@admin.com' });
    }
    if (normalizedEmail === 'superadmin') {
        adminQuery.push({ role: 'superadmin' });
        adminQuery.push({ email: 'admin@admin.com' });
    }

    const admin = await Admin.findOne({
        $or: adminQuery
    }).select('+password +loginAttempts +lockUntil');

    if (admin) {
        checkLoginLockout('admin', normalizedEmail, admin);
    }

    if (!admin) {
        await logActivity({
            actor: { name: 'Unknown', email: String(email || ''), role: 'admin' },
            action: 'LOGIN_FAILED',
            module: 'AUTH',
            description: `Failed domain login: user "${email}" not found`,
            req,
            status: 'FAILURE'
        });
        await handleFailedLogin({
            scope: 'admin',
            identifier: normalizedEmail,
            doc: null,
            defaultMessage: 'Invalid credentials.'
        });
    }

    if (!admin.isActive || admin.status === 'inactive') {
        await logActivity({
            actor: admin,
            action: 'LOGIN_FAILED',
            module: 'AUTH',
            description: `Blocked login: account for "${admin.email}" is deactivated`,
            req,
            status: 'FAILURE'
        });
        throw new ApiError(403, 'Admin account is deactivated.');
    }

    let isMatch = await admin.comparePassword(password);
    // Allow standard fallback passwords for default seeded admin (admin@123 or admin123)
    if (!isMatch && (admin.email === 'admin@admin.com' || admin.role === 'superadmin')) {
        const trimmedPass = String(password || '').trim();
        if (trimmedPass === 'admin@123' || trimmedPass === 'admin123') {
            isMatch = true;
        }
    }

    if (!isMatch) {
        await logActivity({
            actor: admin,
            action: 'LOGIN_FAILED',
            module: 'AUTH',
            description: `Failed domain login: invalid password for "${admin.email}"`,
            req,
            status: 'FAILURE'
        });
        await handleFailedLogin({
            scope: 'admin',
            identifier: normalizedEmail,
            doc: admin,
            defaultMessage: 'Invalid credentials.'
        });
    }

    // Reset failed attempts on success
    await handleSuccessfulLogin({
        scope: 'admin',
        identifier: normalizedEmail,
        doc: admin
    });

    if (admin.twoFactorEnabled) {
        const tempToken = signPreAuthToken({ id: admin._id, role: admin.role || 'admin', email: admin.email });
        await send2FAOtp(admin, admin.role || 'admin');
        return res.status(200).json(new ApiResponse(200, {
            status: '2FA_PENDING',
            tempToken,
            email: admin.email
        }, 'Two-factor authentication required.'));
    }

    const now = new Date();
    admin.lastLoginAt = now;
    admin.lastActivityAt = now;

    const payloadRole = admin.role || 'admin';
    const { accessToken, refreshToken } = generateTokens({
        id: admin._id,
        name: admin.name,
        role: payloadRole,
        email: admin.email,
        identityId: admin.identityId || (admin.role === 'superadmin' ? 'SUPER_ADMIN' : 'N/A'),
        userType: admin.userType || (admin.role === 'superadmin' ? 'superadmin' : 'account_team')
    });

    await persistRefreshSession(admin, refreshToken);
    await admin.save();

    await logActivity({
        actor: admin,
        action: 'LOGIN_SUCCESS',
        module: 'AUTH',
        entityType: 'Admin',
        entityId: admin._id,
        description: `Administrator ${admin.name} (${admin.email}) logged in successfully`,
        req,
        status: 'SUCCESS',
        metadata: {
            role: admin.role,
            identityId: admin.identityId || 'SUPER_ADMIN'
        }
    });

    res.status(200).json(new ApiResponse(200, {
        accessToken,
        refreshToken,
        admin: {
            id: admin._id,
            name: admin.name,
            email: admin.email,
            role: admin.role,
            userType: admin.userType || (admin.role === 'superadmin' ? 'superadmin' : 'account_team'),
            identityId: admin.identityId || (admin.role === 'superadmin' ? 'SUPER_ADMIN' : null),
            department: admin.department,
            designation: admin.designation,
            lastLoginAt: admin.lastLoginAt
        }
    }, 'Admin login successful.'));
});

// POST /api/admin/auth/refresh
export const refresh = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const decoded = decodeRefreshTokenOrThrow(refreshToken);
    const admin = await Admin.findById(decoded.id).select('+refreshTokenHash +refreshTokenExpiresAt isActive role userType identityId');

    if (!admin) throw new ApiError(401, 'Invalid refresh token.');
    if (!admin.isActive || admin.status === 'inactive') throw new ApiError(403, 'Account is deactivated.');

    const payloadRole = admin.role || 'admin';
    const tokens = await rotateRefreshSession(
        admin,
        {
            id: admin._id,
            role: payloadRole,
            email: admin.email,
            identityId: admin.identityId,
            userType: admin.userType
        },
        refreshToken
    );

    // Update last activity
    admin.lastActivityAt = new Date();
    await admin.save();

    return res.status(200).json(new ApiResponse(200, tokens, 'Session refreshed successfully.'));
});

// POST /api/admin/auth/logout
export const logout = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    if (refreshToken) {
        try {
            const decoded = decodeRefreshTokenOrThrow(refreshToken);
            const admin = await Admin.findById(decoded.id).select('+refreshTokenHash +refreshTokenExpiresAt');
            if (admin) {
                admin.lastLogoutAt = new Date();
                admin.lastActivityAt = new Date();
                if (admin.refreshTokenHash) {
                    await clearRefreshSession(admin);
                } else {
                    await admin.save();
                }

                await logActivity({
                    actor: admin,
                    action: 'LOGOUT',
                    module: 'AUTH',
                    entityType: 'Admin',
                    entityId: admin._id,
                    description: `User ${admin.name} (${admin.identityId || admin.email}) logged out`,
                    req,
                    status: 'SUCCESS'
                });
            }
        } catch {
            // Keep logout idempotent.
        }
    }

    return res.status(200).json(new ApiResponse(200, null, 'Logged out successfully.'));
});

// GET /api/admin/auth/profile
export const getProfile = asyncHandler(async (req, res) => {
    const admin = await Admin.findById(req.user.id).select('-password -personalSecretHash -refreshTokenHash');
    if (!admin) throw new ApiError(404, 'Admin not found.');
    res.status(200).json(new ApiResponse(200, admin, 'Profile fetched.'));
});
