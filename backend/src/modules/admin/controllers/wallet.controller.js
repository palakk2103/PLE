import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Wallet from '../../../models/Wallet.model.js';
import WalletTransaction from '../../../models/WalletTransaction.model.js';
import User from '../../../models/User.model.js';
import ReturnRequest from '../../../models/ReturnRequest.model.js';
import Settings from '../../../models/Settings.model.js';
import * as walletService from '../../../services/wallet.service.js';

// GET /api/admin/wallet/dashboard
export const getWalletDashboard = asyncHandler(async (req, res) => {
    // 1. Calculate aggregate wallet totals
    const aggregates = await Wallet.aggregate([
        {
            $group: {
                _id: null,
                totalBalance: { $sum: '$balance' },
                totalCredits: { $sum: '$totalCredit' },
                totalDebits: { $sum: '$totalDebit' }
            }
        }
    ]);

    const stats = aggregates[0] || { totalBalance: 0, totalCredits: 0, totalDebits: 0 };

    // 2. Count pending/completed refund requests
    const [pendingRefunds, completedRefunds] = await Promise.all([
        ReturnRequest.countDocuments({ refundStatus: 'pending' }),
        ReturnRequest.countDocuments({ refundStatus: 'processed' })
    ]);

    res.status(200).json(new ApiResponse(200, {
        totalWalletBalance: stats.totalBalance,
        totalCredits: stats.totalCredits,
        totalDebits: stats.totalDebits,
        pendingRefunds,
        completedRefunds
    }, 'Wallet dashboard statistics fetched successfully.'));
});

// GET /api/admin/wallet/users
export const searchWalletUsers = asyncHandler(async (req, res) => {
    const { search = '', page = 1, limit = 10 } = req.query;
    const numericPage = Number(page) || 1;
    const numericLimit = Number(limit) || 10;

    const filter = {};
    if (search) {
        const regex = new RegExp(search, 'i');
        filter.$or = [
            { name: regex },
            { email: regex },
            { phone: regex }
        ];
    }

    // Get matching users
    const users = await User.find(filter)
        .select('name email phone role')
        .skip((numericPage - 1) * numericLimit)
        .limit(numericLimit)
        .lean();

    const total = await User.countDocuments(filter);

    // Enrich users with wallet balances
    const enrichedUsers = await Promise.all(users.map(async (user) => {
        const wallet = await walletService.getOrCreateWallet(user._id);
        return {
            ...user,
            wallet: {
                balance: wallet.balance,
                totalCredit: wallet.totalCredit,
                totalDebit: wallet.totalDebit,
                isFrozen: wallet.isFrozen
            }
        };
    }));

    res.status(200).json(new ApiResponse(200, {
        users: enrichedUsers,
        pagination: {
            total,
            page: numericPage,
            limit: numericLimit,
            pages: Math.ceil(total / numericLimit)
        }
    }, 'Wallet users list fetched successfully.'));
});

// GET /api/admin/wallet/users/:userId
export const getUserWallet = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const user = await User.findById(userId).select('name email phone role');
    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    const summary = await walletService.getWalletSummary(userId);

    res.status(200).json(new ApiResponse(200, {
        user,
        wallet: summary
    }, 'User wallet fetched successfully.'));
});

// GET /api/admin/wallet/users/:userId/transactions
export const getUserTransactions = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const data = await walletService.getTransactionHistory(userId, { page, limit });
    res.status(200).json(new ApiResponse(200, data, 'User wallet transactions fetched successfully.'));
});

// POST /api/admin/wallet/users/:userId/credit
export const creditUserWallet = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { amount, reason } = req.body;

    if (!amount || amount <= 0) {
        throw new ApiError(400, 'Invalid amount for admin credit.');
    }

    const { wallet, transaction } = await walletService.creditWallet({
        userId,
        amount,
        category: 'admin_credit',
        description: reason || 'Adjustment credit from admin panel',
        idempotencyKey: `admin_credit_${userId}_${Date.now()}`
    });

    res.status(200).json(new ApiResponse(200, { wallet, transaction }, 'Wallet credited successfully by admin.'));
});

// POST /api/admin/wallet/users/:userId/debit
export const debitUserWallet = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { amount, reason } = req.body;

    if (!amount || amount <= 0) {
        throw new ApiError(400, 'Invalid amount for admin debit.');
    }

    const { wallet, transaction } = await walletService.debitWallet({
        userId,
        amount,
        category: 'admin_debit',
        description: reason || 'Adjustment debit from admin panel'
    });

    res.status(200).json(new ApiResponse(200, { wallet, transaction }, 'Wallet debited successfully by admin.'));
});

// POST /api/admin/wallet/users/:userId/freeze
export const freezeUserWallet = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const wallet = await walletService.freezeWallet(userId, req.user.id);
    res.status(200).json(new ApiResponse(200, wallet, 'Wallet frozen successfully.'));
});

// POST /api/admin/wallet/users/:userId/unfreeze
export const unfreezeUserWallet = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const wallet = await walletService.unfreezeWallet(userId);
    res.status(200).json(new ApiResponse(200, wallet, 'Wallet unfrozen successfully.'));
});

// GET /api/admin/wallet/settings
export const getWalletSettings = asyncHandler(async (req, res) => {
    const setting = await Settings.findOne({ key: 'wallet_settings' });
    const settings = setting ? setting.value : {
        minRecharge: 100,
        maxRecharge: 50000,
        maxBalance: 100000,
        cashbackPercent: 0,
        refundPolicy: 'Refund will be processed back to the wallet.'
    };
    res.status(200).json(new ApiResponse(200, settings, 'Wallet settings fetched successfully.'));
});

// PUT /api/admin/wallet/settings
export const updateWalletSettings = asyncHandler(async (req, res) => {
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
});

