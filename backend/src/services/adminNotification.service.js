/**
 * Central Admin & Security Notification Service
 * Peoples League of Electronics (PLE)
 * 
 * Implements Master Checklist Categories C & D (Items 130–195):
 * 1. Admin Order & Operational Alerts (Items 130–137)
 * 2. Admin Vendor Management & Compliance Alerts (Items 138–146)
 * 3. Admin Finance, Gateway & Settlement Alerts (Items 147–155)
 * 4. Speedzeel Logistics & Fulfillment Escalations (Items 156–165)
 * 5. Authentication, Account Security & Staff RBAC Alerts (Items 166–195)
 */

import { sendEmail } from './email.service.js';
import {
    getAdminAlertTemplate,
    getSecurityAlertTemplate,
} from '../utils/adminEmailTemplates.js';

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const ADMIN_URL = process.env.ADMIN_URL || `${CLIENT_URL}/admin`;

/**
 * Resolves all active admin recipient emails from environment, database settings, and Admin model
 */
export const resolveAdminRecipients = async () => {
    const recipients = new Set();

    // 1. Check environment variables
    if (process.env.ADMIN_NOTIFICATION_EMAIL) {
        process.env.ADMIN_NOTIFICATION_EMAIL.split(',').forEach((e) => {
            const clean = e.trim().toLowerCase();
            if (clean) recipients.add(clean);
        });
    }
    if (process.env.ADMIN_EMAIL) {
        process.env.ADMIN_EMAIL.split(',').forEach((e) => {
            const clean = e.trim().toLowerCase();
            if (clean) recipients.add(clean);
        });
    }

    // 2. Check Settings model for notification configuration
    try {
        const Settings = (await import('../models/Settings.model.js')).default;
        const notifSetting = await Settings.findOne({ key: 'notifications' }).lean();
        if (notifSetting?.value?.adminEmails && Array.isArray(notifSetting.value.adminEmails)) {
            notifSetting.value.adminEmails.forEach((e) => {
                const clean = String(e).trim().toLowerCase();
                if (clean) recipients.add(clean);
            });
        }
    } catch (e) {
        // Non-blocking
    }

    // 3. Check active superadmins in Admin collection
    try {
        const Admin = (await import('../models/Admin.model.js')).default;
        const activeAdmins = await Admin.find({ isActive: true, role: { $in: ['superadmin', 'admin'] } })
            .select('email')
            .lean();
        activeAdmins.forEach((a) => {
            if (a.email) recipients.add(String(a.email).trim().toLowerCase());
        });
    } catch (e) {
        // Non-blocking
    }

    // Default fallback if no admin email found in DB/env
    if (recipients.size === 0) {
        recipients.add('admin@peoplesleague.com');
    }

    return Array.from(recipients);
};

// ─── 1. ADMIN ORDER & OPERATIONAL ALERTS (Items 130–137) ──────────────────────

/**
 * Items 130–137: Admin Order Alerts
 * Handles high-value orders, suspicious orders, stuck orders, SLA breaches, shipment delays, RTOs, cancellation spikes.
 */
