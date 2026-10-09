import Razorpay from 'razorpay';
import * as walletService from './wallet.service.js';
import User from '../models/User.model.js';
import Order from '../models/Order.model.js';
import ReturnRequest from '../models/ReturnRequest.model.js';
import { createNotification } from './notification.service.js';
import ApiError from '../utils/ApiError.js';

/**
 * Helper to obtain the Razorpay instance dynamically.
 */
export const getRazorpayInstance = () => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
        console.warn('[RefundService] Razorpay credentials missing in environment.');
        return null;
    }
    if (typeof Razorpay === 'function') {
        return new Razorpay({ key_id: keyId, key_secret: keySecret });
    } else if (Razorpay && typeof Razorpay.default === 'function') {
        return new Razorpay.default({ key_id: keyId, key_secret: keySecret });
    }
    return null;
};

/**
 * Execute an automated refund when an order is cancelled.
 * 
 * Handles:
 * 1. Wallet payment -> Instant Wallet credit
 * 2. Razorpay (Card/UPI/Bank) -> Razorpay Refund API call
 * 3. Split Payment (Wallet + Razorpay) -> Both refunded to their respective sources
 * 
 * @param {Object} order - Order document
 * @param {Object} [options]
 * @param {string} [options.reason] - Reason for cancellation/refund
 * @param {string} [options.triggeredBy] - ID of actor
 * @param {string} [options.triggeredByRole] - 'user' | 'admin' | 'system'
 * @returns {Promise<Object>}
 */
