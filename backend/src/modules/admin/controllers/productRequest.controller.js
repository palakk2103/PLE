import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import ProductRequest from '../../../models/ProductRequest.model.js';
import Notification from '../../../models/Notification.model.js';
import Product from '../../../models/Product.model.js';
import Vendor from '../../../models/Vendor.model.js';
import { ManagedShop } from '../../../models/ManagedShop.model.js';

// @desc    Get all product requests (for admin)
// @route   GET /api/admin/product-requests
// @access  Private (Admin)
export const getAllProductRequests = asyncHandler(async (req, res) => {
    const { 
        type, 
        status, 
        sellerType, 
        sellerId, 
        category, 
        search, 
        startDate, 
        endDate, 
        page = 1, 
        limit = 10 
    } = req.query;

    const filter = {};

    // 1. Request Type Filter
    if (type === 'General') {
        filter.requestType = 'GENERAL';
    } else if (type === 'Shop') {
        filter.requestType = 'SHOP_SPECIFIC';
    }

    // 2. Status Filter
    if (status) {
        if (status === 'Pending') {
            filter.status = { $in: ['Submitted', 'Under Review'] };
        } else {
            filter.status = status;
        }
    }

    // 3. Seller Type Filter
    if (sellerType) {
        filter.targetEntityType = sellerType;
    }

    // 4. Seller ID Filter
    if (sellerId) {
        filter.targetEntityId = sellerId;
    }

    // 5. Category Filter
    if (category) {
        filter.category = category;
    }

    // 6. Search Filter
    if (search) {
        filter.$or = [
            { productName: { $regex: search, $options: 'i' } },
            { requestId: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } }
        ];
    }

    // 7. Date Range Filter
    if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) {
            filter.createdAt.$gte = new Date(startDate);
        }
        if (endDate) {
            filter.createdAt.$lte = new Date(endDate);
        }
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const skip = (pageNum - 1) * limitNum;

    const total = await ProductRequest.countDocuments(filter);
    const requests = await ProductRequest.find(filter)
        .populate('userId', 'name email role phone')
        .populate({
            path: 'targetEntityId',
            select: 'storeName storeLogo rating address name logo location'
        })
        .populate({
            path: 'acceptedVendorId',
            select: 'name storeName email phone companyName storeLogo'
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);

    // Format for admin dashboard matching frontend needs
    const formattedRequests = requests.map(reqItem => ({
        id: reqItem.requestId,
        _id: reqItem._id,
        productName: reqItem.productName,
        category: reqItem.category,
        quantity: reqItem.quantity,
        expectedBudget: reqItem.expectedBudget,
        description: reqItem.description,
        image: reqItem.image,
        status: reqItem.status,
        date: reqItem.createdAt,
        userId: reqItem.userId,
        timeline: reqItem.timeline,
        sellerResponses: reqItem.sellerResponses,
        requestType: reqItem.requestType,
        targetEntityType: reqItem.targetEntityType,
        targetEntityId: reqItem.targetEntityId,
        fulfillmentType: reqItem.fulfillmentType,
        assignedVendors: reqItem.assignedVendors,
        auditLog: reqItem.auditLog,
        windowStatus: reqItem.windowStatus,
        windowOpenedAt: reqItem.windowOpenedAt,
        windowExpiresAt: reqItem.windowExpiresAt,
        acceptedVendorId: reqItem.acceptedVendorId,
        vendorAcceptedAt: reqItem.vendorAcceptedAt,
        vendorFulfillmentExpiresAt: reqItem.vendorFulfillmentExpiresAt,
        vendorFulfillmentStatus: reqItem.vendorFulfillmentStatus,
        vendorQuotations: reqItem.vendorQuotations
    }));

    res.status(200).json(
        new ApiResponse(200, {
            requests: formattedRequests,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum)
            }
        }, 'Product requests fetched successfully')
    );
});

