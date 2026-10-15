/**
 * Central Vendor Notification Service
 * Peoples League of Electronics (PLE)
 * 
 * Implements Master Checklist Items 62–129:
 * 1. Vendor Onboarding, KYC & Account Lifecycle (Items 62-75)
 * 2. Products, Listings & Stock Alerts (Items 76-89)
 * 3. Orders & Fulfillment with Strict Multi-Vendor Item Isolation (Items 90-108)
 * 4. Returns & Replacements for Vendors (Items 104-119)
 * 5. Settlements, Payouts & Commission Invoices (Items 120-129)
 */

import { sendEmail } from './email.service.js';
import {
    getVendorOnboardingTemplate,
    getVendorProductTemplate,
    getVendorOrderTemplate,
    getVendorReturnTemplate,
    getVendorPayoutTemplate,
} from '../utils/vendorEmailTemplates.js';

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

/**
 * Safely extracts a clean string ID from an ObjectId, string, or entity object
 */
export const toCleanId = (val) => {
    if (!val) return '';
    if (typeof val === 'object') {
        const inner = val._id || val.vendorId || val.id;
        return inner ? String(inner).trim() : '';
    }
    return String(val).trim();
};

/**
 * Safely resolves vendor recipient (email and name) from vendor object or ID
 */
export const resolveVendorRecipient = async (entity) => {
    if (!entity) return { email: null, name: 'Merchant Partner', storeName: '', vendorId: '' };

    let vendor = entity;
    if (typeof entity === 'string' || (entity._id && !entity.email)) {
        try {
            const Vendor = (await import('../models/Vendor.model.js')).default;
            vendor = await Vendor.findById(entity._id || entity).select('email name storeName businessName phone').lean();
        } catch (e) {
            console.error('[VendorNotification] Failed to query Vendor model:', e.message);
        }
    }

    const email = vendor?.email ? String(vendor.email).trim().toLowerCase() : null;
    const name = vendor?.name || vendor?.ownerName || 'Merchant Partner';
    const storeName = vendor?.storeName || vendor?.businessName || '';
    const resolvedVendorId = toCleanId(vendor) || toCleanId(entity);

    return { email, name, storeName, vendorId: resolvedVendorId };
};

// ─── 1. ONBOARDING & ACCOUNT LIFECYCLE (Items 62–75) ──────────────────────────

/**
 * Item 62: Vendor Application Received
 */
export const sendVendorRegistrationReceivedEmail = async ({ vendor }) => {
    const { email, name, storeName } = await resolveVendorRecipient(vendor);
    if (!email) return;

    const html = getVendorOnboardingTemplate({
        vendorName: name,
        storeName,
        title: 'Application Received — Welcome to PLE Seller Network',
        badgeText: 'Application Submitted',
        badgeColor: 'blue',
        message: 'Thank you for submitting your merchant application to sell on Peoples League of Electronics. Our onboarding compliance team is reviewing your profile and business details.',
        details: [
            { label: 'Store Name', value: storeName || name },
            { label: 'Application Date', value: new Date().toLocaleDateString('en-IN') },
            { label: 'Review SLA', value: '24–48 Business Hours' },
        ],
        actionUrl: `${CLIENT_URL}/vendor/login`,
        actionText: 'Access Vendor Dashboard',
    });

    return await sendEmail({
        to: email,
        subject: `Vendor Application Received: Welcome to PLE Seller Network 🎉`,
        html,
        text: `Your application to join PLE Seller Network has been received. Our compliance team will review your details within 24-48 business hours.`,
        recipientType: 'vendor',
        template: 'vendor_application_received',
        idempotencyKey: `vendor_app_rec_${vendor?._id || email}`,
        metadata: { vendorId: vendor?._id },
    });
};

/**
 * Items 63, 68–72: Vendor Application & Account Status (Under review, Approved, Rejected, Suspended, Activated)
 */
