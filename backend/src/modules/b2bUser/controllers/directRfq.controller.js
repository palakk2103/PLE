import { DirectRFQ } from '../../../models/DirectRFQ.model.js';
import { User } from '../../../models/User.model.js';
import { ApiError } from '../../../utils/ApiError.js';
import { ApiResponse } from '../../../utils/ApiResponse.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { getIO } from '../../../config/socket.js';
import crypto from 'crypto';
import { moderateMessage, MODERATION_ACTION } from '../../../services/chatModeration.service.js';
import ChatViolation from '../../../models/ChatViolation.model.js';

const generateId = () => `DRFQ-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

export const createDirectRFQ = asyncHandler(async (req, res) => {
    const employeeId = req.user.id;
    const employee = await User.findById(employeeId);
    if (!employee || !employee.companyId) throw new ApiError(400, "User must belong to a B2B company");

    const { vendorId, productId, customProductName, quantity, targetPrice, requirementDetails, category, expectedDeliveryDate, attachment } = req.body;

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
        .populate('vendorId', 'name storeName email')
        .populate('employeeId', 'name email');
    res.status(200).json(new ApiResponse(200, drfqs, "Fetched Direct RFQs"));
});

export const getDirectRFQDetail = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const drfq = await DirectRFQ.findById(id)
        .populate('vendorId', 'name storeName email')
        .populate('employeeId', 'name email');
    if (!drfq) throw new ApiError(404, "Not found");

    // Server-side authorization check (IDOR Protection)
    const employee = await User.findById(req.user.id);
    const isCreator = drfq.employeeId?._id 
        ? drfq.employeeId._id.toString() === req.user.id 
        : drfq.employeeId?.toString() === req.user.id;
    const isSameCompany = (employee?.companyId && drfq.companyId) && 
        (employee.companyId.toString() === drfq.companyId.toString());
    const isAdmin = req.user.role === 'admin' || req.user.role === 'b2bAdmin';

    if (!isCreator && !isSameCompany && !isAdmin) {
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
    const isCreator = drfq.employeeId?.toString() === req.user.id;
    const isSameCompany = (employee.companyId && drfq.companyId) && 
        (employee.companyId.toString() === drfq.companyId.toString());
    const isAdmin = req.user.role === 'admin' || req.user.role === 'b2bAdmin';

    if (!isCreator && !isSameCompany && !isAdmin) {
        throw new ApiError(403, "You do not have permission to send messages in this Direct RFQ.");
    }

    // Lifecycle check: prevent sending messages in terminal RFQ states
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
            .filter(m => m.senderId?.toString() === req.user.id && (Date.now() - new Date(m.createdAt).getTime() < 90000))
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

    const newMsg = {
        senderId: req.user.id,
        senderType: 'Employee',
        senderName: employee.name,
        message,
        priceOffer: (priceOffer !== undefined && priceOffer !== null && priceOffer !== '') ? Number(priceOffer) : undefined,
    };
    drfq.messages.push(newMsg);

    if (action === 'accept') {
        drfq.status = 'Pending Admin Approval';
        drfq.finalAgreedPrice = priceOffer || drfq.targetPrice;
        newMsg.message = `[SYSTEM] Employee locked price at ₹${drfq.finalAgreedPrice} and sent for B2B Admin approval.`;
    }

    await drfq.save();

    // Emit socket event
    const io = getIO();
    io.to(`rfq_${id}`).emit('new_message', { rfqId: id, message: newMsg });

    if (action === 'accept') {
        io.to(`rfq_${id}`).emit('status_update', { rfqId: id, status: drfq.status });
    }

    res.status(200).json(new ApiResponse(200, newMsg, "Message sent"));
});
