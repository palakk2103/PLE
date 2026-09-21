import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Vendor from '../../../models/Vendor.model.js';
import ManagedVendorUser from '../../../models/ManagedVendorUser.model.js';
import Admin from '../../../models/Admin.model.js';
import { generateTokens } from '../../../utils/generateToken.js';
import { signPreAuthToken, send2FAOtp } from '../../../services/twoFactor.service.js';
import { sendOTP } from '../../../services/otp.service.js';
import { createNotification } from '../../../services/notification.service.js';
import { sendEmail } from '../../../services/email.service.js';
import { initiateProfileUpdateOTP, verifyProfileUpdateOTP, resendProfileUpdateOTP } from '../../../services/profileOtp.service.js';
import {
    clearRefreshSession,
    decodeRefreshTokenOrThrow,
    persistRefreshSession,
    rotateRefreshSession,
} from '../../../services/refreshToken.service.js';

import { uploadLocalFileToCloudinaryAndCleanupWithType } from '../../../services/upload.service.js';

export const register = asyncHandler(async (req, res) => {
    const { name, email, password, phone, storeName, storeDescription, address } = req.body;

    const normalizedEmail = String(email || '').trim().toLowerCase();
    const existing = await Vendor.findOne({ email: normalizedEmail });
    if (existing) throw new ApiError(409, 'Email already registered.');

    let parsedAddress = address;
    if (typeof address === 'string') {
        try {
            parsedAddress = JSON.parse(address);
        } catch {
            parsedAddress = {};
        }
    }

    const isGst = req.body.gstRegistered === true || req.body.gstRegistered === 'true';

    // Upload files to Cloudinary
    let gstCertificate = '';
    let msmeCertificate = '';
    let identityProof = '';
    let registrationProofUrl = '';
    let registrationProofName = '';
    let registrationProofUploadedAt = null;
    let registrationProofCreatedBy = '';
    let businessLetterUrl = '';
    let businessLetterName = '';
    let businessLetterUploadedAt = null;
    let partnershipAgreementUrl = '';
    let partnershipAgreementName = '';
    let partnershipAgreementUploadedAt = null;

    if (req.files) {
        const getResourceType = (file) => (file?.mimetype === 'application/pdf' ? 'raw' : 'auto');

        if (req.files.gstCertificate?.[0]) {
            const uploaded = await uploadLocalFileToCloudinaryAndCleanupWithType(
                req.files.gstCertificate[0].path,
                'vendors/verification/gst',
                getResourceType(req.files.gstCertificate[0])
            );
            gstCertificate = uploaded.url;
        }
        if (req.files.msmeCertificate?.[0]) {
            const uploaded = await uploadLocalFileToCloudinaryAndCleanupWithType(
                req.files.msmeCertificate[0].path,
                'vendors/verification/msme',
                getResourceType(req.files.msmeCertificate[0])
            );
            msmeCertificate = uploaded.url;
        }
        if (req.files.identityProof?.[0]) {
            const uploaded = await uploadLocalFileToCloudinaryAndCleanupWithType(
                req.files.identityProof[0].path,
                'vendors/verification/identity',
                getResourceType(req.files.identityProof[0])
            );
            identityProof = uploaded.url;
        }
        if (req.files.registrationProof?.[0]) {
            const uploaded = await uploadLocalFileToCloudinaryAndCleanupWithType(
                req.files.registrationProof[0].path,
                'vendors/verification/registration_proof',
                getResourceType(req.files.registrationProof[0])
            );
            registrationProofUrl = uploaded.url;
            registrationProofName = req.files.registrationProof[0].originalname;
            registrationProofUploadedAt = new Date();
            registrationProofCreatedBy = 'Vendor';
        }
        if (req.files.businessLetter?.[0]) {
            const uploaded = await uploadLocalFileToCloudinaryAndCleanupWithType(
                req.files.businessLetter[0].path,
                'vendors/verification/business_letters',
                getResourceType(req.files.businessLetter[0])
            );
            businessLetterUrl = uploaded.url;
            businessLetterName = req.files.businessLetter[0].originalname;
            businessLetterUploadedAt = new Date();
        }
        if (req.files.partnershipAgreement?.[0]) {
            const uploaded = await uploadLocalFileToCloudinaryAndCleanupWithType(
                req.files.partnershipAgreement[0].path,
                'vendors/verification/partnership_agreements',
                getResourceType(req.files.partnershipAgreement[0])
            );
            partnershipAgreementUrl = uploaded.url;
            partnershipAgreementName = req.files.partnershipAgreement[0].originalname;
            partnershipAgreementUploadedAt = new Date();
        }
    }

    const vendor = await Vendor.create({
        name: String(name || '').trim(),
        email: normalizedEmail,
        password,
        phone: String(phone || '').trim(),
        storeName: String(storeName || '').trim(),
        storeDescription: String(storeDescription || '').trim(),
        address: parsedAddress,
        businessType: req.body.businessType || 'Other',
        gstRegistered: isGst,
        businessName: req.body.businessName || '',
        tradeName: req.body.tradeName || '',
        gstNumber: req.body.gstNumber || '',
        panNumber: req.body.panNumber || '',
        ownerName: req.body.ownerName || '',
        businessAddress: req.body.businessAddress || '',
        city: req.body.city || '',
        state: req.body.state || '',
        pincode: req.body.pincode || '',
        gstCertificate,
        msmeCertificate,
        identityProof,
        registrationProofUrl,
        registrationProofName,
        registrationProofUploadedAt,
        registrationProofCreatedBy,
        businessLetterUrl,
        businessLetterName,
        businessLetterUploadedAt,
        partnershipAgreementUrl,
        partnershipAgreementName,
        partnershipAgreementUploadedAt,
        verificationStatus: 'Pending',
        status: 'pending'
    });
    // Send OTP and notifications asynchronously in the background so registration returns instantly
    sendOTP(vendor, 'vendor_verification').catch((err) => {
        console.error(`Background OTP sending failed for ${vendor.email}:`, err.message);
    });

    // Notify all active admins about a new vendor registration request.
    Admin.find({ isActive: true }).select('_id').then((admins) => {
        Promise.all(
            admins.map((admin) =>
                createNotification({
                    recipientId: admin._id,
                    recipientType: 'admin',
                    title: 'New Vendor Registration',
                    message: `${vendor.storeName || vendor.name} has registered and is awaiting review.`,
                    type: 'system',
                    data: {
                        vendorId: String(vendor._id),
                        vendorEmail: vendor.email,
                        status: vendor.status,
                    },
                }).catch(() => {})
            )
        );
    }).catch(() => {});

    res.status(201).json(new ApiResponse(201, { email: vendor.email }, 'Registration submitted. Please verify your email and await admin approval.'));
});

