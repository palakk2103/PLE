import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Order from '../../../models/Order.model.js';
import Product from '../../../models/Product.model.js';
import Commission from '../../../models/Commission.model.js';
import ReturnRequest from '../../../models/ReturnRequest.model.js';
import mongoose from 'mongoose';
import { parseFilterDate } from '../../../utils/istDateRange.js';
import { summarizeReturns } from '../../../services/vendorMonitoring.service.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
// Orders that did not go through: counted, never in sales
const NOT_SOLD = ['cancelled', 'returned'];
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Start of the India calendar day / month / year that contains `now`, as a real instant. */
const istStart = (now, unit) => {
    const ist = new Date(now.getTime() + IST_OFFSET_MS);
    const y = ist.getUTCFullYear();
    const m = ist.getUTCMonth();
    const d = ist.getUTCDate();
    const utc = unit === 'year' ? Date.UTC(y, 0, 1) : unit === 'month' ? Date.UTC(y, m, 1) : Date.UTC(y, m, d);
    return new Date(utc - IST_OFFSET_MS);
};

/**
 * ?from=&to= (India calendar days) win over ?period=today|week|month|year. Returns the range plus the
 * equally long range just before it, for the "vs previous period" comparison.
 */
const resolveRange = ({ period = 'month', from, to }) => {
    const now = new Date();
    let start;
    let end = now;
    let label = String(period).toLowerCase();
    if (from || to) {
        if (!from || !to) throw new ApiError(400, 'Send both "from" and "to" for a custom date range.');
        start = parseFilterDate(from, { endOfDay: false }, 'from');
        end = parseFilterDate(to, { endOfDay: true }, 'to');
        if (start > end) throw new ApiError(400, '"from" must be on or before "to".');
        label = 'custom';
    } else if (label === 'today') {
        start = istStart(now, 'day');
    } else if (label === 'week') {
        start = new Date(now.getTime() - 7 * DAY_MS);
    } else if (label === 'year') {
        start = istStart(now, 'year');
    } else {
        label = 'month';
        start = istStart(now, 'month');
    }
    const length = end.getTime() - start.getTime();
    return { start, end, label, previous: { start: new Date(start.getTime() - length - 1), end: new Date(start.getTime() - 1) } };
};

const toObjectIds = (ids) => ids.filter((id) => mongoose.isValidObjectId(id)).map((id) => new mongoose.Types.ObjectId(String(id)));

/** One row per order holding this vendor's goods: sold flag, value of own lines after coupon, India day. */
const vendorOrderStages = (ids, { start, end }) => [
    { $match: { 'vendorItems.vendorId': { $in: ids }, isDeleted: { $ne: true }, createdAt: { $gte: start, $lte: end } } },
    { $unwind: '$vendorItems' },
    { $match: { 'vendorItems.vendorId': { $in: ids } } },
    {
        $project: {
            orderStatus: '$status',
            groupStatus: { $ifNull: ['$vendorItems.status', 'pending'] },
            subtotal: '$vendorItems.subtotal',
            day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+05:30' } },
            goods: {
                $reduce: {
                    input: { $ifNull: ['$vendorItems.items', []] }, initialValue: 0,
                    in: { $add: ['$$value', { $subtract: [{ $multiply: [{ $ifNull: ['$$this.price', 0] }, { $ifNull: ['$$this.quantity', 0] }] }, { $ifNull: ['$$this.discount', 0] }] }] },
                },
            },
            hasItems: { $gt: [{ $size: { $ifNull: ['$vendorItems.items', []] } }, 0] },
        },
    },
    {
        $addFields: {
            sold: { $and: [{ $not: [{ $in: ['$orderStatus', NOT_SOLD] }] }, { $ne: ['$groupStatus', 'cancelled'] }] },
            value: { $cond: ['$hasItems', '$goods', { $ifNull: ['$subtotal', 0] }] },
        },
    },
    // a managed vendor can own two ids (shop + user) on one order: count the order once
    {
        $group: {
            _id: '$_id',
            day: { $first: '$day' },
            orderStatus: { $first: '$orderStatus' },
            groupStatus: { $first: '$groupStatus' },
            sold: { $max: { $cond: ['$sold', 1, 0] } },
            value: { $sum: { $cond: ['$sold', '$value', 0] } },
        },
    },
];

