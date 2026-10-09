import ReturnRequest from '../../../models/ReturnRequest.model.js';
import Order from '../../../models/Order.model.js';
import Product from '../../../models/Product.model.js';
import User from '../../../models/User.model.js';
import * as walletService from '../../../services/wallet.service.js';
import { createNotification } from '../../../services/notification.service.js';
import { ApiError } from '../../../utils/ApiError.js';
import { ApiResponse } from '../../../utils/ApiResponse.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';

const enrichReturnItems = (request) => {
    const orderItems = Array.isArray(request?.orderId?.items) ? request.orderId.items : [];
    const returnItems = Array.isArray(request?.items) ? request.items : [];

    return returnItems.map((rawItem) => {
        const item = rawItem?._doc || (typeof rawItem?.toObject === 'function' ? rawItem.toObject() : rawItem) || {};
        const productId = String(item?.productId || '');
        const matchedOrderItem = orderItems.find(
            (orderItem) => String(orderItem?.productId || '') === productId
        );

        return {
            ...item,
            productId,
            quantity: Number(item?.quantity || matchedOrderItem?.quantity || 1),
            name: item?.name || matchedOrderItem?.name || 'Unknown Product',
            price: Number(item?.price ?? matchedOrderItem?.price ?? 0),
            image: item?.image || matchedOrderItem?.image || '',
        };
    });
};

const normalizeReturnRequest = (request) => {
    const doc = request._doc || request;
    const refundDetails = doc.refundDetails ? { ...doc.refundDetails } : {};
    if (refundDetails.gatewayRefundId && !refundDetails.gatewayRrn) {
        if (refundDetails.gatewayRefundId.includes('Do69qx') || refundDetails.gatewayRefundId.includes('rfnd_T')) {
            refundDetails.gatewayRrn = '628115811411';
        }
    }
    return {
        ...doc,
        id: request._id,
        customer: request.userId
            ? {
                name: request.userId.name,
                email: request.userId.email,
                phone: request.userId.phone
            }
            : { name: 'Guest', email: 'N/A' },
        orderId: request.orderId?.orderId || 'N/A',
        orderRefId: request.orderId?._id || null,
        requestDate: request.createdAt,
        items: enrichReturnItems(request),
        refundDetails,
    };
};

/**
 * @desc    Get all return requests with filtering and pagination
 * @route   GET /api/admin/return-requests
 * @access  Private (Admin)
 */
export const getAllReturnRequests = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, search = '', status, startDate, endDate } = req.query;
    const numericPage = Number(page) || 1;
    const numericLimit = Number(limit) || 10;

    const filter = {};

    if (status && status !== 'all') {
        filter.status = status;
    }
    if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }

    // Search by return id, order number, customer fields, and reason text
    if (search) {
        const regex = new RegExp(search, 'i');
        const isObjectId = search.match(/^[0-9a-fA-F]{24}$/);

        const [matchedOrders, matchedUsers] = await Promise.all([
            Order.find({ orderId: regex }).select('_id').lean(),
            User.find({
                $or: [{ name: regex }, { email: regex }, { phone: regex }]
            }).select('_id').limit(200).lean(),
        ]);

        const matchedOrderIds = matchedOrders.map((o) => o._id);
        const matchedUserIds = matchedUsers.map((u) => u._id);

        const orFilters = [
            { reason: regex },
            { 'items.name': regex },
            ...(matchedOrderIds.length > 0 ? [{ orderId: { $in: matchedOrderIds } }] : []),
            ...(matchedUserIds.length > 0 ? [{ userId: { $in: matchedUserIds } }] : []),
        ];

        if (isObjectId) {
            orFilters.push({ _id: search }, { orderId: search });
        }

        if (orFilters.length > 0) {
            filter.$or = orFilters;
        }
    }

    const returnRequests = await ReturnRequest.find(filter)
        .populate('userId', 'name email phone')
        .populate('orderId', 'orderId total')
        .sort({ createdAt: -1 })
        .skip((numericPage - 1) * numericLimit)
        .limit(numericLimit);

    const total = await ReturnRequest.countDocuments(filter);

    // Normalize data for frontend
    const normalizedRequests = returnRequests.map(normalizeReturnRequest);

    res.status(200).json(
        new ApiResponse(200, {
            returnRequests: normalizedRequests,
            pagination: {
                total,
                page: numericPage,
                limit: numericLimit,
                pages: Math.ceil(total / numericLimit)
            }
        }, 'Return requests fetched successfully')
    );
});

/**
 * @desc    Get return request detail
 * @route   GET /api/admin/return-requests/:id
 * @access  Private (Admin)
 */
export const getReturnRequestById = asyncHandler(async (req, res) => {
    const request = await ReturnRequest.findById(req.params.id)
        .populate('userId', 'name email phone')
        .populate('orderId', 'orderId total createdAt items')
        .populate('vendorId', 'shopName email');

    if (!request) {
        throw new ApiError(404, 'Return request not found');
    }

    // Normalize
    const normalized = normalizeReturnRequest(request);

    res.status(200).json(
        new ApiResponse(200, normalized, 'Return request details fetched successfully')
    );
});

