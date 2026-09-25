import mongoose from 'mongoose';

/**
 * ChatViolation — records every BLOCKED or FLAGGED chat message attempt.
 *
 * Privacy note: The actual message content is intentionally NOT stored.
 * Only metadata is persisted to support admin review and violation counting.
 */
const chatViolationSchema = new mongoose.Schema(
    {
        threadId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'VendorChatThread',
            required: false,
            index: true,
        },
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        senderType: {
            type: String,
            enum: ['vendor', 'customer'],
            required: true,
        },
        vendorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Vendor',
            required: true,
            index: true,
        },
        category: {
            type: String,
            enum: [
                'PHONE_NUMBER',
                'UPI_ID',
                'BANK_DETAILS',
                'IFSC',
                'PAYMENT_LINK',
                'EMAIL',
                'EXTERNAL_CONTACT',
                'EXTERNAL_PAYMENT',
                'EXTERNAL_URL',
                'CARD_DETAILS',
                'CREDENTIAL_PHISHING',
                'SUSPICIOUS',
                'OTHER',
            ],
            required: true,
            index: true,
        },
        action: {
            type: String,
            enum: ['BLOCK', 'FLAG'],
            required: true,
        },
        direction: {
            type: String,
            enum: ['USER_TO_VENDOR', 'VENDOR_TO_USER'],
            required: true,
        },
        // Internal reason for debugging — never exposed to users/vendors
        reason: {
            type: String,
            trim: true,
        },
        // Admin Moderation / Review Fields
        status: {
            type: String,
            enum: ['OPEN', 'RESOLVED', 'DISMISSED'],
            default: 'OPEN',
            index: true,
        },
        actionTaken: {
            type: String,
            enum: ['NONE', 'WARNED', 'MUTED', 'RESTRICTED', 'DISMISSED', 'RESOLVED'],
            default: 'NONE',
        },
        adminNotes: {
            type: String,
            trim: true,
            default: '',
        },
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
            default: null,
        },
        reviewedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

// Indexes for admin dashboard queries
chatViolationSchema.index({ createdAt: -1 });
chatViolationSchema.index({ vendorId: 1, createdAt: -1 });
chatViolationSchema.index({ senderId: 1, threadId: 1 });

const ChatViolation = mongoose.models.ChatViolation || mongoose.model('ChatViolation', chatViolationSchema);
export { ChatViolation };
export default ChatViolation;
