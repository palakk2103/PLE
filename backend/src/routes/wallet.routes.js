import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize, enforceAccountStatus } from '../middlewares/authorize.js';
import * as walletService from '../services/wallet.service.js';
import Settings from '../models/Settings.model.js';
import Wallet from '../models/Wallet.model.js';
import WalletTransaction from '../models/WalletTransaction.model.js';
import User from '../models/User.model.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';

const router = Router();

const userAuth = [authenticate, authorize('b2bAdmin', 'b2bEmployee', 'customer'), enforceAccountStatus];
const adminAuth = [authenticate, authorize('admin', 'superadmin', 'account_team'), enforceAccountStatus];
const generalWalletAuth = [authenticate, authorize('admin', 'superadmin', 'account_team', 'b2bAdmin', 'b2bEmployee', 'customer'), enforceAccountStatus];

// Helper to get default or saved wallet settings
const getWalletSettingsHelper = async () => {
    const setting = await Settings.findOne({ key: 'wallet_settings' });
    return setting ? setting.value : {
        minRecharge: 100,
        maxRecharge: 50000,
        maxBalance: 100000,
        cashbackPercent: 0,
        refundPolicy: 'Refund will be processed back to the wallet.'
    };
};

// GET /wallet - Retrieve user wallet details
router.get('/', ...userAuth, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const summary = await walletService.getWalletSummary(userId);
    res.status(200).json(new ApiResponse(200, summary, 'Wallet details fetched successfully.'));
}));

// GET /wallet/history - Retrieve user wallet transactions
router.get('/history', ...userAuth, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const category = req.query.category || null;

    const data = await walletService.getTransactionHistory(userId, { page, limit, category });
    res.status(200).json(new ApiResponse(200, data, 'Wallet transactions fetched successfully.'));
}));

// POST /wallet/recharge - Create Razorpay order to add money
router.post('/recharge', ...userAuth, asyncHandler(async (req, res) => {
    const { amount } = req.body;
    const parsedAmount = Number(amount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new ApiError(400, 'Invalid recharge amount.');
    }

    const settings = await getWalletSettingsHelper();
    if (parsedAmount < settings.minRecharge) {
        throw new ApiError(400, `Minimum recharge amount is ₹${settings.minRecharge}.`);
    }
    if (parsedAmount > settings.maxRecharge) {
        throw new ApiError(400, `Maximum recharge amount is ₹${settings.maxRecharge}.`);
    }

    const wallet = await walletService.getOrCreateWallet(req.user.id);
    if (wallet.balance + parsedAmount > settings.maxBalance) {
        throw new ApiError(400, `Recharge exceeds maximum wallet balance limit of ₹${settings.maxBalance}.`);
    }

    try {
        let razorpayInstance;
        if (typeof Razorpay === 'function') {
            razorpayInstance = new Razorpay({
                key_id: process.env.RAZORPAY_KEY_ID,
                key_secret: process.env.RAZORPAY_KEY_SECRET,
            });
        } else if (Razorpay && typeof Razorpay.default === 'function') {
            razorpayInstance = new Razorpay.default({
                key_id: process.env.RAZORPAY_KEY_ID,
                key_secret: process.env.RAZORPAY_KEY_SECRET,
            });
        } else {
            throw new Error('Razorpay constructor not found in imports.');
        }

        const rzpOrder = await razorpayInstance.orders.create({
            amount: Math.round(parsedAmount * 100), // in paise
            currency: 'INR',
            receipt: `rcpt_${req.user.id.toString().slice(-8)}_${Date.now().toString().slice(-8)}`
        });

        res.status(200).json(new ApiResponse(200, {
            id: rzpOrder.id,
            amount: rzpOrder.amount,
            currency: 'INR',
            key: process.env.RAZORPAY_KEY_ID
        }, 'Recharge order created.'));
    } catch (err) {
        console.error('Razorpay wallet recharge order creation failed:', err);
        const errMsg = err.message || (err.error && err.error.description) || JSON.stringify(err) || 'Unknown error';
        throw new ApiError(500, 'Failed to generate payment gateway order. ' + errMsg);
    }
}));

// POST /wallet/verify-payment - Verify payment and credit wallet
router.post('/verify-payment', ...userAuth, asyncHandler(async (req, res) => {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, amount } = req.body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !amount) {
        throw new ApiError(400, 'Missing payment verification parameters.');
    }

    // Verify signature
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generatedSignature = hmac.digest('hex');

    if (generatedSignature !== razorpay_signature) {
        throw new ApiError(400, 'Payment signature verification failed.');
    }

    const parsedAmount = Number(amount);
    const settings = await getWalletSettingsHelper();

    // Calculate cashback if any
    let cashbackAmount = 0;
    if (settings.cashbackPercent > 0) {
        cashbackAmount = parseFloat(((parsedAmount * settings.cashbackPercent) / 100).toFixed(2));
    }

    // Perform credit atomically
    const idempotencyKey = `recharge_${razorpay_payment_id}`;
    const { wallet, transaction } = await walletService.creditWallet({
        userId: req.user.id,
        amount: parsedAmount,
        category: 'recharge',
        description: `Recharged funds via Razorpay`,
        idempotencyKey
    });

    if (cashbackAmount > 0) {
        await walletService.creditWallet({
            userId: req.user.id,
            amount: cashbackAmount,
            category: 'cashback',
            description: `Earned ${settings.cashbackPercent}% cashback on recharge`,
            idempotencyKey: `cashback_${razorpay_payment_id}`
        });
    }

    res.status(200).json(new ApiResponse(200, { wallet, transaction }, 'Wallet recharge verified and credited successfully.'));
}));

