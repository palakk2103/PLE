import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Vendor from '../../../models/Vendor.model.js';
import Commission from '../../../models/Commission.model.js';
import VendorDocument from '../../../models/VendorDocument.model.js';
import { sendEmail } from '../../../services/email.service.js';
import { createNotification } from '../../../services/notification.service.js';

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toApiVendor = (vendorDoc) => {
    const vendor = typeof vendorDoc?.toObject === 'function'
        ? vendorDoc.toObject()
        : (vendorDoc || {});

    const normalizedId = vendor?._id ? String(vendor._id) : String(vendor?.id || '');
    const normalizedCommissionRate = Number(vendor.commissionRate);
    return {
        ...vendor,
        id: normalizedId,
        commissionRate: Number.isFinite(normalizedCommissionRate)
            ? normalizedCommissionRate / 100
            : 0
    };
};

// GET /api/admin/vendors
export const getAllVendors = asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 20, search, gstRegistered, businessType, verificationStatus } = req.query;
    const numericPage = Math.max(parseInt(page, 10) || 1, 1);
    const numericLimit = Math.max(parseInt(limit, 10) || 20, 1);
    const skip = (numericPage - 1) * numericLimit;
    const filter = {};

    const allowedStatuses = new Set(['pending', 'approved', 'suspended', 'rejected']);
    
    if (status === 'gst') {
        filter.gstRegistered = true;
    } else if (status === 'nongst') {
        filter.gstRegistered = false;
    } else if (status === 'msme') {
        filter.businessType = 'MSME';
    } else if (status === 'home_business') {
        filter.businessType = 'Home Business';
    } else if (status === 'small_business') {
        filter.businessType = 'Small Business';
    } else if (status === 'pending_verification') {
        filter.verificationStatus = 'Pending';
    } else if (status === 'approved_verification') {
        filter.verificationStatus = 'Approved';
    } else if (status === 'rejected_verification') {
        filter.verificationStatus = 'Rejected';
    } else if (status === 'flagged') {
        filter.isFlagged = true;
    } else if (typeof status === 'string' && status !== 'all' && allowedStatuses.has(status)) {
        filter.status = status;
    }

    if (req.query.isFlagged !== undefined) {
        filter.isFlagged = req.query.isFlagged === 'true' || req.query.isFlagged === true;
    }

    if (gstRegistered !== undefined) {
        filter.gstRegistered = gstRegistered === 'true' || gstRegistered === true;
    }
    if (businessType) {
        filter.businessType = businessType;
    }
    if (verificationStatus) {
        filter.verificationStatus = verificationStatus;
    }

    const trimmedSearch = String(search || '').trim();
    if (trimmedSearch) {
        const safeRegex = new RegExp(escapeRegex(trimmedSearch), 'i');
        filter.$or = [{ name: safeRegex }, { email: safeRegex }, { storeName: safeRegex }, { businessName: safeRegex }, { ownerName: safeRegex }];
    }

    const vendors = await Vendor.find(filter)
        .select('-password -otp -otpExpiry')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(numericLimit);
    const total = await Vendor.countDocuments(filter);
    res.status(200).json(
        new ApiResponse(200, {
            vendors: vendors.map(toApiVendor),
            total,
            page: numericPage,
            pages: Math.ceil(total / numericLimit)
        }, 'Vendors fetched.')
    );
});

// GET /api/admin/vendors/:id
export const getVendorDetail = asyncHandler(async (req, res) => {
    const vendor = await Vendor.findById(req.params.id).select('-password -otp -otpExpiry');
    if (!vendor) throw new ApiError(404, 'Vendor not found.');
    res.status(200).json(new ApiResponse(200, toApiVendor(vendor), 'Vendor detail fetched.'));
});

