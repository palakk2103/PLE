import mongoose from 'mongoose';

const emailLogSchema = new mongoose.Schema(
    {
        recipient: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            index: true,
        },
        recipientType: {
            type: String,
            enum: ['customer', 'vendor', 'admin', 'internal', 'user', 'other'],
            default: 'customer',
        },
        subject: {
            type: String,
            required: true,
            trim: true,
        },
        template: {
            type: String,
            default: 'generic',
            trim: true,
        },
        status: {
            type: String,
            enum: ['pending', 'sent', 'failed', 'skipped'],
            default: 'pending',
            index: true,
        },
        errorMessage: {
            type: String,
            default: null,
        },
        attempts: {
            type: Number,
            default: 1,
        },
        messageId: {
            type: String,
            default: null,
        },
        idempotencyKey: {
            type: String,
            unique: true,
            sparse: true,
            index: true,
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        sentAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

emailLogSchema.index({ recipient: 1, createdAt: -1 });
emailLogSchema.index({ status: 1, createdAt: -1 });

const EmailLog = mongoose.models.EmailLog || mongoose.model('EmailLog', emailLogSchema);
export default EmailLog;
