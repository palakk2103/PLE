/**
 * Move every vendor's single legacy `bankDetails` into the new `bankAccounts` list as their first,
 * preferred account.
 *
 * This also happens automatically the first time a vendor (or an admin) opens the payout accounts,
 * or the vendor requests a withdrawal, so running this script is optional: it just migrates
 * everyone up front so reports are complete from day one.
 *
 * Usage (from /backend):
 *   node scripts/migrateVendorBankAccounts.js            # DRY RUN - report only, writes nothing
 *   node scripts/migrateVendorBankAccounts.js --apply    # migrate
 *
 * Additive and idempotent: only vendors whose `bankAccounts` is empty are touched, the legacy
 * `bankDetails` is left exactly as it is (it stays as a mirror of the preferred account), and
 * existing withdrawals are not modified (their snapshots are matched to accounts by number/IFSC).
 */
import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import Vendor from '../src/models/Vendor.model.js';
import { buildMigrationEntry } from '../src/services/vendorBankAccounts.service.js';

try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch { /* ignore */ }

const APPLY = process.argv.includes('--apply');
const hasLegacy = (b = {}) => Boolean(b.accountNumber || b.upiId);

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ple');
    console.log(`Mode: ${APPLY ? 'APPLY (migrating)' : 'DRY RUN (no writes)'}\n`);

    const vendors = await Vendor.find({}).select('bankDetails bankAccounts storeName name createdAt').lean();
    let already = 0, nothing = 0, toMigrate = 0, migrated = 0, incomplete = 0;

    for (const v of vendors) {
        if (Array.isArray(v.bankAccounts) && v.bankAccounts.length) { already++; continue; }
        if (!hasLegacy(v.bankDetails)) { nothing++; continue; }
        toMigrate++;
        const complete = Boolean((v.bankDetails.accountNumber && v.bankDetails.ifscCode) || v.bankDetails.upiId);
        if (!complete) {
            incomplete++;
            console.log(`  ! ${v.storeName || v.name} (${v._id}): legacy details are incomplete (kept as-is, vendor should re-enter)`);
        }
        if (APPLY) {
            const res = await Vendor.collection.updateOne(
                { _id: v._id, $or: [{ bankAccounts: { $exists: false } }, { bankAccounts: { $size: 0 } }] },
                { $push: { bankAccounts: buildMigrationEntry(v) } }
            );
            migrated += res.modifiedCount || 0;
        }
    }

    console.log(`Vendors: ${vendors.length}`);
    console.log(`  already have payout accounts : ${already}`);
    console.log(`  no bank details at all       : ${nothing}`);
    console.log(`  with old bank details        : ${toMigrate}  (${incomplete} incomplete)`);
    if (APPLY) console.log(`  migrated now                 : ${migrated}`);
    else if (toMigrate) console.log('\nRe-run with --apply to migrate them.');

    await mongoose.disconnect();
};

run().catch((err) => { console.error(err); process.exit(1); });
