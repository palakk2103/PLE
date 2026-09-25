import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import VendorChatThread from '../../../models/VendorChatThread.model.js';
import VendorChatMessage from '../../../models/VendorChatMessage.model.js';
import Vendor from '../../../models/Vendor.model.js';
import User from '../../../models/User.model.js';
import Order from '../../../models/Order.model.js';
import { getIO } from '../../../config/socket.js';
import { moderateMessage, checkMultiMessageEvasion, MODERATION_ACTION } from '../../../services/chatModeration.service.js';
import ChatViolation from '../../../models/ChatViolation.model.js';
import ChatReport from '../../../models/ChatReport.model.js';

const serializeMessage = (messageDoc) => ({
    id: messageDoc._id,
    sender: messageDoc.senderType,
    message: messageDoc.message,
    time: messageDoc.createdAt,
});

export const initiateVendorChat = asyncHandler(async (req, res) => {
    const { vendorId } = req.body;
    if (!vendorId) throw new ApiError(400, 'Vendor ID is required.');

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) throw new ApiError(404, 'Vendor not found.');

    // Find existing general chat thread for this user and vendor (no orderRef)
    let thread = await VendorChatThread.findOne({
        vendorId,
        customerUserId: req.user.id,
        orderRef: null,
    });

    if (!thread) {
        thread = await VendorChatThread.create({
            vendorId,
            customerUserId: req.user.id,
            customerName: req.user.name || 'Customer',
            customerEmail: req.user.email || '',
            customerPhone: req.user.phone || '',
            lastMessage: 'Chat initiated.',
            status: 'active',
        });
    }

    res.status(200).json(new ApiResponse(200, thread, 'Chat thread initialized.'));
});

export const getCustomerChatThreads = asyncHandler(async (req, res) => {
    const threads = await VendorChatThread.find({ customerUserId: req.user.id })
        .populate('vendorId', 'name storeName storeLogo isVerified rating')
        .sort({ lastActivity: -1 });

    res.status(200).json(new ApiResponse(200, threads, 'Chat threads fetched.'));
});

export const getCustomerChatMessages = asyncHandler(async (req, res) => {
    const thread = await VendorChatThread.findOne({
        _id: req.params.id,
        customerUserId: req.user.id,
    });
    if (!thread) throw new ApiError(404, 'Chat thread not found.');

    const messages = await VendorChatMessage.find({ threadId: thread._id }).sort({ createdAt: 1 });

    res.status(200).json(new ApiResponse(200, messages.map(serializeMessage), 'Chat messages fetched.'));
});

