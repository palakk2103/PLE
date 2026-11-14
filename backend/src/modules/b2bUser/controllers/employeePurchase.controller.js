/**
 * B2B Admin: employee-wise purchase visibility.
 *
 * Every query is scoped to the admin's own company (companyId), and every
 * employee-specific endpoint first verifies the employee belongs to that company.
 */
import mongoose from 'mongoose';
import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import User from '../../../models/User.model.js';
import Order from '../../../models/Order.model.js';
import ReturnRequest from '../../../models/ReturnRequest.model.js';
import WalletTransaction from '../../../models/WalletTransaction.model.js';
import { getCompanyId } from './employee.controller.js';

// Payment states that mean money actually moved (or will, for COD)
const SETTLED_PAYMENT_STATUSES = ['paid', 'captured', 'success', 'authorized', 'refunded'];
const COD_METHODS = ['cod', 'cash'];

// Fields never exposed to the company admin
const ORDER_HIDDEN_FIELDS = '-paymentDetails.razorpaySignature -idempotencyKey -idempotencyScope -emailNotifications -deletedBy';

const EMPLOYEE_PUBLIC_FIELDS = 'name firstName lastName email phone avatar designation department address b2bRole b2bWalletBalance b2bSpendingLimit isActive createdAt';

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

const parsePaging = (query, defaultLimit = 20) => {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
    return { page, limit, skip: (page - 1) * limit };
};

const dateRangeFilter = ({ from, to }) => {
    const range = {};
    if (from) {
        const d = new Date(from);
        if (isNaN(d)) throw new ApiError(400, 'Invalid "from" date.');
        range.$gte = d;
    }
    if (to) {
        const d = new Date(to);
        if (isNaN(d)) throw new ApiError(400, 'Invalid "to" date.');
        // Treat a plain date (YYYY-MM-DD) as inclusive of the whole day
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(to))) d.setHours(23, 59, 59, 999);
        range.$lte = d;
    }
    return Object.keys(range).length ? { createdAt: range } : {};
};

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const paginated = (items, total, page, limit) => ({
    items, total, page, limit, pages: Math.ceil(total / limit) || 0,
});

/** Resolve the employee for this request, guaranteeing it belongs to the admin's company. */
const getScopedEmployee = async (req) => {
    const companyId = await getCompanyId(req);
    if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, 'Invalid employee id.');
    const employee = await User.findOne({ _id: req.params.id, companyId, role: 'b2bEmployee' })
        .select(EMPLOYEE_PUBLIC_FIELDS).lean();
    if (!employee) throw new ApiError(404, 'Employee not found or unauthorized.');
    return { companyId: toObjectId(companyId), employee };
};

/**
 * Aggregate order + return stats per user for the given company.
 * "Spent" counts only orders that were actually placed (paid, or COD) and not cancelled.
 */
