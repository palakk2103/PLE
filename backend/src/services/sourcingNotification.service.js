import { sendEmail } from './email.service.js';
import { getSourceNowTemplate, getRfqTemplate } from '../utils/sourcingLoyaltyTemplates.js';
import User from '../models/User.model.js';
import Vendor from '../models/Vendor.model.js';

const CLIENT_URL = process.env.CLIENT_URL || 'https://ple.store';

/**
 * Resolves recipient email and name for user/customer or vendor
 */
const resolveUserRecipient = async (recipient) => {
    if (!recipient) return { email: null, name: 'Valued Customer' };
    if (typeof recipient === 'string') {
        if (recipient.includes('@')) return { email: recipient, name: 'Valued Customer' };
        const user = await User.findById(recipient).select('name email').lean();
        return { email: user?.email, name: user?.name || 'Valued Customer' };
    }
    return { email: recipient.email, name: recipient.name || 'Valued Customer' };
};

const resolveVendorRecipient = async (recipient) => {
    if (!recipient) return { email: null, name: 'Vendor Partner' };
    if (typeof recipient === 'string') {
        if (recipient.includes('@')) return { email: recipient, name: 'Vendor Partner' };
        const vendor = await Vendor.findById(recipient).select('storeName name email').lean();
        return { email: vendor?.email, name: vendor?.storeName || vendor?.name || 'Vendor Partner' };
    }
    return { email: recipient.email, name: recipient.storeName || recipient.name || 'Vendor Partner' };
};

// ══════════════════════════════════════════════════════════════════════════════
// 1. SOURCENOW / PRS: Customer to PLE (Items 196–204)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Item 196: SourceNow request submitted
 */
export const sendSourceNowSubmittedEmail = async ({ customer, request }) => {
    try {
        const { email, name } = await resolveUserRecipient(customer || request?.userId);
        if (!email) return;

        const reqId = request.requestId || request._id;
        const html = getSourceNowTemplate({
            title: 'Your Sourcing Request Has Been Submitted',
            subtitle: 'We have received your custom procurement requirements.',
            recipientName: name,
            requestId: reqId,
            productName: request.productName,
            category: request.category,
            quantity: request.quantity,
            budget: request.expectedBudget || request.targetPrice,
            statusText: 'Submitted',
            badgeColor: '#2563eb',
            message: 'Your custom product request has been successfully created. Our commercial procurement specialists are reviewing the specifications.',
            actionUrl: `${CLIENT_URL}/sourcenow/requests/${reqId}`,
            actionText: 'Track Your Request'
        });

        return await sendEmail({
            to: email,
            subject: `SourceNow Request Submitted [#${reqId}] - ${request.productName}`,
            html,
            recipientType: 'customer',
            template: 'sourcenow_submitted',
            idempotencyKey: `sn_sub_${reqId}`,
            metadata: { requestId: reqId, itemNumber: 196 }
        });
    } catch (err) {
        console.error('[SourcingNotification] sendSourceNowSubmittedEmail error:', err.message);
    }
};

/**
 * Item 197: Request received (official acknowledgment with timeline)
 */
export const sendSourceNowReceivedEmail = async ({ customer, request }) => {
    try {
        const { email, name } = await resolveUserRecipient(customer || request?.userId);
        if (!email) return;

        const reqId = request.requestId || request._id;
        const html = getSourceNowTemplate({
            title: 'Sourcing Request Formally Received & Queued',
            subtitle: 'Sourcing verification in progress.',
            recipientName: name,
            requestId: reqId,
            productName: request.productName,
            category: request.category,
            quantity: request.quantity,
            budget: request.expectedBudget || request.targetPrice,
            statusText: 'Received',
            badgeColor: '#0284c7',
            message: 'Our procurement team has validated your request. It is now open to our verified partner network for quotations.',
            actionUrl: `${CLIENT_URL}/sourcenow/requests/${reqId}`,
            actionText: 'View Sourcing Pipeline'
        });

        return await sendEmail({
            to: email,
            subject: `Sourcing Request Verified [#${reqId}] - PLE Sourcing Desk`,
            html,
            recipientType: 'customer',
            template: 'sourcenow_received',
            idempotencyKey: `sn_rec_${reqId}`,
            metadata: { requestId: reqId, itemNumber: 197 }
        });
    } catch (err) {
        console.error('[SourcingNotification] sendSourceNowReceivedEmail error:', err.message);
    }
};

/**
 * Item 198: Request being sourced
 */
