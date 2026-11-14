/**
 * Consumer RFQ service (customer -> product owner -> customer -> order).
 *
 * Two flows share one implementation, selected by rfq.targetType:
 *   - 'admin'  : Admin-owned product  -> Super Admin negotiates (full control)
 *   - 'vendor' : Seller-owned product -> that vendor negotiates (admin read-only)
 *
 * Everything security-relevant (ownership, targetType, sellerId, prices) is derived
 * on the server from DB records and the authenticated actor, never from the client.
 * Managed Sourcing / Direct B2B RFQs are untouched: every query here is scoped by
 * rfqType === 'consumer'.
 */
import mongoose from 'mongoose';
import RFQ from '../models/RFQ.model.js';
import Product from '../models/Product.model.js';
import Vendor from '../models/Vendor.model.js';
import Order from '../models/Order.model.js';
import Address from '../models/Address.model.js';
import Commission from '../models/Commission.model.js';
import Admin from '../models/Admin.model.js';
import { User } from '../models/User.model.js';
import ApiError from '../utils/ApiError.js';
import { generateOrderId } from '../utils/generateOrderId.js';
import { generateTrackingNumber } from '../utils/generateTrackingNumber.js';
import { resolveProductGST, calculateItemGST } from '../utils/gstUtils.js';
import { createNotification } from './notification.service.js';
import { generateInvoiceForOrder, sendOrderInvoiceEmail } from './invoice.service.js';
import { handleOrderStatusTransition } from './orderStatus.service.js';
import { getIO } from '../config/socket.js';
import { moderateMessage, validateMonetaryOffer, MODERATION_ACTION } from './chatModeration.service.js';

export const OPEN_STATUSES = ['Pending', 'Negotiating', 'Quotation Sent', 'Counter Offer'];
export const TERMINAL_STATUSES = ['Rejected', 'Converted To Order'];
const OWNER_REPLY_STATUSES = ['Pending', 'Negotiating', 'Counter Offer'];

const money = (n) => Math.round(Number(n) * 100) / 100;
const CONSUMER = { rfqType: 'consumer' };

const generateRfqId = () => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `RFQ-${dateStr}-${Math.floor(10000 + Math.random() * 90000)}`;
};

/* ───────────────────────── validation helpers ───────────────────────── */

const assertPrice = (price) => {
    const check = validateMonetaryOffer(price);
    if (!check.isValid) throw new ApiError(400, check.reason);
    return money(price);
};

const assertQuantity = (qty) => {
    const n = Number(qty);
    if (!Number.isInteger(n) || n < 1 || n > 1000000) {
        throw new ApiError(400, 'Quantity must be a whole number of at least 1.');
    }
    return n;
};

const moderate = (text) => {
    const clean = String(text || '').trim();
    if (!clean) return '';
    const res = moderateMessage(clean);
    if (res.action === MODERATION_ACTION.BLOCK) {
        throw new ApiError(400, res.userMessage || 'Message blocked: sharing contact or payment details is not allowed.');
    }
    return clean.slice(0, 2000);
};

/* ───────────────────────── ownership ───────────────────────── */

/**
 * Derives who owns a product from the DB record.
 *  - Managed shop / admin-managed listing => PLE Admin owns it.
 *  - Independent vendor product           => that vendor owns it.
 */
export const resolveOwnership = async (product) => {
    const adminOwned = !!product.shopId || (product.listingType && product.listingType !== 'vendor_direct');
    if (adminOwned) return { targetType: 'admin', sellerId: undefined };

    if (!product.vendorId) throw new ApiError(422, 'This product has no valid seller and cannot receive RFQs.');
    const vendor = await Vendor.findById(product.vendorId?._id || product.vendorId).select('status isDeleted storeName').lean();
    if (!vendor || vendor.isDeleted || vendor.status !== 'approved') {
        throw new ApiError(422, 'The seller of this product is currently unavailable.');
    }
    return { targetType: 'vendor', sellerId: vendor._id };
};

