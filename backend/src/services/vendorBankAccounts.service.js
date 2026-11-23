import mongoose from 'mongoose';
import Vendor from '../models/Vendor.model.js';
import WithdrawalRequest from '../models/WithdrawalRequest.model.js';
import ApiError from '../utils/ApiError.js';

/**
 * Vendor payout accounts.
 *
 * A vendor can keep up to MAX_BANK_ACCOUNTS accounts (bank account and/or UPI); exactly one is
 * "preferred" and receives payouts. The old single `bankDetails` object is kept as a mirror of
 * the preferred account so older screens and reports keep working, and any vendor that only has
 * the old object is migrated automatically the first time their accounts are touched
 * (see ensureBankAccounts / scripts/migrateVendorBankAccounts.js).
 */

export const MAX_BANK_ACCOUNTS = 5;
export const RECENT_CHANGE_MS = 48 * 60 * 60 * 1000;

const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_NUMBER = /^\d{9,18}$/;
const UPI = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

export const maskAccountNumber = (num) => {
    const clean = String(num || '').trim();
    if (!clean) return '';
    if (clean.length <= 4) return clean;
    return `${'X'.repeat(clean.length - 4)}${clean.slice(-4)}`;
};

const hasPayoutTarget = (a) => Boolean((a?.accountNumber && a?.ifscCode) || a?.upiId);

/** Normalise + validate a vendor-supplied account. Throws a 400 describing the first problem. */
export const normalizeAccountInput = (input = {}, { partial = false, current = null } = {}) => {
    const has = (k) => input[k] !== undefined && input[k] !== null;
    const out = {};
    const str = (k, max = 120) => {
        const v = String(input[k] ?? '').trim();
        if (v.length > max) throw new ApiError(400, `${k} is too long.`);
        return v;
    };

    if (has('label')) out.label = str('label', 60);
    if (has('accountName')) out.accountName = str('accountName', 100);
    if (has('bankName')) out.bankName = str('bankName', 100);
    if (has('branchName')) out.branchName = str('branchName', 100);
    if (has('accountType')) out.accountType = str('accountType', 30);
    if (has('accountNumber')) out.accountNumber = String(input.accountNumber).replace(/\s+/g, '');
    if (has('ifscCode')) out.ifscCode = String(input.ifscCode).trim().toUpperCase();
    if (has('upiId')) out.upiId = String(input.upiId).trim();

    const merged = { ...(current || {}), ...out };
    const touched = (k) => out[k] !== undefined;
    const bankTouched = touched('accountNumber') || touched('ifscCode');
    // On a partial edit only the fields being changed are checked, so imported older data that
    // is imperfect can still be corrected one field at a time.
    if ((!partial || touched('accountName')) && (!merged.accountName || merged.accountName.length < 2)) {
        throw new ApiError(400, 'Account holder name is required.');
    }
    if ((!partial || touched('accountNumber')) && merged.accountNumber && !ACCOUNT_NUMBER.test(merged.accountNumber)) {
        throw new ApiError(400, 'Account number must be 9 to 18 digits.');
    }
    if ((!partial || touched('ifscCode')) && merged.ifscCode && !IFSC.test(merged.ifscCode)) {
        throw new ApiError(400, 'IFSC code looks wrong. It is 4 letters, a 0, then 6 letters or digits (for example HDFC0001234).');
    }
    if ((!partial || touched('upiId')) && merged.upiId && !UPI.test(merged.upiId)) {
        throw new ApiError(400, 'UPI ID looks wrong. It should look like name@bank.');
    }
    if ((!partial || bankTouched) && Boolean(merged.accountNumber) !== Boolean(merged.ifscCode)) {
        throw new ApiError(400, 'A bank account needs both the account number and the IFSC code.');
    }
    if ((!partial || bankTouched || touched('bankName')) && merged.accountNumber && !merged.bankName) {
        throw new ApiError(400, 'Bank name is required for a bank account.');
    }
    if ((!partial || bankTouched || touched('upiId')) && !hasPayoutTarget(merged)) {
        throw new ApiError(400, 'Add a bank account (number + IFSC) or a UPI ID so payouts can be sent.');
    }
    return out;
};

const sameAccount = (a, b) => {
    if (a.accountNumber && b.accountNumber) return a.accountNumber === b.accountNumber && String(a.ifscCode).toUpperCase() === String(b.ifscCode).toUpperCase();
    if (!a.accountNumber && !b.accountNumber && a.upiId && b.upiId) return a.upiId.toLowerCase() === b.upiId.toLowerCase();
    return false;
};