export const sendAdminOrderAlert = async ({ order, alertType, reason, details = [] }) => {
    if (!order) return;
    const recipients = await resolveAdminRecipients();
    if (!recipients.length) return;

    const orderId = order.orderId || order._id || 'N/A';
    const totalAmount = Number(order.totalAmount || order.payableAmount || 0);

    const typeConfig = {
        high_value: {
            title: `High-Value Order Alert: #${orderId} (₹${totalAmount.toLocaleString('en-IN')})`,
            badgeText: 'HIGH VALUE ORDER',
            badgeColor: 'blue',
            severity: 'info',
            msg: `A high-value order #${orderId} of ₹${totalAmount.toLocaleString('en-IN')} has been placed. Please monitor fulfillment and inventory allocation.`,
            actionText: 'Inspect High-Value Order',
        },
        suspicious: {
            title: `Suspicious Order Flagged: #${orderId}`,
            badgeText: 'SECURITY RISK',
            badgeColor: 'red',
            severity: 'critical',
            msg: `Order #${orderId} was flagged for suspicious activity or abnormal velocity.${reason ? ` Reason: ${reason}` : ''}`,
            actionText: 'Review Suspicious Order',
        },
        stuck: {
            title: `Order Stuck in Processing: #${orderId}`,
            badgeText: 'STUCK IN PROCESS',
            badgeColor: 'amber',
            severity: 'warning',
            msg: `Order #${orderId} has been in processing state for over SLA threshold without vendor acceptance or dispatch.`,
            actionText: 'Resolve Stuck Order',
        },
        vendor_unaccepted: {
            title: `Vendor Unaccepted Order: #${orderId}`,
            badgeText: 'ACCEPTANCE OVERDUE',
            badgeColor: 'amber',
            severity: 'warning',
            msg: `The merchant partner has not accepted Order #${orderId} within the required SLA timeframe.`,
            actionText: 'Follow Up with Vendor',
        },
        vendor_sla_breach: {
            title: `Vendor Fulfillment SLA Breached: #${orderId}`,
            badgeText: 'SLA BREACH',
            badgeColor: 'red',
            severity: 'critical',
            msg: `Fulfillment SLA deadline has expired for Order #${orderId}. Expedited escalation is required.`,
            actionText: 'Escalate SLA Breach',
        },
        shipment_delayed: {
            title: `Logistics Delay Alert: #${orderId}`,
            badgeText: 'SHIPMENT DELAY',
            badgeColor: 'amber',
            severity: 'warning',
            msg: `Carrier has reported an in-transit delay for Order #${orderId}.${reason ? ` Reason: ${reason}` : ''}`,
            actionText: 'Track Delayed Order',
        },
        rto_alert: {
            title: `RTO Initiated Alert: #${orderId}`,
            badgeText: 'RETURN TO ORIGIN',
            badgeColor: 'red',
            severity: 'warning',
            msg: `Courier has marked Order #${orderId} for Return To Origin (RTO). The parcel is returning to seller/hub.`,
            actionText: 'Manage RTO Package',
        },
        cancellation_spike: {
            title: `Abnormal Order Cancellation Spike Detected`,
            badgeText: 'CANCELLATION SPIKE',
            badgeColor: 'red',
            severity: 'critical',
            msg: `An unusual spike in order cancellations has been recorded over the last hour. Immediate operations check recommended.`,
            actionText: 'View Cancellation Analytics',
        },
    };

    const cfg = typeConfig[alertType] || {
        title: `Order Operational Alert: #${orderId}`,
        badgeText: alertType.toUpperCase(),
        badgeColor: 'amber',
        severity: 'warning',
        msg: reason || `Operational alert on Order #${orderId}.`,
        actionText: 'View Order Details',
    };

    const alertDetails = [
        { label: 'Order Number', value: `#${orderId}` },
        { label: 'Order Value', value: `₹${totalAmount.toLocaleString('en-IN')}` },
        { label: 'Payment Method', value: String(order.paymentMethod || 'PREPAID').toUpperCase() },
        { label: 'Current Status', value: String(order.orderStatus || 'PENDING').toUpperCase() },
        ...(reason ? [{ label: 'Flag / Reason', value: reason }] : []),
        ...details,
    ];

    const html = getAdminAlertTemplate({
        title: cfg.title,
        badgeText: cfg.badgeText,
        badgeColor: cfg.badgeColor,
        severity: cfg.severity,
        message: cfg.msg,
        details: alertDetails,
        actionUrl: `${ADMIN_URL}/orders/${orderId}`,
        actionText: cfg.actionText,
    });

    const results = [];
    for (const recipient of recipients) {
        const res = await sendEmail({
            to: recipient,
            subject: `[PLE Admin] ${cfg.title}`,
            html,
            text: cfg.msg,
            recipientType: 'admin',
            template: `admin_order_${alertType}`,
            idempotencyKey: `admin_ord_${alertType}_${orderId}_${recipient}`,
            metadata: { orderId: String(orderId), alertType, totalAmount },
        });
        results.push(res);
    }
    return results;
};

// ─── 2. ADMIN VENDOR COMPLIANCE & LIFECYCLE ALERTS (Items 138–146) ────────────

/**
 * Items 138–146: Admin Vendor Management Alerts
 * Handles new applications, KYC pending, KYC rejected, compliance issues, suspension recommendations, disputes, document expiry.
 */