export const sendVendorApplicationStatusEmail = async ({ vendor, status, reason }) => {
    const { email, name, storeName } = await resolveVendorRecipient(vendor);
    if (!email) return;

    const normalizedStatus = String(status).toLowerCase();
    const configMap = {
        under_review: {
            title: 'Application Under Compliance Review',
            badge: 'Under Review',
            color: 'amber',
            msg: 'Your application is currently under review by our onboarding operations team.',
            subj: 'Vendor Application Under Review',
        },
        approved: {
            title: 'Congratulations! Your Vendor Account is Approved 🎉',
            badge: 'Account Approved',
            color: 'green',
            msg: 'Your merchant account has been approved. You can now configure your store catalog, upload products, and start receiving customer orders.',
            subj: 'Vendor Account Approved: Start Selling on PLE',
        },
        rejected: {
            title: 'Update on Your Vendor Application',
            badge: 'Application Rejected',
            color: 'red',
            msg: `After review, we could not approve your merchant application at this time.${reason ? ` Reason: ${reason}` : ''}`,
            subj: 'PLE Vendor Application Status Update',
        },
        suspended: {
            title: 'Notice: Vendor Account Suspended',
            badge: 'Account Suspended',
            color: 'red',
            msg: `Your merchant account has been temporarily suspended.${reason ? ` Reason: ${reason}` : ' Please contact merchant operations.'}`,
            subj: 'Important: Your PLE Vendor Account Has Been Suspended',
        },
        active: {
            title: 'Vendor Account Reactivated',
            badge: 'Account Active',
            color: 'green',
            msg: 'Your vendor account has been reactivated. You can continue managing your products and processing orders.',
            subj: 'PLE Vendor Account Reactivated',
        },
    };

    const cfg = configMap[normalizedStatus] || {
        title: `Vendor Account Status: ${status}`,
        badge: status.toUpperCase(),
        color: 'blue',
        msg: `Your vendor account status was updated to ${status}.${reason ? ` Reason: ${reason}` : ''}`,
        subj: `Vendor Account Update: ${status}`,
    };

    const html = getVendorOnboardingTemplate({
        vendorName: name,
        storeName,
        title: cfg.title,
        badgeText: cfg.badge,
        badgeColor: cfg.color,
        message: cfg.msg,
        details: [
            { label: 'Store Name', value: storeName || name },
            { label: 'Status', value: normalizedStatus.toUpperCase() },
            { label: 'Effective Date', value: new Date().toLocaleDateString('en-IN') },
            ...(reason ? [{ label: 'Remarks / Reason', value: reason }] : []),
        ],
        actionUrl: `${CLIENT_URL}/vendor/login`,
        actionText: normalizedStatus === 'approved' ? 'Launch Store Dashboard' : 'View Account',
    });

    return await sendEmail({
        to: email,
        subject: cfg.subj,
        html,
        text: cfg.msg,
        recipientType: 'vendor',
        template: `vendor_status_${normalizedStatus}`,
        metadata: { vendorId: vendor?._id, status: normalizedStatus },
    });
};

/**
 * Items 64–67: KYC Document Status (Required, Approved, Rejected, Failed)
 */
