import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import ProductEnquiry from '../../../models/ProductEnquiry.model.js';
import Notification from '../../../models/Notification.model.js';
import { moderateMessage, MODERATION_ACTION } from '../../../services/chatModeration.service.js';
import { assertTextLength } from '../../../utils/chatLimits.js';

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

// @desc    Get all product enquiries (or Admin's specific enquiries)
// @route   GET /api/admin/enquiries
// @access  Private (Admin)
export const getAdminEnquiries = asyncHandler(async (req, res) => {
    // Admin can see all enquiries. If we only want admin to see enquiries for products they own,
    // we would filter by { vendorId: null }. Here we fetch all but mark which ones belong to admin.
    const enquiries = await ProductEnquiry.find({})
        .populate('userId', 'name email role')
        .populate('productId', 'name image slug vendorId')
        .sort({ createdAt: -1 });

    const formattedEnquiries = enquiries.map(enq => ({
        id: enq.enquiryId,
        _id: enq._id,
        productId: enq.productId?._id,
        productName: enq.productId?.name,
        productImage: enq.productId?.image || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=150",
        isAdminProduct: !enq.vendorId, // True if vendorId is null
        subject: enq.subject,
        question: enq.question,
        priority: enq.priority,
        attachment: enq.attachment,
        userId: enq.userId?._id,
        userName: enq.userId?.name || 'Customer',
        userEmail: enq.userId?.email || 'N/A',
        status: enq.status,
        createdAt: enq.createdAt,
        sellerResponse: enq.sellerResponse,
        timeline: enq.timeline
    }));

    res.status(200).json(new ApiResponse(200, formattedEnquiries, 'Admin enquiries fetched successfully.'));
});

// @desc    Reply to a product enquiry
// @route   PUT /api/admin/enquiries/:id/reply
// @access  Private (Admin)
export const replyToEnquiry = asyncHandler(async (req, res) => {
    const { status, responseText } = req.body;
    
    if (!status && !responseText) {
        throw new ApiError(400, 'Please provide status or response text.');
    }
    assertNoContactDetails(responseText);
    assertTextLength(responseText);

    const enquiry = await ProductEnquiry.findOne({ enquiryId: req.params.id });
    if (!enquiry) {
        throw new ApiError(404, 'Enquiry not found.');
    }

    if (status) enquiry.status = status;
    if (responseText) {
        enquiry.sellerResponse = responseText; // latest seller answer (kept for existing screens)
        enquiry.messages.push({ senderType: 'admin', senderId: req.user.id || req.user._id, message: responseText });
    }

    const note = responseText 
        ? `Admin responded: "${responseText.substring(0, 40)}${responseText.length > 40 ? '...' : ''}"`
        : `Enquiry status updated to ${status}.`;

    enquiry.timeline.push({
        status: status || enquiry.status,
        note
    });

    await enquiry.save();

    // Notify user
    await Notification.create({
        recipientId: enquiry.userId,
        recipientType: 'user',
        type: 'system', 
        title: 'Product Enquiry Update',
        message: `Admin has replied to your enquiry regarding ${enquiry.subject}.`,
        data: {
            relatedId: enquiry._id.toString(),
            onModel: 'ProductEnquiry'
        }
    });

    res.status(200).json(new ApiResponse(200, enquiry, 'Enquiry updated successfully.'));
});
