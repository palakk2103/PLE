import mongoose from 'mongoose';

const B2B_ROLES = ['b2bAdmin', 'b2bEmployee'];

/**
 * Resolve the B2B companyId for a user (null for non-B2B users).
 */
export const resolveCompanyId = async (userId) => {
    if (!userId) return null;
    const user = await mongoose.model('User').findById(userId).select('companyId role').lean();
    if (!user || !user.companyId || !B2B_ROLES.includes(user.role)) return null;
    return user.companyId;
};

/**
 * Schema plugin: on creation, auto-fill `companyId` from `userId` when the
 * user belongs to a B2B company. Covers every code path that creates the
 * document, so individual controllers don't have to remember to set it.
 */
export const companyScopePlugin = (schema) => {
    schema.pre('validate', async function (next) {
        try {
            if (this.isNew && !this.companyId && this.userId) {
                const companyId = await resolveCompanyId(this.userId);
                if (companyId) this.companyId = companyId;
            }
            next();
        } catch (err) {
            next(err);
        }
    });
};
