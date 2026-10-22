import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Product from '../../../models/Product.model.js';
import ProductNegotiation from '../../../models/ProductNegotiation.model.js';
import { createNotification } from '../../../services/notification.service.js';

/**
 * Helper to project vendor-safe negotiation data.
 * STRICT PRICING CONFIDENTIALITY:
 * Strips any admin selling price, margins, or internal admin notes.
 */
const toVendorSafeNegotiation = (doc) => {
    if (!doc) return null;
    const raw = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    return {
        _id: raw._id,
        sourceProductId: raw.sourceProductId,
        shopId: raw.shopId,
        vendorUserId: raw.vendorUserId,
        initialSupplyPrice: raw.initialSupplyPrice,
        status: raw.status,
        finalAgreedPrice: raw.finalAgreedPrice,
        isLocked: raw.isLocked,
        lockedAt: raw.lockedAt,
        currentOffer: raw.currentOffer
            ? {
                  round: raw.currentOffer.round,
                  price: raw.currentOffer.price,
                  notes: raw.currentOffer.notes,
                  offeredByRole: raw.currentOffer.offeredByRole,
                  offeredByName: raw.currentOffer.offeredByName,
                  offeredAt: raw.currentOffer.offeredAt,
                  status: raw.currentOffer.status,
                  respondedAt: raw.currentOffer.respondedAt,
                  responseNotes: raw.currentOffer.responseNotes,
              }
            : null,
        offers: Array.isArray(raw.offers)
            ? raw.offers.map((o) => ({
                  _id: o._id,
                  round: o.round,
                  price: o.price,
                  notes: o.notes,
                  offeredByRole: o.offeredByRole,
                  offeredByName: o.offeredByName,
                  offeredAt: o.offeredAt,
                  status: o.status,
                  respondedAt: o.respondedAt,
                  responseNotes: o.responseNotes,
              }))
            : [],
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
    };
};

/**
 * GET /api/vendor/products/:productId/negotiation
 * Fetch negotiation history for a vendor's source product.
 */
export const getVendorNegotiation = asyncHandler(async (req, res) => {
    const { productId } = req.params;

    // Verify product ownership by managed shop
    const product = await Product.findOne({
        _id: productId,
        shopId: req.user.shopId,
    }).select('_id name shopId price requestedSupplyPrice approvalStatus');

    if (!product) {
        throw new ApiError(404, 'Product not found or access denied.');
    }

    let negotiation = await ProductNegotiation.findOne({ sourceProductId: productId });

    // Auto-create negotiation record if missing for this managed product
    if (!negotiation) {
        const initialPrice = product.requestedSupplyPrice || product.price || 1;
        const initialOffer = {
            round: 1,
            price: initialPrice,
            notes: 'Initial requested supply price',
            offeredByRole: 'managed_vendor',
            offeredById: req.user.id,
            offeredByName: req.user.name || 'Managed Vendor',
            offeredAt: new Date(),
            status: 'pending',
        };

        negotiation = await ProductNegotiation.create({
            sourceProductId: product._id,
            shopId: req.user.shopId,
            vendorUserId: req.user.id,
            initialSupplyPrice: initialPrice,
            status: 'pending_review',
            currentOffer: initialOffer,
            offers: [initialOffer],
            auditLog: [
                {
                    action: 'negotiation_initialized',
                    performedBy: req.user.id,
                    performerRole: 'managed_vendor',
                    performerName: req.user.name || 'Managed Vendor',
                    timestamp: new Date(),
                    details: { initialPrice },
                },
            ],
        });

        await Product.findByIdAndUpdate(productId, { agreementId: negotiation._id });
    }

    res.status(200).json(
        new ApiResponse(200, toVendorSafeNegotiation(negotiation), 'Negotiation fetched successfully.')
    );
});

/**
 * POST /api/vendor/products/:productId/negotiation/counter-offer
 * Managed vendor submits a counter-offer supply price.
 */
