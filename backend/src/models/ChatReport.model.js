import mongoose from 'mongoose';

/**
 * ChatReport — records user or vendor reported chat violations/abuse.
 */
const chatReportSchema = new mongoose.Schema(
    {
        threadId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'VendorChatThread',
            required: false,
            index: true,
        },
        messageId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'VendorChatMessage',
            default: null,
        },
        messageSnippet: {
            type: String,
            trim: true,
            default: '',
        },
        reporterId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        reporterType: {
            type: String,
            enum: ['customer', 'vendor'],
            required: true,
        },
        reportedUserId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        reportedUserType: {
            type: String,
            enum: ['customer', 'vendor'],
            required: true,
        },
        reason: {
            type: String,
            enum: [
                'CONTACT_SHARING',
                'PAYMENT_DIVERSION',
                'SCAM_FRAUD',
                'HARASSMENT',
                'ABUSE',
                'SPAM',
                'PHISHING',
                'PROHIBITED_CONTENT',
                'OTHER',
            ],
            required: true,
            index: true,
        },
        description: {
            type: String,
            trim: true,
            default: '',
        },
        status: {
            type: String,
            enum: ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'],
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

chatReportSchema.index({ createdAt: -1 });
chatReportSchema.index({ status: 1, createdAt: -1 });

const ChatReport = mongoose.models.ChatReport || mongoose.model('ChatReport', chatReportSchema);
export { ChatReport };
export default ChatReport;
