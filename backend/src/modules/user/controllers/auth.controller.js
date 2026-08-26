import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import User from '../../../models/User.model.js';
import { generateTokens } from '../../../utils/generateToken.js';
import { signPreAuthToken, send2FAOtp } from '../../../services/twoFactor.service.js';
import { sendOTP } from '../../../services/otp.service.js';
import { sendEmail } from '../../../services/email.service.js';
import { getOtpEmailTemplate } from '../../../utils/emailTemplates.js';
import { initiateProfileUpdateOTP, verifyProfileUpdateOTP, resendProfileUpdateOTP } from '../../../services/profileOtp.service.js';
import {
    uploadLocalFileToCloudinaryAndCleanup,
    deleteFromCloudinary,
    cleanupLocalFiles,
} from '../../../services/upload.service.js';
import {
    clearRefreshSession,
    decodeRefreshTokenOrThrow,
    persistRefreshSession,
    rotateRefreshSession,
} from '../../../services/refreshToken.service.js';

const extractCloudinaryPublicId = (url = '') => {
    const raw = String(url || '').trim();
    if (!raw || !raw.includes('/upload/')) return null;
    try {
        const afterUpload = raw.split('/upload/')[1] || '';
        const withoutTransform = afterUpload.includes('/') ? afterUpload.substring(afterUpload.indexOf('/') + 1) : afterUpload;
        const cleaned = withoutTransform.replace(/^v\d+\//, '');
        const withoutExtension = cleaned.replace(/\.[^/.]+$/, '');
        return withoutExtension || null;
    } catch {
        return null;
    }
};

// POST /api/user/auth/register
export const register = asyncHandler(async (req, res) => {
    const { name, email, password, phone } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedPhone = String(phone || '').replace(/\D/g, '').slice(-10);

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) throw new ApiError(409, 'Email already registered.');

    const user = await User.create({
        name: String(name || '').trim(),
        email: normalizedEmail,
        password,
        ...(normalizedPhone ? { phone: normalizedPhone } : {}),
    });
    await sendOTP(user, 'email_verification');

    res.status(201).json(new ApiResponse(201, { email: user.email }, 'Registration successful. Please verify your email.'));
});

// POST /api/user/auth/verify-otp
export const verifyOTP = asyncHandler(async (req, res) => {
    const { email, otp } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail, role: 'customer' }).select('+otp +otpExpiry');
    if (!user) throw new ApiError(404, 'User not found.');
    
    // Developer bypass in development mode
    const isDevBypass = process.env.NODE_ENV !== 'production' && otp === '123456';
    
    if (user.otp !== otp && !isDevBypass) throw new ApiError(400, 'Invalid OTP.');
    if (!isDevBypass && user.otpExpiry < Date.now()) throw new ApiError(400, 'OTP has expired. Please request a new one.');

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    const { accessToken, refreshToken } = generateTokens({ id: user._id, role: 'customer', email: user.email });
    await persistRefreshSession(user, refreshToken);
    res.status(200).json(new ApiResponse(200, {
        accessToken,
        refreshToken,
        user: {
            id: user._id,
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            avatar: user.avatar,
            role: user.role,
            companyName: user.companyName,
            businessType: user.businessType,
            gstNumber: user.gstNumber,
            gstCertificate: user.gstCertificate,
            businessAddress: user.businessAddress,
            city: user.city,
            state: user.state,
            pincode: user.pincode,
            yearsInBusiness: user.yearsInBusiness,
            monthlyPurchaseVolume: user.monthlyPurchaseVolume,
            verificationStatus: user.verificationStatus
        }
    }, 'Email verified successfully.'));
});

