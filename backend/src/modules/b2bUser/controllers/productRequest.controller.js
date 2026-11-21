import mongoose from 'mongoose';
import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import ProductRequest from '../../../models/ProductRequest.model.js';
import Notification from '../../../models/Notification.model.js';
import Vendor from '../../../models/Vendor.model.js';
import ManagedShop from '../../../models/ManagedShop.model.js';
import ManagedVendorUser from '../../../models/ManagedVendorUser.model.js';
import Product from '../../../models/Product.model.js';
import Order from '../../../models/Order.model.js';
import Address from '../../../models/Address.model.js';
import { User } from '../../../models/User.model.js';
import { generateOrderId } from '../../../utils/generateOrderId.js';
import {
    resolveProductGST,
    calculateItemGST,
    resolveSellerState,
    resolveBuyerState,
    determineSupplyType,
    applyGSTSplit,
    summarizeGST,
} from '../../../utils/gstUtils.js';
import { createRazorpayOrder } from '../../../services/razorpay.service.js';
import { moderateMessage, MODERATION_ACTION } from '../../../services/chatModeration.service.js';
import { sendProductRequestReceivedEmail } from '../../../services/customerNotification.service.js';
import {
    sendSourceNowSubmittedEmail,
    sendVendorNewSourcingRequestEmail
} from '../../../services/sourcingNotification.service.js';

// Custom helper since we need REQ- format
const generateRequestId = () => {
    return `REQ-${Math.floor(100000 + Math.random() * 900000)}`;
};

// @desc    Create a new product request
// @route   POST /api/user/b2b/product-requests
// @access  Private (B2B User/Admin)
export const createProductRequest = asyncHandler(async (req, res) => {
    const { 
        productName, 
        category, 
        quantity, 
        expectedBudget, 
        description, 
        image,
        requestType,
        targetEntityType,
        targetEntityId
    } = req.body;

    if (!productName || !category || !quantity || !expectedBudget) {
        throw new ApiError(400, 'Please provide all required fields');
    }

    const userId = req.user.id || req.user._id;

    // Validate shop/vendor details if SHOP_SPECIFIC
    const isShopSpecific = requestType === 'SHOP_SPECIFIC';
    let finalTargetId = targetEntityId;
    if (isShopSpecific) {
        if (!targetEntityType || !targetEntityId) {
            throw new ApiError(400, 'Please provide targetEntityType and targetEntityId for shop-specific requests.');
        }

        // Never create vendor accounts or shops from a customer request: the
        // target id comes from the URL and is fully user-controlled.
        if (!['Vendor', 'ManagedShop'].includes(targetEntityType)) {
            throw new ApiError(400, 'Invalid target entity type.');
        }

        if (!mongoose.Types.ObjectId.isValid(targetEntityId)) {
            // Legacy mock ids from the frontend (e.g. "1"): map to an existing record only.
            const fallback = targetEntityType === 'Vendor'
                ? (await Vendor.findOne({ storeName: 'PLE Shop', status: 'approved' })) || (await Vendor.findOne({ status: 'approved' }))
                : await ManagedShop.findOne({ status: 'active' });
            if (!fallback) {
                throw new ApiError(404, 'Selected shop was not found.');
            }
            finalTargetId = fallback._id;
        } else if (targetEntityType === 'Vendor') {
            const vendor = await Vendor.findById(targetEntityId);
            if (!vendor) {
                throw new ApiError(404, 'Selected vendor was not found.');
            }
            if (vendor.status !== 'approved' && vendor.status !== 'pending') {
                throw new ApiError(400, 'Selected vendor is not active.');
            }
        } else {
            const shop = await ManagedShop.findById(targetEntityId);
            if (!shop) {
                throw new ApiError(404, 'Selected shop was not found.');
            }
            if (shop.status !== 'active') {
                throw new ApiError(400, 'Selected shop is inactive.');
            }
        }
    }

    const request = await ProductRequest.create({
        requestId: generateRequestId(),
        userId,
        productName,
        category,
        quantity,
        expectedBudget,
        description,
        image,
        requestType: requestType || 'GENERAL',
        targetEntityType: isShopSpecific ? targetEntityType : undefined,
        targetEntityId: isShopSpecific ? finalTargetId : undefined,
    });

    // Notify Customer by Email (Items 196 & 197)
    sendProductRequestReceivedEmail({
        customerEmail: req.user.email,
        customerName: req.user.name,
        productRequest: request,
    }).catch(err => console.warn(`[ProductRequestEmail] Failed: ${err.message}`));

    sendSourceNowSubmittedEmail({
        customer: req.user,
        request
    }).catch(err => console.warn(`[SourceNowSubmittedEmail] Failed: ${err.message}`));

    // Notify Super Admin
    await Notification.create({
        recipientType: 'admin',
        type: 'system',
        title: 'New Product Request',
        message: `A new product request for "${productName}" has been submitted by ${req.user.name}.`,
        data: {
            relatedId: request._id.toString(),
            onModel: 'ProductRequest'
        }
    });

    // Notify target vendor/shop owners
    if (isShopSpecific) {
        if (targetEntityType === 'Vendor') {
            await Notification.create({
                recipientId: targetEntityId,
                recipientType: 'vendor',
                type: 'system',
                title: 'New Store Product Request',
                message: `A customer has requested a product specifically from your store: "${productName}".`,
                data: {
                    relatedId: request._id.toString(),
                    onModel: 'ProductRequest'
                }
            });

            // Dispatch Vendor New Sourcing Request Email (Item 205)
            sendVendorNewSourcingRequestEmail({
                vendor: targetEntityId,
                request
            }).catch(err => console.warn(`[VendorSourcingRequestEmail] Failed: ${err.message}`));
        } else if (targetEntityType === 'ManagedShop') {
            const managedUsers = await ManagedVendorUser.find({ shopId: targetEntityId });
            for (const mUser of managedUsers) {
                await Notification.create({
                    recipientId: mUser._id,
                    recipientType: 'vendor',
                    type: 'system',
                    title: 'New Shop Product Request',
                    message: `A customer has requested a product specifically from your shop: "${productName}".`,
                    data: {
                        relatedId: request._id.toString(),
                        onModel: 'ProductRequest'
                    }
                });
            }
        }
    }

    res.status(201).json(
        new ApiResponse(201, request, 'Product request submitted successfully')
    );
});