// PATCH /api/admin/vendors/:id/status
export const updateVendorStatus = asyncHandler(async (req, res) => {
    const { status, reason } = req.body;
    const allowed = ['approved', 'suspended', 'rejected'];
    if (!allowed.includes(status)) throw new ApiError(400, `Status must be one of: ${allowed.join(', ')}`);

    const vendor = await Vendor.findByIdAndUpdate(req.params.id, { status, suspensionReason: reason || '' }, { new: true });
    if (!vendor) throw new ApiError(404, 'Vendor not found.');

    const statusMessageMap = {
        approved: `Your vendor account for ${vendor.storeName || vendor.name} has been approved.`,
        rejected: `Your vendor account for ${vendor.storeName || vendor.name} has been rejected.${reason ? ` Reason: ${reason}` : ''}`,
        suspended: `Your vendor account for ${vendor.storeName || vendor.name} has been suspended.${reason ? ` Reason: ${reason}` : ''}`,
    };
    const vendorMessage = statusMessageMap[status] || `Your vendor account status was updated to ${status}.`;

    await createNotification({
        recipientId: vendor._id,
        recipientType: 'vendor',
        title: 'Vendor Account Status Updated',
        message: vendorMessage,
        type: 'system',
        data: {
            status,
            reason: reason || '',
        },
    });

    try {
        await sendEmail({
            to: vendor.email,
            subject: `Vendor Account ${status[0].toUpperCase()}${status.slice(1)}`,
            text: vendorMessage,
            html: `<p>${vendorMessage}</p>`,
        });
    } catch (err) {
        console.warn(`Vendor status email failed for ${vendor.email}: ${err.message}`);
    }

    res.status(200).json(new ApiResponse(200, toApiVendor(vendor), `Vendor ${status} successfully.`));
});

// PATCH /api/admin/vendors/:id/unflag
export const unflagVendor = asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) throw new ApiError(404, 'Vendor not found.');

    const unflagReason = reason?.trim() || 'Unflagged by Administrator after review.';
    const adminId = req.user?._id || req.user?.id;

    vendor.isFlagged = false;
    vendor.flagReason = null;
    vendor.flagHistory.push({
        reason: unflagReason,
        flaggedAt: vendor.flaggedAt || new Date(),
        unflaggedAt: new Date(),
        unflaggedBy: adminId,
        action: 'MANUAL_UNFLAG'
    });

    await vendor.save();

    const message = `Your vendor account has been unflagged by Administrator. Reason/Remarks: ${unflagReason}. You can now accept product requests again.`;

    await createNotification({
        recipientId: vendor._id,
        recipientType: 'vendor',
        title: '✅ Vendor Account Unflagged',
        message,
        type: 'system',
        data: {
            vendorId: String(vendor._id),
            action: 'unflag'
        }
    });

    try {
        await sendEmail({
            to: vendor.email,
            subject: 'Vendor Account Unflagged - Access Restored',
            text: message,
            html: `<p>${message}</p>`
        });
    } catch (err) {
        console.warn(`Vendor unflag email failed for ${vendor.email}: ${err.message}`);
    }

    res.status(200).json(new ApiResponse(200, toApiVendor(vendor), 'Vendor unflagged successfully.'));
});

// PATCH /api/admin/vendors/:id/flag
export const flagVendor = asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) throw new ApiError(404, 'Vendor not found.');

    const flagReason = reason?.trim() || 'Account flagged manually by Administrator for compliance / SLA review.';

    vendor.isFlagged = true;
    vendor.flagReason = flagReason;
    vendor.flaggedAt = new Date();
    vendor.strikeCount = (vendor.strikeCount || 0) + 1;
    vendor.flagHistory.push({
        reason: flagReason,
        flaggedAt: new Date(),
        action: 'MANUAL_FLAG'
    });

    await vendor.save();

    const message = `Your vendor account has been FLAGGED by Administrator. Reason: ${flagReason}. You are restricted from accepting new product requests. Please contact support.`;

    await createNotification({
        recipientId: vendor._id,
        recipientType: 'vendor',
        title: '⚠️ Vendor Account Flagged by Admin',
        message,
        type: 'system',
        data: {
            vendorId: String(vendor._id),
            action: 'flag'
        }
    });

    try {
        await sendEmail({
            to: vendor.email,
            subject: 'Vendor Account Flagged - Action Required',
            text: message,
            html: `<p>${message}</p>`
        });
    } catch (err) {
        console.warn(`Vendor flag email failed for ${vendor.email}: ${err.message}`);
    }

    res.status(200).json(new ApiResponse(200, toApiVendor(vendor), 'Vendor flagged successfully.'));
});