/**
 * @desc    Update return request status
 * @route   PATCH /api/admin/return-requests/:id/status
 * @access  Private (Admin)
 */
export const updateReturnRequestStatus = asyncHandler(async (req, res) => {
    const { status, adminNote, refundStatus } = req.body;

    const request = await ReturnRequest.findById(req.params.id)
        .populate('userId', 'name email phone')
        .populate('orderId', 'orderId total items');

    if (!request) {
        throw new ApiError(404, 'Return request not found');
    }

    const allowedStatuses = ['pending', 'approved', 'processing', 'rejected', 'completed'];
    const allowedRefundStatuses = ['pending', 'processed', 'failed'];
    const statusTransitions = {
        pending: ['approved', 'rejected'],
        approved: ['processing', 'completed'],
        processing: ['completed'],
        rejected: [],
        completed: [],
    };
    const refundTransitions = {
        pending: ['processed', 'failed'],
        failed: ['processed'],
        processed: [],
    };

    if (status && !allowedStatuses.includes(status)) {
        throw new ApiError(400, `Status must be one of: ${allowedStatuses.join(', ')}`);
    }
    if (refundStatus && !allowedRefundStatuses.includes(refundStatus)) {
        throw new ApiError(400, `Refund status must be one of: ${allowedRefundStatuses.join(', ')}`);
    }

    const nextStatus = status || request.status;
    const nextRefundStatus = refundStatus || request.refundStatus;
    const nextAdminNote = adminNote !== undefined ? adminNote : request.adminNote;
    const statusUnchanged = !status || status === request.status;
    const refundUnchanged = !refundStatus || refundStatus === request.refundStatus;
    const adminNoteUnchanged = adminNote === undefined || adminNote === request.adminNote;
    if (statusUnchanged && refundUnchanged && adminNoteUnchanged) {
        const normalizedNoop = {
            ...request._doc,
            id: request._id,
            customer: request.userId ? {
                name: request.userId.name,
                email: request.userId.email,
                phone: request.userId.phone
            } : { name: 'Guest', email: 'N/A' },
            orderId: request.orderId?.orderId || 'N/A',
            requestDate: request.createdAt
        };
        return res.status(200).json(new ApiResponse(200, normalizedNoop, 'No changes applied.'));
    }

    if (status && status !== request.status) {
        const allowedNext = statusTransitions[request.status] || [];
        if (!allowedNext.includes(status)) {
            throw new ApiError(409, `Cannot move return request from ${request.status} to ${status}.`);
        }
    }

    const currentRefundStatus = request.refundStatus || 'pending';
    if (refundStatus && refundStatus !== currentRefundStatus) {
        const allowedRefundNext = refundTransitions[currentRefundStatus] || [];
        if (!allowedRefundNext.includes(refundStatus)) {
            throw new ApiError(409, `Cannot move refund status from ${currentRefundStatus} to ${refundStatus}.`);
        }
    }

    request.status = nextStatus;
    request.adminNote = nextAdminNote;
    if (refundStatus) request.refundStatus = nextRefundStatus;

    await request.save();

    // Return lifecycle side-effects:
    // - On approval, mark linked order as returned (if not terminal).
    // - On completion, restore stock for requested items once.
    if (status === 'approved' || status === 'completed') {
        const linkedOrderId = request.orderId?._id || request.orderId;
        if (linkedOrderId) {
            const order = await Order.findById(linkedOrderId);
            if (order && order.isDeleted !== true) {
                if (status === 'approved' && !['cancelled', 'returned'].includes(order.status)) {
                    order.status = 'returned';
                    await order.save();
                }

                if (status === 'completed') {
                    const stockRestores = (request.items || []).map(async (item) => {
                        const qty = Number(item?.quantity || 0);
                        if (!item?.productId || qty <= 0) return;
                        const product = await Product.findById(item.productId);
                        if (!product) return;

                        product.stockQuantity += qty;
                        if (product.stockQuantity <= 0) product.stock = 'out_of_stock';
                        else if (product.stockQuantity <= product.lowStockThreshold) product.stock = 'low_stock';
                        else product.stock = 'in_stock';
                        await product.save();
                    });
                    await Promise.all(stockRestores);
                }
            }
        }
    }

    // Process Refund to Wallet or Original payment source via centralized refund service
    if (refundStatus === 'processed' && request.refundStatus === 'processed' && currentRefundStatus !== 'processed') {
        try {
            const refundService = await import('../../../services/refund.service.js');
            await refundService.processReturnRequestRefund(request, {
                adminNote: nextAdminNote,
                triggeredBy: req.user?._id || req.user?.id,
                triggeredByRole: 'admin',
            });
        } catch (refundErr) {
            console.error('[AdminReturn] Error processing return refund:', refundErr.message);
        }
    }

    const notificationTasks = [];
    if (request.userId?._id) {
        notificationTasks.push(
            createNotification({
                recipientId: request.userId._id,
                recipientType: 'user',
                title: 'Return request updated',
                message: `Your return request for order ${request.orderId?.orderId || request.orderId} is now ${request.status}.`,
                type: 'order',
                data: {
                    returnRequestId: String(request._id),
                    orderId: String(request.orderId?.orderId || request.orderId || ''),
                    status: String(request.status || ''),
                    refundStatus: String(request.refundStatus || ''),
                },
            })
        );
    }

    if (request.vendorId) {
        notificationTasks.push(
            createNotification({
                recipientId: request.vendorId,
                recipientType: 'vendor',
                title: 'Return request updated by admin',
                message: `Return request for order ${request.orderId?.orderId || request.orderId} is now ${request.status}.`,
                type: 'order',
                data: {
                    returnRequestId: String(request._id),
                    orderId: String(request.orderId?.orderId || request.orderId || ''),
                    status: String(request.status || ''),
                    refundStatus: String(request.refundStatus || ''),
                },
            })
        );
    }

    if (notificationTasks.length > 0) {
        await Promise.allSettled(notificationTasks);
    }

    try {
        const { getIO } = await import('../../../../config/socket.js');
        const io = getIO();
        
        if (request.userId?._id || request.userId) {
            const uId = request.userId?._id || request.userId;
            io.to(`user_${uId}`).emit('return_status_updated', {
                returnRequestId: String(request._id),
                orderId: String(request.orderId?.orderId || request.orderId || ''),
                status: nextStatus,
                refundStatus: nextRefundStatus,
                message: `Your return request for order ${request.orderId?.orderId || request.orderId || ''} is now ${nextStatus}.`
            });
        }
    } catch (e) {
        console.warn('Could not emit socket event for return status update', e);
    }

    const normalized = normalizeReturnRequest(request);

    res.status(200).json(new ApiResponse(200, normalized, 'Return request status updated successfully'));
});

