import mongoose from 'mongoose';

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
        lastMessage: { type: String, default: '' },
        lastActivity: { type: Date, default: Date.now, index: true },
        unreadCount: { type: Number, default: 0, min: 0 },
        status: {
            type: String,
            enum: ['active', 'resolved'],
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
    },
    { timestamps: true }
);

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