export const sendAdminVendorAlert = async ({ vendor, alertType, reason, details = [] }) => {
    if (!vendor) return;
    const recipients = await resolveAdminRecipients();
    if (!recipients.length) return;

    const vendorId = vendor._id || vendor.vendorId || 'N/A';
    const storeName = vendor.storeName || vendor.name || vendor.businessName || 'Merchant Partner';

    const typeConfig = {
        new_application: {
            title: `New Vendor Onboarding Application: ${storeName}`,
            badgeText: 'NEW APPLICATION',
            badgeColor: 'blue',
            severity: 'info',
            msg: `A new merchant application has been submitted by "${storeName}". Compliance review is required within 48h.`,
            actionText: 'Review Merchant Profile',
        },
        kyc_pending: {
            title: `KYC Verification Pending: ${storeName}`,
            badgeText: 'KYC PENDING',
            badgeColor: 'amber',
            severity: 'warning',
            msg: `Merchant "${storeName}" has uploaded compliance documents and is awaiting KYC audit approval.`,
            actionText: 'Audit KYC Documents',
        },
        kyc_rejected: {
            title: `KYC Document Rejected: ${storeName}`,
            badgeText: 'KYC REJECTED',
            badgeColor: 'red',
            severity: 'warning',
            msg: `KYC document verification for "${storeName}" was rejected.${reason ? ` Reason: ${reason}` : ''}`,
            actionText: 'View Vendor KYC',
        },
        compliance_issue: {
            title: `Vendor Policy Violation / Compliance Issue: ${storeName}`,
            badgeText: 'POLICY VIOLATION',
            badgeColor: 'red',
            severity: 'critical',
            msg: `A compliance flag has been raised against vendor "${storeName}".${reason ? ` Details: ${reason}` : ''}`,
            actionText: 'Investigate Compliance Flag',
        },
        suspension_recommended: {
            title: `Vendor Suspension Recommended: ${storeName}`,
            badgeText: 'SUSPENSION ADVISORY',
            badgeColor: 'red',
            severity: 'critical',
            msg: `System heuristics recommend suspension for "${storeName}" due to repeated SLA breaches or customer disputes.`,
            actionText: 'Review Vendor Suspension',
        },
        vendor_sla_breach: {
            title: `Merchant SLA Escalation: ${storeName}`,
            badgeText: 'VENDOR SLA BREACH',
            badgeColor: 'amber',
            severity: 'warning',
            msg: `Vendor "${storeName}" has failed fulfillment deadlines repeatedly. Escalation threshold reached.`,
            actionText: 'Review Vendor Metrics',
        },
        dispute: {
            title: `Vendor Dispute Opened: ${storeName}`,
            badgeText: 'DISPUTE OPEN',
            badgeColor: 'red',
            severity: 'warning',
            msg: `A dispute has been initiated involving merchant "${storeName}". Admin mediation required.`,
            actionText: 'Mediate Dispute',
        },
        inactivity: {
            title: `Vendor Inactivity Alert: ${storeName}`,
            badgeText: 'VENDOR INACTIVE',
            badgeColor: 'amber',
            severity: 'info',
            msg: `Merchant "${storeName}" has had zero login or catalog activity over the past 30 days.`,
            actionText: 'Check Merchant Status',
        },
        document_expiring: {
            title: `Vendor Compliance Document Expiring: ${storeName}`,
            badgeText: 'DOCUMENT EXPIRY',
            badgeColor: 'amber',
            severity: 'warning',
            msg: `Mandatory compliance documents for "${storeName}" will expire within 15 days. Prompt renewal required.`,
            actionText: 'View Merchant Documents',
        },
    };

    const cfg = typeConfig[alertType] || {
        title: `Vendor Alert: ${storeName}`,
        badgeText: alertType.toUpperCase(),
        badgeColor: 'amber',
        severity: 'warning',
        msg: reason || `Operational alert regarding vendor ${storeName}.`,
        actionText: 'View Vendor',
    };

    const alertDetails = [
        { label: 'Store Name', value: storeName },
        { label: 'Vendor Email', value: vendor.email || 'N/A' },
        { label: 'Vendor ID', value: String(vendorId) },
        ...(reason ? [{ label: 'Details / Reason', value: reason }] : []),
        ...details,
    ];

    const html = getAdminAlertTemplate({
        title: cfg.title,
        badgeText: cfg.badgeText,
        badgeColor: cfg.badgeColor,
        severity: cfg.severity,
        message: cfg.msg,
        details: alertDetails,
        actionUrl: `${ADMIN_URL}/vendors/${vendorId}`,
        actionText: cfg.actionText,
    });

    const results = [];
    for (const recipient of recipients) {
        const res = await sendEmail({
            to: recipient,
            subject: `[PLE Admin] ${cfg.title}`,
            html,
            text: cfg.msg,
            recipientType: 'admin',
            template: `admin_vendor_${alertType}`,
            idempotencyKey: `admin_vnd_${alertType}_${vendorId}_${recipient}`,
            metadata: { vendorId: String(vendorId), alertType },
        });
        results.push(res);
    }
    return results;
};

// ─── 3. ADMIN FINANCE, GATEWAY & SETTLEMENT ALERTS (Items 147–155) ────────────

/**
 * Items 147–155: Admin Finance Escalations
 * Handles gateway failures, settlement failures, refund failures, mismatches, large refunds/orders, invoice errors.
 */