export const sendSourceNowBeingSourcedEmail = async ({ customer, request, sourcingType = 'VENDOR' }) => {
    try {
        const { email, name } = await resolveUserRecipient(customer || request?.userId);
        if (!email) return;

        const reqId = request.requestId || request._id;
        const html = getSourceNowTemplate({
            title: 'Your Product is Actively Being Sourced',
            subtitle: 'Negotiations with verified manufacturers and distributors underway.',
            recipientName: name,
            requestId: reqId,
            productName: request.productName,
            category: request.category,
            quantity: request.quantity,
            budget: request.expectedBudget || request.targetPrice,
            statusText: 'In Sourcing',
            badgeColor: '#8b5cf6',
            message: `Our sourcing specialists are actively negotiating best prices and lead times with wholesale distributors (${sourcingType === 'PLE_SHOP' ? 'PLE Dedicated Inventory' : 'Certified Multi-Vendor Network'}).`,
            actionUrl: `${CLIENT_URL}/sourcenow/requests/${reqId}`,
            actionText: 'View Status'
        });

        return await sendEmail({
            to: email,
            subject: `Active Sourcing Update [#${reqId}] - ${request.productName}`,
            html,
            recipientType: 'customer',
            template: 'sourcenow_being_sourced',
            idempotencyKey: `sn_sourcing_${reqId}`,
            metadata: { requestId: reqId, itemNumber: 198 }
        });
    } catch (err) {
        console.error('[SourcingNotification] sendSourceNowBeingSourcedEmail error:', err.message);
    }
};

/**
 * Item 199: Supplier found
 */
export const sendSourceNowSupplierFoundEmail = async ({ customer, request, supplierName }) => {
    try {
        const { email, name } = await resolveUserRecipient(customer || request?.userId);
        if (!email) return;

        const reqId = request.requestId || request._id;
        const html = getSourceNowTemplate({
            title: 'Supplier Matched for Your Request!',
            subtitle: 'A verified supplier has accepted your product specifications.',
            recipientName: name,
            requestId: reqId,
            productName: request.productName,
            category: request.category,
            quantity: request.quantity,
            budget: request.expectedBudget || request.targetPrice,
            statusText: 'Supplier Found',
            badgeColor: '#10b981',
            message: `Exciting update! A qualified supplier (${supplierName || 'Verified Partner'}) has been secured for your custom request. Final quotation figures are being formulated.`,
            actionUrl: `${CLIENT_URL}/sourcenow/requests/${reqId}`,
            actionText: 'Review Match'
        });

        return await sendEmail({
            to: email,
            subject: `Supplier Found for Request [#${reqId}] - ${request.productName}`,
            html,
            recipientType: 'customer',
            template: 'sourcenow_supplier_found',
            idempotencyKey: `sn_supp_${reqId}`,
            metadata: { requestId: reqId, itemNumber: 199 }
        });
    } catch (err) {
        console.error('[SourcingNotification] sendSourceNowSupplierFoundEmail error:', err.message);
    }
};

/**
 * Item 200: Quote available
 */
export const sendSourceNowQuoteAvailableEmail = async ({ customer, request, quote }) => {
    try {
        const { email, name } = await resolveUserRecipient(customer || request?.userId);
        if (!email) return;

        const reqId = request.requestId || request._id;
        const html = getSourceNowTemplate({
            title: 'Quotation Available for Your Review',
            subtitle: 'A finalized commercial proposal is ready.',
            recipientName: name,
            requestId: reqId,
            productName: request.productName,
            category: request.category,
            quantity: request.quantity,
            budget: request.expectedBudget || request.targetPrice,
            statusText: 'Quote Ready',
            badgeColor: '#16a34a',
            message: 'A formal quotation has been generated. Please review the pricing, fulfillment schedule, and terms to approve your order.',
            quoteDetails: {
                price: quote.finalPrice || quote.totalPrice || quote.offeredPrice,
                deliveryTimeline: quote.estimatedDelivery || quote.deliveryTimeline || 'Standard Commercial Freight',
                validUntil: quote.validUntil || '7 days from issuance',
                notes: quote.notes || quote.message
            },
            actionUrl: `${CLIENT_URL}/sourcenow/requests/${reqId}`,
            actionText: 'Review & Approve Quote'
        });

        return await sendEmail({
            to: email,
            subject: `Quote Ready [#${reqId}]: ₹${quote.finalPrice || quote.totalPrice || quote.offeredPrice} - ${request.productName}`,
            html,
            recipientType: 'customer',
            template: 'sourcenow_quote_available',
            idempotencyKey: `sn_quote_${reqId}_${Date.now().toString().slice(0, 8)}`,
            metadata: { requestId: reqId, itemNumber: 200 }
        });
    } catch (err) {
        console.error('[SourcingNotification] sendSourceNowQuoteAvailableEmail error:', err.message);
    }
};

/**
 * Item 201: Quote expired
 */