export const processOrderCancellationRefund = async (order, options = {}) => {
    if (!order) return { processed: false, reason: 'No order provided' };

    const reason = options.reason || 'Order cancelled';
    const isPaid = order.paymentStatus === 'paid';
    const walletUsed = Number(order.walletAmountUsed || 0);
    const orderTotal = Number(order.total || 0);
    const userId = order.userId?._id || order.userId;

    // COD orders without any wallet balance used have no money to refund
    if (!isPaid && walletUsed <= 0) {
        return {
            processed: false,
            message: 'Order was not prepaid. No refund required.',
        };
    }

    const refundResults = {
        walletRefunded: 0,
        gatewayRefunded: 0,
        gatewayRefundId: null,
        success: true,
        errors: [],
    };

    // 1. Refund any wallet balance used
    if (walletUsed > 0 && userId) {
        try {
            await walletService.creditWallet({
                userId,
                amount: walletUsed,
                category: 'refund',
                description: `Refund for cancelled order #${order.orderId}`,
                orderId: order._id,
                idempotencyKey: `cancel_wallet_refund_${order._id}`,
            });
            refundResults.walletRefunded = walletUsed;
            console.log(`[RefundService] Credited ₹${walletUsed} to user wallet for cancelled order ${order.orderId}`);
        } catch (walletErr) {
            console.error('[RefundService] Error refunding wallet portion:', walletErr);
            refundResults.errors.push(`Wallet refund failed: ${walletErr.message}`);
            refundResults.success = false;
        }
    }

    // 2. Refund Razorpay / Online payment
    const paymentId = order.paymentDetails?.razorpayPaymentId;
    const paidViaOnline = (isPaid && paymentId) || (isPaid && ['card', 'upi', 'bank'].includes(order.paymentMethod));
    const onlineAmountToRefund = Math.max(0, parseFloat((orderTotal - walletUsed).toFixed(2)));

    if (paidViaOnline && onlineAmountToRefund > 0) {
        if (!paymentId) {
            console.warn(`[RefundService] Online paid order ${order.orderId} missing razorpayPaymentId. Falling back to wallet credit.`);
            if (userId) {
                try {
                    await walletService.creditWallet({
                        userId,
                        amount: onlineAmountToRefund,
                        category: 'refund',
                        description: `Refund for cancelled order #${order.orderId} (Gateway ID missing, credited to wallet)`,
                        orderId: order._id,
                        idempotencyKey: `cancel_fallback_refund_${order._id}`,
                    });
                    refundResults.walletRefunded += onlineAmountToRefund;
                } catch (fallbackErr) {
                    refundResults.errors.push(`Fallback wallet refund failed: ${fallbackErr.message}`);
                    refundResults.success = false;
                }
            }
        } else {
            const rzp = getRazorpayInstance();
            if (!rzp) {
                console.error('[RefundService] Razorpay instance unavailable for online refund.');
                refundResults.errors.push('Razorpay instance unavailable.');
                refundResults.success = false;
            } else {
                try {
                    const rzpRefund = await rzp.payments.refund(paymentId, {
                        amount: Math.round(onlineAmountToRefund * 100), // paise
                        speed: 'optimum',
                        notes: {
                            orderId: String(order.orderId || order._id),
                            reason: String(reason).slice(0, 100),
                        },
                    });

                    refundResults.gatewayRefunded = onlineAmountToRefund;
                    refundResults.gatewayRefundId = rzpRefund?.id || null;
                    refundResults.gatewayRrn = rzpRefund?.acquirer_data?.rrn || null;
                    refundResults.refundSpeed = rzpRefund?.speed_processed || rzpRefund?.speed_requested || 'normal';
                    console.log(`[RefundService] Razorpay refund successful (${rzpRefund?.id}, RRN: ${refundResults.gatewayRrn}) for order ${order.orderId}`);
                } catch (rzpErr) {
                    console.error('[RefundService] Razorpay payments.refund failed:', rzpErr);
                    // If Razorpay API rejects, fallback to crediting user wallet so user is never shortchanged
                    if (userId) {
                        try {
                            console.log(`[RefundService] Falling back to wallet credit for order ${order.orderId}`);
                            await walletService.creditWallet({
                                userId,
                                amount: onlineAmountToRefund,
                                category: 'refund',
                                description: `Refund for cancelled order #${order.orderId} (Gateway refund failed: ${rzpErr.message})`,
                                orderId: order._id,
                                idempotencyKey: `cancel_gateway_fail_wallet_refund_${order._id}`,
                            });
                            refundResults.walletRefunded += onlineAmountToRefund;
                            refundResults.errors.push(`Gateway refund failed (${rzpErr.message}), amount credited to PLE Wallet instead.`);
                        } catch (walletFallbackErr) {
                            refundResults.errors.push(`Both gateway and wallet refund failed: ${walletFallbackErr.message}`);
                            refundResults.success = false;
                        }
                    } else {
                        refundResults.errors.push(`Razorpay refund failed: ${rzpErr.message}`);
                        refundResults.success = false;
                    }
                }
            }
        }
    } else if (order.paymentMethod === 'wallet' && isPaid && onlineAmountToRefund > 0 && userId) {
        // Entire order was paid via wallet
        try {
            await walletService.creditWallet({
                userId,
                amount: onlineAmountToRefund,
                category: 'refund',
                description: `Full refund for cancelled order #${order.orderId}`,
                orderId: order._id,
                idempotencyKey: `cancel_full_wallet_refund_${order._id}`,
            });
            refundResults.walletRefunded += onlineAmountToRefund;
        } catch (walletErr) {
            refundResults.errors.push(`Wallet refund failed: ${walletErr.message}`);
            refundResults.success = false;
        }
    }

    // 3. Update order payment status and refund details
    if (refundResults.walletRefunded > 0 || refundResults.gatewayRefunded > 0) {
        order.paymentStatus = 'refunded';
        order.refundDetails = {
            gatewayRefundId: refundResults.gatewayRefundId,
            walletAmountRefunded: refundResults.walletRefunded,
            gatewayAmountRefunded: refundResults.gatewayRefunded,
            totalRefunded: refundResults.walletRefunded + refundResults.gatewayRefunded,
            status: refundResults.success ? 'processed' : 'partial',
            processedAt: new Date(),
            reason,
        };
        await order.save();

        // 4. Send customer notification
        if (userId) {
            await createNotification({
                recipientId: userId,
                recipientType: 'user',
                title: 'Refund Processed',
                message: `Refund of ₹${(refundResults.walletRefunded + refundResults.gatewayRefunded).toFixed(2)} for cancelled order ${order.orderId} has been initiated.`,
                type: 'order',
                data: {
                    orderId: String(order.orderId || order._id),
                    walletRefunded: refundResults.walletRefunded,
                    gatewayRefunded: refundResults.gatewayRefunded,
                },
            }).catch((err) => console.error('[RefundService] Notification error:', err.message));
        }
    }

    return refundResults;
};

/**
 * Execute refund for an approved/completed Return Request.
 * 
 * @param {Object} returnRequest - ReturnRequest document
 * @param {Object} [options]
 * @returns {Promise<Object>}
 */
