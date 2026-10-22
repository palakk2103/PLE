import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Product from '../../../models/Product.model.js';
import ProductNegotiation from '../../../models/ProductNegotiation.model.js';
import { slugify } from '../../../utils/slugify.js';
import { createNotification } from '../../../services/notification.service.js';

/**
 * GET /api/admin/products/:productId/negotiation
 * Fetch negotiation history, source product details, and existing Admin listing.
 */
export const getAdminNegotiation = asyncHandler(async (req, res) => {
    const { productId } = req.params;

    const sourceProduct = await Product.findById(productId)
        .populate('shopId', 'name address phone gst')
        .populate('vendorUserId', 'name username phone')
        .populate('categoryId', 'name')
        .populate('brandId', 'name');

    if (!sourceProduct) {
        throw new ApiError(404, 'Source product not found.');
    }

    let negotiation = await ProductNegotiation.findOne({ sourceProductId: productId })
        .populate('listingId', 'name price originalPrice publicationStatus isActive images stockQuantity slug');

    // Auto-create negotiation if missing
    if (!negotiation && (sourceProduct.shopId || sourceProduct.listingType === 'managed_source')) {
        const initialPrice = sourceProduct.requestedSupplyPrice || sourceProduct.price || 1;
        const initialOffer = {
            round: 1,
            price: initialPrice,
            notes: 'Initial requested supply price',
            offeredByRole: 'managed_vendor',
            offeredById: sourceProduct.vendorUserId?._id || sourceProduct.createdBy || req.user.id,
            offeredByName: sourceProduct.vendorUserId?.name || 'Managed Vendor',
            offeredAt: sourceProduct.createdAt || new Date(),
            status: 'pending',
        };

        negotiation = await ProductNegotiation.create({
            sourceProductId: sourceProduct._id,
            shopId: sourceProduct.shopId?._id || sourceProduct.shopId,
            vendorUserId: sourceProduct.vendorUserId?._id || sourceProduct.createdBy || req.user.id,
            initialSupplyPrice: initialPrice,
            status: 'pending_review',
            currentOffer: initialOffer,
            offers: [initialOffer],
            auditLog: [
                {
                    action: 'negotiation_initialized',
                    performedBy: req.user.id,
                    performerRole: 'admin',
                    performerName: req.user.name || 'Admin',
                    timestamp: new Date(),
                    details: { initialPrice },
                },
            ],
        });

        await Product.findByIdAndUpdate(productId, { agreementId: negotiation._id });
    }

    res.status(200).json(
        new ApiResponse(200, {
            negotiation,
            sourceProduct,
            listing: negotiation?.listingId || null,
        }, 'Admin negotiation fetched successfully.')
    );
});

/**
 * POST /api/admin/products/:productId/negotiation/offer
 * Admin submits an offer / counter-offer supply price.
 */
export const submitAdminOffer = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { price, notes } = req.body;

    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
        throw new ApiError(400, 'Supply offer price must be a valid positive number.');
    }

    const sourceProduct = await Product.findById(productId);
    if (!sourceProduct) {
        throw new ApiError(404, 'Source product not found.');
    }

    const negotiation = await ProductNegotiation.findOne({ sourceProductId: productId });
    if (!negotiation) {
        throw new ApiError(404, 'Negotiation record not found.');
    }

    if (negotiation.isLocked) {
        throw new ApiError(400, 'Price agreement is already locked. New negotiation requires an authorized revision.');
    }

    // Check if current offer is already pending from Admin
    if (
        negotiation.currentOffer &&
        negotiation.currentOffer.status === 'pending' &&
        negotiation.currentOffer.offeredByRole === 'admin'
    ) {
        throw new ApiError(400, 'An Admin offer is already pending vendor response.');
    }

    // Mark previous pending vendor offer as superseded
    if (negotiation.currentOffer && negotiation.currentOffer.status === 'pending') {
        negotiation.currentOffer.status = 'superseded';
        const lastIdx = negotiation.offers.length - 1;
        if (lastIdx >= 0) {
            negotiation.offers[lastIdx].status = 'superseded';
        }
    }

    const nextRound = (negotiation.currentOffer?.round || 0) + 1;
    const newOffer = {
        round: nextRound,
        price: numericPrice,
        notes: String(notes || '').trim(),
        offeredByRole: 'admin',
        offeredById: req.user.id,
        offeredByName: req.user.name || 'Admin Reviewer',
        offeredAt: new Date(),
        status: 'pending',
    };

    negotiation.currentOffer = newOffer;
    negotiation.offers.push(newOffer);
    negotiation.status = 'in_negotiation';
    negotiation.auditLog.push({
        action: 'admin_offer_submitted',
        performedBy: req.user.id,
        performerRole: 'admin',
        performerName: req.user.name || 'Admin Reviewer',
        timestamp: new Date(),
        details: { round: nextRound, price: numericPrice, notes },
    });

    await negotiation.save();

    // Notify vendor
    if (negotiation.vendorUserId) {
        await createNotification({
            recipientId: negotiation.vendorUserId,
            recipientType: 'vendor',
            title: 'New Price Offer from Admin',
            message: `Admin offered ₹${numericPrice} for your product "${sourceProduct.name}". Please review and respond.`,
            type: 'commercial_negotiation',
            data: { productId: sourceProduct._id, negotiationId: negotiation._id, price: numericPrice },
        }).catch((err) => console.error('Notification error:', err.message));
    }

    res.status(200).json(
        new ApiResponse(200, negotiation, 'Admin offer submitted successfully.')
    );
});