// @desc    Get all product requests for the logged-in user
// @route   GET /api/user/b2b/product-requests
// @access  Private (B2B User/Admin)
export const getUserProductRequests = asyncHandler(async (req, res) => {
    const userId = req.user.id || req.user._id;
    const { status, type, page = 1, limit = 10 } = req.query;

    const filter = { userId };

    if (status) {
        filter.status = status;
    }
    if (type) {
        filter.requestType = type;
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const skip = (pageNum - 1) * limitNum;

    const total = await ProductRequest.countDocuments(filter);
    const requests = await ProductRequest.find(filter)
        .populate({
            path: 'targetEntityId',
            select: 'storeName storeLogo rating address name logo location'
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);

    res.status(200).json(
        new ApiResponse(200, {
            requests,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum)
            }
        }, 'Product requests fetched successfully')
    );
});

// @desc    Get a specific product request by Request ID (e.g. REQ-123456)
// @route   GET /api/user/b2b/product-requests/:id
// @access  Private (B2B User/Admin)
export const getProductRequestById = asyncHandler(async (req, res) => {
    const userId = req.user.id || req.user._id;
    const idParam = req.params.id;
    const queryConditions = [{ requestId: idParam }];
    if (mongoose.isValidObjectId(idParam)) {
        queryConditions.push({ _id: idParam });
    }

    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
    const filter = {
        $or: queryConditions,
        ...(isAdmin ? {} : { userId })
    };

    const request = await ProductRequest.findOne(filter).populate({
        path: 'targetEntityId',
        select: 'storeName storeLogo rating address name logo location'
    });

    if (!request) {
        throw new ApiError(404, 'Product request not found');
    }

    // Summary of the order created when the proposal was accepted (lets the buyer finish an unpaid payment).
    const data = request.toObject();
    if (request.associatedOrderId) {
        data.associatedOrder = await Order.findById(request.associatedOrderId)
            .select('orderId subtotal tax total taxBreakdown placeOfSupply paymentStatus status shippingAddress')
            .lean();
    }

    res.status(200).json(
        new ApiResponse(200, data, 'Product request fetched successfully')
    );
});

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const escapeRegex = (str) => String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SELLER_GST_FIELDS = 'storeName name commissionRate gstNumber documents.gst b2bSellingGstNumber b2bSellingState state address businessAddress';