// @desc    Update product request status
// @route   PUT /api/admin/product-requests/:id/status
// @access  Private (Admin)
export const updateProductRequestStatus = asyncHandler(async (req, res) => {
    const { status, comment } = req.body;
    
    if (!status) {
        throw new ApiError(400, 'Please provide status');
    }

    const request = await ProductRequest.findOne({ requestId: req.params.id });

    if (!request) {
        throw new ApiError(404, 'Product request not found');
    }

    const previousStatus = request.status;
    request.status = status;
    
    // Add to timeline
    request.timeline.push({
        status,
        comment: comment || `Status updated to ${status} by Administrator.`
    });

    // Add to audit log
    request.auditLog.push({
        action: `Updated Status to ${status}`,
        performedBy: req.user._id || req.user.id,
        performerType: 'Admin',
        reason: comment || `Status transition from ${previousStatus} to ${status}.`
    });

    await request.save();

    // Notify the user
    await Notification.create({
        recipientId: request.userId,
        recipientType: 'user',
        type: 'system',
        title: 'Product Request Updated',
        message: `Your product request "${request.productName}" status has been updated to ${status}.`,
        data: {
            relatedId: request._id.toString(),
            onModel: 'ProductRequest'
        }
    });

    res.status(200).json(
        new ApiResponse(200, request, 'Product request status updated')
    );
});

// @desc    Delete product request
// @route   DELETE /api/admin/product-requests/:id
// @access  Private (Admin)
export const deleteProductRequest = asyncHandler(async (req, res) => {
    const request = await ProductRequest.findOne({ requestId: req.params.id });

    if (!request) {
        throw new ApiError(404, 'Product request not found');
    }

    // Add to audit log before delete (or we can just delete)
    await ProductRequest.deleteOne({ _id: request._id });

    res.status(200).json(
        new ApiResponse(200, null, 'Product request deleted successfully')
    );
});

// @desc    Sourcing check (PLE inventory and vendor availability)
// @route   GET /api/admin/product-requests/:id/sourcing-check
// @access  Private (Admin)
export const sourcingCheck = asyncHandler(async (req, res) => {
    const request = await ProductRequest.findOne({ requestId: req.params.id });
    if (!request) {
        throw new ApiError(404, 'Product request not found');
    }

    // 1. PLE Shop Check
    // Locate the PLE Shop entity
    const pleShop = await ManagedShop.findOne({ name: 'PLE Shop' }) || await ManagedShop.findOne({ status: 'active' });
    let pleAvailableQty = 0;
    let pleStatus = 'NOT_AVAILABLE';

    if (pleShop) {
        // Find matching product listed under PLE Shop
        const pleProduct = await Product.findOne({
            shopId: pleShop._id,
            name: { $regex: new RegExp(request.productName, 'i') },
            isActive: true
        });

        if (pleProduct) {
            pleAvailableQty = pleProduct.stockQuantity || 0;
            if (pleAvailableQty >= request.quantity) {
                pleStatus = 'AVAILABLE';
            } else if (pleAvailableQty > 0) {
                pleStatus = 'PARTIAL';
            }
        }
    }

    // 2. Vendor Matching & Eligibility
    // Find all external vendor products matching the name/category
    const matchingProducts = await Product.find({
        name: { $regex: new RegExp(request.productName, 'i') },
        vendorId: { $exists: true, $ne: null },
        isActive: true
    }).populate('vendorId');

    const vendorsList = [];
    for (const prod of matchingProducts) {
        const vendor = prod.vendorId;
        if (!vendor) continue;

        let status = 'Eligible';
        if (vendor.status !== 'approved') {
            status = 'Vendor Inactive';
        } else if (prod.stockQuantity <= 0 || prod.stock === 'out_of_stock') {
            status = 'Out of Stock';
        } else if (prod.stockQuantity < request.quantity) {
            status = 'Partially Available';
        }

        vendorsList.push({
            vendorId: vendor._id,
            vendorName: vendor.storeName || vendor.name,
            productName: prod.name,
            productId: prod._id,
            normalB2BPrice: prod.price || prod.b2bWholesalePrice || 0,
            availableQuantity: prod.stockQuantity || 0,
            status
        });
    }

    res.status(200).json(
        new ApiResponse(200, {
            requestedQuantity: request.quantity,
            pleAvailability: {
                shopId: pleShop?._id,
                availableQuantity: pleAvailableQty,
                shortfall: Math.max(0, request.quantity - pleAvailableQty),
                status: pleStatus
            },
            vendors: vendorsList
        }, 'Sourcing check completed')
    );
});

