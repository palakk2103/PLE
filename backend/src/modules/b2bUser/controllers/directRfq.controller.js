import { DirectRFQ } from '../../../models/DirectRFQ.model.js';
import { User } from '../../../models/User.model.js';
import { ApiError } from '../../../utils/ApiError.js';
import { ApiResponse } from '../../../utils/ApiResponse.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { getIO } from '../../../config/socket.js';
import crypto from 'crypto';
import { moderateMessage, checkMultiMessageEvasion, validateMonetaryOffer, MODERATION_ACTION } from '../../../services/chatModeration.service.js';
import ChatViolation from '../../../models/ChatViolation.model.js';
import Product from '../../../models/Product.model.js';
import { createRFQ } from './rfq.controller.js';
import { createNotification } from '../../../services/notification.service.js';
import { assertTextLength } from '../../../utils/chatLimits.js';

/**
 * Who may read / write a Direct RFQ: the employee who created it, or a B2B admin of the SAME company.
 * (A B2B admin of another company, or a colleague employee, must not see the negotiation.)
 */
const canAccessDirectRfq = (drfq, user, requester) => {
    const creatorId = String(drfq.employeeId?._id || drfq.employeeId || '');
    if (creatorId && creatorId === String(user.id)) return true;
    const sameCompany = !!(requester?.companyId && drfq.companyId)
        && String(requester.companyId) === String(drfq.companyId);
    return sameCompany && user.role === 'b2bAdmin';
};

const generateId = () => `DRFQ-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

export const createDirectRFQ = asyncHandler(async (req, res) => {
    const employeeId = req.user.id;
    const employee = await User.findById(employeeId);
    if (!employee || !employee.companyId) throw new ApiError(400, "User must belong to a B2B company");

    let { vendorId, productId, customProductName, quantity, targetPrice, requirementDetails, category, expectedDeliveryDate, attachment } = req.body;

    // Ownership routing: a vendor-owned product goes to that vendor (never to a different one the
    // client picked); an admin-managed product goes to the Super Admin through the standard RFQ flow.
    if (productId) {
        const product = await Product.findById(productId).select('vendorId shopId').lean();
        if (!product) throw new ApiError(404, 'Product not found.');
        if (product.vendorId && !product.shopId) {
            vendorId = product.vendorId;
        } else {
            req.body.status = 'Submitted';
            return createRFQ(req, res);
        }
    }
    if (!vendorId) throw new ApiError(400, 'Please select a vendor.');

    const drfq = await DirectRFQ.create({
        directRfqId: generateId(),
        employeeId,
        companyId: employee.companyId,
        vendorId,
        productId,
        customProductName,
        quantity,
        targetPrice,
        requirementDetails,
        category,
        expectedDeliveryDate,
        attachment,
        status: 'Pending Vendor'
    });

    res.status(201).json(new ApiResponse(201, drfq, "Direct RFQ sent to vendor"));
});

export const getEmployeeDirectRFQs = asyncHandler(async (req, res) => {
    const employeeId = req.user.id;
    const drfqs = await DirectRFQ.find({ employeeId })
        .populate('vendorId', 'name storeName')
        .populate('employeeId', 'name email');
    res.status(200).json(new ApiResponse(200, drfqs, "Fetched Direct RFQs"));
});

export const getDirectRFQDetail = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const drfq = await DirectRFQ.findById(id)
        .populate('vendorId', 'name storeName')
        .populate('employeeId', 'name email');
    if (!drfq) throw new ApiError(404, "Not found");

    // Server-side authorization check (IDOR Protection)
    const requester = await User.findById(req.user.id).select('companyId');
    if (!canAccessDirectRfq(drfq, req.user, requester)) {
        throw new ApiError(403, "You do not have permission to access this Direct RFQ.");
    }

    res.status(200).json(new ApiResponse(200, drfq, "Fetched Direct RFQ detail"));
});

export const sendDirectMessage = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { message, priceOffer, action } = req.body;
    const employee = await User.findById(req.user.id);
    if (!employee) throw new ApiError(401, "User not authenticated");

    const drfq = await DirectRFQ.findById(id);
    if (!drfq) throw new ApiError(404, "Not found");

    // Server-side authorization check (IDOR Protection)
    if (!canAccessDirectRfq(drfq, req.user, employee)) {
        throw new ApiError(403, "You do not have permission to send messages in this Direct RFQ.");
    }

    // Lifecycle check: prevent sending messages in terminal RFQ states
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
    if (action === 'accept' && drfq.status === 'Pending Admin Approval') {
        throw new ApiError(400, 'The price is already locked and waiting for B2B Admin approval.');
    }
    if (action !== 'accept' && hasOffer && PRICE_LOCKED.includes(drfq.status)) {
        throw new ApiError(400, 'The price is locked, so a new price offer cannot be made.');
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
    if (message && action !== 'accept') {
        const moderationResult = moderateMessage(message);
        if (moderationResult.action !== MODERATION_ACTION.ALLOW) {
            try {
                await ChatViolation.create({
                    senderId:   req.user.id,
                    senderType: 'customer',
                    vendorId:   drfq.vendorId,
                    category:   moderationResult.category,
                    action:     moderationResult.action,
                    direction:  'USER_TO_VENDOR',
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
        const recentEmployeeMsgs = (drfq.messages || [])
            .filter(m => m.senderId?.toString() === req.user.id && (Date.now() - new Date(m.createdAt).getTime() < 24 * 60 * 60 * 1000))
            .slice(-10)
            .map(m => m.message);
        const evasionResult = checkMultiMessageEvasion(message, recentEmployeeMsgs);
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
        // You can only lock a price the vendor has actually offered/accepted - never one you made up.
        const vendorPrice = drfq.status === 'Vendor Accepted' ? drfq.finalAgreedPrice : latestOfferFrom('Vendor');
        if (!Number.isFinite(vendorPrice)) {
            throw new ApiError(400, 'The vendor has not offered a price yet. You can only accept a price the vendor has offered.');
        }
        drfq.status = 'Pending Admin Approval';
        drfq.finalAgreedPrice = vendorPrice;
        finalText = `[SYSTEM] Employee locked price at ₹${drfq.finalAgreedPrice} and sent for B2B Admin approval.`;
    }
    const newMsg = {
        senderId: req.user.id,
        senderType: 'Employee',
        senderName: employee.name,
        message: finalText,
        priceOffer: (priceOffer !== undefined && priceOffer !== null && priceOffer !== '') ? Number(priceOffer) : undefined,
    };
    drfq.messages.push(newMsg);

    await drfq.save();

    // Emit socket event
    // Saved notification for the vendor (they may be offline); the live event below only reaches open screens
    try {
        await createNotification({
            recipientId: drfq.vendorId, recipientType: 'vendor',
            title: action === 'accept' ? 'Direct RFQ price locked' : 'New Direct RFQ message',
            message: `${employee.name} ${action === 'accept' ? 'accepted your price on' : 'sent a message on'} ${drfq.directRfqId}.`,
            type: 'system', data: { rfqId: drfq.directRfqId, id: String(drfq._id) },
        });
    } catch (nErr) {
        console.warn('Direct RFQ notification failed:', nErr.message);
    }

    const io = getIO();
    io.to(`rfq_${id}`).emit('new_message', { rfqId: id, message: newMsg });

    if (action === 'accept') {
        io.to(`rfq_${id}`).emit('status_update', { rfqId: id, status: drfq.status });
    }

    res.status(200).json(new ApiResponse(200, newMsg, "Message sent"));
});