const assertProductQuotable = (product) => {
    const live =
        product.isActive !== false &&
        product.isVisible !== false &&
        (!product.approvalStatus || product.approvalStatus === 'approved') &&
        (!product.publicationStatus || product.publicationStatus === 'published');
    if (!live) throw new ApiError(400, 'This product is no longer available.');
    if (product.stock === 'out_of_stock') throw new ApiError(400, 'This product is out of stock.');
};

/* ───────────────────────── actor access ───────────────────────── */

/** actor: { role: 'customer'|'admin'|'seller', id, name } */
const canView = (rfq, actor) => {
    if (actor.role === 'customer') return String(rfq.buyerId?._id || rfq.buyerId) === String(actor.id);
    if (actor.role === 'seller') {
        return rfq.targetType === 'vendor' && String(rfq.sellerId?._id || rfq.sellerId) === String(actor.id);
    }
    return actor.role === 'admin';
};

/** Only the product owner may operate on the quotation side. Admin is read-only on vendor RFQs. */
const assertOwnerOperates = (rfq, actor) => {
    if (actor.role === 'admin') {
        if (rfq.targetType !== 'admin') {
            throw new ApiError(403, 'Seller-owned RFQs are read-only for admins. Only the product vendor can act on them.');
        }
        return 'admin';
    }
    if (actor.role === 'seller') {
        if (rfq.targetType !== 'vendor' || String(rfq.sellerId) !== String(actor.id)) {
            throw new ApiError(404, 'RFQ not found.');
        }
        return 'seller';
    }
    throw new ApiError(403, 'Not allowed.');
};

const loadRfq = async (id, actor) => {
    if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'RFQ not found.');
    const rfq = await RFQ.findOne({ _id: id, ...CONSUMER });
    // 404 (not 403) so existence of other parties' RFQs is not revealed.
    if (!rfq || !canView(rfq, actor)) throw new ApiError(404, 'RFQ not found.');
    return rfq;
};

/* ───────────────────────── serialization ───────────────────────── */

const permissionsFor = (rfq, actor) => {
    const open = OPEN_STATUSES.includes(rfq.status);
    const terminal = TERMINAL_STATUSES.includes(rfq.status);
    const by = rfq.currentOffer?.by;
    const perms = {
        readOnly: false, canQuote: false, canAcceptOffer: false, canReject: false,
        canMessage: false, canCounter: false, canAccept: false, canConvert: false,
    };
    if (actor.role === 'customer') {
        perms.canMessage = !terminal;
        perms.canCounter = ['Quotation Sent', 'Counter Offer'].includes(rfq.status);
        perms.canAccept = rfq.status === 'Quotation Sent' && by === 'owner';
        perms.canConvert = rfq.status === 'Accepted';
        perms.canReject = open || rfq.status === 'Accepted';
    } else if (actor.role === 'admin' && rfq.targetType === 'vendor') {
        perms.readOnly = true;
    } else {
        perms.canMessage = !terminal;
        perms.canQuote = open;
        perms.canAcceptOffer = OWNER_REPLY_STATUSES.includes(rfq.status) && by === 'customer' && rfq.currentOffer?.price > 0;
        perms.canReject = open;
    }
    return perms;
};

const awaitingFor = (rfq) => {
    if (OWNER_REPLY_STATUSES.includes(rfq.status)) return rfq.targetType === 'admin' ? 'admin' : 'vendor';
    if (rfq.status === 'Quotation Sent' || rfq.status === 'Accepted') return 'customer';
    return null;
};

const POPULATE = [
    { path: 'productId', select: 'name image images price unit stockQuantity stock listingType' },
    { path: 'sellerId', select: 'storeName name' },
    { path: 'convertedOrderId', select: 'orderId status total paymentMethod' },
];