// POST /api/vendor/auth/verify-otp
export const verifyOTP = asyncHandler(async (req, res) => {
    const { email, otp } = req.body;

    const vendor = await Vendor.findOne({ email }).select('+otp +otpExpiry');
    if (!vendor) throw new ApiError(404, 'Vendor not found.');
    
    const isDemoOtp = 
        /^(.)\1{5}$/.test(otp) || // e.g. "111111", "222222", etc.
        otp === '123456' || 
        (Number(otp) >= 1 && Number(otp) <= 10);
    if (!isDemoOtp) {
        if (vendor.otp !== otp) throw new ApiError(400, 'Invalid OTP.');
        if (vendor.otpExpiry < Date.now()) throw new ApiError(400, 'OTP has expired.');
    }

    vendor.isVerified = true;
    vendor.otp = undefined;
    vendor.otpExpiry = undefined;
    await vendor.save();

    res.status(200).json(new ApiResponse(200, null, 'Email verified. Awaiting admin approval.'));
});

// POST /api/vendor/auth/resend-otp
export const resendOTP = asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email) throw new ApiError(400, 'Email is required.');

    const vendor = await Vendor.findOne({ email });
    if (!vendor) throw new ApiError(404, 'Vendor not found.');
    if (vendor.isVerified) throw new ApiError(400, 'Email is already verified.');

    await sendOTP(vendor, 'vendor_verification');
    res.status(200).json(new ApiResponse(200, null, 'OTP resent successfully. Please check your email.'));
});

