import mongoose from 'mongoose';
import { encryptMessage, decryptMessage } from '../utils/chatEncryption.util.js';

const adminManagedVendorMessageSchema = new mongoose.Schema(
    {
        threadId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'AdminManagedVendorThread',
            required: true,
            index: true,
        },
        senderType: {
            type: String,
            enum: ['admin', 'managed_vendor'],
            required: true,
        },
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        senderName: {
            type: String,
            default: '',
        },
        message: {
            type: String,
            required: true,
            trim: true,
            set: encryptMessage,
            get: decryptMessage,
        },
        attachments: [{ type: String }],
        isRead: { type: Boolean, default: false },
    },
    {
        timestamps: true,
        toJSON: { getters: true },
        toObject: { getters: true },
    }
);

adminManagedVendorMessageSchema.index({ threadId: 1, createdAt: 1 });

const AdminManagedVendorMessage = mongoose.models.AdminManagedVendorMessage || mongoose.model('AdminManagedVendorMessage', adminManagedVendorMessageSchema);
export { AdminManagedVendorMessage };
export default AdminManagedVendorMessage;