export const sendSourceNowQuoteExpiredEmail = async ({ customer, request }) => {
    try {
        const { email, name } = await resolveUserRecipient(customer || request?.userId);
        if (!email) return;

        const reqId = request.requestId || request._id;
        const html = getSourceNowTemplate({
            title: 'Sourcing Quotation Has Expired',
            subtitle: 'The valid quotation window has ended.',
            recipientName: name,
            requestId: reqId,
            productName: request.productName,
            statusText: 'Quote Expired',
            badgeColor: '#dc2626',
            message: 'The previously proposed quotation has lapsed due to time constraints or raw material market changes. You can request a refreshed quote directly from your portal.',
            actionUrl: `${CLIENT_URL}/sourcenow/requests/${reqId}`,
            actionText: 'Request Re-Quote'
        });

        return await sendEmail({
            to: email,
            subject: `Quotation Expired [#${reqId}] - ${request.productName}`,
            html,
            recipientType: 'customer',
            template: 'sourcenow_quote_expired',
            idempotencyKey: `sn_exp_${reqId}`,
            metadata: { requestId: reqId, itemNumber: 201 }
        });
    } catch (err) {
        console.error('[SourcingNotification] sendSourceNowQuoteExpiredEmail error:', err.message);
    }
};

/**
 * Item 202: Product unavailable
 */
export const sendSourceNowProductUnavailableEmail = async ({ customer, request, reason }) => {
    try {
        const { email, name } = await resolveUserRecipient(customer || request?.userId);
        if (!email) return;

        const reqId = request.requestId || request._id;
        const html = getSourceNowTemplate({
            title: 'Sourcing Notice: Product Currently Unavailable',
            subtitle: 'Unable to locate supplier matching specific criteria.',
            recipientName: name,
            requestId: reqId,
            productName: request.productName,
            statusText: 'Unavailable',
            badgeColor: '#ef4444',
            message: reason || 'After extensive supplier searches across our domestic and global vendor databases, we are currently unable to fulfill this exact product specification within your target parameters.',
            actionUrl: `${CLIENT_URL}/sourcenow/new`,
            actionText: 'Submit Modified Request'
        });

        return await sendEmail({
            to: email,
            subject: `Sourcing Update [#${reqId}]: Product Unavailable - ${request.productName}`,
            html,
            recipientType: 'customer',
            template: 'sourcenow_unavailable',
            idempotencyKey: `sn_unavail_${reqId}`,
            metadata: { requestId: reqId, itemNumber: 202 }
        });
    } catch (err) {
        console.error('[SourcingNotification] sendSourceNowProductUnavailableEmail error:', err.message);
    }
};

/**
 * Item 203: Alternative found
 */
export const sendSourceNowAlternativeFoundEmail = async ({ customer, request, alternative }) => {
    try {
        const { email, name } = await resolveUserRecipient(customer || request?.userId);
        if (!email) return;

        const reqId = request.requestId || request._id;
        const html = getSourceNowTemplate({
            title: 'Alternative Product Recommended',
            subtitle: 'We found an eligible equivalent in our catalog.',
            recipientName: name,
            requestId: reqId,
            productName: request.productName,
            statusText: 'Alternative Matched',
            badgeColor: '#eab308',
            message: 'While the exact original model is out of stock, our engineering & sourcing teams identified an alternative with identical form, fit, and performance specs.',
            alternativeDetails: alternative,
            actionUrl: alternative?.url || `${CLIENT_URL}/sourcenow/requests/${reqId}`,
            actionText: 'View Alternative'
        });

        return await sendEmail({
            to: email,
            subject: `Alternative Found for Request [#${reqId}] - ${request.productName}`,
            html,
            recipientType: 'customer',
            template: 'sourcenow_alternative_found',
            idempotencyKey: `sn_alt_${reqId}`,
            metadata: { requestId: reqId, itemNumber: 203 }
        });
    } catch (err) {
        console.error('[SourcingNotification] sendSourceNowAlternativeFoundEmail error:', err.message);
    }
};

/**
 * Item 204: Request cancelled
 */
export const sendSourceNowCancelledEmail = async ({ customer, request, reason }) => {
    try {
        const { email, name } = await resolveUserRecipient(customer || request?.userId);
        if (!email) return;

        const reqId = request.requestId || request._id;
        const html = getSourceNowTemplate({
            title: 'Sourcing Request Cancelled',
            subtitle: 'Your request has been officially closed.',
            recipientName: name,
            requestId: reqId,
            productName: request.productName,
            statusText: 'Cancelled',
            badgeColor: '#6b7280',
            message: reason || 'Your sourcing request has been cancelled as requested or due to administrative review.',
            actionUrl: `${CLIENT_URL}/sourcenow/requests`,
            actionText: 'View My Requests'
        });

        return await sendEmail({
            to: email,
            subject: `Sourcing Request Cancelled [#${reqId}] - ${request.productName}`,
            html,
            recipientType: 'customer',
            template: 'sourcenow_cancelled',
            idempotencyKey: `sn_cancel_${reqId}`,
            metadata: { requestId: reqId, itemNumber: 204 }
        });
    } catch (err) {
        console.error('[SourcingNotification] sendSourceNowCancelledEmail error:', err.message);
    }
};


