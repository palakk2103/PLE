import Order from '../models/Order.model.js';
import Vendor from '../models/Vendor.model.js';
import Commission from '../models/Commission.model.js';
import ReturnRequest from '../models/ReturnRequest.model.js';
import { istDateRangeFilter } from '../utils/istDateRange.js';
import { summarizeReturns } from './vendorMonitoring.service.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
// Orders / vendor groups that did not go through: counted, but never in sales value
const NOT_SOLD = ['cancelled', 'returned'];

const emptyRow = (vendor) => ({
    id: String(vendor._id),
    name: vendor.name,
    storeName: vendor.storeName,
    email: vendor.email,
    status: vendor.status,
    commissionRate: vendor.commissionRate ?? null,
    orders: { total: 0, sold: 0, cancelled: 0, returned: 0, salesValue: 0, averageOrderValue: 0, cancelRate: 0 },
    earnings: { commission: 0, netEarnings: 0, pending: 0, paid: 0 },
    returns: summarizeReturns([], 0),
});

/**
 * Per-vendor performance for the admin Vendor Analytics page: orders, sales value (this vendor's own
 * lines after coupon, cancelled/returned excluded), commission and earnings from the Commission ledger,
 * and returns/refunds. Everything is counted in the database; one row per vendor, including vendors with
 * no activity. ?from= / ?to= are India calendar days.
 */
export const getVendorsAnalytics = async ({ from, to, status = 'approved', search } = {}) => {
    const range = istDateRangeFilter({ from, to }, 'createdAt');

    const vendorQuery = {};
    vendorQuery.status = status && status !== 'all' ? status : { $ne: 'deleted' };
    if (search) {
        const rx = new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        vendorQuery.$or = [{ storeName: rx }, { name: rx }, { email: rx }];
    }

    const [vendors, orderRows, commissionRows, returnDocs] = await Promise.all([
        Vendor.find(vendorQuery).select('name storeName email status commissionRate').lean(),
        Order.aggregate([
            { $match: { isDeleted: { $ne: true }, ...range } },
            { $unwind: '$vendorItems' },
            {
                $project: {
                    vendorId: '$vendorItems.vendorId',
                    sold: {
                        $and: [
                            { $not: [{ $in: ['$status', NOT_SOLD] }] },
                            { $not: [{ $in: [{ $ifNull: ['$vendorItems.status', 'pending'] }, ['cancelled']] }] },
                        ],
                    },
                    orderStatus: '$status',
                    goods: {
                        $reduce: {
                            input: { $ifNull: ['$vendorItems.items', []] }, initialValue: 0,
                            in: { $add: ['$$value', { $subtract: [{ $multiply: [{ $ifNull: ['$$this.price', 0] }, { $ifNull: ['$$this.quantity', 0] }] }, { $ifNull: ['$$this.discount', 0] }] }] },
                        },
                    },
                },
            },
            {
                $group: {
                    _id: '$vendorId',
                    total: { $sum: 1 },
                    sold: { $sum: { $cond: ['$sold', 1, 0] } },
                    salesValue: { $sum: { $cond: ['$sold', '$goods', 0] } },
                    cancelled: { $sum: { $cond: [{ $eq: ['$orderStatus', 'cancelled'] }, 1, 0] } },
                    returned: { $sum: { $cond: [{ $eq: ['$orderStatus', 'returned'] }, 1, 0] } },
                },
            },
        ]),
        Commission.aggregate([
            { $match: { ...range, status: { $ne: 'cancelled' }, clearanceStatus: { $nin: ['cancelled', 'refunded'] } } },
            {
                $group: {
                    _id: '$vendorId',
                    commission: { $sum: { $ifNull: ['$commission', 0] } },
                    netEarnings: { $sum: { $ifNull: ['$vendorEarnings', 0] } },
                    pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, { $ifNull: ['$vendorEarnings', 0] }, 0] } },
                    paid: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, { $ifNull: ['$vendorEarnings', 0] }, 0] } },
                },
            },
        ]),
        ReturnRequest.find({ ...range })
            .select('vendorId status refundAmount refundStatus refundDetails.amount items.price items.quantity')
            .lean(),
    ]);

    const rows = new Map(vendors.map((v) => [String(v._id), emptyRow(v)]));

    for (const o of orderRows) {
        const row = rows.get(String(o._id));
        if (!row) continue;
        row.orders = {
            total: o.total, sold: o.sold, cancelled: o.cancelled, returned: o.returned,
            salesValue: round2(o.salesValue),
            averageOrderValue: o.sold ? round2(o.salesValue / o.sold) : 0,
            cancelRate: o.total ? Number(((o.cancelled / o.total) * 100).toFixed(1)) : 0,
        };
    }
    for (const c of commissionRows) {
        const row = rows.get(String(c._id));
        if (row) row.earnings = { commission: round2(c.commission), netEarnings: round2(c.netEarnings), pending: round2(c.pending), paid: round2(c.paid) };
    }
    const returnsByVendor = new Map();
    for (const r of returnDocs) {
        const key = String(r.vendorId || '');
        if (!rows.has(key)) continue;
        if (!returnsByVendor.has(key)) returnsByVendor.set(key, []);
        returnsByVendor.get(key).push(r);
    }
    for (const [key, docs] of returnsByVendor) {
        rows.get(key).returns = summarizeReturns(docs, rows.get(key).orders.total);
    }

    const list = [...rows.values()].sort((a, b) => b.orders.salesValue - a.orders.salesValue);
    const sum = (pick) => round2(list.reduce((s, v) => s + pick(v), 0));
    const totals = {
        vendors: list.length,
        activeVendors: list.filter((v) => v.orders.total > 0).length,
        orders: list.reduce((s, v) => s + v.orders.sold, 0),
        salesValue: sum((v) => v.orders.salesValue),
        commission: sum((v) => v.earnings.commission),
        netEarnings: sum((v) => v.earnings.netEarnings),
        pendingEarnings: sum((v) => v.earnings.pending),
        paidEarnings: sum((v) => v.earnings.paid),
        returns: list.reduce((s, v) => s + v.returns.total, 0),
        returnValue: sum((v) => v.returns.returnValue),
        refundedAmount: sum((v) => v.returns.refundedAmount),
        pendingRefundAmount: sum((v) => v.returns.pendingRefundAmount),
    };

    return { range: { from: from || null, to: to || null }, totals, vendors: list };
};