/**
 * POST /api/admin/products/:productId/negotiation/accept
 * Admin accepts the latest Vendor offer and locks the supply price.
 */
export const acceptVendorOffer = asyncHandler(async (req, res) => {
    const { productId } = req.params;

    const sourceProduct = await Product.findById(productId);
    if (!sourceProduct) {
        throw new ApiError(404, 'Source product not found.');
    }

    const negotiation = await ProductNegotiation.findOne({ sourceProductId: productId });
    if (!negotiation) {
        throw new ApiError(404, 'Negotiation record not found.');
    }

    if (negotiation.isLocked) {
        throw new ApiError(400, 'Price agreement is already locked.');
    }

    if (
        !negotiation.currentOffer ||
        negotiation.currentOffer.status !== 'pending' ||
        negotiation.currentOffer.offeredByRole !== 'managed_vendor'
    ) {
        throw new ApiError(400, 'No active pending vendor offer available to accept.');
    }

    const agreedPrice = negotiation.currentOffer.price;
    const now = new Date();

    // Mark current offer as accepted
    negotiation.currentOffer.status = 'accepted';
    negotiation.currentOffer.respondedAt = now;
    negotiation.currentOffer.respondedById = req.user.id;

    const lastIdx = negotiation.offers.length - 1;
    if (lastIdx >= 0) {
        negotiation.offers[lastIdx].status = 'accepted';
        negotiation.offers[lastIdx].respondedAt = now;
        negotiation.offers[lastIdx].respondedById = req.user.id;
    }

    // Atomic price lock
    negotiation.finalAgreedPrice = agreedPrice;
    negotiation.isLocked = true;
    negotiation.lockedAt = now;
    negotiation.lockedByAdmin = req.user.id;
    negotiation.status = 'agreed_locked';
    negotiation.auditLog.push({
        action: 'vendor_offer_accepted_by_admin',
        performedBy: req.user.id,
        performerRole: 'admin',
        performerName: req.user.name || 'Admin Reviewer',
        timestamp: now,
        details: { agreedPrice, round: negotiation.currentOffer.round },
    });

    await negotiation.save();

    // Update source product record with agreed supply price
    await Product.findByIdAndUpdate(productId, {
        price: agreedPrice,
        negotiatedSupplyPrice: agreedPrice,
        approvalStatus: 'approved',
    });

    // Notify vendor
    if (negotiation.vendorUserId) {
        await createNotification({
            recipientId: negotiation.vendorUserId,
            recipientType: 'vendor',
            title: 'Supply Price Accepted by Admin! 🎉',
            message: `Admin accepted your supply price of ₹${agreedPrice} for "${sourceProduct.name}". The agreement is locked.`,
            type: 'commercial_negotiation',
            data: { productId: sourceProduct._id, negotiationId: negotiation._id, agreedPrice },
        }).catch((err) => console.error('Notification error:', err.message));
    }

    res.status(200).json(
        new ApiResponse(200, negotiation, 'Vendor offer accepted and price agreement locked successfully.')
    );
});

/**
 * POST /api/admin/products/:productId/negotiation/reject
 * Admin rejects the commercial negotiation.
 */
