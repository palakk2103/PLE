import mongoose from 'mongoose';

// Holds a partially completed B2B registration. It never creates a B2BCompany / User,
// so a draft can never grant access to the platform.
const draftSchema = new mongoose.Schema(
    {
        email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
        status: { type: String, enum: ['Draft', 'Submitted'], default: 'Draft' },
        currentStep: { type: Number, default: 1, min: 1, max: 4 },
        completedSteps: { type: [Number], default: [] },
        data: { type: mongoose.Schema.Types.Mixed, default: {} },
        // sha256 of the opaque ownership token held by the browser that saved/resumed the draft
        tokenHash: { type: String, select: false },
        otpHash: { type: String, select: false },
        otpExpiresAt: { type: Date, select: false },
        otpAttempts: { type: Number, default: 0, select: false },
        otpSentAt: { type: Date, select: false },
        // Emailed "resume your registration" link: sha256 of a single-use token
        resumeLinkHash: { type: String, select: false },
        resumeLinkExpiresAt: { type: Date, select: false },
        resumeLinkSentAt: { type: Date, select: false },
        expiresAt: { type: Date, required: true }
    },
    { timestamps: true }
);

draftSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const B2BRegistrationDraft =
    mongoose.models.B2BRegistrationDraft || mongoose.model('B2BRegistrationDraft', draftSchema);
export default B2BRegistrationDraft;
