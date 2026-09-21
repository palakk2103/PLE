import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import RFQ from '../../../models/RFQ.model.js';
import Product from '../../../models/Product.model.js';
import User from '../../../models/User.model.js';
import Vendor from '../../../models/Vendor.model.js';
import Order from '../../../models/Order.model.js';
import Address from '../../../models/Address.model.js';
import Commission from '../../../models/Commission.model.js';
import { generateOrderId } from '../../../utils/generateOrderId.js';
import { generateTrackingNumber } from '../../../utils/generateTrackingNumber.js';
import { createNotification } from '../../../services/notification.service.js';
import { generateInvoiceForOrder } from '../../../services/invoice.service.js';
import mongoose from 'mongoose';

import {
    uploadLocalFileToCloudinaryAndCleanup,
    cleanupLocalFiles
} from '../../../services/upload.service.js';

// Generate a random RFQ ID
const generateRfqId = () => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    return `RFQ-${dateStr}-${randomDigits}`;
};

// POST /api/user/rfq/upload
export const uploadAttachment = asyncHandler(async (req, res) => {
    if (!req.file?.path) {
        throw new ApiError(400, 'Document file is required.');
    }

    let uploaded = null;
    try {
        uploaded = await uploadLocalFileToCloudinaryAndCleanup(
            req.file.path,
            'rfq/attachments'
        );
        res.status(200).json(
            new ApiResponse(200, { url: uploaded.url }, 'Attachment uploaded successfully.')
        );
    } catch (error) {
        await cleanupLocalFiles([req.file?.path]).catch(() => null);
        throw error;
    }
});

// POST /api/user/rfq
export const createRFQ = asyncHandler(async (req, res) => {
    const { productId, customProductName, quantity, targetPrice, requirementDetails, expectedDeliveryDate, attachment } = req.body;

    let sellerId = undefined;
    let productName = customProductName || 'Custom Product';

    if (productId) {
        const product = await Product.findById(productId);
        if (!product) {
            throw new ApiError(404, 'Product not found.');
        }
        sellerId = product.vendorId;
        productName = product.name;
    }

    const rfq = await RFQ.create({
        rfqId: generateRfqId(),
        buyerId: req.user.id,
        sellerId,
        productId: productId || undefined,
        customProductName: productId ? undefined : productName,
        quantity,
        targetPrice,
        requirementDetails,
        expectedDeliveryDate,
        attachment,
        status: 'Pending',
        timeline: [{
            senderType: 'buyer',
            senderId: req.user.id,
            price: targetPrice,
            quantity,
            notes: requirementDetails || 'Initial RFQ submitted.'
        }]
    });

    // Notify Vendor if assigned
    if (sellerId) {
        await createNotification({
            recipientId: sellerId,
            recipientType: 'vendor',
            title: 'New RFQ Received',
            message: `You have received a new bulk order RFQ for ${productName}.`,
            type: 'system',
            data: {
                rfqId: rfq.rfqId,
                id: String(rfq._id)
            }
        });
    }

    res.status(201).json(new ApiResponse(201, rfq, 'RFQ submitted successfully.'));
});

// GET /api/user/rfq
export const getBuyerRFQs = asyncHandler(async (req, res) => {
    const rfqs = await RFQ.find({ buyerId: req.user.id })
        .populate('productId', 'name image price')
        .populate('sellerId', 'storeName name')
        .sort({ createdAt: -1 });

    res.status(200).json(new ApiResponse(200, rfqs, 'RFQs fetched successfully.'));
});

// GET /api/user/rfq/:id
export const getRFQDetail = asyncHandler(async (req, res) => {
    const rfq = await RFQ.findOne({ _id: req.params.id, buyerId: req.user.id })
        .populate('productId', 'name image price unit stockQuantity')
        .populate('sellerId', 'storeName name email')
        .populate('buyerId', 'name companyName email phone');

    if (!rfq) {
        throw new ApiError(404, 'RFQ not found.');
    }

    res.status(200).json(new ApiResponse(200, rfq, 'RFQ details fetched successfully.'));
});

// POST /api/user/rfq/:id/counter
export const buyerCounterOffer = asyncHandler(async (req, res) => {
    const { price, quantity, notes } = req.body;
    const rfq = await RFQ.findOne({ _id: req.params.id, buyerId: req.user.id });

    if (!rfq) {
        throw new ApiError(404, 'RFQ not found.');
    }

    if (['Accepted', 'Rejected', 'Converted To Order'].includes(rfq.status)) {
        throw new ApiError(400, 'Cannot counter offer on an completed RFQ.');
    }

    rfq.status = 'Negotiating';
    rfq.timeline.push({
        senderType: 'buyer',
        senderId: req.user.id,
        price,
        quantity,
        notes
    });

    await rfq.save();

    // Notify Seller
    await createNotification({
        recipientId: rfq.sellerId,
        recipientType: 'vendor',
        title: 'New Counter Offer Received',
        message: `Buyer submitted a counter offer of Rs. ${price} for RFQ ${rfq.rfqId}.`,
        type: 'system',
        data: {
            rfqId: rfq.rfqId,
            id: String(rfq._id)
        }
    });

    res.status(200).json(new ApiResponse(200, rfq, 'Counter offer submitted successfully.'));
});

