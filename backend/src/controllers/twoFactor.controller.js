import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';
import { getModelByRole, send2FAOtp, verify2FAOtp } from '../services/twoFactor.service.js';
import { generateTokens } from '../utils/generateToken.js';
import { persistRefreshSession } from '../services/refreshToken.service.js';
import { sendSecurityAlert } from '../services/adminNotification.service.js';
import jwt from 'jsonwebtoken';

/**
 * GET status of 2FA
 */
export const get2FAStatus = asyncHandler(async (req, res) => {
    const Model = getModelByRole(req.user.role);
    if (!Model) throw new ApiError(400, 'Invalid user role.');

    const user = await Model.findById(req.user.id);
    if (!user) throw new ApiError(404, 'User not found.');

    return res.status(200).json(
        new ApiResponse(200, { twoFactorEnabled: !!user.twoFactorEnabled }, '2FA status fetched.')
    );
});

/**
 * POST initiate enabling of 2FA
 */
export const initiateEnable2FA = asyncHandler(async (req, res) => {
    const { password } = req.body;
    if (!password) throw new ApiError(400, 'Password is required to enable 2FA.');

    const Model = getModelByRole(req.user.role);
    if (!Model) throw new ApiError(400, 'Invalid user role.');

    const user = await Model.findById(req.user.id).select('+password');
    if (!user) throw new ApiError(404, 'User not found.');

    const isMatch = await user.comparePassword(password);
    if (!isMatch) throw new ApiError(401, 'Invalid password.');

    if (user.twoFactorEnabled) {
        throw new ApiError(400, '2FA is already enabled on this account.');
    }

    // Send 2FA setup OTP
    await send2FAOtp(user, req.user.role);

    return res.status(200).json(
        new ApiResponse(200, { email: user.email || user.username }, 'Verification code sent to registered email.')
    );
});

/**
 * POST verify and complete enabling 2FA
 */
export const verifyEnable2FA = asyncHandler(async (req, res) => {
    const { otp } = req.body;
    if (!otp) throw new ApiError(400, 'Verification code is required.');

    const Model = getModelByRole(req.user.role);
    if (!Model) throw new ApiError(400, 'Invalid user role.');

    const user = await Model.findById(req.user.id).select('+twoFactorOtp +twoFactorOtpExpiry +twoFactorAttempts');
    if (!user) throw new ApiError(404, 'User not found.');

    await verify2FAOtp(user, otp);

    user.twoFactorEnabled = true;
    await user.save({ validateBeforeSave: false });

    // Checklist Item 176: 2FA enabled
    sendSecurityAlert({
        user,
        eventType: '2fa_enabled',
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers['user-agent'] || 'Unknown'
    }).catch(err => console.error('[SecurityAlert] 2FA enabled email error:', err.message));

    return res.status(200).json(
        new ApiResponse(200, { twoFactorEnabled: true }, 'Two-factor authentication has been successfully enabled.')
    );
});

/**
 * POST disable 2FA
 */
export const disable2FA = asyncHandler(async (req, res) => {
    const { password, otp } = req.body;
    if (!password || !otp) {
        throw new ApiError(400, 'Password and verification code are required to disable 2FA.');
    }

    const Model = getModelByRole(req.user.role);
    if (!Model) throw new ApiError(400, 'Invalid user role.');

    const user = await Model.findById(req.user.id).select('+password +twoFactorOtp +twoFactorOtpExpiry +twoFactorAttempts');
    if (!user) throw new ApiError(404, 'User not found.');

    const isMatch = await user.comparePassword(password);
    if (!isMatch) throw new ApiError(401, 'Invalid password.');

    await verify2FAOtp(user, otp);

    user.twoFactorEnabled = false;
    await user.save({ validateBeforeSave: false });

    // Checklist Item 177: 2FA disabled
    sendSecurityAlert({
        user,
        eventType: '2fa_disabled',
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers['user-agent'] || 'Unknown'
    }).catch(err => console.error('[SecurityAlert] 2FA disabled email error:', err.message));

    return res.status(200).json(
        new ApiResponse(200, { twoFactorEnabled: false }, 'Two-factor authentication has been disabled.')
    );
});

/**
 * POST verify login 2FA OTP
 */
export const verifyLogin2FA = asyncHandler(async (req, res) => {
    const { tempToken, otp } = req.body;
    if (!tempToken || !otp) {
        throw new ApiError(400, 'Temporary token and verification code are required.');
    }

    let decoded;
    try {
        decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch (err) {
        throw new ApiError(401, 'Session has expired. Please log in again.');
    }

    if (decoded.type !== '2fa_pending') {
        throw new ApiError(400, 'Invalid authentication state.');
    }

    const Model = getModelByRole(decoded.role);
    if (!Model) throw new ApiError(400, 'Invalid user role.');

    const user = await Model.findById(decoded.id).select('+twoFactorOtp +twoFactorOtpExpiry +twoFactorAttempts');
    if (!user) throw new ApiError(404, 'User not found.');

    await verify2FAOtp(user, otp);

    // Continue with normal token issuance
    const payload = decoded.role === 'managed_vendor'
        ? { id: user._id, role: 'managed_vendor', email: user.username, shopId: user.shopId }
        : decoded.role === 'superadmin' || decoded.role === 'admin'
            ? { id: user._id, role: user.role, email: user.email }
            : decoded.role === 'b2bAdmin' || decoded.role === 'b2bEmployee'
                ? { id: user._id, role: user.role, email: user.email, companyId: user.companyId }
                : { id: user._id, role: user.role || 'customer', email: user.email };

    const { accessToken, refreshToken } = generateTokens(payload);
    await persistRefreshSession(user, refreshToken);

    const userRes = decoded.role === 'managed_vendor'
        ? { id: user._id, name: user.name, username: user.username, role: 'managed_vendor', shopId: user.shopId, b2bSellingStatus: 'approved' }
        : decoded.role === 'vendor'
            ? { id: user._id, name: user.name, storeName: user.storeName, email: user.email, storeLogo: user.storeLogo, role: 'vendor', b2bSellingStatus: user.b2bSellingStatus || 'not_applied' }
            : decoded.role === 'delivery'
                ? { id: user._id, name: user.name, email: user.email, phone: user.phone, role: 'delivery' }
                : decoded.role === 'b2bAdmin' || decoded.role === 'b2bEmployee'
                    ? { id: user._id, name: user.name, email: user.email, role: user.role }
                    : { id: user._id, name: user.name, email: user.email, role: user.role || 'customer' };

    return res.status(200).json(
        new ApiResponse(200, { accessToken, refreshToken, user: userRes, vendor: userRes, b2bAdmin: userRes, deliveryBoy: userRes, admin: userRes }, 'Login verified successfully.')
    );
});

/**
 * POST resend login 2FA OTP
 */
export const resendLogin2FAOtp = asyncHandler(async (req, res) => {
    const { tempToken } = req.body;
    if (!tempToken) throw new ApiError(400, 'Temporary token is required.');

    let decoded;
    try {
        decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch {
        throw new ApiError(401, 'Session has expired. Please log in again.');
    }

    if (decoded.type !== '2fa_pending') {
        throw new ApiError(400, 'Invalid authentication state.');
    }

    const Model = getModelByRole(decoded.role);
    if (!Model) throw new ApiError(400, 'Invalid user role.');

    const user = await Model.findById(decoded.id);
    if (!user) throw new ApiError(404, 'User not found.');

    await send2FAOtp(user, decoded.role);

    return res.status(200).json(
        new ApiResponse(200, null, 'Verification code resent successfully.')
    );
});
