import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Vendor from '../../../models/Vendor.model.js';
import ManagedVendorUser from '../../../models/ManagedVendorUser.model.js';
import {
    uploadLocalFileToCloudinaryAndCleanupWithType,
    deleteFromCloudinary
} from '../../../services/upload.service.js';
import { createNotification } from '../../../services/notification.service.js';

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// GET /api/vendor/b2b-application
export const getB2BApplication = asyncHandler(async (req, res) => {
    if (req.user.role === 'managed_vendor') {
        const managedUser = await ManagedVendorUser.findById(req.user.id).populate('shopId').lean();
        if (!managedUser) throw new ApiError(404, 'Vendor not found.');
        
        return res.status(200).json(
            new ApiResponse(200, {
                isManagedVendor: true,
                b2bSellingStatus: 'approved', // Managed vendors follow shop/admin moderation
                b2bSellingGstStatus: managedUser.gstNumber ? 'gst_registered' : 'non_gst',
                b2bSellingGstNumber: managedUser.gstNumber || '',
                b2bSellingLegalName: managedUser.companyName || managedUser.name,
                b2bSellingTradeName: managedUser.shopId?.name || '',
                b2bSellingAddress: managedUser.address || '',
            }, 'B2B application status fetched.')
        );
    }

    const vendor = await Vendor.findById(req.user.id).select(
        'b2bSellingStatus b2bSellingGstStatus b2bSellingGstNumber b2bSellingGstCertificate b2bSellingLegalName b2bSellingTradeName b2bSellingPan b2bSellingAddress b2bSellingCity b2bSellingState b2bSellingPincode b2bSellingDeclaration b2bSellingAppliedAt b2bSellingApprovedAt b2bSellingRejectedAt b2bSellingRejectionReason b2bSellingApprovedBy gstRegistered gstNumber gstCertificate businessName tradeName'
    );

    if (!vendor) throw new ApiError(404, 'Vendor not found.');

    res.status(200).json(
        new ApiResponse(200, {
            b2bSellingStatus: vendor.b2bSellingStatus || 'not_applied',
            b2bSellingGstStatus: vendor.b2bSellingGstStatus || (vendor.gstRegistered ? 'gst_registered' : 'non_gst'),
            b2bSellingGstNumber: vendor.b2bSellingGstNumber || vendor.gstNumber || '',
            b2bSellingGstCertificate: vendor.b2bSellingGstCertificate || vendor.gstCertificate || '',
            b2bSellingLegalName: vendor.b2bSellingLegalName || vendor.businessName || vendor.name || '',
            b2bSellingTradeName: vendor.b2bSellingTradeName || vendor.tradeName || vendor.storeName || '',
            b2bSellingPan: vendor.b2bSellingPan || vendor.panNumber || '',
            b2bSellingAddress: vendor.b2bSellingAddress || vendor.businessAddress || '',
            b2bSellingCity: vendor.b2bSellingCity || vendor.city || '',
            b2bSellingState: vendor.b2bSellingState || vendor.state || '',
            b2bSellingPincode: vendor.b2bSellingPincode || vendor.pincode || '',
            b2bSellingDeclaration: vendor.b2bSellingDeclaration || '',
            b2bSellingAppliedAt: vendor.b2bSellingAppliedAt,
            b2bSellingApprovedAt: vendor.b2bSellingApprovedAt,
            b2bSellingRejectedAt: vendor.b2bSellingRejectedAt,
            b2bSellingRejectionReason: vendor.b2bSellingRejectionReason || '',
        }, 'B2B application details fetched.')
    );
});

