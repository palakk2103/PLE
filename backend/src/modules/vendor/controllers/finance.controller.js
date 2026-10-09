import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Vendor from '../../../models/Vendor.model.js';
import VendorTransaction from '../../../models/VendorTransaction.model.js';
import WithdrawalRequest from '../../../models/WithdrawalRequest.model.js';
import {
    getVendorWalletSummary,
    requestWithdrawal,
    maskAccountNumber,
} from '../../../services/vendorWallet.service.js';

/**
 * Get vendor wallet summary & settings
 */
export const getWalletSummary = asyncHandler(async (req, res) => {
    const vendorId = req.user.role === 'managed_vendor'
        ? (req.user.shopId || req.user.id)
        : req.user.id;

    const summary = await getVendorWalletSummary(vendorId);
    return res.status(200).json(new ApiResponse(200, summary, 'Wallet summary retrieved successfully.'));
});

/**
 * Get vendor financial transactions ledger (paginated)
 */
export const getTransactions = asyncHandler(async (req, res) => {
    const vendorId = req.user.role === 'managed_vendor'
        ? (req.user.shopId || req.user.id)
        : req.user.id;

    const {
        page = 1,
        limit = 20,
        type,
        startDate,
        endDate,
    } = req.query;

    const numericPage = Math.max(1, Number(page) || 1);
    const numericLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const skip = (numericPage - 1) * numericLimit;

    const filter = { vendorId };
    if (type) filter.type = type;

    if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filter.createdAt.$lte = end;
        }
    }

    const [transactions, total] = await Promise.all([
        VendorTransaction.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(numericLimit)
            .lean(),
        VendorTransaction.countDocuments(filter),
    ]);

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                transactions,
                pagination: {
                    total,
                    page: numericPage,
                    limit: numericLimit,
                    pages: Math.max(1, Math.ceil(total / numericLimit)),
                },
            },
            'Transactions retrieved successfully.'
        )
    );
});

/**
 * Get vendor withdrawal requests (paginated)
 */
export const getWithdrawals = asyncHandler(async (req, res) => {
    const vendorId = req.user.role === 'managed_vendor'
        ? (req.user.shopId || req.user.id)
        : req.user.id;

    const {
        page = 1,
        limit = 20,
        status,
    } = req.query;

    const numericPage = Math.max(1, Number(page) || 1);
    const numericLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const skip = (numericPage - 1) * numericLimit;

    const filter = { vendorId };
    if (status && status !== 'all') filter.status = status;

    const [withdrawals, total] = await Promise.all([
        WithdrawalRequest.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(numericLimit)
            .lean(),
        WithdrawalRequest.countDocuments(filter),
    ]);

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                withdrawals,
                pagination: {
                    total,
                    page: numericPage,
                    limit: numericLimit,
                    pages: Math.max(1, Math.ceil(total / numericLimit)),
                },
            },
            'Withdrawals retrieved successfully.'
        )
    );
});

/**
 * Create a new withdrawal request
 */
export const createWithdrawal = asyncHandler(async (req, res) => {
    const vendorId = req.user.role === 'managed_vendor'
        ? (req.user.shopId || req.user.id)
        : req.user.id;

    const { amount, notes } = req.body;

    const withdrawal = await requestWithdrawal(vendorId, amount, notes);
    return res.status(201).json(new ApiResponse(201, withdrawal, 'Withdrawal request submitted successfully.'));
});

/**
 * Get vendor bank details (masked)
 */
export const getBankDetails = asyncHandler(async (req, res) => {
    const vendorId = req.user.role === 'managed_vendor'
        ? (req.user.shopId || req.user.id)
        : req.user.id;

    const vendor = await Vendor.findById(vendorId).select('+bankDetails');
    if (!vendor) throw new ApiError(404, 'Vendor not found.');

    const bank = vendor.bankDetails || {};
    return res.status(200).json(
        new ApiResponse(
            200,
            {
                accountName: bank.accountName || '',
                bankName: bank.bankName || '',
                ifscCode: bank.ifscCode || '',
                upiId: bank.upiId || '',
                maskedAccountNumber: maskAccountNumber(bank.accountNumber),
                hasConfiguredBank: Boolean((bank.accountNumber && bank.ifscCode) || bank.upiId),
            },
            'Bank details retrieved successfully.'
        )
    );
});

/**
 * Update vendor bank details
 */
export const updateBankDetails = asyncHandler(async (req, res) => {
    const vendorId = req.user.role === 'managed_vendor'
        ? (req.user.shopId || req.user.id)
        : req.user.id;

    const { accountName, accountNumber, bankName, ifscCode, upiId } = req.body;

    const vendor = await Vendor.findById(vendorId).select('+bankDetails');
    if (!vendor) throw new ApiError(404, 'Vendor not found.');

    if (!vendor.bankDetails) vendor.bankDetails = {};

    if (accountName !== undefined) vendor.bankDetails.accountName = String(accountName).trim();
    if (accountNumber !== undefined && String(accountNumber).trim()) {
        vendor.bankDetails.accountNumber = String(accountNumber).trim();
    }
    if (bankName !== undefined) vendor.bankDetails.bankName = String(bankName).trim();
    if (ifscCode !== undefined) vendor.bankDetails.ifscCode = String(ifscCode).trim().toUpperCase();
    if (upiId !== undefined) vendor.bankDetails.upiId = String(upiId).trim();

    await vendor.save();

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                accountName: vendor.bankDetails.accountName || '',
                bankName: vendor.bankDetails.bankName || '',
                ifscCode: vendor.bankDetails.ifscCode || '',
                upiId: vendor.bankDetails.upiId || '',
                maskedAccountNumber: maskAccountNumber(vendor.bankDetails.accountNumber),
                hasConfiguredBank: Boolean(
                    (vendor.bankDetails.accountNumber && vendor.bankDetails.ifscCode) || vendor.bankDetails.upiId
                ),
            },
            'Bank details updated successfully.'
        )
    );
});