const resolveShippingAddress = async (userId, body) => {
    const user = await User.findById(userId).select('name email phone').lean();
    if (body?.addressId) {
        if (!mongoose.isValidObjectId(body.addressId)) throw new ApiError(400, 'Invalid delivery address.');
        const a = await Address.findOne({ _id: body.addressId, userId }).lean();
        if (!a) throw new ApiError(400, 'Delivery address not found.');
        return {
            name: a.fullName || a.name || user?.name, email: user?.email, phone: a.phone || user?.phone,
            address: a.address, city: a.city, state: a.state, zipCode: a.zipCode, country: a.country || 'India',
        };
    }
    const s = body?.shippingAddress;
    if (s && s.address && s.city && s.state && s.zipCode) {
        return {
            name: s.name || user?.name, email: s.email || user?.email, phone: s.phone || user?.phone,
            address: s.address, city: s.city, state: s.state, zipCode: String(s.zipCode), country: s.country || 'India',
        };
    }
    throw new ApiError(400, 'Please choose a delivery address.');
};

const paymentPayload = (order, razorpayOrder) => ({
    order: {
        _id: order._id, orderId: order.orderId, subtotal: order.subtotal, tax: order.tax, total: order.total,
        taxBreakdown: order.taxBreakdown, placeOfSupply: order.placeOfSupply, paymentStatus: order.paymentStatus,
        shippingAddress: order.shippingAddress, items: order.items,
    },
    razorpayOrder,
});