export const serialize = async (rfqDoc, actor) => {
    const doc = rfqDoc.populated && rfqDoc.populated('productId') ? rfqDoc : await rfqDoc.populate(POPULATE);
    await doc.populate({
        path: 'buyerId',
        select: actor.role === 'admin' ? 'name email phone' : 'name',
    });
    const o = doc.toObject();
    // Strip legacy B2B-only fields that are meaningless for consumer RFQs.
    delete o.quotations; delete o.negotiationMessages; delete o.approvalHistory; delete o.timeline;
    delete o.assignedVendorIds; delete o.targetPrice;
    o.ownerLabel = o.targetType === 'admin' ? 'PLE (Admin)' : (o.sellerId?.storeName || o.sellerId?.name || 'Seller');
    o.awaiting = awaitingFor(o);
    o.permissions = permissionsFor(o, actor);
    return o;
};

/* ───────────────────────── notifications / realtime ───────────────────────── */

const safe = (p) => Promise.resolve(p).catch((e) => console.error('[ConsumerRFQ] side-effect failed:', e?.message));

/**
 * Notify the counterpart(s) once and emit a single socket event per room set.
 * Failures never break the business action.
 */
const announce = async (rfq, { actorRole, title, message, extra = {} }) => {
    const data = { rfqId: rfq.rfqId, id: String(rfq._id), ...extra };
    const toCustomer = () => createNotification({
        recipientId: rfq.buyerId?._id || rfq.buyerId, recipientType: 'user', title, message, type: 'system', data,
    });
    const toOwner = () => (rfq.targetType === 'admin'
        ? createNotification({ recipientType: 'admin', title, message, type: 'system', data })
        : createNotification({ recipientId: rfq.sellerId?._id || rfq.sellerId, recipientType: 'vendor', title, message, type: 'system', data }));

    if (actorRole === 'customer') await safe(toOwner());
    else await safe(toCustomer());

    try {
        const io = getIO();
        const rooms = [`user_${rfq.buyerId?._id || rfq.buyerId}`, 'admin_room'];
        if (rfq.targetType === 'vendor') rooms.push(`user_${rfq.sellerId?._id || rfq.sellerId}`);
        io.to(rooms).emit('consumer_rfq_updated', {
            id: String(rfq._id), rfqId: rfq.rfqId, status: rfq.status, targetType: rfq.targetType, title,
        });
    } catch {
        /* socket not initialised / disconnected: DB notification already persisted */
    }
};

/* ───────────────────────── create ───────────────────────── */

export const createConsumerRfq = async ({ user, productId, quantity, expectedPrice, message }) => {
    const qty = assertQuantity(quantity);
    const expected = expectedPrice === undefined || expectedPrice === null || expectedPrice === '' ? undefined : assertPrice(expectedPrice);
    const note = moderate(message);

    if (!mongoose.isValidObjectId(productId)) throw new ApiError(404, 'Product not found.');
    const product = await Product.findById(productId);
    if (!product) throw new ApiError(404, 'Product not found.');
    assertProductQuotable(product);
    if (product.stockQuantity < qty) {
        throw new ApiError(400, `Only ${product.stockQuantity} units are available for this product.`);
    }
    const { targetType, sellerId } = await resolveOwnership(product);

    const duplicate = await RFQ.exists({ ...CONSUMER, buyerId: user.id, productId: product._id, status: { $in: [...OPEN_STATUSES, 'Accepted'] } });
    if (duplicate) throw new ApiError(409, 'You already have an open RFQ for this product. Please continue that conversation.');

    const customer = await User.findById(user.id).select('name email').lean();
    let rfq;
    for (let attempt = 0; attempt < 4 && !rfq; attempt++) {
        try {
            rfq = await RFQ.create({
                rfqId: generateRfqId(),
                rfqType: 'consumer',
                targetType,
                sellerId,
                buyerId: user.id,
                productId: product._id,
                quantity: qty,
                expectedPrice: expected,
                requirementDetails: note || undefined,
                status: 'Pending',
                currentOffer: { by: 'customer', price: expected, quantity: qty, version: 1 },
                consumerTimeline: [{
                    senderId: user.id, senderType: 'customer', senderName: customer?.name,
                    action: 'rfq_created', message: note || 'Request for quotation submitted.',
                    priceOffer: expected, quantity: qty, offerVersion: 1,
                }],
            });
        } catch (err) {
            if (err?.code !== 11000 || attempt === 3) throw err;
        }
    }

    await announce(rfq, {
        actorRole: 'customer',
        title: 'New Customer RFQ',
        message: `New quotation request for ${product.name} (qty ${qty}).`,
    });
    return rfq;
};

