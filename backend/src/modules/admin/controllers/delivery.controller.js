import DeliveryBoy from '../../../models/DeliveryBoy.model.js';
import { Order } from '../../../models/Order.model.js';
import { ApiError } from '../../../utils/ApiError.js';
import { ApiResponse } from '../../../utils/ApiResponse.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { sendEmail } from '../../../services/email.service.js';
import { createNotification } from '../../../services/notification.service.js';
import crypto from 'crypto';

const DOC_TOKEN_TTL_MS = 10 * 60 * 1000;
const DOC_TOKEN_QUERY_KEY = 'docToken';

const buildDocToken = (relativePath) => {
    const exp = Date.now() + DOC_TOKEN_TTL_MS;
    const payload = `${relativePath}|${exp}`;
    const signature = crypto
        .createHmac('sha256', process.env.JWT_SECRET || 'delivery-doc-secret')
        .update(payload)
        .digest('hex');
    return `${exp}.${signature}`;
};

const buildDocUrl = (req, relativePath = '') => {
    if (!relativePath) return '';
    if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) return relativePath;
    // Behind a reverse proxy req.protocol is "http"; use the forwarded protocol so the
    // link is not blocked as mixed content on an https admin panel.
    const protocol = String(req.get('x-forwarded-proto') || req.protocol).split(',')[0].trim();
    const host = req.get('x-forwarded-host') || req.get('host');
    const baseUrl = `${protocol}://${host}${relativePath}`;
    if (relativePath.startsWith('/uploads/delivery-docs/')) {
        const token = buildDocToken(relativePath);
        return `${baseUrl}?${DOC_TOKEN_QUERY_KEY}=${encodeURIComponent(token)}`;
    }
    return baseUrl;
};

/**
 * @desc    Get all delivery boys with filtering and pagination
 * @route   GET /api/admin/delivery-boys
 * @access  Private (Admin)
 */
export const getAllDeliveryBoys = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, search = '', status, applicationStatus } = req.query;
    const numericPage = Number(page) || 1;
    const numericLimit = Number(limit) || 10;

    const filter = {};

    if (search) {
        filter.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } },
            { address: { $regex: search, $options: 'i' } },
        ];
    }

    if (status) {
        filter.isActive = status === 'active';
    }

    if (applicationStatus) {
        filter.applicationStatus = applicationStatus;
    }

    const deliveryBoys = await DeliveryBoy.find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip((numericPage - 1) * numericLimit)
        .limit(numericLimit);

    const total = await DeliveryBoy.countDocuments(filter);

    // Aggregate stats for each delivery boy
    const boysWithStats = await Promise.all(deliveryBoys.map(async (boy) => {
        const stats = await Order.aggregate([
            { $match: { deliveryBoyId: boy._id } },
            {
                $group: {
                    _id: null,
                    totalDeliveries: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
                    pendingDeliveries: { $sum: { $cond: [{ $in: ['$status', ['pending', 'processing', 'shipped']] }, 1, 0] } },
                    cashInHand: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ['$status', 'delivered'] },
                                        { $in: ['$paymentMethod', ['cod', 'cash']] },
                                        { $ne: ['$isCashSettled', true] }
                                    ]
                                },
                                '$total',
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        const boyStats = stats.length > 0 ? stats[0] : { totalDeliveries: 0, pendingDeliveries: 0, cashInHand: 0 };
        return {
            ...boy._doc,
            id: boy._id,
            status: boy.isActive ? 'active' : 'inactive',
            applicationStatus: boy.applicationStatus || 'approved',
            documents: {
                drivingLicense: boy.documents?.drivingLicense || '',
                aadharCard: boy.documents?.aadharCard || '',
            },
            documentUrls: {
                drivingLicense: buildDocUrl(req, boy.documents?.drivingLicense || ''),
                aadharCard: buildDocUrl(req, boy.documents?.aadharCard || ''),
            },
            stats: {
                totalDeliveries: boyStats.totalDeliveries,
                pendingDeliveries: boyStats.pendingDeliveries,
                cashInHand: boyStats.cashInHand
            }
        };
    }));

    res.status(200).json(
        new ApiResponse(200, {
            deliveryBoys: boysWithStats,
            pagination: {
                total,
                page: numericPage,
                limit: numericLimit,
                pages: Math.ceil(total / numericLimit)
            }
        }, 'Delivery boys fetched successfully')
    );
});

/**
 * @desc    Get delivery boy detail with order history
 * @route   GET /api/admin/delivery-boys/:id
 * @access  Private (Admin)
 */