// @desc    B2B Buyer accepts the final sourcing proposal: creates the order (stock reserved, GST
//          applied) and starts an online (Razorpay) payment. The request becomes "Confirmed" only
//          after the payment is verified via POST /api/user/payments/verify.
//          Calling it again while unpaid re-uses the same order and starts a fresh payment.
// @route   POST /api/user/product-requests/:id/confirm   body: { addressId } | { shippingAddress }
// @access  Private (B2B User/Admin)
export const confirmProductRequestProposal = asyncHandler(async (req, res) => {
    const userId = req.user.id || req.user._id;
    const request = await ProductRequest.findOne({ requestId: req.params.id, userId });
    if (!request) throw new ApiError(404, 'Product request not found or unauthorized.');

    // Already has an order from an earlier attempt?
    if (request.associatedOrderId) {
        const existing = await Order.findById(request.associatedOrderId);
        if (existing?.paymentStatus === 'paid' || request.status === 'Confirmed') {
            throw new ApiError(400, 'This proposal is already confirmed and paid.');
        }
        if (existing && !['cancelled', 'returned'].includes(String(existing.status).toLowerCase())) {
            const rzp = await createRazorpayOrder(existing.total, { receipt: `rcpt_${existing.orderId}`, notes: { orderId: existing.orderId, requestId: request.requestId } });
            existing.paymentDetails = { razorpayOrderId: rzp.id, amount: existing.total, status: 'created', gatewayName: 'Razorpay', paymentMethod: 'card' };
            if (existing.paymentStatus === 'failed') existing.paymentStatus = 'pending';
            await existing.save();
            return res.status(200).json(new ApiResponse(200, { request, ...paymentPayload(existing, rzp) }, 'Complete the payment to confirm your order.'));
        }
    }

    if (request.status !== 'Final Proposal') {
        throw new ApiError(400, 'Request is not in Final Proposal state.');
    }

    const shippingAddress = await resolveShippingAddress(userId, req.body);
    const buyerState = resolveBuyerState(shippingAddress);

    const proposal = request.selectedFulfillment || {};
    const nameMatch = { $regex: new RegExp(escapeRegex(request.productName), 'i') };

    // 1. Resolve the source products + prices (stock is re-checked atomically in the transaction)
    const lines = [];
    if (proposal.pleQuantity > 0) {
        const pleShop = await ManagedShop.findOne({ name: 'PLE Shop' }) || await ManagedShop.findOne({ status: 'active' });
        const pleProduct = pleShop
            ? await Product.findOne({ shopId: pleShop._id, name: nameMatch, isActive: true }).populate('categoryId').populate('shopId', 'name logo gst address warehouse')
            : null;
        if (!pleProduct || pleProduct.stockQuantity < proposal.pleQuantity) {
            throw new ApiError(400, 'Fulfillment failed. PLE Shop stock has changed and is now insufficient.');
        }
        lines.push({ product: pleProduct, sellerId: pleShop._id, sellerName: pleShop.name || 'PLE Shop', seller: pleProduct.shopId, isShop: true, quantity: Number(proposal.pleQuantity), price: Number(proposal.finalPrice) });
    }
    for (const v of proposal.vendors || []) {
        const vProduct = await Product.findOne({ vendorId: v.vendorId, name: nameMatch, isActive: true })
            .populate('categoryId').populate('vendorId', SELLER_GST_FIELDS);
        if (!vProduct || vProduct.stockQuantity < v.quantity) {
            throw new ApiError(400, 'Fulfillment failed. Sourcing vendor stock is insufficient.');
        }
        lines.push({ product: vProduct, sellerId: v.vendorId, sellerName: vProduct.vendorId?.storeName || vProduct.vendorId?.name || 'Vendor', seller: vProduct.vendorId, isShop: false, quantity: Number(v.quantity), price: Number(v.price || proposal.finalPrice) });
    }
    if (!lines.length) throw new ApiError(400, 'This proposal has nothing to order.');
    if (lines.some((l) => !(l.price > 0) || !(l.quantity > 0))) throw new ApiError(400, 'This proposal has an invalid price or quantity. Please contact support.');

    // 2. Price lines (quoted prices are exclusive of GST) + place-of-supply split
    const vendorMap = new Map();
    const items = lines.map((l) => {
        const gstRate = resolveProductGST(l.product, l.product.categoryId, l.isShop ? null : l.seller);
        const { taxableAmount, gstAmount } = calculateItemGST(l.price, l.quantity, gstRate, 0, false);
        const sellerState = resolveSellerState(l.seller);
        const supplyType = determineSupplyType(sellerState, buyerState);
        const item = {
            productId: l.product._id, vendorId: l.sellerId, name: l.product.name, image: l.product.image || request.image,
            price: round2(l.price), quantity: l.quantity, gstMode: l.product.gstMode || 'category', gstRate, gstAmount, taxableAmount, taxIncluded: false,
        };
        applyGSTSplit(item, supplyType);
        const key = String(l.sellerId);
        if (!vendorMap.has(key)) {
            vendorMap.set(key, { vendorId: l.sellerId, vendorName: l.sellerName, items: [], subtotal: 0, shipping: 0, tax: 0, discount: 0, status: 'pending', sellerState: sellerState?.name, sellerStateCode: sellerState?.code, supplyType });
        }
        const g = vendorMap.get(key);
        g.items.push(item);
        g.subtotal = round2(g.subtotal + l.price * l.quantity);
        g.tax = round2(g.tax + gstAmount);
        return item;
    });
    const vendorItems = [...vendorMap.values()].map((g) => ({ ...g, ...(({ cgst, sgst, igst }) => ({ cgst, sgst, igst }))(summarizeGST(g.items)) }));
    const subtotal = round2(items.reduce((a, it) => a + it.price * it.quantity, 0));
    const tax = round2(items.reduce((a, it) => a + it.gstAmount, 0));
    const total = round2(subtotal + tax);

    // 3. Start the online payment first: if the gateway is down, no stock is reserved.
    const orderId = generateOrderId();
    const rzp = await createRazorpayOrder(total, { receipt: `rcpt_${orderId}`, notes: { orderId, requestId: request.requestId } });

    // 4. Reserve stock + create the order atomically
    const session = await mongoose.startSession();
    let order;
    try {
        await session.withTransaction(async () => {
            for (const l of lines) {
                const updated = await Product.findOneAndUpdate(
                    { _id: l.product._id, stockQuantity: { $gte: l.quantity } },
                    { $inc: { stockQuantity: -l.quantity } },
                    { new: true, session }
                );
                if (!updated) throw new ApiError(400, `Fulfillment failed. Stock for ${l.product.name} has changed and is now insufficient.`);
                if (updated.stockQuantity <= 0 && updated.stock !== 'out_of_stock') {
                    await Product.updateOne({ _id: updated._id }, { $set: { stock: 'out_of_stock' } }, { session });
                }
            }
            [order] = await Order.create([{
                orderId,
                userId,
                items,
                vendorItems,
                shippingAddress,
                paymentMethod: 'card',
                paymentStatus: 'pending',
                paymentDetails: { razorpayOrderId: rzp.id, amount: total, status: 'created', gatewayName: 'Razorpay', paymentMethod: 'card' },
                subtotal,
                shipping: 0,
                tax,
                taxBreakdown: summarizeGST(items),
                placeOfSupply: buyerState ? { state: buyerState.name, code: buyerState.code } : undefined,
                discount: 0,
                total,
                status: 'pending',
                estimatedDelivery: proposal.estimatedDelivery || undefined,
                requestProductId: request._id,
                orderType: 'product_request',
            }], { session });

            request.associatedOrderId = order._id;
            request.timeline.push({ status: 'Final Proposal', comment: `Proposal accepted. Order ${order.orderId} created for ₹${total} (incl. GST ₹${tax}); awaiting online payment.` });
            request.auditLog.push({
                action: 'Accepted Proposal',
                performedBy: userId,
                performerType: 'User',
                reason: `Buyer accepted proposal; order ${order.orderId} awaiting payment.`,
            });
            await request.save({ session });
        });
    } finally {
        await session.endSession();
    }

    res.status(201).json(new ApiResponse(201, { request, ...paymentPayload(order, rzp) }, 'Order created. Complete the payment to confirm.'));
});

