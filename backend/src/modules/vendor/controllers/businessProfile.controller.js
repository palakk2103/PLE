import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Vendor from '../../../models/Vendor.model.js';
import ManagedVendorUser from '../../../models/ManagedVendorUser.model.js';
import {
    uploadLocalFileToCloudinaryAndCleanupWithType,
    deleteFromCloudinary,
    cleanupLocalFiles,
} from '../../../services/upload.service.js';

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// GET /api/vendor/business-profile
export const getBusinessProfile = asyncHandler(async (req, res) => {
    if (req.user.role === 'managed_vendor') {
        const managedUser = await ManagedVendorUser.findById(req.user.id).populate('shopId').lean();
        if (!managedUser) throw new ApiError(404, 'Vendor not found.');
        const profile = {
            businessType: 'Managed Shop',
            gstRegistered: !!(managedUser.gstNumber || managedUser.shopId?.gst),
            businessName: managedUser.shopId?.name || managedUser.companyName || managedUser.name,
            tradeName: managedUser.shopId?.name || '',
            gstNumber: managedUser.gstNumber || managedUser.shopId?.gst || '',
            panNumber: '',
            ownerName: managedUser.name,
            businessAddress: managedUser.address || managedUser.shopId?.address || '',
            city: '',
            state: '',
            pincode: '',
            verificationStatus: 'Approved',
            verifiedAt: managedUser.createdAt,
        };
        return res.status(200).json(new ApiResponse(200, profile, 'Business profile fetched.'));
    }

    const vendor = await Vendor.findById(req.user.id).select(
        'businessType gstRegistered businessName tradeName gstNumber panNumber gstCertificate msmeCertificate ownerName businessAddress city state pincode identityProof verificationStatus verifiedBy verifiedAt verificationRemark registrationProofUrl registrationProofName registrationProofUploadedAt businessLetterUrl businessLetterName businessLetterUploadedAt partnershipAgreementUrl partnershipAgreementName partnershipAgreementUploadedAt documents b2bSellingGstCertificate b2bSellingDeclaration'
    );
    if (!vendor) throw new ApiError(404, 'Vendor not found.');
    res.status(200).json(new ApiResponse(200, vendor, 'Business profile fetched.'));
});

// POST /api/vendor/business-profile & PUT /api/vendor/business-profile
export const updateBusinessProfile = asyncHandler(async (req, res) => {
    if (req.user.role === 'managed_vendor') {
        throw new ApiError(403, 'Managed vendor business profile is managed by Administrator and cannot be updated directly.');
    }
    const {
        businessType,
        gstRegistered,
        businessName,
        tradeName,
        gstNumber,
        panNumber,
        ownerName,
        businessAddress,
        city,
        state,
        pincode
    } = req.body;

    const vendor = await Vendor.findById(req.user.id);
    if (!vendor) throw new ApiError(404, 'Vendor not found.');

    const isGst = gstRegistered === true || gstRegistered === 'true';

    // Validate fields based on GST registration status
    if (isGst) {
        if (!businessName) throw new ApiError(400, 'Business Legal Name is required.');
        if (!gstNumber) throw new ApiError(400, 'GST Number is required.');
        if (!panNumber) throw new ApiError(400, 'PAN Number is required.');
        
        // Validate GST format
        const trimmedGst = String(gstNumber).trim().toUpperCase();
        if (!GST_REGEX.test(trimmedGst)) {
            throw new ApiError(400, 'Invalid GST Number format.');
        }

        // Prevent duplicate GST Number
        const duplicate = await Vendor.findOne({ gstNumber: trimmedGst, _id: { $ne: req.user.id } });
        if (duplicate) throw new ApiError(409, 'GST Number is already registered by another seller.');

        vendor.businessName = String(businessName).trim();
        vendor.tradeName = tradeName ? String(tradeName).trim() : '';
        vendor.gstNumber = trimmedGst;
        vendor.panNumber = String(panNumber).trim().toUpperCase();
    } else {
        if (!businessName) throw new ApiError(400, 'Business Name is required.');
        if (!ownerName) throw new ApiError(400, 'Owner Name is required.');
        
        vendor.businessName = String(businessName).trim();
        vendor.ownerName = String(ownerName).trim();
        vendor.tradeName = undefined;
        vendor.gstNumber = undefined;
        vendor.panNumber = undefined;
        vendor.gstCertificate = undefined;
        vendor.msmeCertificate = undefined;
    }

    // Common fields
    if (businessType) {
        const allowedTypes = ['Home Business', 'Small Business', 'MSME', 'Startup', 'Proprietorship', 'Partnership', 'LLP', 'Private Limited', 'Public Limited', 'Other'];
        if (!allowedTypes.includes(businessType)) {
            throw new ApiError(400, 'Invalid Business Type.');
        }
        vendor.businessType = businessType;
    }

    vendor.gstRegistered = isGst;
    vendor.businessAddress = businessAddress ? String(businessAddress).trim() : '';
    vendor.city = city ? String(city).trim() : '';
    vendor.state = state ? String(state).trim() : '';
    vendor.pincode = pincode ? String(pincode).trim() : '';

    // If verification was rejected or unsubmitted, submission moves status back to Pending
    if (vendor.verificationStatus === 'Rejected' || !vendor.verificationStatus) {
        vendor.verificationStatus = 'Pending';
    }

    await vendor.save();

    res.status(200).json(new ApiResponse(200, vendor, 'Business profile updated successfully.'));
});

