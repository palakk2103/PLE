import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import VendorChatThread from '../../../models/VendorChatThread.model.js';
import VendorChatMessage from '../../../models/VendorChatMessage.model.js';
import Vendor from '../../../models/Vendor.model.js';
import Notification from '../../../models/Notification.model.js';
import { getIO } from '../../../config/socket.js';

const serializeMessage = (messageDoc) => ({
    id: messageDoc._id,
    sender: messageDoc.senderType,
    message: messageDoc.message,
    time: messageDoc.createdAt,
});

// Helper to get or create PLE Shop vendor
const getPLEShopVendor = async () => {
    let vendor = await Vendor.findOne({ storeName: 'PLE Shop' });
    if (!vendor) {
        vendor = await Vendor.create({
            name: 'PLE Shop',
            email: 'admin_pleshop@example.com',
            password: 'Password123!',
            storeName: 'PLE Shop',
            status: 'approved',
            isActive: true,
        });
    }
    return vendor;
};

// Helper to resolve target vendor (defaults to PLE Shop)
const getTargetVendor = async (req) => {
    const vendorId = req.query.vendorId || req.body.vendorId || req.params.vendorId;
    if (vendorId) {
        const vendor = await Vendor.findById(vendorId);
        if (vendor) return vendor;
    }
    return getPLEShopVendor();
};

export const getPLEShopThreads = asyncHandler(async (req, res) => {
    const activeVendor = await getTargetVendor(req);
    const threads = await VendorChatThread.find({ vendorId: activeVendor._id })
        .sort({ lastActivity: -1 });

    res.status(200).json(new ApiResponse(200, threads, 'PLE Shop chat threads fetched.'));
});

export const getPLEShopMessages = asyncHandler(async (req, res) => {
    let thread = await VendorChatThread.findById(req.params.id);
    if (!thread) {
        const activeVendor = await getTargetVendor(req);
        thread = await VendorChatThread.findOne({
            _id: req.params.id,
            vendorId: activeVendor._id,
        });
    }
    if (!thread) throw new ApiError(404, 'Chat thread not found.');

    const messages = await VendorChatMessage.find({ threadId: thread._id }).sort({ createdAt: 1 });

    res.status(200).json(new ApiResponse(200, messages.map(serializeMessage), 'Chat messages fetched.'));
});

export const sendPLEShopMessage = asyncHandler(async (req, res) => {
    const activeVendor = await getTargetVendor(req);
    const message = String(req.body?.message || '').trim();
    if (!message) throw new ApiError(400, 'Message is required.');

    let thread = await VendorChatThread.findById(req.params.id);
    if (!thread) {
        thread = await VendorChatThread.findOne({
            _id: req.params.id,
            vendorId: activeVendor._id,
        });
    }
    if (!thread) throw new ApiError(404, 'Chat thread not found.');

    const senderId = activeVendor?._id || thread.vendorId;

    const created = await VendorChatMessage.create({
        threadId: thread._id,
        senderType: 'vendor',
        senderId: senderId,
        message,
    });

    thread.lastMessage = message;
    thread.lastActivity = created.createdAt;
    await thread.save();

    // Create in-app notification for the customer
    if (thread.customerUserId) {
        try {
            await Notification.create({
                recipientId: thread.customerUserId,
                recipientType: 'user',
                title: `New message from ${activeVendor?.storeName || 'Store'}`,
                message: message.length > 50 ? `${message.substring(0, 50)}...` : message,
                type: 'chat',
                data: {
                    threadId: String(thread._id),
                    vendorId: String(thread.vendorId || activeVendor._id),
                },
            });
        } catch (nErr) {
            console.warn('Failed to create in-app notification:', nErr.message);
        }
    }

    // Broadcast message via Socket.io
    try {
        const io = getIO();
        if (io) {
            io.to(`chat_${thread._id}`).emit('new_message', serializeMessage(created));
            // Also notify the customer room
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

export const markPLEShopRead = asyncHandler(async (req, res) => {
    let thread = await VendorChatThread.findById(req.params.id);
    if (!thread) {
        const activeVendor = await getTargetVendor(req);
        thread = await VendorChatThread.findOne({
            _id: req.params.id,
            vendorId: activeVendor._id,
        });
    }
    if (!thread) throw new ApiError(404, 'Chat thread not found.');

    thread.unreadCount = 0;
    if (thread.status !== 'resolved') thread.status = 'active';
    await thread.save();

    res.status(200).json(new ApiResponse(200, thread, 'Chat marked as read.'));
});

// GET /api/admin/ple-shop/my-shops
export const getAdminShops = asyncHandler(async (req, res) => {
    const shops = await Vendor.find({ status: 'approved' }).sort({ storeName: 1 });
    res.status(200).json(new ApiResponse(200, shops, 'Approved vendor shops fetched successfully.'));
});