// @desc    Assign request to vendors / PLE
// @route   POST /api/admin/product-requests/:id/assign-sourcing
// @access  Private (Admin)
export const assignSourcing = asyncHandler(async (req, res) => {
    const { fulfillmentType, pleQuantity, vendors } = req.body;
    // vendors is array of { vendorId }

    const request = await ProductRequest.findOne({ requestId: req.params.id });
    if (!request) {
        throw new ApiError(404, 'Product request not found');
    }

    request.fulfillmentType = fulfillmentType || 'NONE';
    
    if (fulfillmentType === 'PLE_SHOP') {
        const pleShop = await ManagedShop.findOne({ name: 'PLE Shop' }) || await ManagedShop.findOne({ status: 'active' });
        const pleProduct = pleShop ? await Product.findOne({ shopId: pleShop._id, name: { $regex: new RegExp(request.productName, 'i') }, isActive: true }) : null;
        const available = pleProduct ? pleProduct.stockQuantity : 0;

        request.pleFulfillment = {
            availableQuantity: available,
            status: available >= request.quantity ? 'AVAILABLE' : (available > 0 ? 'PARTIAL' : 'NOT_AVAILABLE')
        };
        request.status = 'PLE Sourcing';
    } else {
        request.status = 'Vendor Sourcing';
    }

    if (vendors && Array.isArray(vendors)) {
        request.assignedVendors = vendors.map(v => ({
            vendorId: v.vendorId,
            status: 'ASSIGNED',
            assignedAt: new Date()
        }));

        // Notify each assigned vendor
        for (const v of vendors) {
            await Notification.create({
                recipientId: v.vendorId,
                recipientType: 'vendor',
                type: 'system',
                title: 'New Product Sourcing Request',
                message: `You have been assigned to bid for B2B product request: "${request.productName}" (Qty: ${request.quantity}).`,
                data: {
                    relatedId: request._id.toString(),
                    onModel: 'ProductRequest'
                }
            });
        }
    }

    request.timeline.push({
        status: request.status,
        comment: `Request placed in sourcing pool: Mode - ${request.fulfillmentType}.`
    });

    request.auditLog.push({
        action: 'Assigned Sourcing',
        performedBy: req.user.id || req.user._id,
        performerType: 'Admin',
        reason: `Admin assigned sourcing targets under mode ${request.fulfillmentType}.`
    });

    await request.save();

    res.status(200).json(
        new ApiResponse(200, request, 'Sourcing assigned successfully')
    );
});

// @desc    Admin reviews vendor/PLE offers and creates final proposal
// @route   POST /api/admin/product-requests/:id/select-fulfillment
// @access  Private (Admin)
export const selectFulfillment = asyncHandler(async (req, res) => {
    const { pleQuantity, vendors, finalPrice, estimatedDelivery, notes } = req.body;
    // vendors: array of { vendorId, quantity, price }

    const request = await ProductRequest.findOne({ requestId: req.params.id });
    if (!request) {
        throw new ApiError(404, 'Product request not found');
    }

    request.selectedFulfillment = {
        pleQuantity: pleQuantity || 0,
        vendors: vendors || [],
        finalPrice,
        estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : undefined,
        notes
    };

    request.status = 'Final Proposal';

    request.timeline.push({
        status: 'Final Proposal',
        comment: `Fulfillment options selected. Final price proposed: ₹${finalPrice}.`
    });

    request.auditLog.push({
        action: 'Proposed Fulfillment',
        performedBy: req.user.id || req.user._id,
        performerType: 'Admin',
        reason: `Fulfillment options chosen and proposed to buyer.`
    });

    await request.save();

    // Notify buyer
    await Notification.create({
        recipientId: request.userId,
        recipientType: 'user',
        type: 'system',
        title: 'Product Proposal Received',
        message: `Your product request "${request.productName}" has a finalized proposal available at ₹${finalPrice}. Please confirm.`,
        data: {
            relatedId: request._id.toString(),
            onModel: 'ProductRequest'
        }
    });

    res.status(200).json(
        new ApiResponse(200, request, 'Fulfillment proposal sent to user')
    );
});