export const sendAdminFinanceAlert = async ({ alertType, amount, transactionId, reason, details = [] }) => {
    const recipients = await resolveAdminRecipients();
    if (!recipients.length) return;

    const formattedAmount = amount ? `₹${Number(amount).toLocaleString('en-IN')}` : 'N/A';

    const typeConfig = {
        pg_failure: {
            title: `Payment Gateway Transaction Failure`,
            badgeText: 'PG FAILURE',
            badgeColor: 'red',
            severity: 'critical',
            msg: `Payment gateway reported a critical transaction processing error or webhook signature failure.${reason ? ` Details: ${reason}` : ''}`,
            actionText: 'Inspect Payment Logs',
        },
        settlement_failure: {
            title: `Merchant Settlement Payout Disbursal Failed (${formattedAmount})`,
            badgeText: 'PAYOUT FAILED',
            badgeColor: 'red',
            severity: 'critical',
            msg: `An automated vendor settlement payout failed during bank disbursement.${reason ? ` Bank Error: ${reason}` : ''}`,
            actionText: 'Retry Payout Transfer',
        },
        refund_failure: {
            title: `Customer Refund Execution Failed (${formattedAmount})`,
            badgeText: 'REFUND FAILED',
            badgeColor: 'red',
            severity: 'critical',
            msg: `Payment gateway rejected the refund transaction.${reason ? ` Error: ${reason}` : ''}`,
            actionText: 'Review Failed Refund',
        },
        reconciliation_mismatch: {
            title: `Financial Reconciliation Discrepancy Flagged`,
            badgeText: 'RECONCILIATION MISMATCH',
            badgeColor: 'red',
            severity: 'critical',
            msg: `A mismatch was detected between order ledger records and gateway settlement statement.${reason ? ` Discrepancy: ${reason}` : ''}`,
            actionText: 'Open Reconciliation Ledger',
        },
        unusual_transaction: {
            title: `Unusual Financial Transaction Flagged (${formattedAmount})`,
            badgeText: 'FINANCIAL ANOMALY',
            badgeColor: 'amber',
            severity: 'warning',
            msg: `An atypical transaction amount or rapid repetition pattern was captured by risk monitoring.`,
            actionText: 'Audit Transaction',
        },
        large_refund: {
            title: `High-Value Refund Processed: ${formattedAmount}`,
            badgeText: 'LARGE REFUND',
            badgeColor: 'blue',
            severity: 'info',
            msg: `A large customer refund of ${formattedAmount} was approved and disbursed.`,
            actionText: 'View Refund Statement',
        },
        large_order: {
            title: `High-Volume Financial Order: ${formattedAmount}`,
            badgeText: 'LARGE ORDER VOLUME',
            badgeColor: 'blue',
            severity: 'info',
            msg: `An order exceeding normal volume limits was placed. Financial escrow hold confirmed.`,
            actionText: 'View Order Escrow',
        },
        settlement_discrepancy: {
            title: `Vendor Negative Balance / Settlement Discrepancy`,
            badgeText: 'DEBIT DISCREPANCY',
            badgeColor: 'amber',
            severity: 'warning',
            msg: `A merchant wallet recorded a negative balance or commission calculation discrepancy.${reason ? ` Notes: ${reason}` : ''}`,
            actionText: 'Review Vendor Wallet',
        },
        invoice_failure: {
            title: `GST Tax Invoice Generation Failure`,
            badgeText: 'INVOICE FAILED',
            badgeColor: 'red',
            severity: 'critical',
            msg: `Automated PDF generation or GST compliance signing failed for an order.${reason ? ` Error: ${reason}` : ''}`,
            actionText: 'Regenerate Invoice',
        },
    };

    const cfg = typeConfig[alertType] || {
        title: `Finance Operational Notice: ${alertType}`,
        badgeText: alertType.toUpperCase(),
        badgeColor: 'amber',
        severity: 'warning',
        msg: reason || `Financial operational alert.`,
        actionText: 'Open Finance Console',
    };

    const alertDetails = [
        ...(transactionId ? [{ label: 'Transaction / Ref ID', value: String(transactionId) }] : []),
        ...(amount ? [{ label: 'Disputed / Incurred Amount', value: formattedAmount }] : []),
        { label: 'Timestamp', value: new Date().toLocaleString('en-IN') },
        ...(reason ? [{ label: 'Root Cause / Note', value: reason }] : []),
        ...details,
    ];

    const html = getAdminAlertTemplate({
        title: cfg.title,
        badgeText: cfg.badgeText,
        badgeColor: cfg.badgeColor,
        severity: cfg.severity,
        message: cfg.msg,
        details: alertDetails,
        actionUrl: `${ADMIN_URL}/finance`,
        actionText: cfg.actionText,
    });

    const results = [];
    for (const recipient of recipients) {
        const res = await sendEmail({
            to: recipient,
            subject: `[PLE Finance] ${cfg.title}`,
            html,
            text: cfg.msg,
            recipientType: 'admin',
            template: `admin_finance_${alertType}`,
            metadata: { alertType, amount, transactionId },
        });
        results.push(res);
    }
    return results;
};