// Helper file uploader
const handleDocumentUpload = async (req, folderName, docField) => {
    if (req.user.role === 'managed_vendor') {
        throw new ApiError(403, 'Managed vendor accounts cannot upload business verification documents directly. Please contact Administrator.');
    }
    if (!req.file?.path) {
        throw new ApiError(400, 'Document file is required.');
    }

    const vendor = await Vendor.findById(req.user.id);
    if (!vendor) throw new ApiError(404, 'Vendor not found.');

    let uploaded = null;
    try {
        uploaded = await uploadLocalFileToCloudinaryAndCleanupWithType(
            req.file.path,
            `vendors/verification/${folderName}`,
            'auto'
        );

        // Cleanup old document from Cloudinary if it exists
        if (vendor[docField] && vendor[docField].includes('cloudinary')) {
            const publicIdMatch = vendor[docField].match(/\/v\d+\/([^/.]+)\.[a-z0-9]+$/i);
            if (publicIdMatch && publicIdMatch[1]) {
                await deleteFromCloudinary(publicIdMatch[1]).catch(() => null);
            }
        }

        vendor[docField] = uploaded.url;
        
        // Submission moves verification status back to Pending if it was rejected
        if (vendor.verificationStatus === 'Rejected') {
            vendor.verificationStatus = 'Pending';
        }
        
        await vendor.save();
        return vendor;
    } catch (error) {
        if (!uploaded) {
            await cleanupLocalFiles([req.file?.path]);
        }
        throw error;
    }
};

// POST /api/vendor/business-profile/upload-gst
export const uploadGSTCertificate = asyncHandler(async (req, res) => {
    const vendor = await handleDocumentUpload(req, 'gst', 'gstCertificate');
    res.status(200).json(new ApiResponse(200, { gstCertificate: vendor.gstCertificate, verificationStatus: vendor.verificationStatus }, 'GST Certificate uploaded successfully.'));
});

// POST /api/vendor/business-profile/upload-msme
export const uploadMSMECertificate = asyncHandler(async (req, res) => {
    const vendor = await handleDocumentUpload(req, 'msme', 'msmeCertificate');
    res.status(200).json(new ApiResponse(200, { msmeCertificate: vendor.msmeCertificate, verificationStatus: vendor.verificationStatus }, 'MSME Certificate uploaded successfully.'));
});

// POST /api/vendor/business-profile/upload-identity
export const uploadIdentityProof = asyncHandler(async (req, res) => {
    const vendor = await handleDocumentUpload(req, 'identity', 'identityProof');
    res.status(200).json(new ApiResponse(200, { identityProof: vendor.identityProof, verificationStatus: vendor.verificationStatus }, 'Identity Proof uploaded successfully.'));
});

