import mongoose from 'mongoose';
import { User } from '../models/User.model.js';
import Order from '../models/Order.model.js';
import ApiError from '../utils/ApiError.js';

/**
 * B2B employee spending limits (set by the company admin, 0 = no limit):
 *   - b2bPerOrderSpendingLimit : maximum total of a single order
 *   - b2bSpendingLimit         : maximum total of all orders in a calendar month (India time)
 *     (this field was always labelled "Monthly Spending Limit" in the admin UI)
 * Both apply to the full order total, whatever the payment method (wallet, card, COD...).
 *
 * Counted toward the month: the employee's orders created this month that are not cancelled /
 * returned and whose payment has not failed / been refunded (an unpaid online order still counts
 * until it is cancelled, so the money can't be committed twice).
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const EXCLUDED_ORDER_STATUSES = ['cancelled', 'returned'];
export const EXCLUDED_PAYMENT_STATUSES = ['failed', 'refunded'];

/** Start of the current calendar month and of the next one, in India time, as UTC Dates. */
export const monthWindowIST = (now = new Date()) => {
    const ist = new Date(now.getTime() + IST_OFFSET_MS);
    const y = ist.getUTCFullYear();
    const m = ist.getUTCMonth();
    return {
        start: new Date(Date.UTC(y, m, 1) - IST_OFFSET_MS),
        end: new Date(Date.UTC(y, m + 1, 1) - IST_OFFSET_MS),
    };
};

export const getMonthSpend = async (userId, { session, now } = {}) => {
    const { start, end } = monthWindowIST(now);
    const agg = Order.aggregate([
        {
            $match: {
                userId: new mongoose.Types.ObjectId(String(userId)),
                createdAt: { $gte: start, $lt: end },
                status: { $nin: EXCLUDED_ORDER_STATUSES },
                paymentStatus: { $nin: EXCLUDED_PAYMENT_STATUSES },
                isDeleted: { $ne: true },
            },
        },
        { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
    ]);
    if (session) agg.session(session);
    const [row] = await agg;
    return { spent: round2(row?.total), orders: row?.count || 0, periodStart: start, periodEnd: end };
};

const limitsOf = (user) => ({
    perOrderLimit: Math.max(0, Number(user?.b2bPerOrderSpendingLimit) || 0),
    monthlyLimit: Math.max(0, Number(user?.b2bSpendingLimit) || 0),
});

/** Limits + this month's usage for one employee (for dashboards / checkout hints). */
export const getSpendingSummary = async (userOrId, { session } = {}) => {
    const user = typeof userOrId === 'object' && userOrId?._id
        ? userOrId
        : await User.findById(userOrId).select('role b2bSpendingLimit b2bPerOrderSpendingLimit').lean();
    if (!user) return null;
    const { perOrderLimit, monthlyLimit } = limitsOf(user);
    const usage = await getMonthSpend(user._id, { session });
    return {
        appliesTo: user.role === 'b2bEmployee',
        perOrderLimit,
        monthlyLimit,
        spentThisMonth: usage.spent,
        ordersThisMonth: usage.orders,
        remainingThisMonth: monthlyLimit > 0 ? round2(Math.max(0, monthlyLimit - usage.spent)) : null,
        periodStart: usage.periodStart,
        periodEnd: usage.periodEnd,
    };
};

const inr = (n) => `₹${round2(n).toLocaleString('en-IN')}`;

/**
 * Throw a 400 if `amount` would break the employee's per-order or monthly limit.
 * Call it INSIDE the order transaction (pass the session): it first writes to the employee's
 * user document, so two orders placed at the same moment conflict and one is retried against
 * the updated monthly total instead of both slipping under the limit.
 * Non-employees are ignored (returns null).
 */
export const assertWithinSpendingLimits = async ({ userId, role, amount, session }) => {
    if (role !== 'b2bEmployee' || !userId) return null;
    const user = await User.findOneAndUpdate(
        { _id: userId },
        { $set: { b2bSpendCheckedAt: new Date() } },
        { new: true, session, projection: { role: 1, b2bSpendingLimit: 1, b2bPerOrderSpendingLimit: 1 } }
    );
    if (!user) throw new ApiError(404, 'Employee account not found.');
    const { perOrderLimit, monthlyLimit } = limitsOf(user);
    const orderTotal = round2(amount);

    if (perOrderLimit > 0 && orderTotal > perOrderLimit) {
        throw new ApiError(400, `This order (${inr(orderTotal)}) is above your per-order spending limit of ${inr(perOrderLimit)}. Reduce the order or ask your company admin to raise the limit.`);
    }
    if (monthlyLimit > 0) {
        const { spent } = await getMonthSpend(user._id, { session });
        if (round2(spent + orderTotal) > monthlyLimit) {
            const remaining = round2(Math.max(0, monthlyLimit - spent));
            throw new ApiError(400, `This order (${inr(orderTotal)}) would exceed your monthly spending limit of ${inr(monthlyLimit)}. You have ${inr(remaining)} left this month. Ask your company admin to raise the limit.`);
        }
    }
    return { perOrderLimit, monthlyLimit };
};

/** Validate a limit value coming from the admin UI. Returns a number >= 0. */
export const parseLimitInput = (value, label) => {
    if (value === undefined) return undefined;
    if (value === null || value === '') return 0;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) throw new ApiError(400, `${label} must be a positive amount (0 = no limit).`);
    if (n > 1e9) throw new ApiError(400, `${label} is too large.`);
    return round2(n);
};