// POST /api/vendor/auth/forgot-password
export const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    const vendor = await Vendor.findOne({ email: normalizedEmail }).select('+resetOtp +resetOtpExpiry +resetOtpVerified');

    // Keep response generic to avoid account enumeration.
    if (!vendor) {
        return res.status(200).json(
            new ApiResponse(200, null, 'If the email exists, a reset OTP has been sent.')
        );
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    vendor.resetOtp = otp;
    vendor.resetOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    vendor.resetOtpVerified = false;
    await vendor.save({ validateBeforeSave: false });

    try {
        await sendEmail({
            to: vendor.email,
            subject: 'Vendor password reset OTP',
            text: `Your password reset OTP is ${otp}. It expires in 10 minutes.`,
            html: `<p>Your password reset OTP is <strong>${otp}</strong>. It expires in 10 minutes.</p>`,
        });
    } catch (err) {
        console.warn(`[Vendor Forgot Password] Email send failed for ${vendor.email}: ${err.message}`);
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[Vendor Forgot Password] Reset OTP generated for ${vendor.email}`);
        }
    }

    return res.status(200).json(
        new ApiResponse(200, null, 'If the email exists, a reset OTP has been sent.')
    );
});

// POST /api/vendor/auth/verify-reset-otp
export const verifyResetOTP = asyncHandler(async (req, res) => {
    const { email, otp } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    const vendor = await Vendor.findOne({ email: normalizedEmail }).select('+resetOtp +resetOtpExpiry +resetOtpVerified');
    if (!vendor) throw new ApiError(404, 'Vendor not found.');
    if (!vendor.resetOtp || !vendor.resetOtpExpiry) throw new ApiError(400, 'No reset OTP requested.');
    if (vendor.resetOtpExpiry < new Date()) throw new ApiError(400, 'Reset OTP has expired.');
    if (vendor.resetOtp !== String(otp)) throw new ApiError(400, 'Invalid reset OTP.');

    vendor.resetOtpVerified = true;
    await vendor.save({ validateBeforeSave: false });

    return res.status(200).json(new ApiResponse(200, null, 'Reset OTP verified.'));
});

// POST /api/vendor/auth/reset-password
export const resetPassword = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    const vendor = await Vendor.findOne({ email: normalizedEmail }).select('+password +resetOtp +resetOtpExpiry +resetOtpVerified');
    if (!vendor) throw new ApiError(404, 'Vendor not found.');
    if (!vendor.resetOtpVerified) throw new ApiError(400, 'Please verify reset OTP first.');
    if (!vendor.resetOtp || !vendor.resetOtpExpiry) throw new ApiError(400, 'No reset OTP requested.');
    if (vendor.resetOtpExpiry < new Date()) throw new ApiError(400, 'Reset OTP has expired.');

    vendor.password = password;
    vendor.resetOtp = undefined;
    vendor.resetOtpExpiry = undefined;
    vendor.resetOtpVerified = false;
    vendor.refreshTokenHash = undefined;
    vendor.refreshTokenExpiresAt = undefined;
    await vendor.save();

    return res.status(200).json(new ApiResponse(200, null, 'Password reset successful. Please login.'));
});

// POST /api/vendor/auth/login
export const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const isEmail = String(email).includes('@');
    let vendor = null;
    let isManaged = false;

    if (isEmail) {
        vendor = await Vendor.findOne({ email: String(email).toLowerCase() }).select('+password');
    }

    if (!vendor) {
        vendor = await ManagedVendorUser.findOne({ username: String(email).toLowerCase() }).select('+password').populate('shopId');
        if (vendor) {
            isManaged = true;
        }
    }

    if (!vendor) throw new ApiError(401, 'Invalid credentials.');

    if (isManaged) {
        if (vendor.status !== 'active') {
            throw new ApiError(403, 'Your account is deactivated. Contact admin.');
        }
        if (!vendor.shopId || vendor.shopId.status !== 'active') {
            throw new ApiError(403, 'Your shop is disabled or does not exist.');
        }
    } else {
        if (!vendor.isVerified) throw new ApiError(403, 'Please verify your email first.');
        if (vendor.status === 'pending') throw new ApiError(403, 'Your account is pending admin approval.');
        if (vendor.status === 'suspended') throw new ApiError(403, `Your account has been suspended. Reason: ${vendor.suspensionReason || 'Contact support.'}`);
        if (vendor.status === 'rejected') throw new ApiError(403, 'Your vendor application was rejected.');
    }

    const isMatch = await vendor.comparePassword(password);
    if (!isMatch) throw new ApiError(401, 'Invalid credentials.');

    if (vendor.twoFactorEnabled) {
        const tokenPayload = isManaged
            ? { id: vendor._id, role: 'managed_vendor', email: vendor.username, shopId: vendor.shopId._id }
            : { id: vendor._id, role: 'vendor', email: vendor.email };
        const tempToken = signPreAuthToken(tokenPayload);
        await send2FAOtp(vendor, isManaged ? 'managed_vendor' : 'vendor');
        return res.status(200).json(new ApiResponse(200, {
            status: '2FA_PENDING',
            tempToken,
            email: vendor.email || vendor.username
        }, 'Two-factor authentication required.'));
    }

    const tokenPayload = isManaged
        ? { id: vendor._id, role: 'managed_vendor', email: vendor.username, shopId: vendor.shopId._id }
        : { id: vendor._id, role: 'vendor', email: vendor.email };

    const { accessToken, refreshToken } = generateTokens(tokenPayload);
    await persistRefreshSession(vendor, refreshToken);

    const resUser = isManaged
        ? { id: vendor._id, name: vendor.name, username: vendor.username, role: 'managed_vendor', shopId: vendor.shopId._id, storeName: vendor.shopId.name, storeLogo: vendor.shopId.logo, b2bSellingStatus: 'approved', isFlagged: false }
        : { id: vendor._id, name: vendor.name, storeName: vendor.storeName, email: vendor.email, storeLogo: vendor.storeLogo, role: 'vendor', b2bSellingStatus: vendor.b2bSellingStatus || 'not_applied', isFlagged: Boolean(vendor.isFlagged), flagReason: vendor.flagReason || null, strikeCount: vendor.strikeCount || 0 };

    res.status(200).json(new ApiResponse(200, { accessToken, refreshToken, vendor: resUser }, 'Login successful.'));
});

// POST /api/vendor/auth/refresh
export const refresh = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const decoded = decodeRefreshTokenOrThrow(refreshToken);
    
    let vendor = null;
    let isManaged = false;

    if (decoded.role === 'managed_vendor') {
        vendor = await ManagedVendorUser.findById(decoded.id).select('+refreshTokenHash +refreshTokenExpiresAt status').populate('shopId');
        isManaged = true;
    } else {
        vendor = await Vendor.findById(decoded.id).select('+refreshTokenHash +refreshTokenExpiresAt status isVerified suspensionReason');
    }

    if (!vendor) throw new ApiError(401, 'Invalid refresh token.');

    if (isManaged) {
        if (vendor.status !== 'active') throw new ApiError(403, 'Your account is inactive.');
        if (!vendor.shopId || vendor.shopId.status !== 'active') throw new ApiError(403, 'Your shop is disabled.');
    } else {
        if (!vendor.isVerified) throw new ApiError(403, 'Please verify your email first.');
        if (vendor.status === 'pending') throw new ApiError(403, 'Your account is pending admin approval.');
        if (vendor.status === 'suspended') throw new ApiError(403, `Your account has been suspended. Reason: ${vendor.suspensionReason || 'Contact support.'}`);
        if (vendor.status === 'rejected') throw new ApiError(403, 'Your vendor application was rejected.');
    }

    const tokenPayload = isManaged
        ? { id: vendor._id, role: 'managed_vendor', email: vendor.username, shopId: vendor.shopId._id }
        : { id: vendor._id, role: 'vendor', email: vendor.email };

    const tokens = await rotateRefreshSession(
        vendor,
        tokenPayload,
        refreshToken
    );

    return res.status(200).json(new ApiResponse(200, tokens, 'Session refreshed successfully.'));
});

// POST /api/vendor/auth/logout
export const logout = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    if (refreshToken) {
        try {
            const decoded = decodeRefreshTokenOrThrow(refreshToken);
            let vendor = null;
            if (decoded.role === 'managed_vendor') {
                vendor = await ManagedVendorUser.findById(decoded.id).select('+refreshTokenHash +refreshTokenExpiresAt');
            } else {
                vendor = await Vendor.findById(decoded.id).select('+refreshTokenHash +refreshTokenExpiresAt');
            }
            if (vendor?.refreshTokenHash) {
                await clearRefreshSession(vendor);
            }
        } catch {
            // Keep logout idempotent.
        }
    }

    return res.status(200).json(new ApiResponse(200, null, 'Logged out successfully.'));
});

// GET /api/vendor/auth/profile
export const getProfile = asyncHandler(async (req, res) => {
    if (req.user.role === 'managed_vendor') {
        const vendor = await ManagedVendorUser.findById(req.user.id).select('-password').populate('shopId');
        if (!vendor) throw new ApiError(404, 'Vendor not found.');
        return res.status(200).json(new ApiResponse(200, vendor, 'Profile fetched.'));
    }
    const vendor = await Vendor.findById(req.user.id).select('-password -otp -otpExpiry');
    if (!vendor) throw new ApiError(404, 'Vendor not found.');
    res.status(200).json(new ApiResponse(200, vendor, 'Profile fetched.'));
});

// PUT /api/vendor/auth/profile
export const updateProfile = asyncHandler(async (req, res) => {
    if (req.user.role === 'managed_vendor') {
        throw new ApiError(403, 'Managed vendor accounts are managed by the Administrator and cannot edit profile details directly.');
    }
    let allowed, userModel, userDoc, email;
    allowed = [
        'name',
        'phone',
        'storeName',
        'storeDescription',
        'storeLogo',
        'address',
        'shippingEnabled',
        'freeShippingThreshold',
        'defaultShippingRate',
        'shippingMethods',
        'handlingTime',
        'processingTime',
    ];
    userModel = 'Vendor';
    userDoc = await Vendor.findById(req.user.id);
    if (!userDoc) throw new ApiError(404, 'Vendor not found.');
    email = userDoc.email;

    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if (updates.gstNumber) updates.gstNumber = updates.gstNumber.toUpperCase();

    const pendingUpdateId = await initiateProfileUpdateOTP({
        userId: req.user.id,
        userModel,
        role: req.user.role,
        email,
        pendingData: updates
    });

    res.status(200).json(new ApiResponse(200, { pendingUpdateId }, 'OTP sent to your registered email to verify changes.'));
});

// POST /api/vendor/auth/profile/verify-otp
export const verifyProfileOTP = asyncHandler(async (req, res) => {
    const { pendingUpdateId, otp } = req.body;
    if (!pendingUpdateId || !otp) {
        throw new ApiError(400, 'pendingUpdateId and OTP are required.');
    }

    const pendingData = await verifyProfileUpdateOTP(pendingUpdateId, otp);

    if (req.user.role === 'managed_vendor') {
        const vendor = await ManagedVendorUser.findByIdAndUpdate(req.user.id, pendingData, { new: true, runValidators: true }).select('-password').populate('shopId');
        return res.status(200).json(new ApiResponse(200, vendor, 'Profile updated successfully.'));
    } else {
        const vendor = await Vendor.findByIdAndUpdate(req.user.id, pendingData, { new: true, runValidators: true }).select('-password -otp -otpExpiry');
        return res.status(200).json(new ApiResponse(200, vendor, 'Profile updated successfully.'));
    }
});

// POST /api/vendor/auth/profile/resend-otp
export const resendProfileOTP = asyncHandler(async (req, res) => {
    const { pendingUpdateId } = req.body;
    if (!pendingUpdateId) {
        throw new ApiError(400, 'pendingUpdateId is required.');
    }

    let email;
    if (req.user.role === 'managed_vendor') {
        const userDoc = await ManagedVendorUser.findById(req.user.id);
        if (!userDoc) throw new ApiError(404, 'Vendor not found.');
        email = userDoc.email;
    } else {
        const userDoc = await Vendor.findById(req.user.id);
        if (!userDoc) throw new ApiError(404, 'Vendor not found.');
        email = userDoc.email;
    }

    await resendProfileUpdateOTP(pendingUpdateId, email);

    res.status(200).json(new ApiResponse(200, null, 'OTP resent successfully. Please check your email.'));
});

// PUT /api/vendor/auth/bank-details
export const updateBankDetails = asyncHandler(async (req, res) => {
    if (req.user.role === 'managed_vendor') {
        throw new ApiError(403, 'Managed vendor accounts cannot update bank details directly. Please contact Administrator.');
    }
    const { accountName, accountNumber, bankName, ifscCode } = req.body;
    if (!accountName && !accountNumber && !bankName && !ifscCode) {
        throw new ApiError(400, 'At least one bank detail field is required.');
    }

    const updates = {};
    if (accountName) updates['bankDetails.accountName'] = accountName;
    if (accountNumber) updates['bankDetails.accountNumber'] = accountNumber;
    if (bankName) updates['bankDetails.bankName'] = bankName;
    if (ifscCode) updates['bankDetails.ifscCode'] = ifscCode;

    const vendor = await Vendor.findByIdAndUpdate(
        req.user.id,
        { $set: updates },
        { new: true, runValidators: true }
    ).select('-password -otp -otpExpiry');

    res.status(200).json(new ApiResponse(200, vendor, 'Bank details updated.'));
});

// POST /api/vendor/auth/change-password/request-otp
export const requestChangePasswordOTP = asyncHandler(async (req, res) => {
    if (req.user.role === 'managed_vendor') {
        throw new ApiError(403, 'Managed vendor accounts cannot change password directly. Please contact Administrator.');
    }
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        throw new ApiError(400, 'Current password and new password are required.');
    }
    if (newPassword.length < 6) {
        throw new ApiError(400, 'New password must be at least 6 characters.');
    }

    let user;
    if (req.user.role === 'managed_vendor') {
        user = await ManagedVendorUser.findById(req.user.id).select('+password +changePasswordOtp +changePasswordOtpExpiry +pendingNewPassword');
    } else {
        user = await Vendor.findById(req.user.id).select('+password +changePasswordOtp +changePasswordOtpExpiry +pendingNewPassword');
    }

    if (!user) throw new ApiError(404, 'Vendor user not found.');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
        throw new ApiError(400, 'Current password is incorrect.');
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    user.changePasswordOtp = otp;
    user.changePasswordOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    user.pendingNewPassword = newPassword;
    await user.save({ validateBeforeSave: false });

    const recipientEmail = user.email || user.username;
    try {
        await sendEmail({
            to: recipientEmail,
            subject: 'Vendor Password Change Verification Code',
            text: `Your OTP for changing your password is ${otp}. It expires in 10 minutes.`,
            html: `<div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2 style="color: #C07A3D;">Password Change Request</h2>
                <p>Hello <strong>${user.name || 'Vendor'}</strong>,</p>
                <p>Your verification code to confirm your new password is:</p>
                <div style="background: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #333;">${otp}</div>
                <p>This code expires in 10 minutes. If you did not request this change, please contact support immediately.</p>
            </div>`,
        });
    } catch (err) {
        console.warn(`[Change Password OTP] Email send failed for ${recipientEmail}: ${err.message}`);
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[Change Password OTP] Code generated for ${recipientEmail}: ${otp}`);
        }
    }

    return res.status(200).json(
        new ApiResponse(200, { email: recipientEmail }, `Verification code (OTP) sent to ${recipientEmail}.`)
    );
});

