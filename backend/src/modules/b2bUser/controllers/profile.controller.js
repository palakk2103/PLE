import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import B2BCompany from '../../../models/B2BCompany.model.js';
import User from '../../../models/User.model.js';
import {
    uploadLocalFileToCloudinaryAndCleanupWithType,
    cleanupLocalFiles,
} from '../../../services/upload.service.js';
import { initiateProfileUpdateOTP, verifyProfileUpdateOTP, resendProfileUpdateOTP } from '../../../services/profileOtp.service.js';

/**
 * @desc    Get company profile
 * @route   GET /api/b2b-user/admin/company
 * @access  Private (B2B Admin)
 */
export const getCompanyProfile = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(404, 'User not found.');
    }

    const company = await B2BCompany.findById(user.companyId);

    if (!company) {
        throw new ApiError(404, 'Company not found.');
    }

    const companyAdmin = await User.findOne({ companyId: user.companyId, role: 'b2bAdmin' });
    const companyObj = company.toObject();
    if (companyAdmin) {
        companyObj.admin = {
            name: companyAdmin.name,
            email: companyAdmin.email,
            phone: companyAdmin.phone
        };
    }

    res.status(200).json(new ApiResponse(200, companyObj, 'Company profile fetched successfully.'));
});

/**
 * @desc    Update company profile
 * @route   PUT /api/b2b-user/admin/company
 * @access  Private (B2B Admin)
 */
export const updateCompanyProfile = asyncHandler(async (req, res) => {
    const adminId = req.user.id;
    
    const admin = await User.findById(adminId);
    if (!admin) {
        throw new ApiError(404, 'User not found.');
    }

    const companyId = admin.companyId;
    const updates = req.body;

    // Prevent updating critical fields
    delete updates.verificationStatus;
    delete updates.businessEmail;
    delete updates.gstNumber;

    const company = await B2BCompany.findByIdAndUpdate(
        companyId,
        { $set: updates },
        { new: true, runValidators: true }
    );

    if (!company) {
        throw new ApiError(404, 'Company not found.');
    }

    res.status(200).json(new ApiResponse(200, company, 'Company profile updated successfully.'));
});

/**
 * @desc    Get admin profile
 * @route   GET /api/b2b-user/admin/profile
 * @access  Private (B2B Admin)
 */
export const getAdminProfile = asyncHandler(async (req, res) => {
    const adminId = req.user.id || req.user._id;

    const admin = await User.findById(adminId);

    if (!admin) {
        throw new ApiError(404, 'User not found.');
    }

    const adminResponse = admin.toObject();
    adminResponse.adminName = admin.name;
    adminResponse.adminEmail = admin.email;
    adminResponse.adminPhone = admin.phone;

    res.status(200).json(new ApiResponse(200, adminResponse, 'Profile fetched successfully.'));
});

/**
 * @desc    Update admin profile
 * @route   PUT /api/b2b-user/admin/profile
 * @access  Private (B2B Admin)
 */
export const updateAdminProfile = asyncHandler(async (req, res) => {
    const adminId = req.user.id || req.user._id;
    const { adminName, adminEmail, adminPhone, name, phone, newPassword, secretKey } = req.body;

    if (!secretKey) {
        throw new ApiError(400, 'Company Owner Secret Key is required to update credentials.');
    }

    const admin = await User.findById(adminId).select('+password');
    if (!admin) {
        throw new ApiError(404, 'User not found.');
    }

    const company = await B2BCompany.findById(admin.companyId).select('+ownerSecretKey');
    if (!company) {
        throw new ApiError(404, 'B2B Company not found.');
    }

    const isSecretKeyCorrect = await company.compareSecretKey(secretKey);
    if (!isSecretKeyCorrect) {
        throw new ApiError(403, 'Invalid Company Owner Secret Key.');
    }

    const updates = {};
    if (adminName || name) updates.name = adminName || name;
    if (adminPhone || phone) updates.phone = adminPhone || phone;

    const emailToUpdate = adminEmail || req.body.email;
    if (emailToUpdate && emailToUpdate.toLowerCase() !== admin.email.toLowerCase()) {
        const existingUser = await User.findOne({ email: emailToUpdate.toLowerCase() });
        if (existingUser) {
            throw new ApiError(400, 'A user with this email already exists.');
        }
        updates.email = emailToUpdate.toLowerCase();
    }

    if (newPassword) {
        updates.password = newPassword;
    }

    const pendingUpdateId = await initiateProfileUpdateOTP({
        userId: admin._id,
        userModel: 'User',
        role: admin.role || 'b2bAdmin',
        email: admin.email,
        pendingData: updates
    });

    res.status(200).json(new ApiResponse(200, { pendingUpdateId }, 'OTP sent to your registered email to verify changes.'));
});

