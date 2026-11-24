import Invoice from '../models/Invoice.model.js';
import ReturnRequest from '../models/ReturnRequest.model.js';

/**
 * Return / Order / Invoice identifier mapping helpers.
 *
 * Identifier model:
 *  - Order.orderId          : "ORD-<ts>-<rand>"  (public Order ID, immutable)
 *  - Order.items[]._id      : Order Item ID (unique per purchased line, even for repeat purchases of a product)
 *  - ReturnRequest.returnId : "RET-<ts>-<rand>"  (public Return ID, unique, never equal to an Order ID)
 *  - ReturnRequest.items[].orderItemId -> Order.items[]._id (exact purchased line being returned)
 *  - Invoice.invoiceNumber  : "INV-..." (separate numbering, 1:1 with an order via Invoice.orderId)
 */

const ACTIVE_RETURN_STATUSES_EXCLUDED = ['rejected', 'claim_rejected'];

export const generateReturnId = () => {
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `RET-${Date.now()}-${random}`;
};

/** Deterministic Return ID for historical records created before returnId existed. */
export const legacyReturnId = (mongoId) => `RET-${String(mongoId || '').slice(-8).toUpperCase()}`;

export const getReturnDisplayId = (request) =>
    request?.returnId || legacyReturnId(request?._id || request?.id);

const toPlain = (value) =>
    value?._doc || (typeof value?.toObject === 'function' ? value.toObject() : value) || {};

/**
 * Find the exact order line a return item refers to.
 * Priority: orderItemId  ->  productId + variantKey  ->  productId (only if unambiguous).
 * Returns null when it cannot be resolved without guessing.
 */
export const matchOrderItem = (orderItems, returnItem) => {
    const items = Array.isArray(orderItems) ? orderItems : [];
    const orderItemId = String(returnItem?.orderItemId || '');
    if (orderItemId) {
        return items.find((it) => String(it?._id || '') === orderItemId) || null;
    }

    const productId = String(returnItem?.productId || '');
    if (!productId) return null;
    let candidates = items.filter((it) => String(it?.productId || '') === productId);
    if (returnItem?.variantKey) {
        const byVariant = candidates.filter((it) => String(it?.variantKey || '') === String(returnItem.variantKey));
        if (byVariant.length > 0) candidates = byVariant;
    }
    return candidates.length === 1 ? candidates[0] : null;
};

export const enrichReturnItems = (request) => {
    const orderItems = Array.isArray(request?.orderId?.items) ? request.orderId.items : [];
    const returnItems = Array.isArray(request?.items) ? request.items : [];

    return returnItems.map((rawItem) => {
        const item = toPlain(rawItem);
        const matched = matchOrderItem(orderItems, item);
        const orderItemId = item.orderItemId || matched?._id || null;

        return {
            ...item,
            productId: String(item.productId || matched?.productId || ''),
            orderItemId: orderItemId ? String(orderItemId) : null,
            variantKey: item.variantKey || matched?.variantKey || '',
            purchasedQuantity: Number(matched?.quantity || 0) || undefined,
            quantity: Number(item.quantity || matched?.quantity || 1),
            name: item.name || matched?.name || 'Unknown Product',
            price: Number(item.price ?? matched?.price ?? 0),
            image: item.image || matched?.image || '',
        };
    });
};

/** Map<orderObjectIdString, invoiceNumber> for a set of order _ids. */
export const getInvoiceNumberMap = async (orderObjectIds = []) => {
    const ids = [...new Set(orderObjectIds.filter(Boolean).map(String))];
    if (ids.length === 0) return new Map();
    const invoices = await Invoice.find({ orderId: { $in: ids } }).select('orderId invoiceNumber').lean();
    return new Map(invoices.map((inv) => [String(inv.orderId), inv.invoiceNumber]));
};

/**
 * Identifier block shared by every role (customer / vendor / admin) so the
 * same fields are returned everywhere.
 */
export const buildReturnIdentifiers = (request, invoiceMap = new Map()) => {
    const orderRefId = request?.orderId?._id || request?.orderId || null;
    return {
        returnId: getReturnDisplayId(request),
        returnIdIsLegacy: !request?.returnId,
        orderId: request?.orderId?.orderId || request?.orderNumber || (orderRefId ? String(orderRefId) : ''),
        orderRefId: orderRefId ? String(orderRefId) : null,
        invoiceNumber: invoiceMap.get(String(orderRefId)) || '',
    };
};

/** Regex-safe search helper. */
export const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Quantity already claimed per order item by other (non-rejected) returns.
 * Keyed by orderItemId; legacy items without orderItemId are resolved through matchOrderItem.
 */
export const getReturnedQuantities = async (order, { session = null } = {}) => {
    const existing = await ReturnRequest.find({
        orderId: order._id,
        status: { $nin: ACTIVE_RETURN_STATUSES_EXCLUDED },
    }).session(session);

    const used = new Map();
    for (const req of existing) {
        for (const rawItem of req.items || []) {
            const item = toPlain(rawItem);
            const matched = matchOrderItem(order.items, item);
            const key = String(item.orderItemId || matched?._id || '');
            if (!key) continue;
            used.set(key, (used.get(key) || 0) + Number(item.quantity || 0));
        }
    }
    return used;
};

// Return states that mean the goods are really coming back (pending/rejected requests don't count).
const ACCEPTED_RETURN_STATUSES = ['approved', 'processing', 'completed', 'return_initiated', 'in_transit', 'qc_center', 'refund_processed'];

/**
 * True only when every unit of every line on the order is covered by an accepted return.
 * A partial return (e.g. 2 of 5 units) must NOT flip the whole order to "returned".
 */
export const isOrderFullyReturned = async (order, { session = null } = {}) => {
    const accepted = await ReturnRequest.find({
        orderId: order._id,
        status: { $in: ACCEPTED_RETURN_STATUSES },
    }).session(session);

    const returned = new Map();
    for (const req of accepted) {
        for (const rawItem of req.items || []) {
            const item = toPlain(rawItem);
            const matched = matchOrderItem(order.items, item);
            const key = String(item.orderItemId || matched?._id || '');
            if (!key) continue;
            returned.set(key, (returned.get(key) || 0) + Number(item.quantity || 0));
        }
    }

    const lines = order.items || [];
    if (lines.length === 0) return false;
    return lines.every((line) => (returned.get(String(line._id)) || 0) >= Number(line.quantity || 0));
};

/**
 * Refund owed for `qty` units of an order line: the price paid plus the GST charged on those units.
 * GST is only added when it was charged on top of the price (taxIncluded === false);
 * if the price already included tax, the price alone is the full amount paid.
 */
export const lineRefundParts = (orderItem, qty) => {
    const quantity = Number(qty || 0);
    const orderedQty = Number(orderItem?.quantity || 0);
    const base = Number(orderItem?.price || 0) * quantity;
    const gst = !orderItem?.taxIncluded && orderedQty > 0
        ? Number(orderItem?.gstAmount || 0) * (quantity / orderedQty)
        : 0;
    // The buyer paid the line price minus this line's share of any coupon, so refund the same.
    const discount = orderedQty > 0 ? Number(orderItem?.discount || 0) * (quantity / orderedQty) : 0;
    return { base, gst: Math.round(gst * 100) / 100, discount: Math.round(discount * 100) / 100 };
};