// ══════════════════════════════════════════════════════════════════════════════
// 2. SOURCENOW: PLE to Vendors (Items 205–212)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Item 205: New sourcing request (direct or broadcast)
 */
export const sendVendorNewSourcingRequestEmail = async ({ vendor, request }) => {
    try {
        const { email, name } = await resolveVendorRecipient(vendor);
        if (!email) return;

        const reqId = request.requestId || request._id;
        const html = getSourceNowTemplate({
            title: 'New Commercial Sourcing Opportunity Available',
            subtitle: 'A high-intent buyer is requesting quotes for your category.',
            recipientName: name,
            requestId: reqId,
            productName: request.productName,
            category: request.category,
            quantity: request.quantity,
            budget: request.expectedBudget,
            statusText: 'New Opportunity',
            badgeColor: '#2563eb',
            message: 'A new verified sourcing inquiry has been posted matching your vendor capabilities. Submit your competitive quotation to win this bulk purchase order.',
            actionUrl: `${CLIENT_URL}/vendor/product-requests/${reqId}`,
            actionText: 'View Opportunity & Quote'
        });

        return await sendEmail({
            to: email,
            subject: `New Sourcing Inquiry [#${reqId}]: ${request.productName} (${request.quantity} units)`,
            html,
            recipientType: 'vendor',
            template: 'vendor_sourcing_new',
            idempotencyKey: `v_sn_new_${vendor?._id || vendor}_${reqId}`,
            metadata: { requestId: reqId, vendorId: vendor?._id || vendor, itemNumber: 205 }
        });
    } catch (err) {
        console.error('[SourcingNotification] sendVendorNewSourcingRequestEmail error:', err.message);
    }
};

/**
 * Item 206: Sourcing request available (in open vendor window)
 */
export const sendVendorSourcingAvailableEmail = async ({ vendor, request, windowExpiresAt }) => {
    try {
        const { email, name } = await resolveVendorRecipient(vendor);
        if (!email) return;

        const reqId = request.requestId || request._id;
        const expiryStr = windowExpiresAt ? new Date(windowExpiresAt).toLocaleDateString('en-IN') : '14 days';
        const html = getSourceNowTemplate({
            title: 'Open Sourcing Window: Claim & Fulfill',
            subtitle: 'Open to certified sellers on a first-to-claim or competitive basis.',
            recipientName: name,
            requestId: reqId,
            productName: request.productName,
            category: request.category,
            quantity: request.quantity,
            budget: request.expectedBudget,
            statusText: 'Window Open',
            badgeColor: '#059669',
            message: `This sourcing request is currently available for quotation. The open window closes on ${expiryStr}.`,
            actionUrl: `${CLIENT_URL}/vendor/product-requests/${reqId}`,
            actionText: 'Claim / Submit Quote'
        });

        return await sendEmail({
            to: email,
            subject: `Open Sourcing Window [#${reqId}]: ${request.productName}`,
            html,
            recipientType: 'vendor',
            template: 'vendor_sourcing_available',
            idempotencyKey: `v_sn_avail_${vendor?._id || vendor}_${reqId}`,
            metadata: { requestId: reqId, itemNumber: 206 }
        });
    } catch (err) {
        console.error('[SourcingNotification] sendVendorSourcingAvailableEmail error:', err.message);
    }
};

/**
 * Item 207: Vendor invited to quote
 */
export const sendVendorInvitedToQuoteEmail = async ({ vendor, request, invitedBy = 'Admin' }) => {
    try {
        const { email, name } = await resolveVendorRecipient(vendor);
        if (!email) return;

        const reqId = request.requestId || request._id;
        const html = getSourceNowTemplate({
            title: 'You Have Been Handpicked to Submit a Quote',
            subtitle: `The PLE Commercial Desk invited you to quote on Request #${reqId}.`,
            recipientName: name,
            requestId: reqId,
            productName: request.productName,
            category: request.category,
            quantity: request.quantity,
            budget: request.expectedBudget,
            statusText: 'Direct Invitation',
            badgeColor: '#7c3aed',
            message: `Based on your excellent merchant rating and product catalog, our procurement desk has specifically invited your store to provide a quotation for this order.`,
            actionUrl: `${CLIENT_URL}/vendor/product-requests/${reqId}`,
            actionText: 'Submit Your Best Quote'
        });

        return await sendEmail({
            to: email,
            subject: `Invitation to Quote [#${reqId}]: ${request.productName}`,
            html,
            recipientType: 'vendor',
            template: 'vendor_sourcing_invited',
            idempotencyKey: `v_sn_inv_${vendor?._id || vendor}_${reqId}`,
            metadata: { requestId: reqId, itemNumber: 207 }
        });
    } catch (err) {
        console.error('[SourcingNotification] sendVendorInvitedToQuoteEmail error:', err.message);
    }
};

/**
 * Item 208: Vendor quote submitted confirmation
 */
