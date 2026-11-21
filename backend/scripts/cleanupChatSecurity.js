/**
 * One-off cleanup for two chat security issues (CHT-001 and CHT-002 in docs/Chat_System_Analysis.xlsx).
 *
 * 1. Vendor accounts that older code auto-created with the public password "Password123!"
 *    (PLE Shop system vendor, "Default Mock Vendor", and mock_<id>@example.com vendors created
 *    from customer product requests). --apply replaces the password with a random secret.
 *    Nothing else on the account is changed.
 *
 * 2. Fake opening messages the vendor portal used to save into empty chats:
 *      customer: "Hello, I need help with my order"  (or the thread's "Chat initiated." text)
 *      vendor:   "Hi! How can I help you today?"
 *    Only the exact pair saved together as a thread's first two messages is matched.
 *    --apply deletes that pair and clears the thread's lastMessage if it was the fake text.
 *
 * Usage (from /backend):
 *   node scripts/cleanupChatSecurity.js            # DRY RUN - report only, writes nothing
 *   node scripts/cleanupChatSecurity.js --apply    # rotate passwords + delete fake messages
 *
 * Safe to run more than once.
 */
import 'dotenv/config';
import dns from 'dns';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Vendor from '../src/models/Vendor.model.js';
import VendorChatThread from '../src/models/VendorChatThread.model.js';
import VendorChatMessage from '../src/models/VendorChatMessage.model.js';

// Same workaround as src/config/db.js: some local resolvers refuse Atlas SRV lookups
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch { /* ignore */ }

const APPLY = process.argv.includes('--apply');
const LEAKED_PASSWORD = 'Password123!';
const FAKE_CUSTOMER_TEXTS = new Set(['Hello, I need help with my order', 'Chat initiated.']);
const FAKE_VENDOR_TEXT = 'Hi! How can I help you today?';
const SEED_WINDOW_MS = 5000; // both fake messages were written in one create() call

const rotateLeakedVendorPasswords = async () => {
    const candidates = await Vendor.find({
        $or: [
            { storeName: 'PLE Shop' },
            { email: 'admin_pleshop@example.com' },
            { email: 'mockvendor@example.com' },
            { email: { $regex: '^mock_[0-9a-f]{24}@example\\.com$', $options: 'i' } },
        ],
    }).select('+password email storeName status');

    let leaked = 0;
    for (const v of candidates) {
        if (!(await v.comparePassword(LEAKED_PASSWORD))) continue;
        leaked++;
        console.log(`  leaked password: ${v.email} (${v.storeName}, status=${v.status})`);
        if (APPLY) {
            v.password = crypto.randomBytes(32).toString('base64url');
            await v.save();
        }
    }
    console.log(`Vendors checked: ${candidates.length}, using leaked password: ${leaked}${APPLY ? ' (rotated)' : ''}\n`);
};

const removeFakeSeedMessages = async () => {
    const threadIds = await VendorChatMessage.distinct('threadId', { senderType: 'vendor' });
    let fakeThreads = 0;

    for (const threadId of threadIds) {
        const firstTwo = await VendorChatMessage.find({ threadId }).sort({ createdAt: 1, _id: 1 }).limit(2);
        if (firstTwo.length < 2) continue;
        const [first, second] = firstTwo;
        const isFakePair =
            first.senderType === 'customer' && FAKE_CUSTOMER_TEXTS.has(first.message) &&
            second.senderType === 'vendor' && second.message === FAKE_VENDOR_TEXT &&
            Math.abs(second.createdAt - first.createdAt) <= SEED_WINDOW_MS;
        if (!isFakePair) continue;

        fakeThreads++;
        if (APPLY) {
            await VendorChatMessage.deleteMany({ _id: { $in: [first._id, second._id] } });
            const thread = await VendorChatThread.findById(threadId);
            if (thread && (FAKE_CUSTOMER_TEXTS.has(thread.lastMessage) || thread.lastMessage === FAKE_VENDOR_TEXT)) {
                const latest = await VendorChatMessage.findOne({ threadId }).sort({ createdAt: -1 });
                thread.lastMessage = latest ? latest.message : '';
                await thread.save();
            }
        }
    }
    console.log(`Threads scanned: ${threadIds.length}, with fake opening messages: ${fakeThreads}${APPLY ? ' (deleted)' : ''}\n`);

    // Threads auto-created per order still show the fake preview text even without messages.
    const previewFixed = await VendorChatThread.find({ lastMessage: { $exists: true, $ne: '' } }).select('lastMessage');
    let fakePreviews = 0;
    for (const t of previewFixed) {
        if (!FAKE_CUSTOMER_TEXTS.has(t.lastMessage)) continue;
        const hasMessages = await VendorChatMessage.exists({ threadId: t._id });
        if (hasMessages) continue;
        fakePreviews++;
        if (APPLY) await VendorChatThread.updateOne({ _id: t._id }, { $set: { lastMessage: '' } });
    }
    console.log(`Empty threads with fake preview text: ${fakePreviews}${APPLY ? ' (cleared)' : ''}`);
};

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ple');
    console.log(`Mode: ${APPLY ? 'APPLY (writing changes)' : 'DRY RUN (no writes)'}\n`);

    await rotateLeakedVendorPasswords();
    await removeFakeSeedMessages();

    if (!APPLY) console.log('\nDry run only. Re-run with --apply to write changes.');
    await mongoose.disconnect();
};

run().catch(async (err) => {
    console.error('Cleanup failed:', err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
