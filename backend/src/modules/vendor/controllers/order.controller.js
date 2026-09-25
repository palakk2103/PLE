import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Order from '../../../models/Order.model.js';
import Product from '../../../models/Product.model.js';
import Commission from '../../../models/Commission.model.js';
import Settlement from '../../../models/Settlement.model.js';
import mongoose from 'mongoose';
import { createNotification } from '../../../services/notification.service.js';
import { createShipment } from '../../delivery/deliveryManager.js';
import { handleOrderStatusTransition } from '../../../services/orderStatus.service.js';

const deriveTopLevelOrderStatus = (vendorItems = [], fallback = 'pending') => {
    const statuses = (vendorItems || [])
        .map((item) => String(item?.status || '').toLowerCase())
        .filter(Boolean);

    if (!statuses.length) return String(fallback || 'pending').toLowerCase();

    if (statuses.every((s) => s === 'cancelled')) return 'cancelled';
    if (statuses.every((s) => s === 'delivered')) return 'delivered';
    if (statuses.includes('shipped')) return 'shipped';
    if (statuses.includes('processing')) return 'processing';
    if (statuses.includes('pending')) return 'pending';

    return String(fallback || 'pending').toLowerCase();
};

// GET /api/vendor/orders
export const getVendorOrders = asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 20 } = req.query;
    const numericPage = Math.max(1, Number(page) || 1);
    const numericLimit = Math.max(1, Number(limit) || 20);
    const skip = (numericPage - 1) * numericLimit;

    const vendorIdsToMatch = req.user.role === 'managed_vendor'
        ? [req.user.shopId, req.user.id].filter(Boolean)
        : [req.user.id];

    const filter = status
        ? { vendorItems: { $elemMatch: { vendorId: { $in: vendorIdsToMatch }, status } } }
        : { 'vendorItems.vendorId': { $in: vendorIdsToMatch } };

    const orders = await Order.find(filter)
        .populate('userId', 'name email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(numericLimit);
    const total = await Order.countDocuments(filter);
    res.status(200).json(new ApiResponse(200, { orders, total, page: numericPage, pages: Math.ceil(total / numericLimit) }, 'Orders fetched.'));
});

// GET /api/vendor/orders/:id
export const getVendorOrderById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const idFilter = [{ orderId: id }];
    if (mongoose.Types.ObjectId.isValid(id)) {
        idFilter.push({ _id: id });
    }

    const vendorIdsToMatch = req.user.role === 'managed_vendor'
        ? [req.user.shopId, req.user.id].filter(Boolean)
        : [req.user.id];

    const order = await Order.findOne({
        $or: idFilter,
        'vendorItems.vendorId': { $in: vendorIdsToMatch },
    }).populate('userId', 'name email phone');
    if (!order) throw new ApiError(404, 'Order not found.');

    res.status(200).json(new ApiResponse(200, order, 'Order fetched.'));
});

