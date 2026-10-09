import mongoose from 'mongoose';
import VendorWallet from '../models/VendorWallet.model.js';
import VendorTransaction from '../models/VendorTransaction.model.js';
import WithdrawalRequest from '../models/WithdrawalRequest.model.js';
import Commission from '../models/Commission.model.js';
import Settlement from '../models/Settlement.model.js';
import Vendor from '../models/Vendor.model.js';
import Settings from '../models/Settings.model.js';
import ReturnRequest from '../models/ReturnRequest.model.js';
import { createNotification } from './notification.service.js';
import { logActivity } from './auditLog.service.js';
import ApiError from '../utils/ApiError.js';

const SETTINGS_KEY = 'vendor_payout_settings';
const DEFAULT_PAYOUT_SETTINGS = {
    clearanceDays: 7,
    minWithdrawalAmount: 500,
    maxWithdrawalAmount: 1000000,
    payoutNotice: 'Manual payouts are processed by admin via bank transfer (NEFT/IMPS/UPI) within 2-3 business days after approval.',
    allowMultiplePendingWithdrawals: false,
};

/**
 * Helper to mask sensitive bank account numbers (e.g. "XXXXXXXX1234")
 */
export const maskAccountNumber = (accNum) => {
    if (!accNum || typeof accNum !== 'string') return '';
    const clean = accNum.trim();
    if (clean.length <= 4) return clean;
    return `${'X'.repeat(Math.max(0, clean.length - 4))}${clean.slice(-4)}`;
};

/**
 * Fetch admin-configurable payout settings with fallbacks
 */
export const getPayoutSettings = async () => {
    try {
        const doc = await Settings.findOne({ key: SETTINGS_KEY });
        if (!doc || !doc.value) {
            return { ...DEFAULT_PAYOUT_SETTINGS };
        }
        return {
            ...DEFAULT_PAYOUT_SETTINGS,
            ...doc.value,
        };
    } catch (err) {
        console.error('[VendorWallet] Error fetching payout settings:', err.message);
        return { ...DEFAULT_PAYOUT_SETTINGS };
    }
};

/**
 * Update admin-configurable payout settings
 */