export const rejectAdminNegotiation = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { reason } = req.body;

    const sourceProduct = await Product.findById(productId);
    if (!sourceProduct) {
        throw new ApiError(404, 'Source product not found.');
    }

    const negotiation = await ProductNegotiation.findOne({ sourceProductId: productId });
    if (!negotiation) {
        throw new ApiError(404, 'Negotiation record not found.');
    }

    if (negotiation.isLocked) {
        throw new ApiError(400, 'Cannot reject a locked commercial agreement directly.');
    }

    const rejectionReason = String(reason || 'Price negotiation terms rejected.').trim();
    negotiation.status = 'rejected';
    if (negotiation.currentOffer) {
        negotiation.currentOffer.status = 'rejected';
        negotiation.currentOffer.responseNotes = rejectionReason;
    }

    negotiation.auditLog.push({
        action: 'negotiation_rejected_by_admin',
        performedBy: req.user.id,
        performerRole: 'admin',
        performerName: req.user.name || 'Admin',
        timestamp: new Date(),
        details: { reason: rejectionReason },
    });

    await negotiation.save();

    // Update source product approvalStatus
    await Product.findByIdAndUpdate(productId, {
        approvalStatus: 'rejected',
        rejectionReason,
        isActive: false,
    });

    // Notify vendor
    if (negotiation.vendorUserId) {
        await createNotification({
            recipientId: negotiation.vendorUserId,
            recipientType: 'vendor',
            title: 'Product Submission Rejected',
            message: `Price negotiation for "${sourceProduct.name}" was rejected. Reason: ${rejectionReason}`,
            type: 'commercial_negotiation',
            data: { productId: sourceProduct._id, negotiationId: negotiation._id, reason: rejectionReason },
        }).catch((err) => console.error('Notification error:', err.message));
    }

    res.status(200).json(
        new ApiResponse(200, negotiation, 'Negotiation rejected successfully.')
    );
});

/**
 * POST /api/admin/products/:productId/customer-listing
 * Admin creates an independent, customer-facing listing from an agreed & locked source product.
 */
export const createAdminCustomerListing = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const {
        name,
        description,
        price,
        originalPrice,
        images,
        image,
        categoryId,
        brandId,
        salesChannel = 'B2C',
        seoTitle,
        seoDescription,
        publicationStatus = 'published',
        stockQuantity,
    } = req.body;

    const retailPrice = Number(price);
    if (!Number.isFinite(retailPrice) || retailPrice <= 0) {
        throw new ApiError(400, 'Retail selling price must be a valid positive number.');
    }

    const sourceProduct = await Product.findById(productId);
    if (!sourceProduct) {
        throw new ApiError(404, 'Source product not found.');
    }

    const negotiation = await ProductNegotiation.findOne({ sourceProductId: productId });
    if (!negotiation || !negotiation.isLocked || !negotiation.finalAgreedPrice) {
        throw new ApiError(400, 'Cannot create customer listing before supply price agreement is finalized and locked.');
    }

    // Check if listing already exists
    if (negotiation.listingId) {
        const existingListing = await Product.findById(negotiation.listingId);
        if (existingListing) {
            throw new ApiError(400, 'An Admin-owned customer listing already exists for this agreed product.');
        }
    }

    const listingTitle = String(name || sourceProduct.name).trim();
    const finalImages = Array.isArray(images) && images.length ? images : (sourceProduct.images || []);
    const primaryImage = image || finalImages[0] || sourceProduct.image;
    const finalStockQty = stockQuantity !== undefined ? Number(stockQuantity) : sourceProduct.stockQuantity;
    const isLive = publicationStatus === 'published';

    // Base slug with collision check
    let slug = slugify(listingTitle);
    const existingSlug = await Product.findOne({ slug });
    if (existingSlug) {
        slug = `${slug}-${Date.now()}`;
    }

    const customerListing = await Product.create({
        name: listingTitle,
        slug,
        description: description !== undefined ? description : sourceProduct.description,
        price: retailPrice,
        originalPrice: originalPrice !== undefined ? Number(originalPrice) : (sourceProduct.originalPrice || retailPrice),
        unit: sourceProduct.unit || 'Piece',
        images: finalImages,
        image: primaryImage,
        categoryId: categoryId || sourceProduct.categoryId,
        brandId: brandId || sourceProduct.brandId,
        shopId: sourceProduct.shopId, // Reference shop for warehouse/fulfillment
        vendorId: undefined, // Admin-owned, NOT third-party vendor
        vendorUserId: undefined,
        stockQuantity: finalStockQty,
        stock: finalStockQty > 0 ? 'in_stock' : 'out_of_stock',
        lowStockThreshold: sourceProduct.lowStockThreshold || 10,
        variants: sourceProduct.variants,
        salesChannel,
        seoTitle: seoTitle || listingTitle,
        seoDescription: seoDescription || (description ? description.slice(0, 160) : ''),
        taxRate: sourceProduct.taxRate || 18,
        gstMode: sourceProduct.gstMode || 'category',
        gstRate: sourceProduct.gstRate || 18,
        taxIncluded: !!sourceProduct.taxIncluded,
        codAllowed: sourceProduct.codAllowed !== false,
        returnable: sourceProduct.returnable !== false,
        cancelable: sourceProduct.cancelable !== false,

        // Commercial Separation Flags
        listingType: 'admin_managed_listing',
        isSourceProduct: false,
        sourceProductId: sourceProduct._id,
        agreementId: negotiation._id,
        negotiatedSupplyPrice: negotiation.finalAgreedPrice,
        publicationStatus,
        approvalStatus: 'approved',
        isActive: isLive,
        isVisible: isLive,
        createdBy: req.user.id,
        approvedBy: req.user.id,
        auditLog: [
            {
                action: 'created_admin_listing',
                userId: req.user.id,
                userType: 'admin',
                timestamp: new Date(),
                reason: `Customer listing created from agreed source product. Selling price: ₹${retailPrice}, Supply price: ₹${negotiation.finalAgreedPrice}`,
            },
        ],
    });

    // Link listing to negotiation
    negotiation.listingId = customerListing._id;
    negotiation.auditLog.push({
        action: 'customer_listing_created',
        performedBy: req.user.id,
        performerRole: 'admin',
        performerName: req.user.name || 'Admin',
        timestamp: new Date(),
        details: { listingId: customerListing._id, retailPrice, publicationStatus },
    });
    await negotiation.save();

    // Source product remains safe and isolated
    await Product.findByIdAndUpdate(productId, {
        approvalStatus: 'approved',
        isActive: false, // Source product itself is NOT public
    });

    const marginAmount = parseFloat((retailPrice - negotiation.finalAgreedPrice).toFixed(2));
    const marginPercent = parseFloat(((marginAmount / retailPrice) * 100).toFixed(2));

    res.status(201).json(
        new ApiResponse(
            201,
            {
                listing: customerListing,
                commercials: {
                    supplyPrice: negotiation.finalAgreedPrice,
                    sellingPrice: retailPrice,
                    marginAmount,
                    marginPercent,
                },
            },
            'Customer listing created successfully.'
        )
    );
});