// POST /api/vendor/business-profile/upload-registration
export const uploadRegistrationProof = asyncHandler(async (req, res) => {
    if (!req.file?.path) {
        throw new ApiError(400, 'Document file is required.');
    }

    const vendor = await Vendor.findById(req.user.id);
    if (!vendor) throw new ApiError(404, 'Vendor not found.');

    let uploaded = null;
    try {
        uploaded = await uploadLocalFileToCloudinaryAndCleanupWithType(
            req.file.path,
            'vendors/verification/registration',
            'auto'
        );

        if (vendor.registrationProofUrl && vendor.registrationProofUrl.includes('cloudinary')) {
            const publicIdMatch = vendor.registrationProofUrl.match(/\/v\d+\/([^/.]+)\.[a-z0-9]+$/i);
            if (publicIdMatch && publicIdMatch[1]) {
                await deleteFromCloudinary(publicIdMatch[1]).catch(() => null);
            }
        }

        vendor.registrationProofUrl = uploaded.url;
        vendor.registrationProofName = req.file.originalname;
        vendor.registrationProofUploadedAt = new Date();
        vendor.registrationProofCreatedBy = vendor.name;

        if (vendor.verificationStatus === 'Rejected') {
            vendor.verificationStatus = 'Pending';
        }

        await vendor.save();

        res.status(200).json(new ApiResponse(200, {
            registrationProofUrl: vendor.registrationProofUrl,
            registrationProofName: vendor.registrationProofName,
            verificationStatus: vendor.verificationStatus
        }, 'Registration Proof uploaded successfully.'));
    } catch (error) {
        if (!uploaded) {
            await cleanupLocalFiles([req.file?.path]);
        }
        throw error;
    }
});

// POST /api/vendor/business-profile/upload-partnership
export const uploadPartnershipAgreement = asyncHandler(async (req, res) => {
    if (!req.file?.path) {
        throw new ApiError(400, 'Document file is required.');
    }

    const vendor = await Vendor.findById(req.user.id);
    if (!vendor) throw new ApiError(404, 'Vendor not found.');

    let uploaded = null;
    try {
        uploaded = await uploadLocalFileToCloudinaryAndCleanupWithType(
            req.file.path,
            'vendors/verification/partnership_agreements',
            req.file.mimetype === 'application/pdf' ? 'raw' : 'auto'
        );

        vendor.partnershipAgreementUrl = uploaded.url;
        vendor.partnershipAgreementName = req.file.originalname;
        vendor.partnershipAgreementUploadedAt = new Date();

        if (vendor.verificationStatus === 'Rejected') {
            vendor.verificationStatus = 'Pending';
        }

        await vendor.save();

        res.status(200).json(new ApiResponse(200, {
            partnershipAgreementUrl: vendor.partnershipAgreementUrl,
            partnershipAgreementName: vendor.partnershipAgreementName,
            verificationStatus: vendor.verificationStatus
        }, 'Partnership Agreement uploaded successfully.'));
    } catch (error) {
        if (!uploaded) {
            await cleanupLocalFiles([req.file?.path]);
        }
        throw error;
    }
});

// POST /api/vendor/business-profile/upload-business-letter
export const uploadBusinessLetter = asyncHandler(async (req, res) => {
    if (!req.file?.path) {
        throw new ApiError(400, 'Document file is required.');
    }

    const vendor = await Vendor.findById(req.user.id);
    if (!vendor) throw new ApiError(404, 'Vendor not found.');

    let uploaded = null;
    try {
        uploaded = await uploadLocalFileToCloudinaryAndCleanupWithType(
            req.file.path,
            'vendors/verification/business_letters',
            req.file.mimetype === 'application/pdf' ? 'raw' : 'auto'
        );

        if (vendor.businessLetterUrl && vendor.businessLetterUrl.includes('cloudinary')) {
            const publicIdMatch = vendor.businessLetterUrl.match(/\/v\d+\/([^/.]+)\.[a-z0-9]+$/i);
            if (publicIdMatch && publicIdMatch[1]) {
                await deleteFromCloudinary(publicIdMatch[1]).catch(() => null);
            }
        }

        vendor.businessLetterUrl = uploaded.url;
        vendor.businessLetterName = req.file.originalname;
        vendor.businessLetterUploadedAt = new Date();

        if (vendor.verificationStatus === 'Rejected') {
            vendor.verificationStatus = 'Pending';
        }

        await vendor.save();

        res.status(200).json(new ApiResponse(200, {
            businessLetterUrl: vendor.businessLetterUrl,
            businessLetterName: vendor.businessLetterName,
            verificationStatus: vendor.verificationStatus
        }, 'Business Letter uploaded successfully.'));
    } catch (error) {
        if (!uploaded) {
            await cleanupLocalFiles([req.file?.path]);
        }
        throw error;
    }
});

