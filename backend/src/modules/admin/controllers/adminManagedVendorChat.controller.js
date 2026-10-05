import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import ManagedVendorUser from '../../../models/ManagedVendorUser.model.js';
import Vendor from '../../../models/Vendor.model.js';
import AdminManagedVendorThread from '../../../models/AdminManagedVendorThread.model.js';
import AdminManagedVendorMessage from '../../../models/AdminManagedVendorMessage.model.js';
import { getIO } from '../../../config/socket.js';
import { decryptMessage } from '../../../utils/chatEncryption.util.js';

const serializeMessage = (msg) => ({
    id: msg._id,
    threadId: msg.threadId,
    senderType: msg.senderType,
    senderId: msg.senderId,
    senderName: msg.senderName,
    message: decryptMessage(msg.message),
    attachments: msg.attachments || [],
    isRead: msg.isRead,
    createdAt: msg.createdAt,
});


/**
 * Get all managed vendor threads for Admin, plus any managed vendors without an existing thread.
 */
export const getAdminManagedVendorThreads = asyncHandler(async (req, res) => {
    const adminId = req.user.id;

    // Fetch existing threads
    const threads = await AdminManagedVendorThread.find({ adminId })
        .populate('managedVendorId', 'name username email companyName phone status shopId')
        .sort({ lastActivity: -1 })
        .lean();

    // Enrich any threads where managedVendorId belongs to standard Vendor model
    for (const t of threads) {
        if (!t.managedVendorId || !t.managedVendorId.name) {
            const rawId = t.managedVendorId?._id || t.managedVendorId;
            if (rawId) {
                const v = await Vendor.findById(rawId).select('name storeName email phone status').lean();
                if (v) {
                    t.managedVendorId = {
                        _id: v._id,
                        name: v.storeName || v.name,
                        username: v.name,
                        email: v.email,
                        companyName: v.storeName || v.name,
                        phone: v.phone || '',
                        status: v.status || 'approved'
                    };
                }
            }
        }
    }

    // Fetch all active managed vendors created by this admin or in system
    const managedVendors = await ManagedVendorUser.find({})
        .select('name username email companyName phone status shopId createdBy')
        .lean();

    const existingVendorIds = new Set(threads.map((t) => String(t.managedVendorId?._id || t.managedVendorId)));

    // For any vendor without thread, automatically seed/ensure thread exists or provide in list
    const unseededVendors = managedVendors.filter((mv) => !existingVendorIds.has(String(mv._id)));

    for (const vendor of unseededVendors) {
        const newThread = await AdminManagedVendorThread.create({
            adminId: vendor.createdBy || adminId,
            managedVendorId: vendor._id,
            shopId: vendor.shopId || null,
            lastMessage: 'Chat initialized',
            lastSenderType: 'admin',
            lastActivity: vendor.createdAt || new Date(),
        });
        const populatedThread = await AdminManagedVendorThread.findById(newThread._id)
            .populate('managedVendorId', 'name username email companyName phone status shopId')
            .lean();
        threads.push(populatedThread);
    }

    // Sort by lastActivity desc
    threads.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));

    threads.forEach((t) => {
        if (t.lastMessage) {
            t.lastMessage = decryptMessage(t.lastMessage);
        }
    });

    res.status(200).json(new ApiResponse(200, threads, 'Managed vendor chat threads fetched successfully.'));
});

/**
 * Initiate or get thread for a specific managed vendor ID
 */
