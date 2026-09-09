import ProductRequest from '../models/ProductRequest.model.js';
import Notification from '../models/Notification.model.js';

const CRON_INTERVAL_MS = 60 * 60 * 1000; // every 1 hour

// Expire open vendor windows that passed their 14-day deadline with no vendor accepting.
const expireOpenWindows = async () => {
    const now = new Date();
    const expiredWindows = await ProductRequest.find({
        windowStatus: { $in: ['OPEN', 'REOPENED'] },
        windowExpiresAt: { $lt: now },
        acceptedVendorId: null
    }).select('_id requestId productName userId windowExpiresAt');

    if (expiredWindows.length === 0) return;
    console.log(`[ProductRequestExpiry] Expiring ${expiredWindows.length} open window(s).`);

    for (const req of expiredWindows) {
        await ProductRequest.updateOne(
            { _id: req._id },
            {
                $set: { windowStatus: 'EXPIRED', status: 'Expired' },
                $push: {
                    timeline: { status: 'Expired', date: now, comment: 'Vendor window expired after 14 days with no vendor accepting. Admin review required.' },
                    auditLog: { action: 'WINDOW_EXPIRED_AUTO', performedBy: null, performerType: 'System', timestamp: now, reason: `Automated: 14-day window expired at ${req.windowExpiresAt?.toISOString()}.` }
                }
            }
        );
        await Notification.create({ recipientType: 'admin', type: 'system', title: '14-Day Vendor Window Expired', message: `Product request "${req.productName}" (${req.requestId}) expired — no vendor accepted within 14 days.`, data: { relatedId: req._id.toString(), onModel: 'ProductRequest', requestId: req.requestId } });
        if (req.userId) {
            await Notification.create({ recipientId: req.userId, recipientType: 'user', type: 'system', title: 'Vendor Search Expired', message: `We were unable to find a vendor for your request "${req.productName}". Our team will review and contact you shortly.`, data: { relatedId: req._id.toString(), onModel: 'ProductRequest' } });
        }
        console.log(`[ProductRequestExpiry] Window expired: ${req.requestId}`);
    }
};

// Auto-release vendors whose 7-day fulfillment window has expired.
const expireFulfillmentWindows = async () => {
    const now = new Date();
    const expiredFulfillments = await ProductRequest.find({
        windowStatus: 'VENDOR_LOCKED',
        vendorFulfillmentStatus: 'IN_PROGRESS',
        vendorFulfillmentExpiresAt: { $lt: now },
        // Do NOT auto-release if customer is currently reviewing a pending extension
        $or: [
            { 'extensionRequest.status': { $exists: false } },
            { 'extensionRequest.status': { $in: ['NONE', 'APPROVED', 'REJECTED'] } }
        ]
    }).select('_id requestId productName userId acceptedVendorId windowExpiresAt vendorFulfillmentExpiresAt');

    if (expiredFulfillments.length === 0) return;
    console.log(`[ProductRequestExpiry] Expiring ${expiredFulfillments.length} fulfillment window(s).`);

    for (const req of expiredFulfillments) {
        const windowStillValid = req.windowExpiresAt && req.windowExpiresAt > now;
        const newWindowStatus = windowStillValid ? 'REOPENED' : 'EXPIRED';
        const newStatus = windowStillValid ? 'Vendor Window Open' : 'Expired';
        const timelineComment = windowStillValid
            ? 'Vendor did not submit a quotation within 7 days. Request automatically released and window reopened for other vendors.'
            : 'Vendor did not submit a quotation within 7 days and the 14-day window has also expired. Admin review required.';

        await ProductRequest.updateOne(
            { _id: req._id },
            {
                $set: { windowStatus: newWindowStatus, status: newStatus, acceptedVendorId: null, vendorAcceptedAt: null, vendorFulfillmentExpiresAt: null, vendorFulfillmentStatus: 'RELEASED' },
                $push: {
                    releasedVendors: { vendorId: req.acceptedVendorId, releasedAt: now, reason: `Auto-released: 7-day fulfillment window expired at ${req.vendorFulfillmentExpiresAt?.toISOString()}.` },
                    timeline: { status: newStatus, date: now, comment: timelineComment },
                    auditLog: { action: 'FULFILLMENT_WINDOW_EXPIRED_AUTO', performedBy: null, performerType: 'System', timestamp: now, reason: `Automated: Vendor fulfillment expired. ${windowStillValid ? 'Window reopened.' : 'Overall window also expired.'}` }
                }
            }
        );
        await Notification.create({ recipientType: 'admin', type: 'system', title: 'Vendor Fulfillment Window Expired', message: `Vendor fulfillment window expired for "${req.productName}" (${req.requestId}). ${windowStillValid ? 'Reopened for other vendors.' : 'Overall window also expired — admin action required.'}`, data: { relatedId: req._id.toString(), onModel: 'ProductRequest', requestId: req.requestId } });
        if (req.acceptedVendorId) {
            await Notification.create({ recipientId: req.acceptedVendorId, recipientType: 'vendor', type: 'system', title: 'Fulfillment Window Expired', message: `Your 7-day fulfillment window for "${req.productName}" has expired. The request has been released.`, data: { relatedId: req._id.toString(), onModel: 'ProductRequest' } });
        }
        if (req.userId) {
            await Notification.create({ recipientId: req.userId, recipientType: 'user', type: 'system', title: 'Vendor Update on Your Request', message: windowStillValid ? `The vendor for "${req.productName}" did not respond in time. Finding another vendor.` : `The vendor for "${req.productName}" did not respond in time and the search window has expired. Please contact support.`, data: { relatedId: req._id.toString(), onModel: 'ProductRequest' } });
        }
        console.log(`[ProductRequestExpiry] Fulfillment expired: ${req.requestId} — ${windowStillValid ? 'Reopened' : 'Expired'}`);
    }
};

const runExpiryChecks = async () => {
    try {
        await expireOpenWindows();
        await expireFulfillmentWindows();
    } catch (err) {
        console.error('[ProductRequestExpiry] Error during expiry checks:', err.message);
    }
};

// Start the expiry service. Call after DB connection is established.
export const startProductRequestExpiryService = () => {
    console.log('[ProductRequestExpiry] Expiry service started — runs every 1 hour.');
    runExpiryChecks(); // Run immediately on startup
    setInterval(runExpiryChecks, CRON_INTERVAL_MS);
};
