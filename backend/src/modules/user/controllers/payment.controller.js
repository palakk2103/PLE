import crypto from 'crypto';
import Razorpay from 'razorpay';
import Order from '../../../models/Order.model.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import { createNotification } from '../../../services/notification.service.js';
import { sendNotificationToUser } from '../../../utils/pushNotificationHelper.js';
import { getIO } from '../../../config/socket.js';
import { generateInvoiceForOrder } from '../../../services/invoice.service.js';

// Verify Razorpay payment signature
export const verifyPayment = asyncHandler(async (req, res) => {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, orderId } = req.body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !orderId) {
        throw new ApiError(400, 'Missing payment parameters.');
    }

    // Find database Order
    const order = await Order.findOne({ orderId });
    if (!order) {
        throw new ApiError(404, 'Order not found.');
    }

    // Verify signature
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generatedSignature = hmac.digest('hex');

    if (generatedSignature !== razorpay_signature) {
        order.paymentStatus = 'failed';
        if (order.paymentDetails) {
            order.paymentDetails.status = 'failed';
        }
        await order.save();
        throw new ApiError(400, 'Payment signature verification failed.');
    }

    // Retrieve safe card details from Razorpay API
    let cardNetwork = undefined;
    let cardLast4 = undefined;
    let bankName = undefined;
    let paymentMethod = 'card';

    try {
        const razorpayInstance = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });
        const paymentInfo = await razorpayInstance.payments.fetch(razorpay_payment_id);
        paymentMethod = paymentInfo.method || 'card';
        if (paymentInfo.card) {
            cardNetwork = paymentInfo.card.network || undefined;
            cardLast4 = paymentInfo.card.last4 || undefined;
        }
        bankName = paymentInfo.bank || undefined;
    } catch (err) {
        console.error('Failed to fetch payment details from Razorpay:', err);
    }

    // Update order status & payment details
    order.paymentStatus = 'paid'; // Or 'captured' or 'success' - we use 'paid' for backward compatibility
    order.paymentDetails = {
        razorpayPaymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        razorpaySignature: razorpay_signature,
        cardNetwork,
        cardLast4,
        bankName,
        transactionTime: new Date(),
        gatewayName: 'Razorpay',
        paymentMethod,
        status: 'captured',
        amount: order.total,
    };

    await order.save();

    // Trigger Notifications & Real-Time Socket updates (mimicking main order placement notification logic)
    try {
        let io;
        try {
            io = getIO();
        } catch (err) {
            console.warn("Socket.io is not initialized yet:", err.message);
        }

        if (order.vendorItems && order.vendorItems.length > 0) {
            for (const v of order.vendorItems) {
                // Create database notification for vendor
                await createNotification({
                    recipientId: v.vendorId,
                    recipientType: 'vendor',
                    title: 'New Order Received',
                    message: `You have received a new order ${order.orderId} for Rs.${v.subtotal}`,
                    type: 'order',
                    data: {
                        orderId: String(order.orderId || order._id),
                        dbOrderId: String(order._id),
                        vendorId: String(v.vendorId),
                        subtotal: String(v.subtotal)
                    }
                }).catch(e => console.error("Error creating database notification for vendor:", e));

                // Emit socket event to the vendor's room
                if (io) {
                    io.to(`user_${v.vendorId}`).emit('new_order_placed', {
                        orderId: order.orderId,
                        dbOrderId: order._id,
                        total: v.subtotal,
                        items: v.items,
                        customerName: order.shippingAddress?.name || 'Guest',
                        shippingAddress: order.shippingAddress,
                        createdAt: order.createdAt
                    });
                }
            }
        }

        // Send push notification to buyer
        if (order.userId) {
            await sendNotificationToUser(order.userId, {
                title: 'Order Confirmed! 🎉',
                body: `Your order ${order.orderId} of Rs.${order.total} has been successfully placed.`,
                data: {
                    type: 'order',
                    orderId: String(order.orderId || order._id),
                    link: `/orders/${order.orderId}`
                }
            });
        }
    } catch (notificationErr) {
        console.error("Error sending payment success notifications:", notificationErr);
    }

    // Sync / update invoice with payment details
    try {
        await generateInvoiceForOrder(order._id);
    } catch (invErr) {
        console.error("Invoice sync error after payment verification:", invErr?.message);
    }

    res.status(200).json(new ApiResponse(200, order, 'Payment verified and order updated successfully.'));
});

// Recreate Razorpay order for retry payment flow
export const retryPayment = asyncHandler(async (req, res) => {
    const { orderId } = req.body;

    if (!orderId) {
        throw new ApiError(400, 'Missing order ID.');
    }

    const order = await Order.findOne({ orderId });
    if (!order) {
        throw new ApiError(404, 'Order not found.');
    }

    // Only allow retry for failed/pending payments
    if (order.paymentStatus === 'paid') {
        throw new ApiError(400, 'Order is already paid.');
    }

    try {
        const razorpayInstance = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        const rzpOrder = await razorpayInstance.orders.create({
            amount: Math.round(order.total * 100), // in paise
            currency: 'INR',
            receipt: `rcpt_retry_${order.orderId}_${Date.now()}`
        });

        order.paymentDetails = {
            razorpayOrderId: rzpOrder.id,
            amount: order.total,
            status: 'created',
            gatewayName: 'Razorpay',
            paymentMethod: 'card'
        };

        await order.save();

        res.status(200).json(new ApiResponse(200, {
            id: rzpOrder.id,
            amount: rzpOrder.amount,
            currency: 'INR',
            key: process.env.RAZORPAY_KEY_ID
        }, 'Retry order generated.'));
    } catch (err) {
        console.error('Razorpay retry order creation failed:', err);
        throw new ApiError(500, 'Failed to generate retry gateway order. ' + err.message);
    }
});