export const sendVendorQuoteSubmittedEmail = async ({ vendor, request, quotation }) => {
    try {
        const { email, name } = await resolveVendorRecipient(vendor);
        if (!email) return;

        const reqId = request.requestId || request._id;
        const html = getSourceNowTemplate({
            title: 'Quotation Successfully Submitted',
            subtitle: 'Your pricing proposal has been recorded.',
            recipientName: name,
            requestId: reqId,
            productName: request.productName,
            quantity: request.quantity,
            statusText: 'Quote Submitted',
            badgeColor: '#16a34a',
            message: 'Thank you for submitting your quote. The procurement team and customer are evaluating responses. You will be alerted upon selection.',
            quoteDetails: {
                price: quotation.totalPrice || quotation.offeredPrice,
                deliveryTimeline: quotation.deliveryTimeline || quotation.deliveryEstimate || 'Standard',
                notes: quotation.notes || quotation.message
            },
            actionUrl: `${CLIENT_URL}/vendor/product-requests/${reqId}`,
            actionText: 'View Submitted Proposal'
        });

        return await sendEmail({
            to: email,
            subject: `Quote Confirmation [#${reqId}] - ₹${quotation.totalPrice || quotation.offeredPrice}`,
            html,
            recipientType: 'vendor',
            template: 'vendor_quote_submitted',
            idempotencyKey: `v_sn_sub_${vendor?._id || vendor}_${reqId}`,
            metadata: { requestId: reqId, itemNumber: 208 }
        });
    } catch (err) {
        console.error('[SourcingNotification] sendVendorQuoteSubmittedEmail error:', err.message);
    }
};

/**
 * Item 209: Quote deadline approaching
 */
export const sendVendorQuoteDeadlineApproachingEmail = async ({ vendor, request, hoursRemaining = 24 }) => {
    try {
        const { email, name } = await resolveVendorRecipient(vendor);
        if (!email) return;

        const reqId = request.requestId || request._id;
        const html = getSourceNowTemplate({
            title: 'Deadline Approaching: Submit Your Sourcing Quote',
            subtitle: `Less than ${hoursRemaining} hours remaining in this sourcing window.`,
            recipientName: name,
            requestId: reqId,
            productName: request.productName,
            category: request.category,
            quantity: request.quantity,
            budget: request.expectedBudget,
            statusText: 'Expiring Soon',
            badgeColor: '#ea580c',
            message: `The quotation submission window for request #${reqId} is closing soon. Don't miss this commercial opportunity to supply ${request.quantity} units.`,
            actionUrl: `${CLIENT_URL}/vendor/product-requests/${reqId}`,
            actionText: 'Submit Quotation Now'
        });

        return await sendEmail({
            to: email,
            subject: `URGENT: Sourcing Quote Closing in ${hoursRemaining}h [#${reqId}]`,
            html,
            recipientType: 'vendor',
            template: 'vendor_deadline_approaching',
            idempotencyKey: `v_sn_dead_${vendor?._id || vendor}_${reqId}`,
            metadata: { requestId: reqId, itemNumber: 209 }
        });
    } catch (err) {
        console.error('[SourcingNotification] sendVendorQuoteDeadlineApproachingEmail error:', err.message);
    }
};

/**
 * Item 210: Quote deadline passed
 */
export const sendVendorQuoteDeadlinePassedEmail = async ({ vendor, request }) => {
    try {
        const { email, name } = await resolveVendorRecipient(vendor);
        if (!email) return;

        const reqId = request.requestId || request._id;
        const html = getSourceNowTemplate({
            title: 'Sourcing Quotation Window Has Closed',
            subtitle: 'New quote submissions are no longer accepted for this request.',
            recipientName: name,
            requestId: reqId,
            productName: request.productName,
            statusText: 'Window Closed',
            badgeColor: '#64748b',
            message: `The window for product request #${reqId} has ended. Visit the vendor portal to review current open opportunities.`,
            actionUrl: `${CLIENT_URL}/vendor/product-requests`,
            actionText: 'Browse Open Inquiries'
        });

        return await sendEmail({
            to: email,
            subject: `Sourcing Window Closed [#${reqId}] - ${request.productName}`,
            html,
            recipientType: 'vendor',
            template: 'vendor_deadline_passed',
            idempotencyKey: `v_sn_passed_${vendor?._id || vendor}_${reqId}`,
            metadata: { requestId: reqId, itemNumber: 210 }
        });
    } catch (err) {
        console.error('[SourcingNotification] sendVendorQuoteDeadlinePassedEmail error:', err.message);
    }
};

/**
 * Item 211: Vendor selected
 */