export const processReturnRequestRefund = async (returnRequest, options = {}) => {
    if (!returnRequest) throw new ApiError(400, 'Return request is required.');
    
    const amount = Number(returnRequest.refundAmount || 0);
    if (amount <= 0) {
        return { processed: false, message: 'Refund amount is zero.' };
    }

    const linkedOrderId = returnRequest.orderId?._id || returnRequest.orderId;
    const order = await Order.findById(linkedOrderId);
    if (!order) throw new ApiError(404, 'Associated order not found.');

    const userId = returnRequest.userId?._id || returnRequest.userId;
    const destination = returnRequest.refundDestination || 'Original Payment Method';

    const result = {
        success: true,
        destination,
        amount,
        gatewayRefundId: null,
        walletTransactionId: null,
    };

    if (destination === 'Wallet') {
        // Direct PLE Wallet Credit
        const user = await User.findById(userId);
        if (user && user.role === 'b2bEmployee') {
            user.b2bWalletBalance = parseFloat(((user.b2bWalletBalance || 0) + amount).toFixed(2));
            await user.save();
        }

        const walletTx = await walletService.creditWallet({
            userId,
            amount,
            category: 'refund',
            description: `Refund for Return Request #${returnRequest._id}`,
            returnRequestId: returnRequest._id,
            orderId: order._id,
            idempotencyKey: `return_request_refund_${returnRequest._id}`,
        });

        result.walletTransactionId = walletTx?.transaction?._id || null;
    } else {
        // Original Payment Method
        const paymentId = order.paymentDetails?.razorpayPaymentId;

        if (paymentId) {
            const rzp = getRazorpayInstance();
            if (!rzp) {
                throw new ApiError(500, 'Razorpay gateway not configured for original source refunds.');
            }

            try {
                const rzpRefund = await rzp.payments.refund(paymentId, {
                    amount: Math.round(amount * 100), // paise
                    speed: 'optimum',
                    notes: {
                        orderId: String(order.orderId || order._id),
                        returnRequestId: String(returnRequest._id),
                        reason: String(returnRequest.reason || 'Product Return').slice(0, 100),
                    },
                });

                result.gatewayRefundId = rzpRefund?.id || null;
                result.gatewayRrn = rzpRefund?.acquirer_data?.rrn || null;
                result.refundSpeed = rzpRefund?.speed_processed || rzpRefund?.speed_requested || 'normal';
                console.log(`[RefundService] Razorpay return refund successful (${rzpRefund?.id}, RRN: ${result.gatewayRrn}) for request ${returnRequest._id}`);
            } catch (rzpErr) {
                console.error('[RefundService] Razorpay refund failed for return request:', rzpErr);
                // Fallback to wallet credit if bank reject/window expired
                console.log(`[RefundService] Fallback: Crediting return refund to PLE Wallet for request ${returnRequest._id}`);
                const walletTx = await walletService.creditWallet({
                    userId,
                    amount,
                    category: 'refund',
                    description: `Refund for Return Request #${returnRequest._id} (Gateway failed: ${rzpErr.message})`,
                    returnRequestId: returnRequest._id,
                    orderId: order._id,
                    idempotencyKey: `return_fallback_wallet_${returnRequest._id}`,
                });
                result.destination = 'Wallet (Gateway Fallback)';
                result.walletTransactionId = walletTx?.transaction?._id || null;
            }
        } else if (order.paymentMethod === 'wallet' || order.walletAmountUsed > 0) {
            // Original source was wallet
            const walletTx = await walletService.creditWallet({
                userId,
                amount,
                category: 'refund',
                description: `Refund for Return Request #${returnRequest._id} (Paid via Wallet)`,
                returnRequestId: returnRequest._id,
                orderId: order._id,
                idempotencyKey: `return_wallet_refund_${returnRequest._id}`,
            });
            result.destination = 'Wallet';
            result.walletTransactionId = walletTx?.transaction?._id || null;
        } else {
            // COD or offline payment: Fallback to user wallet
            const walletTx = await walletService.creditWallet({
                userId,
                amount,
                category: 'refund',
                description: `Refund for Return Request #${returnRequest._id} (COD Order credited to PLE Wallet)`,
                returnRequestId: returnRequest._id,
                orderId: order._id,
                idempotencyKey: `return_cod_wallet_${returnRequest._id}`,
            });
            result.destination = 'Wallet (COD Order)';
            result.walletTransactionId = walletTx?.transaction?._id || null;
        }
    }

    // Revert loyalty points if applicable
    const user = await User.findById(userId);
    if (user && ['customer', 'b2bAdmin', 'b2bEmployee'].includes(user.role)) {
        try {
            const loyaltyService = await import('./loyalty.service.js');
            if (order.loyaltyPointsEarned > 0) {
                await loyaltyService.reverseEarnedPoints(user._id, order._id);
            }
            if (order.loyaltyPointsRedeemed > 0) {
                await loyaltyService.restoreRedeemedPoints(user._id, order._id);
            }
        } catch (loyaltyErr) {
            console.error('[RefundService] Loyalty point adjustment error:', loyaltyErr.message);
        }
    }

    // Update return request status and details
    returnRequest.refundStatus = 'processed';
    returnRequest.refundDetails = {
        gatewayRefundId: result.gatewayRefundId,
        gatewayRrn: result.gatewayRrn,
        refundSpeed: result.refundSpeed || 'normal',
        walletTransactionId: result.walletTransactionId,
        processedAt: new Date(),
        destination: result.destination,
        amount,
    };
    await returnRequest.save();

    // Notify Customer
    if (userId) {
        await createNotification({
            recipientId: userId,
            recipientType: 'user',
            title: 'Return Refund Completed',
            message: `Refund of ₹${amount.toFixed(2)} for return request on order ${order.orderId} has been successfully processed to ${result.destination}.`,
            type: 'order',
            data: {
                returnRequestId: String(returnRequest._id),
                orderId: String(order.orderId || order._id),
                amount,
                destination: result.destination,
            },
        }).catch((err) => console.error('[RefundService] Notification error:', err.message));
    }

    return result;
};