/**
 * PUT /api/admin/customer-listings/:listingId
 * Admin updates customer-facing listing (price, details, publication status).
 */
export const updateAdminCustomerListing = asyncHandler(async (req, res) => {
    const { listingId } = req.params;
    const {
        name,
        description,
        price,
        originalPrice,
        images,
        image,
        categoryId,
        brandId,
        salesChannel,
        seoTitle,
        seoDescription,
        publicationStatus,
        stockQuantity,
    } = req.body;

    const listing = await Product.findOne({
        _id: listingId,
        listingType: 'admin_managed_listing',
    });

    if (!listing) {
        throw new ApiError(404, 'Admin-owned customer listing not found.');
    }

    if (name !== undefined) listing.name = String(name).trim();
    if (description !== undefined) listing.description = description;
    if (price !== undefined) {
        const numPrice = Number(price);
        if (!Number.isFinite(numPrice) || numPrice <= 0) {
            throw new ApiError(400, 'Price must be a valid positive number.');
        }
        listing.price = numPrice;
    }
    if (originalPrice !== undefined) listing.originalPrice = Number(originalPrice);
    if (images !== undefined) listing.images = images;
    if (image !== undefined) listing.image = image;
    if (categoryId !== undefined) listing.categoryId = categoryId;
    if (brandId !== undefined) listing.brandId = brandId;
    if (salesChannel !== undefined) listing.salesChannel = salesChannel;
    if (seoTitle !== undefined) listing.seoTitle = seoTitle;
    if (seoDescription !== undefined) listing.seoDescription = seoDescription;
    if (stockQuantity !== undefined) {
        listing.stockQuantity = Number(stockQuantity);
        listing.stock = listing.stockQuantity > 0 ? 'in_stock' : 'out_of_stock';
    }

    if (publicationStatus !== undefined) {
        if (!['draft', 'pending_approval', 'published', 'unpublished', 'archived'].includes(publicationStatus)) {
            throw new ApiError(400, 'Invalid publication status.');
        }
        listing.publicationStatus = publicationStatus;
        const isLive = publicationStatus === 'published';
        listing.isActive = isLive;
        listing.isVisible = isLive;
    }

    listing.auditLog.push({
        action: 'updated_admin_listing',
        userId: req.user.id,
        userType: 'admin',
        timestamp: new Date(),
        reason: 'Admin updated customer listing details.',
    });

    await listing.save();

    const supplyPrice = listing.negotiatedSupplyPrice || 0;
    const marginAmount = parseFloat((listing.price - supplyPrice).toFixed(2));
    const marginPercent = listing.price > 0 ? parseFloat(((marginAmount / listing.price) * 100).toFixed(2)) : 0;

    res.status(200).json(
        new ApiResponse(
            200,
            {
                listing,
                commercials: {
                    supplyPrice,
                    sellingPrice: listing.price,
                    marginAmount,
                    marginPercent,
                },
            },
            'Customer listing updated successfully.'
        )
    );
});