/* ───────────── migration of the old single bankDetails ───────────── */

/** Build a bankAccounts entry from the legacy bankDetails object (no validation: copy as-is). */
export const accountFromLegacy = (legacy = {}) => ({
    label: 'Primary account',
    accountName: legacy.accountName || '',
    accountNumber: legacy.accountNumber || '',
    bankName: legacy.bankName || '',
    ifscCode: legacy.ifscCode || '',
    upiId: legacy.upiId || '',
    branchName: legacy.branchName || '',
    accountType: legacy.accountType || '',
    proofType: legacy.bankProofType || '',
    proofUrl: legacy.bankProofUrl || '',
    proofName: legacy.bankProofName || '',
    proofUploadedAt: legacy.bankProofUploadedAt || undefined,
    isPreferred: true,
});

/** Mirror of the preferred account in the old `bankDetails` shape. */
export const legacyFromAccount = (a) => ({
    accountName: a?.accountName || '',
    accountNumber: a?.accountNumber || '',
    bankName: a?.bankName || '',
    ifscCode: a?.ifscCode || '',
    upiId: a?.upiId || '',
    branchName: a?.branchName || '',
    accountType: a?.accountType || '',
    bankProofType: a?.proofType || '',
    bankProofUrl: a?.proofUrl || '',
    bankProofName: a?.proofName || '',
    bankProofUploadedAt: a?.proofUploadedAt || undefined,
});

/**
 * The entry written for a migrated vendor. We cannot know when the old details were last edited, so
 * the account is dated from the vendor's registration: a migration must not make every vendor's
 * payout account look "recently changed".
 */
export const buildMigrationEntry = (vendor) => {
    const when = vendor.createdAt || new Date(0);
    return { _id: new mongoose.Types.ObjectId(), ...accountFromLegacy(vendor.bankDetails || {}), createdAt: when, updatedAt: when, changedAt: when };
};

/**
 * Make sure `vendor.bankAccounts` is populated: a vendor that only has the old bankDetails gets
 * it as their first (preferred) account. Idempotent and safe to call on every access.
 * Returns true if it migrated something.
 */
export const ensureBankAccounts = async (vendor) => {
    if (!vendor) return false;
    if (Array.isArray(vendor.bankAccounts) && vendor.bankAccounts.length > 0) return false;
    const legacy = vendor.bankDetails || {};
    if (!hasPayoutTarget(legacy) && !legacy.accountNumber && !legacy.upiId) return false;
    const entry = buildMigrationEntry({ createdAt: vendor.createdAt, bankDetails: legacy });
    // Atomic and race-safe: only migrate if nothing was added in the meantime
    const res = await Vendor.collection.updateOne(
        { _id: vendor._id, $or: [{ bankAccounts: { $exists: false } }, { bankAccounts: { $size: 0 } }] },
        { $push: { bankAccounts: entry } }
    );
    const fresh = await Vendor.findById(vendor._id).select('bankDetails bankAccounts');
    if (fresh) vendor.bankAccounts = fresh.bankAccounts;
    return (res.modifiedCount || 0) > 0;
};

const persist = async (vendor, accounts) => {
    // keep exactly one preferred, then mirror it into the legacy object
    let preferred = accounts.find((a) => a.isPreferred);
    if (!preferred && accounts.length) {
        preferred = accounts[accounts.length - 1];
    }
    accounts.forEach((a) => { a.isPreferred = Boolean(preferred) && String(a._id) === String(preferred._id); });
    vendor.bankAccounts = accounts;
    vendor.bankDetails = preferred ? legacyFromAccount(preferred) : legacyFromAccount({});
    await vendor.save({ validateBeforeSave: false });
    return vendor;
};

export const loadVendorWithAccounts = async (vendorId) => {
    if (!mongoose.isValidObjectId(String(vendorId))) throw new ApiError(400, 'Invalid vendor id.');
    const vendor = await Vendor.findById(vendorId).select('bankDetails bankAccounts storeName name email createdAt');
    if (!vendor) throw new ApiError(404, 'Vendor not found.');
    await ensureBankAccounts(vendor);
    return vendor;
};

export const getPreferredAccount = (vendor) => {
    const accounts = vendor?.bankAccounts || [];
    return accounts.find((a) => a.isPreferred) || accounts[0] || null;
};

/* ───────────── usage stats (admin highlights the most used account) ───────────── */