const aggregateSpendByUser = async (companyId, userIds, dateFilter = {}) => {
    const match = { companyId, userId: { $in: userIds }, ...dateFilter };

    const [orderStats, returnStats] = await Promise.all([
        Order.aggregate([
            { $match: match },
            {
                $addFields: {
                    _counts: {
                        $and: [
                            { $ne: ['$status', 'cancelled'] },
                            {
                                $or: [
                                    { $in: ['$paymentStatus', SETTLED_PAYMENT_STATUSES] },
                                    { $in: ['$paymentMethod', COD_METHODS] },
                                ],
                            },
                        ],
                    },
                },
            },
            {
                $group: {
                    _id: '$userId',
                    totalOrders: { $sum: 1 },
                    placedOrders: { $sum: { $cond: ['$_counts', 1, 0] } },
                    cancelledOrders: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
                    deliveredOrders: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
                    grossSpent: { $sum: { $cond: ['$_counts', '$total', 0] } },
                    walletSpent: { $sum: { $cond: ['$_counts', { $ifNull: ['$walletAmountUsed', 0] }, 0] } },
                    itemsPurchased: {
                        $sum: { $cond: ['$_counts', { $sum: '$items.quantity' }, 0] },
                    },
                    lastOrderAt: { $max: '$createdAt' },
                },
            },
        ]),
        ReturnRequest.aggregate([
            { $match: match },
            {
                $group: {
                    _id: '$userId',
                    totalReturns: { $sum: 1 },
                    refundedAmount: {
                        $sum: { $cond: [{ $eq: ['$refundStatus', 'processed'] }, { $ifNull: ['$refundAmount', 0] }, 0] },
                    },
                    pendingRefunds: {
                        $sum: { $cond: [{ $eq: ['$refundStatus', 'pending'] }, 1, 0] },
                    },
                },
            },
        ]),
    ]);

    const round = (n) => Math.round((n || 0) * 100) / 100;
    const stats = new Map();
    const blank = () => ({
        totalOrders: 0, placedOrders: 0, cancelledOrders: 0, deliveredOrders: 0,
        grossSpent: 0, walletSpent: 0, itemsPurchased: 0, lastOrderAt: null,
        totalReturns: 0, refundedAmount: 0, pendingRefunds: 0,
    });
    for (const s of orderStats) {
        const { _id, ...rest } = s;
        stats.set(String(_id), { ...blank(), ...rest });
    }
    for (const r of returnStats) {
        const { _id, ...rest } = r;
        stats.set(String(_id), { ...(stats.get(String(_id)) || blank()), ...rest });
    }
    for (const s of stats.values()) {
        s.grossSpent = round(s.grossSpent);
        s.walletSpent = round(s.walletSpent);
        s.refundedAmount = round(s.refundedAmount);
        s.netSpent = round(s.grossSpent - s.refundedAmount);
    }
    return (userId) => stats.get(String(userId)) || { ...blank(), netSpent: 0 };
};

/**
 * @desc    Company-wide, employee-wise purchase summary
 * @route   GET /api/b2b-user/admin/employees/purchases/summary
 * @query   search, from, to, status (active|inactive), sortBy (netSpent|totalOrders|lastOrderAt|name), order (asc|desc), page, limit
 * @access  Private (B2B Admin)
 */
export const getPurchaseSummary = asyncHandler(async (req, res) => {
    const companyId = toObjectId(await getCompanyId(req));
    const { search, status, sortBy = 'netSpent', order = 'desc' } = req.query;
    const { page, limit, skip } = parsePaging(req.query);
    const dateFilter = dateRangeFilter(req.query);

    const employeeFilter = { companyId, role: 'b2bEmployee' };
    if (status === 'active') employeeFilter.isActive = true;
    if (status === 'inactive') employeeFilter.isActive = false;
    if (search) {
        const rx = new RegExp(escapeRegex(search), 'i');
        employeeFilter.$or = [{ name: rx }, { email: rx }, { department: rx }, { designation: rx }];
    }

    const employees = await User.find(employeeFilter).select(EMPLOYEE_PUBLIC_FIELDS).lean();
    const statsFor = await aggregateSpendByUser(companyId, employees.map((e) => e._id), dateFilter);

    const rows = employees.map((e) => ({ employee: e, stats: statsFor(e._id) }));

    const dir = order === 'asc' ? 1 : -1;
    const sortValue = {
        name: (r) => (r.employee.name || '').toLowerCase(),
        totalOrders: (r) => r.stats.totalOrders,
        lastOrderAt: (r) => (r.stats.lastOrderAt ? new Date(r.stats.lastOrderAt).getTime() : 0),
        netSpent: (r) => r.stats.netSpent,
    }[sortBy] || ((r) => r.stats.netSpent);
    rows.sort((a, b) => {
        const va = sortValue(a), vb = sortValue(b);
        return va < vb ? -dir : va > vb ? dir : 0;
    });

    // Company totals across all matching employees (not just this page)
    const sum = (key) => Math.round(rows.reduce((t, r) => t + (r.stats[key] || 0), 0) * 100) / 100;
    const totals = {
        employees: rows.length,
        totalOrders: sum('totalOrders'),
        placedOrders: sum('placedOrders'),
        cancelledOrders: sum('cancelledOrders'),
        grossSpent: sum('grossSpent'),
        walletSpent: sum('walletSpent'),
        refundedAmount: sum('refundedAmount'),
        netSpent: sum('netSpent'),
        totalReturns: sum('totalReturns'),
        walletBalanceRemaining: Math.round(rows.reduce((t, r) => t + (r.employee.b2bWalletBalance || 0), 0) * 100) / 100,
    };

    res.status(200).json(new ApiResponse(200, {
        totals,
        ...paginated(rows.slice(skip, skip + limit), rows.length, page, limit),
    }, 'Employee purchase summary fetched.'));
});