// @desc    Get a single product request by requestId (Admin detail view)
// @route   GET /api/admin/product-requests/:id
// @access  Private (Admin)
export const getProductRequestById = asyncHandler(async (req, res) => {
    const request = await ProductRequest.findOne({ requestId: req.params.id })
        .populate('userId', 'name email phone role')
        .populate({
            path: 'targetEntityId',
            select: 'storeName storeLogo rating address name logo location'
        })
        .populate('acceptedVendorId', 'name storeName email phone storeLogo')
        .populate('releasedVendors.vendorId', 'name storeName')
        .populate('vendorQuotations.vendorId', 'name storeName email phone')
        .populate('chatThreadId');

    if (!request) {
        throw new ApiError(404, 'Product request not found');
    }

    res.status(200).json(
        new ApiResponse(200, request, 'Product request fetched successfully')
    );
});

// @desc    Admin opens the 14-day vendor window for a product request
// @route   POST /api/admin/product-requests/:id/open-vendor-window
// @access  Private (Admin)
export const openVendorWindow = asyncHandler(async (req, res) => {
    const { windowDays = 14, note } = req.body;

    const request = await ProductRequest.findOne({ requestId: req.params.id });
    if (!request) {
        throw new ApiError(404, 'Product request not found');
    }

    // Validate state — only open if not already active
    if (request.windowStatus === 'OPEN' || request.windowStatus === 'VENDOR_LOCKED' || request.windowStatus === 'REOPENED') {
        throw new ApiError(400, `Vendor window is already ${request.windowStatus}.`);
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);

    request.windowStatus = 'OPEN';
    request.windowOpenedAt = now;
    request.windowExpiresAt = expiresAt;
    // Reset accepted vendor in case this is a re-open by admin
    request.acceptedVendorId = null;
    request.vendorAcceptedAt = null;
    request.vendorFulfillmentExpiresAt = null;
    request.vendorFulfillmentStatus = 'NONE';
    request.status = 'Vendor Window Open';

    request.timeline.push({
        status: 'Vendor Window Open',
        date: now,
        comment: note || `Vendor window opened by Admin. Eligible vendors can now accept this request. Window expires at ${expiresAt.toISOString()}.`
    });

    request.auditLog.push({
        action: 'VENDOR_WINDOW_OPENED',
        performedBy: req.user._id || req.user.id,
        performerType: 'Admin',
        timestamp: now,
        reason: note || `Admin opened ${windowDays}-day vendor window. Expires: ${expiresAt.toISOString()}`
    });

    await request.save();

    // Notify the requesting user
    await Notification.create({
        recipientId: request.userId,
        recipientType: 'user',
        type: 'system',
        title: 'Finding Vendor for Your Request',
        message: `We are now finding the best vendor for your product request "${request.productName}". We will notify you once a vendor accepts.`,
        data: {
            relatedId: request._id.toString(),
            onModel: 'ProductRequest'
        }
    });

    // Notify all approved vendors
    const eligibleVendors = await Vendor.find({ status: 'approved' }).select('_id');
    for (const vendor of eligibleVendors) {
        await Notification.create({
            recipientId: vendor._id,
            recipientType: 'vendor',
            type: 'system',
            title: 'New Vendor Window Available',
            message: `A new bulk product request "${request.productName}" (Qty: ${request.quantity}) is now available. Be the first to accept and lock this request!`,
            data: {
                relatedId: request._id.toString(),
                onModel: 'ProductRequest',
                requestId: request.requestId,
                windowExpiresAt: expiresAt.toISOString()
            }
        });
    }

    res.status(200).json(
        new ApiResponse(200, request, 'Vendor window opened successfully')
    );
});