// PATCH /api/vendor/orders/:id/status
export const updateOrderStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    const allowed = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!allowed.includes(status)) throw new ApiError(400, `Status must be one of: ${allowed.join(', ')}`);
    const transitionMap = {
        pending: ['pending', 'processing', 'cancelled'],
        processing: ['processing', 'shipped', 'cancelled'],
        shipped: ['shipped', 'delivered'],
        delivered: ['delivered'],
        cancelled: ['cancelled'],
    };

    const { id } = req.params;
    const idFilter = [{ orderId: id }];
    if (mongoose.Types.ObjectId.isValid(id)) {
        idFilter.push({ _id: id });
    }

    const vendorIdsToMatch = req.user.role === 'managed_vendor'
        ? [req.user.shopId, req.user.id].filter(Boolean)
        : [req.user.id];

    const order = await Order.findOne({
        $or: idFilter,
        'vendorItems.vendorId': { $in: vendorIdsToMatch },
    });
    if (!order) throw new ApiError(404, 'Order not found.');
    const vendorItem = order.vendorItems.find((vi) => vendorIdsToMatch.map(String).includes(String(vi.vendorId)));
    if (!vendorItem) throw new ApiError(404, 'Vendor order item not found.');

    const currentStatus = String(vendorItem.status || 'pending');
    const allowedNextStatuses = transitionMap[currentStatus] || [];
    if (!allowedNextStatuses.includes(status)) {
        throw new ApiError(409, `Cannot move order from ${currentStatus} to ${status}.`);
    }

    // Update only this vendor's items status
    order.vendorItems = order.vendorItems.map((vi) =>
        vendorIdsToMatch.map(String).includes(String(vi.vendorId)) ? { ...vi.toObject(), status } : vi
    );
    const oldStatus = order.status;
    const nextDerivedStatus = deriveTopLevelOrderStatus(order.vendorItems, order.status);

    if (nextDerivedStatus !== oldStatus) {
        order.status = nextDerivedStatus;
        await handleOrderStatusTransition(order, nextDerivedStatus, {
            updatedBy: req.user?.id || req.user?._id,
            updatedByRole: 'vendor',
            note: `Vendor updated item status to ${status}`,
            notifyCustomer: true,
        });
    } else {
        await order.save();
    }

    const notificationTasks = [];
    if (order.userId) {
        notificationTasks.push(
            createNotification({
                recipientId: order.userId,
                recipientType: 'user',
                title: 'Order item status updated',
                message: `An item in your order ${order.orderId || order._id} is now ${status}.`,
                type: 'order',
                data: {
                    orderId: String(order.orderId || order._id),
                    status: String(status),
                    scope: 'vendor_item',
                },
            })
        );
    }

    notificationTasks.push(
        createNotification({
            recipientId: req.user.id,
            recipientType: 'vendor',
            title: 'Order status updated',
            message: `Order ${order.orderId || order._id} moved to ${status}.`,
            type: 'order',
            data: {
                orderId: String(order.orderId || order._id),
                status: String(status),
            },
        })
    );

    await Promise.allSettled(notificationTasks);

    res.status(200).json(new ApiResponse(200, order, 'Order status updated.'));
});

