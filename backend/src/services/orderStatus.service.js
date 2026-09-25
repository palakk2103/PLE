import Order from '../models/Order.model.js';
import User from '../models/User.model.js';
import { sendOrderStatusEmail } from './email.service.js';
import { createNotification } from './notification.service.js';
import { getIO } from '../config/socket.js';
import { ORDER_STATUS_CONFIG, ORDER_STATUSES } from '../constants/orderStatus.constants.js';

import mongoose from 'mongoose';

/**
 * Safely resolves the customer's email and name for an order.
 * Inspects all possible locations: direct order properties, shippingAddress,
 * billingAddress, guestInfo, populated userId object, or queries User collection.
 */
export const resolveCustomerContact = async (order) => {
    let email = '';
    let name = '';

    // 1. Direct fields on order
    if (order?.customerEmail) email = String(order.customerEmail).trim();
    if (order?.customerName) name = String(order.customerName).trim();
    if (order?.email && !email) email = String(order.email).trim();

    // 2. Shipping Address
    if (!email && order?.shippingAddress?.email) email = String(order.shippingAddress.email).trim();
    if (!name && order?.shippingAddress?.name) name = String(order.shippingAddress.name).trim();

    // 3. Billing Address
    if (!email && order?.billingAddress?.email) email = String(order.billingAddress.email).trim();
    if (!name && order?.billingAddress?.name) name = String(order.billingAddress.name).trim();

    // 4. Guest info
    if (!email && order?.guestInfo?.email) email = String(order.guestInfo.email).trim();
    if (!name && order?.guestInfo?.name) name = String(order.guestInfo.name).trim();

    // 5. Populated userId or user object
    const userObj = (order?.userId && typeof order.userId === 'object')
        ? order.userId
        : (order?.user && typeof order.user === 'object')
            ? order.user
            : null;

    if (userObj) {
        if (!email && userObj.email) email = String(userObj.email).trim();
        if (!name && (userObj.name || userObj.fullName)) name = String(userObj.name || userObj.fullName).trim();
    }

    // 6. If email/name still missing and we have a valid userId reference, query the User model
    const rawUserId = userObj?._id ||
        (typeof order?.userId === 'string' || order?.userId instanceof mongoose.Types.ObjectId ? order.userId : null) ||
        (typeof order?.user === 'string' || order?.user instanceof mongoose.Types.ObjectId ? order.user : null);

    if ((!email || !name) && rawUserId && mongoose.Types.ObjectId.isValid(String(rawUserId))) {
        try {
            const userDoc = await User.findById(rawUserId).select('email name fullName').lean();
            if (userDoc) {
                if (!email && userDoc.email) email = String(userDoc.email).trim();
                if (!name && (userDoc.name || userDoc.fullName)) name = String(userDoc.name || userDoc.fullName).trim();
            }
        } catch (err) {
            console.error('[OrderStatus] Error looking up user contact:', err?.message);
        }
    }

    email = email ? email.toLowerCase() : null;
    name = name || 'Valued Customer';

    console.log(`[OrderStatus] Resolved contact for order ${order?.orderId || order?._id}: email=${email}, name=${name}`);

    return {
        email,
        name,
    };
};

/**
 * Central orchestrator for order status changes.
 * 
 * Guarantees:
 * 1. Safe status update and timestamp updates
 * 2. Chronological statusHistory logging
 * 3. Robust duplicate email protection
 * 4. Resilient email delivery (failures never roll back status update)
 * 5. Real-time socket emissions and in-app notifications
 * 
 * @param {Object} order - Mongoose Order Document or Order Object
 * @param {string} nextStatus - The new status to transition to
 * @param {Object} [options]
 * @param {string} [options.updatedBy] - ObjectId of actor
 * @param {string} [options.updatedByRole] - 'admin' | 'vendor' | 'delivery' | 'user' | 'system'
 * @param {string} [options.note] - Custom status note or cancellation reason
 * @param {boolean} [options.notifyCustomer=true] - Whether to send email & in-app notification
 * @returns {Promise<Object>} The updated order
 */