export const sendCustomerChatMessage = asyncHandler(async (req, res) => {
    const message = String(req.body?.message || '').trim();
    if (!message) throw new ApiError(400, 'Message is required.');

    // 1. Account-level chat restriction check
    const user = await User.findById(req.user.id);
    if (user?.chatMutedUntil && new Date(user.chatMutedUntil) > new Date()) {
        throw new ApiError(403, `Your chat messaging is temporarily restricted until ${new Date(user.chatMutedUntil).toLocaleString()}.`);
    }

    const thread = await VendorChatThread.findOne({
        _id: req.params.id,
        customerUserId: req.user.id,
    });
    if (!thread) throw new ApiError(404, 'Chat thread not found.');

    // 2. Thread-level block check
    if (thread.isBlocked) {
        throw new ApiError(403, 'Communication in this chat is currently blocked.');
    }

    // 3. Thread status check
    if (['resolved', 'closed'].includes(thread.status)) {
        throw new ApiError(400, 'This conversation has been closed.');
    }

    // 4. Order lifecycle check
    if (thread.orderRef) {
        const order = await Order.findById(thread.orderRef).select('status paymentStatus');
        if (order && (['delivered', 'completed', 'cancelled', 'returned'].includes(order.status) || order.paymentStatus === 'refunded')) {
            thread.status = 'resolved';
            await thread.save();
            throw new ApiError(400, 'This conversation is closed for this order.');
        }
    }

    // 5. ProductRequest / SourceNow lifecycle check
    if (thread.productRequestRef) {
        const { default: ProductRequest } = await import('../../../models/ProductRequest.model.js');
        const pr = await ProductRequest.findById(thread.productRequestRef).select('acceptedVendorId vendorFulfillmentStatus status');
        if (pr) {
            const isFulfilling = pr.vendorFulfillmentStatus === 'IN_PROGRESS';
            const isTerminal = ['Vendor Released', 'Expired', 'Cancelled', 'Completed', 'Rejected'].includes(pr.status);
            if (!isFulfilling || isTerminal) {
                thread.status = 'closed';
                await thread.save();
                throw new ApiError(400, 'This sourcing conversation is closed or has been reassigned.');
            }
        }
    }

    // ── Moderation Layer ──────────────────────────────────────
    const moderationResult = moderateMessage(message);

    if (moderationResult.action !== MODERATION_ACTION.ALLOW) {
        try {
            await ChatViolation.create({
                threadId:   thread._id,
                senderId:   req.user.id,
                senderType: 'customer',
                vendorId:   thread.vendorId,
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

    // ── Multi-Message Evasion Check ───────────────────────────
    const recentMsgs = await VendorChatMessage.find({
        threadId: thread._id,
        senderId: req.user.id,
        createdAt: { $gte: new Date(Date.now() - 90000) }
    }).sort({ createdAt: -1 }).limit(3);

    const evasionResult = checkMultiMessageEvasion(message, recentMsgs.map(m => m.message));
    if (evasionResult.action === MODERATION_ACTION.BLOCK) {
        try {
            await ChatViolation.create({
                threadId:   thread._id,
                senderId:   req.user.id,
                senderType: 'customer',
                vendorId:   thread.vendorId,
                category:   evasionResult.category,
                action:     evasionResult.action,
                direction:  'USER_TO_VENDOR',
                reason:     evasionResult.reason,
            });
        } catch {}
        return res.status(422).json({
            success:  false,
            code:     'MESSAGE_BLOCKED',
            category: evasionResult.category,
            message:  evasionResult.userMessage,
        });
    }
    // ── End Moderation ────────────────────────────────────────

    const created = await VendorChatMessage.create({
        threadId: thread._id,
        senderType: 'customer',
        senderId: req.user.id,
        message,
    });

    thread.lastMessage = message;
    thread.lastActivity = created.createdAt;
    thread.unreadCount += 1;
    await thread.save();

    // Broadcast the message via Socket.io to the thread room
    try {
        const io = getIO();
        if (io) {
            io.to(`chat_${thread._id}`).emit('new_message', serializeMessage(created));
            // Also notify the vendor specifically in their user room
            io.to(`user_${thread.vendorId}`).emit('vendor_chat_notification', {
                threadId: thread._id,
                customerName: req.user.name || 'Customer',
                message,
            });
        }
    } catch (err) {
        console.warn('Socket broadcast failed:', err.message);
    }

    res.status(201).json(new ApiResponse(201, serializeMessage(created), 'Message sent.'));
});

export const markCustomerChatRead = asyncHandler(async (req, res) => {
    const thread = await VendorChatThread.findOne({
        _id: req.params.id,
        customerUserId: req.user.id,
    });
    if (!thread) throw new ApiError(404, 'Chat thread not found.');

    res.status(200).json(new ApiResponse(200, thread, 'Chat marked as read.'));
});

// @desc    Report a chat message or vendor
// @route   POST /api/user/chat/vendor/threads/:id/report
export const reportCustomerChatMessage = asyncHandler(async (req, res) => {
    const { messageId, reason, description } = req.body;
    if (!reason) throw new ApiError(400, 'Reason is required.');

    const thread = await VendorChatThread.findOne({
        _id: req.params.id,
        customerUserId: req.user.id,
    });
    if (!thread) throw new ApiError(404, 'Chat thread not found.');

    let messageSnippet = '';
    if (messageId) {
        const msg = await VendorChatMessage.findOne({ _id: messageId, threadId: thread._id });
        if (msg) messageSnippet = msg.message.slice(0, 200);
    }

    const report = await ChatReport.create({
        threadId: thread._id,
        messageId: messageId || null,
        messageSnippet,
        reporterId: req.user.id,
        reporterType: 'customer',
        reportedUserId: thread.vendorId,
        reportedUserType: 'vendor',
        reason,
        description: description || '',
    });

    res.status(201).json(new ApiResponse(201, report, 'Report submitted successfully.'));
});

// @desc    Block/Unblock chat thread
// @route   POST /api/user/chat/vendor/threads/:id/block
export const toggleBlockCustomerChat = asyncHandler(async (req, res) => {
    const thread = await VendorChatThread.findOne({
        _id: req.params.id,
        customerUserId: req.user.id,
    });
    if (!thread) throw new ApiError(404, 'Chat thread not found.');

    thread.isBlocked = !thread.isBlocked;
    thread.blockedBy = thread.isBlocked ? 'customer' : null;
    thread.blockReason = thread.isBlocked ? (req.body?.reason || 'Blocked by customer') : null;
    await thread.save();

    res.status(200).json(new ApiResponse(200, { isBlocked: thread.isBlocked }, thread.isBlocked ? 'Chat blocked.' : 'Chat unblocked.'));
});

// @desc    Mute/Unmute thread notifications
// @route   POST /api/user/chat/vendor/threads/:id/mute
export const toggleMuteCustomerChat = asyncHandler(async (req, res) => {
    const thread = await VendorChatThread.findOne({
        _id: req.params.id,
        customerUserId: req.user.id,
    });
    if (!thread) throw new ApiError(404, 'Chat thread not found.');

    thread.customerMuted = !thread.customerMuted;
    await thread.save();

    res.status(200).json(new ApiResponse(200, { customerMuted: thread.customerMuted }, thread.customerMuted ? 'Chat muted.' : 'Chat unmuted.'));
});