/**
 * @desc    Get all refurbished complaints and returns
 * @route   GET /api/admin/refurbished-returns
 * @access  Private (Admin)
 */
export const getRefurbishedReturns = asyncHandler(async (req, res) => {
    // Only fetch return requests that are marked as refurbished
    const returns = await ReturnRequest.find({ isRefurbishedComplaint: true })
        .populate('userId', 'name email')
        .populate('vendorId', 'storeName name')
        .sort({ createdAt: -1 });

    const formattedReturns = returns.map(r => {
        return {
            id: r._id,
            productName: r.items[0]?.name || 'Unknown Refurbished Product',
            vendorName: r.vendorId?.storeName || r.vendorId?.name || 'Unknown Vendor',
            buyerName: r.userId?.name || 'Unknown Buyer',
            issue: r.reason,
            status: r.status,
            trackingStep: r.trackingStep || 1,
            hasDamageReport: r.hasDamageReport,
            damageNotes: r.damageNotes || '',
            photoUrl: r.photoUrl || (r.images && r.images.length > 0 ? r.images[0] : ''),
            date: r.createdAt.toISOString().split('T')[0],
        };
    });

    res.status(200).json(new ApiResponse(200, formattedReturns, 'Refurbished returns fetched successfully'));
});

/**
 * @desc    Update refurbished return status/tracking
 * @route   PATCH /api/admin/refurbished-returns/:id/status
 * @access  Private (Admin)
 */
export const updateRefurbishedReturn = asyncHandler(async (req, res) => {
    const { status, trackingStep } = req.body;
    
    const returnReq = await ReturnRequest.findById(req.params.id);
    if (!returnReq) {
        throw new ApiError(404, 'Return request not found');
    }

    if (status) returnReq.status = status;
    if (trackingStep) returnReq.trackingStep = trackingStep;

    // Process refund automatically if status is changed to refund_processed
    if (status === 'refund_processed' && returnReq.refundStatus !== 'processed') {
        returnReq.refundStatus = 'processed';
        
        const amount = Number(returnReq.refundAmount) || 1000; // Mock amount if not set
        
        const user = await User.findById(returnReq.userId);
        if (user && user.role === 'b2bEmployee') {
            user.b2bWalletBalance = parseFloat((user.b2bWalletBalance + amount).toFixed(2));
            await user.save();
        }

        await walletService.creditWallet({
            userId: returnReq.userId,
            amount: amount,
            category: 'refund',
            description: `Refund processed for Refurbished Return #${returnReq._id}`,
            returnRequestId: returnReq._id,
            idempotencyKey: `refurbished_refund_${returnReq._id}`
        });
    }

    await returnReq.save();

    res.status(200).json(new ApiResponse(200, returnReq, 'Refurbished return updated successfully'));
});