// GET /api/vendor/earnings
export const getEarnings = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 50,
        settlementsPage = 1,
        settlementsLimit = 50,
    } = req.query;
    const numericPage = Math.max(1, Number(page) || 1);
    const numericLimit = Math.max(1, Number(limit) || 50);
    const commissionSkip = (numericPage - 1) * numericLimit;
    const numericSettlementsPage = Math.max(1, Number(settlementsPage) || 1);
    const numericSettlementsLimit = Math.max(1, Number(settlementsLimit) || 50);
    const settlementSkip = (numericSettlementsPage - 1) * numericSettlementsLimit;

    const vendorIdsToMatch = req.user.role === 'managed_vendor'
        ? [req.user.shopId, req.user.id].filter(Boolean)
        : [req.user.id];

    const [commissionDocs, totalCommissions, settlements, totalSettlements] = await Promise.all([
        Commission.find({ vendorId: { $in: vendorIdsToMatch } })
            .populate('orderId', 'orderId status')
            .sort({ createdAt: -1 })
            .skip(commissionSkip)
            .limit(numericLimit),
        Commission.countDocuments({ vendorId: { $in: vendorIdsToMatch } }),
        Settlement.find({ vendorId: { $in: vendorIdsToMatch } })
            .sort({ createdAt: -1 })
            .skip(settlementSkip)
            .limit(numericSettlementsLimit),
        Settlement.countDocuments({ vendorId: { $in: vendorIdsToMatch } }),
    ]);
    const allCommissionsForSummary = await Commission.find({ vendorId: { $in: vendorIdsToMatch } })
        .populate('orderId', 'orderId status')
        .sort({ createdAt: -1 });

    const commissions = commissionDocs.map((doc) => {
        const commission = doc.toObject();
        const orderRef = commission.orderId?._id || commission.orderId;
        const orderDisplayId = commission.orderId?.orderId || String(orderRef || '');
        const orderStatus = String(commission.orderId?.status || '').toLowerCase();
        const effectiveStatus = orderStatus === 'cancelled' ? 'cancelled' : String(commission.status || 'pending');
        return {
            ...commission,
            orderRef,
            orderDisplayId,
            effectiveStatus,
        };
    });

    const summary = allCommissionsForSummary.reduce((acc, doc) => {
        const c = doc.toObject();
        const status = String(c.status || 'pending');
        const orderStatus = String(c.orderId?.status || '').toLowerCase();
        const effectiveStatus = orderStatus === 'cancelled' ? 'cancelled' : status;
        const earnings = Number(c.vendorEarnings || 0);
        const commissionAmount = Number(c.commission || 0);

        // Cancelled commissions should not contribute to active earnings totals.
        if (effectiveStatus !== 'cancelled') {
            acc.totalEarnings += earnings;
            acc.totalCommission += commissionAmount;
            acc.totalOrders += 1;
        }

        if (effectiveStatus === 'pending') acc.pendingEarnings += earnings;
        if (effectiveStatus === 'paid') acc.paidEarnings += earnings;
        if (effectiveStatus === 'cancelled') acc.cancelledEarnings += earnings;
        return acc;
    }, {
        totalEarnings: 0,
        pendingEarnings: 0,
        paidEarnings: 0,
        cancelledEarnings: 0,
        totalCommission: 0,
        totalOrders: 0
    });

    res.status(200).json(
        new ApiResponse(
            200,
            {
                summary,
                commissions,
                settlements,
                pagination: {
                    totalCommissions,
                    page: numericPage,
                    limit: numericLimit,
                    pages: Math.max(1, Math.ceil(totalCommissions / numericLimit)),
                },
                settlementsPagination: {
                    totalSettlements,
                    page: numericSettlementsPage,
                    limit: numericSettlementsLimit,
                    pages: Math.max(1, Math.ceil(totalSettlements / numericSettlementsLimit)),
                },
            },
            'Earnings fetched.'
        )
    );
});