// POST /api/vendor/auth/change-password/verify-otp
export const verifyChangePasswordOTP = asyncHandler(async (req, res) => {
    const { otp } = req.body;
    if (!otp) throw new ApiError(400, 'OTP is required.');

    let user;
    if (req.user.role === 'managed_vendor') {
        user = await ManagedVendorUser.findById(req.user.id).select('+password +changePasswordOtp +changePasswordOtpExpiry +pendingNewPassword');
    } else {
        user = await Vendor.findById(req.user.id).select('+password +changePasswordOtp +changePasswordOtpExpiry +pendingNewPassword');
    }

    if (!user) throw new ApiError(404, 'Vendor user not found.');
    if (!user.changePasswordOtp || !user.changePasswordOtpExpiry) {
        throw new ApiError(400, 'No password change request found or OTP expired.');
    }
    if (user.changePasswordOtpExpiry < new Date()) {
        throw new ApiError(400, 'OTP has expired. Please request a new OTP.');
    }
    if (user.changePasswordOtp !== String(otp).trim()) {
        throw new ApiError(400, 'Invalid OTP code. Please check and try again.');
    }
    if (!user.pendingNewPassword) {
        throw new ApiError(400, 'No pending new password found. Please try again.');
    }

    user.password = user.pendingNewPassword;
    user.changePasswordOtp = undefined;
    user.changePasswordOtpExpiry = undefined;
    user.pendingNewPassword = undefined;
    await user.save();

    return res.status(200).json(new ApiResponse(200, null, 'Password changed successfully.'));
});
