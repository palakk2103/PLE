import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Order from '../../../models/Order.model.js';
import DeliveryBoy from '../../../models/DeliveryBoy.model.js';
import User from '../../../models/User.model.js';
import Commission from '../../../models/Commission.model.js';
import Product from '../../../models/Product.model.js';
import PurchaseOrder from '../../../models/PurchaseOrder.model.js';
import { createNotification } from '../../../services/notification.service.js';
import { getIO } from '../../../config/socket.js';

// GET /api/admin/orders
export const getAllOrders = asyncHandler(async (req, res) => {
    const { status, orderType, page = 1, limit = 20, search, startDate, endDate, userId } = req.query;
    const numericPage = Number(page) || 1;
    const numericLimit = Number(limit) || 20;
    const skip = (numericPage - 1) * numericLimit;
    const filter = { isDeleted: { $ne: true } };

    if (status && status !== 'all') filter.status = status;
    if (orderType && orderType !== 'all') {
        if (orderType === 'product_request') {
            filter.$or = [{ orderType: 'product_request' }, { requestProductId: { $exists: true, $ne: null } }];
        } else if (orderType === 'rfq') {
            filter.$or = [{ orderType: 'rfq' }, { rfqId: { $exists: true, $ne: null } }];
        } else if (orderType === 'b2b') {
            filter.orderType = 'b2b';
        } else if (orderType === 'b2c') {
            filter.$and = [
                { orderType: { $nin: ['b2b', 'product_request', 'rfq'] } },
                { requestProductId: { $exists: false } },
                { rfqId: { $exists: false } }
            ];
        } else {
            filter.orderType = orderType;
        }
    }
    if (String(req.query.assignableOnly || '') === 'true' && !filter.status) {
        filter.status = { $in: ['pending', 'processing', 'shipped'] };
    }
    if (search) {
        const regex = new RegExp(search, 'i');
        const matchedUsers = await User.find({
            $or: [{ name: regex }, { email: regex }, { phone: regex }]
        }).select('_id').limit(200).lean();
        const matchedUserIds = matchedUsers.map((u) => u._id);

        filter.$or = [
            { orderId: regex },
            { 'shippingAddress.name': regex },
            { 'shippingAddress.email': regex },
            ...(matchedUserIds.length > 0 ? [{ userId: { $in: matchedUserIds } }] : []),
        ];
    }
    if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }
    if (req.query.vendorId) {
        filter['vendorItems.vendorId'] = req.query.vendorId;
    }
    if (userId) {
        filter.userId = userId;
    }
    if (String(req.query.onlyUnassigned || '') === 'true') {
        filter.deliveryBoyId = null;
    }

    const [orders, total] = await Promise.all([
        Order.find(filter)
            .populate('userId', 'name email phone')
            .populate('deliveryBoyId', 'name phone')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(numericLimit)
            .lean(),
        Order.countDocuments(filter),
    ]);

    res.status(200).json(new ApiResponse(200, {
        orders,
        total,
        page: numericPage,
        pages: Math.ceil(total / numericLimit),
    }, 'Orders fetched.'));
});

// GET /api/admin/orders/:id
export const getOrderById = asyncHandler(async (req, res) => {
    const order = await Order.findOne({
        $or: [{ orderId: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }],
        isDeleted: { $ne: true },
    })
        .populate('userId', 'name email phone')
        .populate('deliveryBoyId', 'name phone email vehicleType vehicleNumber')
        .populate('items.productId', 'name images price')
        .lean();

    if (!order) throw new ApiError(404, 'Order not found.');
    res.status(200).json(new ApiResponse(200, order, 'Order fetched.'));
});

