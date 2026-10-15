import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import VendorChatThread from '../../../models/VendorChatThread.model.js';
import VendorChatMessage from '../../../models/VendorChatMessage.model.js';
import AdminManagedVendorThread from '../../../models/AdminManagedVendorThread.model.js';
import AdminManagedVendorMessage from '../../../models/AdminManagedVendorMessage.model.js';
import Vendor from '../../../models/Vendor.model.js';
import User from '../../../models/User.model.js';
import Notification from '../../../models/Notification.model.js';
import { getIO } from '../../../config/socket.js';
import { decryptMessage, encryptMessage } from '../../../utils/chatEncryption.util.js';

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
    const threads = await VendorChatThread.find({})
        .populate({
            path: 'customerUserId',
            select: 'role companyId',
        })
        .select('unreadCount customerUserId status')
        .lean();

    let total = threads.length;
    let customerCount = 0;
    let b2bCount = 0;
    let unreadTotal = 0;

    threads.forEach((t) => {
        unreadTotal += (t.unreadCount || 0);
        const c = t.customerUserId;
        if (c && (c.role === 'b2bAdmin' || c.role === 'b2bEmployee' || c.companyId)) {
            b2bCount++;
        } else {
            customerCount++;
        }
    });

    const managedVendorThreadsCount = await AdminManagedVendorThread.countDocuments({});

    res.status(200).json(
        new ApiResponse(
            200,
            {
                all: total,
                customer: customerCount,
                b2b: b2bCount,
                vendor: total,
                managedVendor: managedVendorThreadsCount,
                unreadTotal,
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
    const {
        category = 'all',
        vendorId,
        search = '',
        status,
        page = 1,
        limit = 50,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    // Base query for VendorChatThread
    const query = {};

    if (vendorId) {
        query.vendorId = vendorId;
    }

    if (status && ['active', 'resolved', 'closed'].includes(status)) {
        query.status = status;
    }

    // If searching text
    if (search && String(search).trim()) {
        const searchRegex = new RegExp(String(search).trim(), 'i');
        query.$or = [
            { customerName: searchRegex },
            { customerEmail: searchRegex },
            { orderDisplayId: searchRegex },
            { productRequestId: searchRegex },
        ];
    }

    // Query threads with populated participant relationships
    const rawThreads = await VendorChatThread.find(query)
        .populate('vendorId', 'name storeName storeLogo email phone isVerified status')
        .populate({
            path: 'customerUserId',
            select: 'name email phone avatar role b2bRole companyId',
            populate: {
                path: 'companyId',
                select: 'companyName tradeName',
            },
        })
        .populate('orderRef', 'orderNumber status totalAmount createdAt')
        .populate('productRequestRef', 'requestId title status expectedPrice')
        .sort({ lastActivity: -1 })
        .lean();

    // Map and enrich each thread with its deterministic classification
    const enrichedThreads = rawThreads.map((t) => {
        const classification = classifyThread(t);
        return {
            ...t,
            lastMessage: t.lastMessage ? decryptMessage(t.lastMessage) : '',
            classification,
        };
    });

    // Apply Server-side category filter based on participant roles
    let categoryFiltered = enrichedThreads;
    if (category === 'customer') {
        categoryFiltered = enrichedThreads.filter((t) => t.classification.isCustomer && !t.classification.isB2B);
    } else if (category === 'b2b') {
        categoryFiltered = enrichedThreads.filter((t) => t.classification.isB2B);
    } else if (category === 'managed_vendor') {
        categoryFiltered = enrichedThreads.filter((t) => t.classification.isManagedVendor);
    }

    // Calculate status counts for this category
    const statusCounts = {
        all: categoryFiltered.length,
        active: categoryFiltered.filter((t) => t.status === 'active' || !t.status).length,
        resolved: categoryFiltered.filter((t) => t.status === 'resolved').length,
    };

    // Apply status filter
    let finalThreads = categoryFiltered;
    if (status && status !== 'all') {
        if (status === 'active') {
            finalThreads = categoryFiltered.filter((t) => t.status === 'active' || !t.status);
        } else if (status === 'resolved') {
            finalThreads = categoryFiltered.filter((t) => t.status === 'resolved');
        } else if (status === 'closed') {
            finalThreads = categoryFiltered.filter((t) => t.status === 'closed');
        }
    }

    const totalCount = finalThreads.length;
    const paginatedThreads = finalThreads.slice(skip, skip + limitNum);

    res.status(200).json(
        new ApiResponse(
            200,
            {
                threads: paginatedThreads,
                statusCounts,
                pagination: {
                    total: totalCount,
                    page: pageNum,
                    limit: limitNum,
                    totalPages: Math.ceil(totalCount / limitNum),
                },
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
        .populate('orderRef', 'orderNumber status totalAmount')
        .populate('productRequestRef', 'requestId title status')
        .lean();

    if (!thread) {
        throw new ApiError(404, 'Chat thread not found.');
    }

    const messages = await VendorChatMessage.find({ threadId: thread._id })
        .sort({ createdAt: 1 })
        .lean();

    const threadObj = {
        ...thread,
        lastMessage: thread.lastMessage ? decryptMessage(thread.lastMessage) : '',
        classification: classifyThread(thread),
    };

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
        senderType: 'system', // or system / admin
        senderId: req.user.id,
        message,
    });

    thread.lastMessage = message;
    thread.lastActivity = created.createdAt;
    if (thread.status === 'closed') {
        thread.status = 'active';
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

    thread.unreadCount = 0;
    await thread.save();

    res.status(200).json(new ApiResponse(200, thread, 'Thread marked as read.'));
});
