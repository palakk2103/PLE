import mongoose from 'mongoose';

const proposalHistorySchema = new mongoose.Schema(
    {
        action: {
            type: String,
            enum: ['PROPOSED', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'SUPERSEDED', 'CONVERTED_TO_ORDER'],
            required: true,
        },
        actionBy: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },
        actionByRole: {
            type: String,
            enum: ['vendor', 'customer', 'admin', 'system'],
            required: true,
        },
        timestamp: {
            type: Date,
            default: Date.now,
        },
        note: {
            type: String,
            trim: true,
            default: '',
        },
    },
    { _id: false }
);

const chatTransactionProposalSchema = new mongoose.Schema(
    {
        proposalReference: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        threadId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'VendorChatThread',
            required: true,
            index: true,
        },
        vendorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Vendor',
            required: true,
            index: true,
        },
        customerUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            default: null,
            index: true,
        },
        productName: {
            type: String,
            required: true,
            trim: true,
        },
        productImage: {
            type: String,
            default: '',
        },
        productVariant: {
            type: String,
            trim: true,
            default: '',
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
            default: 1,
        },
        unitPrice: {
            type: Number,
            required: true,
            min: 0,
        },
        agreedAmount: {
            type: Number,
            required: true,
            min: 0,
        },
        discount: {
            type: Number,
            default: 0,
            min: 0,
        },
        tax: {
            type: Number,
            default: 0,
            min: 0,
        },
        deliveryCharge: {
            type: Number,
            default: 0,
            min: 0,
        },
        finalAmount: {
            type: Number,
            required: true,
            min: 0,
        },
        status: {
            type: String,
            enum: [
                'draft',
                'pending_customer_confirmation',
                'accepted',
                'rejected',
                'superseded',
                'cancelled',
                'converted_to_order',
            ],
            default: 'pending_customer_confirmation',
            index: true,
        },
        version: {
            type: Number,
            default: 1,
        },
        notes: {
            type: String,
            trim: true,
            default: '',
        },
        rejectionReason: {
            type: String,
            trim: true,
            default: '',
        },
        orderRef: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order',
            default: null,
            index: true,
        },
        history: [proposalHistorySchema],
    },
    {
        timestamps: true,
    }
);

// Indexes
chatTransactionProposalSchema.index({ threadId: 1, status: 1 });
chatTransactionProposalSchema.index({ vendorId: 1, createdAt: -1 });
chatTransactionProposalSchema.index({ customerUserId: 1, createdAt: -1 });

const ChatTransactionProposal =
    mongoose.models.ChatTransactionProposal ||
    mongoose.model('ChatTransactionProposal', chatTransactionProposalSchema);

export { ChatTransactionProposal };
export default ChatTransactionProposal;
