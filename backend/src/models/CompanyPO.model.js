import mongoose from 'mongoose';

/**
 * Company PO registry record (buyer-side procurement authorization).
 *
 * NOT the same as models/PurchaseOrder.model.js, which is the vendor-facing PO that is
 * auto-generated for B2B RFQ / direct-purchase orders.
 *
 * Three independent status dimensions (spec section 9):
 *   lifecycleStatus  - draft / active / expired / revoked / closed ...
 *   usage            - derived from consumed + reserved amounts (see `usageStatus` virtual)
 *   pleReviewStatus  - PLE's own decision, kept separate from company approval
 *
 * Available balance = originalValue - consumedAmount - reservedAmount.
 * reservedAmount / consumedAmount are only ever changed by the Phase 2 reservation service
 * with atomic conditional updates; the registry API never writes them.
 */

export const PO_TYPES = ['standard', 'blanket', 'contract', 'planned', 'service', 'emergency'];
export const USAGE_POLICIES = ['single_use', 'multi_use', 'blanket'];
export const LIFECYCLE_STATUSES = [
    'draft',
    'pending_company_approval',
    'awaiting_signature',
    'active',
    'expired',
    'revoked',
    'closed',
];
export const PLE_REVIEW_STATUSES = ['not_submitted', 'pending_verification', 'accepted', 'correction_requested', 'rejected', 'on_hold'];

const documentVersionSchema = new mongoose.Schema(
    {
        version: { type: Number, required: true },
        url: { type: String, required: true },
        fileName: String,
        mimeType: String,
        size: Number,
        sha256: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    { _id: false }
);

const historySchema = new mongoose.Schema(
    {
        action: { type: String, required: true }, // e.g. PO_CREATED, PO_ACTIVATED (spec section 14)
        actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        actorRole: String,
        at: { type: Date, default: Date.now },
        note: String,
        before: mongoose.Schema.Types.Mixed,
        after: mongoose.Schema.Types.Mixed,
    },
    { _id: false }
);

const companyPOSchema = new mongoose.Schema(
    {
        companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'B2BCompany', required: true, index: true },
        plePoId: { type: String, required: true, unique: true },
        poNumber: { type: String, required: true, trim: true, maxlength: 80 },
        title: { type: String, required: true, trim: true, maxlength: 200 },
        poType: { type: String, enum: PO_TYPES, required: true },
        department: { type: String, trim: true, maxlength: 120, default: '' },
        ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

        issueDate: { type: Date, required: true },
        expiryDate: { type: Date, default: null },

        currency: { type: String, default: 'INR', uppercase: true, trim: true },
        originalValue: { type: Number, required: true, min: 0.01 },
        reservedAmount: { type: Number, default: 0, min: 0 },
        consumedAmount: { type: Number, default: 0, min: 0 },

        signatoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'POSignatory', default: null },
        usagePolicy: { type: String, enum: USAGE_POLICIES, required: true },

        allocation: {
            mode: { type: String, enum: ['company', 'departments', 'users'], default: 'company' },
            departments: { type: [String], default: [] },
            userIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        },

        purchaseScope: {
            notes: { type: String, trim: true, maxlength: 1000, default: '' },
            categories: { type: [String], default: [] },
            vendorIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' }],
        },
        // Captured from the PO document; NOT a credit facility granted by PLE.
        paymentTerms: { type: String, trim: true, maxlength: 300, default: '' },

        documents: { type: [documentVersionSchema], default: [] },

        lifecycleStatus: { type: String, enum: LIFECYCLE_STATUSES, default: 'draft', index: true },
        pleReviewStatus: { type: String, enum: PLE_REVIEW_STATUSES, default: 'not_submitted', index: true },
        activatedAt: Date,
        revokedAt: Date,
        revokeReason: String,

        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        history: { type: [historySchema], default: [] },
    },
    { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// PO number is unique within the issuing company (spec section 6).
companyPOSchema.index({ companyId: 1, poNumber: 1 }, { unique: true });
companyPOSchema.index({ companyId: 1, lifecycleStatus: 1, expiryDate: 1 });

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

companyPOSchema.virtual('availableAmount').get(function () {
    return round2(Math.max(0, (this.originalValue || 0) - (this.consumedAmount || 0) - (this.reservedAmount || 0)));
});

/** Unused / reserved / partially_used / exhausted, derived from the amounts. */
companyPOSchema.virtual('usageStatus').get(function () {
    const consumed = this.consumedAmount || 0;
    const reserved = this.reservedAmount || 0;
    if (round2(this.originalValue - consumed - reserved) <= 0) return 'exhausted';
    if (consumed > 0) return 'partially_used';
    if (reserved > 0) return 'reserved';
    return 'unused';
});

/**
 * Lifecycle with expiry applied. Expiry is derived from `expiryDate` so it never goes stale
 * and needs no cron job; the stored value is only ever 'active' until someone revokes/closes.
 */
companyPOSchema.virtual('effectiveLifecycleStatus').get(function () {
    if (this.lifecycleStatus === 'active' && this.expiryDate && this.expiryDate < new Date()) return 'expired';
    return this.lifecycleStatus;
});

const CompanyPO = mongoose.models.CompanyPO || mongoose.model('CompanyPO', companyPOSchema);
export default CompanyPO;
export { CompanyPO };
