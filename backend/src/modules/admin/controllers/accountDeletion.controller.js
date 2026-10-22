import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import { AccountDeletionRequest } from '../../../models/AccountDeletionRequest.model.js';
import { User } from '../../../models/User.model.js';
import { Vendor } from '../../../models/Vendor.model.js';
import { Product } from '../../../models/Product.model.js';
import { Order } from '../../../models/Order.model.js';
import Notification from '../../../models/Notification.model.js';
import { sendEmail } from '../../../services/email.service.js';

// GET /api/admin/account-deletion-requests
export const getAllDeletionRequests = asyncHandler(async (req, res) => {
    const { role, status, search, page = 1, limit = 20 } = req.query;
    const numericPage = Math.max(parseInt(page, 10) || 1, 1);
    const numericLimit = Math.max(parseInt(limit, 10) || 20, 1);
    const skip = (numericPage - 1) * numericLimit;

    const filter = {};

    if (role && role !== 'all') {
        filter.role = role.toLowerCase();
    }

    if (status && status !== 'all') {
        filter.status = status.toUpperCase();
    }

    if (search && search.trim()) {
        const regex = new RegExp(search.trim(), 'i');
        filter.$or = [
            { 'requesterInfo.name': regex },
            { 'requesterInfo.email': regex },
            { 'requesterInfo.phone': regex },
            { 'requesterInfo.storeName': regex },
            { reason: regex }
        ];
    }

    const [requests, total, pendingCount, approvedCount, rejectedCount] = await Promise.all([
        AccountDeletionRequest.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(numericLimit)
            .populate('reviewedBy', 'name email')
            .lean(),
        AccountDeletionRequest.countDocuments(filter),
        AccountDeletionRequest.countDocuments({ status: 'PENDING' }),
        AccountDeletionRequest.countDocuments({ status: 'APPROVED' }),
        AccountDeletionRequest.countDocuments({ status: 'REJECTED' })
    ]);

    // Enhance requests with helpful operational metrics (active orders / products)
    const enhancedRequests = await Promise.all(
        requests.map(async (reqItem) => {
            let activeOrdersCount = 0;
            let totalProductsCount = 0;

            try {
                if (reqItem.role === 'customer') {
                    activeOrdersCount = await Order.countDocuments({
                        userId: reqItem.requesterId,
                        orderStatus: { $in: ['pending', 'processing', 'confirmed', 'shipped', 'out_for_delivery'] }
                    });
                } else if (reqItem.role === 'vendor') {
                    [activeOrdersCount, totalProductsCount] = await Promise.all([
                        Order.countDocuments({
                            'items.vendorId': reqItem.requesterId,
                            orderStatus: { $in: ['pending', 'processing', 'confirmed', 'shipped', 'out_for_delivery'] }
                        }),
                        Product.countDocuments({ vendorId: reqItem.requesterId })
                    ]);
                }
            } catch (err) {
                // Non-blocking fallback
            }

            return {
                ...reqItem,
                metrics: {
                    activeOrdersCount,
                    totalProductsCount
                }
            };
        })
    );

    res.status(200).json(
        new ApiResponse(
            200,
            {
                requests: enhancedRequests,
                counts: {
                    total,
                    pending: pendingCount,
                    approved: approvedCount,
                    rejected: rejectedCount
                },
                pagination: {
                    total,
                    page: numericPage,
                    limit: numericLimit,
                    totalPages: Math.ceil(total / numericLimit)
                }
            },
            'Deletion requests retrieved successfully'
        )
    );
});

// POST /api/admin/account-deletion-requests/:id/approve
export const approveDeletionRequest = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { adminRemarks } = req.body;
    const adminId = req.user?._id || req.user?.id;

    const request = await AccountDeletionRequest.findById(id);
    if (!request) {
        throw new ApiError(404, 'Account deletion request not found.');
    }

    if (request.status !== 'PENDING') {
        throw new ApiError(400, `Cannot approve request with status "${request.status}". Only PENDING requests can be approved.`);
    }

    request.status = 'APPROVED';
    request.adminRemarks = adminRemarks ? adminRemarks.trim() : 'Approved by Admin';
    request.reviewedBy = adminId;
    request.reviewedAt = new Date();
    await request.save();

    if (request.role === 'customer') {
        const user = await User.findById(request.requesterId);
        if (user) {
            user.isActive = false;
            user.isDeleted = true;
            user.deletedAt = new Date();
            user.deletionStatus = 'APPROVED';
            user.refreshTokenHash = undefined;
            user.refreshTokenExpiresAt = undefined;
            await user.save();

            // Notification
            await Notification.create({
                recipientId: user._id,
                recipientType: 'user',
                title: 'Account Deletion Approved',
                message: 'Your account deletion request has been approved by the Admin team. Your account is now closed.',
                type: 'system',
                data: {
                    requestId: String(request._id),
                    status: 'APPROVED'
                }
            }).catch(() => {});

            // Optional email
            try {
                await sendEmail({
                    to: user.email,
                    subject: 'Your PLE Account Has Been Deleted',
                    text: `Hello ${user.name},\n\nYour request to delete your PLE account has been approved and processed. Your account is now closed.\n\nThank you,\nTeam PLE`,
                    html: `<p>Hello <strong>${user.name}</strong>,</p><p>Your request to delete your PLE account has been approved and processed by our admin team. Your account is now closed.</p><p>Regards,<br/><strong>Team PLE</strong></p>`
                });
            } catch (mailErr) {
                console.warn(`[Account Deletion] Email to customer failed: ${mailErr.message}`);
            }
        }
    } else if (request.role === 'vendor') {
        const vendor = await Vendor.findById(request.requesterId);
        if (vendor) {
            vendor.status = 'deleted';
            vendor.isDeleted = true;
            vendor.deletedAt = new Date();
            vendor.deletionStatus = 'APPROVED';
            vendor.refreshTokenHash = undefined;
            vendor.refreshTokenExpiresAt = undefined;
            await vendor.save();

            // Deactivate vendor catalog products
            await Product.updateMany({ vendorId: vendor._id }, { isActive: false }).catch(() => {});

            // Notification
            await Notification.create({
                recipientId: vendor._id,
                recipientType: 'vendor',
                title: 'Vendor Account Deletion Approved',
                message: 'Your store account deletion request has been approved by Admin. Your vendor account has been closed.',
                type: 'system',
                data: {
                    requestId: String(request._id),
                    status: 'APPROVED'
                }
            }).catch(() => {});

            // Optional email
            try {
                await sendEmail({
                    to: vendor.email,
                    subject: 'Your PLE Vendor Account Has Been Closed',
                    text: `Hello ${vendor.storeName || vendor.name},\n\nYour vendor account deletion request has been approved by the Admin team. Your store and account are now closed.\n\nThank you,\nTeam PLE`,
                    html: `<p>Hello <strong>${vendor.storeName || vendor.name}</strong>,</p><p>Your vendor account deletion request has been approved by our admin team. Your store and account are now closed.</p><p>Regards,<br/><strong>Team PLE</strong></p>`
                });
            } catch (mailErr) {
                console.warn(`[Account Deletion] Email to vendor failed: ${mailErr.message}`);
            }
        }
    }

    res.status(200).json(
        new ApiResponse(200, { request }, 'Account deletion request approved and account closed successfully.')
    );
});