export const updatePayoutSettings = async (newSettings, adminId) => {
    const current = await getPayoutSettings();
    const updated = {
        ...current,
        clearanceDays: Math.max(0, Number(newSettings.clearanceDays ?? current.clearanceDays)),
        minWithdrawalAmount: Math.max(1, Number(newSettings.minWithdrawalAmount ?? current.minWithdrawalAmount)),
        maxWithdrawalAmount: Math.max(100, Number(newSettings.maxWithdrawalAmount ?? current.maxWithdrawalAmount)),
        payoutNotice: typeof newSettings.payoutNotice === 'string' ? newSettings.payoutNotice : current.payoutNotice,
        allowMultiplePendingWithdrawals: Boolean(newSettings.allowMultiplePendingWithdrawals ?? current.allowMultiplePendingWithdrawals),
    };

    const doc = await Settings.findOneAndUpdate(
        { key: SETTINGS_KEY },
        { key: SETTINGS_KEY, value: updated },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (adminId) {
        await logActivity({
            actor: { _id: adminId, role: 'admin' },
            action: 'PAYOUT_SETTINGS_UPDATED',
            module: 'FINANCE',
            entityType: 'Settings',
            entityId: doc._id?.toString(),
            description: `Admin updated vendor payout settings (Clearance: ${updated.clearanceDays}d, Min: ₹${updated.minWithdrawalAmount})`,
            metadata: updated,
        });
    }

    return updated;
};

/**
 * Get or initialize a VendorWallet doc
 */
export const getOrCreateVendorWallet = async (vendorId, session = null) => {
    let query = VendorWallet.findOne({ vendorId });
    if (session) query = query.session(session);
    let wallet = await query;

    if (!wallet) {
        try {
            wallet = await VendorWallet.create(
                [{ vendorId, totalEarnings: 0, onHold: 0, available: 0, reserved: 0, withdrawn: 0, totalCommission: 0, totalDeductions: 0 }],
                { session }
            );
            wallet = wallet[0];
        } catch (err) {
            // In case of duplicate key race condition
            let retryQuery = VendorWallet.findOne({ vendorId });
            if (session) retryQuery = retryQuery.session(session);
            wallet = await retryQuery;
            if (!wallet) throw err;
        }
    }
    return wallet;
};

/**
 * Record seller earnings when an order transitions to 'delivered'
 * Places seller earnings into 'onHold' during the clearance window.
 */
export const recordDeliveredEarnings = async (order, options = {}) => {
    if (!order || !order._id) return;
    const now = new Date();

    // Find commission docs created for this order that have not yet been marked delivered
    const commissions = await Commission.find({
        orderId: order._id,
        clearanceStatus: 'pending_delivery',
        status: { $ne: 'cancelled' },
        isHistorical: { $ne: true },
    });

    if (!commissions.length) {
        return;
    }

    for (const comm of commissions) {
        const vendorId = comm.vendorId;
        const vendorEarnings = Number(comm.vendorEarnings || 0);
        const commissionAmount = Number(comm.commission || 0);

        if (vendorEarnings <= 0) continue;

        // Atomically update wallet: increase totalEarnings, onHold, totalCommission
        const updatedWallet = await VendorWallet.findOneAndUpdate(
            { vendorId },
            {
                $inc: {
                    totalEarnings: vendorEarnings,
                    onHold: vendorEarnings,
                    totalCommission: commissionAmount,
                },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Update commission record with deliveredAt and clearanceStatus = 'on_hold'
        comm.deliveredAt = now;
        comm.clearanceStatus = 'on_hold';
        await comm.save();

        // Record audit ledger entry
        await VendorTransaction.create({
            vendorId,
            type: 'EARNING_ON_HOLD',
            amount: vendorEarnings,
            balanceSnapshot: {
                onHold: updatedWallet.onHold,
                available: updatedWallet.available,
                reserved: updatedWallet.reserved,
                withdrawn: updatedWallet.withdrawn,
            },
            referenceType: 'order',
            referenceId: order._id,
            referenceNumber: order.orderId || String(order._id),
            description: `Order #${order.orderId || order._id} delivered. Earnings placed On Hold during return window.`,
            status: 'completed',
            metadata: {
                commissionId: comm._id,
                subtotal: comm.subtotal,
                commissionRate: comm.commissionRate,
                commission: commissionAmount,
            },
        });

        // Notify seller
        try {
            await createNotification({
                recipientId: vendorId,
                recipientType: 'vendor',
                title: 'Order Delivered — Earnings On Hold',
                message: `Order #${order.orderId || order._id} has been delivered. Earnings of ₹${vendorEarnings.toFixed(2)} are placed On Hold during the clearance period.`,
                type: 'finance',
                data: { orderId: order._id, amount: vendorEarnings },
            });
        } catch (notifErr) {
            console.error('[VendorWallet] Notification error:', notifErr.message);
        }
    }
};

/**
 * Checks and clears eligible earnings from onHold to available.
 * Can be run on-demand for a single vendor, or across all vendors.
 */
export const runClearanceCheck = async (targetVendorId = null) => {
    const settings = await getPayoutSettings();
    const clearanceDays = Number(settings.clearanceDays ?? 7);
    const thresholdDate = new Date(Date.now() - clearanceDays * 24 * 60 * 60 * 1000);

    const matchQuery = {
        clearanceStatus: 'on_hold',
        status: { $ne: 'cancelled' },
        isHistorical: { $ne: true },
        deliveredAt: { $exists: true, $lte: thresholdDate },
    };

    if (targetVendorId) {
        matchQuery.vendorId = targetVendorId;
    }

    const eligibleCommissions = await Commission.find(matchQuery);
    if (!eligibleCommissions.length) return 0;

    let clearedCount = 0;

    for (const comm of eligibleCommissions) {
        // Verify no active non-rejected return request for this order & vendor
        const activeReturn = await ReturnRequest.findOne({
            orderId: comm.orderId,
            vendorId: comm.vendorId,
            status: { $nin: ['rejected', 'claim_rejected'] },
        });

        if (activeReturn) {
            // Keep on hold while return is being investigated
            continue;
        }

        const vendorEarnings = Number(comm.vendorEarnings || 0);
        if (vendorEarnings <= 0) continue;

        // Atomically move from onHold to available
        // Guarantee onHold doesn't drop below 0
        const updatedWallet = await VendorWallet.findOneAndUpdate(
            { vendorId: comm.vendorId, onHold: { $gte: vendorEarnings } },
            {
                $inc: {
                    onHold: -vendorEarnings,
                    available: vendorEarnings,
                },
            },
            { new: true }
        );

        if (!updatedWallet) {
            // In case onHold was slightly less due to previous partial deduction
            const currentWallet = await getOrCreateVendorWallet(comm.vendorId);
            const actualDeduct = Math.min(currentWallet.onHold, vendorEarnings);
            const fallbackWallet = await VendorWallet.findOneAndUpdate(
                { vendorId: comm.vendorId },
                {
                    $inc: {
                        onHold: -actualDeduct,
                        available: vendorEarnings,
                    },
                },
                { new: true }
            );

            comm.clearanceStatus = 'cleared';
            comm.clearedAt = new Date();
            await comm.save();

            await VendorTransaction.create({
                vendorId: comm.vendorId,
                type: 'EARNING_CLEARED',
                amount: vendorEarnings,
                balanceSnapshot: {
                    onHold: fallbackWallet.onHold,
                    available: fallbackWallet.available,
                    reserved: fallbackWallet.reserved,
                    withdrawn: fallbackWallet.withdrawn,
                },
                referenceType: 'commission',
                referenceId: comm._id,
                description: `Clearance period (${clearanceDays} days) completed. Earnings of ₹${vendorEarnings.toFixed(2)} are now Available.`,
                status: 'completed',
            });
        } else {
            comm.clearanceStatus = 'cleared';
            comm.clearedAt = new Date();
            await comm.save();

            await VendorTransaction.create({
                vendorId: comm.vendorId,
                type: 'EARNING_CLEARED',
                amount: vendorEarnings,
                balanceSnapshot: {
                    onHold: updatedWallet.onHold,
                    available: updatedWallet.available,
                    reserved: updatedWallet.reserved,
                    withdrawn: updatedWallet.withdrawn,
                },
                referenceType: 'commission',
                referenceId: comm._id,
                description: `Clearance period (${clearanceDays} days) completed. Earnings of ₹${vendorEarnings.toFixed(2)} are now Available.`,
                status: 'completed',
            });
        }

        clearedCount++;

        // Notify seller that earnings cleared
        try {
            await createNotification({
                recipientId: comm.vendorId,
                recipientType: 'vendor',
                title: 'Earnings Cleared & Available',
                message: `Earnings of ₹${vendorEarnings.toFixed(2)} for your delivered order have cleared the ${clearanceDays}-day return window and are now available for withdrawal!`,
                type: 'finance',
                data: { commissionId: comm._id, amount: vendorEarnings },
            });
        } catch (notifErr) {
            console.error('[VendorWallet] Notification error:', notifErr.message);
        }
    }

    return clearedCount;
};

/**
 * Get comprehensive wallet summary for a vendor (running clearance check first)
 */
export const getVendorWalletSummary = async (vendorId) => {
    // Run clearance check for this vendor first to ensure accurate balances
    await runClearanceCheck(vendorId);

    const [wallet, vendorDoc, settings, pendingWithdrawalsCount] = await Promise.all([
        getOrCreateVendorWallet(vendorId),
        Vendor.findById(vendorId).select('+bankDetails'),
        getPayoutSettings(),
        WithdrawalRequest.countDocuments({ vendorId, status: { $in: ['pending', 'approved', 'processing'] } }),
    ]);

    const bankDetails = vendorDoc?.bankDetails || {};
    const hasBankDetails = Boolean(
        (bankDetails.accountNumber && bankDetails.ifscCode) || bankDetails.upiId
    );

    return {
        wallet: {
            totalEarnings: Number((wallet.totalEarnings || 0).toFixed(2)),
            onHold: Number((wallet.onHold || 0).toFixed(2)),
            available: Number((wallet.available || 0).toFixed(2)),
            reserved: Number((wallet.reserved || 0).toFixed(2)),
            withdrawn: Number((wallet.withdrawn || 0).toFixed(2)),
            totalCommission: Number((wallet.totalCommission || 0).toFixed(2)),
            totalDeductions: Number((wallet.totalDeductions || 0).toFixed(2)),
            currency: wallet.currency || 'INR',
            updatedAt: wallet.updatedAt,
        },
        bankDetailsConfigured: hasBankDetails,
        bankDetailsMasked: {
            accountName: bankDetails.accountName || '',
            maskedAccountNumber: maskAccountNumber(bankDetails.accountNumber),
            bankName: bankDetails.bankName || '',
            ifscCode: bankDetails.ifscCode || '',
            upiId: bankDetails.upiId || '',
        },
        settings: {
            clearanceDays: settings.clearanceDays,
            minWithdrawalAmount: settings.minWithdrawalAmount,
            maxWithdrawalAmount: settings.maxWithdrawalAmount,
            payoutNotice: settings.payoutNotice,
        },
        pendingWithdrawalsCount,
    };
};

/**
 * Seller requests a withdrawal
 */
export const requestWithdrawal = async (vendorId, amountInput, vendorNotes = '') => {
    const amount = Number(parseFloat(amountInput).toFixed(2));
    if (isNaN(amount) || amount <= 0) {
        throw new ApiError(400, 'Please enter a valid positive withdrawal amount.');
    }

    const settings = await getPayoutSettings();
    if (amount < settings.minWithdrawalAmount) {
        throw new ApiError(400, `Minimum withdrawal amount is ₹${settings.minWithdrawalAmount}.`);
    }
    if (amount > settings.maxWithdrawalAmount) {
        throw new ApiError(400, `Maximum withdrawal amount allowed per request is ₹${settings.maxWithdrawalAmount}.`);
    }

    // Run clearance check first so newly cleared earnings are included
    await runClearanceCheck(vendorId);

    // Check if multiple pending requests are disallowed
    if (!settings.allowMultiplePendingWithdrawals) {
        const existingPending = await WithdrawalRequest.findOne({
            vendorId,
            status: { $in: ['pending', 'approved', 'processing'] },
        });
        if (existingPending) {
            throw new ApiError(400, 'You already have an active withdrawal request under process. Please wait until it is completed.');
        }
    }

    // Check bank details
    const vendor = await Vendor.findById(vendorId).select('+bankDetails');
    if (!vendor) throw new ApiError(404, 'Vendor not found.');

    const bankDetails = vendor.bankDetails || {};
    const hasValidBank = Boolean(
        (bankDetails.accountNumber && bankDetails.ifscCode) || bankDetails.upiId
    );
    if (!hasValidBank) {
        throw new ApiError(400, 'Please configure your bank details or UPI ID before requesting a withdrawal.');
    }

    // Atomically reserve amount from available to reserved
    const updatedWallet = await VendorWallet.findOneAndUpdate(
        { vendorId, available: { $gte: amount } },
        {
            $inc: {
                available: -amount,
                reserved: amount,
            },
        },
        { new: true }
    );

    if (!updatedWallet) {
        const currentWallet = await getOrCreateVendorWallet(vendorId);
        throw new ApiError(400, `Insufficient available balance. Your available balance is ₹${currentWallet.available.toFixed(2)}.`);
    }

    // Generate unique withdrawal ID
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const withdrawalId = `WR-${todayStr}-${randSuffix}`;

    // Create withdrawal request
    const withdrawalDoc = await WithdrawalRequest.create({
        withdrawalId,
        vendorId,
        requestedAmount: amount,
        eligibleAmountAtRequest: updatedWallet.available + amount,
        status: 'pending',
        bankDetailsSnapshot: {
            accountName: bankDetails.accountName || vendor.storeName || '',
            accountNumber: bankDetails.accountNumber || '',
            maskedAccountNumber: maskAccountNumber(bankDetails.accountNumber),
            bankName: bankDetails.bankName || '',
            ifscCode: bankDetails.ifscCode || '',
            upiId: bankDetails.upiId || '',
        },
        paymentMethod: bankDetails.accountNumber ? 'bank_transfer' : 'upi',
        vendorNotes: String(vendorNotes || '').trim(),
    });

    // Record ledger transaction
    await VendorTransaction.create({
        vendorId,
        type: 'WITHDRAWAL_REQUEST',
        amount,
        balanceSnapshot: {
            onHold: updatedWallet.onHold,
            available: updatedWallet.available,
            reserved: updatedWallet.reserved,
            withdrawn: updatedWallet.withdrawn,
        },
        referenceType: 'withdrawal',
        referenceId: withdrawalDoc._id,
        referenceNumber: withdrawalId,
        description: `Withdrawal request submitted for ₹${amount.toFixed(2)}. Balance moved to Reserved.`,
        status: 'completed',
    });

    // Notification to vendor
    try {
        await createNotification({
            recipientId: vendorId,
            recipientType: 'vendor',
            title: 'Withdrawal Request Submitted',
            message: `Your withdrawal request ${withdrawalId} for ₹${amount.toFixed(2)} has been submitted and is under review.`,
            type: 'finance',
            data: { withdrawalId, amount },
        });
    } catch (err) {
        console.error('[VendorWallet] Notification error:', err.message);
    }

    return withdrawalDoc;
};

/**
 * Admin approves a withdrawal request
 */
export const approveWithdrawal = async (withdrawalDocId, adminId, adminNotes = '') => {
    const withdrawal = await WithdrawalRequest.findById(withdrawalDocId);
    if (!withdrawal) throw new ApiError(404, 'Withdrawal request not found.');

    if (withdrawal.status !== 'pending') {
        throw new ApiError(400, `Cannot approve withdrawal in status '${withdrawal.status}'. Only 'pending' requests can be approved.`);
    }

    withdrawal.status = 'approved';
    withdrawal.reviewedBy = adminId;
    withdrawal.reviewedAt = new Date();
    if (adminNotes) withdrawal.adminNotes = adminNotes;
    await withdrawal.save();

    await logActivity({
        actor: { _id: adminId, role: 'admin' },
        action: 'WITHDRAWAL_APPROVED',
        module: 'FINANCE',
        entityType: 'WithdrawalRequest',
        entityId: withdrawal._id.toString(),
        description: `Admin approved withdrawal request ${withdrawal.withdrawalId} for ₹${withdrawal.requestedAmount}`,
        metadata: { withdrawalId: withdrawal.withdrawalId, amount: withdrawal.requestedAmount },
    });

    try {
        await createNotification({
            recipientId: withdrawal.vendorId,
            recipientType: 'vendor',
            title: 'Withdrawal Approved',
            message: `Your withdrawal request ${withdrawal.withdrawalId} for ₹${withdrawal.requestedAmount.toFixed(2)} has been approved and is queued for payout.`,
            type: 'finance',
            data: { withdrawalId: withdrawal.withdrawalId },
        });
    } catch (err) {
        console.error('[VendorWallet] Notification error:', err.message);
    }

    return withdrawal;
};

/**
 * Admin rejects a withdrawal request
 * Moves funds from reserved back to available!
 */
export const rejectWithdrawal = async (withdrawalDocId, adminId, reason) => {
    if (!reason || !String(reason).trim()) {
        throw new ApiError(400, 'Rejection reason is required.');
    }

    const withdrawal = await WithdrawalRequest.findById(withdrawalDocId);
    if (!withdrawal) throw new ApiError(404, 'Withdrawal request not found.');

    if (!['pending', 'approved'].includes(withdrawal.status)) {
        throw new ApiError(400, `Cannot reject withdrawal in status '${withdrawal.status}'.`);
    }

    const amount = withdrawal.requestedAmount;
    const vendorId = withdrawal.vendorId;

    // Atomically release from reserved back to available
    const updatedWallet = await VendorWallet.findOneAndUpdate(
        { vendorId, reserved: { $gte: amount } },
        {
            $inc: {
                reserved: -amount,
                available: amount,
            },
        },
        { new: true }
    );

    if (!updatedWallet) {
        // Fallback in case of imbalance
        await VendorWallet.findOneAndUpdate(
            { vendorId },
            {
                $inc: {
                    reserved: -amount,
                    available: amount,
                },
            },
            { new: true }
        );
    }

    withdrawal.status = 'rejected';
    withdrawal.rejectionReason = String(reason).trim();
    withdrawal.reviewedBy = adminId;
    withdrawal.reviewedAt = new Date();
    await withdrawal.save();

    const currentWallet = await getOrCreateVendorWallet(vendorId);

    // Record ledger transaction
    await VendorTransaction.create({
        vendorId,
        type: 'WITHDRAWAL_REJECTED',
        amount,
        balanceSnapshot: {
            onHold: currentWallet.onHold,
            available: currentWallet.available,
            reserved: currentWallet.reserved,
            withdrawn: currentWallet.withdrawn,
        },
        referenceType: 'withdrawal',
        referenceId: withdrawal._id,
        referenceNumber: withdrawal.withdrawalId,
        description: `Withdrawal request ${withdrawal.withdrawalId} rejected: ${reason}. Amount restored to Available.`,
        status: 'completed',
        metadata: { rejectionReason: reason },
    });

    await logActivity({
        actor: { _id: adminId, role: 'admin' },
        action: 'WITHDRAWAL_REJECTED',
        module: 'FINANCE',
        entityType: 'WithdrawalRequest',
        entityId: withdrawal._id.toString(),
        description: `Admin rejected withdrawal ${withdrawal.withdrawalId} (₹${amount}). Reason: ${reason}`,
        metadata: { withdrawalId: withdrawal.withdrawalId, reason },
    });

    try {
        await createNotification({
            recipientId: vendorId,
            recipientType: 'vendor',
            title: 'Withdrawal Request Rejected',
            message: `Your withdrawal request ${withdrawal.withdrawalId} for ₹${amount.toFixed(2)} was rejected: ${reason}. The amount has been refunded to your Available balance.`,
            type: 'finance',
            data: { withdrawalId: withdrawal.withdrawalId, reason },
        });
    } catch (err) {
        console.error('[VendorWallet] Notification error:', err.message);
    }

    return withdrawal;
};

/**
 * Admin records manual payout (UTR / Bank transfer details)
 * Moves funds from reserved to withdrawn!
 * Creates a Settlement record linking to the withdrawal.
 */
export const recordManualPayout = async (withdrawalDocId, adminId, payoutData) => {
    const {
        paymentMethod = 'bank_transfer',
        utr,
        paidAmount,
        notes = '',
        paidAt = new Date(),
    } = payoutData;

    if (!utr || !String(utr).trim()) {
        throw new ApiError(400, 'Bank Reference / UTR Number is required for recording a payout.');
    }

    const cleanUtr = String(utr).trim();

    // Check UTR uniqueness across Settlements and WithdrawalRequests
    const [existingSettlement, existingWithdrawal] = await Promise.all([
        Settlement.findOne({ utr: cleanUtr }),
        WithdrawalRequest.findOne({ utr: cleanUtr, _id: { $ne: withdrawalDocId } }),
    ]);

    if (existingSettlement || existingWithdrawal) {
        throw new ApiError(400, `A settlement or payout with UTR / Reference '${cleanUtr}' has already been recorded.`);
    }

    const withdrawal = await WithdrawalRequest.findById(withdrawalDocId);
    if (!withdrawal) throw new ApiError(404, 'Withdrawal request not found.');

    if (!['pending', 'approved', 'processing'].includes(withdrawal.status)) {
        throw new ApiError(400, `Cannot pay out withdrawal in status '${withdrawal.status}'.`);
    }

    const requestedAmount = withdrawal.requestedAmount;
    const finalPaidAmount = paidAmount !== undefined && paidAmount !== null && Number(paidAmount) > 0
        ? Number(paidAmount)
        : requestedAmount;

    const vendorId = withdrawal.vendorId;

    // Atomically move from reserved to withdrawn
    const updatedWallet = await VendorWallet.findOneAndUpdate(
        { vendorId, reserved: { $gte: requestedAmount } },
        {
            $inc: {
                reserved: -requestedAmount,
                withdrawn: finalPaidAmount,
            },
        },
        { new: true }
    );

    if (!updatedWallet) {
        await VendorWallet.findOneAndUpdate(
            { vendorId },
            {
                $inc: {
                    reserved: -requestedAmount,
                    withdrawn: finalPaidAmount,
                },
            },
            { new: true }
        );
    }

    // Find cleared commissions for this vendor to associate with this settlement
    const eligibleCommissions = await Commission.find({
        vendorId,
        clearanceStatus: 'cleared',
        status: { $ne: 'cancelled' },
    }).limit(20);

    const commissionIds = eligibleCommissions.map(c => c._id);

    // Create Settlement record
    const settlement = await Settlement.create({
        vendorId,
        commissionIds,
        withdrawalId: withdrawal._id,
        amount: finalPaidAmount,
        netPaidAmount: finalPaidAmount,
        paymentMethod: ['neft', 'imps', 'rtgs', 'upi', 'bank_transfer', 'other'].includes(paymentMethod)
            ? paymentMethod
            : 'bank_transfer',
        transactionId: cleanUtr,
        utr: cleanUtr,
        notes: notes || `Manual payout for withdrawal ${withdrawal.withdrawalId}`,
        bankDetailsSnapshot: withdrawal.bankDetailsSnapshot,
        adminId,
        paidAt: new Date(paidAt),
        status: 'completed',
    });

    // Mark matched commissions as settled
    if (commissionIds.length > 0) {
        await Commission.updateMany(
            { _id: { $in: commissionIds } },
            {
                $set: {
                    status: 'paid',
                    clearanceStatus: 'settled',
                    settlementId: settlement._id,
                    paidAt: new Date(paidAt),
                    withdrawalId: withdrawal._id,
                },
            }
        );
    }

    // Update WithdrawalRequest
    withdrawal.status = 'paid';
    withdrawal.utr = cleanUtr;
    withdrawal.paidAmount = finalPaidAmount;
    withdrawal.paymentMethod = paymentMethod;
    withdrawal.settlementId = settlement._id;
    withdrawal.adminNotes = notes || withdrawal.adminNotes;
    withdrawal.paidBy = adminId;
    withdrawal.paidAt = new Date(paidAt);
    await withdrawal.save();

    const currentWallet = await getOrCreateVendorWallet(vendorId);

    // Record ledger transaction
    await VendorTransaction.create({
        vendorId,
        type: 'WITHDRAWAL_PAID',
        amount: finalPaidAmount,
        balanceSnapshot: {
            onHold: currentWallet.onHold,
            available: currentWallet.available,
            reserved: currentWallet.reserved,
            withdrawn: currentWallet.withdrawn,
        },
        referenceType: 'settlement',
        referenceId: settlement._id,
        referenceNumber: cleanUtr,
        description: `Manual payout of ₹${finalPaidAmount.toFixed(2)} completed (UTR: ${cleanUtr}).`,
        status: 'completed',
        metadata: {
            withdrawalId: withdrawal.withdrawalId,
            utr: cleanUtr,
            paymentMethod,
        },
    });

    await logActivity({
        actor: { _id: adminId, role: 'admin' },
        action: 'PAYOUT_RECORDED',
        module: 'FINANCE',
        entityType: 'WithdrawalRequest',
        entityId: withdrawal._id.toString(),
        description: `Admin recorded payout for ${withdrawal.withdrawalId} (₹${finalPaidAmount}) with UTR: ${cleanUtr}`,
        metadata: {
            withdrawalId: withdrawal.withdrawalId,
            amount: finalPaidAmount,
            utr: cleanUtr,
            settlementId: settlement._id.toString(),
        },
    });

    try {
        await createNotification({
            recipientId: vendorId,
            recipientType: 'vendor',
            title: 'Payout Processed Successfully',
            message: `Your withdrawal ${withdrawal.withdrawalId} of ₹${finalPaidAmount.toFixed(2)} has been paid to your bank account! UTR / Reference: ${cleanUtr}`,
            type: 'finance',
            data: { withdrawalId: withdrawal.withdrawalId, utr: cleanUtr, amount: finalPaidAmount },
        });
    } catch (err) {
        console.error('[VendorWallet] Notification error:', err.message);
    }

    return { withdrawal, settlement };
};

/**
 * Handle Order Cancellation
 * If order is cancelled, commissions that were on hold or pending delivery are cancelled.
 */
export const handleOrderCancellation = async (order) => {
    if (!order || !order._id) return;

    const commissions = await Commission.find({
        orderId: order._id,
        status: { $ne: 'cancelled' },
    });

    for (const comm of commissions) {
        const vendorId = comm.vendorId;
        const vendorEarnings = Number(comm.vendorEarnings || 0);

        if (comm.clearanceStatus === 'on_hold') {
            // Deduct from onHold and totalEarnings
            const updatedWallet = await VendorWallet.findOneAndUpdate(
                { vendorId },
                {
                    $inc: {
                        onHold: -Math.min(vendorEarnings),
                        totalEarnings: -vendorEarnings,
                        totalDeductions: vendorEarnings,
                    },
                },
                { new: true }
            );

            await VendorTransaction.create({
                vendorId,
                type: 'RETURN_DEDUCTION',
                amount: vendorEarnings,
                balanceSnapshot: {
                    onHold: updatedWallet?.onHold || 0,
                    available: updatedWallet?.available || 0,
                    reserved: updatedWallet?.reserved || 0,
                    withdrawn: updatedWallet?.withdrawn || 0,
                },
                referenceType: 'order',
                referenceId: order._id,
                referenceNumber: order.orderId || String(order._id),
                description: `Order #${order.orderId || order._id} cancelled. On Hold earnings reversed.`,
                status: 'completed',
            });
        }

        comm.status = 'cancelled';
        comm.clearanceStatus = 'cancelled';
        await comm.save();
    }
};

/**
 * Handle Return / Refund adjustment
 */
export const handleReturnRefund = async (order, returnRequest, refundAmount) => {
    if (!returnRequest || !returnRequest.vendorId) return;
    const vendorId = returnRequest.vendorId;
    const deduction = Number(refundAmount || 0);
    if (deduction <= 0) return;

    const wallet = await getOrCreateVendorWallet(vendorId);

    // If wallet has available, deduct from available, else from onHold
    let updateFields = {};
    if (wallet.available >= deduction) {
        updateFields = {
            $inc: {
                available: -deduction,
                totalDeductions: deduction,
            },
        };
    } else if (wallet.onHold >= deduction) {
        updateFields = {
            $inc: {
                onHold: -deduction,
                totalDeductions: deduction,
            },
        };
    } else {
        updateFields = {
            $inc: {
                available: -deduction,
                totalDeductions: deduction,
            },
        };
    }

    const updatedWallet = await VendorWallet.findOneAndUpdate({ vendorId }, updateFields, { new: true });

    await VendorTransaction.create({
        vendorId,
        type: 'RETURN_DEDUCTION',
        amount: deduction,
        balanceSnapshot: {
            onHold: updatedWallet.onHold,
            available: updatedWallet.available,
            reserved: updatedWallet.reserved,
            withdrawn: updatedWallet.withdrawn,
        },
        referenceType: 'return_request',
        referenceId: returnRequest._id,
        description: `Refund deduction of ₹${deduction.toFixed(2)} for Return Request #${returnRequest._id}`,
        status: 'completed',
    });
};
