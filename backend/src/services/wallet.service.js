import Wallet from '../models/Wallet.model.js';
import WalletTransaction from '../models/WalletTransaction.model.js';
import User from '../models/User.model.js';
import ApiError from '../utils/ApiError.js';
import mongoose from 'mongoose';

/**
 * Get or create a wallet for a user
 */
export const getOrCreateWallet = async (userId, session = null) => {
    let wallet = await Wallet.findOne({ userId }).session(session);
    if (!wallet) {
        wallet = await Wallet.create([{ userId, balance: 0, totalCredit: 0, totalDebit: 0, isFrozen: false }], { session });
        wallet = wallet[0];
    }
    return wallet;
};

/**
 * Credit funds to a user's wallet with session safety and optional idempotency
 */
export const creditWallet = async ({
    userId,
    amount,
    category,
    description,
    orderId = null,
    returnRequestId = null,
    idempotencyKey = null,
    session = null
}) => {
    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new ApiError(400, 'Invalid amount for wallet credit.');
    }

    try {
        const localSession = session || (await mongoose.startSession());
        let isLocalTransaction = !session;

        try {
            if (isLocalTransaction) {
                localSession.startTransaction();
            }

            // 1. Check idempotency first if key provided
            if (idempotencyKey) {
                const existingTx = await WalletTransaction.findOne({ idempotencyKey }).session(localSession);
                if (existingTx) {
                    const wallet = await getOrCreateWallet(userId, localSession);
                    if (isLocalTransaction) await localSession.commitTransaction();
                    return { wallet, transaction: existingTx, alreadyProcessed: true };
                }
            }

            // 2. Fetch/Create wallet
            const wallet = await getOrCreateWallet(userId, localSession);

            // 3. Update wallet totals and balance
            wallet.balance = parseFloat((wallet.balance + parsedAmount).toFixed(2));
            wallet.totalCredit = parseFloat((wallet.totalCredit + parsedAmount).toFixed(2));
            await wallet.save({ session: localSession });

            // 4. Record Transaction
            const [transaction] = await WalletTransaction.create([{
                walletId: wallet._id,
                userId,
                amount: parsedAmount,
                type: 'credit',
                transactionCategory: category,
                balanceAfterTransaction: wallet.balance,
                orderId,
                returnRequestId,
                idempotencyKey,
                description,
                status: 'completed'
            }], { session: localSession });

            if (isLocalTransaction) {
                await localSession.commitTransaction();
            }

            return { wallet, transaction, alreadyProcessed: false };

        } catch (error) {
            if (isLocalTransaction) {
                await localSession.abortTransaction();
            }
            throw error;
        } finally {
            if (isLocalTransaction) {
                await localSession.endSession();
            }
        }
    } catch (err) {
        // Fallback for standalone MongoDB connections without replica sets
        if (err.message?.includes('Transaction numbers') || err.code === 20 || err.message?.includes('replica set')) {
            if (idempotencyKey) {
                const existingTx = await WalletTransaction.findOne({ idempotencyKey });
                if (existingTx) {
                    const wallet = await getOrCreateWallet(userId);
                    return { wallet, transaction: existingTx, alreadyProcessed: true };
                }
            }

            const wallet = await getOrCreateWallet(userId);
            wallet.balance = parseFloat((wallet.balance + parsedAmount).toFixed(2));
            wallet.totalCredit = parseFloat((wallet.totalCredit + parsedAmount).toFixed(2));
            await wallet.save();

            const [transaction] = await WalletTransaction.create([{
                walletId: wallet._id,
                userId,
                amount: parsedAmount,
                type: 'credit',
                transactionCategory: category,
                balanceAfterTransaction: wallet.balance,
                orderId,
                returnRequestId,
                idempotencyKey,
                description,
                status: 'completed'
            }]);

            return { wallet, transaction, alreadyProcessed: false };
        }
        throw err;
    }
};

/**
 * Credit a user's wallet, keeping B2B employee balances consistent.
 *
 * B2B employees spend from `User.b2bWalletBalance`; the Wallet document only
 * mirrors it for the ledger. For employees this restores b2bWalletBalance and
 * aligns the Wallet balance first, so the ledger's balanceAfterTransaction
 * matches the real balance. Idempotent replays do not double-credit.
 * Other roles behave exactly like creditWallet.
 */