export const submitVendorCounterOffer = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { price, notes } = req.body;

    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
        throw new ApiError(400, 'Price must be a valid positive number.');
    }

    const product = await Product.findOne({
        _id: productId,
        shopId: req.user.shopId,
    });
    if (!product) {
        throw new ApiError(404, 'Product not found or access denied.');
    }

    const negotiation = await ProductNegotiation.findOne({ sourceProductId: productId });
    if (!negotiation) {
        throw new ApiError(404, 'Negotiation record not found.');
    }

    if (negotiation.isLocked) {
        throw new ApiError(400, 'Commercial agreement is locked and cannot be renegotiated directly.');
    }

    // Check that latest offer is not already pending from the vendor themselves
    if (
        negotiation.currentOffer &&
        negotiation.currentOffer.status === 'pending' &&
        negotiation.currentOffer.offeredByRole === 'managed_vendor'
    ) {
        throw new ApiError(400, 'Your previous offer is still awaiting Admin review. You cannot counter your own pending offer.');
    }

    // Mark previous pending admin offer as superseded
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
        offeredByRole: 'managed_vendor',
        offeredById: req.user.id,
        offeredByName: req.user.name || 'Managed Vendor',
        offeredAt: new Date(),
        status: 'pending',
    };

    negotiation.currentOffer = newOffer;
    negotiation.offers.push(newOffer);
    negotiation.status = 'in_negotiation';
    negotiation.auditLog.push({
        action: 'counter_offer_submitted',
        performedBy: req.user.id,
        performerRole: 'managed_vendor',
        performerName: req.user.name || 'Managed Vendor',
        timestamp: new Date(),
        details: { round: nextRound, price: numericPrice, notes },
    });

    await negotiation.save();

    // Notify admins
    await createNotification({
        recipientType: 'admin',
        title: 'Vendor Counter-Offer Received',
        message: `Vendor submitted a counter-offer of ₹${numericPrice} for product "${product.name}".`,
        type: 'commercial_negotiation',
        data: { productId: product._id, negotiationId: negotiation._id, price: numericPrice },
    }).catch((err) => console.error('Notification error:', err.message));

    res.status(200).json(
        new ApiResponse(200, toVendorSafeNegotiation(negotiation), 'Counter-offer submitted successfully.')
    );
});

/**
 * POST /api/vendor/products/:productId/negotiation/accept
 * Managed vendor accepts the latest Admin offer.
 */
export const acceptAdminOffer = asyncHandler(async (req, res) => {
    const { productId } = req.params;

    const product = await Product.findOne({
        _id: productId,
        shopId: req.user.shopId,
    });
    if (!product) {
        throw new ApiError(404, 'Product not found or access denied.');
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
        negotiation.currentOffer.offeredByRole !== 'admin'
    ) {
        throw new ApiError(400, 'No active pending Admin offer available to accept.');
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
    negotiation.lockedByVendor = req.user.id;
    negotiation.status = 'agreed_locked';
    negotiation.auditLog.push({
        action: 'offer_accepted_by_vendor',
        performedBy: req.user.id,
        performerRole: 'managed_vendor',
        performerName: req.user.name || 'Managed Vendor',
        timestamp: now,
        details: { agreedPrice, round: negotiation.currentOffer.round },
    });

    await negotiation.save();

    // Update source product record with agreed supply price
    await Product.findByIdAndUpdate(productId, {
        price: agreedPrice,
        negotiatedSupplyPrice: agreedPrice,
    });

    // Notify admins
    await createNotification({
        recipientType: 'admin',
        title: 'Vendor Accepted Supply Price! 🎉',
        message: `Vendor accepted the offer of ₹${agreedPrice} for "${product.name}". Price is now locked and ready for listing creation.`,
        type: 'commercial_negotiation',
        data: { productId: product._id, negotiationId: negotiation._id, agreedPrice },
    }).catch((err) => console.error('Notification error:', err.message));

    res.status(200).json(
        new ApiResponse(200, toVendorSafeNegotiation(negotiation), 'Offer accepted and price locked successfully.')
    );
});

/**
 * POST /api/vendor/products/:productId/negotiation/reject
 * Managed vendor rejects the latest Admin offer.
 */
export const rejectAdminOffer = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { notes } = req.body;

    const product = await Product.findOne({
        _id: productId,
        shopId: req.user.shopId,
    });
    if (!product) {
        throw new ApiError(404, 'Product not found or access denied.');
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
        negotiation.currentOffer.offeredByRole !== 'admin'
    ) {
        throw new ApiError(400, 'No active pending Admin offer available to reject.');
    }

    const now = new Date();
    negotiation.currentOffer.status = 'rejected';
    negotiation.currentOffer.respondedAt = now;
    negotiation.currentOffer.respondedById = req.user.id;
    negotiation.currentOffer.responseNotes = String(notes || '').trim();

    const lastIdx = negotiation.offers.length - 1;
    if (lastIdx >= 0) {
        negotiation.offers[lastIdx].status = 'rejected';
        negotiation.offers[lastIdx].respondedAt = now;
        negotiation.offers[lastIdx].respondedById = req.user.id;
        negotiation.offers[lastIdx].responseNotes = String(notes || '').trim();
    }

    negotiation.status = 'in_negotiation';
    negotiation.auditLog.push({
        action: 'offer_rejected_by_vendor',
        performedBy: req.user.id,
        performerRole: 'managed_vendor',
        performerName: req.user.name || 'Managed Vendor',
        timestamp: now,
        details: { notes, round: negotiation.currentOffer.round },
    });

    await negotiation.save();

    res.status(200).json(
        new ApiResponse(200, toVendorSafeNegotiation(negotiation), 'Offer rejected.')
    );
});