export const initiateOrGetThread = asyncHandler(async (req, res) => {
    const adminId = req.user.id;
    const { managedVendorId } = req.body;

    if (!managedVendorId) {
        throw new ApiError(400, 'managedVendorId is required');
    }

    let vendor = await ManagedVendorUser.findById(managedVendorId).lean();
    if (!vendor) {
        vendor = await Vendor.findById(managedVendorId).lean();
        if (vendor) {
            vendor.companyName = vendor.storeName || vendor.name;
        }
    }
    if (!vendor) {
        throw new ApiError(404, 'Vendor not found.');
    }

    let thread = await AdminManagedVendorThread.findOne({
        managedVendorId,
    }).populate('managedVendorId', 'name username email companyName phone status shopId');

    if (!thread) {
        thread = await AdminManagedVendorThread.create({
            adminId,
            managedVendorId,
            shopId: vendor.shopId || null,
            lastMessage: 'Chat started',
            lastSenderType: 'admin',
            lastActivity: new Date(),
        });
        thread = await AdminManagedVendorThread.findById(thread._id).populate(
            'managedVendorId',
            'name username email companyName phone status shopId'
        );
    }

    const threadObj = thread.toObject ? thread.toObject({ getters: true }) : { ...thread };
    if (threadObj.lastMessage) {
        threadObj.lastMessage = decryptMessage(threadObj.lastMessage);
    }

    res.status(200).json(new ApiResponse(200, threadObj, 'Thread retrieved successfully.'));
});


/**
 * Get messages of a specific thread
 */
export const getAdminManagedVendorMessages = asyncHandler(async (req, res) => {
    const { threadId } = req.params;

    const thread = await AdminManagedVendorThread.findById(threadId);
    if (!thread) {
        throw new ApiError(404, 'Chat thread not found.');
    }

    // Reset unread count for Admin
    thread.unreadCountAdmin = 0;
    await thread.save();

    const messages = await AdminManagedVendorMessage.find({ threadId })
        .sort({ createdAt: 1 })
        .lean();

    res.status(200).json(
        new ApiResponse(200, messages.map(serializeMessage), 'Messages fetched successfully.')
    );
});

/**
 * Send message from Admin to Managed Vendor
 */
export const sendAdminManagedVendorMessage = asyncHandler(async (req, res) => {
    const adminId = req.user.id;
    const { threadId } = req.params;
    const { message, attachments } = req.body;

    if (!message || !message.trim()) {
        throw new ApiError(400, 'Message body cannot be empty.');
    }

    const thread = await AdminManagedVendorThread.findById(threadId);
    if (!thread) {
        throw new ApiError(404, 'Chat thread not found.');
    }

    const created = await AdminManagedVendorMessage.create({
        threadId: thread._id,
        senderType: 'admin',
        senderId: adminId,
        senderName: req.user.name || 'Admin',
        message: message.trim(),
        attachments: attachments || [],
    });

    thread.lastMessage = message.trim();
    thread.lastSenderType = 'admin';
    thread.lastActivity = new Date();
    thread.unreadCountVendor += 1;
    await thread.save();

    const payload = serializeMessage(created);

    try {
        const io = getIO();
        // Emit to chat room
        io.to(`chat_${thread._id}`).emit('new_admin_managed_vendor_message', payload);
        // Emit notification to vendor's room
        io.to(`user_${thread.managedVendorId}`).emit('managed_vendor_chat_notification', {
            threadId: thread._id,
            senderName: 'Admin',
            message: message.trim(),
            createdAt: created.createdAt,
        });
    } catch (err) {
        console.error('Socket notification error:', err.message);
    }

    res.status(201).json(new ApiResponse(201, payload, 'Message sent successfully.'));
});

/**
 * Mark thread as read by Admin
 */
export const markAdminManagedVendorThreadRead = asyncHandler(async (req, res) => {
    const { threadId } = req.params;

    const thread = await AdminManagedVendorThread.findById(threadId);
    if (!thread) {
        throw new ApiError(404, 'Thread not found.');
    }

    thread.unreadCountAdmin = 0;
    await thread.save();

    await AdminManagedVendorMessage.updateMany(
        { threadId: thread._id, senderType: 'managed_vendor', isRead: false },
        { $set: { isRead: true } }
    );

    res.status(200).json(new ApiResponse(200, { threadId }, 'Thread marked as read.'));
});