// POST /api/user/rfq/:id/accept
export const buyerAcceptQuote = asyncHandler(async (req, res) => {
    const rfq = await RFQ.findOne({ _id: req.params.id, buyerId: req.user.id })
        .populate('productId')
        .populate('sellerId');

    if (!rfq) {
        throw new ApiError(404, 'RFQ not found.');
    }

    if (rfq.status === 'Converted To Order') {
        throw new ApiError(400, 'This RFQ has already been converted to an order.');
    }

    // Get latest seller quote from timeline
    const latestSellerOffer = [...rfq.timeline]
        .reverse()
        .find(t => t.senderType === 'seller');

    if (!latestSellerOffer) {
        throw new ApiError(400, 'No active quote from seller to accept.');
    }

    const negotiatedPrice = latestSellerOffer.price;
    const negotiatedQty = latestSellerOffer.quantity;

    // Verify stock
    if (rfq.productId.stockQuantity < negotiatedQty) {
        throw new ApiError(400, `Insufficient stock in inventory. Only ${rfq.productId.stockQuantity} units available.`);
    }

    // Get shipping address
    let shippingAddress = await Address.findOne({ userId: req.user.id, isDefault: true }).lean();
    if (!shippingAddress) {
        shippingAddress = {
            name: req.user.name,
            email: req.user.email,
            phone: req.user.phone || '9876543210',
            address: req.user.businessAddress || 'Default Business Address',
            city: req.user.city || 'Mumbai',
            state: req.user.state || 'Maharashtra',
            zipCode: req.user.pincode || '400001',
            country: 'India'
        };
    }

    const subtotal = negotiatedPrice * negotiatedQty;
    const tax = parseFloat((subtotal * 0.18).toFixed(2));
    const total = parseFloat((subtotal + tax).toFixed(2));

    const orderItem = {
        productId: rfq.productId._id,
        vendorId: rfq.sellerId._id,
        name: rfq.productId.name,
        image: rfq.productId.image,
        price: negotiatedPrice,
        quantity: negotiatedQty,
        variant: {}
    };

    const session = await mongoose.startSession();
    let order = null;
    try {
        await session.withTransaction(async () => {
            order = await Order.create([{
                orderId: generateOrderId(),
                userId: req.user.id,
                items: [orderItem],
                vendorItems: [{
                    vendorId: rfq.sellerId._id,
                    vendorName: rfq.sellerId.storeName || rfq.sellerId.name,
                    items: [orderItem],
                    subtotal,
                    shipping: 0,
                    tax,
                    discount: 0,
                    status: 'pending'
                }],
                shippingAddress,
                paymentMethod: 'cod',
                paymentStatus: 'pending',
                status: 'pending',
                subtotal,
                shipping: 0,
                tax,
                discount: 0,
                total,
                trackingNumber: generateTrackingNumber(),
                estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                orderType: 'rfq',
                rfqId: rfq._id
            }], { session });

            // Deduct stock
            await Product.findByIdAndUpdate(rfq.productId._id, {
                $inc: { stockQuantity: -negotiatedQty }
            }, { session });

            // Record Commission
            const commissionRate = rfq.sellerId.commissionRate || 10;
            const commissionVal = parseFloat(((subtotal * commissionRate) / 100).toFixed(2));
            await Commission.create([{
                orderId: order[0]._id,
                vendorId: rfq.sellerId._id,
                vendorName: rfq.sellerId.storeName || rfq.sellerId.name,
                subtotal,
                commissionRate,
                commission: commissionVal,
                vendorEarnings: parseFloat((subtotal - commissionVal).toFixed(2))
            }], { session });
        });
    } finally {
        await session.endSession();
    }

    // Update RFQ Status
    rfq.status = 'Converted To Order';
    rfq.timeline.push({
        senderType: 'buyer',
        senderId: req.user.id,
        price: negotiatedPrice,
        quantity: negotiatedQty,
        notes: `Accepted offer. Generated Order ${order[0].orderId}`
    });
    await rfq.save();

    // Send Notifications
    await createNotification({
        recipientId: req.user.id,
        recipientType: 'user',
        title: 'RFQ Converted To Order',
        message: `Your RFQ ${rfq.rfqId} has been successfully accepted and converted to Order ${order[0].orderId}.`,
        type: 'system',
        data: {
            rfqId: rfq.rfqId,
            orderId: order[0].orderId
        }
    });

    await createNotification({
        recipientId: rfq.sellerId._id,
        recipientType: 'vendor',
        title: 'RFQ Accepted & Ordered',
        message: `Buyer accepted your quote for RFQ ${rfq.rfqId}. Order ${order[0].orderId} has been generated.`,
        type: 'system',
        data: {
            rfqId: rfq.rfqId,
            orderId: order[0].orderId
        }
    });

    // Generate invoice idempotently
    try {
        await generateInvoiceForOrder(order[0]._id);
    } catch (invErr) {
        console.error("Automatic invoice generation error on RFQ order:", invErr?.message);
    }

    res.status(200).json(new ApiResponse(200, { rfq, order: order[0] }, 'RFQ accepted and converted to order successfully.'));
});

// POST /api/user/rfq/:id/reject
export const buyerRejectQuote = asyncHandler(async (req, res) => {
    const rfq = await RFQ.findOne({ _id: req.params.id, buyerId: req.user.id });

    if (!rfq) {
        throw new ApiError(404, 'RFQ not found.');
    }

    if (['Accepted', 'Rejected', 'Converted To Order'].includes(rfq.status)) {
        throw new ApiError(400, 'Cannot reject completed RFQ.');
    }

    rfq.status = 'Rejected';
    rfq.timeline.push({
        senderType: 'buyer',
        senderId: req.user.id,
        notes: req.body.notes || 'Buyer rejected the quote.'
    });

    await rfq.save();

    // Notify Vendor
    await createNotification({
        recipientId: rfq.sellerId,
        recipientType: 'vendor',
        title: 'RFQ Rejected',
        message: `RFQ ${rfq.rfqId} was rejected by the buyer.`,
        type: 'system',
        data: {
            rfqId: rfq.rfqId,
            id: String(rfq._id)
        }
    });

    res.status(200).json(new ApiResponse(200, rfq, 'RFQ rejected successfully.'));
});