/* ───────────────────────── listing / detail ───────────────────────── */

const buildFilter = (actor, { status, scope, search }) => {
    const f = { ...CONSUMER };
    if (actor.role === 'customer') f.buyerId = actor.id;
    else if (actor.role === 'seller') { f.targetType = 'vendor'; f.sellerId = actor.id; }
    else if (scope === 'admin' || scope === 'vendor') f.targetType = scope;
    if (status && status !== 'all') f.status = String(status);
    if (search) f.rfqId = { $regex: String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    return f;
};

export const listConsumerRfqs = async (actor, query = {}) => {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
    const filter = buildFilter(actor, query);
    const [rows, total] = await Promise.all([
        RFQ.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit)
            .populate(POPULATE).populate({ path: 'buyerId', select: actor.role === 'admin' ? 'name email phone' : 'name' }),
        RFQ.countDocuments(filter),
    ]);
    const items = rows.map((doc) => {
        const o = doc.toObject();
        delete o.quotations; delete o.negotiationMessages; delete o.approvalHistory; delete o.timeline;
        delete o.assignedVendorIds; delete o.targetPrice; delete o.consumerTimeline;
        o.ownerLabel = o.targetType === 'admin' ? 'PLE (Admin)' : (o.sellerId?.storeName || o.sellerId?.name || 'Seller');
        o.awaiting = awaitingFor(o);
        o.permissions = permissionsFor(o, actor);
        return o;
    });
    return { items, total, page, pages: Math.ceil(total / limit) || 1 };
};

export const getConsumerRfq = async (id, actor) => serialize(await loadRfq(id, actor), actor);

/* ───────────────────────── state transitions ───────────────────────── */

/** Optimistic, atomic transition: fails with 409 if status or offer version changed meanwhile. */
const transition = async (rfq, { set = {}, entry, allowedStatuses, extraFilter = {} }) => {
    const updated = await RFQ.findOneAndUpdate(
        {
            _id: rfq._id, ...CONSUMER,
            status: { $in: allowedStatuses }, 'currentOffer.version': rfq.currentOffer?.version ?? 0,
            ...extraFilter,
        },
        { $set: set, $push: { consumerTimeline: entry } },
        { new: true },
    );
    if (!updated) throw new ApiError(409, 'This RFQ was just updated by another action. Please refresh and try again.');
    return updated;
};

const senderOf = (actor) => ({
    senderId: actor.id,
    senderType: actor.role === 'seller' ? 'seller' : actor.role,
    senderName: actor.name,
});

/** Owner (admin on admin RFQs / vendor on own RFQs) submits or revises a quotation. */
export const ownerQuote = async (id, actor, { price, quantity, message }) => {
    const rfq = await loadRfq(id, actor);
    assertOwnerOperates(rfq, actor);
    if (!OPEN_STATUSES.includes(rfq.status)) throw new ApiError(400, `Cannot quote an RFQ in "${rfq.status}" status.`);

    const unit = assertPrice(price);
    const qty = quantity === undefined ? rfq.currentOffer?.quantity || rfq.quantity : assertQuantity(quantity);
    const note = moderate(message);
    const version = (rfq.currentOffer?.version || 0) + 1;
    const action = 'quotation';

    const updated = await transition(rfq, {
        allowedStatuses: OPEN_STATUSES,
        set: {
            status: 'Quotation Sent', quotedPrice: unit,
            currentOffer: { by: 'owner', price: unit, quantity: qty, version },
        },
        entry: { ...senderOf(actor), action, message: note, priceOffer: unit, quantity: qty, offerVersion: version },
    });
    await announce(updated, {
        actorRole: actor.role, title: 'New Quotation Received',
        message: `You received a quotation of Rs. ${unit} per unit for RFQ ${updated.rfqId}.`,
    });
    return updated;
};