// @desc    Admin closes/cancels the vendor window manually
// @route   POST /api/admin/product-requests/:id/close-vendor-window
// @access  Private (Admin)
export const closeVendorWindow = asyncHandler(async (req, res) => {
    const { reason, extendDays } = req.body;

    const request = await ProductRequest.findOne({ requestId: req.params.id });
    if (!request) {
        throw new ApiError(404, 'Product request not found');
    }

    if (extendDays && Number(extendDays) > 0) {
        // Extend the window instead of closing
        const extraMs = Number(extendDays) * 24 * 60 * 60 * 1000;
        request.windowExpiresAt = new Date(request.windowExpiresAt.getTime() + extraMs);
        const comment = `Admin extended vendor window by ${extendDays} days. New expiry: ${request.windowExpiresAt.toISOString()}`;

        request.timeline.push({ status: request.status, comment });
        request.auditLog.push({
            action: 'VENDOR_WINDOW_EXTENDED',
            performedBy: req.user._id || req.user.id,
            performerType: 'Admin',
            reason: reason || comment
        });
    } else {
        // Close the window
        request.windowStatus = 'CLOSED';
        request.status = 'Admin Review';
        const comment = reason || 'Admin manually closed the vendor window.';
        request.timeline.push({ status: 'Admin Review', comment });
        request.auditLog.push({
            action: 'VENDOR_WINDOW_CLOSED',
            performedBy: req.user._id || req.user.id,
            performerType: 'Admin',
            reason: comment
        });
    }

    await request.save();

    res.status(200).json(
        new ApiResponse(200, request, extendDays ? 'Vendor window extended' : 'Vendor window closed')
    );
});

// @desc    Admin selects a vendor quotation as the final fulfillment proposal
// @route   POST /api/admin/product-requests/:id/select-vendor-quotation
// @access  Private (Admin)
export const selectVendorQuotation = asyncHandler(async (req, res) => {
    const { quotationIndex, notes } = req.body;

    const request = await ProductRequest.findOne({ requestId: req.params.id });
    if (!request) {
        throw new ApiError(404, 'Product request not found');
    }

    if (!request.vendorQuotations || request.vendorQuotations.length === 0) {
        throw new ApiError(400, 'No vendor quotations available to select.');
    }

    const idx = Number(quotationIndex);
    if (isNaN(idx) || idx < 0 || idx >= request.vendorQuotations.length) {
        throw new ApiError(400, 'Invalid quotation index provided.');
    }

    const selectedQuote = request.vendorQuotations[idx];

    // Map vendor quotation to selectedFulfillment for compatibility with existing confirmProductRequestProposal flow
    request.selectedFulfillment = {
        pleQuantity: 0,
        vendors: [{ vendorId: selectedQuote.vendorId, quantity: request.quantity, price: selectedQuote.unitPrice }],
        finalPrice: selectedQuote.totalPrice,
        estimatedDelivery: selectedQuote.deliveryEstimate ? new Date(selectedQuote.deliveryEstimate) : undefined,
        notes: notes || selectedQuote.notes
    };

    request.status = 'Final Proposal';

    request.timeline.push({
        status: 'Final Proposal',
        comment: `Admin selected vendor quotation at ₹${selectedQuote.totalPrice}. Proposal sent to buyer for confirmation.`
    });

    request.auditLog.push({
        action: 'VENDOR_QUOTATION_SELECTED',
        performedBy: req.user._id || req.user.id,
        performerType: 'Admin',
        reason: `Admin selected quotation #${idx + 1} at ₹${selectedQuote.totalPrice} as the final proposal.`
    });

    await request.save();

    // Notify buyer
    await Notification.create({
        recipientId: request.userId,
        recipientType: 'user',
        type: 'system',
        title: 'Product Proposal Ready — Action Required',
        message: `Your product request "${request.productName}" has a final vendor proposal at ₹${selectedQuote.totalPrice}. Please review and confirm.`,
        data: {
            relatedId: request._id.toString(),
            onModel: 'ProductRequest'
        }
    });

    res.status(200).json(
        new ApiResponse(200, request, 'Vendor quotation selected as final proposal')
    );
});

