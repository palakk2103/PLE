import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, index: true },
        password: { type: String, required: true, select: false },
        phone: { type: String, trim: true },
        avatar: { type: String }, // Cloudinary URL
        role: { type: String, enum: ['customer', 'delivery', 'b2bAdmin', 'b2bEmployee'], default: 'customer' },
        gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say', ''] },
        dob: { type: String },
        
        // B2B Specific Fields
        companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'B2BCompany' },
        b2bRole: { type: String, enum: ['Admin', 'Manager', 'Staff'], default: 'Staff' },
        designation: { type: String, trim: true },
        department: { type: String, trim: true },
        address: { type: String, trim: true },
        firstName: { type: String, trim: true },
        lastName: { type: String, trim: true },
        b2bWalletBalance: { type: Number, default: 0 },
        b2bSpendingLimit: { type: Number, default: 0 },

        isVerified: { type: Boolean, default: false },
        isActive: { type: Boolean, default: true },
        loyaltyPointsBalance: { type: Number, default: 0 },
        lifetimeEarned: { type: Number, default: 0 },
        lifetimeRedeemed: { type: Number, default: 0 },
        b2cLifetimeEarned: { type: Number, default: 0 },
        b2bLifetimeEarned: { type: Number, default: 0 },
        otp: { type: String, select: false },
        otpExpiry: { type: Date, select: false },
        resetOtp: { type: String, select: false },
        resetOtpExpiry: { type: Date, select: false },
        resetOtpVerified: { type: Boolean, default: false, select: false },
        twoFactorEnabled: { type: Boolean, default: false },
        twoFactorOtp: { type: String, select: false },
        twoFactorOtpExpiry: { type: Date, select: false },
        twoFactorAttempts: { type: Number, default: 0, select: false },
        refreshTokenHash: { type: String, select: false },
        refreshTokenExpiresAt: { type: Date, select: false },
        passwordResetToken: { type: String, select: false },
        passwordResetExpiry: { type: Date, select: false },

        // FCM Tokens
        fcmTokens: {
            type: [String],
            default: []
        },
        fcmTokenMobile: {
            type: [String],
            default: []
        },

        // Chat restriction fields
        chatMutedUntil: { type: Date, default: null },
        chatRestrictionReason: { type: String, default: null }
    },
    { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.models.User || mongoose.model('User', userSchema);
export { User };
export default User;
