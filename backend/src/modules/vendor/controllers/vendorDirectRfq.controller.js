import { DirectRFQ } from '../../../models/DirectRFQ.model.js';
import { Vendor } from '../../../models/Vendor.model.js';
import { ApiError } from '../../../utils/ApiError.js';
import { ApiResponse } from '../../../utils/ApiResponse.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { getIO } from '../../../config/socket.js';
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
            .filter(m => m.senderId?.toString() === req.user.id && (Date.now() - new Date(m.createdAt).getTime() < 90000))
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

    const newMsg = {
        senderId: req.user.id,
        senderType: 'Vendor',
        senderName: vendor.storeName || vendor.name,
        message,
        priceOffer: (priceOffer !== undefined && priceOffer !== null && priceOffer !== '') ? Number(priceOffer) : undefined,
    };
    drfq.messages.push(newMsg);

    if (action === 'accept') {
        drfq.status = 'Vendor Accepted';
        drfq.finalAgreedPrice = priceOffer || drfq.targetPrice;
        newMsg.message = `[SYSTEM] Vendor accepted the RFQ at ₹${drfq.finalAgreedPrice}.`;
    } else if (action === 'reject') {
        drfq.status = 'Rejected';
        newMsg.message = `[SYSTEM] Vendor rejected the RFQ.`;
    } else if (drfq.status === 'Pending Vendor') {
        drfq.status = 'Negotiating';
    }
    
    await drfq.save();

    // Emit socket event
    const io = getIO();
    io.to(`rfq_${id}`).emit('new_message', { rfqId: id, message: newMsg });
    
    if (action === 'accept' || action === 'reject' || drfq.status === 'Negotiating') {
        io.to(`rfq_${id}`).emit('status_update', { rfqId: id, status: drfq.status });
    }

    res.status(200).json(new ApiResponse(200, newMsg, "Message sent"));
});
