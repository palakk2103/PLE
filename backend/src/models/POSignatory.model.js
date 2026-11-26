import mongoose from 'mongoose';

/**
 * Authorized signatory registry (company PO management).
 * A signatory is a RECORD of who may bind the company for procurement, within what limit/scope/period.
 * It does not need a login, and authority is never inferred from a job title.
 */
const evidenceSchema = new mongoose.Schema(
    {
        url: String,
        fileName: String,
        mimeType: String,
        size: Number,
        sha256: String,
        uploadedAt: Date,
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    { _id: false }
);

const poSignatorySchema = new mongoose.Schema(
    {
        companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'B2BCompany', required: true, index: true },
        fullName: { type: String, required: true, trim: true, maxlength: 120 },
        designation: { type: String, required: true, trim: true, maxlength: 120 },
        department: { type: String, trim: true, maxlength: 120, default: '' },
        // Internal identifier only; avoid collecting more personal data than needed.
        employeeRef: { type: String, trim: true, maxlength: 60, default: '' },
        authorityBasis: {
            type: String,
            enum: ['board_resolution', 'delegation_of_authority', 'power_of_attorney', 'other'],
            required: true,
        },
        // Maximum PO value this person can authorize. null = no limit recorded (treated as unlimited).
        approvalLimit: { type: Number, min: 0, default: null },
        scope: {
            // Empty array = not restricted on that dimension.
            departments: { type: [String], default: [] },
            poTypes: { type: [String], default: [] },
        },
        effectiveFrom: { type: Date, required: true },
        effectiveTo: { type: Date, default: null },
        signatureMethod: {
            type: String,
            enum: ['wet_ink_scan', 'e_signature', 'digital_certificate'],
            default: 'wet_ink_scan',
        },
        // Wet-ink uploads are a document review, NOT cryptographic verification (see spec section 7).
        verificationStatus: {
            type: String,
            enum: ['unverified', 'pending_verification', 'verified', 'suspended', 'revoked'],
            default: 'unverified',
            index: true,
        },
        evidenceDocument: { type: evidenceSchema, default: undefined },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        history: [
            new mongoose.Schema(
                {
                    action: String,
                    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
                    actorRole: String,
                    at: { type: Date, default: Date.now },
                    note: String,
                },
                { _id: false }
            ),
        ],
    },
    { timestamps: true }
);

/** Expired is derived from the effective dates so it never goes stale. */
poSignatorySchema.methods.effectiveStatus = function (now = new Date()) {
    if (['suspended', 'revoked'].includes(this.verificationStatus)) return this.verificationStatus;
    if (this.effectiveTo && this.effectiveTo < now) return 'expired';
    return this.verificationStatus;
};

const POSignatory = mongoose.models.POSignatory || mongoose.model('POSignatory', poSignatorySchema);
export default POSignatory;
export { POSignatory };