// ─── 4. SPEEDZEEL & LOGISTICS ESCALATIONS (Items 156–165) ─────────────────────

/**
 * Items 156–165: Admin Logistics & Speedzeel Alerts
 * Handles pickup requested, assigned, failed, delayed shipments, failed delivery, RTO, and SLA breaches.
 */
export const sendAdminLogisticsAlert = async ({ order, alertType, courier = 'Speedzeel Logistics', trackingNumber, reason, details = [] }) => {
    const recipients = await resolveAdminRecipients();
    if (!recipients.length) return;

    const orderId = order?.orderId || order?._id || 'N/A';

    const typeConfig = {
        pickup_requested: {
            title: `Merchant Pickup Requested: Order #${orderId}`,
            badgeText: 'PICKUP REQUESTED',
            badgeColor: 'blue',
            severity: 'info',
            msg: `Merchant has packaged items and requested courier pickup for Order #${orderId}.`,
            actionText: 'Assign Pickup Agent',
        },
        pickup_assigned: {
            title: `Pickup Assigned: Order #${orderId}`,
            badgeText: 'PICKUP ASSIGNED',
            badgeColor: 'blue',
            severity: 'info',
            msg: `Order #${orderId} pickup has been assigned to courier partner ${courier}.`,
            actionText: 'View Courier Assignment',
        },
        pickup_failed: {
            title: `Pickup Failed Alert: Order #${orderId}`,
            badgeText: 'PICKUP FAILED',
            badgeColor: 'red',
            severity: 'warning',
            msg: `Courier was unable to collect parcel from seller hub for Order #${orderId}.${reason ? ` Reason: ${reason}` : ''}`,
            actionText: 'Reschedule Pickup',
        },
        shipment_created: {
            title: `Logistics Shipment Manifested: Order #${orderId}`,
            badgeText: 'SHIPMENT MANIFESTED',
            badgeColor: 'blue',
            severity: 'info',
            msg: `Airway Bill and tracking number generated for Order #${orderId}.`,
            actionText: 'Track Shipment',
        },
        shipment_delayed: {
            title: `Shipment Transit Delay: Order #${orderId}`,
            badgeText: 'TRANSIT DELAY',
            badgeColor: 'amber',
            severity: 'warning',
            msg: `Package for Order #${orderId} has encountered in-transit delays.${reason ? ` Status: ${reason}` : ''}`,
            actionText: 'Check Transit Hub',
        },
        delivery_failed: {
            title: `Last-Mile Delivery Failed: Order #${orderId}`,
            badgeText: 'DELIVERY ATTEMPT FAILED',
            badgeColor: 'red',
            severity: 'warning',
            msg: `Delivery attempt for Order #${orderId} failed.${reason ? ` Reason: ${reason}` : ' Customer unavailable.'}`,
            actionText: 'Reschedule Delivery',
        },
        rto_initiated: {
            title: `Package RTO Initiated: Order #${orderId}`,
            badgeText: 'RTO INITIATED',
            badgeColor: 'red',
            severity: 'critical',
            msg: `Non-delivery threshold reached. Order #${orderId} is being returned to origin hub.`,
            actionText: 'Manage RTO Tracking',
        },
        rto_received: {
            title: `RTO Parcel Reached Hub: Order #${orderId}`,
            badgeText: 'RTO DELIVERED TO HUB',
            badgeColor: 'amber',
            severity: 'info',
            msg: `Returned parcel for Order #${orderId} has reached the return facility. Ready for inspection.`,
            actionText: 'Inspect Returned Parcel',
        },
        delivery_agent_issue: {
            title: `Delivery Agent Incident / Issue: Order #${orderId}`,
            badgeText: 'AGENT INCIDENT',
            badgeColor: 'red',
            severity: 'warning',
            msg: `Delivery associate reported a route or customer issue.${reason ? ` Details: ${reason}` : ''}`,
            actionText: 'Contact Dispatcher',
        },
        logistics_sla_breach: {
            title: `Logistics Delivery SLA Breached: Order #${orderId}`,
            badgeText: 'CARRIER SLA BREACH',
            badgeColor: 'red',
            severity: 'critical',
            msg: `Delivery turnaround time for Order #${orderId} has exceeded agreed carrier SLA threshold.`,
            actionText: 'Escalate to Carrier Ops',
        },
    };

    const cfg = typeConfig[alertType] || {
        title: `Logistics Alert: Order #${orderId}`,
        badgeText: alertType.toUpperCase(),
        badgeColor: 'amber',
        severity: 'warning',
        msg: reason || `Logistics status alert for Order #${orderId}.`,
        actionText: 'View Logistics Record',
    };

    const alertDetails = [
        { label: 'Order Number', value: `#${orderId}` },
        { label: 'Carrier / Provider', value: courier },
        ...(trackingNumber ? [{ label: 'Tracking / AWB', value: String(trackingNumber) }] : []),
        ...(reason ? [{ label: 'Milestone / Notes', value: reason }] : []),
        ...details,
    ];

    const html = getAdminAlertTemplate({
        title: cfg.title,
        badgeText: cfg.badgeText,
        badgeColor: cfg.badgeColor,
        severity: cfg.severity,
        message: cfg.msg,
        details: alertDetails,
        actionUrl: `${ADMIN_URL}/delivery/${orderId}`,
        actionText: cfg.actionText,
    });

    const results = [];
    for (const recipient of recipients) {
        const res = await sendEmail({
            to: recipient,
            subject: `[PLE Logistics] ${cfg.title}`,
            html,
            text: cfg.msg,
            recipientType: 'admin',
            template: `admin_logistics_${alertType}`,
            metadata: { orderId: String(orderId), alertType, courier, trackingNumber },
        });
        results.push(res);
    }
    return results;
};