/** Customer counters the latest quotation. */
export const customerCounter = async (id, actor, { price, quantity, message }) => {
    const rfq = await loadRfq(id, actor);
    if (!['Quotation Sent', 'Counter Offer'].includes(rfq.status)) {
        throw new ApiError(400, 'You can only counter after a quotation has been sent.');
    }
    const unit = assertPrice(price);
    const qty = quantity === undefined ? rfq.currentOffer?.quantity || rfq.quantity : assertQuantity(quantity);
    const note = moderate(message);
    const version = (rfq.currentOffer?.version || 0) + 1;

    const updated = await transition(rfq, {
        allowedStatuses: ['Quotation Sent', 'Counter Offer'],
        set: { status: 'Counter Offer', currentOffer: { by: 'customer', price: unit, quantity: qty, version } },
        entry: { ...senderOf(actor), action: 'counter_offer', message: note, priceOffer: unit, quantity: qty, offerVersion: version },
    });
    await announce(updated, {
        actorRole: 'customer', title: 'Counter Offer Received',
        message: `Customer countered with Rs. ${unit} per unit on RFQ ${updated.rfqId}.`,
    });
    return updated;
};

/** Either side adds a negotiation message (no price change). */
export const addMessage = async (id, actor, { message }) => {
    const rfq = await loadRfq(id, actor);
    if (actor.role === 'admin') assertOwnerOperates(rfq, actor);
    if (TERMINAL_STATUSES.includes(rfq.status)) throw new ApiError(400, 'This RFQ is closed.');
    const note = moderate(message);
    if (!note) throw new ApiError(400, 'Message cannot be empty.');

    const updated = await RFQ.findOneAndUpdate(
        { _id: rfq._id, ...CONSUMER, status: { $nin: TERMINAL_STATUSES } },
        { $push: { consumerTimeline: { ...senderOf(actor), action: 'message', message: note } } },
        { new: true },
    );
    if (!updated) throw new ApiError(409, 'This RFQ is closed.');
    await announce(updated, {
        actorRole: actor.role, title: 'New RFQ Message',
        message: `New message on RFQ ${updated.rfqId}.`,
    });
    return updated;
};

/** Owner accepts the customer's latest offer (e.g. expected price). Price locks; customer then places the order. */
export const ownerAcceptCustomerOffer = async (id, actor, { message }) => {
    const rfq = await loadRfq(id, actor);
    assertOwnerOperates(rfq, actor);
    if (!OWNER_REPLY_STATUSES.includes(rfq.status) || rfq.currentOffer?.by !== 'customer' || !(rfq.currentOffer?.price > 0)) {
        throw new ApiError(400, 'There is no pending customer offer to accept.');
    }
    const note = moderate(message);
    const { price, quantity, version } = rfq.currentOffer;
    const updated = await transition(rfq, {
        allowedStatuses: OWNER_REPLY_STATUSES,
        extraFilter: { 'currentOffer.by': 'customer' },
        set: { status: 'Accepted', finalAgreedPrice: price, finalAgreedQuantity: quantity, acceptedAt: new Date() },
        entry: { ...senderOf(actor), action: 'accepted', message: note || 'Customer offer accepted.', priceOffer: price, quantity, offerVersion: version },
    });
    await announce(updated, {
        actorRole: actor.role, title: 'Your Offer Was Accepted',
        message: `Your offer of Rs. ${price} on RFQ ${updated.rfqId} was accepted. Please confirm your order.`,
    });
    return updated;
};

