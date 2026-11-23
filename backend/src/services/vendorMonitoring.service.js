import mongoose from 'mongoose';
import Order from '../models/Order.model.js';
import Product from '../models/Product.model.js';
import ReturnRequest from '../models/ReturnRequest.model.js';
import VendorChatThread from '../models/VendorChatThread.model.js';
import VendorChatMessage from '../models/VendorChatMessage.model.js';
import { istDateRangeFilter } from '../utils/istDateRange.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
// Orders that did not go through: they are counted but never in sales value / customers / payment mix
const NOT_SOLD = ['cancelled', 'returned'];
const REJECTED = ['rejected', 'claim_rejected'];
const COMPLETED = ['completed', 'refund_processed'];

/** One row per order that contains this vendor's goods, with the value of just this vendor's lines. */
const vendorOrderRows = (vendorId, range) => [
    { $match: { 'vendorItems.vendorId': vendorId, isDeleted: { $ne: true }, ...range } },
    {
        $project: {
            status: 1, paymentMethod: 1, paymentStatus: 1, userId: 1, guestInfo: 1, createdAt: 1,
            groups: { $filter: { input: '$vendorItems', as: 'g', cond: { $eq: ['$$g.vendorId', vendorId] } } },
        },
    },
    {
        $addFields: {
            // goods value = price x qty minus this line's share of the coupon
            goods: {
                $reduce: {
                    input: '$groups', initialValue: 0,
                    in: {
                        $add: ['$$value', {
                            $reduce: {
                                input: '$$this.items', initialValue: 0,
                                in: { $add: ['$$value', { $subtract: [{ $multiply: [{ $ifNull: ['$$this.price', 0] }, { $ifNull: ['$$this.quantity', 0] }] }, { $ifNull: ['$$this.discount', 0] }] }] },
                            },
                        }],
                    },
                },
            },
            customerKey: {
                $ifNull: [
                    { $cond: [{ $ne: ['$userId', null] }, { $concat: ['u:', { $toString: '$userId' }] }, null] },
                    { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$guestInfo.email', ''] } }, 0] }, { $concat: ['g:', { $toLower: '$guestInfo.email' }] }, { $concat: ['p:', { $ifNull: ['$guestInfo.phone', { $toString: '$_id' }] }] }] },
                ],
            },
        },
    },
];

const summarizeReturns = (docs, orderCount) => {
    let rejected = 0, completed = 0, returnValue = 0, refunded = 0, pendingRefund = 0;
    for (const r of docs) {
        if (REJECTED.includes(r.status)) rejected += 1;
        else if (COMPLETED.includes(r.status)) completed += 1;
        const itemsValue = (r.items || []).reduce((s, i) => s + Number(i.price || 0) * Number(i.quantity || 1), 0);
        const amount = Number(r.refundAmount ?? r.refundDetails?.amount ?? itemsValue) || 0;
        if (!REJECTED.includes(r.status)) returnValue += amount;
        if (r.refundStatus === 'processed') refunded += amount;
        else if (r.refundStatus === 'pending' && !REJECTED.includes(r.status)) pendingRefund += amount;
    }
    return {
        total: docs.length,
        pending: docs.length - rejected - completed,
        completed,
        rejected,
        returnValue: round2(returnValue),
        refundedAmount: round2(refunded),
        pendingRefundAmount: round2(pendingRefund),
        returnRate: orderCount > 0 ? Number(((docs.length / orderCount) * 100).toFixed(1)) : 0,
    };
};

/**
 * Everything an admin needs to judge one vendor: catalogue size, orders and sales value, unique and
 * repeat customers, payment-mode mix, returns and refunds, and chat activity. Counted in the
 * database. Optional ?from= / ?to= (India calendar days) limit orders, returns and chats.
 */
export const getVendorMonitoring = async (vendorIdRaw, { from, to } = {}) => {
    const vendorId = new mongoose.Types.ObjectId(String(vendorIdRaw));
    const orderRange = istDateRangeFilter({ from, to }, 'createdAt');
    const chatRange = istDateRangeFilter({ from, to }, 'createdAt');

    const [productFacets, orderFacets, returnDocs, threadFacets] = await Promise.all([
        Product.aggregate([
            { $match: { vendorId, isSourceProduct: { $ne: true } } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    live: { $sum: { $cond: [{ $and: [{ $eq: ['$isActive', true] }, { $not: [{ $in: ['$approvalStatus', ['draft', 'pending', 'rejected', 'archived']] }] }] }, 1, 0] } },
                    pendingApproval: { $sum: { $cond: [{ $eq: ['$approvalStatus', 'pending'] }, 1, 0] } },
                    rejected: { $sum: { $cond: [{ $eq: ['$approvalStatus', 'rejected'] }, 1, 0] } },
                    outOfStock: { $sum: { $cond: [{ $eq: ['$stock', 'out_of_stock'] }, 1, 0] } },
                },
            },
        ]),
        Order.aggregate([
            ...vendorOrderRows(vendorId, orderRange),
            {
                $facet: {
                    byStatus: [{ $group: { _id: '$status', orders: { $sum: 1 }, value: { $sum: '$goods' } } }],
                    byPayment: [
                        { $match: { status: { $nin: NOT_SOLD } } },
                        { $group: { _id: { $ifNull: ['$paymentMethod', 'unknown'] }, orders: { $sum: 1 }, value: { $sum: '$goods' }, paidOrders: { $sum: { $cond: [{ $in: ['$paymentStatus', ['paid', 'captured', 'success']] }, 1, 0] } } } },
                    ],
                    customers: [
                        { $match: { status: { $nin: NOT_SOLD } } },
                        { $group: { _id: '$customerKey', orders: { $sum: 1 } } },
                        { $group: { _id: null, unique: { $sum: 1 }, repeat: { $sum: { $cond: [{ $gt: ['$orders', 1] }, 1, 0] } } } },
                    ],
                    firstLast: [{ $group: { _id: null, first: { $min: '$createdAt' }, last: { $max: '$createdAt' } } }],
                },
            },
        ]),
        ReturnRequest.find({ vendorId, ...istDateRangeFilter({ from, to }, 'createdAt') })
            .select('status refundAmount refundStatus refundDetails.amount items.price items.quantity')
            .lean(),
        VendorChatThread.aggregate([
            { $match: { vendorId, ...chatRange } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    active: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$status', 'active'] }, 'active'] }, 1, 0] } },
                    resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
                    closed: { $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] } },
                    enquiries: { $sum: { $cond: [{ $ne: [{ $ifNull: ['$productRef', null] }, null] }, 1, 0] } },
                    lastActivity: { $max: '$lastActivity' },
                    ids: { $push: '$_id' },
                },
            },
        ]),
    ]);

    const f = orderFacets[0] || {};
    const byStatus = (f.byStatus || []).map((s) => ({ status: s._id, orders: s.orders, value: round2(s.value) })).sort((a, b) => b.orders - a.orders);
    const totalOrders = byStatus.reduce((s, x) => s + x.orders, 0);
    const sold = byStatus.filter((s) => !NOT_SOLD.includes(s.status));
    const soldOrders = sold.reduce((s, x) => s + x.orders, 0);
    const salesValue = sold.reduce((s, x) => s + x.value, 0);
    const stat = (name) => byStatus.find((s) => s.status === name) || { orders: 0, value: 0 };

    const payments = (f.byPayment || [])
        .map((p) => ({ method: p._id, orders: p.orders, value: round2(p.value), paidOrders: p.paidOrders, sharePercent: soldOrders ? Number(((p.orders / soldOrders) * 100).toFixed(1)) : 0 }))
        .sort((a, b) => b.orders - a.orders);

    const t = threadFacets[0];
    const threadIds = t?.ids || [];
    const messages = threadIds.length ? await VendorChatMessage.countDocuments({ threadId: { $in: threadIds } }) : 0;

    const pf = productFacets[0] || {};
    return {
        vendorId: String(vendorId),
        range: { from: from || null, to: to || null },
        products: { total: pf.total || 0, live: pf.live || 0, pendingApproval: pf.pendingApproval || 0, rejected: pf.rejected || 0, outOfStock: pf.outOfStock || 0 },
        orders: {
            total: totalOrders,
            sold: soldOrders,
            cancelled: stat('cancelled').orders,
            returned: stat('returned').orders,
            salesValue: round2(salesValue),
            averageOrderValue: soldOrders ? round2(salesValue / soldOrders) : 0,
            cancelledValue: round2(stat('cancelled').value),
            returnedValue: round2(stat('returned').value),
            firstOrderAt: f.firstLast?.[0]?.first || null,
            lastOrderAt: f.firstLast?.[0]?.last || null,
            byStatus,
        },
        customers: { unique: f.customers?.[0]?.unique || 0, repeat: f.customers?.[0]?.repeat || 0 },
        payments,
        returns: summarizeReturns(returnDocs, totalOrders),
        chats: {
            total: t?.total || 0, active: t?.active || 0, resolved: t?.resolved || 0, closed: t?.closed || 0,
            enquiries: t?.enquiries || 0, messages, lastActivity: t?.lastActivity || null,
        },
    };
};