// ─── 5. AUTHENTICATION, ACCOUNT SECURITY & STAFF RBAC (Items 166–195) ─────────

/**
 * Items 166–195: Authentication, Security & Staff Lifecycle Notifications
 * Dispatched to users, vendors, and admins for login security, lockouts, 2FA, API keys, and employee administration.
 */
export const sendSecurityAlert = async ({
    user,
    recipientEmail,
    eventType,
    ipAddress = 'N/A',
    userAgent = 'N/A',
    details = [],
    actionUrl,
    actionText,
}) => {
    const email = recipientEmail || user?.email || user?.businessEmail;
    if (!email) return;

    const recipientName = user?.name || user?.ownerName || user?.storeName || 'Valued User';

    const eventConfig = {
        account_created: {
            title: 'Welcome to PLE Store — Account Created',
            badgeText: 'ACCOUNT REGISTERED',
            badgeColor: 'green',
            severity: 'info',
            msg: `Welcome to Peoples League of Electronics. Your account has been registered successfully.`,
            actionText: 'Explore Your Dashboard',
            url: `${CLIENT_URL}/account`,
        },
        email_verified: {
            title: 'Email Address Successfully Verified',
            badgeText: 'EMAIL VERIFIED',
            badgeColor: 'green',
            severity: 'info',
            msg: `Your primary email address has been verified for security and official notifications.`,
            actionText: 'View Account Settings',
            url: `${CLIENT_URL}/settings`,
        },
        password_reset: {
            title: 'Password Reset Requested',
            badgeText: 'SECURITY REQUEST',
            badgeColor: 'amber',
            severity: 'warning',
            msg: `A password reset request was initiated for your PLE account. If you did not make this request, secure your account immediately.`,
            actionText: 'Reset Password',
            url: `${CLIENT_URL}/reset-password`,
        },
        password_changed: {
            title: 'Password Changed Successfully',
            badgeText: 'SECURITY UPDATE',
            badgeColor: 'green',
            severity: 'info',
            msg: `Your account password was updated successfully. All other active sessions have been terminated.`,
            actionText: 'Review Security Settings',
            url: `${CLIENT_URL}/settings/security`,
        },
        new_login: {
            title: 'New Login Detected on Your Account',
            badgeText: 'NEW LOGIN',
            badgeColor: 'blue',
            severity: 'info',
            msg: `A successful login was recorded for your PLE account.`,
            actionText: 'View Active Sessions',
            url: `${CLIENT_URL}/settings/security`,
        },
        new_device: {
            title: 'New Device / Browser Login Alert',
            badgeText: 'NEW DEVICE DETECTED',
            badgeColor: 'amber',
            severity: 'warning',
            msg: `We noticed a login to your PLE account from an unfamiliar browser or device.`,
            actionText: 'Secure Account If Not You',
            url: `${CLIENT_URL}/settings/security`,
        },
        new_location: {
            title: 'New Geographic Location Login Alert',
            badgeText: 'NEW LOCATION DETECTED',
            badgeColor: 'amber',
            severity: 'warning',
            msg: `A login was recorded from a new geographic location or IP address.`,
            actionText: 'Review Login Location',
            url: `${CLIENT_URL}/settings/security`,
        },
        login_threshold: {
            title: 'Repeated Failed Login Attempts Detected',
            badgeText: 'FAILED LOGIN THRESHOLD',
            badgeColor: 'amber',
            severity: 'warning',
            msg: `Multiple consecutive failed login attempts were recorded on your account. Continued failures will temporarily lock access.`,
            actionText: 'Reset Password',
            url: `${CLIENT_URL}/forgot-password`,
        },
        account_locked: {
            title: '⚠️ Security Alert: Account Temporarily Locked',
            badgeText: 'ACCOUNT LOCKED',
            badgeColor: 'red',
            severity: 'critical',
            msg: `Your account has been temporarily locked due to too many failed password attempts. Access will automatically unlock after 15 minutes.`,
            actionText: 'Contact Account Security',
            url: `${CLIENT_URL}/contact`,
        },
        account_unlocked: {
            title: 'Account Unlocked — Access Restored',
            badgeText: 'ACCOUNT UNLOCKED',
            badgeColor: 'green',
            severity: 'info',
            msg: `Your account lockout duration has expired and full access has been restored.`,
            actionText: 'Log In Securely',
            url: `${CLIENT_URL}/login`,
        },
        '2fa_enabled': {
            title: 'Two-Factor Authentication (2FA) Activated',
            badgeText: '2FA ENABLED',
            badgeColor: 'green',
            severity: 'info',
            msg: `Two-Factor Authentication (2FA) via Email OTP has been enabled for your account. You will now be required to enter an OTP on every login.`,
            actionText: 'View Security Status',
            url: `${CLIENT_URL}/settings/security`,
        },
        '2fa_disabled': {
            title: '⚠️ Two-Factor Authentication (2FA) Disabled',
            badgeText: '2FA DISABLED',
            badgeColor: 'red',
            severity: 'critical',
            msg: `Two-Factor Authentication (2FA) was disabled on your account. If you did not perform this change, immediately secure your login.`,
            actionText: 'Re-enable 2FA Now',
            url: `${CLIENT_URL}/settings/security`,
        },
        recovery_changed: {
            title: 'Account Recovery Method Updated',
            badgeText: 'RECOVERY UPDATED',
            badgeColor: 'amber',
            severity: 'warning',
            msg: `The recovery phone or backup email address for your account was changed.`,
            actionText: 'Review Recovery Info',
            url: `${CLIENT_URL}/settings/security`,
        },
        // Vendor Security (Items 179-187)
        vendor_staff_added: {
            title: 'New Staff Member Added to Merchant Portal',
            badgeText: 'STAFF ADDED',
            badgeColor: 'blue',
            severity: 'info',
            msg: `A new sub-user or staff member was granted access to your merchant portal.`,
            actionText: 'Manage Team Permissions',
            url: `${CLIENT_URL}/vendor/settings/team`,
        },
        vendor_staff_removed: {
            title: 'Staff Access Revoked from Merchant Portal',
            badgeText: 'STAFF REMOVED',
            badgeColor: 'amber',
            severity: 'info',
            msg: `A staff member account was removed from your merchant store team.`,
            actionText: 'Review Team Roster',
            url: `${CLIENT_URL}/vendor/settings/team`,
        },
        vendor_permissions: {
            title: 'Merchant Staff Role & Permissions Modified',
            badgeText: 'PERMISSIONS UPDATED',
            badgeColor: 'blue',
            severity: 'info',
            msg: `Operational access permissions were updated for a team member in your vendor account.`,
            actionText: 'View Team Permissions',
            url: `${CLIENT_URL}/vendor/settings/team`,
        },
        api_key_created: {
            title: 'New Merchant API Key Generated',
            badgeText: 'API KEY CREATED',
            badgeColor: 'amber',
            severity: 'warning',
            msg: `A programmatic API key was generated for your merchant store. Keep secrets confidential.`,
            actionText: 'Manage API Credentials',
            url: `${CLIENT_URL}/vendor/developers`,
        },
        api_key_revoked: {
            title: 'Merchant API Key Revoked',
            badgeText: 'API KEY REVOKED',
            badgeColor: 'red',
            severity: 'warning',
            msg: `An API key associated with your store was permanently revoked and will reject all requests.`,
            actionText: 'View Developer Settings',
            url: `${CLIENT_URL}/vendor/developers`,
        },
        api_key_regenerated: {
            title: 'Merchant API Key Regenerated',
            badgeText: 'API KEY REGENERATED',
            badgeColor: 'amber',
            severity: 'warning',
            msg: `An existing API key was regenerated. The previous token is now invalid.`,
            actionText: 'View Developer Settings',
            url: `${CLIENT_URL}/vendor/developers`,
        },
        webhook_created: {
            title: 'New Webhook Endpoint Configured',
            badgeText: 'WEBHOOK CREATED',
            badgeColor: 'blue',
            severity: 'info',
            msg: `A new webhook URL was configured to receive real-time merchant order updates.`,
            actionText: 'Inspect Webhook Endpoints',
            url: `${CLIENT_URL}/vendor/developers`,
        },
        webhook_disabled: {
            title: 'Webhook Endpoint Disabled',
            badgeText: 'WEBHOOK DISABLED',
            badgeColor: 'red',
            severity: 'warning',
            msg: `A webhook URL was deactivated due to repeated delivery timeout failures or manual action.`,
            actionText: 'Inspect Webhook Failures',
            url: `${CLIENT_URL}/vendor/developers`,
        },
        suspicious_api: {
            title: '⚠️ Suspicious API Activity Detected',
            badgeText: 'API ANOMALY',
            badgeColor: 'red',
            severity: 'critical',
            msg: `Unusual API request rate or unauthorized endpoint attempts were detected on your merchant API credentials.`,
            actionText: 'Revoke Key Immediately',
            url: `${CLIENT_URL}/vendor/developers`,
        },
        // PLE Admin Staff Security (Items 188-195)
        employee_created: {
            title: 'Internal Admin / Employee Account Provisioned',
            badgeText: 'EMPLOYEE CREATED',
            badgeColor: 'blue',
            severity: 'info',
            msg: `A new administrative employee identity was provisioned in the PLE operations management system.`,
            actionText: 'View Staff Directory',
            url: `${ADMIN_URL}/staff`,
        },
        employee_disabled: {
            title: 'Admin / Employee Identity Deactivated',
            badgeText: 'EMPLOYEE DISABLED',
            badgeColor: 'red',
            severity: 'warning',
            msg: `An administrative staff identity was deactivated. Access to internal systems is suspended.`,
            actionText: 'View Staff Directory',
            url: `${ADMIN_URL}/staff`,
        },
        role_changed: {
            title: 'Administrative Role / Access Privilege Modified',
            badgeText: 'ROLE MODIFIED',
            badgeColor: 'amber',
            severity: 'warning',
            msg: `Your internal organizational role or access group was updated by a Super Administrator.`,
            actionText: 'Review Access Privileges',
            url: `${ADMIN_URL}/profile`,
        },
        department_changed: {
            title: 'Organizational Department Assignment Updated',
            badgeText: 'DEPARTMENT CHANGED',
            badgeColor: 'blue',
            severity: 'info',
            msg: `Your administrative department assignment was updated.`,
            actionText: 'View Staff Profile',
            url: `${ADMIN_URL}/profile`,
        },
        privileged_granted: {
            title: '⚠️ Privileged Permission Granted',
            badgeText: 'PRIVILEGE ESCALATION',
            badgeColor: 'amber',
            severity: 'warning',
            msg: `High-level privileged permissions (e.g. Finance Disbursement, Catalog Override) were granted to this account.`,
            actionText: 'Audit Privileges',
            url: `${ADMIN_URL}/staff/audit`,
        },
        privileged_revoked: {
            title: 'Privileged Permission Revoked',
            badgeText: 'PRIVILEGE REVOKED',
            badgeColor: 'blue',
            severity: 'info',
            msg: `Privileged administrative permissions were removed from this account.`,
            actionText: 'View Current Permissions',
            url: `${ADMIN_URL}/staff/audit`,
        },
        sensitive_action: {
            title: '⚠️ Sensitive System Action Logged',
            badgeText: 'SENSITIVE ACTION',
            badgeColor: 'red',
            severity: 'warning',
            msg: `A high-impact administrative action (e.g. bulk export, fee structure change, manual balance adjustment) was performed.`,
            actionText: 'View Audit Log',
            url: `${ADMIN_URL}/audit-logs`,
        },
        security_incident: {
            title: '🚨 CRITICAL: Security Incident / Threat Detected',
            badgeText: 'SECURITY INCIDENT',
            badgeColor: 'red',
            severity: 'critical',
            msg: `Anomalous security behavior, brute-force activity, or unauthorized access attempts triggered a high-severity security alert.`,
            actionText: 'Open Security Dashboard',
            url: `${ADMIN_URL}/security`,
        },
    };

    const cfg = eventConfig[eventType] || {
        title: `Security Notice: ${eventType}`,
        badgeText: String(eventType).toUpperCase(),
        badgeColor: 'red',
        severity: 'security',
        msg: `Security event logged for your account.`,
        actionText: 'Review Account',
        url: `${CLIENT_URL}/account`,
    };

    const html = getSecurityAlertTemplate({
        recipientName,
        title: cfg.title,
        badgeText: cfg.badgeText,
        badgeColor: cfg.badgeColor,
        severity: cfg.severity,
        message: cfg.msg,
        ipAddress,
        userAgent,
        details,
        actionUrl: actionUrl || cfg.url,
        actionText: actionText || cfg.actionText,
    });

    return await sendEmail({
        to: email,
        subject: `[PLE Security] ${cfg.title}`,
        html,
        text: `${cfg.title}: ${cfg.msg}. IP: ${ipAddress}.`,
        recipientType: 'user',
        template: `security_${eventType}`,
        metadata: { eventType, ipAddress },
    });
};
