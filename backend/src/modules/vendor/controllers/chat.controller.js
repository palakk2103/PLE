import mongoose from 'mongoose';
import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Order from '../../../models/Order.model.js';
import VendorChatThread from '../../../models/VendorChatThread.model.js';
import VendorChatMessage from '../../../models/VendorChatMessage.model.js';
import Notification from '../../../models/Notification.model.js';
import Vendor from '../../../models/Vendor.model.js';
import { getIO } from '../../../config/socket.js';
import { moderateMessage, checkMultiMessageEvasion, MODERATION_ACTION } from '../../../services/chatModeration.service.js';
import ChatViolation from '../../../models/ChatViolation.model.js';
import ChatReport from '../../../models/ChatReport.model.js';

const buildThreadSeedFromOrder = (order) => {
    const customerName =
        order?.shippingAddress?.name ||
        order?.guestInfo?.name ||
        'Customer';
    const customerEmail =
        order?.shippingAddress?.email ||
        order?.guestInfo?.email ||
        '';
    const customerPhone =
        order?.shippingAddress?.phone ||
        order?.guestInfo?.phone ||
        '';
    const orderDisplayId = order?.orderId || String(order?._id || '');

    return {
        orderDisplayId,
        customerUserId: order?.userId || null,
        customerName,
        customerEmail,
        customerPhone,
        status: 'active',
    };
};

const serializeMessage = (messageDoc) => ({
    id: messageDoc._id,
    sender: messageDoc.senderType,
    message: messageDoc.message,
    time: messageDoc.createdAt,
});

export const getVendorChatThreads = asyncHandler(async (req, res) => {
    const vendorId = req.user.id;

    const recentOrders = await Order.find({ 'vendorItems.vendorId': vendorId })
        .sort({ createdAt: -1 })
        .limit(100)
        .select('_id orderId userId guestInfo shippingAddress createdAt')
        .lean();

    for (const order of recentOrders) {
        const seed = buildThreadSeedFromOrder(order);
        await VendorChatThread.updateOne(
            { vendorId, orderRef: order._id },
            {
                $setOnInsert: {
                    vendorId,
                    orderRef: order._id,
                    lastMessage: 'Hello, I need help with my order',
                    lastActivity: order?.createdAt || new Date(),
                    unreadCount: 0,
                    status: 'active',
                },
                $set: {
                    orderDisplayId: seed.orderDisplayId,
                    customerUserId: seed.customerUserId,
                    customerName: seed.customerName,
                    customerEmail: seed.customerEmail,
                    customerPhone: seed.customerPhone,
                },
            },
            { upsert: true }
        );
    }

    const threads = await VendorChatThread.find({ vendorId }).sort({ lastActivity: -1 }).lean();

    // Mask customer contact details in thread listing to prevent off-platform diversion
    const sanitized = threads.map(t => {
        const threadObj = { ...t };
        if (threadObj.customerEmail) {
            const parts = String(threadObj.customerEmail).split('@');
            threadObj.customerEmail = (parts[0].slice(0, 2) || '**') + '***@' + (parts[1] || 'customer.com');
        }
        if (threadObj.customerPhone) {
            threadObj.customerPhone = '******' + String(threadObj.customerPhone).slice(-4);
        }
        return threadObj;
    });

    res.status(200).json(new ApiResponse(200, sanitized, 'Chat threads fetched.'));
});

export const getVendorChatMessages = asyncHandler(async (req, res) => {
    const thread = await VendorChatThread.findOne({
        _id: req.params.id,
        vendorId: req.user.id,
    });
    if (!thread) throw new ApiError(404, 'Chat thread not found.');

    const messages = await VendorChatMessage.find({ threadId: thread._id }).sort({ createdAt: 1 });

    if (messages.length === 0) {
        const seeded = await VendorChatMessage.create([
            {
                threadId: thread._id,
                senderType: 'customer',
                senderId: thread.customerUserId || null,
                message: thread.lastMessage || 'Hello, I need help with my order',
            },
            {
                threadId: thread._id,
                senderType: 'vendor',
                senderId: req.user.id,
                message: 'Hi! How can I help you today?',
            },
        ]);
        return res
            .status(200)
            .json(new ApiResponse(200, seeded.map(serializeMessage), 'Chat messages fetched.'));
    }

    res
        .status(200)
        .json(new ApiResponse(200, messages.map(serializeMessage), 'Chat messages fetched.'));
});

