import mongoose from 'mongoose';
import { encryptMessage, decryptMessage } from '../utils/chatEncryption.util.js';

const vendorChatThreadSchema = new mongoose.Schema(
    {
        vendorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Vendor',
            required: true,
            index: true,
        },
        orderRef: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order',
            required: false,
            default: null,
            index: true,
        },
        orderDisplayId: { type: String, trim: true },
        customerUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
            index: true,
        },
        customerName: { type: String, default: 'Customer' },
        customerEmail: { type: String, default: '' },
        customerPhone: { type: String, default: '' },
        lastMessage: {
            type: String,
            default: '',
            set: encryptMessage,
            get: decryptMessage,
        },
        lastActivity: { type: Date, default: Date.now, index: true },
        // Conversation window: startedAt is set on creation, endedAt when the chat is resolved /
        // closed / released (cleared again if it is re-opened). See the pre-save hook below.
        startedAt: { type: Date, default: null },
        endedAt: { type: Date, default: null },
        // "Enquire Now" chats are about one product
        productRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null, index: true },
        productName: { type: String, default: '' },
        productImage: { type: String, default: '' },
        unreadCount: { type: Number, default: 0, min: 0 },          // unread for the VENDOR
        unreadCountCustomer: { type: Number, default: 0, min: 0 },  // unread for the CUSTOMER
        adminLastReadAt: { type: Date, default: null },
        closedBy: { type: String, enum: ['customer', 'vendor', 'admin', null], default: null },
        status: {
            type: String,
            enum: ['active', 'resolved', 'closed'],
            default: 'active',
            index: true,
        },
        // Optional: link thread to a ProductRequest (Vendor Window chat)
        productRequestRef: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ProductRequest',
            default: null,
            index: true,
        },
        productRequestId: { type: String, default: '' }, // requestId string for display
        archivedProductRequestRef: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ProductRequest',
            default: null,
            index: true,
        },
        isReleased: { type: Boolean, default: false, index: true },
        hiddenForVendor: { type: Boolean, default: false, index: true },
        // Communication Control fields
        isBlocked: { type: Boolean, default: false, index: true },
        blockedBy: { type: String, enum: ['customer', 'vendor', 'admin', null], default: null },
        blockReason: { type: String, default: null },
        customerMuted: { type: Boolean, default: false },
        vendorMuted: { type: Boolean, default: false },
        // Active transaction proposal in this chat thread
        activeProposalId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ChatTransactionProposal',
            default: null,
            index: true,
        },
    },
    {
        timestamps: true,
        toJSON: { getters: true },
        toObject: { getters: true },
    }
);


// Keep startedAt / endedAt right no matter which code path changes the thread.
vendorChatThreadSchema.pre('save', function (next) {
    if (this.isNew && !this.startedAt) this.startedAt = new Date();
    if (this.isNew || this.isModified('status') || this.isModified('isReleased')) {
        const ended = this.isReleased === true || ['resolved', 'closed'].includes(this.status);
        if (ended && !this.endedAt) this.endedAt = new Date();
        if (!ended && this.endedAt) this.endedAt = null;
    }
    next();
});

vendorChatThreadSchema.index(
    { vendorId: 1, customerUserId: 1, orderRef: 1 }, 
    { unique: true, partialFilterExpression: { orderRef: { $type: "objectId" } } }
);

vendorChatThreadSchema.index(
    { vendorId: 1, productRequestRef: 1 }, 
    { unique: true, partialFilterExpression: { productRequestRef: { $type: "objectId" } } }
);

const VendorChatThread = mongoose.models.VendorChatThread || mongoose.model('VendorChatThread', vendorChatThreadSchema);
export { VendorChatThread };
export default VendorChatThread;
