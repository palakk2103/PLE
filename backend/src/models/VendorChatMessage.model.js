import mongoose from 'mongoose';
import { encryptMessage, decryptMessage } from '../utils/chatEncryption.util.js';

const vendorChatMessageSchema = new mongoose.Schema(
    {
        threadId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'VendorChatThread',
            required: true,
            index: true,
        },
        senderType: {
            type: String,
            enum: ['vendor', 'customer', 'system', 'admin'],
            required: true,
        },
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
            index: true,
        },
        message: {
            type: String,
            required: true,
            trim: true,
            set: encryptMessage,
            get: decryptMessage,
        },
        // Read receipts (WhatsApp-style ticks): sent -> delivered (recipient's app has it) -> seen
        // (recipient has the conversation open). seenAt implies deliveredAt.
        deliveredAt: { type: Date, default: null },
        seenAt: { type: Date, default: null },
    },
    {
        timestamps: true,
        toJSON: { getters: true },
        toObject: { getters: true },
    }
);

vendorChatMessageSchema.index({ threadId: 1, createdAt: 1 });
// Finding what a reader has not seen / not received yet
vendorChatMessageSchema.index({ threadId: 1, senderType: 1, seenAt: 1 });

const VendorChatMessage = mongoose.models.VendorChatMessage || mongoose.model('VendorChatMessage', vendorChatMessageSchema);
export { VendorChatMessage };
export default VendorChatMessage;

