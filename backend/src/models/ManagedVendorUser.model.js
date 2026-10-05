import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const managedVendorUserSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        phone: { type: String, trim: true },
        username: { type: String, required: true, unique: true, lowercase: true, index: true, trim: true },
        password: { type: String, required: true, select: false },
        changePasswordOtp: { type: String, select: false },
        changePasswordOtpExpiry: { type: Date, select: false },
        pendingNewPassword: { type: String, select: false },
        role: { type: String, default: 'managed_vendor' },
        status: { type: String, enum: ['active', 'inactive'], default: 'active' },
        shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'ManagedShop', required: true, index: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
        companyName: { type: String, trim: true },
        gstNumber: { type: String, trim: true },
        address: { type: String, trim: true },
        email: { type: String, lowercase: true, trim: true },
        twoFactorEnabled: { type: Boolean, default: false },
        twoFactorOtp: { type: String, select: false },
        twoFactorOtpExpiry: { type: Date, select: false },
        twoFactorAttempts: { type: Number, default: 0, select: false },
        loginAttempts: { type: Number, default: 0, select: false },
        lockUntil: { type: Date, default: null, select: false },
        refreshTokenHash: { type: String, select: false },
        refreshTokenExpiresAt: { type: Date, select: false }
    },
    { timestamps: true }
);

// Hash password before saving
managedVendorUserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Compare password
managedVendorUserSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

const ManagedVendorUser = mongoose.models.ManagedVendorUser || mongoose.model('ManagedVendorUser', managedVendorUserSchema);
export { ManagedVendorUser };
export default ManagedVendorUser;