export const sendVendorKycStatusEmail = async ({ vendor, documentName, status, reason }) => {
    const { email, name, storeName } = await resolveVendorRecipient(vendor);
    if (!email) return;

    const normalized = String(status).toLowerCase();
    const isApproved = normalized === 'approved';

    const html = getVendorOnboardingTemplate({
        vendorName: name,
        storeName,
        title: isApproved ? 'KYC Document Verified' : 'KYC Document Verification Update',
        badgeText: `KYC ${normalized.toUpperCase()}`,
        badgeColor: isApproved ? 'green' : (normalized === 'rejected' ? 'red' : 'amber'),
        message: isApproved
            ? `Your verification document "${documentName || 'KYC Document'}" has been successfully verified by our compliance team.`
            : `Your verification document "${documentName || 'KYC Document'}" was ${normalized}.${reason ? ` Reason: ${reason}` : ' Please re-upload a clear copy in the seller portal.'}`,
        details: [
            { label: 'Document Name', value: documentName || 'KYC File' },
            { label: 'Verification Status', value: normalized.toUpperCase() },
            ...(reason ? [{ label: 'Rejection Reason', value: reason }] : []),
            { label: 'Action Required', value: isApproved ? 'None' : 'Re-upload Valid Document' },
        ],
        actionUrl: `${CLIENT_URL}/vendor/documents`,
        actionText: isApproved ? 'View Documents' : 'Re-upload Document',
    });

    return await sendEmail({
        to: email,
        subject: `KYC Document ${isApproved ? 'Approved' : 'Action Required'}: ${documentName || 'Document'}`,
        html,
        text: `Your KYC document ${documentName} status: ${status}. ${reason || ''}`,
        recipientType: 'vendor',
        template: `vendor_kyc_${normalized}`,
        metadata: { vendorId: vendor?._id, documentName, status: normalized },
    });
};

/**
 * Items 70–72: Bank Details Updated / Verified / Rejected
 */
export const sendVendorBankDetailsEmail = async ({ vendor, status, reason, bankName, accountNumberLast4 }) => {
    const { email, name, storeName } = await resolveVendorRecipient(vendor);
    if (!email) return;

    const isVerified = status === 'verified' || status === 'approved';

    const html = getVendorOnboardingTemplate({
        vendorName: name,
        storeName,
        title: isVerified ? 'Bank Account Verified for Payouts' : 'Bank Account Details Updated',
        badgeText: `Bank Details ${String(status).toUpperCase()}`,
        badgeColor: isVerified ? 'green' : (status === 'rejected' ? 'red' : 'amber'),
        message: isVerified
            ? 'Your bank account has been verified. Future order settlements will be credited directly to this account.'
            : `Your bank account update is currently ${status}.${reason ? ` Reason: ${reason}` : ''}`,
        details: [
            { label: 'Bank Name', value: bankName || 'Bank of Record' },
            { label: 'Account Number', value: accountNumberLast4 ? `•••• •••• •••• ${accountNumberLast4}` : 'Updated' },
            { label: 'Status', value: String(status).toUpperCase() },
            ...(reason ? [{ label: 'Notes', value: reason }] : []),
        ],
        actionUrl: `${CLIENT_URL}/vendor/settings`,
        actionText: 'Review Bank Settings',
    });

    return await sendEmail({
        to: email,
        subject: `Vendor Bank Account Details ${isVerified ? 'Verified' : 'Updated'}`,
        html,
        text: `Your bank details for ${storeName || name} are ${status}.`,
        recipientType: 'vendor',
        template: `vendor_bank_${status}`,
        metadata: { vendorId: vendor?._id, status },
    });
};

// ─── 2. PRODUCTS, LISTINGS & INVENTORY (Items 76–89) ──────────────────────────

/**
 * Items 76–81: Product Review Decision (Submitted, Approved, Rejected, Policy Warning)
 */
