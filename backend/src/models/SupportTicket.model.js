import mongoose from 'mongoose';
import { encryptMessage, decryptMessage } from '../utils/chatEncryption.util.js';

const supportTicketSchema = new mongoose.Schema(
    {
        ticketNumber: { type: String, unique: true, sparse: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', index: true },
        ticketTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'TicketType' },
        category: { type: String, default: 'General' },
        subject: { type: String, required: true },
        description: { type: String, default: '' },
        screenshot: { type: String, default: null },
        status: {
            type: String,
            enum: ['open', 'in_progress', 'waiting_for_user', 'resolved', 'closed'],
            default: 'open',
            index: true,
        },
        priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
        messages: [
            {
                senderId: { type: mongoose.Schema.Types.ObjectId },
                senderType: { type: String, enum: ['user', 'vendor', 'admin'], default: 'user' },
                message: {
                    type: String,
                    default: '',
                    set: encryptMessage,
                    get: decryptMessage,
                },
                attachments: [String],
                attachment: { type: String, default: null },
                createdAt: { type: Date, default: Date.now },
            },
        ],
        timeline: [
            {
                status: String,
                changedAt: { type: Date, default: Date.now },
                note: String,
            },
        ],
    },
    {
        timestamps: true,
        toJSON: { getters: true },
        toObject: { getters: true },
    }
);


const SupportTicket = mongoose.models.SupportTicket || mongoose.model('SupportTicket', supportTicketSchema);
export { SupportTicket };
export default SupportTicket;