const salesTotals = async (ids, range) => {
    const [row] = await Order.aggregate([
        ...vendorOrderStages(ids, range),
        { $match: { sold: 1 } },
        { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: '$value' } } },
    ]);
    return { orders: row?.orders || 0, revenue: round2(row?.revenue) };
};

const pctChange = (current, previous) => (previous > 0 ? Number((((current - previous) / previous) * 100).toFixed(1)) : null);

export const getAnalyticsOverview = asyncHandler(async (req, res) => {
    const range = resolveRange({ period: req.query?.period, from: req.query?.from, to: req.query?.to });
    const { start, end } = range;

    const rawIds = req.user.role === 'managed_vendor'
        ? [req.user.shopId, req.user.id].filter(Boolean)
        : [req.user.id];
    const ids = toObjectIds(rawIds);

    const productQuery = req.user.role === 'managed_vendor'
        ? { $or: [{ shopId: req.user.shopId }, { vendorId: { $in: ids } }, { vendorUserId: req.user.id }] }
        : { vendorId: req.user.id };
    const createdRange = { $gte: start, $lte: end };

    const [orderFacets, previous, topProducts, productsCount, lowStock, outOfStock, commissionRows, returnDocs] = await Promise.all([
        Order.aggregate([
            ...vendorOrderStages(ids, range),
            {
                $facet: {
                    daily: [
                        { $match: { sold: 1 } },
                        { $group: { _id: '$day', revenue: { $sum: '$value' }, orders: { $sum: 1 } } },
                        { $sort: { _id: 1 } },
                    ],
                    status: [
                        { $match: { sold: 1 } },
                        { $group: { _id: '$groupStatus', count: { $sum: 1 } } },
                        { $sort: { count: -1 } },
                    ],
                    counts: [{ $group: { _id: null, total: { $sum: 1 }, cancelled: { $sum: { $cond: [{ $eq: ['$orderStatus', 'cancelled'] }, 1, 0] } } } }],
                    soldIds: [{ $match: { sold: 1 } }, { $group: { _id: null, ids: { $push: '$_id' } } }],
                },
            },
        ]),
        salesTotals(ids, range.previous),
        Order.aggregate([
            { $match: { 'vendorItems.vendorId': { $in: ids }, isDeleted: { $ne: true }, status: { $nin: NOT_SOLD }, createdAt: createdRange } },
            { $unwind: '$vendorItems' },
            { $match: { 'vendorItems.vendorId': { $in: ids }, 'vendorItems.status': { $ne: 'cancelled' } } },
            { $unwind: '$vendorItems.items' },
            {
                $group: {
                    _id: '$vendorItems.items.productId',
                    name: { $first: '$vendorItems.items.name' },
                    image: { $first: '$vendorItems.items.image' },
                    quantity: { $sum: { $ifNull: ['$vendorItems.items.quantity', 0] } },
                    revenue: { $sum: { $subtract: [{ $multiply: [{ $ifNull: ['$vendorItems.items.price', 0] }, { $ifNull: ['$vendorItems.items.quantity', 0] }] }, { $ifNull: ['$vendorItems.items.discount', 0] }] } },
                },
            },
            { $sort: { revenue: -1 } },
            { $limit: 5 },
        ]),
        Product.countDocuments(productQuery),
        Product.countDocuments({ ...productQuery, stock: 'low_stock' }),
        Product.countDocuments({ ...productQuery, stock: 'out_of_stock' }),
        Commission.aggregate([
            { $match: { vendorId: { $in: ids }, createdAt: createdRange, status: { $ne: 'cancelled' }, clearanceStatus: { $nin: ['cancelled', 'refunded'] } } },
            {
                $group: {
                    _id: null,
                    commission: { $sum: { $ifNull: ['$commission', 0] } },
                    netEarnings: { $sum: { $ifNull: ['$vendorEarnings', 0] } },
                    pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, { $ifNull: ['$vendorEarnings', 0] }, 0] } },
                    paid: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, { $ifNull: ['$vendorEarnings', 0] }, 0] } },
                },
            },
        ]),
        ReturnRequest.find({ vendorId: { $in: ids }, createdAt: createdRange })
            .select('orderId status refundAmount refundStatus refundDetails.amount items.price items.quantity')
            .lean(),
    ]);

    const f = orderFacets[0] || {};
    const timeseries = (f.daily || []).map((d) => ({ date: d._id, revenue: round2(d.revenue), orders: d.orders }));
    const totalRevenue = round2(timeseries.reduce((s, p) => s + p.revenue, 0));
    const soldOrders = timeseries.reduce((s, p) => s + p.orders, 0);
    const totalOrders = f.counts?.[0]?.total || 0;
    const cancelledOrders = f.counts?.[0]?.cancelled || 0;
    const statusBreakdown = (f.status || []).map((s) => ({ status: s._id, count: s.count }));

    const returns = summarizeReturns(returnDocs, totalOrders);
    const returnsOut = {
        totalReturns: returns.total,
        pendingReturns: returns.pending,
        completedReturns: returns.completed,
        rejectedReturns: returns.rejected,
        returnValue: returns.returnValue,
        refundedAmount: returns.refundedAmount,
        pendingRefundAmount: returns.pendingRefundAmount,
        returnRate: returns.returnRate,
    };

    // Refunds already paid out on orders that still count as sold (partial returns): those reduce sales.
    // Fully returned orders are excluded from sales above, so counting their refund again would double-deduct.
    const soldSet = new Set((f.soldIds?.[0]?.ids || []).map(String));
    let refundOnSold = 0;
    for (const r of returnDocs) {
        if (r.refundStatus !== 'processed' || !soldSet.has(String(r.orderId))) continue;
        const itemsValue = (r.items || []).reduce((s, i) => s + Number(i.price || 0) * Number(i.quantity || 1), 0);
        refundOnSold += Number(r.refundAmount ?? r.refundDetails?.amount ?? itemsValue) || 0;
    }

    const c = commissionRows[0] || {};
    const summary = {
        totalRevenue,
        refundsOnSales: round2(refundOnSold),
        netSales: round2(Math.max(totalRevenue - refundOnSold, 0)),
        averageOrderValue: soldOrders ? round2(totalRevenue / soldOrders) : 0,
        totalOrders: soldOrders,
        cancelledOrders,
        cancelRate: totalOrders ? Number(((cancelledOrders / totalOrders) * 100).toFixed(1)) : 0,
        totalProducts: productsCount,
        lowStockProducts: lowStock,
        outOfStockProducts: outOfStock,
        commission: round2(c.commission),
        netEarnings: round2(c.netEarnings),
        pendingEarnings: round2(c.pending),
        paidEarnings: round2(c.paid),
    };

    const comparison = {
        previousRevenue: previous.revenue,
        previousOrders: previous.orders,
        revenueChange: pctChange(totalRevenue, previous.revenue),
        ordersChange: pctChange(soldOrders, previous.orders),
    };

    res.status(200).json(
        new ApiResponse(
            200,
            {
                range: { period: range.label, from: start.toISOString(), to: end.toISOString() },
                summary,
                comparison,
                timeseries,
                statusBreakdown,
                topProducts: topProducts.map((p) => ({ productId: p._id, name: p.name || 'Unknown product', image: p.image || null, quantity: p.quantity, revenue: round2(p.revenue) })),
                returns: returnsOut,
            },
            'Analytics overview fetched.'
        )
    );
});
