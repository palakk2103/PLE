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
    const user = await User.findById(req.user.id);
    if (!user) throw new ApiError(404, "User not found");

    let query = { employeeId: req.user.id };
    if (user.role === 'b2bAdmin') {
        if (!user.companyId) throw new ApiError(400, "Admin must belong to a B2B company");
        query = { companyId: user.companyId };
    }

    const drfqs = await DirectRFQ.find(query)
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
    res.status(200).json(new ApiResponse(200, drfq, "Fetched Direct RFQ detail"));
});

export const sendDirectMessage = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { message, priceOffer, action } = req.body;
    const employee = await User.findById(req.user.id);

    const drfq = await DirectRFQ.findById(id);
    if (!drfq) throw new ApiError(404, "Not found");

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
    }
    // ── End Moderation ────────────────────────────────────────

    const newMsg = {
        senderId: req.user.id,
        senderType: 'Employee',
        senderName: employee.name,
        message,
        priceOffer
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