// POST /api/user/auth/login
export const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail, role: 'customer' }).select('+password');
    if (!user) {
        const isB2BUser = await User.findOne({ email: normalizedEmail, role: { $in: ['b2bAdmin', 'b2bEmployee'] } });
        if (isB2BUser) {
            throw new ApiError(403, 'This account is registered for B2B. Please use the B2B portal to login.');
        }
        throw new ApiError(401, 'Invalid email or password.');
    }
    if (!user.isActive) throw new ApiError(403, 'Your account has been deactivated.');
    if (!user.isVerified) {
        await sendOTP(user, 'email_verification');
        throw new ApiError(403, 'Email not verified. A new OTP has been sent to your email.');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) throw new ApiError(401, 'Invalid email or password.');

    if (user.twoFactorEnabled) {
        const tempToken = signPreAuthToken({ id: user._id, role: user.role || 'customer', email: user.email });
        await send2FAOtp(user, user.role || 'customer');
        return res.status(200).json(new ApiResponse(200, {
            status: '2FA_PENDING',
            tempToken,
            email: user.email
        }, 'Two-factor authentication required.'));
    }

    const { accessToken, refreshToken } = generateTokens({ id: user._id, role: user.role || 'customer', email: user.email });
    await persistRefreshSession(user, refreshToken);
    res.status(200).json(new ApiResponse(200, {
        accessToken,
        refreshToken,
        user: {
            id: user._id,
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            avatar: user.avatar,
            role: user.role,
            companyName: user.companyName,
            businessType: user.businessType,
            gstNumber: user.gstNumber,
            gstCertificate: user.gstCertificate,
            businessAddress: user.businessAddress,
            city: user.city,
            state: user.state,
            pincode: user.pincode,
            yearsInBusiness: user.yearsInBusiness,
            monthlyPurchaseVolume: user.monthlyPurchaseVolume,
            verificationStatus: user.verificationStatus
        }
    }, 'Login successful.'));
});

// POST /api/user/auth/refresh
export const refresh = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const decoded = decodeRefreshTokenOrThrow(refreshToken);
    const user = await User.findById(decoded.id).select('+refreshTokenHash +refreshTokenExpiresAt isActive isVerified');

    if (!user) throw new ApiError(401, 'Invalid refresh token.');
    if (!user.isActive) throw new ApiError(403, 'Your account has been deactivated.');
    if (!user.isVerified) throw new ApiError(403, 'Please verify your email first.');

    const tokens = await rotateRefreshSession(
        user,
        { id: user._id, role: 'customer', email: user.email },
        refreshToken
    );

    return res.status(200).json(
        new ApiResponse(200, tokens, 'Session refreshed successfully.')
    );
});

// POST /api/user/auth/logout
export const logout = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    if (refreshToken) {
        try {
            const decoded = decodeRefreshTokenOrThrow(refreshToken);
            const user = await User.findById(decoded.id).select('+refreshTokenHash +refreshTokenExpiresAt');
            if (user?.refreshTokenHash) {
                await clearRefreshSession(user);
            }
        } catch {
            // Keep logout idempotent.
        }
    }
    return res.status(200).json(new ApiResponse(200, null, 'Logged out successfully.'));
});

// POST /api/user/auth/resend-otp
export const resendOTP = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail, role: 'customer' });
    if (!user) throw new ApiError(404, 'User not found.');
    if (user.isVerified) throw new ApiError(400, 'Email already verified.');

    await sendOTP(user, 'email_verification');
    res.status(200).json(new ApiResponse(200, null, 'OTP resent successfully.'));
});