export const creditUserWallet = async (params) => {
    const { userId, amount, idempotencyKey = null } = params;
    const parsedAmount = Number(amount);

    const user = await User.findById(userId).select('role b2bWalletBalance');
    if (!user || user.role !== 'b2bEmployee' || isNaN(parsedAmount) || parsedAmount <= 0) {
        return creditWallet(params);
    }

    if (idempotencyKey && await WalletTransaction.exists({ idempotencyKey })) {
        return creditWallet(params);
    }

    const previousBalance = Number(user.b2bWalletBalance || 0);
    user.b2bWalletBalance = parseFloat((previousBalance + parsedAmount).toFixed(2));
    await user.save();

    // Align the mirrored Wallet to the pre-credit balance; creditWallet then adds the amount.
    const wallet = await getOrCreateWallet(userId);
    wallet.balance = previousBalance;
    await wallet.save();

    return creditWallet(params);
};

/**
 * Debit funds from a user's wallet with session safety
 */
export const debitWallet = async ({
    userId,
    amount,
    category,
    description,
    orderId = null,
    session = null
}) => {
    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new ApiError(400, 'Invalid amount for wallet debit.');
    }

    try {
        const localSession = session || (await mongoose.startSession());
        let isLocalTransaction = !session;

        try {
            if (isLocalTransaction) {
                localSession.startTransaction();
            }

            const wallet = await getOrCreateWallet(userId, localSession);

            if (wallet.isFrozen) {
                throw new ApiError(400, 'Wallet is frozen. Cannot perform debit transactions.');
            }

            if (wallet.balance < parsedAmount) {
                throw new ApiError(400, 'Insufficient wallet balance.');
            }

            // Update totals
            wallet.balance = parseFloat((wallet.balance - parsedAmount).toFixed(2));
            wallet.totalDebit = parseFloat((wallet.totalDebit + parsedAmount).toFixed(2));
            await wallet.save({ session: localSession });

            // Create Debit Transaction
            const [transaction] = await WalletTransaction.create([{
                walletId: wallet._id,
                userId,
                amount: parsedAmount,
                type: 'debit',
                transactionCategory: category,
                balanceAfterTransaction: wallet.balance,
                orderId,
                description,
                status: 'completed'
            }], { session: localSession });

            if (isLocalTransaction) {
                await localSession.commitTransaction();
            }

            return { wallet, transaction };

        } catch (error) {
            if (isLocalTransaction) {
                await localSession.abortTransaction();
            }
            throw error;
        } finally {
            if (isLocalTransaction) {
                await localSession.endSession();
            }
        }
    } catch (err) {
        // Fallback for standalone MongoDB connections without replica sets
        if (err.message?.includes('Transaction numbers') || err.code === 20 || err.message?.includes('replica set')) {
            const wallet = await getOrCreateWallet(userId);

            if (wallet.isFrozen) {
                throw new ApiError(400, 'Wallet is frozen. Cannot perform debit transactions.');
            }

            if (wallet.balance < parsedAmount) {
                throw new ApiError(400, 'Insufficient wallet balance.');
            }

            wallet.balance = parseFloat((wallet.balance - parsedAmount).toFixed(2));
            wallet.totalDebit = parseFloat((wallet.totalDebit + parsedAmount).toFixed(2));
            await wallet.save();

            const [transaction] = await WalletTransaction.create([{
                walletId: wallet._id,
                userId,
                amount: parsedAmount,
                type: 'debit',
                transactionCategory: category,
                balanceAfterTransaction: wallet.balance,
                orderId,
                description,
                status: 'completed'
            }]);

            return { wallet, transaction };
        }
        throw err;
    }
};

/**
 * Fetch wallet and latest transactions with filters and pagination
 */
export const getWalletSummary = async (userId) => {
    const wallet = await getOrCreateWallet(userId);
    return {
        balance: wallet.balance,
        totalCredit: wallet.totalCredit,
        totalDebit: wallet.totalDebit,
        isFrozen: wallet.isFrozen,
        currency: wallet.currency
    };
};

export const getTransactionHistory = async (userId, { page = 1, limit = 10, category = null } = {}) => {
    const query = { userId };
    if (category && category !== 'all') {
        if (category === 'refunds') {
            query.transactionCategory = 'refund';
        } else {
            query.transactionCategory = category;
        }
    }

    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
        WalletTransaction.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        WalletTransaction.countDocuments(query)
    ]);

    return {
        transactions: transactions.map(tx => ({
            ...tx,
            id: tx._id
        })),
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit)
        }
    };
};

/**
 * Freeze a user's wallet
 */
export const freezeWallet = async (userId, adminId) => {
    const wallet = await getOrCreateWallet(userId);
    wallet.isFrozen = true;
    wallet.frozenAt = new Date();
    wallet.frozenBy = adminId;
    await wallet.save();
    return wallet;
};

/**
 * Unfreeze a user's wallet
 */
export const unfreezeWallet = async (userId) => {
    const wallet = await getOrCreateWallet(userId);
    wallet.isFrozen = false;
    wallet.frozenAt = undefined;
    wallet.frozenBy = undefined;
    await wallet.save();
    return wallet;
};
