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
import { moderateMessage, MODERATION_ACTION } from '../../../services/chatModeration.service.js';
import ChatViolation from '../../../models/ChatViolation.model.js';

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

    const threads = await VendorChatThread.find({ vendorId }).sort({ lastActivity: -1 });
    res.status(200).json(new ApiResponse(200, threads, 'Chat threads fetched.'));
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

    const thread = await VendorChatThread.findOne({
        _id: req.params.id,
        vendorId: req.user.id,
    });
    if (!thread) throw new ApiError(404, 'Chat thread not found.');

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
                io.to(`user_${thread.customerUserId}`).emit('customer_chat_notification', {
                    threadId: thread._id,
                    lastMessage: message,
                });
            }
        }
    } catch (err) {
        console.warn('Socket broadcast failed:', err.message);
    }

    res.status(201).json(new ApiResponse(201, serializeMessage(created), 'Message sent.'));
});

export const markVendorChatRead = asyncHandler(async (req, res) => {
    const thread = await VendorChatThread.findOne({
        _id: req.params.id,
        vendorId: req.user.id,
    });
    if (!thread) throw new ApiError(404, 'Chat thread not found.');

    thread.unreadCount = 0;
    if (thread.status !== 'resolved') thread.status = 'active';
    await thread.save();

    res.status(200).json(new ApiResponse(200, thread, 'Chat marked as read.'));
});

export const updateVendorChatStatus = asyncHandler(async (req, res) => {
    const status = String(req.body?.status || '').trim();
    if (!['active', 'resolved'].includes(status)) {
        throw new ApiError(400, 'Status must be active or resolved.');
    }

    const thread = await VendorChatThread.findOneAndUpdate(
        { _id: req.params.id, vendorId: req.user.id },
        { status },
        { new: true }
    );
    if (!thread) throw new ApiError(404, 'Chat thread not found.');

    res.status(200).json(new ApiResponse(200, thread, 'Chat status updated.'));
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