// POST /api/vendor/b2b-application
export const submitB2BApplication = asyncHandler(async (req, res) => {
    if (req.user.role === 'managed_vendor') {
        throw new ApiError(403, 'Managed vendor B2B access is managed directly by Administrator.');
    }

    const {
        gstStatus, // 'gst_registered' or 'non_gst'
        gstNumber,
        gstCertificate,
        legalName,
        tradeName,
        panNumber,
        address,
        city,
        state,
        pincode,
        declaration
    } = req.body;

    const vendor = await Vendor.findById(req.user.id);
    if (!vendor) throw new ApiError(404, 'Vendor not found.');

    // Only GST-registered vendors may apply for B2B selling.
    if (gstStatus !== 'gst_registered') {
        throw new ApiError(400, 'Only GST-registered vendors can apply for B2B selling. GST registration is mandatory.');
    }
    if (!legalName || !legalName.trim()) {
        throw new ApiError(400, 'Legal Business Name is required for GST registered sellers.');
    }
    if (!gstNumber || !gstNumber.trim()) {
        throw new ApiError(400, 'GST Number is required.');
    }
    const trimmedGst = gstNumber.trim().toUpperCase();
    if (!GST_REGEX.test(trimmedGst)) {
        throw new ApiError(400, 'Invalid GST Number format. Expected 15 characters (e.g. 22AAAAA0000A1Z5).');
    }
    if (!gstCertificate) {
        throw new ApiError(400, 'Please upload your GST Certificate document.');
    }
    if (!panNumber || !panNumber.trim()) {
        throw new ApiError(400, 'PAN Number is required.');
    }

    vendor.b2bSellingGstStatus = 'gst_registered';
    vendor.b2bSellingGstNumber = trimmedGst;
    vendor.b2bSellingGstCertificate = gstCertificate;
    vendor.b2bSellingLegalName = legalName.trim();
    vendor.b2bSellingTradeName = tradeName ? tradeName.trim() : (vendor.storeName || '');
    vendor.b2bSellingPan = panNumber.trim().toUpperCase();
    vendor.b2bSellingAddress = address ? address.trim() : '';
    vendor.b2bSellingCity = city ? city.trim() : '';
    vendor.b2bSellingState = state ? state.trim() : '';
    vendor.b2bSellingPincode = pincode ? pincode.trim() : '';
    vendor.b2bSellingDeclaration = declaration || '';

    // Also sync to main vendor fields
    vendor.gstRegistered = true;
    vendor.gstNumber = trimmedGst;
    vendor.gstCertificate = gstCertificate;
    vendor.businessName = legalName.trim();
    vendor.tradeName = vendor.b2bSellingTradeName;
    vendor.panNumber = vendor.b2bSellingPan;

    vendor.b2bSellingStatus = 'pending';
    vendor.b2bSellingAppliedAt = new Date();
    vendor.b2bSellingRejectionReason = '';

    await vendor.save();

    // Create notification for vendor
    await createNotification({
        recipientId: vendor._id,
        recipientType: 'vendor',
        title: 'B2B Seller Application Submitted',
        message: 'Your B2B selling application has been received and is currently under review by the Administrator.',
        type: 'system',
        data: { b2bSellingStatus: 'pending' },
    });

    res.status(200).json(
        new ApiResponse(200, {
            b2bSellingStatus: vendor.b2bSellingStatus,
            b2bSellingGstStatus: vendor.b2bSellingGstStatus,
            b2bSellingGstNumber: vendor.b2bSellingGstNumber,
            b2bSellingLegalName: vendor.b2bSellingLegalName,
            b2bSellingAppliedAt: vendor.b2bSellingAppliedAt,
        }, 'B2B seller application submitted successfully.')
    );
});

// POST /api/vendor/b2b-application/upload-document
export const uploadB2BGstCertificate = asyncHandler(async (req, res) => {
    if (req.user.role === 'managed_vendor') {
        throw new ApiError(403, 'Managed vendor accounts cannot upload documents directly.');
    }
    if (!req.file?.path) {
        throw new ApiError(400, 'Document file is required.');
    }

    let uploaded = null;
    try {
        uploaded = await uploadLocalFileToCloudinaryAndCleanupWithType(
            req.file.path,
            'vendors/b2b-gst-certificates',
            'auto'
        );

        res.status(200).json(
            new ApiResponse(200, {
                fileUrl: uploaded.url,
                fileName: req.file.originalname,
            }, 'GST Certificate uploaded successfully.')
        );
    } catch (err) {
        throw new ApiError(500, `File upload failed: ${err.message}`);
    }
});