export const sendVendorChatMessage = asyncHandler(async (req, res) => {
    const message = String(req.body?.message || '').trim();
    if (!message) throw new ApiError(400, 'Message is required.');

    // 1. Account-level chat restriction check
    const vendor = await Vendor.findById(req.user.id);
    if (vendor?.chatMutedUntil && new Date(vendor.chatMutedUntil) > new Date()) {
        throw new ApiError(403, `Your chat messaging is temporarily restricted until ${new Date(vendor.chatMutedUntil).toLocaleString()}.`);
    }

    const thread = await VendorChatThread.findOne({
        _id: req.params.id,
        vendorId: req.user.id,
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
            const isAuthorizedVendor = pr.acceptedVendorId?.toString() === req.user.id;
            const isFulfilling = pr.vendorFulfillmentStatus === 'IN_PROGRESS';
            const isTerminal = ['Vendor Released', 'Expired', 'Cancelled', 'Completed', 'Rejected'].includes(pr.status);
            if (!isAuthorizedVendor || !isFulfilling || isTerminal) {
                thread.status = 'closed';
                await thread.save();
                throw new ApiError(400, 'This sourcing conversation is closed or has been reassigned.');
            }
        }
    }

    // ── Moderation Layer ──────────────────────────────────────
    const moderationResult = moderateMessage(message);

    if (moderationResult.action !== MODERATION_ACTION.ALLOW) {
        // Log the violation (no message content stored for privacy)
        try {
            await ChatViolation.create({
                threadId:   thread._id,
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
        // FLAG: log but allow through
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
                senderType: 'vendor',
                vendorId:   req.user.id,
                category:   evasionResult.category,
                action:     evasionResult.action,
                direction:  'VENDOR_TO_USER',
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
        senderType: 'vendor',
        senderId: req.user.id,
        message,
    });

    thread.lastMessage = message;
    thread.lastActivity = created.createdAt;
    await thread.save();

    // Create in-app notification for the customer
    if (thread.customerUserId) {
        try {
            const vendorObj = await Vendor.findById(req.user.id);
            const vendorName = vendorObj?.storeName || vendorObj?.name || 'Store';
            await Notification.create({
                recipientId: thread.customerUserId,
                recipientType: 'user',
                title: `New message from ${vendorName}`,
                message: message.length > 50 ? `${message.substring(0, 50)}...` : message,
                type: 'chat',
                data: {
                    threadId: String(thread._id),
                    vendorId: String(req.user.id),
                },
            });
        } catch (nErr) {
            console.warn('Failed to create in-app notification:', nErr.message);
        }
    }

    // Broadcast the message via Socket.io to the thread room
    try {
        const io = getIO();
        if (io) {
            io.to(`chat_${thread._id}`).emit('new_message', serializeMessage(created));
            // Also notify the customer in their user room
            if (thread.customerUserId) {
                const vendorObj = await Vendor.findById(req.user.id).select('storeName name');
                io.to(`user_${thread.customerUserId}`).emit('customer_chat_notification', {
                    threadId: thread._id,
                    vendorName: vendorObj?.storeName || vendorObj?.name || 'Store',
                    message,
                });
            }
        }
    } catch (err) {
        console.warn('Socket broadcast failed:', err.message);
    }

    res.status(201).json(new ApiResponse(201, serializeMessage(created), 'Message sent.'));
});

export const markVendorChatRead = asyncHandler(async (req, res) => {
    const thread = await VendorChatThread.findOneAndUpdate(
        { _id: req.params.id, vendorId: req.user.id },
        { unreadCount: 0 },
        { new: true }
    );
    if (!thread) throw new ApiError(404, 'Chat thread not found.');

    res.status(200).json(new ApiResponse(200, { unreadCount: 0 }, 'Chat marked as read.'));
});

export const updateVendorChatStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!['active', 'resolved', 'closed'].includes(status)) {
        throw new ApiError(400, 'Invalid status.');
    }

    const thread = await VendorChatThread.findOneAndUpdate(
        { _id: req.params.id, vendorId: req.user.id },
        { status },
        { new: true }
    );
    if (!thread) throw new ApiError(404, 'Chat thread not found.');

    res.status(200).json(new ApiResponse(200, thread, 'Chat status updated.'));
});

