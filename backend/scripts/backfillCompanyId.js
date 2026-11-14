/**
 * Backfill `companyId` on existing Orders, ReturnRequests and WalletTransactions
 * that belong to B2B users (b2bAdmin / b2bEmployee).
 *
 * New records get companyId automatically (see src/utils/companyScope.js);
 * this script only fixes records created before that change.
 *
 * Usage (from /backend):
 *   node scripts/backfillCompanyId.js            # DRY RUN - report only, writes nothing
 *   node scripts/backfillCompanyId.js --apply    # write companyId
 *
 * What --apply writes (additive only):
 *   - companyId, ONLY on records where it is missing/null, copied from the owner's User.companyId.
 *   Amounts, statuses, balances and refund data are never touched. Safe to run more than once.
 *
 * Reported but NOT fixed (needs manual review):
 *   - B2B orders whose userId no longer exists (e.g. the employee was deleted).
 *   - Legacy fund allotments: before this change, allotting funds to an employee only logged a
 *     `transfer_out` on the admin's wallet, with no matching credit on the employee's ledger.
 *     Those can't be reliably reconstructed, so they are only counted.
 */
import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import User from '../src/models/User.model.js';
import Order from '../src/models/Order.model.js';
import ReturnRequest from '../src/models/ReturnRequest.model.js';
import WalletTransaction from '../src/models/WalletTransaction.model.js';

// Same workaround as src/config/db.js: some local resolvers refuse Atlas SRV lookups
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch { /* ignore */ }

const APPLY = process.argv.includes('--apply');
const MISSING = { $or: [{ companyId: { $exists: false } }, { companyId: null }] };

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ple');
    console.log(`Mode: ${APPLY ? 'APPLY (writing companyId)' : 'DRY RUN (no writes)'}\n`);

    const b2bUsers = await User.find({
        role: { $in: ['b2bAdmin', 'b2bEmployee'] },
        companyId: { $ne: null },
    }).select('_id companyId').lean();

    // Group user ids by company
    const usersByCompany = new Map();
    for (const u of b2bUsers) {
        const key = String(u.companyId);
        if (!usersByCompany.has(key)) usersByCompany.set(key, []);
        usersByCompany.get(key).push(u._id);
    }
    console.log(`B2B users with a company: ${b2bUsers.length} across ${usersByCompany.size} companies\n`);

    // Use the raw collections: this is a plain field copy, no hooks/validation needed.
    const targets = [
        ['Order', Order.collection],
        ['ReturnRequest', ReturnRequest.collection],
        ['WalletTransaction', WalletTransaction.collection],
    ];

    for (const [name, collection] of targets) {
        let pending = 0;
        let written = 0;
        for (const [companyId, userIds] of usersByCompany) {
            const filter = { userId: { $in: userIds }, ...MISSING };
            pending += await collection.countDocuments(filter);
            if (APPLY) {
                const res = await collection.updateMany(filter, {
                    $set: { companyId: new mongoose.Types.ObjectId(companyId) },
                });
                written += res.modifiedCount;
            }
        }
        console.log(`${name.padEnd(18)} missing companyId: ${pending}${APPLY ? `  -> updated: ${written}` : ''}`);
    }

    // --- Manual review items ---
    const b2bUserIds = new Set(b2bUsers.map((u) => String(u._id)));
    const b2bOrders = await Order.find({ orderType: 'b2b', ...MISSING }).select('orderId userId').lean();
    // Orders this script cannot fix: their user no longer exists or has no company
    const orphaned = b2bOrders.filter((o) => !o.userId || !b2bUserIds.has(String(o.userId)));

    console.log(`\nB2B orders with no resolvable B2B user (deleted/missing): ${orphaned.length}`);
    orphaned.slice(0, 20).forEach((o) => console.log(`   - ${o.orderId} (userId: ${o.userId || 'none'})`));
    if (orphaned.length > 20) console.log(`   ...and ${orphaned.length - 20} more`);

    const legacyAllotments = await WalletTransaction.countDocuments({
        transactionCategory: 'transfer_out',
        description: { $regex: '^Allotted funds to employee' },
    });
    console.log(`Legacy admin allotments (no matching employee ledger entry): ${legacyAllotments}`);

    if (!APPLY) console.log('\nDry run only. Re-run with --apply to write changes.');
    await mongoose.disconnect();
};

run().catch(async (err) => {
    console.error('Backfill failed:', err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