export const sendVendorProductReviewEmail = async ({ vendor, product, status, reason }) => {
    const { email, name } = await resolveVendorRecipient(vendor || product?.vendorId);
    if (!email || !product) return;

    const normalized = String(status).toLowerCase();
    const isApproved = normalized === 'approved';

    const html = getVendorProductTemplate({
        vendorName: name,
        productName: product.name,
        sku: product.sku || product._id,
        title: isApproved ? 'Product Listing Approved 🎉' : `Product Listing ${status.toUpperCase()}`,
        badgeText: `Product ${normalized.toUpperCase()}`,
        badgeColor: isApproved ? 'green' : (normalized === 'rejected' ? 'red' : 'amber'),
        message: isApproved
            ? 'Your product listing has passed quality and catalog compliance checks and is now live for buyers.'
            : `Your product listing was ${normalized}.${reason ? ` Reason: ${reason}` : ' Please update the listing and resubmit.'}`,
        details: [
            { label: 'Product Title', value: product.name },
            { label: 'Selling Price', value: product.price ? `₹${Number(product.price).toLocaleString('en-IN')}` : 'N/A' },
            { label: 'Status', value: normalized.toUpperCase() },
            ...(reason ? [{ label: 'Compliance Notes', value: reason }] : []),
        ],
        actionUrl: `${CLIENT_URL}/vendor/products`,
        actionText: 'View Product in Portal',
    });

    return await sendEmail({
        to: email,
        subject: `Product Listing ${isApproved ? 'Approved' : 'Update'}: ${product.name}`,
        html,
        text: `Your product listing "${product.name}" status: ${status}. ${reason || ''}`,
        recipientType: 'vendor',
        template: `vendor_product_${normalized}`,
        metadata: { productId: product._id, status: normalized },
    });
};

/**
 * Items 85 & 86: Low Stock & Out of Stock Alerts
 */
export const sendVendorStockAlertEmail = async ({ vendor, product, type, currentStock, threshold }) => {
    const { email, name } = await resolveVendorRecipient(vendor || product?.vendorId);
    if (!email || !product) return;

    const isOutOfStock = type === 'out_of_stock' || currentStock <= 0;

    const html = getVendorProductTemplate({
        vendorName: name,
        productName: product.name,
        sku: product.sku || product._id,
        title: isOutOfStock ? '🚨 Out of Stock Alert: Replenishment Needed' : '⚠️ Low Stock Alert',
        badgeText: isOutOfStock ? 'OUT OF STOCK' : 'LOW STOCK',
        badgeColor: isOutOfStock ? 'red' : 'amber',
        message: isOutOfStock
            ? 'Your listing has run out of stock and has been marked unavailable for purchase on the customer storefront. Restock immediately to resume sales.'
            : `Your listing inventory has dropped to ${currentStock} units (threshold: ${threshold || 10} units). Restock soon to prevent order interruptions.`,
        details: [
            { label: 'Current Inventory', value: `${currentStock} Units` },
            { label: 'Listing Status', value: isOutOfStock ? 'Inactive (Zero Stock)' : 'Active (Depleting)' },
        ],
        actionUrl: `${CLIENT_URL}/vendor/inventory`,
        actionText: 'Update Stock Quantity',
    });

    return await sendEmail({
        to: email,
        subject: `${isOutOfStock ? '🚨 Out of Stock' : '⚠️ Low Stock'}: ${product.name}`,
        html,
        text: `Stock alert for ${product.name}: ${currentStock} units remaining. Restock at ${CLIENT_URL}/vendor/inventory`,
        recipientType: 'vendor',
        template: isOutOfStock ? 'vendor_stock_out' : 'vendor_stock_low',
        idempotencyKey: `vendor_stock_${product._id}_${isOutOfStock ? 'out' : 'low'}_${currentStock}`,
        metadata: { productId: product._id, currentStock },
    });
};

// ─── 3. ORDERS & FULFILLMENT WITH MULTI-VENDOR ISOLATION (Items 90–108) ────────

/**
 * Items 90 & 91: New Order Received (MULTI-VENDOR ITEM ISOLATION)
 * Strictly isolates and displays ONLY the items and subtotal allocated to this specific vendor.
 */