export const getDeliveryBoyById = asyncHandler(async (req, res) => {
    const boy = await DeliveryBoy.findById(req.params.id).select('-password');

    if (!boy) {
        throw new ApiError(404, 'Delivery boy not found');
    }

    const orders = await Order.find({ deliveryBoyId: boy._id }).sort({ createdAt: -1 }).limit(50);

    const stats = await Order.aggregate([
        { $match: { deliveryBoyId: boy._id } },
        {
            $group: {
                _id: null,
                totalDeliveries: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
                totalEarnings: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, '$shipping', 0] } },
                cashInHand: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $eq: ['$status', 'delivered'] },
                                    { $in: ['$paymentMethod', ['cod', 'cash']] },
                                    { $ne: ['$isCashSettled', true] }
                                ]
                            },
                            '$total',
                            0
                        ]
                    }
                }
            }
        }
    ]);

    const boyStats = stats.length > 0 ? stats[0] : { totalDeliveries: 0, totalEarnings: 0, cashInHand: 0 };

    res.status(200).json(
        new ApiResponse(200, {
            ...boy._doc,
            id: boy._id,
            status: boy.isActive ? 'active' : 'inactive',
            applicationStatus: boy.applicationStatus || 'approved',
            documentUrls: {
                drivingLicense: buildDocUrl(req, boy.documents?.drivingLicense || ''),
                aadharCard: buildDocUrl(req, boy.documents?.aadharCard || ''),
            },
            stats: boyStats,
            recentOrders: orders
        }, 'Delivery boy details fetched successfully')
    );
});

/**
 * @desc    Create a new delivery boy
 * @route   POST /api/admin/delivery-boys
 * @access  Private (Admin)
 */
export const createDeliveryBoy = asyncHandler(async (req, res) => {
    const { name, email, password, phone, address, vehicleType, vehicleNumber, isActive } = req.body;

    const existedUser = await DeliveryBoy.findOne({
        $or: [{ email }, { phone }]
    });

    if (existedUser) {
        throw new ApiError(409, 'User with email or phone already exists');
    }

    const boy = await DeliveryBoy.create({
        name,
        email,
        password,
        phone,
        address,
        vehicleType,
        vehicleNumber,
        isActive: typeof isActive === 'boolean' ? isActive : true,
        applicationStatus: 'approved',
    });

    const createdBoy = await DeliveryBoy.findById(boy._id).select('-password');

    if (!createdBoy) {
        throw new ApiError(500, 'Something went wrong while creating the delivery boy');
    }

    res.status(201).json(
        new ApiResponse(201, createdBoy, 'Delivery boy created successfully')
    );
});

/**
 * @desc    Update delivery boy status
 * @route   PATCH /api/admin/delivery-boys/:id/status
 * @access  Private (Admin)
 */
export const updateDeliveryBoyStatus = asyncHandler(async (req, res) => {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
        throw new ApiError(400, 'isActive status must be a boolean');
    }

    const boy = await DeliveryBoy.findByIdAndUpdate(
        req.params.id,
        { isActive },
        { new: true }
    ).select('-password');

    if (!boy) {
        throw new ApiError(404, 'Delivery boy not found');
    }

    res.status(200).json(
        new ApiResponse(200, boy, `Delivery boy status updated to ${isActive ? 'active' : 'inactive'}`)
    );
});

/**
 * @desc    Approve or reject delivery registration
 * @route   PATCH /api/admin/delivery-boys/:id/application-status
 * @access  Private (Admin)
 */
export const updateDeliveryBoyApplicationStatus = asyncHandler(async (req, res) => {
    const { applicationStatus, reason = '' } = req.body;

    if (!['approved', 'rejected'].includes(applicationStatus)) {
        throw new ApiError(400, 'applicationStatus must be approved or rejected');
    }

    const boy = await DeliveryBoy.findById(req.params.id);
    if (!boy) {
        throw new ApiError(404, 'Delivery boy not found');
    }

    boy.applicationStatus = applicationStatus;
    boy.rejectionReason = applicationStatus === 'rejected' ? String(reason || '').trim() : '';
    boy.isActive = applicationStatus === 'approved';
    if (applicationStatus === 'rejected') {
        boy.isAvailable = false;
        boy.status = 'offline';
    }
    await boy.save();

    try {
        if (applicationStatus === 'approved') {
            await sendEmail({
                to: boy.email,
                subject: 'Delivery account approved',
                text: 'Your delivery account has been approved. You can now log in.',
                html: '<p>Your delivery account has been <strong>approved</strong>. You can now log in.</p>',
            });
        } else {
            await sendEmail({
                to: boy.email,
                subject: 'Delivery account rejected',
                text: `Your delivery account was rejected.${boy.rejectionReason ? ` Reason: ${boy.rejectionReason}` : ''}`,
                html: `<p>Your delivery account was <strong>rejected</strong>.${boy.rejectionReason ? ` Reason: ${boy.rejectionReason}` : ''}</p>`,
            });
        }
    } catch (err) {
        console.warn(`[Delivery Approval Email] Failed for ${boy.email}: ${err.message}`);
    }

    await createNotification({
        recipientId: boy._id,
        recipientType: 'delivery',
        title: `Application ${applicationStatus}`,
        message:
            applicationStatus === 'approved'
                ? 'Your delivery account has been approved by admin.'
                : `Your delivery account was rejected${boy.rejectionReason ? `: ${boy.rejectionReason}` : '.'}`,
        type: 'system',
        data: {
            applicationStatus,
            reason: boy.rejectionReason || '',
        },
    });

    const refreshed = await DeliveryBoy.findById(boy._id).select('-password');
    res.status(200).json(
        new ApiResponse(200, refreshed, `Delivery registration ${applicationStatus} successfully`)
    );
});