export const sendVendorSelectedEmail = async ({ vendor, request, quote }) => {
    try {
        const { email, name } = await resolveVendorRecipient(vendor);
        if (!email) return;

        const reqId = request.requestId || request._id;
        const html = getSourceNowTemplate({
            title: '🎉 Congratulations! Your Quotation Has Been Selected',
            subtitle: 'You have been awarded this fulfillment order.',
            recipientName: name,
            requestId: reqId,
            productName: request.productName,
            quantity: request.quantity,
            statusText: 'Vendor Selected',
            badgeColor: '#16a34a',
            message: 'Your quote was accepted by the client. Please begin order fulfillment preparations according to the agreed schedule and terms.',
            quoteDetails: quote ? {
                price: quote.finalPrice || quote.totalPrice || quote.offeredPrice,
                deliveryTimeline: quote.estimatedDelivery || quote.deliveryTimeline
            } : null,
            actionUrl: `${CLIENT_URL}/vendor/product-requests/${reqId}`,
            actionText: 'View Order & Prepare Shipment'
        });

        return await sendEmail({
            to: email,
            subject: `Order Awarded [#${reqId}]: Your Quote Was Selected!`,
            html,
            recipientType: 'vendor',
            template: 'vendor_selected',
            idempotencyKey: `v_sn_sel_${vendor?._id || vendor}_${reqId}`,
            metadata: { requestId: reqId, itemNumber: 211 }
        });
    } catch (err) {
        console.error('[SourcingNotification] sendVendorSelectedEmail error:', err.message);
    }
};

/**
 * Item 212: Vendor not selected
 */
export const sendVendorNotSelectedEmail = async ({ vendor, request, reason }) => {
    try {
        const { email, name } = await resolveVendorRecipient(vendor);
        if (!email) return;

        const reqId = request.requestId || request._id;
        const html = getSourceNowTemplate({
            title: 'Sourcing Selection Outcome: Request Closed',
            subtitle: 'Another supplier was chosen for this specific opportunity.',
            recipientName: name,
            requestId: reqId,
            productName: request.productName,
            statusText: 'Not Selected',
            badgeColor: '#6b7280',
            message: reason || 'Thank you for your quotation. On this occasion, another proposal was selected based on pricing or lead time. We appreciate your participation and invite you to quote on upcoming inquiries.',
            actionUrl: `${CLIENT_URL}/vendor/product-requests`,
            actionText: 'View More Opportunities'
        });

        return await sendEmail({
            to: email,
            subject: `Sourcing Update [#${reqId}] - Selection Concluded`,
            html,
            recipientType: 'vendor',
            template: 'vendor_not_selected',
            idempotencyKey: `v_sn_notsel_${vendor?._id || vendor}_${reqId}`,
            metadata: { requestId: reqId, itemNumber: 212 }
        });
    } catch (err) {
        console.error('[SourcingNotification] sendVendorNotSelectedEmail error:', err.message);
    }
};


// ══════════════════════════════════════════════════════════════════════════════
// 3. CUSTOMER / RFQ NOTIFICATIONS (Items 213–219)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Item 213: RFQ submitted
 */
export const sendRfqSubmittedEmail = async ({ customer, rfq }) => {
    try {
        const { email, name } = await resolveUserRecipient(customer || rfq?.buyerId);
        if (!email) return;

        const rfqId = rfq.rfqId || rfq._id;
        const html = getRfqTemplate({
            title: 'Your Request For Quotation (RFQ) Was Submitted',
            subtitle: 'Our commercial vendor network is reviewing your inquiry.',
            recipientName: name,
            rfqId,
            productName: rfq.customProductName || rfq.productId?.name || 'Bulk Procurement Item',
            quantity: rfq.quantity,
            targetPrice: rfq.targetPrice,
            statusText: 'RFQ Submitted',
            badgeColor: '#2563eb',
            message: 'Your RFQ has been successfully logged into the PLE B2B Commercial Portal. Participating vendors have been notified to submit competitive pricing.',
            actionUrl: `${CLIENT_URL}/rfq/${rfqId}`,
            actionText: 'View RFQ In Portal'
        });

        return await sendEmail({
            to: email,
            subject: `RFQ Submitted [#${rfqId}]: ${rfq.customProductName || 'Bulk Procurement'}`,
            html,
            recipientType: 'customer',
            template: 'rfq_submitted',
            idempotencyKey: `rfq_sub_${rfqId}`,
            metadata: { rfqId, itemNumber: 213 }
        });
    } catch (err) {
        console.error('[SourcingNotification] sendRfqSubmittedEmail error:', err.message);
    }
};

/**
 * Item 214: RFQ received (official commercial validation)
 */