// POST /api/user/auth/forgot-password
export const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail, role: 'customer' }).select('+resetOtp +resetOtpExpiry +resetOtpVerified');

    // Generic response to avoid account enumeration.
    if (!user) {
        return res.status(200).json(new ApiResponse(200, null, 'If the email exists, a reset OTP has been sent.'));
    }
    if (!user.isVerified) {
        await sendOTP(user, 'email_verification');
        throw new ApiError(403, 'Please verify your email first. A new verification OTP has been sent.');
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    user.resetOtp = otp;
    user.resetOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    user.resetOtpVerified = false;
    await user.save({ validateBeforeSave: false });

    try {
        const html = getOtpEmailTemplate({
            otp,
            title: 'Peoples League of Electronics',
            subtitle: 'Password Reset',
            purpose: 'password reset request',
            recipientName: user.name || '',
            expiryMinutes: 10
        });

        await sendEmail({
            to: user.email,
            subject: `Password Reset OTP - ${otp}`,
            text: `Your password reset OTP is ${otp}. It expires in 10 minutes.`,
            html,
        });
    } catch (err) {
        console.warn(`[User Forgot Password] Email send failed for ${user.email}: ${err.message}`);
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[User Forgot Password] Reset OTP generated for ${user.email}`);
        }
    }

    return res.status(200).json(new ApiResponse(200, null, 'If the email exists, a reset OTP has been sent.'));
});

// POST /api/user/auth/verify-reset-otp
export const verifyResetOTP = asyncHandler(async (req, res) => {
    const { email, otp } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail, role: 'customer' }).select('+resetOtp +resetOtpExpiry +resetOtpVerified');
    if (!user) throw new ApiError(404, 'User not found.');
    if (!user.resetOtp || !user.resetOtpExpiry) throw new ApiError(400, 'No reset OTP requested.');
    if (user.resetOtpExpiry < new Date()) throw new ApiError(400, 'Reset OTP has expired.');
    if (user.resetOtp !== String(otp)) throw new ApiError(400, 'Invalid reset OTP.');

    user.resetOtpVerified = true;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json(new ApiResponse(200, null, 'Reset OTP verified.'));
});

// POST /api/user/auth/reset-password
export const resetPassword = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail, role: 'customer' }).select('+password +resetOtp +resetOtpExpiry +resetOtpVerified');
    if (!user) throw new ApiError(404, 'User not found.');
    if (!user.resetOtpVerified) throw new ApiError(400, 'Please verify reset OTP first.');
    if (!user.resetOtp || !user.resetOtpExpiry) throw new ApiError(400, 'No reset OTP requested.');
    if (user.resetOtpExpiry < new Date()) throw new ApiError(400, 'Reset OTP has expired.');

    user.password = password;
    user.resetOtp = undefined;
    user.resetOtpExpiry = undefined;
    user.resetOtpVerified = false;
    user.refreshTokenHash = undefined;
    user.refreshTokenExpiresAt = undefined;
    await user.save();

    return res.status(200).json(new ApiResponse(200, null, 'Password reset successful. Please login.'));
});

// GET /api/user/auth/profile
export const getProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) throw new ApiError(404, 'User not found.');
    res.status(200).json(new ApiResponse(200, user, 'Profile fetched.'));
});

// PUT /api/user/auth/profile
export const updateProfile = asyncHandler(async (req, res) => {
    const { name, phone, gender, dob } = req.body;
    const normalizedName = String(name || '').trim();
    const normalizedPhone = String(phone || '').replace(/\D/g, '').slice(-10);

    const updatePayload = {
        name: normalizedName,
        phone: normalizedPhone || undefined,
        gender: gender || "",
        dob: dob || "",
    };

    const user = await User.findById(req.user.id);
    if (!user) throw new ApiError(404, 'User not found.');

    const pendingUpdateId = await initiateProfileUpdateOTP({
        userId: user._id,
        userModel: 'User',
        role: user.role,
        email: user.email,
        pendingData: updatePayload
    });

    res.status(200).json(new ApiResponse(200, { pendingUpdateId }, 'OTP sent to your registered email to verify changes.'));
});

// POST /api/user/auth/profile/verify-otp
export const verifyProfileOTP = asyncHandler(async (req, res) => {
    const { pendingUpdateId, otp } = req.body;
    if (!pendingUpdateId || !otp) {
        throw new ApiError(400, 'pendingUpdateId and OTP are required.');
    }

    const pendingData = await verifyProfileUpdateOTP(pendingUpdateId, otp);

    const user = await User.findByIdAndUpdate(
        req.user.id,
        pendingData,
        { new: true, runValidators: true }
    );
    if (!user) throw new ApiError(404, 'User not found.');

    res.status(200).json(new ApiResponse(200, user, 'Profile updated successfully.'));
});

// POST /api/user/auth/profile/resend-otp
export const resendProfileOTP = asyncHandler(async (req, res) => {
    const { pendingUpdateId } = req.body;
    if (!pendingUpdateId) {
        throw new ApiError(400, 'pendingUpdateId is required.');
    }

    const user = await User.findById(req.user.id);
    if (!user) throw new ApiError(404, 'User not found.');

    await resendProfileUpdateOTP(pendingUpdateId, user.email);

    res.status(200).json(new ApiResponse(200, null, 'OTP resent successfully. Please check your email.'));
});

// POST /api/user/auth/change-password
export const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        throw new ApiError(400, 'Current password and new password are required.');
    }

    const user = await User.findById(req.user.id).select('+password');
    if (!user) throw new ApiError(404, 'User not found.');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) throw new ApiError(400, 'Current password is incorrect.');
    if (String(currentPassword) === String(newPassword)) {
        throw new ApiError(400, 'New password must be different from current password.');
    }
    if (String(newPassword).length < 6) {
        throw new ApiError(400, 'New password must be at least 6 characters.');
    }

    user.password = newPassword;
    user.refreshTokenHash = undefined;
    user.refreshTokenExpiresAt = undefined;
    await user.save();

    res.status(200).json(new ApiResponse(200, null, 'Password changed successfully.'));
});

// POST /api/user/auth/profile/avatar
export const uploadProfileAvatar = asyncHandler(async (req, res) => {
    if (!req.file?.path) {
        throw new ApiError(400, 'Avatar image file is required.');
    }

    let uploaded = null;
    try {
        uploaded = await uploadLocalFileToCloudinaryAndCleanup(
            req.file.path,
            'users/avatars'
        );

        const existingUser = await User.findById(req.user.id).select('avatar');
        if (!existingUser) throw new ApiError(404, 'User not found.');
        const previousAvatar = String(existingUser.avatar || '').trim();

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { avatar: uploaded.url },
            { new: true, runValidators: true }
        );
        if (!user) throw new ApiError(404, 'User not found.');

        const previousPublicId = extractCloudinaryPublicId(previousAvatar);
        if (previousPublicId && previousPublicId !== uploaded.publicId) {
            await deleteFromCloudinary(previousPublicId).catch(() => null);
        }

        return res.status(200).json(
            new ApiResponse(
                200,
                { user, avatar: uploaded.url, publicId: uploaded.publicId },
                'Profile picture updated successfully.'
            )
        );
    } catch (error) {
        if (!uploaded) {
            await cleanupLocalFiles([req.file?.path]);
        }
        if (uploaded?.publicId) {
            await deleteFromCloudinary(uploaded.publicId).catch(() => null);
        }
        throw error;
    }
});

// POST /api/user/auth/register-b2b
export const registerB2B = asyncHandler(async (req, res) => {
    const {
        name,
        email,
        password,
        phone,
        companyName,
        businessType,
        gstNumber,
        businessAddress,
        city,
        state,
        pincode,
        yearsInBusiness,
        monthlyPurchaseVolume
    } = req.body;

    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedPhone = String(phone || '').replace(/\D/g, '').slice(-10);

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
        if (req.file?.path) {
            await cleanupLocalFiles([req.file.path]).catch(() => null);
        }
        throw new ApiError(409, 'Email already registered.');
    }

    if (!req.file?.path) {
        throw new ApiError(400, 'GST Certificate file is required.');
    }

    let uploaded = null;
    try {
        uploaded = await uploadLocalFileToCloudinaryAndCleanup(
            req.file.path,
            'users/gst_certificates'
        );

        const user = await User.create({
            name: String(name || '').trim(),
            email: normalizedEmail,
            password,
            ...(normalizedPhone ? { phone: normalizedPhone } : {}),
            companyName: String(companyName || '').trim(),
            businessType: String(businessType || '').trim(),
            gstNumber: String(gstNumber || '').trim(),
            gstCertificate: uploaded.url,
            businessAddress: String(businessAddress || '').trim(),
            city: String(city || '').trim(),
            state: String(state || '').trim(),
            pincode: String(pincode || '').trim(),
            yearsInBusiness: Number(yearsInBusiness) || undefined,
            monthlyPurchaseVolume: String(monthlyPurchaseVolume || '').trim(),
            verificationStatus: 'Pending Verification'
        });

        await sendOTP(user, 'email_verification');

        res.status(201).json(new ApiResponse(201, { email: user.email }, 'B2B Registration successful. Please verify your email.'));
    } catch (error) {
        if (uploaded?.publicId) {
            await deleteFromCloudinary(uploaded.publicId).catch(() => null);
        } else if (req.file?.path) {
            await cleanupLocalFiles([req.file.path]).catch(() => null);
        }
        throw error;
    }
});
