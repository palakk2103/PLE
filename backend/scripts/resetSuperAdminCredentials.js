/**
 * Reset a Super Admin's password and personal secret code.
 *
 * The admin login used to accept hard-coded fallback values (admin@123 / PLE#Sec99 ...) for any
 * Super Admin. Those were removed, so use this if a Super Admin can no longer sign in.
 *
 * Usage (from the backend folder):
 *   node scripts/resetSuperAdminCredentials.js <identityId-or-email> "<new password>" "<new secret code>"
 *
 * Example:
 *   node scripts/resetSuperAdminCredentials.js PLE-SA-000001 "S0me-Strong-Pass!" "MySecret#2026"
 */
import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import Admin from '../src/models/Admin.model.js';

try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch { /* ignore */ }

const [who, newPassword, newSecret] = process.argv.slice(2);

const fail = (msg) => {
    console.error(`\n✗ ${msg}\n`);
    process.exit(1);
};

if (!who || !newPassword || !newSecret) {
    fail('Usage: node scripts/resetSuperAdminCredentials.js <identityId-or-email> "<new password>" "<new secret code>"');
}
if (String(newPassword).length < 8) fail('Use a password of at least 8 characters.');
if (String(newSecret).length < 6) fail('Use a secret code of at least 6 characters.');

const main = async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ple');
    const key = String(who).trim();
    const admin = await Admin.findOne({
        $or: [{ identityId: key.toUpperCase() }, { email: key.toLowerCase() }],
    }).select('+password +personalSecretHash +loginAttempts +lockUntil');

    if (!admin) fail(`No admin found for "${key}".`);
    if (admin.role !== 'superadmin') fail(`"${key}" is not a Super Admin (role: ${admin.role}). Reset it from the Account Team page instead.`);

    admin.password = String(newPassword); // hashed by the model's pre-save hook
    admin.personalSecretHash = await Admin.hashPersonalSecret(newSecret);
    admin.loginAttempts = 0;
    admin.lockUntil = null;
    await admin.save();

    console.log(`\n✓ Credentials reset for ${admin.name} (${admin.identityId || admin.email}).\n`);
    await mongoose.disconnect();
};

main().catch((err) => fail(err.message));