/** Owner or customer rejects the RFQ. */
export const rejectRfq = async (id, actor, { message }) => {
    const rfq = await loadRfq(id, actor);
    const allowed = [...OPEN_STATUSES];
    if (actor.role === 'customer') allowed.push('Accepted');
    else assertOwnerOperates(rfq, actor);
    if (!allowed.includes(rfq.status)) throw new ApiError(400, `Cannot reject an RFQ in "${rfq.status}" status.`);
    const note = moderate(message);

    const updated = await transition(rfq, {
        allowedStatuses: allowed,
        set: { status: 'Rejected' },
        entry: { ...senderOf(actor), action: 'rejected', message: note || 'RFQ rejected.' },
    });
    await announce(updated, {
        actorRole: actor.role, title: 'RFQ Rejected',
        message: `RFQ ${updated.rfqId} was rejected.`,
    });
    return updated;
};

/* ───────────────────────── order conversion ───────────────────────── */

const resolveShippingAddress = async (userId, shippingAddressId) => {
    const user = await User.findById(userId).select('name email phone').lean();
    const addr = shippingAddressId
        ? await Address.findOne({ _id: shippingAddressId, userId }).lean()
        : await Address.findOne({ userId, isDefault: true }).lean();
    if (!addr) {
        throw new ApiError(400, 'Please add a delivery address (or select one) before confirming the order.');
    }
    return {
        name: addr.fullName || addr.name, email: user?.email, phone: addr.phone,
        address: addr.address, city: addr.city, state: addr.state, zipCode: addr.zipCode, country: addr.country,
    };
};

/**
 * Customer accepts the owner's latest quotation (or confirms an owner-accepted offer)
 * and the RFQ is converted into an Order in one transaction.
 *  - expectedVersion pins the exact quotation the customer saw (prevents accepting an outdated offer).
 *  - The claim, order, stock deduction and commission are atomic; duplicates / races get 409.
 *  - Payment is COD, matching the previous RFQ order behaviour (no new payment flow).
 */
