import mongoose from 'mongoose';

const settlementSchema = new mongoose.Schema(
    {
        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
        commissionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Commission' }],
        withdrawalId: { type: mongoose.Schema.Types.ObjectId, ref: 'WithdrawalRequest', index: true },
        amount: { type: Number, required: true },
        netPaidAmount: { type: Number },
        paymentMethod: { type: String, enum: ['bank_transfer', 'wallet', 'upi', 'neft', 'imps', 'rtgs', 'other'], default: 'bank_transfer' },
        transactionId: String,
        utr: { type: String, sparse: true, index: true },
        notes: String,
        bankDetailsSnapshot: { type: mongoose.Schema.Types.Mixed },
        adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
        paidAt: { type: Date },
        status: { type: String, enum: ['completed', 'failed'], default: 'completed' },
    },
    { timestamps: true }
);

const Settlement = mongoose.models.Settlement || mongoose.model('Settlement', settlementSchema);
export { Settlement };
export default Settlement;