/**
 * For each account: how many payouts it received and how much. Payouts made before accounts had ids
 * are matched by account number + IFSC (or UPI id). Returns Map(accountId -> {count, amount, lastPaidAt}).
 */
export const getAccountUsage = async (vendorId, accounts = []) => {
    if (!vendorId) return new Map();
    const paid = await WithdrawalRequest.find({ vendorId, status: 'paid' })
        .select('bankDetailsSnapshot paidAmount requestedAmount paidAt').lean();
    const usage = new Map(accounts.map((a) => [String(a._id), { count: 0, amount: 0, lastPaidAt: null }]));
    for (const w of paid) {
        const snap = w.bankDetailsSnapshot || {};
        let target = snap.bankAccountId && usage.has(String(snap.bankAccountId)) ? String(snap.bankAccountId) : null;
        if (!target) {
            const match = accounts.find((a) => sameAccount(
                { accountNumber: snap.accountNumber, ifscCode: snap.ifscCode, upiId: snap.upiId },
                { accountNumber: a.accountNumber, ifscCode: a.ifscCode, upiId: a.upiId }
            ));
            target = match ? String(match._id) : null;
        }
        if (!target) continue;
        const u = usage.get(target);
        u.count += 1;
        u.amount += Number(w.paidAmount ?? w.requestedAmount ?? 0);
        if (w.paidAt && (!u.lastPaidAt || w.paidAt > u.lastPaidAt)) u.lastPaidAt = w.paidAt;
    }
    for (const u of usage.values()) u.amount = Math.round(u.amount * 100) / 100;
    return usage;
};

/** Account(s) with the most payouts (ties broken by amount). Null when nothing was paid yet. */
const pickMostUsedId = (usage) => {
    let best = null;
    for (const [id, u] of usage) {
        if (u.count === 0) continue;
        if (!best || u.count > best.u.count || (u.count === best.u.count && u.amount > best.u.amount)) best = { id, u };
    }
    return best?.id || null;
};

/**
 * Accounts as returned by the API. reveal=false (the vendor) masks the account number; reveal=true
 * (the admin, who needs it to pay) returns it in full.
 */
export const buildAccountsView = async (vendor, { reveal = false } = {}) => {
    const accounts = (vendor.bankAccounts || []).map((a) => (a.toObject ? a.toObject() : a));
    const usage = await getAccountUsage(vendor._id, accounts);
    const mostUsedId = pickMostUsedId(usage);
    const now = Date.now();
    return accounts.map((a) => {
        const u = usage.get(String(a._id)) || { count: 0, amount: 0, lastPaidAt: null };
        return {
            id: String(a._id),
            label: a.label || '',
            accountName: a.accountName || '',
            bankName: a.bankName || '',
            ifscCode: a.ifscCode || '',
            upiId: a.upiId || '',
            branchName: a.branchName || '',
            accountType: a.accountType || '',
            maskedAccountNumber: maskAccountNumber(a.accountNumber),
            ...(reveal ? { accountNumber: a.accountNumber || '' } : {}),
            proofType: a.proofType || '',
            proofName: a.proofName || '',
            ...(a.proofUrl ? { proofUrl: a.proofUrl } : {}),
            isPreferred: Boolean(a.isPreferred),
            isMostUsed: mostUsedId === String(a._id),
            paymentsReceived: u.count,
            amountReceived: u.amount,
            lastPaidAt: u.lastPaidAt,
            createdAt: a.createdAt,
            updatedAt: a.updatedAt,
            changedAt: a.changedAt || a.updatedAt || a.createdAt || null,
            recentlyChanged: (a.changedAt || a.updatedAt) ? now - new Date(a.changedAt || a.updatedAt).getTime() < RECENT_CHANGE_MS : false,
        };
    });
};

/* ───────────── mutations ───────────── */

export const addAccount = async (vendorId, input) => {
    const vendor = await loadVendorWithAccounts(vendorId);
    const accounts = vendor.bankAccounts.map((a) => a);
    if (accounts.length >= MAX_BANK_ACCOUNTS) {
        throw new ApiError(400, `You can save up to ${MAX_BANK_ACCOUNTS} payout accounts. Remove one to add another.`);
    }
    const data = normalizeAccountInput(input);
    if (accounts.some((a) => sameAccount(a, data))) throw new ApiError(409, 'This account is already saved.');
    const makePreferred = input.isPreferred === true || accounts.length === 0;
    if (makePreferred) accounts.forEach((a) => { a.isPreferred = false; });
    vendor.bankAccounts.push({ ...data, isPreferred: makePreferred });
    await persist(vendor, vendor.bankAccounts.map((a) => a));
    const created = vendor.bankAccounts[vendor.bankAccounts.length - 1];
    return { vendor, account: created };
};