// PATCH /api/admin/orders/:id/status
export const updateOrderStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    const allowed = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];
    if (!allowed.includes(status)) throw new ApiError(400, `Status must be one of: ${allowed.join(', ')}`);

    const order = await Order.findOne({
        $or: [{ orderId: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }],
        isDeleted: { $ne: true },
    }).populate('userId', 'name email');

    if (!order) throw new ApiError(404, 'Order not found.');

    const previousStatus = String(order.status || '').toLowerCase();
    const nextStatus = String(status || '').toLowerCase();

    const allowedTransitions = {
        pending: ['processing', 'cancelled'],
        processing: ['shipped', 'cancelled'],
        shipped: ['delivered', 'cancelled', 'returned'],
        delivered: ['returned'],
        cancelled: [],
        returned: [],
    };

    if (previousStatus !== nextStatus) {
        const nextAllowed = allowedTransitions[previousStatus] || [];
        if (!nextAllowed.includes(nextStatus)) {
            throw new ApiError(409, `Cannot move order from ${previousStatus} to ${nextStatus}.`);
        }
    }

    order.status = nextStatus;
    if (nextStatus === 'delivered') {
        order.deliveredAt = new Date();
        order.cancelledAt = null;
    } else if (nextStatus === 'cancelled') {
        order.cancelledAt = new Date();
    } else if (nextStatus === 'shipped') {
        order.shippedAt = new Date();
        order.cancelledAt = null;
    } else if (nextStatus === 'processing') {
        order.processingAt = new Date();
        order.cancelledAt = null;
    } else if (nextStatus === 'returned') {
        order.cancelledAt = null;
    } else {
        order.deliveredAt = null;
        order.cancelledAt = null;
    }

    if (nextStatus === 'processing') {
        order.vendorItems = (order.vendorItems || []).map((vi) => {
            const current = String(vi?.status || 'pending');
            if (current === 'cancelled' || current === 'delivered') return vi;
            return { ...vi.toObject(), status: 'processing' };
        });
    }
    if (nextStatus === 'shipped') {
        order.vendorItems = (order.vendorItems || []).map((vi) => {
            const current = String(vi?.status || 'pending');
            if (current === 'cancelled' || current === 'delivered') return vi;
            return { ...vi.toObject(), status: 'shipped' };
        });
    }
    if (nextStatus === 'delivered') {
        order.vendorItems = (order.vendorItems || []).map((vi) => {
            const current = String(vi?.status || 'pending');
            if (current === 'cancelled') return vi;
            return { ...vi.toObject(), status: 'delivered' };
        });
    }
    if (nextStatus === 'cancelled') {
        order.vendorItems = (order.vendorItems || []).map((vi) => {
            const current = String(vi?.status || 'pending');
            if (current === 'delivered') return vi;
            return { ...vi.toObject(), status: 'cancelled' };
        });
    }

    if (nextStatus === 'cancelled' && previousStatus !== 'cancelled' && ['pending', 'processing', 'shipped'].includes(previousStatus)) {
        for (const item of order.items || []) {
            const product = await Product.findById(item.productId);
            if (!product) continue;
            product.stockQuantity += Number(item.quantity || 0);
            if (product.stockQuantity <= 0) product.stock = 'out_of_stock';
            else if (product.stockQuantity <= product.lowStockThreshold) product.stock = 'low_stock';
            else product.stock = 'in_stock';
            await product.save();
        }
    }

    await order.save();

    if (nextStatus === 'delivered' && previousStatus !== 'delivered') {
        try {
            const loyaltyService = await import('../../../services/loyalty.service.js');
            if (order.loyaltyPointsEarned > 0 && order.userId) {
                await loyaltyService.earnPoints(order.userId, order._id, order.subtotal - (order.couponDiscount || 0) - (order.loyaltyDiscount || 0));
            }
        } catch (err) {
            console.error('Failed to credit loyalty points on delivery:', err);
        }
    }

    if (nextStatus === 'cancelled') {
        // Reverse vendor earnings visibility for this order.
        // Keep it idempotent by only updating commissions not already cancelled.
        await Commission.updateMany(
            {
                orderId: order._id,
                status: { $ne: 'cancelled' },
            },
            {
                $set: {
                    status: 'cancelled',
                    paidAt: null,
                    settlementId: null,
                },
            }
        );
    }

    const notificationTasks = [];

    if (order.userId) {
        notificationTasks.push(
            createNotification({
                recipientId: order.userId,
                recipientType: 'user',
                title: 'Order status updated',
                message: `Your order ${order.orderId} is now ${status}.`,
                type: 'order',
                data: {
                    orderId: String(order.orderId),
                    status: String(nextStatus),
                },
            })
        );
    }

    const vendorIds = [
        ...new Set(
            (order.vendorItems || [])
                .map((item) => String(item?.vendorId || '').trim())
                .filter(Boolean)
        ),
    ];

    vendorIds.forEach((vendorId) => {
        notificationTasks.push(
            createNotification({
                recipientId: vendorId,
                recipientType: 'vendor',
                title: 'Order status updated by admin',
                message: `Order ${order.orderId} was updated to ${status} by admin.`,
                type: 'order',
                data: {
                    orderId: String(order.orderId),
                    status: String(nextStatus),
                },
            })
        );
    });

    if (order.deliveryBoyId) {
        notificationTasks.push(
            createNotification({
                recipientId: order.deliveryBoyId,
                recipientType: 'delivery',
                title: 'Assigned order updated',
                message: `Order ${order.orderId} is now ${status}.`,
                type: 'order',
                data: {
                    orderId: String(order.orderId),
                    status: String(nextStatus),
                },
            })
        );
    }

    if (notificationTasks.length > 0) {
        await Promise.allSettled(notificationTasks);
    }

    try {
        const io = getIO();
        if (order.userId) {
            io.to(`user_${order.userId}`).emit('order_status_updated', {
                orderId: order.orderId,
                _id: order._id,
                status: nextStatus
            });
        }
    } catch (err) {
        console.error('Socket emission failed for order status update:', err);
    }

    res.status(200).json(new ApiResponse(200, order, 'Order status updated.'));
});

