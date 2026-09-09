import mongoose from 'mongoose';
import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import ProductRequest from '../../../models/ProductRequest.model.js';
import Notification from '../../../models/Notification.model.js';

// @desc    Get product requests visible to the vendor
// @route   GET /api/vendor/product-requests
// @access  Private (Vendor / Managed Vendor)
export const getVendorProductRequests = asyncHandler(async (req, res) => {
    const { type, status, page = 1, limit = 10 } = req.query;

    const isIndependentVendor = req.user.role === 'vendor';
    const isManagedVendor = req.user.role === 'managed_vendor';
    const sellerId = req.user._id || req.user.id;

    let visibilityFilter = {};

    if (isIndependentVendor) {
        // Must be explicitly assigned in assignedVendors OR be target of shop_specific
        // OR there is an open vendor window (any eligible approved vendor can see)
        // OR this vendor has accepted the request
        visibilityFilter = {
            $or: [
                { 'assignedVendors.vendorId': sellerId },
                { requestType: 'SHOP_SPECIFIC', targetEntityType: 'Vendor', targetEntityId: sellerId },
                { windowStatus: { $in: ['OPEN', 'REOPENED'] } },
                { acceptedVendorId: sellerId }
            ]
        };
    } else if (isManagedVendor) {
        if (!req.user.shopId) {
            throw new ApiError(400, 'Managed vendor is not assigned to a shop.');
        }
        visibilityFilter = {
            $or: [
                { 'assignedVendors.vendorId': req.user.shopId },
                { requestType: 'SHOP_SPECIFIC', targetEntityType: 'ManagedShop', targetEntityId: req.user.shopId },
                { windowStatus: { $in: ['OPEN', 'REOPENED'] } },
                { acceptedVendorId: req.user.shopId },
                { acceptedVendorId: sellerId }
            ]
        };
    } else {
        throw new ApiError(403, 'Unauthorized access.');
    }

    const filter = { ...visibilityFilter };

    // Apply status filter
    if (status) {
        if (status === 'Pending') {
            filter.status = { $in: ['Submitted', 'Under Review', 'Vendor Sourcing', 'Vendor Window Open', 'Vendor Accepted'] };
        } else {
            filter.status = status;
        }
    }

    // Apply type filter (All, General, Direct)
    if (type === 'General') {
        filter.requestType = 'GENERAL';
    } else if (type === 'Direct') {
        filter.requestType = 'SHOP_SPECIFIC';
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const skip = (pageNum - 1) * limitNum;

    const total = await ProductRequest.countDocuments(filter);
    const requests = await ProductRequest.find(filter)
        .populate('userId', 'name email phone')
        .populate({
            path: 'targetEntityId',
            select: 'storeName storeLogo rating address name logo location'
        })
        .populate({
            path: 'acceptedVendorId',
            select: 'name storeName email phone'
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

// @desc    Respond to a product request
// @route   PUT /api/vendor/product-requests/:id/respond
// @access  Private (Vendor / Managed Vendor)
export const respondToProductRequest = asyncHandler(async (req, res) => {
    const { responseType, offeredPrice, deliveryTimeline, message } = req.body;

    if (!responseType || !message) {
        throw new ApiError(400, 'Please provide responseType and message.');
    }

    const request = await ProductRequest.findOne({ requestId: req.params.id });

    if (!request) {
        throw new ApiError(404, 'Product request not found.');
    }

    const isIndependentVendor = req.user.role === 'vendor';
    const isManagedVendor = req.user.role === 'managed_vendor';
    const sellerId = req.user._id || req.user.id;

    // Validate ownership/authorization
    if (request.requestType === 'SHOP_SPECIFIC') {
        if (request.targetEntityType === 'Vendor') {
            if (!isIndependentVendor || String(request.targetEntityId) !== String(sellerId)) {
                throw new ApiError(403, 'Unauthorized. This request was directed to another seller.');
            }
        } else if (request.targetEntityType === 'ManagedShop') {
            if (!isManagedVendor || String(request.targetEntityId) !== String(req.user.shopId)) {
                throw new ApiError(403, 'Unauthorized. This request was directed to another shop.');
            }
        }
    } else {
        // For general sourcing, make sure they are in assignedVendors list
        const isAssigned = request.assignedVendors.some(v => String(v.vendorId) === String(sellerId));
        if (!isAssigned) {
            throw new ApiError(403, 'Unauthorized. You are not assigned to bid on this request.');
        }
    }

    // 2. Validate current stock of vendor's product before accepting response
    const { default: Product } = await import('../../../models/Product.model.js');
    const vendorProduct = await Product.findOne({
        vendorId: sellerId,
        name: { $regex: new RegExp(request.productName, 'i') },
        isActive: true
    });

    let finalResponseType = responseType;
    if (responseType === 'Can Supply') {
        if (!vendorProduct || vendorProduct.stockQuantity <= 0 || vendorProduct.stock === 'out_of_stock') {
            finalResponseType = 'Cannot Supply';
        } else if (vendorProduct.stockQuantity < request.quantity) {
            // Partial stock is acceptable but let's log/inform
        }
    }

    // Add to legacy sellerResponses array for B2B user view
    request.sellerResponses.push({
        sellerId,
        sellerType: isIndependentVendor ? 'Vendor' : 'ManagedVendorUser',
        responseType: finalResponseType,
        offeredPrice: finalResponseType === 'Can Supply' ? Number(offeredPrice) : undefined,
        deliveryTimeline: finalResponseType === 'Can Supply' ? Number(deliveryTimeline) : undefined,
        message: finalResponseType === 'Cannot Supply' ? 'Unavailable / Insufficient stock' : message,
        date: new Date()
    });

    // Update assignment tracking subdocument
    const assignmentIdx = request.assignedVendors.findIndex(v => String(v.vendorId) === String(sellerId));
    if (assignmentIdx !== -1) {
        request.assignedVendors[assignmentIdx].status = finalResponseType === 'Can Supply' ? 'RESPONDED' : 'UNAVAILABLE';
        request.assignedVendors[assignmentIdx].offeredPrice = offeredPrice;
        request.assignedVendors[assignmentIdx].availableQuantity = vendorProduct ? vendorProduct.stockQuantity : 0;
        request.assignedVendors[assignmentIdx].deliveryTimeline = deliveryTimeline;
        request.assignedVendors[assignmentIdx].message = message;
        request.assignedVendors[assignmentIdx].respondedAt = new Date();
    }

    const previousStatus = request.status;
    
    // If vendor cannot supply, fallback request status back to Admin Review/Vendor Sourcing
    if (finalResponseType === 'Cannot Supply') {
        request.status = 'Admin Review';
    } else {
        request.status = 'Seller Responded';
    }

    // Add to timeline
    request.timeline.push({
        status: request.status,
        comment: message || `Vendor submitted a response: ${finalResponseType}`
    });

    // Add to audit log
    request.auditLog.push({
        action: 'Responded',
        performedBy: sellerId,
        performerType: isIndependentVendor ? 'Vendor' : 'ManagedVendorUser',
        reason: `Vendor responded: ${finalResponseType}. Request status transitioned from ${previousStatus} to ${request.status}.`
    });

    await request.save();

    // Notify Super Admin
    await Notification.create({
        recipientType: 'admin',
        type: 'system',
        title: 'Vendor Sourcing Response',
        message: `Vendor ${req.user.name} responded to sourcing request "${request.productName}" with: ${finalResponseType}.`,
        data: {
            relatedId: request._id.toString(),
            onModel: 'ProductRequest'
        }
    });

    res.status(200).json(
        new ApiResponse(200, request, 'Response submitted successfully')
    );
});

// @desc    Atomically accept the vendor window (race-condition safe)
// @route   POST /api/vendor/product-requests/:id/accept-window
// @access  Private (Vendor)
export const acceptVendorWindow = asyncHandler(async (req, res) => {
    const isIndependentVendor = req.user.role === 'vendor';
    const sellerId = req.user._id || req.user.id;

    if (!isIndependentVendor) {
        throw new ApiError(403, 'Only independent vendors can accept vendor windows.');
    }

    // Verify vendor is approved
    const { default: Vendor } = await import('../../../models/Vendor.model.js');
    const vendorDoc = await Vendor.findById(sellerId);
    if (!vendorDoc || vendorDoc.status !== 'approved') {
        throw new ApiError(403, 'Only approved vendors can accept vendor windows.');
    }

    // Check if this vendor previously released this request (no re-entry by default)
    const requestCheck = await ProductRequest.findOne({ requestId: req.params.id });
    if (!requestCheck) {
        throw new ApiError(404, 'Product request not found.');
    }

    const alreadyReleased = requestCheck.releasedVendors.some(
        rv => String(rv.vendorId) === String(sellerId)
    );
    if (alreadyReleased) {
        throw new ApiError(400, 'You have already released this request and cannot accept it again.');
    }

    const now = new Date();
    const fulfillmentExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days

    // ATOMIC: Only succeeds if windowStatus is still OPEN/REOPENED, not expired, and not yet taken
    const updated = await ProductRequest.findOneAndUpdate(
        {
            requestId: req.params.id,
            windowStatus: { $in: ['OPEN', 'REOPENED'] },
            windowExpiresAt: { $gt: now },
            acceptedVendorId: null
        },
        {
            $set: {
                windowStatus: 'VENDOR_LOCKED',
                acceptedVendorId: sellerId,
                vendorAcceptedAt: now,
                vendorFulfillmentExpiresAt: fulfillmentExpiresAt,
                vendorFulfillmentStatus: 'IN_PROGRESS',
                status: 'Vendor Accepted'
            },
            $push: {
                timeline: {
                    status: 'Vendor Accepted',
                    date: now,
                    comment: `Vendor ${vendorDoc.storeName || vendorDoc.name} accepted the request. 7-day fulfillment window starts now. Deadline: ${fulfillmentExpiresAt.toISOString()}`
                },
                auditLog: {
                    action: 'VENDOR_ACCEPTED',
                    performedBy: sellerId,
                    performerType: 'Vendor',
                    timestamp: now,
                    reason: `Vendor ${vendorDoc.storeName || vendorDoc.name} accepted the open window. Fulfillment deadline: ${fulfillmentExpiresAt.toISOString()}`
                }
            }
        },
        { new: true }
    );

    if (!updated) {
        // Race condition — another vendor got there first, or window expired
        throw new ApiError(409, 'This request has already been accepted by another vendor or the window has expired.');
    }

    // Notify Admin
    const { default: Notification } = await import('../../../models/Notification.model.js');
    await Notification.create({
        recipientType: 'admin',
        type: 'system',
        title: 'Vendor Accepted Product Request',
        message: `Vendor "${vendorDoc.storeName || vendorDoc.name}" has accepted the vendor window for "${updated.productName}". They have a 7-day fulfillment deadline.`,
        data: {
            relatedId: updated._id.toString(),
            onModel: 'ProductRequest',
            requestId: updated.requestId
        }
    });

    // Notify the customer
    await Notification.create({
        recipientId: updated.userId,
        recipientType: 'user',
        type: 'system',
        title: 'Vendor Accepted Your Request',
        message: `Great news! A vendor has accepted your product request for "${updated.productName}" and will work with you on the details.`,
        data: {
            relatedId: updated._id.toString(),
            onModel: 'ProductRequest'
        }
    });

    res.status(200).json(
        new ApiResponse(200, updated, 'Request accepted successfully. You have 7 days to fulfill.')
    );
});

// @desc    Vendor releases the locked request
// @route   POST /api/vendor/product-requests/:id/release
// @access  Private (Vendor)
export const releaseRequest = asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const sellerId = req.user._id || req.user.id;

    const request = await ProductRequest.findOne({ requestId: req.params.id });
    if (!request) {
        throw new ApiError(404, 'Product request not found.');
    }

    // Only the vendor who accepted can release
    if (String(request.acceptedVendorId) !== String(sellerId)) {
        throw new ApiError(403, 'You are not the accepted vendor for this request.');
    }

    if (request.vendorFulfillmentStatus !== 'IN_PROGRESS') {
        throw new ApiError(400, 'Request is not in an active fulfillment state.');
    }

    const now = new Date();
    const releaseReason = reason || 'Vendor unable to fulfill the request.';

    // Track this vendor in releasedVendors
    request.releasedVendors.push({
        vendorId: sellerId,
        releasedAt: now,
        reason: releaseReason
    });

    // Release the lock
    request.acceptedVendorId = null;
    request.vendorAcceptedAt = null;
    request.vendorFulfillmentExpiresAt = null;
    request.vendorFulfillmentStatus = 'RELEASED';

    // Check if overall window still valid
    const windowStillValid = request.windowExpiresAt && request.windowExpiresAt > now;

    if (windowStillValid) {
        request.windowStatus = 'REOPENED';
        request.status = 'Vendor Window Open';
        request.timeline.push({
            status: 'Vendor Window Open',
            date: now,
            comment: `Vendor released the request. Window reopened for eligible vendors. ${releaseReason}`
        });
    } else {
        request.windowStatus = 'EXPIRED';
        request.status = 'Expired';
        request.timeline.push({
            status: 'Expired',
            date: now,
            comment: `Vendor released the request but the 14-day window has expired. Admin review required.`
        });
    }

    request.auditLog.push({
        action: 'VENDOR_RELEASED',
        performedBy: sellerId,
        performerType: 'Vendor',
        timestamp: now,
        reason: releaseReason
    });

    await request.save();

    // Notify Admin
    const { default: Notification } = await import('../../../models/Notification.model.js');
    await Notification.create({
        recipientType: 'admin',
        type: 'system',
        title: 'Vendor Released Product Request',
        message: `A vendor has released the product request "${request.productName}". ${windowStillValid ? 'Window reopened for other vendors.' : 'Window expired — admin action required.'}`,
        data: {
            relatedId: request._id.toString(),
            onModel: 'ProductRequest',
            requestId: request.requestId
        }
    });

    // Notify customer
    await Notification.create({
        recipientId: request.userId,
        recipientType: 'user',
        type: 'system',
        title: 'Vendor Update on Your Request',
        message: windowStillValid
            ? `The vendor for your request "${request.productName}" was unable to proceed. We are finding another vendor for you.`
            : `The vendor for your request "${request.productName}" was unable to proceed and the search window has expired. Please contact support.`,
        data: {
            relatedId: request._id.toString(),
            onModel: 'ProductRequest'
        }
    });

    res.status(200).json(
        new ApiResponse(200, request, windowStillValid ? 'Request released. Window reopened for other vendors.' : 'Request released. Window has expired.')
    );
});

// @desc    Vendor submits a quotation for the accepted request
// @route   POST /api/vendor/product-requests/:id/submit-quotation
// @access  Private (Vendor)
export const submitQuotation = asyncHandler(async (req, res) => {
    const { unitPrice, totalPrice, deliveryEstimate, additionalTerms, notes } = req.body;
    const sellerId = req.user._id || req.user.id;

    if (!unitPrice || !totalPrice) {
        throw new ApiError(400, 'Unit price and total price are required.');
    }

    const request = await ProductRequest.findOne({ requestId: req.params.id });
    if (!request) {
        throw new ApiError(404, 'Product request not found.');
    }

    // Only the accepted vendor can submit quotation
    if (String(request.acceptedVendorId) !== String(sellerId)) {
        throw new ApiError(403, 'You are not the accepted vendor for this request.');
    }

    if (request.vendorFulfillmentStatus !== 'IN_PROGRESS') {
        throw new ApiError(400, 'Request is not in an active fulfillment state.');
    }

    // Check if 7-day window is still valid
    if (request.vendorFulfillmentExpiresAt && request.vendorFulfillmentExpiresAt < new Date()) {
        throw new ApiError(400, 'Your 7-day fulfillment window has expired.');
    }

    const now = new Date();

    // Replace or add quotation from this vendor
    const existingIdx = request.vendorQuotations.findIndex(
        q => String(q.vendorId) === String(sellerId)
    );

    const quotationData = {
        vendorId: sellerId,
        unitPrice: Number(unitPrice),
        totalPrice: Number(totalPrice),
        deliveryEstimate: deliveryEstimate || '',
        additionalTerms: additionalTerms || '',
        notes: notes || '',
        status: 'Pending',
        submittedAt: now
    };

    if (existingIdx !== -1) {
        request.vendorQuotations[existingIdx] = quotationData;
    } else {
        request.vendorQuotations.push(quotationData);
    }

    request.status = 'Quotation Submitted';
    request.timeline.push({
        status: 'Quotation Submitted',
        date: now,
        comment: `Vendor submitted quotation: ₹${unitPrice}/unit, Total: ₹${totalPrice}. Delivery: ${deliveryEstimate || 'TBD'}.`
    });
    request.auditLog.push({
        action: 'QUOTATION_SUBMITTED',
        performedBy: sellerId,
        performerType: 'Vendor',
        timestamp: now,
        reason: `Vendor submitted quotation at ₹${totalPrice} total.`
    });

    await request.save();

    // Notify Admin and customer
    const { default: Notification } = await import('../../../models/Notification.model.js');
    await Notification.create({
        recipientType: 'admin',
        type: 'system',
        title: 'Vendor Submitted Quotation',
        message: `Vendor submitted a quotation for "${request.productName}" — ₹${totalPrice} total.`,
        data: { relatedId: request._id.toString(), onModel: 'ProductRequest', requestId: request.requestId }
    });
    await Notification.create({
        recipientId: request.userId,
        recipientType: 'user',
        type: 'system',
        title: 'Quotation Received — Action Required',
        message: `You have received a quotation for your request "${request.productName}" — ₹${totalPrice} total. Please review and respond.`,
        data: { relatedId: request._id.toString(), onModel: 'ProductRequest' }
    });

    res.status(200).json(
        new ApiResponse(200, request, 'Quotation submitted successfully')
    );
});

// @desc    Vendor marks the request as fulfilled
// @route   POST /api/vendor/product-requests/:id/fulfill
// @access  Private (Vendor)
export const markFulfilled = asyncHandler(async (req, res) => {
    const { note } = req.body;
    const sellerId = req.user._id || req.user.id;

    const request = await ProductRequest.findOne({ requestId: req.params.id });
    if (!request) {
        throw new ApiError(404, 'Product request not found.');
    }

    if (String(request.acceptedVendorId) !== String(sellerId)) {
        throw new ApiError(403, 'You are not the accepted vendor for this request.');
    }

    if (request.vendorFulfillmentStatus !== 'IN_PROGRESS') {
        throw new ApiError(400, 'Request is not in an active fulfillment state.');
    }

    const now = new Date();
    request.vendorFulfillmentStatus = 'FULFILLED';
    request.windowStatus = 'CLOSED';
    request.status = 'Completed';

    request.timeline.push({
        status: 'Completed',
        date: now,
        comment: note || 'Vendor marked the request as fulfilled.'
    });
    request.auditLog.push({
        action: 'VENDOR_FULFILLED',
        performedBy: sellerId,
        performerType: 'Vendor',
        timestamp: now,
        reason: note || 'Vendor marked request as fulfilled.'
    });

    await request.save();

    const { default: Notification } = await import('../../../models/Notification.model.js');
    await Notification.create({
        recipientType: 'admin',
        type: 'system',
        title: 'Vendor Fulfilled Request',
        message: `Vendor fulfilled the product request "${request.productName}".`,
        data: { relatedId: request._id.toString(), onModel: 'ProductRequest', requestId: request.requestId }
    });
    await Notification.create({
        recipientId: request.userId,
        recipientType: 'user',
        type: 'system',
        title: 'Request Fulfilled',
        message: `Your product request "${request.productName}" has been fulfilled by the vendor.`,
        data: { relatedId: request._id.toString(), onModel: 'ProductRequest' }
    });

    res.status(200).json(
        new ApiResponse(200, request, 'Request marked as fulfilled.')
    );
});

// @desc    Vendor requests an extension to the fulfillment deadline
// @route   POST /api/vendor/product-requests/:id/request-extension
// @access  Private (Vendor)
export const requestExtension = asyncHandler(async (req, res) => {
    const { additionalDays, reason } = req.body;
    const sellerId = req.user._id || req.user.id;

    // ── Input Validation ────────────────────────────────────────────────────────
    const parsedDays = parseInt(additionalDays, 10);
    if (!parsedDays || parsedDays < 1 || parsedDays > 30) {
        throw new ApiError(400, 'Additional days must be a positive integer between 1 and 30.');
    }
    if (!reason || !reason.trim()) {
        throw new ApiError(400, 'Reason is required for an extension request.');
    }
    const trimmedReason = reason.trim();
    if (trimmedReason.length > 500) {
        throw new ApiError(400, 'Reason must not exceed 500 characters.');
    }

    // ── Fetch & validate base state ─────────────────────────────────────────────
    const idParam = req.params.id;
    const queryConditions = [{ requestId: idParam }];
    if (mongoose.isValidObjectId(idParam)) {
        queryConditions.push({ _id: idParam });
    }
    const request = await ProductRequest.findOne({ $or: queryConditions });
    if (!request) {
        throw new ApiError(404, 'Product request not found.');
    }

    // Must be the accepted vendor
    if (String(request.acceptedVendorId) !== String(sellerId)) {
        throw new ApiError(403, 'You are not the accepted vendor for this request.');
    }

    // Must not be completed / cancelled / expired / rejected
    const blockedStatuses = ['Completed', 'Cancelled', 'Expired', 'Rejected'];
    if (blockedStatuses.includes(request.status)) {
        throw new ApiError(400, `Cannot request an extension when request is in "${request.status}" state.`);
    }

    // ── Fallback current deadline calculation for older records ─────────────────
    const now = new Date();
    const currentDeadline = request.vendorFulfillmentExpiresAt || 
        (request.vendorAcceptedAt ? new Date(new Date(request.vendorAcceptedAt).getTime() + 7 * 24 * 60 * 60 * 1000) : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));
    const proposedDeadline = new Date(currentDeadline.getTime() + parsedDays * 24 * 60 * 60 * 1000);

    // ── Atomic update — prevents race condition and duplicate pending extension ──
    const updated = await ProductRequest.findOneAndUpdate(
        {
            _id: request._id,
            acceptedVendorId: sellerId,
            $or: [
                { 'extensionRequest.status': { $exists: false } },
                { 'extensionRequest.status': 'NONE' },
                { 'extensionRequest.status': 'APPROVED' },
                { 'extensionRequest.status': 'REJECTED' }
            ]
        },
        {
            $set: {
                vendorFulfillmentStatus: 'IN_PROGRESS',
                vendorFulfillmentExpiresAt: currentDeadline,
                extensionRequest: {
                    status: 'PENDING',
                    requestedDays: parsedDays,
                    currentDeadline,
                    proposedDeadline,
                    reason: trimmedReason,
                    requestedAt: now,
                    respondedAt: null,
                    respondedBy: null
                }
            },
            $push: {
                timeline: {
                    status: request.status,
                    date: now,
                    comment: `Vendor requested a ${parsedDays}-day extension (reason: "${trimmedReason}"). Proposed new deadline: ${proposedDeadline.toDateString()}. Awaiting customer approval.`
                },
                auditLog: {
                    action: 'EXTENSION_REQUESTED',
                    performedBy: sellerId,
                    performerType: 'Vendor',
                    timestamp: now,
                    reason: `Vendor requested ${parsedDays} extra day(s). Reason: "${trimmedReason}". Proposed deadline: ${proposedDeadline.toISOString()}`
                }
            }
        },
        { new: true }
    );

    if (!updated) {
        throw new ApiError(409, 'An extension request is already pending, or the request state has changed. Please refresh and try again.');
    }

    // ── Notifications ───────────────────────────────────────────────────────────
    const { default: NotificationModel } = await import('../../../models/Notification.model.js');

    // Notify customer
    await NotificationModel.create({
        recipientId: updated.userId,
        recipientType: 'user',
        type: 'system',
        title: 'Vendor Requested Additional Fulfillment Time',
        message: `The vendor for your product request "${updated.productName}" (${updated.requestId}) has requested ${parsedDays} additional day(s) to fulfill your order. Please review and respond.`,
        data: {
            relatedId: updated._id.toString(),
            onModel: 'ProductRequest',
            requestId: updated.requestId
        }
    });

    // Notify Admin
    await NotificationModel.create({
        recipientType: 'admin',
        type: 'system',
        title: 'Vendor Extension Request Submitted',
        message: `Vendor requested ${parsedDays} additional day(s) for product request "${updated.productName}" (${updated.requestId}). Customer approval pending.`,
        data: {
            relatedId: updated._id.toString(),
            onModel: 'ProductRequest',
            requestId: updated.requestId
        }
    });

    res.status(200).json(
        new ApiResponse(200, updated, `Extension request submitted. Awaiting customer approval.`)
    );
});