// POST /api/admin/account-deletion-requests/:id/reject
export const rejectDeletionRequest = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { adminRemarks } = req.body;
    const adminId = req.user?._id || req.user?.id;

    if (!adminRemarks || !adminRemarks.trim()) {
        throw new ApiError(400, 'Please provide a reason for rejecting the deletion request.');
    }

    const request = await AccountDeletionRequest.findById(id);
    if (!request) {
        throw new ApiError(404, 'Account deletion request not found.');
    }

    if (request.status !== 'PENDING') {
        throw new ApiError(400, `Cannot reject request with status "${request.status}". Only PENDING requests can be rejected.`);
    }

    request.status = 'REJECTED';
    request.adminRemarks = adminRemarks.trim();
    request.reviewedBy = adminId;
    request.reviewedAt = new Date();
    await request.save();

    if (request.role === 'customer') {
        const user = await User.findById(request.requesterId);
        if (user) {
            user.deletionStatus = 'REJECTED';
            await user.save();

            await Notification.create({
                recipientId: user._id,
                recipientType: 'user',
                title: 'Account Deletion Request Rejected',
                message: `Your account deletion request was rejected by Admin. Reason: ${adminRemarks.trim()}`,
                type: 'system',
                data: {
                    requestId: String(request._id),
                    status: 'REJECTED',
                    adminRemarks: adminRemarks.trim()
                }
            }).catch(() => {});

            try {
                await sendEmail({
                    to: user.email,
                    subject: 'Update on Your Account Deletion Request',
                    text: `Hello ${user.name},\n\nYour account deletion request could not be processed at this time.\n\nReason: ${adminRemarks.trim()}\n\nYour account remains active. Please contact support if you have questions.\n\nRegards,\nTeam PLE`,
                    html: `<p>Hello <strong>${user.name}</strong>,</p><p>Your account deletion request could not be processed at this time.</p><p><strong>Reason:</strong> ${adminRemarks.trim()}</p><p>Your account remains active. If you have any questions, please reach out to our support team.</p><p>Regards,<br/><strong>Team PLE</strong></p>`
                });
            } catch (mailErr) {
                console.warn(`[Account Deletion] Email to customer failed: ${mailErr.message}`);
            }
        }
    } else if (request.role === 'vendor') {
        const vendor = await Vendor.findById(request.requesterId);
        if (vendor) {
            vendor.deletionStatus = 'REJECTED';
            await vendor.save();

            await Notification.create({
                recipientId: vendor._id,
                recipientType: 'vendor',
                title: 'Vendor Account Deletion Request Rejected',
                message: `Your vendor account deletion request was rejected by Admin. Reason: ${adminRemarks.trim()}`,
                type: 'system',
                data: {
                    requestId: String(request._id),
                    status: 'REJECTED',
                    adminRemarks: adminRemarks.trim()
                }
            }).catch(() => {});

            try {
                await sendEmail({
                    to: vendor.email,
                    subject: 'Update on Your Vendor Account Deletion Request',
                    text: `Hello ${vendor.storeName || vendor.name},\n\nYour vendor account deletion request could not be approved at this time.\n\nReason: ${adminRemarks.trim()}\n\nYour store and seller account remain active. Please contact the seller support team if needed.\n\nRegards,\nTeam PLE`,
                    html: `<p>Hello <strong>${vendor.storeName || vendor.name}</strong>,</p><p>Your vendor account deletion request could not be approved at this time.</p><p><strong>Reason:</strong> ${adminRemarks.trim()}</p><p>Your store and seller account remain active. Please contact our seller support team if you have any questions.</p><p>Regards,<br/><strong>Team PLE</strong></p>`
                });
            } catch (mailErr) {
                console.warn(`[Account Deletion] Email to vendor failed: ${mailErr.message}`);
            }
        }
    }

    res.status(200).json(
        new ApiResponse(200, { request }, 'Account deletion request rejected successfully.')
    );
});