export const handleOrderStatusTransition = async (order, nextStatus, options = {}) => {
    const {
        updatedBy = null,
        updatedByRole = 'system',
        note = null,
        notifyCustomer = true,
        session = null,
    } = options;

    if (!order) {
        throw new Error('Order is required for status transition.');
    }

    const orderId = order.orderId || order.id || order._id;
    const previousStatus = String(order.status || '').toLowerCase();
    const normalizedNextStatus = String(nextStatus || '').toLowerCase();

    // Ensure statusHistory and emailNotifications arrays exist
    if (!Array.isArray(order.statusHistory)) order.statusHistory = [];
    if (!Array.isArray(order.emailNotifications)) order.emailNotifications = [];

    const isSameStatus = previousStatus === normalizedNextStatus;
    const hasHistoryForStatus = order.statusHistory.some((h) => h.status === normalizedNextStatus);

    // If already at this status and history already recorded, avoid duplicate operation
    if (isSameStatus && hasHistoryForStatus && !options.force) {
        console.log(`[OrderStatus] Order ${orderId} is already at status '${normalizedNextStatus}'. Skipping duplicate processing.`);
        return order;
    }

    // Update status field
    order.status = normalizedNextStatus;

    // Update corresponding lifecycle timestamps
    const now = new Date();
    if (normalizedNextStatus === ORDER_STATUSES.PROCESSING && !order.processingAt) {
        order.processingAt = now;
    } else if (normalizedNextStatus === ORDER_STATUSES.SHIPPED && !order.shippedAt) {
        order.shippedAt = now;
    } else if (normalizedNextStatus === ORDER_STATUSES.OUT_FOR_DELIVERY && !order.outForDeliveryAt) {
        order.outForDeliveryAt = now;
    } else if (normalizedNextStatus === ORDER_STATUSES.DELIVERED && !order.deliveredAt) {
        order.deliveredAt = now;
    } else if (normalizedNextStatus === ORDER_STATUSES.CANCELLED && !order.cancelledAt) {
        order.cancelledAt = now;
        if (note && !order.cancellationReason) {
            order.cancellationReason = note;
        }
    }

    // Record chronological status history entry
    const config = ORDER_STATUS_CONFIG[normalizedNextStatus];
    const defaultNote = config ? `${config.label}: ${config.customerMessage}` : `Status changed to ${normalizedNextStatus}`;

    order.statusHistory.push({
        status: normalizedNextStatus,
        timestamp: now,
        note: note || defaultNote,
        updatedBy: updatedBy || null,
        updatedByRole: updatedByRole || 'system',
    });

    // Save order status changes to database
    if (typeof order.save === 'function') {
        if (session) {
            await order.save({ session });
        } else {
            await order.save();
        }
    } else {
        await Order.updateOne(
            { _id: order._id },
            {
                $set: {
                    status: normalizedNextStatus,
                    processingAt: order.processingAt,
                    shippedAt: order.shippedAt,
                    outForDeliveryAt: order.outForDeliveryAt,
                    deliveredAt: order.deliveredAt,
                    cancelledAt: order.cancelledAt,
                    cancellationReason: order.cancellationReason,
                },
                $push: {
                    statusHistory: order.statusHistory[order.statusHistory.length - 1],
                },
            }
        );
    }

    console.log(`[OrderStatus] Order ${orderId} successfully transitioned: ${previousStatus || 'initial'} -> ${normalizedNextStatus} (by: ${updatedByRole})`);

    // Handle Customer Notifications
    if (notifyCustomer) {
        // Prevent duplicate emails for the same status unless forceEmail is requested
        const alreadySent = !options.forceEmail && (order.emailNotifications || []).some(
            (entry) => entry.status === normalizedNextStatus && entry.success === true
        );

        if (alreadySent) {
            console.log(`[OrderStatus] Email for status '${normalizedNextStatus}' already sent to customer for order ${orderId}. Skipping duplicate email.`);
        } else {
            // Attempt email notification in safe background wrapper (never fails the caller)
            (async () => {
                try {
                    const { email, name } = await resolveCustomerContact(order);
                    if (!email) {
                        console.warn(`[OrderStatus] Customer email not found for order ${orderId}. Cannot send status email.`);
                        return;
                    }

                    console.log(`[OrderStatus] Sending '${normalizedNextStatus}' email to ${email} for order ${orderId}...`);

                    const info = await sendOrderStatusEmail({
                        order,
                        status: normalizedNextStatus,
                        recipientEmail: email,
                        customerName: name,
                    });

                    // Log email success to database audit trail
                    await Order.updateOne(
                        { _id: order._id },
                        {
                            $push: {
                                emailNotifications: {
                                    status: normalizedNextStatus,
                                    recipientEmail: email,
                                    sentAt: new Date(),
                                    success: true,
                                    messageId: info?.messageId || 'SENT',
                                },
                            },
                        }
                    );
                    console.log(`[OrderStatus] Successfully logged email notification for order ${orderId} (${normalizedNextStatus}) to ${email}`);
                } catch (emailErr) {
                    // Safe error logging: status update remains 100% SUCCESSFUL
                    console.error(`[OrderStatus] Failed to send email for order ${orderId} (${normalizedNextStatus}):`, emailErr?.message || emailErr);

                    try {
                        const { email } = await resolveCustomerContact(order);
                        if (email) {
                            await Order.updateOne(
                                { _id: order._id },
                                {
                                    $push: {
                                        emailNotifications: {
                                            status: normalizedNextStatus,
                                            recipientEmail: email,
                                            sentAt: new Date(),
                                            success: false,
                                            error: String(emailErr?.message || 'SMTP delivery failure'),
                                        },
                                    },
                                }
                            );
                        }
                    } catch (dbErr) {
                        console.error('[OrderStatus] Failed to log email error to order doc:', dbErr?.message);
                    }
                }
            })();
        }

        // In-app Notification
        if (order.userId) {
            createNotification({
                recipientId: order.userId,
                recipientType: 'user',
                title: config?.label || 'Order status updated',
                message: config?.customerMessage || `Your order ${orderId} is now ${normalizedNextStatus}.`,
                type: 'order',
                data: {
                    orderId: String(orderId),
                    status: String(normalizedNextStatus),
                },
            }).catch((notifErr) => {
                console.error('[OrderStatus] Failed to create in-app notification:', notifErr?.message);
            });
        }

        // Real-time Socket Event
        try {
            const io = getIO();
            if (io) {
                if (order.userId) {
                    io.to(`user_${order.userId}`).emit('order_status_updated', {
                        orderId: order.orderId || orderId,
                        _id: order._id,
                        status: normalizedNextStatus,
                        statusHistory: order.statusHistory,
                    });
                }
                io.to(`order_${order.orderId || orderId}`).emit('order_status_updated', {
                    orderId: order.orderId || orderId,
                    _id: order._id,
                    status: normalizedNextStatus,
                    statusHistory: order.statusHistory,
                });
            }
        } catch (socketErr) {
            // Sockets may not be initialized in background workers or test scripts
        }
    }

    return order;
};