// PATCH /api/admin/orders/:id/assign-delivery
export const assignDeliveryBoy = asyncHandler(async (req, res) => {
    const { deliveryBoyId } = req.body;
    if (!deliveryBoyId) throw new ApiError(400, 'deliveryBoyId is required.');

    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId).select('name isActive applicationStatus');
    if (!deliveryBoy) throw new ApiError(404, 'Delivery boy not found.');
    if (!deliveryBoy.isActive) throw new ApiError(400, 'Delivery boy is inactive.');
    if (deliveryBoy.applicationStatus !== 'approved') {
        throw new ApiError(400, 'Delivery boy is not approved.');
    }

    const filter = {
        $or: [{ orderId: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }],
        isDeleted: { $ne: true },
    };
    const order = await Order.findOne(filter);
    if (!order) throw new ApiError(404, 'Order not found.');

    if (['cancelled', 'returned', 'delivered'].includes(String(order.status))) {
        throw new ApiError(409, `Cannot assign delivery for ${order.status} order.`);
    }

    const previousDeliveryBoyId = order.deliveryBoyId ? String(order.deliveryBoyId) : '';
    const isReassigned = previousDeliveryBoyId && previousDeliveryBoyId !== String(deliveryBoyId);

    order.deliveryBoyId = deliveryBoyId;
    if (order.status === 'pending') {
        order.status = 'processing';
        order.processingAt = new Date();
        // Keep vendor-facing status in sync with order lifecycle.
        order.vendorItems = (order.vendorItems || []).map((vi) => {
            const current = String(vi?.status || 'pending');
            if (current === 'cancelled' || current === 'delivered') return vi;
            return { ...vi.toObject(), status: 'processing' };
        });
    }
    await order.save();

    await createNotification({
        recipientId: deliveryBoy._id,
        recipientType: 'delivery',
        title: isReassigned ? 'Order reassigned' : 'New order assigned',
        message: `${order.orderId} has been ${isReassigned ? 'reassigned to you' : 'assigned to you'}.`,
        type: 'order',
        data: {
            orderId: String(order.orderId),
            reassigned: isReassigned ? 'true' : 'false',
            assignedAt: new Date().toISOString(),
        },
    });

    const assignmentTasks = [];
    if (order.userId) {
        assignmentTasks.push(
            createNotification({
                recipientId: order.userId,
                recipientType: 'user',
                title: isReassigned ? 'Delivery partner updated' : 'Delivery assigned',
                message: `Order ${order.orderId} has a delivery partner assigned.`,
                type: 'order',
                data: {
                    orderId: String(order.orderId),
                    deliveryBoyId: String(deliveryBoy._id),
                },
            })
        );
    }

    const vendorIds = [
        ...new Set(
            (order.vendorItems || [])
                .map((item) => String(item?.vendorId || '').trim())
                .filter(Boolean)
        ),
    ];
    vendorIds.forEach((vendorId) => {
        assignmentTasks.push(
            createNotification({
                recipientId: vendorId,
                recipientType: 'vendor',
                title: isReassigned ? 'Delivery reassigned' : 'Delivery assigned',
                message: `Order ${order.orderId} has been assigned to a delivery partner.`,
                type: 'order',
                data: {
                    orderId: String(order.orderId),
                    deliveryBoyId: String(deliveryBoy._id),
                },
            })
        );
    });

    if (assignmentTasks.length > 0) {
        await Promise.allSettled(assignmentTasks);
    }

    res.status(200).json(new ApiResponse(200, order, 'Delivery boy assigned.'));
});