export const sendRfqReceivedEmail = async ({ customer, rfq }) => {
    try {
        const { email, name } = await resolveUserRecipient(customer || rfq?.buyerId);
        if (!email) return;

        const rfqId = rfq.rfqId || rfq._id;
        const html = getRfqTemplate({
            title: 'RFQ Officially Received & In Market Review',
            subtitle: 'Verified vendors assigned to your inquiry.',
            recipientName: name,
            rfqId,
            productName: rfq.customProductName || rfq.productId?.name || 'Bulk Procurement Item',
            quantity: rfq.quantity,
            targetPrice: rfq.targetPrice,
            statusText: 'In Market',
            badgeColor: '#0284c7',
            message: 'Your RFQ specifications have been dispatched to qualified suppliers. You will be notified as suppliers submit quotes.',
            actionUrl: `${CLIENT_URL}/rfq/${rfqId}`,
            actionText: 'Check Quotation Status'
        });

        return await sendEmail({
            to: email,
            subject: `RFQ Verified & Dispatched [#${rfqId}] - PLE Commercial`,
            html,
            recipientType: 'customer',
            template: 'rfq_received',
            idempotencyKey: `rfq_rec_${rfqId}`,
            metadata: { rfqId, itemNumber: 214 }
        });
    } catch (err) {
        console.error('[SourcingNotification] sendRfqReceivedEmail error:', err.message);
    }
};

/**
 * Item 215: Vendor response received
 */
export const sendRfqVendorResponseReceivedEmail = async ({ customer, rfq, quotation }) => {
    try {
        const { email, name } = await resolveUserRecipient(customer || rfq?.buyerId);
        if (!email) return;

        const rfqId = rfq.rfqId || rfq._id;
        const html = getRfqTemplate({
            title: 'New Vendor Quotation Received for Your RFQ',
            subtitle: `${quotation.vendorName || 'A supplier'} has responded to your request.`,
            recipientName: name,
            rfqId,
            productName: rfq.customProductName || rfq.productId?.name || 'Bulk Procurement Item',
            quantity: rfq.quantity,
            statusText: 'Quote Received',
            badgeColor: '#10b981',
            message: `A new commercial quote of ₹${quotation.totalPrice} has arrived for RFQ #${rfqId}. Compare terms and negotiate directly via the buyer portal.`,
            quotations: [quotation],
            actionUrl: `${CLIENT_URL}/rfq/${rfqId}`,
            actionText: 'Inspect & Compare Quote'
        });

        return await sendEmail({
            to: email,
            subject: `Quote Received for RFQ [#${rfqId}]: ₹${quotation.totalPrice}`,
            html,
            recipientType: 'customer',
            template: 'rfq_vendor_response',
            idempotencyKey: `rfq_resp_${rfqId}_${quotation.vendorId || Date.now().toString().slice(0, 6)}`,
            metadata: { rfqId, itemNumber: 215 }
        });
    } catch (err) {
        console.error('[SourcingNotification] sendRfqVendorResponseReceivedEmail error:', err.message);
    }
};

/**
 * Item 216: Multiple quotes available
 */
export const sendRfqMultipleQuotesAvailableEmail = async ({ customer, rfq, quotations = [] }) => {
    try {
        const { email, name } = await resolveUserRecipient(customer || rfq?.buyerId);
        if (!email) return;

        const rfqId = rfq.rfqId || rfq._id;
        const html = getRfqTemplate({
            title: 'Multiple Quotations Available for Your RFQ',
            subtitle: `${quotations.length} competitive proposals ready for evaluation.`,
            recipientName: name,
            rfqId,
            productName: rfq.customProductName || rfq.productId?.name || 'Bulk Procurement Item',
            quantity: rfq.quantity,
            statusText: 'Quotes Ready',
            badgeColor: '#059669',
            message: `Multiple suppliers have submitted formal bids for RFQ #${rfqId}. Review their unit rates, delivery timelines, and warranty terms to select the best partner.`,
            quotations,
            actionUrl: `${CLIENT_URL}/rfq/${rfqId}`,
            actionText: 'Compare All Quotes'
        });

        return await sendEmail({
            to: email,
            subject: `${quotations.length} Quotes Available for RFQ [#${rfqId}]`,
            html,
            recipientType: 'customer',
            template: 'rfq_multiple_quotes',
            idempotencyKey: `rfq_multi_${rfqId}_${quotations.length}`,
            metadata: { rfqId, itemNumber: 216 }
        });
    } catch (err) {
        console.error('[SourcingNotification] sendRfqMultipleQuotesAvailableEmail error:', err.message);
    }
};

/**
 * Item 217: RFQ expired
 */
export const sendRfqExpiredEmail = async ({ customer, rfq }) => {
    try {
        const { email, name } = await resolveUserRecipient(customer || rfq?.buyerId);
        if (!email) return;

        const rfqId = rfq.rfqId || rfq._id;
        const html = getRfqTemplate({
            title: 'RFQ Validity Window Has Expired',
            subtitle: 'The target submission date has concluded.',
            recipientName: name,
            rfqId,
            productName: rfq.customProductName || rfq.productId?.name || 'Bulk Procurement Item',
            statusText: 'RFQ Expired',
            badgeColor: '#dc2626',
            message: `The bidding window for RFQ #${rfqId} has expired. If you still require these items, you can re-open or duplicate this inquiry with fresh timelines.`,
            actionUrl: `${CLIENT_URL}/rfq/${rfqId}`,
            actionText: 'Re-Open Inquiry'
        });

        return await sendEmail({
            to: email,
            subject: `RFQ Expired [#${rfqId}] - PLE Commercial`,
            html,
            recipientType: 'customer',
            template: 'rfq_expired',
            idempotencyKey: `rfq_exp_${rfqId}`,
            metadata: { rfqId, itemNumber: 217 }
        });
    } catch (err) {
        console.error('[SourcingNotification] sendRfqExpiredEmail error:', err.message);
    }
};