// @desc    User approves vendor quotation (Vendor Window flow)
// @route   POST /api/user/product-requests/:id/approve-quotation
// @access  Private (User)
export const approveQuotation = asyncHandler(async (req, res) => {
    const userId = req.user.id || req.user._id;

    const request = await ProductRequest.findOne({ requestId: req.params.id });
    if (!request) throw new ApiError(404, 'Product request not found.');

    if (String(request.userId) !== String(userId)) {
        throw new ApiError(403, 'You do not own this product request.');
    }

    if (request.status !== 'Quotation Submitted') {
        throw new ApiError(400, 'No pending vendor quotation to approve.');
    }

    const latestQuotation = request.vendorQuotations
        .filter(q => String(q.vendorId) === String(request.acceptedVendorId))
        .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0];

    if (!latestQuotation) {
        throw new ApiError(400, 'No quotation from the accepted vendor found.');
    }

    // Mark quotation as accepted
    latestQuotation.status = 'Accepted';
    latestQuotation.respondedAt = new Date();

    // Map to selectedFulfillment for compatibility with existing flow
    request.selectedFulfillment = {
        pleQuantity: 0,
        vendors: [{ vendorId: latestQuotation.vendorId, quantity: request.quantity, price: latestQuotation.unitPrice }],
        finalPrice: latestQuotation.totalPrice,
        estimatedDelivery: latestQuotation.deliveryEstimate ? new Date(latestQuotation.deliveryEstimate) : undefined,
        notes: latestQuotation.notes
    };

    request.status = 'Customer Approved';
    const now = new Date();
    request.timeline.push({
        status: 'Customer Approved',
        date: now,
        comment: `Customer approved vendor quotation at ₹${latestQuotation.totalPrice}. Ready for Admin to finalize.`
    });
    request.auditLog.push({
        action: 'CUSTOMER_APPROVED_QUOTATION',
        performedBy: userId,
        performerType: 'User',
        timestamp: now,
        reason: `Buyer approved vendor quotation at ₹${latestQuotation.totalPrice}.`
    });

    await request.save();

    // Notify Admin
    await Notification.create({
        recipientType: 'admin',
        type: 'system',
        title: 'Customer Approved Vendor Quotation',
        message: `Customer approved the vendor quotation for "${request.productName}" at ₹${latestQuotation.totalPrice}. Admin action may be required to finalize.`,
        data: { relatedId: request._id.toString(), onModel: 'ProductRequest', requestId: request.requestId }
    });

    // Notify vendor
    await Notification.create({
        recipientId: request.acceptedVendorId,
        recipientType: 'vendor',
        type: 'system',
        title: 'Your Quotation Was Approved',
        message: `The customer approved your quotation for "${request.productName}" at ₹${latestQuotation.totalPrice}. Please proceed with fulfillment.`,
        data: { relatedId: request._id.toString(), onModel: 'ProductRequest', requestId: request.requestId }
    });

    res.status(200).json(
        new ApiResponse(200, request, 'Quotation approved. Admin will finalize the order.')
    );
});

