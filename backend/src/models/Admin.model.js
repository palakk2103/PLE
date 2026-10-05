import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const adminSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true },
        password: { type: String, required: true, select: false },
        role: { type: String, enum: ['admin', 'superadmin', 'account_team'], default: 'admin' },
        avatar: { type: String },
        isActive: { type: Boolean, default: true },
        // Organizational Identity fields
        identityId: { type: String, unique: true, sparse: true, trim: true, uppercase: true },
        identityClass: { type: String, enum: ['employee', 'director', 'consultant', 'intern'], default: 'employee' },
        personalSecretHash: { type: String, select: false },
        phone: { type: String, trim: true },
        department: { type: String, trim: true },
        designation: { type: String, trim: true },
        contractType: { type: String, enum: ['Full-Time', 'Part-Time', 'Contract', 'Internship', 'full_time', 'part_time', 'contract', 'internship'], default: 'Full-Time' },
        joiningDate: { type: Date },
        userType: { type: String, enum: ['superadmin', 'admin', 'account_team'], default: 'account_team' },
        status: { type: String, enum: ['active', 'inactive'], default: 'active' },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
        lastLoginAt: { type: Date },
        lastLogoutAt: { type: Date },
        lastActivityAt: { type: Date },
        twoFactorEnabled: { type: Boolean, default: false },
        twoFactorOtp: { type: String, select: false },
        twoFactorOtpExpiry: { type: Date, select: false },
        twoFactorAttempts: { type: Number, default: 0, select: false },
        loginAttempts: { type: Number, default: 0, select: false },
        lockUntil: { type: Date, default: null, select: false },
        refreshTokenHash: { type: String, select: false },
        refreshTokenExpiresAt: { type: Date, select: false },
        // FCM Tokens
        fcmTokens: {
            type: [String],
            default: []
        },
        fcmTokenMobile: {
            type: [String],
            default: []
        }
    },
    { timestamps: true }
);

adminSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

adminSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

adminSchema.methods.comparePersonalSecret = async function (candidateSecret) {
    if (!this.personalSecretHash || !candidateSecret) return false;
    return bcrypt.compare(candidateSecret, this.personalSecretHash);
};

// Safe method to hash personal secret code
adminSchema.statics.hashPersonalSecret = async function (secret) {
    return bcrypt.hash(String(secret), 12);
};

const Admin = mongoose.models.Admin || mongoose.model('Admin', adminSchema);
export { Admin };
export default Admin;
