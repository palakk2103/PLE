import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import ProductEnquiry from '../../../models/ProductEnquiry.model.js';
import Product from '../../../models/Product.model.js';
import Notification from '../../../models/Notification.model.js';
import { moderateMessage, MODERATION_ACTION } from '../../../services/chatModeration.service.js';
import { assertTextLength, MAX_LONG_TEXT_LENGTH, MAX_MESSAGE_LENGTH } from '../../../utils/chatLimits.js';

// Same anti-diversion rules as chat: no phone numbers, UPI ids, emails, payment links or external contacts.
const assertNoContactDetails = (...texts) => {
    for (const text of texts) {
        if (!text) continue;
        const result = moderateMessage(String(text));
        if (result.action === MODERATION_ACTION.BLOCK) {
            throw new ApiError(422, result.userMessage || 'Message blocked: sharing contact or payment details is not allowed.');
        }
    }
};

// @desc    Create a new product enquiry
// @route   POST /api/user/enquiries
// @access  Private
export const createEnquiry = asyncHandler(async (req, res) => {
    const { productId, subject, question, priority, attachment } = req.body;

    if (!productId || !subject || !question) {
        throw new ApiError(400, 'Product ID, subject, and question are required.');
    }
    assertNoContactDetails(subject, question);
    assertTextLength(question, 'Question', MAX_LONG_TEXT_LENGTH);
    assertTextLength(subject, 'Subject', 200);

    const product = await Product.findById(productId);
    if (!product) {
        throw new ApiError(404, 'Product not found.');
    }

    const newEnquiry = await ProductEnquiry.create({
        userId: req.user.id || req.user._id,
        productId,
        vendorId: product.vendorId || null,
        subject,
        question,
        priority: priority || 'Medium',
        attachment: attachment || null,
        messages: [{ senderType: 'customer', senderId: req.user.id || req.user._id, message: question }],
    });

    // Notify the vendor or admin
    const targetUserId = product.vendorId ? product.vendorId : null;
    const notifyRole = product.vendorId ? 'vendor' : 'admin';
    
    const notificationPayload = {
        recipientType: notifyRole,
        type: 'system',
        title: 'New Product Enquiry',
        message: `A customer has enquired about your product: ${product.name}`,
        data: {
            relatedId: newEnquiry._id.toString(),
            onModel: 'ProductEnquiry'
        }
    };
    if (targetUserId) notificationPayload.recipientId = targetUserId;
    
    await Notification.create(notificationPayload);

    res.status(201).json(new ApiResponse(201, newEnquiry, 'Product enquiry submitted successfully.'));
});

// @desc    Customer follows up on their enquiry
// @route   POST /api/user/enquiries/:id/messages
// @access  Private
export const addEnquiryMessage = asyncHandler(async (req, res) => {
    const message = String(req.body?.message || '').trim();
    if (!message) throw new ApiError(400, 'Message is required.');
    assertNoContactDetails(message);
    assertTextLength(message);

    const enquiry = await ProductEnquiry.findOne({ enquiryId: req.params.id, userId: req.user.id || req.user._id });
    if (!enquiry) throw new ApiError(404, 'Enquiry not found.');
    if (enquiry.status === 'Closed') throw new ApiError(400, 'This enquiry is closed. Please submit a new enquiry.');

    enquiry.messages.push({ senderType: 'customer', senderId: req.user.id || req.user._id, message });
    enquiry.status = 'Under Review';
    enquiry.timeline.push({ status: 'Under Review', note: 'Customer sent a follow-up.' });
    await enquiry.save();

    // Tell whoever owns the product
    try {
        await Notification.create({
            ...(enquiry.vendorId ? { recipientId: enquiry.vendorId } : {}),
            recipientType: enquiry.vendorId ? 'vendor' : 'admin',
            type: 'system', title: 'Enquiry follow-up',
            message: `The customer replied on enquiry ${enquiry.enquiryId}.`,
            data: { relatedId: enquiry._id.toString(), onModel: 'ProductEnquiry' },
        });
    } catch (nErr) {
        console.warn('Enquiry follow-up notification failed:', nErr.message);
    }

    res.status(200).json(new ApiResponse(200, enquiry, 'Message sent.'));
});

// @desc    Get user's product enquiries
// @route   GET /api/user/enquiries
// @access  Private
export const getMyEnquiries = asyncHandler(async (req, res) => {
    const enquiries = await ProductEnquiry.find({ userId: req.user.id || req.user._id })
        .populate('productId', 'name image slug')
        .sort({ createdAt: -1 });

    const formattedEnquiries = enquiries.map(enq => ({
        id: enq.enquiryId,
        _id: enq._id,
        productId: enq.productId?._id,
        productName: enq.productId?.name || 'Unknown Product',
        productImage: enq.productId?.image || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=150",
        subject: enq.subject,
        question: enq.question,
        priority: enq.priority,
        attachment: enq.attachment,
        status: enq.status,
        createdAt: enq.createdAt,
        sellerResponse: enq.sellerResponse,
        messages: (enq.messages || []).map((m) => ({ senderType: m.senderType, message: m.message, createdAt: m.createdAt })),
        timeline: enq.timeline
    }));

    res.status(200).json(new ApiResponse(200, formattedEnquiries, 'User enquiries fetched successfully.'));
});