// PATCH /api/admin/vendors/:id/commission
export const updateCommissionRate = asyncHandler(async (req, res) => {
    const { commissionRate } = req.body;
    const parsedRate = Number(commissionRate);
    if (Number.isNaN(parsedRate) || parsedRate < 0) {
        throw new ApiError(400, 'Commission rate must be a valid non-negative number.');
    }
    const dbCommissionRate = parsedRate <= 1 ? parsedRate * 100 : parsedRate;
    if (dbCommissionRate > 100) throw new ApiError(400, 'Commission rate must be between 0 and 100.');

    const vendor = await Vendor.findByIdAndUpdate(req.params.id, { commissionRate: dbCommissionRate }, { new: true });
    if (!vendor) throw new ApiError(404, 'Vendor not found.');
    res.status(200).json(new ApiResponse(200, toApiVendor(vendor), 'Commission rate updated.'));
});

// GET /api/admin/vendors/:id/commissions
export const getVendorCommissions = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { page = 1, limit = 20, status = 'all' } = req.query;

    const vendor = await Vendor.findById(id).select('_id');
    if (!vendor) throw new ApiError(404, 'Vendor not found.');

    const numericPage = Math.max(parseInt(page, 10) || 1, 1);
    const numericLimit = Math.max(parseInt(limit, 10) || 20, 1);
    const skip = (numericPage - 1) * numericLimit;

    const filter = { vendorId: vendor._id };
    if (status && status !== 'all') {
        filter.status = status;
    }

    const [commissions, total] = await Promise.all([
        Commission.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(numericLimit)
            .lean(),
        Commission.countDocuments(filter),
    ]);

    res.status(200).json(
        new ApiResponse(
            200,
            {
                commissions,
                total,
                page: numericPage,
                pages: Math.ceil(total / numericLimit),
            },
            'Vendor commissions fetched.'
        )
    );
});

// GET /api/admin/vendors/:id/documents
export const getVendorDocuments = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const vendor = await Vendor.findById(id).select('_id');
    if (!vendor) throw new ApiError(404, 'Vendor not found.');

    const documents = await VendorDocument.find({ vendorId: vendor._id }).sort({ createdAt: -1 });
    res.status(200).json(new ApiResponse(200, documents, 'Vendor documents fetched.'));
});

// PATCH /api/admin/vendors/documents/:docId/status
export const updateDocumentStatus = asyncHandler(async (req, res) => {
    const { docId } = req.params;
    const { status } = req.body;

    const allowed = ['approved', 'rejected', 'pending'];
    if (!allowed.includes(status)) {
        throw new ApiError(400, `Status must be one of: ${allowed.join(', ')}`);
    }

    const document = await VendorDocument.findByIdAndUpdate(
        docId,
        { status },
        { new: true }
    ).populate('vendorId', 'name email storeName');

    if (!document) throw new ApiError(404, 'Document not found.');

    // Notify vendor
    const vendor = document.vendorId;
    if (vendor && status !== 'pending') {
        const message = `Your document "${document.name}" has been ${status}.`;
        
        await createNotification({
            recipientId: vendor._id,
            recipientType: 'vendor',
            title: 'Document Status Updated',
            message,
            type: 'system',
            data: { docId: document._id, status },
        });

        try {
            await sendEmail({
                to: vendor.email,
                subject: `Document ${status.charAt(0).toUpperCase() + status.slice(1)}`,
                text: message,
                html: `<p>${message}</p>`,
            });
        } catch (err) {
            console.warn(`Vendor document status email failed for ${vendor.email}: ${err.message}`);
        }
    }

    res.status(200).json(new ApiResponse(200, document, `Document status updated to ${status}.`));
});

// PATCH /api/admin/vendors/:id/verify-business
export const verifyVendorBusiness = asyncHandler(async (req, res) => {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) throw new ApiError(404, 'Vendor not found.');

    vendor.verificationStatus = 'Approved';
    vendor.status = 'approved';
    vendor.verifiedBy = req.user.id;
    vendor.verifiedAt = new Date();
    vendor.verificationRemark = '';
    await vendor.save();

    const message = `Your business verification for ${vendor.storeName || vendor.name} has been approved.`;
    await createNotification({
        recipientId: vendor._id,
        recipientType: 'vendor',
        title: 'Business Verification Approved',
        message,
        type: 'system',
        data: { verificationStatus: 'Approved', status: 'approved' },
    });

    try {
        await sendEmail({
            to: vendor.email,
            subject: 'Business Verification Approved',
            text: message,
            html: `<p>${message}</p>`,
        });
    } catch (err) {
        console.warn(`Vendor verification email failed: ${err.message}`);
    }

    res.status(200).json(new ApiResponse(200, toApiVendor(vendor), 'Business verification approved.'));
});

