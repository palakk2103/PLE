import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import ManagedVendorUser from '../../../models/ManagedVendorUser.model.js';
import Vendor from '../../../models/Vendor.model.js';
import AdminManagedVendorThread from '../../../models/AdminManagedVendorThread.model.js';
import AdminManagedVendorMessage from '../../../models/AdminManagedVendorMessage.model.js';
import { getIO } from '../../../config/socket.js';
import { decryptMessage } from '../../../utils/chatEncryption.util.js';
import { createNotification } from '../../../services/notification.service.js';
import { assertTextLength, sanitizeAttachments } from '../../../utils/chatLimits.js';

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
 *
 * The inbox is SHARED: every admin sees every vendor conversation (one thread per vendor).
 * Previously the list was filtered by the logged-in admin's id, so other admins never saw a
 * vendor's messages, and every reload tried to re-create threads that already existed under a
 * different admin, which hit the unique index and returned HTTP 409.
 */
export const getAdminManagedVendorThreads = asyncHandler(async (req, res) => {
    const adminId = req.user.id;

    // Make sure every managed vendor has exactly one thread (idempotent, race-safe upsert).
    const managedVendors = await ManagedVendorUser.find({})
        .select('createdBy shopId createdAt')
        .lean();
    if (managedVendors.length) {
        const existing = new Set(
            (await AdminManagedVendorThread.find({}).select('managedVendorId').lean())
                .map((t) => String(t.managedVendorId))
        );
        const missing = managedVendors.filter((mv) => !existing.has(String(mv._id)));
        if (missing.length) {
            try {
                await AdminManagedVendorThread.bulkWrite(
                    missing.map((mv) => ({
                        updateOne: {
                            filter: { managedVendorId: mv._id },
                            update: {
                                $setOnInsert: {
                                    adminId: mv.createdBy || adminId,
                                    managedVendorId: mv._id,
                                    shopId: mv.shopId || null,
                                    lastMessage: 'Chat initialized',
                                    lastSenderType: 'admin',
                                    lastActivity: mv.createdAt || new Date(),
                                },
                            },
                            upsert: true,
                        },
                    })),
                    { ordered: false }
                );
            } catch (err) {
                // A concurrent request created the same thread first: harmless.
                if (err?.code !== 11000 && !err?.writeErrors?.every?.((e) => e.code === 11000)) throw err;
            }
        }
    }

    // All threads, any admin (shared inbox)
    const threads = await AdminManagedVendorThread.find({})
        .populate('managedVendorId', 'name username email companyName phone status shopId')
        .sort({ lastActivity: -1 })
        .lean();

    // Threads of standard (third-party) vendors: the populate above finds no ManagedVendorUser, enrich from Vendor
    const unresolved = threads.filter((t) => !t.managedVendorId || !t.managedVendorId.name);
    if (unresolved.length) {
        const ids = unresolved.map((t) => t.managedVendorId?._id || t.managedVendorId).filter(Boolean);
        const vendors = await Vendor.find({ _id: { $in: ids } }).select('name storeName email phone status').lean();
        const byId = new Map(vendors.map((v) => [String(v._id), v]));
        for (const t of unresolved) {
            const rawId = String(t.managedVendorId?._id || t.managedVendorId || '');
            const v = byId.get(rawId);
            if (v) {
                t.managedVendorId = {
                    _id: v._id,
                    name: v.storeName || v.name,
                    username: v.name,
                    email: v.email,
                    companyName: v.storeName || v.name,
                    phone: v.phone || '',
                    status: v.status || 'approved',
                };
            }
        }
    }

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
    assertTextLength(message);
    const safeAttachments = sanitizeAttachments(attachments);

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
        attachments: safeAttachments,
    });

    thread.lastMessage = message.trim();
    thread.lastSenderType = 'admin';
    thread.lastActivity = new Date();
    thread.unreadCountVendor += 1;
    await thread.save();

    const payload = serializeMessage(created);

    // Saved notification so an offline vendor still finds out
    try {
        await createNotification({
            recipientId: thread.managedVendorId, recipientType: 'vendor',
            title: 'New message from PLE Admin', message: message.trim().length > 60 ? `${message.trim().substring(0, 60)}...` : message.trim(),
            type: 'chat', data: { threadId: String(thread._id) },
        });
    } catch (nErr) {
        console.warn('Admin->vendor notification failed:', nErr.message);
    }

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
