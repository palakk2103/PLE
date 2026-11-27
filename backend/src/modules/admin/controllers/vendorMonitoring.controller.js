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

// GET /api/admin/vendors/:id/conversations
// Every conversation this vendor is part of outside customer chats (those come from the Chat Hub):
// B2B RFQs, Direct RFQs, Consumer RFQs, Source Now requests and product enquiries. Each item links
// to the admin page where the full conversation can be read.
export const getVendorConversations = asyncHandler(async (req, res) => {
    const vendor = await Vendor.findById(req.params.id).select('_id').lean();
    if (!vendor) throw new ApiError(404, 'Vendor not found.');
    const vid = vendor._id;
    const vidStr = String(vid);
    const LIMIT = 50;

    const [RFQ, DirectRFQ, ProductRequest, ProductEnquiry] = await Promise.all([
        import('../../../models/RFQ.model.js'),
        import('../../../models/DirectRFQ.model.js'),
        import('../../../models/ProductRequest.model.js'),
        import('../../../models/ProductEnquiry.model.js'),
    ]).then((mods) => mods.map((m) => m.default));

    const [b2bRfqs, directRfqs, consumerRfqs, sourcing, enquiries] = await Promise.all([
        RFQ.find({ rfqType: { $ne: 'consumer' }, assignedVendorIds: vid })
            .select('rfqId title customProductName productId status companyName negotiationMessages quotations updatedAt')
            .populate('productId', 'name').sort({ updatedAt: -1 }).limit(LIMIT).lean(),
        DirectRFQ.find({ vendorId: vid })
            .select('directRfqId customProductName productId status messages updatedAt')
            .populate('productId', 'name').sort({ updatedAt: -1 }).limit(LIMIT).lean(),
        RFQ.find({ rfqType: 'consumer', sellerId: vid })
            .select('rfqId customProductName productId status consumerTimeline updatedAt')
            .populate('productId', 'name').sort({ updatedAt: -1 }).limit(LIMIT).lean(),
        ProductRequest.find({
            $or: [{ 'assignedVendors.vendorId': vid }, { acceptedVendorId: vid }, { 'vendorQuotations.vendorId': vid },
                { requestType: 'SHOP_SPECIFIC', targetEntityType: 'Vendor', targetEntityId: vid }],
        }).select('requestId productName status vendorQuotations timeline updatedAt').sort({ updatedAt: -1 }).limit(LIMIT).lean(),
        ProductEnquiry.find({ vendorId: vid })
            .select('enquiryId subject productId status messages updatedAt')
            .populate('productId', 'name').sort({ updatedAt: -1 }).limit(LIMIT).lean(),
    ]);

    const productLabel = (doc) => doc.title || doc.productId?.name || doc.customProductName || doc.productName || doc.subject || 'Product';
    const items = [
        ...b2bRfqs.map((r) => ({
            type: 'b2b_rfq', typeLabel: 'B2B RFQ', id: String(r._id), ref: r.rfqId, title: productLabel(r),
            party: r.companyName || '', status: r.status, updatedAt: r.updatedAt,
            messages: (r.negotiationMessages || []).length,
            quoted: (r.quotations || []).some((q) => String(q.vendorId) === vidStr),
            link: `b2b-enquiries/${r._id}`,
        })),
        ...directRfqs.map((r) => ({
            type: 'direct_rfq', typeLabel: 'Direct RFQ', id: String(r._id), ref: r.directRfqId, title: productLabel(r),
            status: r.status, updatedAt: r.updatedAt, messages: (r.messages || []).length, link: `direct-rfqs/${r._id}`,
        })),
        ...consumerRfqs.map((r) => ({
            type: 'consumer_rfq', typeLabel: 'Consumer RFQ', id: String(r._id), ref: r.rfqId, title: productLabel(r),
            status: r.status, updatedAt: r.updatedAt, messages: (r.consumerTimeline || []).length, link: `consumer-rfqs/${r._id}`,
        })),
        ...sourcing.map((r) => ({
            type: 'source_now', typeLabel: 'Source Now', id: String(r._id), ref: r.requestId, title: productLabel(r),
            status: r.status, updatedAt: r.updatedAt, messages: (r.timeline || []).length,
            quoted: (r.vendorQuotations || []).some((q) => String(q.vendorId) === vidStr),
            link: `product-requests?search=${encodeURIComponent(r.requestId)}`,
        })),
        ...enquiries.map((e) => ({
            type: 'product_enquiry', typeLabel: 'Product enquiry', id: String(e._id), ref: e.enquiryId, title: productLabel(e),
            status: e.status, updatedAt: e.updatedAt, messages: (e.messages || []).length, link: 'product-enquiries',
        })),
    ].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    const counts = items.reduce((acc, it) => ({ ...acc, [it.type]: (acc[it.type] || 0) + 1 }), {});
    res.status(200).json(new ApiResponse(200, { items, counts, limitPerType: LIMIT }, 'Vendor conversations fetched.'));
});
