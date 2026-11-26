import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Vendor from '../../../models/Vendor.model.js';
import { getVendorMonitoring } from '../../../services/vendorMonitoring.service.js';
import { getVendorsAnalytics } from '../../../services/vendorsAnalytics.service.js';

const VENDOR_STATUSES = ['approved', 'pending', 'rejected', 'suspended', 'all'];

// GET /api/admin/analytics/vendors?from=&to=&status=approved|all&search=
export const getVendorsAnalyticsSummary = asyncHandler(async (req, res) => {
    const { from, to, status = 'approved', search } = req.query;
    if (!VENDOR_STATUSES.includes(status)) throw new ApiError(400, 'Invalid "status" filter.');
    const data = await getVendorsAnalytics({ from, to, status, search });
    res.status(200).json(new ApiResponse(200, data, 'Vendor analytics fetched.'));
});

// GET /api/admin/vendors/:id/monitoring?from=YYYY-MM-DD&to=YYYY-MM-DD
export const getVendorMonitoringSummary = asyncHandler(async (req, res) => {
    const vendor = await Vendor.findById(req.params.id).select('_id storeName name');
    if (!vendor) throw new ApiError(404, 'Vendor not found.');
    const data = await getVendorMonitoring(vendor._id, { from: req.query.from, to: req.query.to });
    res.status(200).json(new ApiResponse(200, { ...data, vendor: { id: String(vendor._id), storeName: vendor.storeName, name: vendor.name } }, 'Vendor monitoring fetched.'));
});
