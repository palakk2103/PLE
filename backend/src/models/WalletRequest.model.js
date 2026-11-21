import mongoose from 'mongoose';

/**
 * A B2B employee asking their company admin for wallet funds.
 * pending -> approved (funds transferred from the admin wallet) | rejected | cancelled (by employee)
 */
const walletRequestSchema = new mongoose.Schema(
    {
        requestNumber: { type: String, required: true, unique: true },
        companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'B2BCompany', required: true, index: true },
        employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        amount: { type: Number, required: true, min: 1 },
        reason: { type: String, required: true, trim: true, maxlength: 500 },
        status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending', index: true },
        approvedAmount: { type: Number, min: 0 },
        decisionNote: { type: String, trim: true, maxlength: 500 },
        decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        decidedAt: { type: Date },
        walletTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'WalletTransaction' },
        employeeBalanceAfter: { type: Number },
    },
    { timestamps: true }
);

walletRequestSchema.index({ companyId: 1, status: 1, createdAt: -1 });
walletRequestSchema.index({ employeeId: 1, createdAt: -1 });

const WalletRequest = mongoose.models.WalletRequest || mongoose.model('WalletRequest', walletRequestSchema);
export { WalletRequest };
export default WalletRequest;