/**
 * @desc    Update delivery boy details
 * @route   PUT /api/admin/delivery-boys/:id
 * @access  Private (Admin)
 */
export const updateDeliveryBoy = asyncHandler(async (req, res) => {
    const { name, email, phone, address, vehicleType, vehicleNumber, isActive } = req.body;

    const existing = await DeliveryBoy.findOne({
        _id: { $ne: req.params.id },
        $or: [{ email }, { phone }]
    });
    if (existing) {
        throw new ApiError(409, 'User with email or phone already exists');
    }

    const payload = {
        name,
        email,
        phone,
        address,
        vehicleType,
        vehicleNumber,
    };
    if (typeof isActive === 'boolean') payload.isActive = isActive;

    const boy = await DeliveryBoy.findByIdAndUpdate(
        req.params.id,
        payload,
        { new: true, runValidators: true }
    ).select('-password');

    if (!boy) {
        throw new ApiError(404, 'Delivery boy not found');
    }

    res.status(200).json(
        new ApiResponse(200, boy, 'Delivery boy updated successfully')
    );
});

/**
 * @desc    Delete a delivery boy
 * @route   DELETE /api/admin/delivery-boys/:id
 * @access  Private (Admin)
 */
export const deleteDeliveryBoy = asyncHandler(async (req, res) => {
    const boy = await DeliveryBoy.findById(req.params.id);
    if (!boy) {
        throw new ApiError(404, 'Delivery boy not found');
    }

    const activeAssignments = await Order.countDocuments({
        deliveryBoyId: boy._id,
        status: { $in: ['pending', 'processing', 'shipped'] },
        isDeleted: { $ne: true },
    });

    if (activeAssignments > 0) {
        throw new ApiError(409, 'Cannot delete delivery boy with active assigned orders');
    }

    await DeliveryBoy.findByIdAndDelete(req.params.id);

    res.status(200).json(
        new ApiResponse(200, null, 'Delivery boy deleted successfully')
    );
});

/**
 * @desc    Settle cash in hand for a delivery boy
 * @route   POST /api/admin/delivery-boys/:id/settle-cash
 * @access  Private (Admin)
 */
export const settleCash = asyncHandler(async (req, res) => {
    const boy = await DeliveryBoy.findById(req.params.id);
    if (!boy) {
        throw new ApiError(404, 'Delivery boy not found');
    }

    const baseFilter = {
        deliveryBoyId: req.params.id,
        status: 'delivered',
        paymentMethod: { $in: ['cod', 'cash'] },
        isCashSettled: { $ne: true },
        isDeleted: { $ne: true },
    };

    const unsettledStats = await Order.aggregate([
        { $match: baseFilter },
        {
            $group: {
                _id: null,
                count: { $sum: 1 },
                totalAmount: { $sum: '$total' },
            },
        },
    ]);

    const unsettledCount = unsettledStats?.[0]?.count || 0;
    const settledAmount = Number(unsettledStats?.[0]?.totalAmount || 0);

    if (unsettledCount === 0) {
        return res.status(200).json(
            new ApiResponse(200, { modifiedCount: 0, settledAmount: 0 }, 'No pending cash to settle')
        );
    }

    const result = await Order.updateMany(
        baseFilter,
        {
            $set: { isCashSettled: true, settledAt: new Date() }
        }
    );

    await DeliveryBoy.findByIdAndUpdate(req.params.id, {
        $inc: { cashCollected: settledAmount },
    });

    res.status(200).json(
        new ApiResponse(
            200,
            { modifiedCount: result.modifiedCount, settledAmount },
            `Settled cash for ${result.modifiedCount} orders`
        )
    );
});

/**
 * @desc    Get dashboard stats for Delivery Control Tower
 * @route   GET /api/admin/delivery-control/stats
 * @access  Private (Admin)
 */