// @desc    User rejects vendor quotation (Vendor Window flow)
// @route   POST /api/user/product-requests/:id/reject-quotation
// @access  Private (User)
export const rejectQuotation = asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const userId = req.user.id || req.user._id;

    const request = await ProductRequest.findOne({ requestId: req.params.id });
    if (!request) throw new ApiError(404, 'Product request not found.');

    if (String(request.userId) !== String(userId)) {
        throw new ApiError(403, 'You do not own this product request.');
    }

    if (request.status !== 'Quotation Submitted') {
        throw new ApiError(400, 'No pending vendor quotation to reject.');
    }

    // Mark latest quotation as rejected
    const latestQuotation = request.vendorQuotations
        .filter(q => String(q.vendorId) === String(request.acceptedVendorId))
        .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0];

    if (latestQuotation) {
        latestQuotation.status = 'Rejected';
        latestQuotation.respondedAt = new Date();
    }

    request.status = 'Vendor Accepted'; // Back to vendor fulfillment stage
    const now = new Date();
    const rejectReason = reason || 'Customer rejected the quotation.';
    request.timeline.push({
        status: 'Vendor Accepted',
        date: now,
        comment: `Customer rejected the vendor quotation. ${rejectReason} Vendor may resubmit.`
    });
    request.auditLog.push({
        action: 'CUSTOMER_REJECTED_QUOTATION',
        performedBy: userId,
        performerType: 'User',
        timestamp: now,
        reason: rejectReason
    });

    await request.save();

    // Notify vendor
    await Notification.create({
        recipientId: request.acceptedVendorId,
        recipientType: 'vendor',
        type: 'system',
        title: 'Quotation Rejected by Customer',
        message: `The customer rejected your quotation for "${request.productName}". Reason: ${rejectReason}. Please revise and resubmit.`,
        data: { relatedId: request._id.toString(), onModel: 'ProductRequest', requestId: request.requestId }
    });

    res.status(200).json(
        new ApiResponse(200, request, 'Quotation rejected. Vendor can resubmit a revised quotation.')
    );
});

// @desc    User requests changes / negotiation on vendor quotation
// @route   POST /api/user/product-requests/:id/request-changes
// @access  Private (User)
export const requestChanges = asyncHandler(async (req, res) => {
    const { message, desiredPrice, desiredDelivery } = req.body;
    const userId = req.user.id || req.user._id;

    if (!message) throw new ApiError(400, 'Please provide a message describing the requested changes.');

    // ── Moderation Layer ──────────────────────────────────────
    const moderationResult = moderateMessage(message);
    if (moderationResult.action === MODERATION_ACTION.BLOCK) {
        return res.status(422).json({
            success: false,
            code: 'MESSAGE_BLOCKED',
            category: moderationResult.category,
            message: moderationResult.userMessage,
        });
    }

    const request = await ProductRequest.findOne({ requestId: req.params.id });
    if (!request) throw new ApiError(404, 'Product request not found.');

    if (String(request.userId) !== String(userId)) {
        throw new ApiError(403, 'You do not own this product request.');
    }

    if (!['Quotation Submitted', 'Vendor Accepted'].includes(request.status)) {
        throw new ApiError(400, 'Cannot request changes at this stage.');
    }

    // Mark latest quotation as negotiation requested
    const latestQuotation = request.vendorQuotations
        .filter(q => String(q.vendorId) === String(request.acceptedVendorId))
        .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0];

    if (latestQuotation) {
        latestQuotation.status = 'NegotiationRequested';
        latestQuotation.respondedAt = new Date();
    }

    request.status = 'Negotiation';
    const now = new Date();
    const changeDetail = `${message}${desiredPrice ? ` | Desired price: ₹${desiredPrice}` : ''}${desiredDelivery ? ` | Desired delivery: ${desiredDelivery}` : ''}`;
    request.timeline.push({
        status: 'Negotiation',
        date: now,
        comment: `Customer requested changes: ${changeDetail}`
    });
    request.auditLog.push({
        action: 'CUSTOMER_REQUESTED_CHANGES',
        performedBy: userId,
        performerType: 'User',
        timestamp: now,
        reason: changeDetail
    });

    await request.save();

    // Notify vendor
    await Notification.create({
        recipientId: request.acceptedVendorId,
        recipientType: 'vendor',
        type: 'system',
        title: 'Customer Requested Changes',
        message: `The customer has requested changes on the quotation for "${request.productName}": ${message}`,
        data: { relatedId: request._id.toString(), onModel: 'ProductRequest', requestId: request.requestId }
    });

    res.status(200).json(
        new ApiResponse(200, request, 'Change request submitted to vendor.')
    );
});

