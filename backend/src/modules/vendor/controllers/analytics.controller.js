import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import Order from '../../../models/Order.model.js';
import Product from '../../../models/Product.model.js';
import Commission from '../../../models/Commission.model.js';
import ReturnRequest from '../../../models/ReturnRequest.model.js';
import mongoose from 'mongoose';

const toDateKey = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
};

const getDateRange = (period = 'month') => {
    const now = new Date();
    if (period === 'today') {
        return {
            start: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            end: now,
        };
    }
    if (period === 'week') {
        return {
            start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
            end: now,
        };
    }
    if (period === 'year') {
        return {
            start: new Date(now.getFullYear(), 0, 1),
            end: now,
        };
    }
    return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: now,
    };
};

const getVendorOrderStatus = (order, vendorIdsToMatch) => {
    const vendorItem = order?.vendorItems?.find(
        (vi) => vendorIdsToMatch.map(String).includes(String(vi?.vendorId))
    );
    return String(vendorItem?.status || order?.status || 'pending').toLowerCase();
};

const getVendorOrderRevenue = (order, vendorIdsToMatch) => {
    const vendorItem = order?.vendorItems?.find(
        (vi) => vendorIdsToMatch.map(String).includes(String(vi?.vendorId))
    );
    return Number(vendorItem?.subtotal || vendorItem?.vendorEarnings || 0);
};

export const getAnalyticsOverview = asyncHandler(async (req, res) => {
    const period = String(req.query?.period || 'month').toLowerCase();
    const { start, end } = getDateRange(period);

    const vendorIdsToMatch = req.user.role === 'managed_vendor'
        ? [req.user.shopId, req.user.id].filter(Boolean)
        : [req.user.id];

    const productQuery = req.user.role === 'managed_vendor'
        ? { $or: [{ shopId: req.user.shopId }, { vendorId: { $in: vendorIdsToMatch } }, { vendorUserId: req.user.id }] }
        : { vendorId: req.user.id };

    const [orders, productsCount, commissions, returnDocs, periodOrderCount] = await Promise.all([
        Order.find({
            'vendorItems.vendorId': { $in: vendorIdsToMatch },
            isDeleted: { $ne: true },
            status: { $nin: ['cancelled', 'returned'] },
            createdAt: { $gte: start, $lte: end },
        })
            .select('createdAt date status vendorItems')
            .sort({ createdAt: 1 })
            .lean(),
        Product.countDocuments(productQuery),
        Commission.find({
            vendorId: { $in: vendorIdsToMatch },
            status: { $ne: 'cancelled' },
            createdAt: { $gte: start, $lte: end },
        })
            .select('vendorEarnings status')
            .lean(),
        ReturnRequest.find({
            vendorId: { $in: vendorIdsToMatch },
            createdAt: { $gte: start, $lte: end },
        })
            .select('status refundAmount refundStatus refundDetails.amount items.price items.quantity')
            .lean(),
        Order.countDocuments({
            'vendorItems.vendorId': { $in: vendorIdsToMatch },
            isDeleted: { $ne: true },
            createdAt: { $gte: start, $lte: end },
        }),
    ]);

    const REJECTED = ['rejected', 'claim_rejected'];
    const COMPLETED = ['completed', 'refund_processed'];
    let rejectedReturns = 0, completedReturns = 0, refundedAmount = 0, pendingRefundAmount = 0, returnValue = 0;
    for (const r of returnDocs) {
        if (REJECTED.includes(r.status)) rejectedReturns += 1;
        else if (COMPLETED.includes(r.status)) completedReturns += 1;

        const itemsValue = (r.items || []).reduce((s, i) => s + Number(i.price || 0) * Number(i.quantity || 1), 0);
        const amount = Number(r.refundAmount ?? r.refundDetails?.amount ?? itemsValue) || 0;
        if (!REJECTED.includes(r.status)) returnValue += amount;
        if (r.refundStatus === 'processed') refundedAmount += amount;
        else if (r.refundStatus === 'pending' && !REJECTED.includes(r.status)) pendingRefundAmount += amount;
    }
    const returns = {
        totalReturns: returnDocs.length,
        pendingReturns: returnDocs.length - rejectedReturns - completedReturns,
        completedReturns,
        rejectedReturns,
        returnValue,
        refundedAmount,
        pendingRefundAmount,
        returnRate: periodOrderCount > 0
            ? Number(((returnDocs.length / periodOrderCount) * 100).toFixed(1))
            : 0,
    };

    const dailyMap = {};
    const statusCounts = {};
    let activeOrdersCount = 0;
    for (const order of orders) {
        const vendorItem = order?.vendorItems?.find(
            (vi) => vendorIdsToMatch.map(String).includes(String(vi?.vendorId))
        );
        if (!vendorItem) continue;
        if (['cancelled', 'returned'].includes(String(vendorItem?.status || '').toLowerCase())) continue;

        const dateKey = toDateKey(order?.createdAt || order?.date);
        if (!dateKey) continue;

        const revenue = getVendorOrderRevenue(order, vendorIdsToMatch);
        if (!dailyMap[dateKey]) {
            dailyMap[dateKey] = { date: dateKey, revenue: 0, orders: 0 };
        }
        dailyMap[dateKey].revenue += revenue;
        dailyMap[dateKey].orders += 1;
        activeOrdersCount += 1;

        const status = getVendorOrderStatus(order, vendorIdsToMatch);
        statusCounts[status] = (statusCounts[status] || 0) + 1;
    }

    const timeseries = Object.values(dailyMap).sort(
        (a, b) => new Date(a.date) - new Date(b.date)
    );

    const totalRevenue = timeseries.reduce((sum, point) => sum + Number(point?.revenue || 0), 0);
    const pendingEarnings = commissions
        .filter((c) => c?.status === 'pending')
        .reduce((sum, c) => sum + Number(c?.vendorEarnings || 0), 0);

    const summary = {
        totalRevenue,
        pendingEarnings,
        totalOrders: activeOrdersCount,
        totalProducts: productsCount,
    };

    const statusBreakdown = Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
    }));

    res.status(200).json(
        new ApiResponse(
            200,
            { summary, timeseries, statusBreakdown, returns },
            'Analytics overview fetched.'
        )
    );
});
