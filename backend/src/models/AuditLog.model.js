import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
    {
        actorUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
            index: true
        },
        actorIdentityId: {
            type: String,
            trim: true,
            index: true
        },
        actorName: {
            type: String,
            trim: true
        },
        actorRole: {
            type: String,
            trim: true
        },
        actorUserType: {
            type: String,
            trim: true
        },
        action: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        module: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        entityType: {
            type: String,
            trim: true
        },
        entityId: {
            type: String,
            trim: true
        },
        description: {
            type: String,
            trim: true
        },
        ipAddress: {
            type: String,
            trim: true
        },
        userAgent: {
            type: String,
            trim: true
        },
        status: {
            type: String,
            enum: ['SUCCESS', 'FAILURE', 'WARNING'],
            default: 'SUCCESS',
            index: true
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    {
        timestamps: true
    }
);

// Indexes for fast lookup and chronological sorting
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actorIdentityId: 1, createdAt: -1 });
auditLogSchema.index({ module: 1, action: 1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
export { AuditLog };
export default AuditLog;
