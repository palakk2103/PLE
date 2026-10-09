import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import VendorWallet from '../../../models/VendorWallet.model.js';
import VendorTransaction from '../../../models/VendorTransaction.model.js';
import WithdrawalRequest from '../../../models/WithdrawalRequest.model.js';
import Settlement from '../../../models/Settlement.model.js';
import Commission from '../../../models/Commission.model.js';
import Vendor from '../../../models/Vendor.model.js';
import {
    getPayoutSettings,
    updatePayoutSettings as updateSettingsService,
    approveWithdrawal as approveService,
    rejectWithdrawal as rejectService,
    recordManualPayout as payoutService,
    getVendorWalletSummary,
    runClearanceCheck,
} from '../../../services/vendorWallet.service.js';

/**
 * Admin Finance Overview Dashboard
 */
export const getFinanceOverview = asyncHandler(async (req, res) => {
    // Run clearance check across all vendors to ensure up-to-date data
    await runClearanceCheck();

    const [
        walletAgg,
        pendingWithdrawalsAgg,
        paidWithdrawalsAgg,
        settlementsAgg,
        commissionAgg,
        counts,
    ] = await Promise.all([
        // Total wallet balances aggregate
        VendorWallet.aggregate([
            {
                $group: {
                    _id: null,
                    totalEarnings: { $sum: '$totalEarnings' },
                    totalOnHold: { $sum: '$onHold' },
                    totalAvailable: { $sum: '$available' },
                    totalReserved: { $sum: '$reserved' },
                    totalWithdrawn: { $sum: '$withdrawn' },
                    totalCommission: { $sum: '$totalCommission' },
                    totalDeductions: { $sum: '$totalDeductions' },
                },
            },
        ]),
        // Pending & approved withdrawal requests
        WithdrawalRequest.aggregate([
            { $match: { status: { $in: ['pending', 'approved', 'processing'] } } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    amount: { $sum: '$requestedAmount' },
                },
            },
        ]),
        // Paid withdrawals aggregate
        WithdrawalRequest.aggregate([
            { $match: { status: 'paid' } },
            {
                $group: {
                    _id: null,
                    count: { $sum: 1 },
                    totalPaid: { $sum: '$paidAmount' },
                },
            },
        ]),
        // Settlements summary
        Settlement.aggregate([
            {
                $group: {
                    _id: null,
                    count: { $sum: 1 },
                    totalSettled: { $sum: '$amount' },
                },
            },
        ]),
        // Commissions summary
        Commission.aggregate([
            {
                $group: {
                    _id: '$clearanceStatus',
                    count: { $sum: 1 },
                    vendorEarnings: { $sum: '$vendorEarnings' },
                    commission: { $sum: '$commission' },
                },
            },
        ]),
        // Quick counts
        Promise.all([
            WithdrawalRequest.countDocuments({ status: 'pending' }),
            WithdrawalRequest.countDocuments({ status: 'approved' }),
            WithdrawalRequest.countDocuments({ status: 'paid' }),
            WithdrawalRequest.countDocuments({ status: 'rejected' }),
            Vendor.countDocuments({ status: 'active' }),
        ]),
    ]);

    const walletTotals = walletAgg[0] || {
        totalEarnings: 0,
        totalOnHold: 0,
        totalAvailable: 0,
        totalReserved: 0,
        totalWithdrawn: 0,
        totalCommission: 0,
        totalDeductions: 0,
    };

    const pendingTotal = pendingWithdrawalsAgg.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const pendingCount = counts[0];
    const approvedCount = counts[1];
    const paidCount = counts[2];
    const rejectedCount = counts[3];
    const totalActiveVendors = counts[4];

    const settings = await getPayoutSettings();

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                overview: {
                    totalEarnings: walletTotals.totalEarnings,
                    onHold: walletTotals.totalOnHold,
                    available: walletTotals.totalAvailable,
                    reserved: walletTotals.totalReserved,
                    withdrawn: walletTotals.totalWithdrawn,
                    totalCommission: walletTotals.totalCommission,
                    totalDeductions: walletTotals.totalDeductions,
                },
                withdrawals: {
                    pendingAmount: pendingTotal,
                    pendingCount,
                    approvedCount,
                    paidCount,
                    rejectedCount,
                    totalPaid: paidWithdrawalsAgg[0]?.totalPaid || walletTotals.totalWithdrawn,
                },
                settlements: {
                    count: settlementsAgg[0]?.count || 0,
                    totalSettled: settlementsAgg[0]?.totalSettled || 0,
                },
                commissionsByStatus: commissionAgg,
                totalActiveVendors,
                settings,
            },
            'Finance overview retrieved successfully.'
        )
    );
});

/**
 * List all withdrawal requests with search, filtering, and pagination
 */
export const getWithdrawals = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 20,
        status,
        search,
        vendorId,
        sortBy = 'createdAt',
        sortOrder = 'desc',
    } = req.query;

    const numericPage = Math.max(1, Number(page) || 1);
    const numericLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const skip = (numericPage - 1) * numericLimit;

    const filter = {};
    if (status && status !== 'all') {
        filter.status = status;
    }
    if (vendorId) {
        filter.vendorId = vendorId;
    }
    if (search) {
        filter.$or = [
            { withdrawalId: { $regex: search, $options: 'i' } },
            { utr: { $regex: search, $options: 'i' } },
        ];
    }

    const sortOption = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [withdrawals, total] = await Promise.all([
        WithdrawalRequest.find(filter)
            .populate('vendorId', 'storeName email phone ownerName')
            .populate('reviewedBy', 'name email')
            .populate('paidBy', 'name email')
            .sort(sortOption)
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
            'Withdrawals list retrieved successfully.'
        )
    );
});

