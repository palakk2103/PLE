import VendorChatMessage from '../models/VendorChatMessage.model.js';
import { getIO } from '../config/socket.js';

/**
 * Delivery / seen receipts for customer <-> seller chats (WhatsApp-style ticks).
 *
 *   sent       one grey tick   - saved on the server
 *   delivered  two grey ticks  - the recipient's app has it (they were online when it was sent,
 *                                or they fetched their chats afterwards)
 *   seen       two blue ticks  - the recipient has the conversation open / opened it
 *
 * The customer's reading covers messages from the seller and from PLE support; the seller's
 * reading covers the customer's messages only. Admins observing a chat never mark anything.
 * System notices carry no ticks.
 */

// Admin messages are addressed to the customer, so only the customer's reading counts for them.
const COUNTERPART_SENDERS = {
    customer: ['vendor', 'admin'],
    vendor: ['customer'],
};

export const messageStatus = (m) => (m?.seenAt ? 'seen' : m?.deliveredAt ? 'delivered' : 'sent');

/** Fields every chat message API returns, so all screens can draw the ticks. */
export const receiptFields = (m) => ({
    deliveredAt: m?.deliveredAt || null,
    seenAt: m?.seenAt || null,
    status: messageStatus(m),
});

const safeIO = () => {
    try { return getIO(); } catch { return null; }
};

/** Is this user connected right now (anywhere in the app, or with this chat open)? */
const isOnline = async (io, userId, threadId) => {
    if (!io || !userId) return false;
    const id = String(userId);
    for (const room of [`chat_${threadId}`, `user_${id}`]) {
        try {
            const sockets = await io.in(room).fetchSockets();
            if (sockets.some((s) => String(s.data?.user?.id || '') === id)) return true;
        } catch { /* presence is best-effort */ }
    }
    return false;
};

/**
 * Called right after a message is created: if the recipient is online, it is delivered at once.
 * Mutates and returns `message`.
 */
export const stampDeliveryOnSend = async (message, { thread, recipientId }) => {
    const io = safeIO();
    if (!(await isOnline(io, recipientId, thread._id))) return message;
    const now = new Date();
    await VendorChatMessage.updateOne({ _id: message._id, deliveredAt: null }, { $set: { deliveredAt: now } });
    message.deliveredAt = now;
    return message;
};

const emitReceipt = (event, thread, payload) => {
    const io = safeIO();
    if (!io) return;
    try {
        const rooms = [`chat_${thread._id}`];
        // The sender may be on a list screen rather than inside the chat: reach their personal room too
        if (payload.by === 'customer' && thread.vendorId) rooms.push(`user_${thread.vendorId}`);
        if (payload.by === 'vendor' && thread.customerUserId) rooms.push(`user_${thread.customerUserId}`);
        io.to(rooms).emit(event, { threadId: String(thread._id), ...payload });
    } catch (err) {
        console.warn(`[ChatReceipts] ${event} emit failed:`, err.message);
    }
};

/**
 * The reader's app fetched these threads: everything addressed to them becomes "delivered".
 * threads: array of thread docs/objects ({ _id, vendorId, customerUserId }).
 */
export const markDeliveredFor = async (threads, readerSide) => {
    const ids = (threads || []).map((t) => t._id).filter(Boolean);
    if (!ids.length) return 0;
    const now = new Date();
    const res = await VendorChatMessage.updateMany(
        { threadId: { $in: ids }, senderType: { $in: COUNTERPART_SENDERS[readerSide] }, deliveredAt: null },
        { $set: { deliveredAt: now } }
    );
    if (res.modifiedCount > 0) for (const t of threads) emitReceipt('messages_delivered', t, { by: readerSide, at: now });
    return res.modifiedCount || 0;
};

/**
 * The reader has the conversation open: everything addressed to them becomes "seen" (and
 * "delivered" if it somehow was not yet).
 */
export const markSeenFor = async (thread, readerSide) => {
    const now = new Date();
    const filter = { threadId: thread._id, senderType: { $in: COUNTERPART_SENDERS[readerSide] }, seenAt: null };
    await VendorChatMessage.updateMany({ ...filter, deliveredAt: null }, { $set: { deliveredAt: now } });
    const res = await VendorChatMessage.updateMany(filter, { $set: { seenAt: now } });
    if (res.modifiedCount > 0) emitReceipt('messages_seen', thread, { by: readerSide, at: now });
    return res.modifiedCount || 0;
};
