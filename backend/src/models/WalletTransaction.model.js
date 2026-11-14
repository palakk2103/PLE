import mongoose from 'mongoose';
import { companyScopePlugin } from '../utils/companyScope.js';

const transactionSchema = new mongoose.Schema({
  walletId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Wallet', 
    required: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  type: { 
    type: String, 
    enum: ['credit', 'debit'], 
    required: true 
  },
  transactionCategory: {
    type: String,
    enum: ['refund', 'order_payment', 'cashback', 'admin_credit', 'admin_debit', 'recharge', 'referral_reward', 'transfer_in', 'transfer_out', 'withdrawal', 'b2b_allotment'],
    required: true,
    default: 'recharge'
  },
  amount: { 
    type: Number, 
    required: true 
  },
  balanceAfterTransaction: {
    type: Number,
    required: true,
    default: 0
  },
  // B2B company of the wallet owner (auto-filled from userId)
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'B2BCompany',
    index: true,
    default: null
  },
  // Who initiated the transaction (e.g. the B2B admin who allotted funds)
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  returnRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ReturnRequest'
  },
  idempotencyKey: {
    type: String,
    sparse: true
  },
  description: { 
    type: String, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'completed', 'failed'], 
    default: 'completed' 
  },
  // Used for withdrawals
  bankDetails: {
    bankName: String,
    accountNumber: String,
    ifscCode: String
  }
}, { timestamps: true });

transactionSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ companyId: 1, createdAt: -1 });
transactionSchema.plugin(companyScopePlugin);

export default mongoose.models.WalletTransaction || mongoose.model('WalletTransaction', transactionSchema);
