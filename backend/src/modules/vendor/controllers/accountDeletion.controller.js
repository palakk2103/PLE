import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import { Vendor } from '../../../models/Vendor.model.js';
import { AccountDeletionRequest } from '../../../models/AccountDeletionRequest.model.js';
import Notification from '../../../models/Notification.model.js';
import Admin from '../../../models/Admin.model.js';

// GET /api/vendor/account-deletion-request/status
export const getVendorDeletionStatus = asyncHandler(async (req, res) => {
    const vendorId = req.vendor._id || req.vendor.id;

    const latestRequest = await AccountDeletionRequest.findOne({
        requesterId: vendorId,
        requesterModel: 'Vendor'
    }).sort({ createdAt: -1 });

    const vendor = await Vendor.findById(vendorId).select('deletionStatus status isDeleted');

    res.status(200).json(
        new ApiResponse(
            200,
            {
                deletionStatus: vendor?.deletionStatus || 'NONE',
                accountStatus: vendor?.status,
                request: latestRequest || null
            },
            'Vendor deletion status retrieved successfully'
        )
    );
});

// POST /api/vendor/account-deletion-request
export const submitVendorDeletionRequest = asyncHandler(async (req, res) => {
    const vendorId = req.vendor._id || req.vendor.id;
    const { password, reason, additionalFeedback } = req.body;

    if (!reason || !reason.trim()) {
        throw new ApiError(400, 'Please select or provide a reason for account deletion.');
    }

    if (!password || !password.trim()) {
        throw new ApiError(400, 'Please enter your account password to confirm deletion request.');
    }

    const vendor = await Vendor.findById(vendorId).select('+password');
    if (!vendor) {
        throw new ApiError(404, 'Vendor not found.');
    }

    const isMatch = await vendor.comparePassword(password);
    if (!isMatch) {
        throw new ApiError(400, 'Incorrect password. Verification failed.');
    }

    const existingPending = await AccountDeletionRequest.findOne({
        requesterId: vendorId,
        requesterModel: 'Vendor',
        status: 'PENDING'
    });

    if (existingPending) {
        throw new ApiError(400, 'You already have a pending deletion request under review by Admin.');
    }

    const newRequest = await AccountDeletionRequest.create({
        requesterId: vendor._id,
        requesterModel: 'Vendor',
        role: 'vendor',
        requesterInfo: {
            name: vendor.name,
            email: vendor.email,
            phone: vendor.phone || '',
            storeName: vendor.storeName || ''
        },
        reason: reason.trim(),
        additionalFeedback: additionalFeedback ? additionalFeedback.trim() : '',
        status: 'PENDING'
    });

    vendor.deletionStatus = 'PENDING';
    await vendor.save();

    // Notify vendor
    await Notification.create({
        recipientId: vendor._id,
        recipientType: 'vendor',
        title: 'Account Deletion Request Submitted',
        message: 'Your vendor account deletion request has been submitted to Admin. It is currently under review.',
        type: 'system',
        data: {
            requestId: String(newRequest._id),
            status: 'PENDING'
        }
    }).catch(() => {});

    // Notify admins
    const admins = await Admin.find({ isActive: true }).select('_id').lean();
    if (admins && admins.length > 0) {
        await Promise.allSettled(
            admins.map((adm) =>
                Notification.create({
                    recipientId: adm._id,
                    recipientType: 'admin',
                    title: 'New Vendor Account Deletion Request',
                    message: `Vendor "${vendor.storeName || vendor.name}" (${vendor.email}) requested account deletion.`,
                    type: 'system',
                    data: {
                        requestId: String(newRequest._id),
                        requesterRole: 'vendor',
                        requesterId: String(vendor._id)
                    }
                })
            )
        ).catch(() => {});
    }

    res.status(201).json(
        new ApiResponse(
            201,
            { request: newRequest },
            'Your account deletion request has been sent to Admin for approval.'
        )
    );
});

// POST /api/vendor/account-deletion-request/cancel
export const cancelVendorDeletionRequest = asyncHandler(async (req, res) => {
    const vendorId = req.vendor._id || req.vendor.id;

    const pendingRequest = await AccountDeletionRequest.findOne({
        requesterId: vendorId,
        requesterModel: 'Vendor',
        status: 'PENDING'
    });

    if (!pendingRequest) {
        throw new ApiError(404, 'No pending account deletion request found to cancel.');
    }

    pendingRequest.status = 'CANCELLED';
    await pendingRequest.save();

    const vendor = await Vendor.findById(vendorId);
    if (vendor) {
        vendor.deletionStatus = 'NONE';
        await vendor.save();
    }

    await Notification.create({
        recipientId: vendorId,
        recipientType: 'vendor',
        title: 'Account Deletion Request Cancelled',
        message: 'Your vendor account deletion request has been cancelled. Your store remains active.',
        type: 'system'
    }).catch(() => {});

    res.status(200).json(
        new ApiResponse(200, { request: pendingRequest }, 'Your account deletion request has been cancelled successfully.')
    );
});