// @desc    Customer approves vendor extension request
// @route   POST /api/user/product-requests/:id/extension/approve
// @access  Private (User)
export const approveExtension = asyncHandler(async (req, res) => {
    const userId = req.user.id || req.user._id;

    // ── Pre-check: request exists and belongs to this user ──────────────────────
    const idParam = req.params.id;
    const queryConditions = [{ requestId: idParam }];
    if (mongoose.isValidObjectId(idParam)) {
        queryConditions.push({ _id: idParam });
    }
    const preCheck = await ProductRequest.findOne({ $or: queryConditions });
    if (!preCheck) throw new ApiError(404, 'Product request not found.');
    if (String(preCheck.userId) !== String(userId)) {
        throw new ApiError(403, 'You are not authorized to respond to this extension request.');
    }
    if (!preCheck.extensionRequest || preCheck.extensionRequest.status !== 'PENDING') {
        throw new ApiError(400, 'There is no pending extension request to approve.');
    }

    const now = new Date();
    const { requestedDays, currentDeadline, proposedDeadline, reason, requestedAt } = preCheck.extensionRequest;
    const approvedDeadline = proposedDeadline;

    // ── Atomic approve — prevents duplicate approval race condition ──────────────
    const updated = await ProductRequest.findOneAndUpdate(
        {
            _id: preCheck._id,
            userId,
            'extensionRequest.status': 'PENDING'
        },
        {
            $set: {
                // Update the live fulfillment deadline to the approved new deadline
                vendorFulfillmentExpiresAt: approvedDeadline,
                // Archive the extension request details
                'extensionRequest.status': 'APPROVED',
                'extensionRequest.respondedAt': now,
                'extensionRequest.respondedBy': userId
            },
            $push: {
                extensionHistory: {
                    requestedDays,
                    previousDeadline: currentDeadline,
                    proposedDeadline,
                    approvedDeadline,
                    reason,
                    status: 'APPROVED',
                    requestedAt,
                    respondedAt: now,
                    respondedBy: userId
                },
                timeline: {
                    status: preCheck.status,
                    date: now,
                    comment: `Customer approved vendor extension request. Fulfillment deadline extended by ${requestedDays} day(s). New deadline: ${approvedDeadline.toDateString()}.`
                },
                auditLog: {
                    action: 'EXTENSION_APPROVED',
                    performedBy: userId,
                    performerType: 'User',
                    timestamp: now,
                    reason: `Customer approved extension. Previous deadline: ${currentDeadline?.toISOString()}. New active deadline: ${approvedDeadline.toISOString()}.`
                }
            }
        },
        { new: true }
    );

    if (!updated) {
        throw new ApiError(409, 'The extension request has already been responded to or no longer exists. Please refresh.');
    }

    // ── Notifications ───────────────────────────────────────────────────────────
    // Notify vendor
    await Notification.create({
        recipientId: updated.acceptedVendorId,
        recipientType: 'vendor',
        type: 'system',
        title: 'Extension Request Approved ✅',
        message: `Your extension request for product request "${updated.productName}" (${updated.requestId}) has been approved. Your new fulfillment deadline is ${approvedDeadline.toDateString()}.`,
        data: {
            relatedId: updated._id.toString(),
            onModel: 'ProductRequest',
            requestId: updated.requestId
        }
    });

    // Notify Admin
    await Notification.create({
        recipientType: 'admin',
        type: 'system',
        title: 'Extension Approved — Deadline Extended',
        message: `Customer approved vendor extension for "${updated.productName}" (${updated.requestId}). New fulfillment deadline: ${approvedDeadline.toDateString()}.`,
        data: {
            relatedId: updated._id.toString(),
            onModel: 'ProductRequest',
            requestId: updated.requestId
        }
    });

    res.status(200).json(
        new ApiResponse(200, updated, `Extension approved. New fulfillment deadline: ${approvedDeadline.toDateString()}.`)
    );
});