// PATCH /api/admin/vendors/:id/reject-business
export const rejectVendorBusiness = asyncHandler(async (req, res) => {
    const { remark } = req.body;
    if (!remark) throw new ApiError(400, 'Rejection remark is required.');

    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) throw new ApiError(404, 'Vendor not found.');

    vendor.verificationStatus = 'Rejected';
    vendor.status = 'rejected';
    vendor.verifiedBy = req.user.id;
    vendor.verifiedAt = new Date();
    vendor.verificationRemark = remark;
    await vendor.save();

    const message = `Your business verification for ${vendor.storeName || vendor.name} has been rejected. Reason: ${remark}`;
    await createNotification({
        recipientId: vendor._id,
        recipientType: 'vendor',
        title: 'Business Verification Rejected',
        message,
        type: 'system',
        data: { verificationStatus: 'Rejected', status: 'rejected', remark },
    });

    try {
        await sendEmail({
            to: vendor.email,
            subject: 'Business Verification Rejected',
            text: message,
            html: `<p>${message}</p>`,
        });
    } catch (err) {
        console.warn(`Vendor verification rejection email failed: ${err.message}`);
    }

    res.status(200).json(new ApiResponse(200, toApiVendor(vendor), 'Business verification rejected.'));
});

// GET /api/admin/vendors/b2b-applications
export const getB2BApplications = asyncHandler(async (req, res) => {
    const { status = 'all', gstStatus = 'all', page = 1, limit = 20, search } = req.query;
    const numericPage = Math.max(parseInt(page, 10) || 1, 1);
    const numericLimit = Math.max(parseInt(limit, 10) || 20, 1);
    const skip = (numericPage - 1) * numericLimit;

    const filter = {};

    if (status !== 'all') {
        filter.b2bSellingStatus = status;
    } else {
        // By default, include all vendors who have applied or interacted with B2B selling
        filter.b2bSellingStatus = { $in: ['pending', 'approved', 'rejected'] };
    }

    if (gstStatus !== 'all') {
        filter.b2bSellingGstStatus = gstStatus;
    }

    const trimmedSearch = String(search || '').trim();
    if (trimmedSearch) {
        const safeRegex = new RegExp(escapeRegex(trimmedSearch), 'i');
        filter.$or = [
            { name: safeRegex },
            { email: safeRegex },
            { storeName: safeRegex },
            { b2bSellingLegalName: safeRegex },
            { b2bSellingTradeName: safeRegex },
            { b2bSellingGstNumber: safeRegex },
            { b2bSellingPan: safeRegex }
        ];
    }

    const applications = await Vendor.find(filter)
        .select('-password -otp -otpExpiry')
        .populate('b2bSellingApprovedBy', 'name email')
        .sort({ b2bSellingAppliedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(numericLimit);

    const total = await Vendor.countDocuments(filter);

    // Also get quick counts for tab badges
    const pendingCount = await Vendor.countDocuments({ b2bSellingStatus: 'pending' });
    const approvedCount = await Vendor.countDocuments({ b2bSellingStatus: 'approved' });
    const rejectedCount = await Vendor.countDocuments({ b2bSellingStatus: 'rejected' });
    const nonGstCount = await Vendor.countDocuments({ b2bSellingGstStatus: 'non_gst', b2bSellingStatus: { $in: ['pending', 'approved', 'rejected'] } });

    res.status(200).json(
        new ApiResponse(200, {
            applications: applications.map(toApiVendor),
            total,
            page: numericPage,
            pages: Math.ceil(total / numericLimit),
            counts: {
                pending: pendingCount,
                approved: approvedCount,
                rejected: rejectedCount,
                nonGst: nonGstCount,
            }
        }, 'B2B applications fetched successfully.')
    );
});

// GET /api/admin/vendors/b2b-applications/:id
export const getB2BApplicationDetail = asyncHandler(async (req, res) => {
    const vendor = await Vendor.findById(req.params.id)
        .select('-password -otp -otpExpiry')
        .populate('b2bSellingApprovedBy', 'name email');

    if (!vendor) throw new ApiError(404, 'Vendor application not found.');
    res.status(200).json(new ApiResponse(200, toApiVendor(vendor), 'B2B application detail fetched.'));
});

// PATCH /api/admin/vendors/b2b-applications/:id/approve
export const approveB2BApplication = asyncHandler(async (req, res) => {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) throw new ApiError(404, 'Vendor not found.');

    // Enforce GST check: Non-GST vendors cannot sell in B2B
    if (vendor.b2bSellingGstStatus === 'non_gst' || !vendor.b2bSellingGstNumber) {
        throw new ApiError(
            400,
            'Non-GST vendors cannot be approved for B2B wholesale selling. GST registration & valid certificate are mandatory for B2B selling.'
        );
    }

    vendor.b2bSellingStatus = 'approved';
    vendor.b2bSellingApprovedAt = new Date();
    vendor.b2bSellingApprovedBy = req.user.id;
    vendor.b2bSellingRejectionReason = '';

    // Synchronize to vendor profile
    vendor.gstRegistered = true;
    if (vendor.b2bSellingGstNumber) vendor.gstNumber = vendor.b2bSellingGstNumber;
    if (vendor.b2bSellingGstCertificate) vendor.gstCertificate = vendor.b2bSellingGstCertificate;
    if (vendor.b2bSellingLegalName) vendor.businessName = vendor.b2bSellingLegalName;

    await vendor.save();

    const message = `Congratulations! Your B2B selling application for "${vendor.storeName || vendor.name}" has been approved by the Administrator. You can now list and sell products on the B2B marketplace.`;
    
    await createNotification({
        recipientId: vendor._id,
        recipientType: 'vendor',
        title: 'B2B Selling Permission Approved',
        message,
        type: 'system',
        data: { b2bSellingStatus: 'approved' },
    });

    try {
        await sendEmail({
            to: vendor.email,
            subject: 'B2B Selling Application Approved - PLE Wholesale Marketplace',
            text: message,
            html: `<div style="font-family: sans-serif; line-height: 1.6; color: #333;">
                <h2 style="color: #16a34a;">B2B Selling Approved!</h2>
                <p>Hello <strong>${vendor.name}</strong>,</p>
                <p>${message}</p>
                <p>You can now choose B2B or BOTH sales channels when listing products in your seller dashboard.</p>
                <p style="margin-top: 20px; font-size: 12px; color: #777;">Thank you for partnering with PLE Marketplace.</p>
            </div>`,
        });
    } catch (err) {
        console.warn(`Vendor B2B approval email failed: ${err.message}`);
    }

    res.status(200).json(new ApiResponse(200, toApiVendor(vendor), 'B2B selling application approved successfully.'));
});

// PATCH /api/admin/vendors/b2b-applications/:id/reject
export const rejectB2BApplication = asyncHandler(async (req, res) => {
    const { remark } = req.body;
    if (!remark || !remark.trim()) {
        throw new ApiError(400, 'Rejection remark is required.');
    }

    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) throw new ApiError(404, 'Vendor not found.');

    vendor.b2bSellingStatus = 'rejected';
    vendor.b2bSellingRejectedAt = new Date();
    vendor.b2bSellingRejectionReason = remark.trim();

    await vendor.save();

    const message = `Your B2B selling application for "${vendor.storeName || vendor.name}" was not approved. Reason: ${remark}`;
    
    await createNotification({
        recipientId: vendor._id,
        recipientType: 'vendor',
        title: 'B2B Selling Application Rejected',
        message,
        type: 'system',
        data: { b2bSellingStatus: 'rejected', remark },
    });

    try {
        await sendEmail({
            to: vendor.email,
            subject: 'B2B Selling Application Status Update - PLE Marketplace',
            text: message,
            html: `<div style="font-family: sans-serif; line-height: 1.6; color: #333;">
                <h2 style="color: #dc2626;">B2B Selling Application Update</h2>
                <p>Hello <strong>${vendor.name}</strong>,</p>
                <p>Your B2B selling application for <strong>${vendor.storeName || vendor.name}</strong> has been rejected.</p>
                <p><strong>Reason:</strong> ${remark}</p>
                <p>You can update your business details or GST certificate and resubmit your application from your seller dashboard.</p>
            </div>`,
        });
    } catch (err) {
        console.warn(`Vendor B2B rejection email failed: ${err.message}`);
    }

    res.status(200).json(new ApiResponse(200, toApiVendor(vendor), 'B2B selling application rejected.'));
});