/**
 * Get detailed withdrawal request by ID
 */
export const getWithdrawalById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const withdrawal = await WithdrawalRequest.findById(id)
        .populate('vendorId', 'storeName email phone ownerName commissionRate status address')
        .populate('settlementId')
        .populate('reviewedBy', 'name email')
        .populate('paidBy', 'name email')
        .lean();

    if (!withdrawal) throw new ApiError(404, 'Withdrawal request not found.');

    // Fetch vendor's current wallet and full bank details
    const [vendorWithBank, wallet, recentCommissions] = await Promise.all([
        Vendor.findById(withdrawal.vendorId?._id || withdrawal.vendorId).select('+bankDetails').lean(),
        VendorWallet.findOne({ vendorId: withdrawal.vendorId?._id || withdrawal.vendorId }).lean(),
        Commission.find({ vendorId: withdrawal.vendorId?._id || withdrawal.vendorId })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean(),
    ]);

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                withdrawal,
                vendorBankDetails: vendorWithBank?.bankDetails || {},
                vendorWallet: wallet || {},
                recentCommissions,
            },
            'Withdrawal details retrieved successfully.'
        )
    );
});

/**
 * Approve a withdrawal request
 */
export const approveWithdrawal = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { adminNotes } = req.body;
    const adminId = req.user.id || req.user._id;

    const withdrawal = await approveService(id, adminId, adminNotes);
    return res.status(200).json(new ApiResponse(200, withdrawal, 'Withdrawal request approved successfully.'));
});

/**
 * Reject a withdrawal request
 */
export const rejectWithdrawal = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id || req.user._id;

    if (!reason || !String(reason).trim()) {
        throw new ApiError(400, 'Rejection reason is required.');
    }

    const withdrawal = await rejectService(id, adminId, reason);
    return res.status(200).json(new ApiResponse(200, withdrawal, 'Withdrawal request rejected and amount refunded.'));
});

/**
 * Record manual payout (bank transfer with UTR)
 */
export const recordManualPayout = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const adminId = req.user.id || req.user._id;
    const { paymentMethod, utr, paidAmount, notes, paidAt } = req.body;

    const result = await payoutService(id, adminId, {
        paymentMethod,
        utr,
        paidAmount,
        notes,
        paidAt,
    });

    return res.status(200).json(
        new ApiResponse(200, result, 'Manual payout recorded and settlement created successfully.')
    );
});

/**
 * List all settlements
 */
export const getSettlements = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 20,
        search,
        vendorId,
        paymentMethod,
    } = req.query;

    const numericPage = Math.max(1, Number(page) || 1);
    const numericLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const skip = (numericPage - 1) * numericLimit;

    const filter = {};
    if (vendorId) filter.vendorId = vendorId;
    if (paymentMethod && paymentMethod !== 'all') filter.paymentMethod = paymentMethod;
    if (search) {
        filter.$or = [
            { transactionId: { $regex: search, $options: 'i' } },
            { utr: { $regex: search, $options: 'i' } },
        ];
    }

    const [settlements, total] = await Promise.all([
        Settlement.find(filter)
            .populate('vendorId', 'storeName email phone')
            .populate('withdrawalId', 'withdrawalId requestedAmount')
            .populate('adminId', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(numericLimit)
            .lean(),
        Settlement.countDocuments(filter),
    ]);

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                settlements,
                pagination: {
                    total,
                    page: numericPage,
                    limit: numericLimit,
                    pages: Math.max(1, Math.ceil(total / numericLimit)),
                },
            },
            'Settlements list retrieved successfully.'
        )
    );
});

/**
 * Get settlement details by ID
 */
export const getSettlementById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const settlement = await Settlement.findById(id)
        .populate('vendorId', 'storeName email phone ownerName')
        .populate('withdrawalId')
        .populate('commissionIds')
        .populate('adminId', 'name email')
        .lean();

    if (!settlement) throw new ApiError(404, 'Settlement not found.');

    return res.status(200).json(new ApiResponse(200, settlement, 'Settlement details retrieved successfully.'));
});

/**
 * List all vendor financial transactions across system
 */
export const getAllTransactions = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 20,
        type,
        vendorId,
        startDate,
        endDate,
    } = req.query;

    const numericPage = Math.max(1, Number(page) || 1);
    const numericLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const skip = (numericPage - 1) * numericLimit;

    const filter = {};
    if (vendorId) filter.vendorId = vendorId;
    if (type && type !== 'all') filter.type = type;

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
            .populate('vendorId', 'storeName email')
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
            'System transactions retrieved successfully.'
        )
    );
});

/**
 * Get payout settings
 */
export const getSettings = asyncHandler(async (req, res) => {
    const settings = await getPayoutSettings();
    return res.status(200).json(new ApiResponse(200, settings, 'Payout settings retrieved successfully.'));
});

/**
 * Update payout settings (clearanceDays, minWithdrawalAmount, etc.)
 */
export const updateSettings = asyncHandler(async (req, res) => {
    const adminId = req.user.id || req.user._id;
    const updated = await updateSettingsService(req.body, adminId);
    return res.status(200).json(new ApiResponse(200, updated, 'Payout settings updated successfully.'));
});

/**
 * View specific vendor wallet details (Admin view)
 */
export const getVendorWalletAdmin = asyncHandler(async (req, res) => {
    const { vendorId } = req.params;
    const summary = await getVendorWalletSummary(vendorId);
    const vendor = await Vendor.findById(vendorId).select('+bankDetails').lean();

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                ...summary,
                vendor,
            },
            'Vendor wallet retrieved successfully.'
        )
    );
});
