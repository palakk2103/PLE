import Order from '../../../models/Order.model.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import { createNotification } from '../../../services/notification.service.js';
import { sendNotificationToUser } from '../../../utils/pushNotificationHelper.js';
import { getIO } from '../../../config/socket.js';
import { generateInvoiceForOrder, sendOrderInvoiceEmail } from '../../../services/invoice.service.js';
import { handleOrderStatusTransition } from '../../../services/orderStatus.service.js';
import { sendAdminFinanceAlert } from '../../../services/adminNotification.service.js';
import { createRazorpayOrder, isValidRazorpaySignature, fetchRazorpayPayment } from '../../../services/razorpay.service.js';
import ProductRequest from '../../../models/ProductRequest.model.js';

const ownsOrder = (order, user) => String(order?.userId || '') === String(user?.id || user?._id || '');

// Source Now: the request is only "Confirmed" once its order is actually paid.
const completeProductRequestAfterPayment = async (order) => {
    if (order?.orderType !== 'product_request' || !order.requestProductId) return;
    const request = await ProductRequest.findById(order.requestProductId);
    if (!request || request.status === 'Confirmed') return;
    request.status = 'Confirmed';
    request.associatedOrderId = order._id;
    request.timeline.push({ status: 'Confirmed', comment: `Payment received (₹${order.total}). Order ${order.orderId} confirmed.` });
    request.auditLog.push({
        action: 'Payment Received',
        performedBy: order.userId,
        performerType: 'User',
        reason: `Online payment ${order.paymentDetails?.razorpayPaymentId || ''} verified for order ${order.orderId}.`,
    });
    await request.save();
};

// Verify Razorpay payment signature
export const verifyPayment = asyncHandler(async (req, res) => {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, orderId } = req.body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !orderId) {
        throw new ApiError(400, 'Missing payment parameters.');
    }

    // Find database Order
    const order = await Order.findOne({ orderId });
    if (!order || !ownsOrder(order, req.user)) {
        throw new ApiError(404, 'Order not found.');
    }

    // Already paid (e.g. double-submit / page refresh): succeed without re-processing.
    if (order.paymentStatus === 'paid') {
        if (order.paymentDetails?.razorpayPaymentId === razorpay_payment_id) {
            return res.status(200).json(new ApiResponse(200, order, 'Payment already verified.'));
        }
        throw new ApiError(409, 'This order is already paid.');
    }

    // The payment must be for the gateway order we created for THIS order (prevents reusing a
    // cheaper order's payment to mark an expensive one as paid).
    const expectedRzpOrderId = order.paymentDetails?.razorpayOrderId;
    if (!expectedRzpOrderId || expectedRzpOrderId !== razorpay_order_id) {
        throw new ApiError(400, 'Payment does not belong to this order.');
    }

    if (!isValidRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
        order.paymentStatus = 'failed';
        if (order.paymentDetails) {
            order.paymentDetails.status = 'failed';
        }
        await order.save();

        // Admin Notification Item 147: Payment gateway failure
        sendAdminFinanceAlert({
            alertType: 'pg_failure',
            amount: order.total,
            transactionId: razorpay_payment_id,
            reason: 'Payment signature mismatch / verification failed.'
        }).catch(err => console.error('[FinanceAlert] PG failure alert error:', err.message));

        throw new ApiError(400, 'Payment signature verification failed.');
    }

    // Retrieve safe card details from Razorpay API
    let cardNetwork = undefined;
    let cardLast4 = undefined;
    let bankName = undefined;
    let paymentMethod = 'card';

    const paymentInfo = await fetchRazorpayPayment(razorpay_payment_id);
    if (paymentInfo) {
        paymentMethod = paymentInfo.method || 'card';
        if (paymentInfo.card) {
            cardNetwork = paymentInfo.card.network || undefined;
            cardLast4 = paymentInfo.card.last4 || undefined;
        }
        bankName = paymentInfo.bank || undefined;
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
        amount: order.paymentDetails?.amount ?? order.total,
    };

    await order.save();

    try {
        await completeProductRequestAfterPayment(order);
    } catch (prErr) {
        console.error('Failed to mark sourcing request confirmed after payment:', prErr?.message);
    }

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

    // Sync / update invoice with payment details and send customer invoice email
    try {
        const inv = await generateInvoiceForOrder(order._id);
        if (inv) {
            await sendOrderInvoiceEmail(order._id, { invoice: inv });
        }
    } catch (invErr) {
        console.error("Invoice sync / email error after payment verification:", invErr?.message);
    }

    // Trigger Order Confirmed lifecycle
    try {
        await handleOrderStatusTransition(order, 'pending', {
            updatedBy: order.userId,
            updatedByRole: 'user',
            note: 'Payment verified via online gateway',
            notifyCustomer: false, // Invoice email is already sent above with PDF
        });
    } catch (statusErr) {
        console.error("Error triggering order status transition after payment verification:", statusErr);
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
    if (!order || !ownsOrder(order, req.user)) {
        throw new ApiError(404, 'Order not found.');
    }

    // Only allow retry for failed/pending payments
    if (order.paymentStatus === 'paid') {
        throw new ApiError(400, 'Order is already paid.');
    }
    if (['cancelled', 'returned', 'refunded'].includes(String(order.status).toLowerCase())) {
        throw new ApiError(400, 'This order is no longer payable.');
    }

    const amount = order.paymentMethod === 'mixed'
        ? Math.max(0, Number(order.total || 0) - Number(order.walletAmountUsed || 0))
        : Number(order.total || 0);
    const rzp = await createRazorpayOrder(amount, { receipt: `rcpt_retry_${order.orderId}`, notes: { orderId: order.orderId } });

    order.paymentDetails = {
        razorpayOrderId: rzp.id,
        amount,
        status: 'created',
        gatewayName: 'Razorpay',
        paymentMethod: 'card'
    };
    if (order.paymentStatus === 'failed') order.paymentStatus = 'pending';
    await order.save();

    res.status(200).json(new ApiResponse(200, rzp, 'Retry order generated.'));
});
