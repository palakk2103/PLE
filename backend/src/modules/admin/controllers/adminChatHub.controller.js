import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import mongoose from 'mongoose';
import VendorChatThread from '../../../models/VendorChatThread.model.js';
import VendorChatMessage from '../../../models/VendorChatMessage.model.js';
import AdminManagedVendorThread from '../../../models/AdminManagedVendorThread.model.js';
import AdminManagedVendorMessage from '../../../models/AdminManagedVendorMessage.model.js';
import Vendor from '../../../models/Vendor.model.js';
import User from '../../../models/User.model.js';
import Notification from '../../../models/Notification.model.js';
import { getIO } from '../../../config/socket.js';
import { decryptMessage, encryptMessage } from '../../../utils/chatEncryption.util.js';

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Customers of a business account (B2B) vs. ordinary consumers
const getB2BUserIds = () =>
    User.find({ $or: [{ role: { $in: ['b2bAdmin', 'b2bEmployee'] } }, { companyId: { $ne: null } }] }).distinct('_id');

// Vendors that PLE itself operates
const getManagedVendorIds = () =>
    Vendor.find({ $or: [{ storeName: 'PLE Shop' }, { isManaged: true }, { businessType: 'Home Business' }] }).distinct('_id');

// Older screens read orderNumber / totalAmount / title: keep those names filled from the real fields
const withLegacyAliases = (t) => {
    if (t.orderRef && typeof t.orderRef === 'object') {
        t.orderRef.orderNumber = t.orderRef.orderNumber || t.orderRef.orderId;
        t.orderRef.totalAmount = t.orderRef.totalAmount ?? t.orderRef.total;
    }
    if (t.productRequestRef && typeof t.productRequestRef === 'object') {
        t.productRequestRef.title = t.productRequestRef.title || t.productRequestRef.productName;
        t.productRequestRef.expectedPrice = t.productRequestRef.expectedPrice ?? t.productRequestRef.expectedBudget;
    }
    return t;
};

const serializeMessage = (messageDoc) => ({
    id: messageDoc._id,
    sender: messageDoc.senderType,
    senderId: messageDoc.senderId,
    message: decryptMessage(messageDoc.message),
    time: messageDoc.createdAt,
    createdAt: messageDoc.createdAt,
});

/**
 * Deterministically classify a VendorChatThread based on participant roles and company relations
 */
const classifyThread = (thread) => {
    const customer = thread.customerUserId;
    const vendor = thread.vendorId;

    let isB2B = false;
    let isCustomer = false;
    let companyName = null;

    if (customer) {
        if (customer.role === 'b2bAdmin' || customer.role === 'b2bEmployee' || customer.companyId) {
            isB2B = true;
            if (customer.companyId) {
                companyName = customer.companyId.companyName || customer.companyId.tradeName || null;
            }
        } else {
            isCustomer = true;
        }
    } else {
        // Fallback if user document was removed or legacy
        isCustomer = true;
    }

    const isManagedVendor = Boolean(
        vendor && (vendor.storeName === 'PLE Shop' || vendor.isManaged || vendor.businessType === 'Home Business')
    );

    let category = 'customer';
    if (isB2B) {
        category = 'b2b';
    } else if (isCustomer) {
        category = 'customer';
    }

    return {
        category,
        isB2B,
        isCustomer,
        isManagedVendor,
        companyName,
        participantRole: isB2B ? (customer?.b2bRole || 'B2B Buyer') : 'Customer',
    };
};

/**
 * GET /api/admin/chat-hub/stats
 * Get total conversation counts per category
 */
export const getAdminChatStats = asyncHandler(async (req, res) => {
    const b2bIds = await getB2BUserIds();

    const [all, b2b, unreadAgg, managedVendorThreadsCount, vendorIds] = await Promise.all([
        VendorChatThread.countDocuments({}),
        VendorChatThread.countDocuments({ customerUserId: { $in: b2bIds } }),
        VendorChatThread.aggregate([{ $group: { _id: null, unread: { $sum: '$unreadCount' } } }]),
        AdminManagedVendorThread.countDocuments({}),
        VendorChatThread.distinct('vendorId'),
    ]);

    res.status(200).json(
        new ApiResponse(
            200,
            {
                all,
                customer: all - b2b,
                b2b,
                vendor: vendorIds.length, // number of sellers with conversations (was wrongly the total thread count)
                managedVendor: managedVendorThreadsCount,
                unreadTotal: unreadAgg[0]?.unread || 0,
            },
            'Chat hub stats fetched successfully.'
        )
    );
});

/**
 * GET /api/admin/chat-hub/threads
 * Fetch conversation threads filtered by module category
 */
