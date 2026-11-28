import mongoose from 'mongoose';
import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import { getIO } from '../../../config/socket.js';
import ApiError from '../../../utils/ApiError.js';
import RFQ from '../../../models/RFQ.model.js';
import PurchaseOrder from '../../../models/PurchaseOrder.model.js';
import Vendor from '../../../models/Vendor.model.js';
import { createNotification } from '../../../services/notification.service.js';
import { rfqForViewer } from '../../../utils/rfqVisibility.js';
import { assertTextLength, sanitizeAttachments } from '../../../utils/chatLimits.js';

// GET /api/admin/rfq
export const getAdminRFQs = asyncHandler(async (req, res) => {
    // Consumer RFQs have their own admin section (/admin/consumer-rfq); keep them out of Managed Sourcing.
    const rfqs = await RFQ.find({ rfqType: { $ne: 'consumer' } })
        .populate('productId', 'name image price')
        .populate('companyId', 'companyName businessEmail')
        .populate('buyerId', 'name email phone companyName businessAddress gstNumber')
        .populate('assignedVendorIds', 'storeName name email phone')
        .sort({ createdAt: -1 });

    res.status(200).json(new ApiResponse(200, rfqs.map((r) => rfqForViewer(r, 'admin')), 'All RFQs fetched successfully.'));
});

// GET /api/admin/rfq/:id
export const getAdminRFQDetail = asyncHandler(async (req, res) => {
    const rfq = await RFQ.findOne({ _id: req.params.id, rfqType: { $ne: 'consumer' } })
        .populate('productId', 'name image price unit stockQuantity')
        .populate('buyerId', 'name email phone companyName businessAddress gstNumber')
        .populate('assignedVendorIds', 'storeName name email phone');

    if (!rfq) {
        throw new ApiError(404, 'RFQ not found.');
    }

    res.status(200).json(new ApiResponse(200, rfqForViewer(rfq, 'admin'), 'RFQ details fetched successfully.'));
});