/**
 * @desc    Verify admin profile OTP
 * @route   POST /api/b2b-user/admin/profile/verify-otp
 * @access  Private (B2B Admin)
 */
export const verifyAdminProfileOTP = asyncHandler(async (req, res) => {
    const { pendingUpdateId, otp } = req.body;
    if (!pendingUpdateId || !otp) {
        throw new ApiError(400, 'pendingUpdateId and OTP are required.');
    }

    const pendingData = await verifyProfileUpdateOTP(pendingUpdateId, otp);

    const adminId = req.user.id || req.user._id;
    const admin = await User.findById(adminId).select('+password');
    if (!admin) {
        throw new ApiError(404, 'User not found.');
    }

    // Apply the updates (including potential password hashing on save)
    if (pendingData.name) admin.name = pendingData.name;
    if (pendingData.phone) admin.phone = pendingData.phone;
    if (pendingData.email) admin.email = pendingData.email;
    if (pendingData.password) admin.password = pendingData.password;

    await admin.save();

    const adminResponse = admin.toObject();
    delete adminResponse.password;
    adminResponse.adminName = admin.name;
    adminResponse.adminEmail = admin.email;
    adminResponse.adminPhone = admin.phone;

    res.status(200).json(new ApiResponse(200, adminResponse, 'Profile updated successfully.'));
});

/**
 * @desc    Resend admin profile OTP
 * @route   POST /api/b2b-user/admin/profile/resend-otp
 * @access  Private (B2B Admin)
 */
export const resendAdminProfileOTP = asyncHandler(async (req, res) => {
    const { pendingUpdateId } = req.body;
    if (!pendingUpdateId) {
        throw new ApiError(400, 'pendingUpdateId is required.');
    }

    const adminId = req.user.id || req.user._id;
    const admin = await User.findById(adminId);
    if (!admin) {
        throw new ApiError(404, 'User not found.');
    }

    await resendProfileUpdateOTP(pendingUpdateId, admin.email);

    res.status(200).json(new ApiResponse(200, null, 'OTP resent successfully. Please check your email.'));
});

/**
 * @desc    Upload/replace B2B legal document (acceptanceExecutionDocument, gstCertificate, companyRegistrationProof)
 * @route   PUT /api/b2b-user/admin/company/legal-document
 * @access  Private (B2B Admin)
 */
export const uploadLegalDocument = asyncHandler(async (req, res) => {
    const adminId = req.user.id;
    const admin = await User.findById(adminId);
    if (!admin) {
        throw new ApiError(404, 'User not found.');
    }

    if (!req.file?.path) {
        throw new ApiError(400, 'Document file is required.');
    }

    const company = await B2BCompany.findById(admin.companyId);
    if (!company) {
        await cleanupLocalFiles([req.file.path]);
        throw new ApiError(404, 'Company not found.');
    }

    const validDocTypes = ['acceptanceExecutionDocument', 'gstCertificate', 'companyRegistrationProof'];
    const docType = req.body?.docType || req.query?.docType || 'acceptanceExecutionDocument';
    const targetDocField = validDocTypes.includes(docType) ? docType : 'acceptanceExecutionDocument';

    let uploaded = null;
    try {
        uploaded = await uploadLocalFileToCloudinaryAndCleanupWithType(
            req.file.path,
            `b2b/documents/${targetDocField}`,
            'auto'
        );

        company[targetDocField] = {
            url: uploaded.url,
            fileName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
            uploadedAt: new Date()
        };

        await company.save();

        res.status(200).json(new ApiResponse(200, company, 'Legal document uploaded successfully.'));
    } catch (error) {
        if (!uploaded) {
            await cleanupLocalFiles([req.file?.path]);
        }
        throw error;
    }
});