export const acceptAndConvert = async (id, actor, { expectedVersion, shippingAddressId }) => {
    const rfq = await loadRfq(id, actor);
    if (rfq.status === 'Converted To Order') throw new ApiError(409, 'This RFQ has already been converted to an order.');

    let fromStatus;
    if (rfq.status === 'Quotation Sent' && rfq.currentOffer?.by === 'owner') {
        fromStatus = 'Quotation Sent';
        if (expectedVersion === undefined || Number(expectedVersion) !== rfq.currentOffer.version) {
            throw new ApiError(409, 'A newer offer exists on this RFQ. Please review the latest offer before accepting.');
        }
    } else if (rfq.status === 'Accepted') {
        fromStatus = 'Accepted';
    } else {
        throw new ApiError(400, 'There is no active quotation to accept.');
    }

    const shippingAddress = await resolveShippingAddress(actor.id, shippingAddressId);
    const customer = await User.findById(actor.id).select('name').lean();

    let order = null;
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            order = null;
            const claim = await RFQ.findOneAndUpdate(
                {
                    _id: rfq._id, ...CONSUMER, buyerId: actor.id, status: fromStatus,
                    convertedOrderId: { $exists: false },
                    ...(fromStatus === 'Quotation Sent' ? { 'currentOffer.version': Number(expectedVersion), 'currentOffer.by': 'owner' } : {}),
                },
                { $set: { status: 'Converted To Order', convertedAt: new Date() } },
                { new: true, session },
            );
            if (!claim) throw new ApiError(409, 'This RFQ was already accepted or changed. Please refresh.');

            // Price/quantity are taken from the locked server-side record, never from the request.
            const unitPrice = fromStatus === 'Accepted' ? claim.finalAgreedPrice : claim.currentOffer.price;
            const quantity = fromStatus === 'Accepted' ? (claim.finalAgreedQuantity || claim.quantity) : claim.currentOffer.quantity;
            if (!(unitPrice > 0) || !Number.isInteger(quantity) || quantity < 1) {
                throw new ApiError(400, 'Agreed price or quantity is invalid.');
            }

            const product = await Product.findById(claim.productId)
                .populate('vendorId', 'storeName name commissionRate status isDeleted categoryGstRates defaultGstRate')
                .populate('shopId', 'name')
                .populate('categoryId', 'name gstRate parentId')
                .session(session);
            if (!product) throw new ApiError(404, 'The product for this RFQ no longer exists.');
            assertProductQuotable(product);
            if (product.codAllowed === false) {
                throw new ApiError(400, 'This product does not support Cash on Delivery, which is required for RFQ orders.');
            }

            // Re-verify ownership against the DB at conversion time.
            const isManaged = !!product.shopId || (product.listingType && product.listingType !== 'vendor_direct');
            if ((claim.targetType === 'admin') !== isManaged) {
                throw new ApiError(409, 'Product ownership changed since this RFQ was created. Please submit a new RFQ.');
            }
            if (claim.targetType === 'vendor') {
                const vendor = product.vendorId;
                if (!vendor || String(vendor._id) !== String(claim.sellerId) || vendor.isDeleted || vendor.status !== 'approved') {
                    throw new ApiError(409, 'The seller for this RFQ is no longer available.');
                }
            }

            // Deduct stock exactly once, atomically, with an oversell guard.
            const updatedProduct = await Product.findOneAndUpdate(
                { _id: product._id, stock: { $ne: 'out_of_stock' }, stockQuantity: { $gte: quantity } },
                { $inc: { stockQuantity: -quantity } },
                { new: true, session },
            );
            if (!updatedProduct) throw new ApiError(409, `Insufficient stock. Only ${product.stockQuantity} units available.`);
            await Product.updateOne(
                { _id: product._id },
                { $set: { stock: updatedProduct.stockQuantity <= 0 ? 'out_of_stock' : (updatedProduct.stockQuantity <= updatedProduct.lowStockThreshold ? 'low_stock' : 'in_stock') } },
                { session },
            );

            // Same vendor / commission semantics as normal checkout.
            const isManagedShop = !!product.shopId;
            const isManagedListing = product.listingType === 'admin_managed_listing';
            if (!isManagedShop && !product.vendorId) throw new ApiError(422, 'Vendor or shop mapping missing for this product.');
            const vendorIdObj = isManagedShop ? product.shopId._id : product.vendorId._id;
            const vendorName = isManagedShop ? (product.shopId.name || 'Managed Shop') : (product.vendorId.storeName || product.vendorId.name || 'Vendor');
            const gstRate = resolveProductGST(product, product.categoryId, product.vendorId);
            const { taxableAmount, gstAmount } = calculateItemGST(unitPrice, quantity, gstRate, 0, product.taxIncluded);
            const subtotal = money(unitPrice * quantity);
            const tax = money(gstAmount);
            const total = money(subtotal + tax);

            const item = {
                productId: product._id, vendorId: vendorIdObj, name: product.name, image: product.image,
                price: unitPrice, quantity, variant: {},
                gstMode: product.gstMode || 'category', gstRate, gstAmount, taxableAmount, taxIncluded: !!product.taxIncluded,
            };

            const [created] = await Order.create([{
                orderId: generateOrderId(),
                userId: actor.id,
                items: [item],
                vendorItems: [{ vendorId: vendorIdObj, vendorName, items: [item], subtotal, shipping: 0, tax, discount: 0, status: 'pending' }],
                shippingAddress,
                paymentMethod: 'cod',
                paymentStatus: 'pending',
                subtotal, shipping: 0, tax, discount: 0, total,
                trackingNumber: generateTrackingNumber(),
                estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                orderType: 'rfq',
                rfqId: claim._id,
            }], { session });
            order = created;

            let commissionDoc;
            if (isManagedListing) {
                const supply = money((product.negotiatedSupplyPrice || unitPrice) * quantity);
                commissionDoc = { subtotal, commissionRate: 0, commission: money(Math.max(0, subtotal - supply)), vendorEarnings: supply };
            } else if (isManagedShop) {
                commissionDoc = { subtotal, commissionRate: 0, commission: 0, vendorEarnings: subtotal };
            } else {
                const rate = product.vendorId.commissionRate || 10;
                const comm = money((subtotal * rate) / 100);
                commissionDoc = { subtotal, commissionRate: rate, commission: comm, vendorEarnings: money(subtotal - comm) };
            }
            await Commission.create([{ orderId: created._id, vendorId: vendorIdObj, vendorName, ...commissionDoc }], { session });

            await RFQ.updateOne(
                { _id: claim._id },
                {
                    $set: {
                        convertedOrderId: created._id, finalAgreedPrice: unitPrice, finalAgreedQuantity: quantity,
                        ...(claim.acceptedAt ? {} : { acceptedAt: new Date() }),
                    },
                    $push: {
                        consumerTimeline: {
                            $each: [
                                ...(fromStatus === 'Quotation Sent'
                                    ? [{ senderId: actor.id, senderType: 'customer', senderName: customer?.name, action: 'accepted', message: 'Quotation accepted.', priceOffer: unitPrice, quantity, offerVersion: claim.currentOffer.version }]
                                    : []),
                                { senderId: actor.id, senderType: 'system', action: 'converted', message: `Converted to order ${created.orderId}.`, priceOffer: unitPrice, quantity },
                            ],
                        },
                    },
                },
                { session },
            );
        });
    } finally {
        await session.endSession();
    }

    // ── Post-commit side effects (never fail the conversion) ──
    const finalRfq = await RFQ.findById(rfq._id);
    await announce(finalRfq, {
        actorRole: 'customer', title: 'RFQ Converted To Order',
        message: `RFQ ${finalRfq.rfqId} was accepted and converted to order ${order.orderId}.`,
        extra: { orderId: order.orderId },
    });
    await safe(createNotification({
        recipientId: actor.id, recipientType: 'user', title: 'RFQ Converted To Order',
        message: `Your RFQ ${finalRfq.rfqId} is now order ${order.orderId}.`, type: 'order',
        data: { rfqId: finalRfq.rfqId, orderId: order.orderId },
    }));
    if (finalRfq.targetType === 'vendor') {
        try { getIO().to(`user_${finalRfq.sellerId}`).emit('new_order_placed', { orderId: order.orderId, dbOrderId: order._id, total: order.subtotal }); } catch { /* ignore */ }
    }
    (async () => {
        try {
            const inv = await generateInvoiceForOrder(order._id);
            if (inv) await sendOrderInvoiceEmail(order._id, { invoice: inv });
        } catch (e) { console.error('[ConsumerRFQ] invoice error:', e?.message); }
        try {
            await handleOrderStatusTransition(order, 'pending', {
                updatedBy: order.userId, updatedByRole: 'user',
                note: 'Order created from accepted RFQ', notifyCustomer: false,
            });
        } catch (e) { console.error('[ConsumerRFQ] status transition error:', e?.message); }
    })();

    return { rfq: finalRfq, order };
};

/* ───────────────────────── actor helper ───────────────────────── */

/** Builds the verified actor from the authenticated user id (never from request body). */
export const makeActor = async (role, id) => {
    let name;
    if (role === 'customer') name = (await User.findById(id).select('name').lean())?.name;
    else if (role === 'seller') {
        const v = await Vendor.findById(id).select('storeName name').lean();
        name = v?.storeName || v?.name;
    } else {
        name = (await Admin.findById(id).select('name').lean())?.name || 'PLE Admin';
    }
    return { role, id: String(id), name: name || role };
};