// DELETE /api/admin/orders/:id
export const deleteOrder = asyncHandler(async (req, res) => {
    const order = await Order.findOneAndUpdate(
        {
            $or: [{ orderId: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }],
            isDeleted: { $ne: true },
        },
        {
            isDeleted: true,
            deletedAt: new Date(),
            deletedBy: req.user?.id || null,
        },
        { new: true }
    );
    if (!order) throw new ApiError(404, 'Order not found.');
    res.status(200).json(new ApiResponse(200, null, 'Order archived.'));
});

// GET /api/admin/purchase-orders
export const getAllPurchaseOrders = asyncHandler(async (req, res) => {
    const { status, paymentStatus, page = 1, limit = 20, search } = req.query;
    const numericPage = Number(page) || 1;
    const numericLimit = Number(limit) || 20;
    const skip = (numericPage - 1) * numericLimit;

    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (paymentStatus && paymentStatus !== 'all') filter.paymentStatus = paymentStatus;

    if (search) {
        filter.$or = [
            { poNumber: { $regex: search, $options: 'i' } },
            { 'companyDetails.name': { $regex: search, $options: 'i' } },
            { 'vendorDetails.storeName': { $regex: search, $options: 'i' } }
        ];
    }

    const [purchaseOrders, total] = await Promise.all([
        PurchaseOrder.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(numericLimit)
            .lean(),
        PurchaseOrder.countDocuments(filter)
    ]);

    res.status(200).json(new ApiResponse(200, {
        purchaseOrders,
        total,
        page: numericPage,
        pages: Math.ceil(total / numericLimit)
    }, 'Purchase Orders fetched.'));
});

// PATCH /api/admin/purchase-orders/:id/status
export const updatePurchaseOrderStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    const allowed = ['Sent', 'Approved', 'Completed', 'Cancelled'];
    if (!allowed.includes(status)) throw new ApiError(400, `Status must be one of: ${allowed.join(', ')}`);

    const po = await PurchaseOrder.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true }
    );
    if (!po) throw new ApiError(404, 'Purchase Order not found.');

    res.status(200).json(new ApiResponse(200, po, 'Purchase Order status updated.'));
});

// PATCH /api/admin/purchase-orders/:id/payment
export const updatePurchaseOrderPayment = asyncHandler(async (req, res) => {
    const { paymentStatus } = req.body;
    const allowed = ['Unpaid', 'Paid', 'Pending'];
    if (!allowed.includes(paymentStatus)) throw new ApiError(400, `Payment status must be one of: ${allowed.join(', ')}`);

    const po = await PurchaseOrder.findByIdAndUpdate(
        req.params.id,
        { paymentStatus },
        { new: true }
    );
    if (!po) throw new ApiError(404, 'Purchase Order not found.');

    res.status(200).json(new ApiResponse(200, po, 'Purchase Order payment status updated.'));
});