// @desc    Report a chat message or user
// @route   POST /api/vendor/chat/threads/:id/report
export const reportVendorChatMessage = asyncHandler(async (req, res) => {
    const { messageId, reason, description } = req.body;
    if (!reason) throw new ApiError(400, 'Reason is required.');

    const thread = await VendorChatThread.findOne({
        _id: req.params.id,
        vendorId: req.user.id,
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
        reporterType: 'vendor',
        reportedUserId: thread.customerUserId || thread._id,
        reportedUserType: 'customer',
        reason,
        description: description || '',
    });

    res.status(201).json(new ApiResponse(201, report, 'Report submitted successfully.'));
});

// @desc    Block/Unblock chat thread
// @route   POST /api/vendor/chat/threads/:id/block
export const toggleBlockVendorChat = asyncHandler(async (req, res) => {
    const thread = await VendorChatThread.findOne({
        _id: req.params.id,
        vendorId: req.user.id,
    });
    if (!thread) throw new ApiError(404, 'Chat thread not found.');

    thread.isBlocked = !thread.isBlocked;
    thread.blockedBy = thread.isBlocked ? 'vendor' : null;
    thread.blockReason = thread.isBlocked ? (req.body?.reason || 'Blocked by vendor') : null;
    await thread.save();

    res.status(200).json(new ApiResponse(200, { isBlocked: thread.isBlocked }, thread.isBlocked ? 'Chat blocked.' : 'Chat unblocked.'));
});

// @desc    Mute/Unmute thread notifications
// @route   POST /api/vendor/chat/threads/:id/mute
export const toggleMuteVendorChat = asyncHandler(async (req, res) => {
    const thread = await VendorChatThread.findOne({
        _id: req.params.id,
        vendorId: req.user.id,
    });
    if (!thread) throw new ApiError(404, 'Chat thread not found.');

    thread.vendorMuted = !thread.vendorMuted;
    await thread.save();

    res.status(200).json(new ApiResponse(200, { vendorMuted: thread.vendorMuted }, thread.vendorMuted ? 'Chat muted.' : 'Chat unmuted.'));
});

// @desc    Create or retrieve a chat thread linked to a ProductRequest (Vendor Window)
// @route   POST /api/vendor/product-requests/:requestId/chat/initiate
// @access  Private (Vendor)
export const initiateProductRequestChat = asyncHandler(async (req, res) => {
    const vendorId = req.user.id || req.user._id;
    const requestId = req.params.id || req.params.requestId;

    const { default: ProductRequest } = await import('../../../models/ProductRequest.model.js');
    const queryConditions = [{ requestId }];
    if (mongoose.isValidObjectId(requestId)) {
        queryConditions.push({ _id: requestId });
    }
    const request = await ProductRequest.findOne({ $or: queryConditions })
        .populate('userId', 'name email phone');

    if (!request) throw new ApiError(404, 'Product request not found.');

    // Only the accepted vendor can initiate chat
    if (String(request.acceptedVendorId) !== String(vendorId)) {
        throw new ApiError(403, 'Only the accepted vendor can initiate the chat for this request.');
    }

    const customer = request.userId;
    const customerName = customer?.name || 'Customer';
    const customerEmail = customer?.email || '';
    const customerPhone = customer?.phone || '';

    // Find or create thread for this vendor + productRequest combo
    let thread = await VendorChatThread.findOne({
        vendorId,
        productRequestRef: request._id
    });

    if (!thread) {
        thread = await VendorChatThread.create({
            vendorId,
            orderRef: null,
            orderDisplayId: '',
            productRequestRef: request._id,
            productRequestId: request.requestId,
            customerUserId: customer?._id || null,
            customerName,
            customerEmail,
            customerPhone,
            lastMessage: `Chat started for product request: ${request.productName}`,
            lastActivity: new Date(),
            status: 'active'
        });

        // Link thread back to the ProductRequest
        await ProductRequest.updateOne(
            { _id: request._id },
            { $set: { chatThreadId: thread._id } }
        );

        // Send a system welcome message
        const { VendorChatMessage } = await import('../../../models/VendorChatMessage.model.js');
        await VendorChatMessage.create({
            threadId: thread._id,
            senderType: 'system',
            senderId: null,
            message: `Chat opened for product request #${request.requestId} — "${request.productName}" (Qty: ${request.quantity}). Please discuss product specifications, pricing, and delivery details here.`
        });
    }

    res.status(200).json(new ApiResponse(200, thread, 'Product request chat thread ready.'));
});

