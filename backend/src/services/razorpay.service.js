import crypto from 'crypto';
import Razorpay from 'razorpay';
import ApiError from '../utils/ApiError.js';

// Razorpay's per-transaction ceiling (₹5,00,000) in rupees.
export const RAZORPAY_MAX_AMOUNT = 500000;

let clientOverride = null;

/** Tests only: replace the Razorpay client (pass null to restore the real one). */
export const __setRazorpayClientForTests = (client) => {
    clientOverride = client;
};

const getClient = () => clientOverride || new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * Create a Razorpay order for `amount` rupees.
 * Returns the payload the browser checkout needs: { id, amount (paise), currency, key }.
 */
export const createRazorpayOrder = async (amount, { receipt, notes } = {}) => {
    const rupees = Math.round(Number(amount) * 100) / 100;
    if (!(rupees > 0)) throw new ApiError(400, 'Nothing to pay for this order.');
    if (rupees > RAZORPAY_MAX_AMOUNT) {
        throw new ApiError(400, `Online payment limit exceeded: ₹${rupees.toLocaleString('en-IN')} is above Razorpay's ₹5,00,000 per-transaction limit. Please contact support to split this order.`);
    }
    try {
        const rzpOrder = await getClient().orders.create({
            amount: Math.round(rupees * 100),
            currency: 'INR',
            receipt: String(receipt || `rcpt_${Date.now()}`).slice(0, 40),
            ...(notes ? { notes } : {}),
        });
        return { id: rzpOrder.id, amount: rzpOrder.amount, currency: rzpOrder.currency || 'INR', key: process.env.RAZORPAY_KEY_ID };
    } catch (err) {
        const desc = err?.error?.description || err?.message || 'unknown error';
        console.error('Razorpay order creation failed:', desc);
        throw new ApiError(502, `Could not start online payment: ${desc}`);
    }
};

/** Constant-time check of Razorpay's checkout signature. */
export const isValidRazorpaySignature = (razorpayOrderId, razorpayPaymentId, signature) => {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret || !razorpayOrderId || !razorpayPaymentId || !signature) return false;
    const expected = crypto.createHmac('sha256', secret).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(String(signature));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/** Fetch payment info (method / card / bank). Never throws; returns null on failure. */
export const fetchRazorpayPayment = async (paymentId) => {
    try {
        return await getClient().payments.fetch(paymentId);
    } catch (err) {
        console.error('Failed to fetch payment details from Razorpay:', err?.message || err);
        return null;
    }
};
