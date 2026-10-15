import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import RFQ from '../../../models/RFQ.model.js';
import Vendor from '../../../models/Vendor.model.js';
import { createNotification } from '../../../services/notification.service.js';
import {
    uploadLocalFileToCloudinaryAndCleanup,
    cleanupLocalFiles
} from '../../../services/upload.service.js';
import { getIO } from '../../../config/socket.js';
import User from '../../../models/User.model.js';
import { sendRfqResponseCustomerEmail } from '../../../services/customerNotification.service.js';
import {
    sendRfqVendorResponseReceivedEmail,
    sendRfqMultipleQuotesAvailableEmail
} from '../../../services/sourcingNotification.service.js';

// GET /api/vendor/rfq
export const getVendorRFQs = asyncHandler(async (req, res) => {
    // Find all RFQs where the vendor is assigned
    const rfqs = await RFQ.find({ assignedVendorIds: req.user.id })
        .populate('productId', 'name image price')
        .sort({ createdAt: -1 });

    res.status(200).json(new ApiResponse(200, rfqs, 'Vendor RFQs fetched successfully.'));
});

// POST /api/vendor/rfq/:id/quote
export const vendorSendQuote = asyncHandler(async (req, res) => {
    const { unitPrice, totalPrice, deliveryTime, warranty, taxDetails, additionalNotes, attachments } = req.body;
    
    if (!unitPrice || !totalPrice || !deliveryTime) {
        throw new ApiError(400, 'Unit price, total price, and delivery time are required.');
    }

    const vendor = await Vendor.findById(req.user.id);
    if (!vendor) {
        throw new ApiError(404, 'Vendor account not found.');
    }

    const rfq = await RFQ.findOne({ _id: req.params.id, assignedVendorIds: req.user.id });
    if (!rfq) {
        throw new ApiError(404, 'RFQ not found or you are not assigned to it.');
    }

    if (['Completed', 'Purchase Order Generated', 'Rejected'].includes(rfq.status)) {
        throw new ApiError(400, 'Cannot quote on a closed or completed RFQ.');
    }

    // Check if vendor already has a quotation in the array
    const existingQuoteIndex = rfq.quotations.findIndex(q => String(q.vendorId) === String(req.user.id));

    const quoteData = {
        vendorId: req.user.id,
        vendorName: vendor.storeName || vendor.name || 'Vendor Representative',
        unitPrice,
        totalPrice,
        deliveryTime,
        warranty,
        taxDetails,
        additionalNotes,
        attachments: attachments || [],
        status: 'Submitted'
    };

    if (existingQuoteIndex > -1) {
        rfq.quotations[existingQuoteIndex] = quoteData;
    } else {
        rfq.quotations.push(quoteData);
    }

    // Update RFQ status to Quotations Received if it was Sent To Vendors
    if (rfq.status === 'Sent To Vendors') {
        rfq.status = 'Quotations Received';
    }

    rfq.approvalHistory.push({
        status: rfq.status,
        action: existingQuoteIndex > -1 ? 'Vendor Quotation Updated' : 'Vendor Quotation Submitted',
        updatedBy: req.user.id,
        updaterType: 'System', // system/vendor
        notes: `Vendor ${quoteData.vendorName} submitted quotation of Rs. ${totalPrice} (unit rate: Rs. ${unitPrice}).`
    });

    await rfq.save();

    // Notify Super Admin
    await createNotification({
        recipientType: 'admin',
        title: 'New Vendor Quotation Received',
        message: `Vendor ${quoteData.vendorName} submitted a quote for RFQ ${rfq.rfqId}.`,
        type: 'system',
        data: { rfqId: rfq.rfqId, id: String(rfq._id) }
    }).catch(() => null);

    // Customer Notification Item 17: RFQ Response Received / Quote Available
    if (rfq.buyerId) {
        User.findById(rfq.buyerId).select('name email').then(buyer => {
            if (buyer?.email) {
                sendRfqResponseCustomerEmail({
                    customerEmail: buyer.email,
                    customerName: buyer.name,
                    rfq,
                    quotation: {
                        quotePrice: totalPrice,
                        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                    }
                }).catch(err => console.error('[CustomerNotification] RFQ response email error:', err.message));

                // Phase 5 RFQ Vendor Response Notification (Item 215)
                sendRfqVendorResponseReceivedEmail({
                    customer: buyer,
                    rfq,
                    quotation: quoteData
                }).catch(err => console.error('[SourcingNotification] RFQ response email error:', err.message));

                // If multiple quotes are present, notify buyer to compare (Item 216)
                if (rfq.quotations && rfq.quotations.length > 1) {
                    sendRfqMultipleQuotesAvailableEmail({
                        customer: buyer,
                        rfq,
                        quotations: rfq.quotations
                    }).catch(err => console.error('[SourcingNotification] Multiple RFQ quotes email error:', err.message));
                }
            }
        }).catch(() => null);
    }

    res.status(200).json(new ApiResponse(200, rfq, 'Quotation submitted successfully.'));
});