// POST /api/vendor/orders/bulk
export const createBulkOrders = asyncHandler(async (req, res) => {
    const { orders } = req.body;
    if (!Array.isArray(orders) || orders.length === 0) {
        throw new ApiError(400, 'Please provide an array of orders to create.');
    }

    if (orders.length > 500) {
        throw new ApiError(400, 'Bulk order upload is limited to 500 orders per batch.');
    }

    const vendorId = req.user.id;
    const isManaged = req.user.role === 'managed_vendor';
    const shopId = req.user.shopId;

    let vendorName = 'Vendor';
    if (isManaged) {
        vendorName = req.user.storeName || req.user.name || 'Managed Vendor';
    } else {
        const vendorDoc = await mongoose.model('Vendor').findById(vendorId).select('storeName name');
        if (vendorDoc) {
            vendorName = vendorDoc.storeName || vendorDoc.name || 'Vendor';
        }
    }

    const createdOrders = [];
    const errors = [];

    for (let index = 0; index < orders.length; index++) {
        const orderData = orders[index];
        const rowNum = index + 1;

        try {
            const { customer, shippingAddress, items, paymentMethod = 'cod', paymentStatus = 'pending', notes } = orderData;

            const custName = customer?.name || shippingAddress?.name;
            const custPhone = customer?.phone || shippingAddress?.phone;
            const custEmail = customer?.email || shippingAddress?.email;
            const addr = shippingAddress?.address;
            const city = shippingAddress?.city;
            const state = shippingAddress?.state;
            const zipCode = shippingAddress?.zipCode;

            if (!custName || !custPhone || !addr || !city || !state || !zipCode) {
                throw new Error(`Row #${rowNum}: Missing mandatory customer/shipping info (Name, Phone, Address, City, State, Pincode).`);
            }

            if (!Array.isArray(items) || items.length === 0) {
                throw new Error(`Row #${rowNum}: Order must contain at least 1 item.`);
            }

            const formattedItems = [];
            let calculatedSubtotal = 0;

            for (const item of items) {
                const qty = Math.max(1, Number(item.quantity) || 1);
                let productDoc = null;

                if (item.productId && mongoose.Types.ObjectId.isValid(item.productId)) {
                    productDoc = await Product.findById(item.productId);
                } else if (item.name || item.productName) {
                    const searchName = (item.name || item.productName).trim();
                    const productFilter = isManaged
                        ? { $or: [{ shopId }, { vendorId }, { vendorUserId: vendorId }], name: new RegExp(`^${searchName.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') }
                        : { vendorId, name: new RegExp(`^${searchName.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') };
                    productDoc = await Product.findOne(productFilter);
                }

                const price = Number(item.price !== undefined && item.price !== null && item.price !== '' ? item.price : (productDoc?.price || 0));
                const name = item.name || productDoc?.name || 'Bulk Order Item';
                const image = productDoc?.image || productDoc?.images?.[0] || '';

                formattedItems.push({
                    productId: productDoc?._id || null,
                    vendorId: isManaged ? (shopId || vendorId) : vendorId,
                    name,
                    image,
                    price,
                    quantity: qty,
                    variant: item.variant || {},
                });

                calculatedSubtotal += price * qty;

                // Update stock if product exists and stock quantity is tracked
                if (productDoc && typeof productDoc.stockQuantity === 'number') {
                    productDoc.stockQuantity = Math.max(0, productDoc.stockQuantity - qty);
                    if (productDoc.stockQuantity === 0) {
                        productDoc.stock = 'out_of_stock';
                    } else if (productDoc.stockQuantity <= (productDoc.lowStockThreshold || 5)) {
                        productDoc.stock = 'low_stock';
                    }
                    await productDoc.save();
                }
            }

            const uniqueId = `ORD-BLK-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}-${rowNum}`;
            const targetVendorId = isManaged ? (shopId || vendorId) : vendorId;

            const vendorGroup = {
                vendorId: targetVendorId,
                vendorName,
                items: formattedItems,
                subtotal: calculatedSubtotal,
                shipping: Number(orderData.shipping || 0),
                tax: Number(orderData.tax || 0),
                discount: Number(orderData.discount || 0),
                status: 'pending',
            };

            const grandTotal = calculatedSubtotal + vendorGroup.shipping + vendorGroup.tax - vendorGroup.discount;

            const validPaymentMethod = ['card', 'cash', 'bank', 'wallet', 'upi', 'cod'].includes(String(paymentMethod).toLowerCase())
                ? String(paymentMethod).toLowerCase()
                : 'cod';

            const newOrder = await Order.create({
                orderId: uniqueId,
                guestInfo: {
                    name: custName,
                    phone: custPhone,
                    email: custEmail || '',
                },
                items: formattedItems,
                vendorItems: [vendorGroup],
                shippingAddress: {
                    name: custName,
                    email: custEmail || '',
                    phone: custPhone,
                    address: addr,
                    city,
                    state,
                    zipCode,
                    country: shippingAddress?.country || 'India',
                },
                paymentMethod: validPaymentMethod,
                paymentStatus: paymentStatus === 'paid' ? 'paid' : 'pending',
                status: 'pending',
                subtotal: calculatedSubtotal,
                shipping: vendorGroup.shipping,
                tax: vendorGroup.tax,
                discount: vendorGroup.discount,
                total: Math.max(0, grandTotal),
            });

            createdOrders.push({
                row: rowNum,
                orderId: newOrder.orderId,
                id: newOrder._id,
                customer: custName,
                total: newOrder.total,
            });
        } catch (err) {
            errors.push({
                row: rowNum,
                message: err.message || `Error processing row #${rowNum}`,
            });
        }
    }

    res.status(200).json(
        new ApiResponse(
            200,
            {
                totalAttempted: orders.length,
                successCount: createdOrders.length,
                failedCount: errors.length,
                createdOrders,
                errors,
            },
            `Bulk order creation completed. Created: ${createdOrders.length}, Failed: ${errors.length}.`
        )
    );
});

// POST /api/vendor/orders/:id/shiprocket-shipment
export const createShiprocketShipment = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const idFilter = [{ orderId: id }];
    if (mongoose.Types.ObjectId.isValid(id)) {
        idFilter.push({ _id: id });
    }

    const vendorIdsToMatch = req.user.role === 'managed_vendor'
        ? [req.user.shopId, req.user.id].filter(Boolean)
        : [req.user.id];

    const order = await Order.findOne({
        $or: idFilter,
        'vendorItems.vendorId': { $in: vendorIdsToMatch },
    });

    if (!order) throw new ApiError(404, 'Order not found or does not belong to your store.');

    const vendorItem = order.vendorItems.find((vi) =>
        vendorIdsToMatch.map(String).includes(String(vi.vendorId?._id || vi.vendorId))
    );

    const currentStatus = String(vendorItem?.status ?? order.status ?? 'pending').toLowerCase();
    if (!['pending', 'processing', 'shipped'].includes(currentStatus)) {
        throw new ApiError(400, `Order must be in 'pending', 'processing', or 'shipped' status to create a shipment. Current: ${currentStatus}`);
    }

    const shippingAddr = order.shippingAddress || {};
    const items = vendorItem?.items?.length ? vendorItem.items : (order.items || []);

    const shipmentContext = {
        preferredProvider: 'shiprocket',
        orderId: order.orderId || String(order._id),
        orderMongoId: order._id,
        orderDate: order.createdAt,
        billingAddress: {
            name: shippingAddr.name || shippingAddr.fullName || order.guestInfo?.name || 'Customer',
            address: shippingAddr.address || shippingAddr.street || 'Address',
            city: shippingAddr.city || 'City',
            state: shippingAddr.state || 'State',
            zipCode: shippingAddr.zipCode || shippingAddr.pincode || '110001',
            country: shippingAddr.country || 'India',
            email: shippingAddr.email || order.guestInfo?.email || 'customer@example.com',
            phone: shippingAddr.phone || order.guestInfo?.phone || '9999999999',
        },
        shippingAddress: {
            name: shippingAddr.name || shippingAddr.fullName || order.guestInfo?.name || 'Customer',
            address: shippingAddr.address || shippingAddr.street || 'Address',
            city: shippingAddr.city || 'City',
            state: shippingAddr.state || 'State',
            zipCode: shippingAddr.zipCode || shippingAddr.pincode || '110001',
            country: shippingAddr.country || 'India',
            email: shippingAddr.email || order.guestInfo?.email || 'customer@example.com',
            phone: shippingAddr.phone || order.guestInfo?.phone || '9999999999',
        },
        orderItems: items.map((item, idx) => ({
            name: item.name || `Item ${idx + 1}`,
            sku: item.sku || item.productId || `SKU-${idx + 1}`,
            quantity: item.quantity || 1,
            price: item.price || 0,
            discount: item.discount || 0,
            tax: item.tax || 0,
            hsn: item.hsn || '',
            productId: item.productId,
        })),
        paymentMethod: order.paymentMethod === 'cod' ? 'COD' : 'Prepaid',
        subtotal: vendorItem?.subtotal ?? order.subtotal ?? order.total ?? 0,
    };

    const { shipment, result } = await createShipment(shipmentContext);

    res.status(200).json(
        new ApiResponse(200, {
            shipmentId: shipment?._id,
            awbCode: result?.awbCode || null,
            trackingNumber: result?.awbCode || result?.externalShipmentId || null,
            trackingUrl: result?.trackingUrl || null,
            courierName: result?.courierName || null,
            shiprocketOrderId: result?.shiprocketOrderId || null,
            status: shipment?.status || 'created',
        }, 'Shiprocket shipment created successfully.')
    );
});