/**
 * @desc    One employee's profile, wallet and purchase stats
 * @route   GET /api/b2b-user/admin/employees/:id/overview
 * @access  Private (B2B Admin)
 */
export const getEmployeeOverview = asyncHandler(async (req, res) => {
    const { companyId, employee } = await getScopedEmployee(req);
    const dateFilter = dateRangeFilter(req.query);

    const [statsFor, walletTotals, recentOrders] = await Promise.all([
        aggregateSpendByUser(companyId, [employee._id], dateFilter),
        WalletTransaction.aggregate([
            { $match: { userId: employee._id, companyId, status: 'completed', ...dateFilter } },
            { $group: { _id: { type: '$type', category: '$transactionCategory' }, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
        Order.find({ companyId, userId: employee._id }).sort({ createdAt: -1 }).limit(5)
            .select('orderId status paymentMethod paymentStatus total walletAmountUsed createdAt items.name items.quantity').lean(),
    ]);

    const wallet = { currentBalance: employee.b2bWalletBalance || 0, spendingLimit: employee.b2bSpendingLimit || 0, totalAllotted: 0, totalRefundedToWallet: 0, totalDebited: 0 };
    for (const w of walletTotals) {
        if (w._id.type === 'credit' && w._id.category === 'b2b_allotment') wallet.totalAllotted += w.amount;
        else if (w._id.type === 'credit' && w._id.category === 'refund') wallet.totalRefundedToWallet += w.amount;
        if (w._id.type === 'debit') wallet.totalDebited += w.amount;
    }
    for (const k of ['totalAllotted', 'totalRefundedToWallet', 'totalDebited']) wallet[k] = Math.round(wallet[k] * 100) / 100;

    res.status(200).json(new ApiResponse(200, {
        employee,
        stats: statsFor(employee._id),
        wallet,
        recentOrders,
    }, 'Employee overview fetched.'));
});

/**
 * @desc    One employee's orders (items, quantities, prices, status, payment)
 * @route   GET /api/b2b-user/admin/employees/:id/orders
 * @query   status, paymentMethod, paymentStatus, search (order id), from, to, page, limit
 * @access  Private (B2B Admin)
 */
export const getEmployeeOrders = asyncHandler(async (req, res) => {
    const { companyId, employee } = await getScopedEmployee(req);
    const { status, paymentMethod, paymentStatus, search } = req.query;
    const { page, limit, skip } = parsePaging(req.query);

    const filter = { companyId, userId: employee._id, ...dateRangeFilter(req.query) };
    if (status && status !== 'all') filter.status = status;
    if (paymentMethod && paymentMethod !== 'all') filter.paymentMethod = paymentMethod;
    if (paymentStatus && paymentStatus !== 'all') filter.paymentStatus = paymentStatus;
    if (search) filter.orderId = new RegExp(escapeRegex(search), 'i');

    const [orders, total] = await Promise.all([
        Order.find(filter)
            .select('orderId status paymentMethod paymentStatus subtotal shipping tax discount couponDiscount loyaltyDiscount total walletAmountUsed items vendorItems.vendorName vendorItems.status createdAt deliveredAt cancelledAt orderType trackingNumber')
            .sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Order.countDocuments(filter),
    ]);

    res.status(200).json(new ApiResponse(200, paginated(orders, total, page, limit), 'Employee orders fetched.'));
});

/**
 * @desc    Full detail of one order placed by the employee, with its payment,
 *          wallet transactions and any returns/refunds
 * @route   GET /api/b2b-user/admin/employees/:id/orders/:orderId   (:orderId = public order id, e.g. ORD-...)
 * @access  Private (B2B Admin)
 */
export const getEmployeeOrderDetail = asyncHandler(async (req, res) => {
    const { companyId, employee } = await getScopedEmployee(req);

    const order = await Order.findOne({ companyId, userId: employee._id, orderId: req.params.orderId })
        .select(ORDER_HIDDEN_FIELDS).lean();
    if (!order) throw new ApiError(404, 'Order not found for this employee.');

    const [returns, walletTransactions] = await Promise.all([
        ReturnRequest.find({ companyId, orderId: order._id }).sort({ createdAt: -1 })
            .populate('vendorId', 'storeName').lean(),
        WalletTransaction.find({ companyId, userId: employee._id, orderId: order._id }).sort({ createdAt: 1 })
            .select('type transactionCategory amount balanceAfterTransaction description status createdAt returnRequestId').lean(),
    ]);

    const payment = {
        method: order.paymentMethod,
        status: order.paymentStatus,
        walletAmountUsed: order.walletAmountUsed || 0,
        onlineAmount: Math.max(0, Math.round(((order.total || 0) - (order.walletAmountUsed || 0)) * 100) / 100),
        gateway: order.paymentDetails || null,
        refund: order.refundDetails || null,
    };

    res.status(200).json(new ApiResponse(200, {
        employee: { _id: employee._id, name: employee.name, email: employee.email, department: employee.department, designation: employee.designation },
        order,
        payment,
        returns,
        walletTransactions,
    }, 'Order detail fetched.'));
});

/**
 * @desc    One employee's return & refund requests
 * @route   GET /api/b2b-user/admin/employees/:id/returns
 * @query   status, refundStatus, from, to, page, limit
 * @access  Private (B2B Admin)
 */
export const getEmployeeReturns = asyncHandler(async (req, res) => {
    const { companyId, employee } = await getScopedEmployee(req);
    const { status, refundStatus } = req.query;
    const { page, limit, skip } = parsePaging(req.query);

    const filter = { companyId, userId: employee._id, ...dateRangeFilter(req.query) };
    if (status && status !== 'all') filter.status = status;
    if (refundStatus && refundStatus !== 'all') filter.refundStatus = refundStatus;

    const [returns, total] = await Promise.all([
        ReturnRequest.find(filter)
            .select('returnId orderNumber orderId items reason status refundAmount refundStatus refundDestination refundDetails rejectionReason createdAt updatedAt')
            .populate('orderId', 'orderId total paymentMethod createdAt')
            .populate('vendorId', 'storeName')
            .sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        ReturnRequest.countDocuments(filter),
    ]);

    res.status(200).json(new ApiResponse(200, paginated(returns, total, page, limit), 'Employee returns fetched.'));
});

/**
 * @desc    One employee's wallet ledger: allotments, order payments, refunds, with running balance
 * @route   GET /api/b2b-user/admin/employees/:id/wallet-transactions
 * @query   type (credit|debit), category, from, to, page, limit
 * @access  Private (B2B Admin)
 */
export const getEmployeeWalletTransactions = asyncHandler(async (req, res) => {
    const { companyId, employee } = await getScopedEmployee(req);
    const { type, category } = req.query;
    const { page, limit, skip } = parsePaging(req.query, 30);

    const filter = { companyId, userId: employee._id, ...dateRangeFilter(req.query) };
    if (type === 'credit' || type === 'debit') filter.type = type;
    if (category && category !== 'all') filter.transactionCategory = category;

    const [transactions, total] = await Promise.all([
        WalletTransaction.find(filter)
            .select('type transactionCategory amount balanceAfterTransaction description status orderId returnRequestId performedBy createdAt')
            .populate('orderId', 'orderId')
            .populate('performedBy', 'name email')
            .sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        WalletTransaction.countDocuments(filter),
    ]);

    res.status(200).json(new ApiResponse(200, {
        currentBalance: employee.b2bWalletBalance || 0,
        ...paginated(transactions, total, page, limit),
    }, 'Employee wallet transactions fetched.'));
});