// @desc    Customer rejects vendor extension request
// @route   POST /api/user/product-requests/:id/extension/reject
// @access  Private (User)
export const rejectExtension = asyncHandler(async (req, res) => {
    const userId = req.user.id || req.user._id;

    // ── Pre-check ────────────────────────────────────────────────────────────────
    const idParam = req.params.id;
    const queryConditions = [{ requestId: idParam }];
    if (mongoose.isValidObjectId(idParam)) {
        queryConditions.push({ _id: idParam });
    }
    const preCheck = await ProductRequest.findOne({ $or: queryConditions });
    if (!preCheck) throw new ApiError(404, 'Product request not found.');
    if (String(preCheck.userId) !== String(userId)) {
        throw new ApiError(403, 'You are not authorized to respond to this extension request.');
    }
    if (!preCheck.extensionRequest || preCheck.extensionRequest.status !== 'PENDING') {
        throw new ApiError(400, 'There is no pending extension request to reject.');
    }

    const now = new Date();
    const { requestedDays, currentDeadline, proposedDeadline, reason, requestedAt } = preCheck.extensionRequest;

    // ── Atomic reject ───────────────────────────────────────────────────────────
    const updated = await ProductRequest.findOneAndUpdate(
        {
            _id: preCheck._id,
            userId,
            'extensionRequest.status': 'PENDING'
        },
        {
            $set: {
                // vendorFulfillmentExpiresAt is NOT changed — original deadline remains
                'extensionRequest.status': 'REJECTED',
                'extensionRequest.respondedAt': now,
                'extensionRequest.respondedBy': userId
            },
            $push: {
                extensionHistory: {
                    requestedDays,
                    previousDeadline: currentDeadline,
                    proposedDeadline,
                    approvedDeadline: null,
                    reason,
                    status: 'REJECTED',
                    requestedAt,
                    respondedAt: now,
                    respondedBy: userId
                },
                timeline: {
                    status: preCheck.status,
                    date: now,
                    comment: `Customer rejected vendor extension request. Original fulfillment deadline remains unchanged: ${currentDeadline?.toDateString()}.`
                },
                auditLog: {
                    action: 'EXTENSION_REJECTED',
                    performedBy: userId,
                    performerType: 'User',
                    timestamp: now,
                    reason: `Customer rejected extension of ${requestedDays} day(s). Original deadline: ${currentDeadline?.toISOString()} remains active.`
                }
            }
        },
        { new: true }
    );

    if (!updated) {
        throw new ApiError(409, 'The extension request has already been responded to or no longer exists. Please refresh.');
    }

    // ── Notifications ───────────────────────────────────────────────────────────
    // Notify vendor
    await Notification.create({
        recipientId: updated.acceptedVendorId,
        recipientType: 'vendor',
        type: 'system',
        title: 'Extension Request Rejected',
        message: `Your extension request for product request "${updated.productName}" (${updated.requestId}) has been rejected. The original fulfillment deadline of ${currentDeadline?.toDateString()} remains unchanged.`,
        data: {
            relatedId: updated._id.toString(),
            onModel: 'ProductRequest',
            requestId: updated.requestId
        }
    });

    // Notify Admin
    await Notification.create({
        recipientType: 'admin',
        type: 'system',
        title: 'Extension Request Rejected by Customer',
        message: `Customer rejected vendor extension for "${updated.productName}" (${updated.requestId}). Original deadline unchanged.`,
        data: {
            relatedId: updated._id.toString(),
            onModel: 'ProductRequest',
            requestId: updated.requestId
        }
    });

    res.status(200).json(
        new ApiResponse(200, updated, 'Extension rejected. Original fulfillment deadline remains unchanged.')
    );
});


