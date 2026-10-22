import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import { User } from '../../../models/User.model.js';
import { AccountDeletionRequest } from '../../../models/AccountDeletionRequest.model.js';
import Notification from '../../../models/Notification.model.js';
import Admin from '../../../models/Admin.model.js';

// GET /api/user/account-deletion-request/status
export const getCustomerDeletionStatus = asyncHandler(async (req, res) => {
    const userId = req.user._id || req.user.id;

    // Find the most recent deletion request for this user
    const latestRequest = await AccountDeletionRequest.findOne({
        requesterId: userId,
        requesterModel: 'User'
    }).sort({ createdAt: -1 });

    const user = await User.findById(userId).select('deletionStatus isDeleted');

    res.status(200).json(
        new ApiResponse(
            200,
            {
                deletionStatus: user?.deletionStatus || 'NONE',
                request: latestRequest || null
            },
            'Deletion status retrieved successfully'
        )
    );
});

// POST /api/user/account-deletion-request
export const submitCustomerDeletionRequest = asyncHandler(async (req, res) => {
    const userId = req.user._id || req.user.id;
    const { password, reason, additionalFeedback } = req.body;

    if (!reason || !reason.trim()) {
        throw new ApiError(400, 'Please select or provide a reason for account deletion.');
    }

    if (!password || !password.trim()) {
        throw new ApiError(400, 'Please enter your password to confirm deletion request.');
    }

    // Verify user password
    const user = await User.findById(userId).select('+password');
    if (!user) {
        throw new ApiError(404, 'User not found.');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
        throw new ApiError(400, 'Incorrect password. Verification failed.');
    }

    // Check if there's already an active pending request
    const existingPending = await AccountDeletionRequest.findOne({
        requesterId: userId,
        requesterModel: 'User',
        status: 'PENDING'
    });

    if (existingPending) {
        throw new ApiError(400, 'You already have a pending account deletion request under review by Admin.');
    }

    const newRequest = await AccountDeletionRequest.create({
        requesterId: user._id,
        requesterModel: 'User',
        role: 'customer',
        requesterInfo: {
            name: user.name,
            email: user.email,
            phone: user.phone || ''
        },
        reason: reason.trim(),
        additionalFeedback: additionalFeedback ? additionalFeedback.trim() : '',
        status: 'PENDING'
    });

    user.deletionStatus = 'PENDING';
    await user.save();

    // Notify user
    await Notification.create({
        recipientId: user._id,
        recipientType: 'user',
        title: 'Account Deletion Request Submitted',
        message: 'Your account deletion request has been submitted to Admin. It is currently under review.',
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
                    title: 'New Account Deletion Request',
                    message: `Customer ${user.name} (${user.email}) requested account deletion.`,
                    type: 'system',
                    data: {
                        requestId: String(newRequest._id),
                        requesterRole: 'customer',
                        requesterId: String(user._id)
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

// POST /api/user/account-deletion-request/cancel
export const cancelCustomerDeletionRequest = asyncHandler(async (req, res) => {
    const userId = req.user._id || req.user.id;

    const pendingRequest = await AccountDeletionRequest.findOne({
        requesterId: userId,
        requesterModel: 'User',
        status: 'PENDING'
    });

    if (!pendingRequest) {
        throw new ApiError(404, 'No pending account deletion request found to cancel.');
    }

    pendingRequest.status = 'CANCELLED';
    await pendingRequest.save();

    const user = await User.findById(userId);
    if (user) {
        user.deletionStatus = 'NONE';
        await user.save();
    }

    await Notification.create({
        recipientId: userId,
        recipientType: 'user',
        title: 'Account Deletion Request Cancelled',
        message: 'Your account deletion request has been cancelled. Your account remains active.',
        type: 'system'
    }).catch(() => {});

    res.status(200).json(
        new ApiResponse(200, { request: pendingRequest }, 'Your account deletion request has been cancelled successfully.')
    );
});
