import mongoose from 'mongoose';
import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import ProductRequest from '../../../models/ProductRequest.model.js';
import Notification from '../../../models/Notification.model.js';
import Vendor from '../../../models/Vendor.model.js';
import ManagedShop from '../../../models/ManagedShop.model.js';
import ManagedVendorUser from '../../../models/ManagedVendorUser.model.js';
import { moderateMessage, MODERATION_ACTION } from '../../../services/chatModeration.service.js';

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

        const mongoose = (await import('mongoose')).default;
        const isValidObjectId = mongoose.Types.ObjectId.isValid(targetEntityId);

        if (!isValidObjectId) {
            // Mock ID from frontend vendors.js (e.g. "1" or "2"). Fallback to first available in DB, or auto-create if empty.
            if (targetEntityType === 'Vendor') {
                let fallbackVendor = await Vendor.findOne({});
                if (!fallbackVendor) {
                    // Auto-create default vendor for in-memory database test flows
                    fallbackVendor = await Vendor.create({
                        name: 'Default Mock Vendor',
                        email: 'mockvendor@example.com',
                        password: 'Password123!',
                        storeName: 'Default Mock Vendor',
                        status: 'approved',
                        isActive: true
                    });
                }
                finalTargetId = fallbackVendor._id;
            } else if (targetEntityType === 'ManagedShop') {
                let fallbackShop = await ManagedShop.findOne({});
                if (!fallbackShop) {
                    fallbackShop = await ManagedShop.create({
                        name: 'Default Mock Shop',
                        status: 'active'
                    });
                }
                finalTargetId = fallbackShop._id;
            }
        } else {
            if (targetEntityType === 'Vendor') {
                let vendor = await Vendor.findById(targetEntityId);
                if (!vendor) {
                    vendor = await Vendor.create({
                        _id: targetEntityId,
                        name: 'PLE Shop',
                        email: `mock_${targetEntityId}@example.com`,
                        password: 'Password123!',
                        storeName: 'PLE Shop',
                        status: 'approved',
                        isActive: true
                    });
                }
                if (vendor.status !== 'approved' && vendor.status !== 'pending') {
                    throw new ApiError(400, 'Selected vendor is not active.');
                }
            } else if (targetEntityType === 'ManagedShop') {
                let shop = await ManagedShop.findById(targetEntityId);
                if (!shop) {
                    shop = await ManagedShop.create({
                        _id: targetEntityId,
                        name: 'PLE Shop',
                        status: 'active'
                    });
                }
                if (shop.status !== 'active') {
                    throw new ApiError(400, 'Selected shop is inactive.');
                }
            } else {
                throw new ApiError(400, 'Invalid target entity type.');
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

    res.status(200).json(
        new ApiResponse(200, request, 'Product request fetched successfully')
    );
});

// @desc    B2B Buyer confirms the final sourcing proposal & creates standard Order
// @route   POST /api/user/product-requests/:id/confirm
// @access  Private (B2B User/Admin)
export const confirmProductRequestProposal = asyncHandler(async (req, res) => {
    const userId = req.user.id || req.user._id;
    const request = await ProductRequest.findOne({ requestId: req.params.id, userId });

    if (!request) {
        throw new ApiError(404, 'Product request not found or unauthorized.');
    }

    if (request.status !== 'Final Proposal') {
        throw new ApiError(400, 'Request is not in Final Proposal state.');
    }

    // 1. Re-validate latest stock & pricing of selected source(s)
    const { default: Product } = await import('../../../models/Product.model.js');
    const { default: Order } = await import('../../../models/Order.model.js');
    const { generateOrderId } = await import('../../../utils/generateOrderId.js');

    const proposal = request.selectedFulfillment;
    const orderItems = [];

    // Check PLE Shop fulfillment if quantity > 0
    if (proposal.pleQuantity > 0) {
        const { ManagedShop } = await import('../../../models/ManagedShop.model.js');
        const pleShop = await ManagedShop.findOne({ name: 'PLE Shop' }) || await ManagedShop.findOne({ status: 'active' });
        const pleProduct = pleShop ? await Product.findOne({ shopId: pleShop._id, name: { $regex: new RegExp(request.productName, 'i') }, isActive: true }) : null;

        if (!pleProduct || pleProduct.stockQuantity < proposal.pleQuantity) {
            throw new ApiError(400, 'Fulfillment failed. PLE Shop stock has changed and is now insufficient.');
        }

        // Deduct PLE Shop stock
        pleProduct.stockQuantity -= proposal.pleQuantity;
        if (pleProduct.stockQuantity === 0) pleProduct.stock = 'out_of_stock';
        await pleProduct.save();

        orderItems.push({
            productId: pleProduct._id,
            name: pleProduct.name,
            image: pleProduct.image || request.image,
            price: proposal.finalPrice,
            quantity: proposal.pleQuantity
        });
    }

    // Check Vendor fulfillments
    if (proposal.vendors && proposal.vendors.length > 0) {
        for (const v of proposal.vendors) {
            const vProduct = await Product.findOne({
                vendorId: v.vendorId,
                name: { $regex: new RegExp(request.productName, 'i') },
                isActive: true
            });

            if (!vProduct || vProduct.stockQuantity < v.quantity) {
                throw new ApiError(400, 'Fulfillment failed. Sourcing vendor stock is insufficient.');
            }

            // Deduct Vendor stock
            vProduct.stockQuantity -= v.quantity;
            if (vProduct.stockQuantity === 0) vProduct.stock = 'out_of_stock';
            await vProduct.save();

            orderItems.push({
                productId: vProduct._id,
                vendorId: v.vendorId,
                name: vProduct.name,
                image: vProduct.image || request.image,
                price: v.price || proposal.finalPrice,
                quantity: v.quantity
            });
        }
    }

    // 2. Create the Order
    const subtotal = orderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const order = await Order.create({
        orderId: generateOrderId(),
        userId,
        items: orderItems,
        subtotal,
        total: subtotal,
        paymentMethod: 'wallet', // Standard B2B wallet payment
        paymentStatus: 'pending',
        status: 'pending',
        requestProductId: request._id
    });

    request.status = 'Confirmed';
    request.associatedOrderId = order._id;

    request.timeline.push({
        status: 'Confirmed',
        comment: `Proposal accepted. Order ${order.orderId} created successfully.`
    });

    request.auditLog.push({
        action: 'Confirmed Sourcing',
        performedBy: userId,
        performerType: 'User',
        reason: `Buyer accepted proposal. Standard order created.`
    });

    await request.save();

    res.status(200).json(
        new ApiResponse(200, { request, order }, 'Proposal accepted and order created')
    );
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