export const getAdminChatThreads = asyncHandler(async (req, res) => {
    const { category = 'all', vendorId, search = '', status, page = 1, limit = 50 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    // Filters are applied in the database (not in memory) so the hub stays fast as chats grow.
    const base = {};
    if (vendorId && mongoose.isValidObjectId(vendorId)) base.vendorId = vendorId;

    const term = String(search || '').trim();
    if (term) {
        const rx = new RegExp(escapeRegex(term), 'i'); // escaped: user input must never be a raw regex
        base.$or = [{ customerName: rx }, { customerEmail: rx }, { orderDisplayId: rx }, { productRequestId: rx }];
    }

    if (category === 'b2b') {
        base.customerUserId = { $in: await getB2BUserIds() };
    } else if (category === 'customer') {
        base.customerUserId = { $nin: await getB2BUserIds() };
    } else if (category === 'managed_vendor') {
        base.vendorId = { $in: await getManagedVendorIds() };
    }

    const statusFilter = { active: { $in: ['active', null] }, resolved: 'resolved', closed: 'closed' };
    const query = { ...base };
    if (status && statusFilter[status] !== undefined) query.status = statusFilter[status];

    const [rawThreads, totalCount, activeCount, resolvedCount, closedCount] = await Promise.all([
        VendorChatThread.find(query)
            .populate('vendorId', 'name storeName storeLogo email phone isVerified status isManaged businessType')
            .populate({
                path: 'customerUserId',
                select: 'name email phone avatar role b2bRole companyId',
                populate: { path: 'companyId', select: 'companyName tradeName' },
            })
            .populate('orderRef', 'orderId status total createdAt')
            .populate('productRequestRef', 'requestId productName status expectedBudget')
            .sort({ lastActivity: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        VendorChatThread.countDocuments(query),
        VendorChatThread.countDocuments({ ...base, status: { $in: ['active', null] } }),
        VendorChatThread.countDocuments({ ...base, status: 'resolved' }),
        VendorChatThread.countDocuments({ ...base, status: 'closed' }),
    ]);

    const threads = rawThreads.map((t) => withLegacyAliases({
        ...t,
        lastMessage: t.lastMessage ? decryptMessage(t.lastMessage) : '',
        classification: classifyThread(t),
    }));

    res.status(200).json(
        new ApiResponse(
            200,
            {
                threads,
                statusCounts: { all: activeCount + resolvedCount + closedCount, active: activeCount, resolved: resolvedCount, closed: closedCount },
                pagination: { total: totalCount, page: pageNum, limit: limitNum, totalPages: Math.ceil(totalCount / limitNum) },
            },
            'Admin chat threads fetched successfully.'
        )
    );
});

/**
 * GET /api/admin/chat-hub/threads/:threadId/messages
 * Fetch messages for a specific conversation
 */
export const getAdminChatMessages = asyncHandler(async (req, res) => {
    const { threadId } = req.params;

    const thread = await VendorChatThread.findById(threadId)
        .populate('vendorId', 'name storeName storeLogo email phone')
        .populate({
            path: 'customerUserId',
            select: 'name email phone avatar role b2bRole companyId',
            populate: {
                path: 'companyId',
                select: 'companyName tradeName',
            },
        })
        .populate('orderRef', 'orderId status total')
        .populate('productRequestRef', 'requestId productName status')
        .lean();

    if (!thread) {
        throw new ApiError(404, 'Chat thread not found.');
    }

    const messages = await VendorChatMessage.find({ threadId: thread._id })
        .sort({ createdAt: 1 })
        .lean();

    const threadObj = withLegacyAliases({
        ...thread,
        lastMessage: thread.lastMessage ? decryptMessage(thread.lastMessage) : '',
        classification: classifyThread(thread),
    });

    res.status(200).json(
        new ApiResponse(
            200,
            {
                thread: threadObj,
                messages: messages.map(serializeMessage),
            },
            'Messages fetched successfully.'
        )
    );
});

/**
 * POST /api/admin/chat-hub/threads/:threadId/messages
 * Send message from Admin in a conversation
 */
export const sendAdminChatMessage = asyncHandler(async (req, res) => {
    const { threadId } = req.params;
    const message = String(req.body?.message || '').trim();

    if (!message) {
        throw new ApiError(400, 'Message cannot be empty.');
    }

    const thread = await VendorChatThread.findById(threadId);
    if (!thread) {
        throw new ApiError(404, 'Chat thread not found.');
    }

    const created = await VendorChatMessage.create({
        threadId: thread._id,
        senderType: 'admin', // distinct from automated 'system' notices
        senderId: req.user.id,
        message,
    });

    thread.lastMessage = message;
    thread.lastActivity = created.createdAt;
    thread.unreadCountCustomer = (thread.unreadCountCustomer || 0) + 1;
    // A closed conversation is only re-opened when the admin explicitly asks for it.
    if (thread.status === 'closed' && req.body?.reopen === true) {
        thread.status = 'active';
        thread.closedBy = null;
    }
    await thread.save();

    const serialized = serializeMessage(created);

    // Notify participants via Socket.io
    try {
        const io = getIO();
        if (io) {
            io.to(`chat_${thread._id}`).emit('new_message', serialized);
            if (thread.customerUserId) {
                io.to(`user_${thread.customerUserId}`).emit('customer_chat_notification', {
                    threadId: thread._id,
                    lastMessage: message,
                });
            }
        }
    } catch (socketErr) {
        console.warn('Socket emit error in Admin Chat Hub:', socketErr.message);
    }

    // Create in-app notification if customer user exists
    if (thread.customerUserId) {
        try {
            await Notification.create({
                recipientId: thread.customerUserId,
                recipientType: 'user',
                title: 'New message from Support / Store',
                message: message.length > 60 ? `${message.substring(0, 60)}...` : message,
                type: 'chat',
                data: {
                    threadId: String(thread._id),
                    vendorId: String(thread.vendorId),
                },
            });
        } catch (notifErr) {
            console.warn('Failed to create in-app notification:', notifErr.message);
        }
    }

    res.status(201).json(new ApiResponse(201, serialized, 'Message sent successfully.'));
});

/**
 * PATCH /api/admin/chat-hub/threads/:threadId/read
 * Mark thread as read by Admin
 */
export const markAdminChatRead = asyncHandler(async (req, res) => {
    const { threadId } = req.params;

    const thread = await VendorChatThread.findById(threadId);
    if (!thread) {
        throw new ApiError(404, 'Chat thread not found.');
    }

    // `unreadCount` is the VENDOR's counter: an admin opening the thread must not hide the
    // vendor's unread badge. The admin only records its own last-read time.
    thread.adminLastReadAt = new Date();
    await thread.save();

    res.status(200).json(new ApiResponse(200, thread, 'Thread marked as read.'));
});