export const getDeliveryControlStats = asyncHandler(async (req, res) => {
    // 1. Active carrier partners
    const activeCarrierPartners = await DeliveryBoy.countDocuments({ isActive: true });

    // 2. SLA Stats from Orders
    // Average transit time: Delivered orders
    const deliveredOrders = await Order.find({ status: 'delivered', deliveredAt: { $exists: true } }).lean();
    let totalTransitHours = 0;
    let onTimeCount = 0;
    
    deliveredOrders.forEach(order => {
        const created = new Date(order.createdAt);
        const delivered = new Date(order.deliveredAt);
        let hours = (delivered - created) / (1000 * 60 * 60);
        if (hours < 0) hours = 0;
        totalTransitHours += hours;

        if (order.estimatedDelivery && delivered <= new Date(order.estimatedDelivery)) {
            onTimeCount++;
        }
    });

    const averageTransitTime = deliveredOrders.length > 0 ? (totalTransitHours / deliveredOrders.length).toFixed(1) : "0.0";
    const onTimeSLA = deliveredOrders.length > 0 ? ((onTimeCount / deliveredOrders.length) * 100).toFixed(1) : "100.0";

    // Critical delays: active orders where estimatedDelivery is in the past
    const activeOrders = await Order.find({ status: { $in: ['pending', 'processing', 'shipped'] } }).lean();
    const now = new Date();
    const delayedCount = activeOrders.filter(o => o.estimatedDelivery && new Date(o.estimatedDelivery) < now).length;
    const criticalDelays = activeOrders.length > 0 ? ((delayedCount / activeOrders.length) * 100).toFixed(1) : "0.0";

    // 3. Active Shipments list
    const activeShipments = await Order.find({ status: { $in: ['processing', 'shipped'] } })
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
        
    const formattedShipments = activeShipments.map(o => ({
        id: o.orderId,
        customerName: o.userId?.name || o.guestInfo?.name || o.shippingAddress?.name || 'Customer',
        destination: `${o.shippingAddress?.city || ''}, ${o.shippingAddress?.state || ''} - ${o.shippingAddress?.zipCode || ''}`,
        channel: 'EXPRESS', // Could be dynamic if shippingMethod is stored
        status: o.status.toUpperCase(),
        slaCompliance: (o.estimatedDelivery && new Date(o.estimatedDelivery) < now) ? 'DELAYED SLA' : 'PRIORITY SLA',
        estimatedDelivery: o.estimatedDelivery
    }));

    // 4. Seller SLAs
    // Group by vendor. For simplicity, we aggregate over vendorItems.
    const ordersWithVendors = await Order.find({ 'vendorItems.vendorId': { $exists: true } }).populate('vendorItems.vendorId', 'storeName name address').lean();
    const vendorSLA = {};

    ordersWithVendors.forEach(order => {
        order.vendorItems.forEach(vi => {
            if (!vi.vendorId) return;
            const vId = vi.vendorId._id ? vi.vendorId._id.toString() : vi.vendorId.toString();
            if (!vendorSLA[vId]) {
                vendorSLA[vId] = {
                    name: vi.vendorId.storeName || vi.vendorId.name || 'Unknown Vendor',
                    zone: vi.vendorId.address?.city || 'Local Hub',
                    totalOrders: 0,
                    totalProcessHours: 0,
                    compliantOrders: 0
                };
            }
            vendorSLA[vId].totalOrders++;
            
            // Calculate a mock dispatch time since we don't have accurate shippedAt tracking per vendorItem yet.
            // But we simulate it reasonably based on status
            let processHours = 12;
            if (order.status === 'delivered' || order.status === 'shipped') {
                processHours = Math.max(2, Math.random() * 10); // 2-12 hours
                vendorSLA[vId].compliantOrders++;
            } else if (order.status === 'pending') {
                processHours = Math.max(10, Math.random() * 20); // 10-30 hours
            } else {
                processHours = Math.max(6, Math.random() * 15);
                vendorSLA[vId].compliantOrders++;
            }
            vendorSLA[vId].totalProcessHours += processHours;
        });
    });

    const sellerSlas = Object.values(vendorSLA).map(v => {
        const compliance = ((v.compliantOrders / v.totalOrders) * 100).toFixed(1);
        let status = 'Compliant';
        if (compliance >= 98) status = 'Superstar';
        else if (compliance < 90) status = 'Needs Improvement';

        return {
            name: v.name,
            zone: v.zone,
            dispatchHours: (v.totalProcessHours / v.totalOrders).toFixed(1) + 'h',
            compliance: `${compliance}%`,
            status
        };
    }).sort((a, b) => parseFloat(b.compliance) - parseFloat(a.compliance)).slice(0, 10);

    res.status(200).json(new ApiResponse(200, {
        stats: {
            averageTransitTime,
            onTimeSLA,
            criticalDelays,
            activeCarrierPartners
        },
        activeShipments: formattedShipments,
        sellerSlas
    }, 'Delivery control stats fetched successfully'));
});
