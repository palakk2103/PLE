import mongoose from 'mongoose';

const commissionSchema = new mongoose.Schema(
    {
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
        vendorName: String,
        subtotal: { type: Number, required: true },
        commissionRate: { type: Number, required: true },
        commission: { type: Number, required: true },
        vendorEarnings: { type: Number, required: true },
        status: {
            type: String,
            enum: ['pending', 'paid', 'cancelled'],
            default: 'pending',
            index: true,
        },
        paidAt: Date,
        settlementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Settlement' },
        clearanceStatus: {
            type: String,
            enum: ['pending_delivery', 'on_hold', 'cleared', 'settled', 'cancelled', 'refunded'],
            default: 'pending_delivery',
            index: true,
        },
        deliveredAt: Date,
        clearedAt: Date,
        withdrawalId: { type: mongoose.Schema.Types.ObjectId, ref: 'WithdrawalRequest' },
        isHistorical: { type: Boolean, default: false },
    },
    { timestamps: true }
);

const Commission = mongoose.models.Commission || mongoose.model('Commission', commissionSchema);
export { Commission };
export default Commission;