export const sendVendorNewOrderNotification = async ({ vendorId, order }) => {
    if (!vendorId || !order) return;
    const { email, name, vendorId: resolvedId } = await resolveVendorRecipient(vendorId);
    if (!email) return;

    const targetVendorId = toCleanId(vendorId) || toCleanId(resolvedId);
    const orderId = order.orderId || order._id;

    // Isolate vendor items for this vendor
    const vendorSubOrder = (order.vendorItems || []).find(
        (vi) => toCleanId(vi.vendorId) === targetVendorId
    );

    const isolatedItems = vendorSubOrder?.items || (order.items || []).filter(
        (it) => toCleanId(it.vendorId) === targetVendorId
    );

    const subtotal = vendorSubOrder?.subtotal !== undefined
        ? Number(vendorSubOrder.subtotal)
        : isolatedItems.reduce(
            (sum, it) => sum + (Number(it.price || 0) * Number(it.quantity || 1)), 0
        );

    const html = getVendorOrderTemplate({
        vendorName: name,
        orderId,
        title: 'New Order Received for Your Products 📦',
        badgeText: 'New Order',
        badgeColor: 'green',
        message: 'You have received a new customer order. Please review the items below, confirm availability, and prepare for shipment within your SLA deadline.',
        vendorItems: isolatedItems,
        vendorSubtotal: subtotal,
        shippingDeadline: 'Within 24 Hours',
        details: [
            { label: 'Order Number', value: `#${orderId}` },
            { label: 'Order Date', value: new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN') },
            { label: 'Payment Method', value: String(order.paymentMethod || 'PREPAID').toUpperCase() },
        ],
        actionUrl: `${CLIENT_URL}/vendor/orders/${orderId}`,
        actionText: 'Process & Pack Order',
    });

    return await sendEmail({
        to: email,
        subject: `New Order Received #${orderId} [₹${Number(subtotal).toLocaleString('en-IN')}]`,
        html,
        text: `You have received a new order #${orderId} with ${isolatedItems.length} items totaling ₹${subtotal}. Log in to fulfill: ${CLIENT_URL}/vendor/orders/${orderId}`,
        recipientType: 'vendor',
        template: 'vendor_order_received',
        idempotencyKey: `vendor_ord_${targetVendorId}_${orderId}`,
        metadata: { vendorId: targetVendorId, orderId: String(orderId), subtotal },
    });
};

/**
 * Items 85 & 86: Order Cancellation Notification for Vendor
 */
export const sendVendorOrderCancelledNotification = async ({ vendorId, order, reason }) => {
    if (!vendorId || !order) return;
    const { email, name, vendorId: resolvedId } = await resolveVendorRecipient(vendorId);
    if (!email) return;

    const targetVendorId = toCleanId(vendorId) || toCleanId(resolvedId);
    const orderId = order.orderId || order._id;

    const html = getVendorOrderTemplate({
        vendorName: name,
        orderId,
        title: 'Order Cancelled by Customer',
        badgeText: 'Order Cancelled',
        badgeColor: 'red',
        message: `Order #${orderId} has been cancelled.${reason ? ` Reason: ${reason}` : ''} Do not dispatch this package. Reserved inventory has been automatically restored.`,
        details: [
            { label: 'Order Number', value: `#${orderId}` },
            ...(reason ? [{ label: 'Cancellation Reason', value: reason }] : []),
            { label: 'Status', value: 'CANCELLED' },
        ],
        actionUrl: `${CLIENT_URL}/vendor/orders/${orderId}`,
        actionText: 'View Order Record',
    });

    return await sendEmail({
        to: email,
        subject: `Order Cancelled #${orderId}`,
        html,
        text: `Order #${orderId} has been cancelled. Please halt any pending dispatch.`,
        recipientType: 'vendor',
        template: 'vendor_order_cancelled',
        idempotencyKey: `vendor_ord_cancel_${targetVendorId}_${orderId}`,
        metadata: { vendorId: targetVendorId, orderId: String(orderId) },
    });
};

/**
 * Items 94–108: Vendor Order Fulfillment Progress (Accepted, Packed, Shipped, Delivered, RTO)
 */
export const sendVendorOrderProgressEmail = async ({ vendorId, order, stage, notes }) => {
    if (!vendorId || !order) return;
    const { email, name, vendorId: resolvedId } = await resolveVendorRecipient(vendorId);
    if (!email) return;

    const targetVendorId = toCleanId(vendorId) || toCleanId(resolvedId);
    const orderId = order.orderId || order._id;
    const stageMap = {
        accepted: { title: 'Order Confirmed by Your Store', badge: 'Confirmed', color: 'blue', subj: `Order Confirmed #${orderId}` },
        packed: { title: 'Order Marked Ready to Ship 🏷️', badge: 'Packed', color: 'blue', subj: `Order Packed #${orderId}` },
        picked_up: { title: 'Package Handed Over to Courier 🚚', badge: 'Handed Over', color: 'blue', subj: `Package Picked Up #${orderId}` },
        in_transit: { title: 'Order in Transit to Customer', badge: 'In Transit', color: 'blue', subj: `In Transit #${orderId}` },
        delivered: { title: 'Order Successfully Delivered ✅', badge: 'Delivered', color: 'green', subj: `Order Delivered #${orderId} — Earnings Recorded` },
        rto_initiated: { title: 'Return To Origin (RTO) Initiated ⚠️', badge: 'RTO Initiated', color: 'amber', subj: `RTO Initiated for Order #${orderId}` },
        rto_delivered: { title: 'RTO Package Returned to Your Hub', badge: 'RTO Delivered', color: 'amber', subj: `RTO Returned to Merchant #${orderId}` },
    };

    const cfg = stageMap[stage] || { title: `Order Update: ${stage}`, badge: stage.toUpperCase(), color: 'blue', subj: `Order Update #${orderId}` };

    const html = getVendorOrderTemplate({
        vendorName: name,
        orderId,
        title: cfg.title,
        badgeText: cfg.badge,
        badgeColor: cfg.color,
        message: notes || `Order #${orderId} has reached the '${cfg.badge}' milestone.`,
        details: [
            { label: 'Order Number', value: `#${orderId}` },
            { label: 'Milestone', value: cfg.badge },
            { label: 'Timestamp', value: new Date().toLocaleString('en-IN') },
        ],
        actionUrl: `${CLIENT_URL}/vendor/orders/${orderId}`,
        actionText: 'View Order Status',
    });

    return await sendEmail({
        to: email,
        subject: cfg.subj,
        html,
        text: `Order #${orderId} update: ${cfg.badge}. Details: ${CLIENT_URL}/vendor/orders/${orderId}`,
        recipientType: 'vendor',
        template: `vendor_fulfillment_${stage}`,
        metadata: { vendorId: targetVendorId, orderId: String(orderId), stage },
    });
};

// ─── 4. RETURNS & REPLACEMENTS (Items 109–119) ────────────────────────────────

/**
 * Items 109–119: Vendor Return Notifications (Requested, Approved, Received, Dispute)
 */
export const sendVendorReturnNotification = async ({ vendorId, order, returnRequest, status, reason }) => {
    if (!vendorId) return;
    const { email, name, vendorId: resolvedId } = await resolveVendorRecipient(vendorId);
    if (!email) return;

    const targetVendorId = toCleanId(vendorId) || toCleanId(resolvedId);
    const orderId = order?.orderId || returnRequest?.orderId?.orderId || returnRequest?.orderId || 'N/A';
    const returnId = returnRequest?.returnId || returnRequest?._id || 'N/A';

    const statusMap = {
        requested: { title: 'Customer Requested Return on Your Item', badge: 'Return Requested', color: 'amber' },
        approved: { title: 'Return Request Approved', badge: 'Return Approved', color: 'blue' },
        rejected: { title: 'Return Request Rejected', badge: 'Return Rejected', color: 'red' },
        received: { title: 'Returned Package Received at Hub', badge: 'Return Received', color: 'blue' },
        inspection_passed: { title: 'Return Quality Inspection Passed', badge: 'Inspection Passed', color: 'green' },
        dispute: { title: 'Return Dispute Raised ⚠️', badge: 'Dispute Open', color: 'red' },
    };

    const cfg = statusMap[status] || { title: 'Return Update', badge: String(status).toUpperCase(), color: 'amber' };

    const html = getVendorReturnTemplate({
        vendorName: name,
        orderId,
        returnId,
        title: cfg.title,
        badgeText: cfg.badge,
        badgeColor: cfg.color,
        message: `A return update has occurred for Order #${orderId}.${reason ? ` Reason / Remarks: ${reason}` : ''}`,
        details: [
            { label: 'Return ID', value: `#${returnId}` },
            { label: 'Order Number', value: `#${orderId}` },
            { label: 'Status', value: cfg.badge },
            ...(reason ? [{ label: 'Customer Reason', value: reason }] : []),
        ],
        actionUrl: `${CLIENT_URL}/vendor/returns/${returnId}`,
        actionText: 'Review Return in Portal',
    });

    return await sendEmail({
        to: email,
        subject: `Return Notice: ${cfg.badge} for Order #${orderId}`,
        html,
        text: `Return notification for Order #${orderId}: ${cfg.badge}. Details: ${CLIENT_URL}/vendor/returns/${returnId}`,
        recipientType: 'vendor',
        template: `vendor_return_${status}`,
        metadata: { vendorId: targetVendorId, orderId: String(orderId), returnId: String(returnId) },
    });
};

// ─── 5. SETTLEMENTS, PAYOUTS & COMMISSIONS (Items 120–129) ────────────────────

/**
 * Items 120–129: Vendor Settlement & Payout Notifications
 */
export const sendVendorSettlementNotification = async ({ vendorId, settlement, status, amount, failureReason }) => {
    if (!vendorId) return;
    const { email, name, vendorId: resolvedId } = await resolveVendorRecipient(vendorId);
    if (!email) return;

    const targetVendorId = toCleanId(vendorId) || toCleanId(resolvedId);
    const normalized = String(status).toLowerCase();
    const isCompleted = normalized === 'completed' || normalized === 'credited';

    const html = getVendorPayoutTemplate({
        vendorName: name,
        payoutId: settlement?.settlementId || settlement?._id || `SET-${Date.now()}`,
        title: isCompleted ? 'Payout Credited to Your Bank Account 💰' : `Settlement Payout ${status.toUpperCase()}`,
        badgeText: isCompleted ? 'PAYOUT CREDITED' : `PAYOUT ${normalized.toUpperCase()}`,
        badgeColor: isCompleted ? 'green' : (normalized === 'failed' ? 'red' : 'amber'),
        message: isCompleted
            ? 'Your merchant payout has been successfully credited to your verified bank account via NEFT/RTGS.'
            : `Your merchant settlement payout is currently ${normalized}.${failureReason ? ` Details: ${failureReason}` : ''}`,
        amount: Number(amount || settlement?.netPayout || 0),
        details: [
            { label: 'Settlement ID', value: settlement?.settlementId || 'N/A' },
            { label: 'Net Disbursed', value: `₹${Number(amount || settlement?.netPayout || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
            { label: 'Bank UTR / Ref', value: settlement?.utrNumber || settlement?.transactionId || 'Generated' },
            { label: 'Settlement Date', value: new Date().toLocaleDateString('en-IN') },
            ...(failureReason ? [{ label: 'Failure Reason', value: failureReason }] : []),
        ],
        actionUrl: `${CLIENT_URL}/vendor/finances`,
        actionText: 'View Payout Statement',
    });

    return await sendEmail({
        to: email,
        subject: `${isCompleted ? 'Payout Credited 💰' : 'Payout Update'}: ₹${Number(amount || 0).toLocaleString('en-IN')} [Ref: ${settlement?.settlementId || 'PLE'}]`,
        html,
        text: `Your settlement of ₹${amount} status is ${status}. Ref: ${settlement?.settlementId || 'N/A'}. Details: ${CLIENT_URL}/vendor/finances`,
        recipientType: 'vendor',
        template: `vendor_payout_${normalized}`,
        metadata: { vendorId: targetVendorId, amount, status: normalized },
    });
};
