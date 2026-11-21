import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import { sendVendorBankDetailsEmail } from '../../../services/vendorNotification.service.js';
import {
    MAX_BANK_ACCOUNTS,
    loadVendorWithAccounts,
    buildAccountsView,
    addAccount,
    updateAccount,
    setPreferredAccount,
    removeAccount,
} from '../../../services/vendorBankAccounts.service.js';

/**
 * Vendor payout accounts. Several accounts can be saved; one is preferred and receives payouts.
 * Account numbers are masked in every response here. Every change emails the vendor, so a
 * hijacked session can't quietly redirect payouts.
 */

const guardManaged = (req) => {
    if (req.user.role === 'managed_vendor') {
        throw new ApiError(403, 'Managed vendor accounts cannot change payout accounts. Please contact the administrator.');
    }
};

const alert = (vendor, account, reason) => {
    if (!vendor?.email) return;
    sendVendorBankDetailsEmail({
        vendor,
        status: 'updated',
        reason,
        bankName: account?.bankName || (account?.upiId ? 'UPI' : ''),
        accountNumberLast4: account?.accountNumber ? String(account.accountNumber).slice(-4) : '',
    }).catch((err) => console.error('[VendorBankAccounts] alert email failed:', err.message));
};

const respond = async (res, status, vendor, message, extra = {}) => {
    const accounts = await buildAccountsView(vendor);
    return res.status(status).json(new ApiResponse(status, {
        accounts,
        preferredId: accounts.find((a) => a.isPreferred)?.id || null,
        max: MAX_BANK_ACCOUNTS,
        canAddMore: accounts.length < MAX_BANK_ACCOUNTS,
        ...extra,
    }, message));
};

// GET /api/vendor/bank-accounts
export const listBankAccounts = asyncHandler(async (req, res) => {
    if (req.user.role === 'managed_vendor') {
        return res.status(200).json(new ApiResponse(200, { accounts: [], preferredId: null, max: MAX_BANK_ACCOUNTS, canAddMore: false, managed: true }, 'Managed vendor accounts are administered by PLE.'));
    }
    const vendor = await loadVendorWithAccounts(req.user.id);
    return respond(res, 200, vendor, 'Payout accounts fetched.');
});

// POST /api/vendor/bank-accounts
export const createBankAccount = asyncHandler(async (req, res) => {
    guardManaged(req);
    const { vendor, account } = await addAccount(req.user.id, req.body || {});
    alert(vendor, account, 'A new payout account was added to your store.');
    return respond(res, 201, vendor, 'Payout account added.', { createdId: String(account._id) });
});

// PUT /api/vendor/bank-accounts/:id
export const editBankAccount = asyncHandler(async (req, res) => {
    guardManaged(req);
    const { vendor, account, payoutChanged } = await updateAccount(req.user.id, req.params.id, req.body || {});
    if (payoutChanged) alert(vendor, account, 'The details of a payout account were changed.');
    return respond(res, 200, vendor, 'Payout account updated.');
});

// PATCH /api/vendor/bank-accounts/:id/preferred
export const makePreferredBankAccount = asyncHandler(async (req, res) => {
    guardManaged(req);
    const { vendor, account } = await setPreferredAccount(req.user.id, req.params.id);
    alert(vendor, account, 'Your preferred payout account was changed. Future payouts go to this account.');
    return respond(res, 200, vendor, 'Preferred payout account updated.');
});

// DELETE /api/vendor/bank-accounts/:id
export const deleteBankAccount = asyncHandler(async (req, res) => {
    guardManaged(req);
    const { vendor, removed, newPreferred } = await removeAccount(req.user.id, req.params.id);
    alert(vendor, removed, newPreferred
        ? 'A payout account was removed. Another account is now your preferred one.'
        : 'Your last payout account was removed. Add one to receive payouts.');
    return respond(res, 200, vendor, 'Payout account removed.');
});