export const updateAccount = async (vendorId, accountId, input) => {
    const vendor = await loadVendorWithAccounts(vendorId);
    const account = vendor.bankAccounts.id(accountId);
    if (!account) throw new ApiError(404, 'Payout account not found.');
    const data = normalizeAccountInput(input, { partial: true, current: account.toObject() });
    const candidate = { ...account.toObject(), ...data };
    if (vendor.bankAccounts.some((a) => String(a._id) !== String(accountId) && sameAccount(a, candidate))) {
        throw new ApiError(409, 'Another saved account already has these details.');
    }
    const payoutChanged = ['accountNumber', 'ifscCode', 'upiId', 'accountName'].some((k) => data[k] !== undefined && data[k] !== account[k]);
    Object.assign(account, data);
    if (payoutChanged) { account.changedAt = new Date(); account.proofType = ''; account.proofUrl = ''; account.proofName = ''; account.proofUploadedAt = undefined; }
    if (input.isPreferred === true) {
        if (!account.isPreferred) account.changedAt = new Date();
        vendor.bankAccounts.forEach((a) => { a.isPreferred = String(a._id) === String(accountId); });
    }
    await persist(vendor, vendor.bankAccounts.map((a) => a));
    return { vendor, account, payoutChanged };
};

export const setPreferredAccount = async (vendorId, accountId) => {
    const vendor = await loadVendorWithAccounts(vendorId);
    const account = vendor.bankAccounts.id(accountId);
    if (!account) throw new ApiError(404, 'Payout account not found.');
    // becoming the payout destination counts as a change to this account (being demoted does not)
    if (!account.isPreferred) account.changedAt = new Date();
    vendor.bankAccounts.forEach((a) => { a.isPreferred = String(a._id) === String(accountId); });
    await persist(vendor, vendor.bankAccounts.map((a) => a));
    return { vendor, account };
};

export const removeAccount = async (vendorId, accountId) => {
    const vendor = await loadVendorWithAccounts(vendorId);
    const account = vendor.bankAccounts.id(accountId);
    if (!account) throw new ApiError(404, 'Payout account not found.');
    const wasPreferred = account.isPreferred;
    const remaining = vendor.bankAccounts.filter((a) => String(a._id) !== String(accountId));
    if (wasPreferred && remaining.length) {
        // the most recently added of the others takes over
        const next = [...remaining].sort((x, y) => new Date(y.createdAt || 0) - new Date(x.createdAt || 0))[0];
        remaining.forEach((a) => { a.isPreferred = String(a._id) === String(next._id); });
    }
    const removed = account.toObject();
    await persist(vendor, remaining);
    return { vendor, removed, newPreferred: wasPreferred ? getPreferredAccount(vendor) : null };
};

/**
 * Old single-account update calls (/vendor/auth/bank-details, /vendor/finance/bank-details) now
 * edit the preferred account, or create the first one.
 */
export const applyLegacyUpdate = async (vendorId, rawFields) => {
    // Older clients send a blank accountNumber to mean "unchanged"
    const fields = { ...rawFields };
    if (fields.accountNumber !== undefined && !String(fields.accountNumber).trim()) delete fields.accountNumber;
    const vendor = await loadVendorWithAccounts(vendorId);
    const preferred = getPreferredAccount(vendor);
    if (!preferred) return addAccount(vendorId, { ...fields, label: 'Primary account', isPreferred: true });
    return updateAccount(vendorId, preferred._id, fields);
};

/**
 * What a withdrawal is addressed to: the preferred account, as an immutable snapshot (the payout
 * keeps going to this account even if the vendor edits or removes it afterwards).
 */
export const snapshotForPayout = (vendor) => {
    const a = getPreferredAccount(vendor);
    if (!a || !hasPayoutTarget(a)) return null;
    return {
        bankAccountId: a._id,
        label: a.label || '',
        accountUpdatedAt: a.changedAt || a.updatedAt || a.createdAt || null,
        accountName: a.accountName || vendor.storeName || '',
        accountNumber: a.accountNumber || '',
        maskedAccountNumber: maskAccountNumber(a.accountNumber),
        bankName: a.bankName || '',
        ifscCode: a.ifscCode || '',
        upiId: a.upiId || '',
    };
};