/**
 * Item 218: RFQ accepted
 */
export const sendRfqAcceptedEmail = async ({ customer, vendor, rfq, quotation }) => {
    try {
        const custRecipient = await resolveUserRecipient(customer || rfq?.buyerId);
        const rfqId = rfq.rfqId || rfq._id;

        if (custRecipient.email) {
            const html = getRfqTemplate({
                title: 'RFQ Accepted & Purchase Order Initiated',
                subtitle: `Proposal from ${quotation?.vendorName || 'Selected Vendor'} has been confirmed.`,
                recipientName: custRecipient.name,
                rfqId,
                productName: rfq.customProductName || rfq.productId?.name || 'Bulk Procurement Item',
                quantity: rfq.quantity,
                statusText: 'RFQ Accepted',
                badgeColor: '#16a34a',
                message: 'You have successfully approved the quotation. A formal Purchase Order has been issued to the supplier.',
                selectedQuotation: quotation,
                actionUrl: `${CLIENT_URL}/rfq/${rfqId}`,
                actionText: 'View Purchase Order'
            });

            await sendEmail({
                to: custRecipient.email,
                subject: `RFQ Accepted [#${rfqId}] - Purchase Order Created`,
                html,
                recipientType: 'customer',
                template: 'rfq_accepted_customer',
                idempotencyKey: `rfq_acc_c_${rfqId}`,
                metadata: { rfqId, itemNumber: 218 }
            });
        }

        // Also notify the winning vendor
        if (vendor || quotation?.vendorId) {
            const vendRecipient = await resolveVendorRecipient(vendor || quotation?.vendorId);
            if (vendRecipient.email) {
                const vendHtml = getRfqTemplate({
                    title: '🎉 Your RFQ Quotation Has Been Accepted!',
                    subtitle: `Customer accepted your bid for RFQ #${rfqId}.`,
                    recipientName: vendRecipient.name,
                    rfqId,
                    productName: rfq.customProductName || rfq.productId?.name || 'Bulk Procurement Item',
                    quantity: rfq.quantity,
                    statusText: 'Bid Accepted',
                    badgeColor: '#16a34a',
                    message: 'Great news! The buyer has accepted your commercial quotation. Prepare the order and follow shipping instructions.',
                    selectedQuotation: quotation,
                    actionUrl: `${CLIENT_URL}/vendor/rfq/${rfqId}`,
                    actionText: 'Process Purchase Order'
                });

                await sendEmail({
                    to: vendRecipient.email,
                    subject: `RFQ Won [#${rfqId}]: Order Confirmed by Buyer!`,
                    html: vendHtml,
                    recipientType: 'vendor',
                    template: 'rfq_accepted_vendor',
                    idempotencyKey: `rfq_acc_v_${rfqId}`,
                    metadata: { rfqId, itemNumber: 218 }
                });
            }
        }
    } catch (err) {
        console.error('[SourcingNotification] sendRfqAcceptedEmail error:', err.message);
    }
};

/**
 * Item 219: RFQ rejected
 */
export const sendRfqRejectedEmail = async ({ customer, vendor, rfq, reason }) => {
    try {
        const custRecipient = await resolveUserRecipient(customer || rfq?.buyerId);
        const rfqId = rfq.rfqId || rfq._id;

        if (custRecipient.email) {
            const html = getRfqTemplate({
                title: 'RFQ Closed / Cancelled',
                subtitle: 'This commercial inquiry has been concluded.',
                recipientName: custRecipient.name,
                rfqId,
                productName: rfq.customProductName || rfq.productId?.name || 'Bulk Procurement Item',
                statusText: 'RFQ Closed',
                badgeColor: '#6b7280',
                message: reason || 'This RFQ has been marked as closed or rejected.',
                actionUrl: `${CLIENT_URL}/rfq`,
                actionText: 'Browse RFQs'
            });

            return await sendEmail({
                to: custRecipient.email,
                subject: `RFQ Closed [#${rfqId}] - PLE Commercial`,
                html,
                recipientType: 'customer',
                template: 'rfq_rejected',
                idempotencyKey: `rfq_rej_${rfqId}`,
                metadata: { rfqId, itemNumber: 219 }
            });
        }
        return { success: false, reason: 'No recipient email' };
    } catch (err) {
        console.error('[SourcingNotification] sendRfqRejectedEmail error:', err.message);
    }
};
