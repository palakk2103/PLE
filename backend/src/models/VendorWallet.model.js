import mongoose from 'mongoose';

const vendorWalletSchema = new mongoose.Schema(
    {
        vendorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Vendor',
            required: true,
            unique: true,
            index: true,
        },
        totalEarnings: {
            type: Number,
            default: 0,
            min: 0,
        }, // Total gross seller earnings accumulated (after commission)
        onHold: {
            type: Number,
            default: 0,
            min: 0,
        }, // In return / clearance window (after order delivery)
        available: {
            type: Number,
            default: 0,
            min: 0,
        }, // Cleared earnings ready for withdrawal
        reserved: {
            type: Number,
            default: 0,
            min: 0,
        }, // Locked in active withdrawal requests (pending/approved/processing)
        withdrawn: {
            type: Number,
            default: 0,
            min: 0,
        }, // Successfully paid out via manual settlement
        totalCommission: {
            type: Number,
            default: 0,
            min: 0,
        }, // Total platform commission deducted
        totalDeductions: {
            type: Number,
            default: 0,
            min: 0,
        }, // Deductions from returns, refunds, or penalties
        currency: {
            type: String,
            default: 'INR',
        },
    },
    { timestamps: true }
);

const VendorWallet = mongoose.models.VendorWallet || mongoose.model('VendorWallet', vendorWalletSchema);
export { VendorWallet };
export default VendorWallet;