// POST /wallet/pay - Deduct funds (full or partial payment)
router.post('/pay', ...userAuth, asyncHandler(async (req, res) => {
    const { amount, orderId } = req.body;
    const parsedAmount = Number(amount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new ApiError(400, 'Invalid payment amount.');
    }

    const { wallet, transaction } = await walletService.debitWallet({
        userId: req.user.id,
        amount: parsedAmount,
        category: 'order_payment',
        description: `Payment for order ${orderId || ''}`,
        orderId
    });

    res.status(200).json(new ApiResponse(200, { wallet, transaction }, 'Payment deducted from wallet successfully.'));
}));

// POST /wallet/refund - Credit refund back to wallet (used internally or by admin)
router.post('/refund', ...generalWalletAuth, asyncHandler(async (req, res) => {
    const { amount, orderId, reason } = req.body;
    const parsedAmount = Number(amount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new ApiError(400, 'Invalid refund amount.');
    }

    const { wallet, transaction } = await walletService.creditWallet({
        userId: req.user.id,
        amount: parsedAmount,
        category: 'refund',
        description: reason || `Refund for order ${orderId || ''}`,
        orderId
    });

    res.status(200).json(new ApiResponse(200, { wallet, transaction }, 'Refund credited to wallet successfully.'));
}));

// POST /wallet/admin-credit - Admin credit wallet
router.post('/admin-credit', ...adminAuth, asyncHandler(async (req, res) => {
    const { userId, amount, reason } = req.body;
    const parsedAmount = Number(amount);

    if (!userId || isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new ApiError(400, 'Invalid input parameters.');
    }

    const { wallet, transaction } = await walletService.creditWallet({
        userId,
        amount: parsedAmount,
        category: 'admin_credit',
        description: reason || 'Adjustment credit from admin panel',
        idempotencyKey: `admin_credit_${userId}_${Date.now()}`
    });

    res.status(200).json(new ApiResponse(200, { wallet, transaction }, 'Wallet credited successfully by admin.'));
}));

// POST /wallet/admin-debit - Admin debit wallet
router.post('/admin-debit', ...adminAuth, asyncHandler(async (req, res) => {
    const { userId, amount, reason } = req.body;
    const parsedAmount = Number(amount);

    if (!userId || isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new ApiError(400, 'Invalid input parameters.');
    }

    const { wallet, transaction } = await walletService.debitWallet({
        userId,
        amount: parsedAmount,
        category: 'admin_debit',
        description: reason || 'Adjustment debit from admin panel'
    });

    res.status(200).json(new ApiResponse(200, { wallet, transaction }, 'Wallet debited successfully by admin.'));
}));

// POST /wallet/freeze - Freeze a user's wallet
router.post('/freeze', ...adminAuth, asyncHandler(async (req, res) => {
    const { userId } = req.body;
    if (!userId) {
        throw new ApiError(400, 'User ID is required.');
    }
    const wallet = await walletService.freezeWallet(userId, req.user.id);
    res.status(200).json(new ApiResponse(200, wallet, 'Wallet frozen successfully.'));
}));

// POST /wallet/unfreeze - Unfreeze a user's wallet
router.post('/unfreeze', ...adminAuth, asyncHandler(async (req, res) => {
    const { userId } = req.body;
    if (!userId) {
        throw new ApiError(400, 'User ID is required.');
    }
    const wallet = await walletService.unfreezeWallet(userId);
    res.status(200).json(new ApiResponse(200, wallet, 'Wallet unfrozen successfully.'));
}));

// GET /wallet/settings - Get settings
router.get('/settings', ...generalWalletAuth, asyncHandler(async (req, res) => {
    const settings = await getWalletSettingsHelper();
    res.status(200).json(new ApiResponse(200, settings, 'Wallet settings fetched successfully.'));
}));

// PUT /wallet/settings - Update settings (Admin only)
router.put('/settings', ...adminAuth, asyncHandler(async (req, res) => {
    const { minRecharge, maxRecharge, maxBalance, cashbackPercent, refundPolicy } = req.body;

    const value = {
        minRecharge: Number(minRecharge) || 100,
        maxRecharge: Number(maxRecharge) || 50000,
        maxBalance: Number(maxBalance) || 100000,
        cashbackPercent: Number(cashbackPercent) || 0,
        refundPolicy: refundPolicy || 'Refund will be processed back to the wallet.'
    };

    let setting = await Settings.findOne({ key: 'wallet_settings' });
    if (setting) {
        setting.value = value;
        await setting.save();
    } else {
        setting = await Settings.create({ key: 'wallet_settings', value });
    }

    res.status(200).json(new ApiResponse(200, setting.value, 'Wallet settings updated successfully.'));
}));

export default router;