// POST /api/vendor/rfq/:id/reject
export const vendorRejectRFQ = asyncHandler(async (req, res) => {
    const vendor = await Vendor.findById(req.user.id);
    if (!vendor) {
        throw new ApiError(404, 'Vendor account not found.');
    }

    const rfq = await RFQ.findOne({ _id: req.params.id, assignedVendorIds: req.user.id });
    if (!rfq) {
        throw new ApiError(404, 'RFQ not found or you are not assigned to it.');
    }

    // Mark the vendor's quote as Rejected if it exists, or create a rejected quotation entry
    const existingQuoteIndex = rfq.quotations.findIndex(q => String(q.vendorId) === String(req.user.id));
    
    const storeName = vendor.storeName || vendor.name || 'Vendor Representative';

    if (existingQuoteIndex > -1) {
        rfq.quotations[existingQuoteIndex].status = 'Rejected';
    } else {
        rfq.quotations.push({
            vendorId: req.user.id,
            vendorName: storeName,
            unitPrice: 0,
            totalPrice: 0,
            deliveryTime: 'N/A',
            additionalNotes: req.body.notes || 'Vendor declined to participate.',
            status: 'Rejected'
        });
    }

    rfq.approvalHistory.push({
        status: rfq.status,
        action: 'Vendor Declined RFQ',
        updatedBy: req.user.id,
        updaterType: 'System',
        notes: `Vendor ${storeName} declined to bid on this RFQ. Notes: ${req.body.notes || 'No notes provided.'}`
    });

    await rfq.save();

    // Notify Super Admin
    await createNotification({
        recipientType: 'admin',
        title: 'Vendor Declined RFQ',
        message: `Vendor ${storeName} has declined the invitation to quote for RFQ ${rfq.rfqId}.`,
        type: 'system',
        data: { rfqId: rfq.rfqId, id: String(rfq._id) }
    });

    res.status(200).json(new ApiResponse(200, rfq, 'RFQ invitation declined successfully.'));
});

// POST /api/vendor/rfq/upload
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

// POST /api/vendor/rfq/:id/message
export const sendVendorNegotiationMessage = asyncHandler(async (req, res) => {
    const { message } = req.body;
    if (!message) {
        throw new ApiError(400, 'Message text is required.');
    }

    const rfq = await RFQ.findOne({ _id: req.params.id, assignedVendorIds: req.user.id });
    if (!rfq) {
        throw new ApiError(404, 'RFQ not found or you are not assigned to it.');
    }

    // Find the vendor's quotation in the RFQ
    const quotation = rfq.quotations.find(q => String(q.vendorId) === String(req.user.id));
    if (!quotation) {
        throw new ApiError(400, 'Please submit a quotation first before starting negotiation chat.');
    }

    const newMessage = {
        senderId: req.user.id,
        senderType: 'Vendor',
        senderName: quotation.vendorName || 'Vendor Rep',
        message: message,
        createdAt: new Date()
    };

    if (!quotation.messages) {
        quotation.messages = [];
    }
    quotation.messages.push(newMessage);

    // Transition status to Vendor Negotiation if not already there or selected
    if (['Quotations Received', 'Vendor Evaluation'].includes(rfq.status)) {
        rfq.status = 'Vendor Negotiation';
    }

    rfq.approvalHistory.push({
        status: rfq.status,
        action: 'Vendor Negotiation Message Sent',
        updatedBy: req.user.id,
        updaterType: 'System',
        notes: `Vendor sent message: "${message.substring(0, 60)}${message.length > 60 ? '...' : ''}"`
    });

    await rfq.save();

    // Notify Super Admin
    await createNotification({
        recipientType: 'admin',
        title: 'New Negotiation Message from Vendor',
        message: `Vendor ${quotation.vendorName} sent a message on RFQ ${rfq.rfqId}.`,
        type: 'system',
        data: { rfqId: rfq.rfqId, id: String(rfq._id) }
    });

    const savedMessage = quotation.messages[quotation.messages.length - 1];

    // Emit socket event for vendor-admin chat
    const io = getIO();
    io.to(`rfq_${rfq._id}`).emit('new_vendor_message', { rfqId: rfq._id, vendorId: req.user.id, message: savedMessage });

    res.status(200).json(new ApiResponse(200, savedMessage, 'Negotiation message sent successfully.'));
});