// GET /api/admin/rfq/stats
export const getRFQStats = asyncHandler(async (req, res) => {
    const stats = await RFQ.aggregate([
        { $match: { rfqType: { $ne: 'consumer' } } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);

    const statMap = {
        Total: 0,
        Pending: 0,
        UnderReview: 0,
        Negotiating: 0,
        Approved: 0,
        SentToVendors: 0,
        QuotationReceived: 0,
        QuotationsReceived: 0,
        QuotationReview: 0,
        VendorEvaluation: 0,
        VendorNegotiation: 0,
        VendorSelected: 0,
        AwaitingB2BConfirmation: 0,
        AwaitingB2BApproval: 0,
        PurchaseOrderGenerated: 0,
        Completed: 0,
        Rejected: 0
    };

    let total = 0;
    stats.forEach(s => {
        total += s.count;
        
        // Match string names to keys
        let key = s._id ? s._id.replace(/\s+/g, '') : '';
        if (key === 'UnderSuperAdminReview') key = 'UnderReview';
        if (key === 'NegotiationInProgress') key = 'Negotiating';
        if (key === 'SentToVendors') key = 'SentToVendors';
        if (key === 'QuotationReceived') key = 'QuotationReceived';
        if (key === 'QuotationsReceived') key = 'QuotationsReceived';
        if (key === 'VendorEvaluation') key = 'VendorEvaluation';
        if (key === 'QuotationReview') key = 'QuotationReview';
        if (key === 'VendorNegotiation') key = 'VendorNegotiation';
        if (key === 'VendorSelected') key = 'VendorSelected';
        if (key === 'AwaitingB2BConfirmation') key = 'AwaitingB2BConfirmation';
        if (key === 'AwaitingB2BApproval') key = 'AwaitingB2BApproval';
        if (key === 'PurchaseOrderGenerated') key = 'PurchaseOrderGenerated';
        
        if (statMap[key] !== undefined) {
            statMap[key] = s.count;
        } else if (s._id === 'Pending' || s._id === 'Submitted') {
            statMap.Pending += s.count;
        } else if (s._id === 'Rejected') {
            statMap.Rejected = s.count;
        }
    });
    statMap.Total = total;

    res.status(200).json(new ApiResponse(200, statMap, 'RFQ stats fetched successfully.'));
});

// POST /api/admin/rfq/:id/status
export const updateRFQStatus = asyncHandler(async (req, res) => {
    const { status, notes } = req.body;
    if (!status) {
        throw new ApiError(400, 'Status is required.');
    }

    const rfq = await RFQ.findOne({ _id: req.params.id, rfqType: { $ne: 'consumer' } });
    if (!rfq) {
        throw new ApiError(404, 'RFQ not found.');
    }

    rfq.status = status;
    rfq.approvalHistory.push({
        status,
        action: `Super Admin status update to ${status}`,
        updatedBy: req.user.id,
        updaterType: 'SuperAdmin',
        notes: notes || `RFQ status transitioned to ${status}.`
    });

    await rfq.save();

    const io = getIO();
    io.to(`rfq_${rfq._id}`).emit('status_update', { rfqId: rfq._id, status: rfq.status });

    // Notify B2B Admin / Employee
    const targetUserId = rfq.createdByAdminId || rfq.createdByEmployeeId;
    if (targetUserId) {
        await createNotification({
            recipientId: targetUserId,
            recipientType: 'user',
            title: `RFQ Status Update: ${status}`,
            message: `Your RFQ ${rfq.rfqId} status has been updated to: ${status}.`,
            type: 'system',
            data: { rfqId: rfq.rfqId, id: String(rfq._id) }
        });
    }

    res.status(200).json(new ApiResponse(200, rfq, `RFQ status updated to ${status} successfully.`));
});

// POST /api/admin/rfq/:id/assign-vendors
export const assignVendors = asyncHandler(async (req, res) => {
    const { vendorIds } = req.body;
    if (!vendorIds || !Array.isArray(vendorIds) || vendorIds.length === 0) {
        throw new ApiError(400, 'Array of vendorIds is required.');
    }

    const rfq = await RFQ.findOne({ _id: req.params.id, rfqType: { $ne: 'consumer' } });
    if (!rfq) {
        throw new ApiError(404, 'RFQ not found.');
    }

    if (['Completed', 'Purchase Order Generated', 'Rejected'].includes(rfq.status)) {
        throw new ApiError(400, `Vendors cannot be assigned to an RFQ that is ${rfq.status}.`);
    }

    // Only real, approved vendors can be invited.
    const requestedIds = [...new Set(vendorIds.map(String))];
    if (requestedIds.some((vid) => !mongoose.isValidObjectId(vid))) {
        throw new ApiError(400, 'One or more vendor IDs are invalid.');
    }
    const approved = await Vendor.find({ _id: { $in: requestedIds }, status: 'approved' }).select('_id').lean();
    if (approved.length !== requestedIds.length) {
        throw new ApiError(400, 'Only approved vendors can be invited. Please refresh the vendor list and try again.');
    }

    // Vendors who already sent a quote keep access, so their quote never becomes orphaned.
    const quotedIds = (rfq.quotations || []).map((q) => String(q.vendorId));
    const previouslyAssigned = (rfq.assignedVendorIds || []).map(String);
    const newlyInvited = requestedIds.filter((vid) => !previouslyAssigned.includes(vid));
    rfq.assignedVendorIds = [...new Set([...requestedIds, ...quotedIds])];
    // Re-inviting more vendors after quotes arrived must not move the RFQ backwards.
    if (!['Quotations Received', 'Vendor Evaluation', 'Vendor Negotiation', 'Vendor Selected', 'Awaiting B2B Approval'].includes(rfq.status)) {
        rfq.status = 'Sent To Vendors';
    }
    rfq.approvalHistory.push({
        status: 'Sent To Vendors',
        action: 'Assigned Vendors & Dispatched',
        updatedBy: req.user.id,
        updaterType: 'SuperAdmin',
        notes: `RFQ sent to ${vendorIds.length} vendor(s) for bidding.`
    });

    await rfq.save();

    // Live update is best-effort: the assignment is already saved, so a socket problem must not turn it into an error.
    try {
        getIO().to(`rfq_${rfq._id}`).emit('status_update', { rfqId: rfq._id, status: rfq.status });
    } catch (socketErr) {
        console.warn('RFQ status socket update failed:', socketErr.message);
    }

    // Notify only vendors who were not already invited
    for (const vendorId of newlyInvited) {
        await createNotification({
            recipientId: vendorId,
            recipientType: 'vendor',
            title: 'New RFQ Invitation',
            message: `You have been invited to quote for RFQ ${rfq.rfqId}.`,
            type: 'system',
            data: { rfqId: rfq.rfqId, id: String(rfq._id) }
        });
    }

    // Notify B2B Admin
    const targetUserId = rfq.createdByAdminId || rfq.createdByEmployeeId;
    if (targetUserId) {
        await createNotification({
            recipientId: targetUserId,
            recipientType: 'user',
            title: 'RFQ Sent to Vendors',
            message: `Your RFQ ${rfq.rfqId} has been successfully dispatched to vendors.`,
            type: 'system',
            data: { rfqId: rfq.rfqId, id: String(rfq._id) }
        });
    }

    res.status(200).json(new ApiResponse(200, rfq, 'Vendors assigned successfully.'));
});

// POST /api/admin/rfq/:id/select-vendor
export const selectVendorQuote = asyncHandler(async (req, res) => {
    const { vendorId } = req.body;
    if (!vendorId) {
        throw new ApiError(400, 'Vendor ID is required.');
    }

    const rfq = await RFQ.findOne({ _id: req.params.id, rfqType: { $ne: 'consumer' } });
    if (!rfq) {
        throw new ApiError(404, 'RFQ not found.');
    }

    // Find the quote
    let selectedQuote = null;
    rfq.quotations.forEach(q => {
        if (String(q.vendorId) === String(vendorId)) {
            q.status = 'Selected';
            selectedQuote = q;
        } else {
            q.status = 'Rejected';
        }
    });

    if (!selectedQuote) {
        throw new ApiError(404, 'Quotation for this vendor not found in RFQ.');
    }

    rfq.status = 'Vendor Selected';
    rfq.approvalHistory.push({
        status: 'Vendor Selected',
        action: 'Vendor Quotation Selected',
        updatedBy: req.user.id,
        updaterType: 'SuperAdmin',
        notes: `Selected quotation from vendor ${selectedQuote.vendorName} (Total: Rs. ${selectedQuote.totalPrice}). Recommended vendor selected.`
    });

    await rfq.save();

    const io = getIO();
    io.to(`rfq_${rfq._id}`).emit('status_update', { rfqId: rfq._id, status: rfq.status });

    // Notify B2B Admin
    const targetUserId = rfq.createdByAdminId || rfq.createdByEmployeeId;
    if (targetUserId) {
        await createNotification({
            recipientId: targetUserId,
            recipientType: 'user',
            title: 'RFQ Recommended Vendor Selected',
            message: `Super Admin has selected recommended vendor ${selectedQuote.vendorName} for RFQ ${rfq.rfqId}.`,
            type: 'system',
            data: { rfqId: rfq.rfqId, id: String(rfq._id) }
        });
    }

    res.status(200).json(new ApiResponse(200, rfq, 'Vendor quotation selected successfully.'));
});

// POST /api/admin/rfq/:id/submit-b2b-approval
export const submitB2BApproval = asyncHandler(async (req, res) => {
    const rfq = await RFQ.findOne({ _id: req.params.id, rfqType: { $ne: 'consumer' } });
    if (!rfq) {
        throw new ApiError(404, 'RFQ not found.');
    }

    if (rfq.status !== 'Vendor Selected') {
        throw new ApiError(400, 'RFQ must be in Vendor Selected status to submit for B2B approval.');
    }

    const selectedQuote = rfq.quotations.find(q => q.status === 'Selected');
    if (!selectedQuote) {
        throw new ApiError(400, 'No selected recommended vendor quotation found in this RFQ.');
    }

    rfq.status = 'Awaiting B2B Approval';
    rfq.approvalHistory.push({
        status: 'Awaiting B2B Approval',
        action: 'Sent for B2B Approval',
        updatedBy: req.user.id,
        updaterType: 'SuperAdmin',
        notes: `Vendor ${selectedQuote.vendorName} quotation sent to B2B Admin for final approval.`
    });

    await rfq.save();

    const io = getIO();
    io.to(`rfq_${rfq._id}`).emit('status_update', { rfqId: rfq._id, status: rfq.status });

    // Notify B2B Admin
    const targetUserId = rfq.createdByAdminId || rfq.createdByEmployeeId;
    if (targetUserId) {
        await createNotification({
            recipientId: targetUserId,
            recipientType: 'user',
            title: 'RFQ Sourcing Recommendation: Awaiting Approval',
            message: `Super Admin has sent the recommended quote from vendor ${selectedQuote.vendorName} for RFQ ${rfq.rfqId} for your approval.`,
            type: 'system',
            data: { rfqId: rfq.rfqId, id: String(rfq._id) }
        });
    }

    res.status(200).json(new ApiResponse(200, rfq, 'RFQ successfully submitted for B2B Admin approval.'));
});

// POST /api/admin/rfq/:id/message
export const sendAdminDiscussionMessage = asyncHandler(async (req, res) => {
    const rfq = await RFQ.findOne({ _id: req.params.id, rfqType: { $ne: 'consumer' } });
    if (!rfq) {
        throw new ApiError(404, 'RFQ not found.');
    }

    const { message, attachments, isInternalNote } = req.body;
    if (!message) {
        throw new ApiError(400, 'Message body is required.');
    }
    assertTextLength(message);
    const safeAttachments = sanitizeAttachments(attachments);

    rfq.negotiationMessages.push({
        senderId: req.user.id,
        senderType: 'SuperAdmin',
        senderName: 'Super Admin',
        message,
        attachments: safeAttachments,
        isInternalNote: !!isInternalNote
    });

    await rfq.save();

    // Notify B2B Admin / Employee
    if (!isInternalNote) {
        const targetUserId = rfq.createdByAdminId || rfq.createdByEmployeeId;
        if (targetUserId) {
            await createNotification({
                recipientId: targetUserId,
                recipientType: 'user',
                title: 'New message from Super Admin',
                message: `Super Admin added a message to RFQ ${rfq.rfqId} discussion panel.`,
                type: 'system',
                data: { rfqId: rfq.rfqId, id: String(rfq._id) }
            });
        }
    }

    const newMessage = rfq.negotiationMessages[rfq.negotiationMessages.length - 1];

    // Emit socket event for internal discussion
    const io = getIO();
    // An admin-only note must not be broadcast to the buyer's company
    io.to(isInternalNote ? `rfq_${rfq._id}_admin` : `rfq_${rfq._id}`).emit('new_internal_message', { rfqId: rfq._id, message: newMessage });

    res.status(200).json(new ApiResponse(200, newMessage, 'Message sent successfully.'));
});

// POST /api/admin/rfq/:id/vendor/:vendorId/message
export const sendAdminToVendorMessage = asyncHandler(async (req, res) => {
    const { message } = req.body;
    if (!message) {
        throw new ApiError(400, 'Message text is required.');
    }
    assertTextLength(message);

    const rfq = await RFQ.findOne({ _id: req.params.id, rfqType: { $ne: 'consumer' } });
    if (!rfq) {
        throw new ApiError(404, 'RFQ not found.');
    }

    const quotation = rfq.quotations.find(q => String(q.vendorId) === String(req.params.vendorId));
    if (!quotation) {
        throw new ApiError(404, 'Quotation not found for this vendor.');
    }

    const newMessage = {
        senderId: req.user.id,
        senderType: 'SuperAdmin',
        senderName: 'Super Admin',
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
        action: 'Admin Negotiation Message Sent',
        updatedBy: req.user.id,
        updaterType: 'SuperAdmin',
        notes: `Super Admin sent message to vendor ${quotation.vendorName}: "${message.substring(0, 60)}${message.length > 60 ? '...' : ''}"`
    });

    await rfq.save();

    // Notify vendor
    await createNotification({
        recipientId: quotation.vendorId,
        recipientType: 'vendor',
        title: 'New Negotiation Message from Admin',
        message: `Super Admin sent you a message on RFQ ${rfq.rfqId}.`,
        type: 'system',
        data: { rfqId: rfq.rfqId, id: String(rfq._id) }
    });

    const savedMessage = quotation.messages[quotation.messages.length - 1];

    // Emit socket event for vendor-admin chat
    const io = getIO();
    // Only the admins and THIS vendor's private line - never other vendors or the B2B buyer.
    io.to([`rfq_${rfq._id}_admin`, `rfq_${rfq._id}_vendor_${quotation.vendorId}`])
        .emit('new_admin_message', { rfqId: rfq._id, vendorId: quotation.vendorId, message: savedMessage });

    res.status(200).json(new ApiResponse(200, savedMessage, 'Negotiation message sent successfully.'));
});

// GET /api/admin/purchase-orders
export const getAdminPurchaseOrders = asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.rfqId) {
        filter.rfqId = req.query.rfqId;
    }
    const pos = await PurchaseOrder.find(filter)
        .populate('rfqId', 'rfqId')
        .sort({ createdAt: -1 });

    res.status(200).json(new ApiResponse(200, pos, 'All Purchase Orders fetched successfully.'));
});

// GET /api/admin/purchase-orders/:id
export const getAdminPurchaseOrderDetail = asyncHandler(async (req, res) => {
    const po = await PurchaseOrder.findById(req.params.id).populate('rfqId', 'rfqId');
    if (!po) {
        throw new ApiError(404, 'Purchase Order not found.');
    }

    res.status(200).json(new ApiResponse(200, po, 'Purchase Order details fetched successfully.'));
});
