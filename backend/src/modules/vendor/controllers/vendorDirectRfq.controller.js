import { DirectRFQ } from '../../../models/DirectRFQ.model.js';
import { Vendor } from '../../../models/Vendor.model.js';
import { ApiError } from '../../../utils/ApiError.js';
import { ApiResponse } from '../../../utils/ApiResponse.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { getIO } from '../../../config/socket.js';
import { createNotification } from '../../../services/notification.service.js';
import { assertTextLength } from '../../../utils/chatLimits.js';
import { moderateMessage, checkMultiMessageEvasion, validateMonetaryOffer, MODERATION_ACTION } from '../../../services/chatModeration.service.js';
import ChatViolation from '../../../models/ChatViolation.model.js';

export const getVendorDirectRFQs = asyncHandler(async (req, res) => {
    const vendorId = req.user.id;
    const drfqs = await DirectRFQ.find({ vendorId }).populate('employeeId', 'name email');
    res.status(200).json(new ApiResponse(200, drfqs, "Fetched Vendor Direct RFQs"));
});

export const getVendorDirectRFQDetail = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const drfq = await DirectRFQ.findById(id).populate('employeeId', 'name email');
    if (!drfq) throw new ApiError(404, "Not found");

    // Server-side authorization check (IDOR Protection)
    if (drfq.vendorId.toString() !== req.user.id) {
        throw new ApiError(403, "You do not have permission to access this Direct RFQ.");
    }

    res.status(200).json(new ApiResponse(200, drfq, "Fetched Direct RFQ detail"));
});

export const sendDirectMessage = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { message, priceOffer, action } = req.body;
    const vendor = await Vendor.findById(req.user.id);
    if (!vendor) throw new ApiError(401, "Vendor not found");

    const drfq = await DirectRFQ.findById(id);
    if (!drfq) throw new ApiError(404, "Not found");

    // Server-side authorization check (IDOR Protection)
    if (drfq.vendorId.toString() !== req.user.id) {
        throw new ApiError(403, "You do not have permission to send messages in this Direct RFQ.");
    }

    // Lifecycle check: terminal states
    if (['PO Generated', 'Rejected'].includes(drfq.status)) {
        throw new ApiError(400, `This Direct RFQ is closed (${drfq.status}). New messages cannot be sent.`);
    }
    assertTextLength(message);

    // A price that has been locked for approval can no longer be changed by either side.
    const PRICE_LOCKED = ['Vendor Accepted', 'Pending Admin Approval'];
    const hasOffer = priceOffer !== undefined && priceOffer !== null && priceOffer !== '';
    const latestOfferFrom = (senderType) => {
        const m = [...(drfq.messages || [])].reverse().find((x) => x.senderType === senderType && Number.isFinite(x.priceOffer));
        return m ? m.priceOffer : undefined;
    };
    if (PRICE_LOCKED.includes(drfq.status) && (action === 'accept' || action === 'reject' || hasOffer)) {
        throw new ApiError(400, 'The price is already locked, so it cannot be changed or rejected now.');
    }

    // ── Monetary Proposal Validation ──────────────────────────
    if (priceOffer !== undefined && priceOffer !== null && priceOffer !== '') {
        const offerValidation = validateMonetaryOffer(priceOffer);
        if (!offerValidation.isValid) {
            return res.status(422).json({
                success: false,
                code: 'INVALID_PRICE_OFFER',
                message: offerValidation.reason,
            });
        }
    }

    // ── Moderation Layer ──────────────────────────────────────
    if (message && action !== 'accept' && action !== 'reject') {
        const moderationResult = moderateMessage(message);
        if (moderationResult.action !== MODERATION_ACTION.ALLOW) {
            try {
                await ChatViolation.create({
                    senderId:   req.user.id,
                    senderType: 'vendor',
                    vendorId:   req.user.id,
                    category:   moderationResult.category,
                    action:     moderationResult.action,
                    direction:  'VENDOR_TO_USER',
                    reason:     moderationResult.reason,
                });
            } catch (logErr) {
                console.warn('Failed to log chat violation:', logErr.message);
            }

            if (moderationResult.action === MODERATION_ACTION.BLOCK) {
                return res.status(422).json({
                    success:  false,
                    code:     'MESSAGE_BLOCKED',
                    category: moderationResult.category,
                    message:  moderationResult.userMessage,
                });
            }
        }

        // Multi-message evasion check
        const recentVendorMsgs = (drfq.messages || [])
            .filter(m => m.senderId?.toString() === req.user.id && (Date.now() - new Date(m.createdAt).getTime() < 24 * 60 * 60 * 1000))
            .slice(-10)
            .map(m => m.message);
        const evasionResult = checkMultiMessageEvasion(message, recentVendorMsgs);
        if (evasionResult.action === MODERATION_ACTION.BLOCK) {
            return res.status(422).json({
                success:  false,
                code:     'MESSAGE_BLOCKED',
                category: evasionResult.category,
                message:  evasionResult.userMessage,
            });
        }
    }
    // ── End Moderation ────────────────────────────────────────

    // Build the final text BEFORE saving so the stored message is exactly what both sides see.
    let finalText = message;
    if (action === 'accept') {
        // Accepting means agreeing to the BUYER's latest price (or the original target), not naming a new one.
        drfq.status = 'Vendor Accepted';
        drfq.finalAgreedPrice = latestOfferFrom('Employee') ?? drfq.targetPrice;
        finalText = `[SYSTEM] Vendor accepted the RFQ at ₹${drfq.finalAgreedPrice}.`;
    } else if (action === 'reject') {
        drfq.status = 'Rejected';
        finalText = '[SYSTEM] Vendor rejected the RFQ.';
    } else if (drfq.status === 'Pending Vendor') {
        drfq.status = 'Negotiating';
    }
    const newMsg = {
        senderId: req.user.id,
        senderType: 'Vendor',
        senderName: vendor.storeName || vendor.name,
        message: finalText,
        priceOffer: (priceOffer !== undefined && priceOffer !== null && priceOffer !== '') ? Number(priceOffer) : undefined,
    };
    drfq.messages.push(newMsg);

    await drfq.save();

    // Emit socket event
    try {
        await createNotification({
            recipientId: drfq.employeeId, recipientType: 'user',
            title: action === 'accept' ? 'Vendor accepted your Direct RFQ' : (action === 'reject' ? 'Vendor rejected your Direct RFQ' : 'New Direct RFQ message'),
            message: `${vendor.storeName || vendor.name} ${action === 'accept' ? 'accepted' : (action === 'reject' ? 'rejected' : 'sent a message on')} ${drfq.directRfqId}.`,
            type: 'system', data: { rfqId: drfq.directRfqId, id: String(drfq._id) },
        });
    } catch (nErr) {
        console.warn('Direct RFQ notification failed:', nErr.message);
    }

    const io = getIO();
    io.to(`rfq_${id}`).emit('new_message', { rfqId: id, message: newMsg });
    
    if (action === 'accept' || action === 'reject' || drfq.status === 'Negotiating') {
        io.to(`rfq_${id}`).emit('status_update', { rfqId: id, status: drfq.status });
    }

    res.status(200).json(new ApiResponse(200, newMsg, "Message sent"));
});
