// Releases stock held by online orders that were never paid.
// Stock is reserved when the order is placed, before the buyer pays. If they close the payment window,
// nothing else ever gives it back.
import mongoose from 'mongoose';
import Order from '../models/Order.model.js';
import Coupon from '../models/Coupon.model.js';
import User from '../models/User.model.js';
import { fetchRazorpayOrder } from './razorpay.service.js';
import { processOrderCancellationRefund } from './refund.service.js';
import { handleOrderStatusTransition } from './orderStatus.service.js';
import { cancelOrderInSession } from '../modules/user/controllers/order.controller.js';

const RUN_EVERY_MS = 5 * 60 * 1000;
// Orders older than this are left for a person to review, so that switching the job on
// does not rewrite months of order history in one go.
const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 50;
const REASON = 'Online payment was not completed in time';

export const getAbandonedTimeoutMinutes = () => {
    const raw = process.env.ABANDONED_PAYMENT_TIMEOUT_MINUTES;
    const value = raw === undefined || raw === '' ? 30 : Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : 30;
};

const unpaidFilter = {
    status: 'pending',
    paymentStatus: { $in: ['pending', 'failed'] },
    paymentMethod: { $in: ['card', 'mixed'] },
    // Source Now orders have their own retry flow.
    orderType: { $ne: 'product_request' },
};

const releaseOne = async (candidate) => {
    // Never release on guesswork: ask the gateway. If it cannot be reached, try again next run.
    const gatewayOrder = await fetchRazorpayOrder(candidate.paymentDetails.razorpayOrderId);
    if (gatewayOrder?.status === 'paid' || Number(gatewayOrder?.amount_paid || 0) > 0) {
        console.warn(`[AbandonedPayment] Order ${candidate.orderId} has money at the gateway but is not marked paid. Not released; please review.`);
        return false;
    }

    const session = await mongoose.startSession();
    let released = false;
    try {
        await session.withTransaction(async () => {
            released = false;
            const order = await Order.findOne({ _id: candidate._id, ...unpaidFilter }).session(session);
            if (!order) return; // paid or cancelled in the meantime
            const buyer = order.userId ? await User.findById(order.userId).select('role').session(session) : null;
            await cancelOrderInSession(order, { reason: REASON, userId: order.userId, role: buyer?.role, session });
            if (order.couponCode) {
                await Coupon.updateOne({ code: order.couponCode, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } }, { session });
            }
            released = true;
        });
    } finally {
        await session.endSession();
    }
    if (!released) return false;

    const order = await Order.findById(candidate._id);
    try {
        await handleOrderStatusTransition(order, 'cancelled', { updatedByRole: 'system', note: REASON, notifyCustomer: true });
    } catch (err) {
        console.error(`[AbandonedPayment] Status update failed for ${order.orderId}:`, err.message);
    }
    // Any wallet money used towards the order goes back.
    await processOrderCancellationRefund(order, { reason: REASON, triggeredByRole: 'system' });
    return true;
};

export const releaseAbandonedPayments = async ({ now = new Date(), timeoutMinutes = getAbandonedTimeoutMinutes() } = {}) => {
    if (!timeoutMinutes) return { checked: 0, released: 0 };
    const candidates = await Order.find({
        ...unpaidFilter,
        'paymentDetails.razorpayOrderId': { $exists: true, $ne: null },
        // updatedAt, so a buyer who has just started a payment retry gets the full time again
        updatedAt: { $lte: new Date(now.getTime() - timeoutMinutes * 60 * 1000) },
        createdAt: { $gte: new Date(now.getTime() - LOOKBACK_MS) },
    }).select('_id orderId paymentDetails').limit(BATCH_SIZE);

    let released = 0;
    for (const candidate of candidates) {
        try {
            if (await releaseOne(candidate)) released++;
        } catch (err) {
            console.error(`[AbandonedPayment] Could not release ${candidate.orderId}:`, err.message);
        }
    }
    if (released) console.log(`[AbandonedPayment] Released ${released} unpaid order(s).`);
    return { checked: candidates.length, released };
};

export const startAbandonedPaymentService = () => {
    let running = false;
    const run = async () => {
        if (running) return;
        running = true;
        try {
            await releaseAbandonedPayments();
        } catch (err) {
            console.error('[AbandonedPayment] Run failed:', err.message);
        } finally {
            running = false;
        }
    };
    setInterval(run, RUN_EVERY_MS).unref();
    run();
};
