import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import { loadVendorWithAccounts, buildAccountsView } from '../../../services/vendorBankAccounts.service.js';

// GET /api/admin/vendors/:id/bank-accounts
// Every payout account of the vendor (full numbers: admins need them to pay), the preferred one,
// and the one that has received the most payouts highlighted.
export const getVendorBankAccounts = asyncHandler(async (req, res) => {
    const vendor = await loadVendorWithAccounts(req.params.id);
    const accounts = await buildAccountsView(vendor, { reveal: true });
    res.status(200).json(new ApiResponse(200, {
        vendor: { id: String(vendor._id), storeName: vendor.storeName || vendor.name },
        accounts,
        preferredId: accounts.find((a) => a.isPreferred)?.id || null,
        mostUsedId: accounts.find((a) => a.isMostUsed)?.id || null,
        totalPayouts: accounts.reduce((n, a) => n + a.paymentsReceived, 0),
        totalAmountPaid: Math.round(accounts.reduce((n, a) => n + a.amountReceived, 0) * 100) / 100,
    }, 'Vendor payout accounts fetched.'));
});
