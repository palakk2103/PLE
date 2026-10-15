import { sendEmail } from './email.service.js';
import {
    getCustomerWelcomeTemplate,
    getSecurityAlertTemplate,
    getShoppingAlertTemplate,
    getCustomerOrderNotificationTemplate,
    getCustomerReturnRefundTemplate,
} from '../utils/customerEmailTemplates.js';

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

/**
 * Helper to resolve customer email safely from an order or user object
 */
export const resolveCustomerRecipient = (entity) => {
    if (!entity) return { email: null, name: 'Valued Customer' };
    const email = entity.email ||
        entity.customerEmail ||
        entity.shippingAddress?.email ||
        entity.guestInfo?.email ||
        entity.user?.email ||
        entity.userId?.email ||
        null;

    const name = entity.name ||
        entity.customerName ||
        entity.shippingAddress?.name ||
        entity.guestInfo?.name ||
        entity.user?.name ||
        entity.userId?.name ||
        'Valued Customer';

    return { email: email ? String(email).trim().toLowerCase() : null, name };
};

// ─── 1. ACCOUNT NOTIFICATIONS ───────────────────────────────────────────────────

/**
 * Item 1: Welcome / Account Created
 */
export const sendCustomerWelcomeEmail = async ({ user }) => {
    if (!user || !user.email) return;
    const name = user.name || 'Valued Customer';
    const html = getCustomerWelcomeTemplate({
        customerName: name,
        loginUrl: `${CLIENT_URL}/login`,
    });

    return await sendEmail({
        to: user.email,
        subject: `Welcome to Peoples League of Electronics, ${name}! 🎉`,
        html,
        text: `Welcome to Peoples League of Electronics! Your account is active. Explore our store at ${CLIENT_URL}`,
        recipientType: 'customer',
        template: 'customer_welcome',
        idempotencyKey: `welcome_${user._id}`,
        metadata: { userId: user._id },
    });
};

/**
 * Item 3: Email Address Changed
 */
export const sendEmailChangedNotification = async ({ user, oldEmail, newEmail }) => {
    const recipients = [oldEmail, newEmail].filter(Boolean);
    const results = [];

    for (const recipient of recipients) {
        const isOld = recipient === oldEmail;
        const html = getSecurityAlertTemplate({
            customerName: user.name || 'Valued Customer',
            title: isOld ? 'Security Alert: Email Address Updated' : 'Email Address Confirmation',
            message: isOld
                ? `The email address associated with your PLE account was recently changed to ${newEmail}. If you did not make this change, please secure your account immediately.`
                : `Your email address for your PLE account has been successfully set to this address.`,
            details: [
                { label: 'Previous Email', value: oldEmail },
                { label: 'Updated Email', value: newEmail },
                { label: 'Timestamp', value: new Date().toLocaleString('en-IN') },
            ],
            alertType: isOld ? 'warning' : 'info',
            actionUrl: `${CLIENT_URL}/profile`,
            actionText: 'Review Profile',
        });

        const res = await sendEmail({
            to: recipient,
            subject: 'Security Alert: Your Email Address Was Changed',
            html,
            text: `Your PLE account email address was changed to ${newEmail}. Timestamp: ${new Date().toISOString()}`,
            recipientType: 'customer',
            template: 'security_email_changed',
            metadata: { userId: user._id, oldEmail, newEmail },
        });
        results.push(res);
    }
    return results;
};

/**
 * Item 4: Phone Number Changed
 */
export const sendPhoneChangedNotification = async ({ user, oldPhone, newPhone }) => {
    if (!user || !user.email) return;
    const html = getSecurityAlertTemplate({
        customerName: user.name || 'Valued Customer',
        title: 'Security Notice: Phone Number Changed',
        message: 'The phone number linked to your account has been updated.',
        details: [
            { label: 'Previous Phone', value: oldPhone ? `******${String(oldPhone).slice(-4)}` : 'None' },
            { label: 'Updated Phone', value: newPhone ? `******${String(newPhone).slice(-4)}` : 'Removed' },
            { label: 'Timestamp', value: new Date().toLocaleString('en-IN') },
        ],
        alertType: 'info',
        actionUrl: `${CLIENT_URL}/profile`,
    });

    return await sendEmail({
        to: user.email,
        subject: 'Security Notice: Phone Number Updated',
        html,
        text: `Your PLE phone number was updated. If you did not authorize this change, please contact support.`,
        recipientType: 'customer',
        template: 'security_phone_changed',
        metadata: { userId: user._id },
    });
};

/**
 * Item 6: Password Changed
 */
export const sendPasswordChangedNotification = async ({ user }) => {
    if (!user || !user.email) return;
    const html = getSecurityAlertTemplate({
        customerName: user.name || 'Valued Customer',
        title: 'Your Password Was Changed',
        message: 'The password for your PLE account was recently updated. If you made this change, no further action is required.',
        details: [
            { label: 'Account', value: user.email },
            { label: 'Timestamp', value: new Date().toLocaleString('en-IN') },
        ],
        alertType: 'warning',
        actionUrl: `${CLIENT_URL}/login`,
        actionText: 'Login to Account',
    });

    return await sendEmail({
        to: user.email,
        subject: 'Security Alert: Password Changed Successfully',
        html,
        text: `Your password on Peoples League of Electronics was successfully changed at ${new Date().toISOString()}.`,
        recipientType: 'customer',
        template: 'security_password_changed',
        metadata: { userId: user._id },
    });
};

/**
 * Item 7 & 8: Login from New Device / Security Alert
 */
export const sendNewDeviceLoginAlert = async ({ user, ip, userAgent, location }) => {
    if (!user || !user.email) return;
    const html = getSecurityAlertTemplate({
        customerName: user.name || 'Valued Customer',
        title: 'New Sign-in Detected',
        message: 'We noticed a login to your PLE account from a new device or browser.',
        details: [
            { label: 'IP Address', value: ip || 'Unknown' },
            { label: 'Device / Browser', value: userAgent || 'Unknown' },
            { label: 'Location', value: location || 'India' },
            { label: 'Timestamp', value: new Date().toLocaleString('en-IN') },
        ],
        alertType: 'info',
        actionUrl: `${CLIENT_URL}/profile`,
        actionText: 'Review Recent Activity',
    });

    return await sendEmail({
        to: user.email,
        subject: 'Security Alert: New Sign-in to Your Account',
        html,
        text: `New sign-in detected for ${user.email} from IP: ${ip} at ${new Date().toISOString()}.`,
        recipientType: 'customer',
        template: 'security_new_device_login',
        metadata: { userId: user._id, ip },
    });
};

/**
 * Item 9 & 10: Account Deactivated / Reactivated
 */
export const sendAccountStatusNotification = async ({ user, action, reason }) => {
    if (!user || !user.email) return;
    const isDeactivated = action === 'deactivated';
    const html = getSecurityAlertTemplate({
        customerName: user.name || 'Valued Customer',
        title: isDeactivated ? 'Account Deactivated' : 'Account Reactivated',
        message: isDeactivated
            ? `Your PLE account has been deactivated. ${reason ? `Reason: ${reason}` : 'If you believe this was in error, please reach out to customer support.'}`
            : 'Your PLE account has been successfully reactivated. You can now log in and continue shopping.',
        alertType: isDeactivated ? 'danger' : 'info',
        actionUrl: isDeactivated ? `${CLIENT_URL}/contact` : `${CLIENT_URL}/login`,
        actionText: isDeactivated ? 'Contact Support' : 'Login Now',
    });

    return await sendEmail({
        to: user.email,
        subject: `Your Account Has Been ${isDeactivated ? 'Deactivated' : 'Reactivated'}`,
        html,
        text: `Your PLE account status was updated to: ${action}.`,
        recipientType: 'customer',
        template: `account_status_${action}`,
        metadata: { userId: user._id, action },
    });
};

// ─── 2. SHOPPING, WISHLIST & SOURCENOW / RFQ ────────────────────────────────────

/**
 * Item 11: Wishlist / Back in Stock
 */
export const sendBackInStockNotification = async ({ user, product }) => {
    if (!user || !user.email || !product) return;
    const html = getShoppingAlertTemplate({
        customerName: user.name || 'Valued Customer',
        title: 'Good news! An item from your Wishlist is back in stock',
        subtitle: 'Back in Stock Alert',
        message: 'The following product you were interested in is now available for purchase.',
        product: {
            name: product.name,
            price: product.price,
            image: product.thumbnail || product.images?.[0],
        },
        actionUrl: `${CLIENT_URL}/product/${product.slug || product._id}`,
        actionText: 'Buy Now',
    });

    return await sendEmail({
        to: user.email,
        subject: `Back in Stock: ${product.name} is now available!`,
        html,
        text: `${product.name} is now back in stock at ₹${product.price}. View now: ${CLIENT_URL}/product/${product.slug || product._id}`,
        recipientType: 'customer',
        template: 'shopping_back_in_stock',
        idempotencyKey: `stock_alert_${user._id}_${product._id}_${Date.now().toString().slice(0, 6)}`,
        metadata: { userId: user._id, productId: product._id },
    });
};

/**
 * Scan Wishlists and notify customers when a product is back in stock
 */
export const notifyBackInStockWishlistUsers = async (product) => {
    if (!product || !product._id) return;
    try {
        const Wishlist = (await import('../models/Wishlist.model.js')).default;
        const wishlists = await Wishlist.find({ 'items.productId': product._id }).populate('userId', 'name email');
        for (const wl of wishlists) {
            if (wl.userId?.email) {
                await sendBackInStockNotification({ user: wl.userId, product }).catch(() => null);
            }
        }
    } catch (err) {
        console.error('[CustomerNotification] notifyBackInStockWishlistUsers error:', err.message);
    }
};

/**
 * Item 12: Price Drop Notification (Optional)
 */
export const sendPriceDropNotification = async ({ user, product, oldPrice, newPrice }) => {
    if (!user || !user.email || !product) return;
    const html = getShoppingAlertTemplate({
        customerName: user.name || 'Valued Customer',
        title: `Price Drop Alert: Save on ${product.name}!`,
        subtitle: 'Price Drop',
        message: 'An item in your wishlist just dropped in price. Grab it while supplies last!',
        product: {
            name: product.name,
            price: newPrice,
            oldPrice: oldPrice,
            image: product.thumbnail || product.images?.[0],
        },
        actionUrl: `${CLIENT_URL}/product/${product.slug || product._id}`,
        actionText: 'View Deal',
    });

    return await sendEmail({
        to: user.email,
        subject: `Price Drop: ${product.name} is now ₹${newPrice}`,
        html,
        text: `Price drop on ${product.name}! Price dropped from ₹${oldPrice} to ₹${newPrice}. View: ${CLIENT_URL}/product/${product.slug || product._id}`,
        recipientType: 'customer',
        template: 'shopping_price_drop',
        idempotencyKey: `price_drop_${user._id}_${product._id}_${newPrice}`,
        metadata: { userId: user._id, productId: product._id, newPrice, oldPrice },
    });
};

/**
 * Item 13 & 14: Product Request / SourceNow Request Received
 */
export const sendProductRequestReceivedEmail = async ({ customerEmail, customerName, productRequest }) => {
    if (!customerEmail) return;
    const requestId = productRequest.requestId || productRequest._id;
    const html = getShoppingAlertTemplate({
        customerName: customerName || 'Valued Customer',
        title: 'We have received your Sourcing Request',
        subtitle: 'SourceNow Request Received',
        message: 'Thank you for submitting your custom procurement request. Our sourcing team and verified vendors are reviewing your specifications.',
        details: [
            { label: 'Request ID', value: `#${requestId}` },
            { label: 'Product / Category', value: productRequest.productName || productRequest.category || 'Custom Electronics' },
            { label: 'Quantity', value: productRequest.quantity || '1' },
            { label: 'Target Price', value: productRequest.targetPrice ? `₹${productRequest.targetPrice}` : 'Open for Quote' },
        ],
        actionUrl: `${CLIENT_URL}/sourcenow/requests/${requestId}`,
        actionText: 'Track Sourcing Progress',
    });

    return await sendEmail({
        to: customerEmail,
        subject: `SourceNow Request Received [#${requestId}]`,
        html,
        text: `Your SourceNow procurement request #${requestId} has been received. Our team will update you as suppliers submit quotes.`,
        recipientType: 'customer',
        template: 'sourcenow_request_received',
        idempotencyKey: `sourcenow_rec_${requestId}`,
        metadata: { requestId },
    });
};

/**
 * Item 15: SourceNow Request Status Update
 */
export const sendSourceNowUpdateEmail = async ({ customerEmail, customerName, productRequest, status, updateNotes }) => {
    if (!customerEmail) return;
    const requestId = productRequest.requestId || productRequest._id;
    const html = getShoppingAlertTemplate({
        customerName: customerName || 'Valued Customer',
        title: `Update on your Sourcing Request [#${requestId}]`,
        subtitle: 'SourceNow Progress',
        message: updateNotes || `Your sourcing request status has been updated to: ${status}.`,
        details: [
            { label: 'Request ID', value: `#${requestId}` },
            { label: 'Status', value: String(status).toUpperCase() },
            { label: 'Updated', value: new Date().toLocaleDateString('en-IN') },
        ],
        actionUrl: `${CLIENT_URL}/sourcenow/requests/${requestId}`,
        actionText: 'View Quotes & Updates',
    });

    return await sendEmail({
        to: customerEmail,
        subject: `Update on SourceNow Request [#${requestId}]: ${status}`,
        html,
        text: `Your SourceNow request #${requestId} status is now: ${status}. ${updateNotes || ''}`,
        recipientType: 'customer',
        template: 'sourcenow_request_update',
        metadata: { requestId, status },
    });
};

/**
 * Item 16: RFQ Submitted
 */
export const sendRfqSubmittedCustomerEmail = async ({ customerEmail, customerName, rfq }) => {
    if (!customerEmail) return;
    const rfqId = rfq.rfqId || rfq._id;
    const html = getShoppingAlertTemplate({
        customerName: customerName || 'Valued Customer',
        title: 'Your RFQ Has Been Published to Vendors',
        subtitle: 'Request For Quotation',
        message: 'Your Request For Quotation (RFQ) has been published. Matching certified suppliers will submit their quotes directly.',
        details: [
            { label: 'RFQ Number', value: `#${rfqId}` },
            { label: 'Title', value: rfq.title || rfq.productName || 'B2B Procurement' },
            { label: 'Required Quantity', value: rfq.quantity || 'N/A' },
            { label: 'Quote Deadline', value: rfq.quoteDeadline ? new Date(rfq.quoteDeadline).toLocaleDateString('en-IN') : 'Standard' },
        ],
        actionUrl: `${CLIENT_URL}/rfq/${rfqId}`,
        actionText: 'View RFQ Dashboard',
    });

    return await sendEmail({
        to: customerEmail,
        subject: `RFQ Submitted Successfully [#${rfqId}]`,
        html,
        text: `Your RFQ #${rfqId} has been created and published to suppliers.`,
        recipientType: 'customer',
        template: 'rfq_submitted_customer',
        idempotencyKey: `rfq_cust_sub_${rfqId}`,
        metadata: { rfqId },
    });
};

/**
 * Item 17: RFQ Response Received / Quote Available
 */
export const sendRfqResponseCustomerEmail = async ({ customerEmail, customerName, rfq, quotation }) => {
    if (!customerEmail) return;
    const rfqId = rfq.rfqId || rfq._id;
    const html = getShoppingAlertTemplate({
        customerName: customerName || 'Valued Customer',
        title: 'New Quotation Received for your RFQ',
        subtitle: 'RFQ Response Available',
        message: `A supplier has submitted a new quote for your RFQ #${rfqId}. Review the pricing and lead times to make your selection.`,
        details: [
            { label: 'RFQ Number', value: `#${rfqId}` },
            { label: 'Supplier Quote', value: quotation.quotePrice ? `₹${Number(quotation.quotePrice).toLocaleString('en-IN')}` : 'Quotation Submitted' },
            { label: 'Valid Until', value: quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString('en-IN') : '7 Days' },
        ],
        actionUrl: `${CLIENT_URL}/rfq/${rfqId}`,
        actionText: 'Review Quotation',
    });

    return await sendEmail({
        to: customerEmail,
        subject: `New Quote Received for RFQ #${rfqId}`,
        html,
        text: `A new quote is available for RFQ #${rfqId}. Log in to review the quotation: ${CLIENT_URL}/rfq/${rfqId}`,
        recipientType: 'customer',
        template: 'rfq_response_received',
        metadata: { rfqId },
    });
};

// ─── 3. ORDERS & PAYMENTS LIFECYCLE ─────────────────────────────────────────────

/**
 * Item 21: Payment Failed
 */
export const sendPaymentFailedNotification = async ({ order, failureReason, retryUrl }) => {
    const { email, name } = resolveCustomerRecipient(order);
    if (!email) return;
    const orderId = order.orderId || order._id;

    const html = getCustomerOrderNotificationTemplate({
        customerName: name,
        orderId,
        title: 'Payment Unsuccessful',
        badgeText: 'Payment Failed',
        badgeColor: 'red',
        message: `We were unable to process your payment for Order #${orderId}. Your items have been temporarily reserved. Please complete your payment to confirm your order.`,
        details: [
            { label: 'Order ID', value: `#${orderId}` },
            { label: 'Amount Due', value: `₹${Number(order.total || 0).toLocaleString('en-IN')}` },
            { label: 'Failure Reason', value: failureReason || 'Gateway transaction declined' },
        ],
        actionUrl: retryUrl || `${CLIENT_URL}/checkout/retry/${orderId}`,
        actionText: 'Retry Payment',
    });

    return await sendEmail({
        to: email,
        subject: `Payment Failed for Order #${orderId}`,
        html,
        text: `Payment for Order #${orderId} failed: ${failureReason || 'Transaction declined'}. Please retry payment to avoid order cancellation.`,
        recipientType: 'customer',
        template: 'payment_failed',
        metadata: { orderId, failureReason },
    });
};

/**
 * Item 22: Payment Pending
 */
export const sendPaymentPendingNotification = async ({ order, paymentMethod }) => {
    const { email, name } = resolveCustomerRecipient(order);
    if (!email) return;
    const orderId = order.orderId || order._id;

    const html = getCustomerOrderNotificationTemplate({
        customerName: name,
        orderId,
        title: 'Payment Awaiting Confirmation',
        badgeText: 'Payment Pending',
        badgeColor: 'amber',
        message: `Your payment for Order #${orderId} via ${paymentMethod || 'Selected Payment Method'} is currently pending confirmation from the bank or payment gateway.`,
        details: [
            { label: 'Order ID', value: `#${orderId}` },
            { label: 'Amount', value: `₹${Number(order.total || 0).toLocaleString('en-IN')}` },
            { label: 'Payment Method', value: paymentMethod || 'Online Gateway' },
        ],
        actionUrl: `${CLIENT_URL}/orders/${orderId}`,
        actionText: 'View Order Status',
    });

    return await sendEmail({
        to: email,
        subject: `Payment Pending for Order #${orderId}`,
        html,
        text: `Payment for Order #${orderId} is currently pending confirmation. We will notify you once confirmed.`,
        recipientType: 'customer',
        template: 'payment_pending',
        metadata: { orderId, paymentMethod },
    });
};

/**
 * Item 24, 25, 26: Vendor Order Acceptance / Rejection / Partial Acceptance
 */
export const sendVendorOrderDecisionCustomerNotification = async ({ order, vendorName, decision, items = [] }) => {
    const { email, name } = resolveCustomerRecipient(order);
    if (!email) return;
    const orderId = order.orderId || order._id;

    const decisionTitles = {
        accepted: 'Vendor Confirmed Your Order Items',
        rejected: 'Item Unavailable from Vendor',
        partially_accepted: 'Partial Order Update from Vendor',
    };

    const badgeColors = {
        accepted: 'green',
        rejected: 'red',
        partially_accepted: 'amber',
    };

    const html = getCustomerOrderNotificationTemplate({
        customerName: name,
        orderId,
        title: decisionTitles[decision] || 'Vendor Order Update',
        badgeText: `Vendor ${decision.replace('_', ' ').toUpperCase()}`,
        badgeColor: badgeColors[decision] || 'blue',
        message: decision === 'rejected'
            ? `The seller (${vendorName || 'Partner Seller'}) was unable to fulfill one or more items in your order. Any charged amount will be automatically refunded.`
            : `The seller (${vendorName || 'Partner Seller'}) has confirmed your order items and is preparing them for packing.`,
        details: [
            { label: 'Order ID', value: `#${orderId}` },
            { label: 'Seller', value: vendorName || 'Marketplace Seller' },
            { label: 'Decision', value: decision.replace('_', ' ').toUpperCase() },
        ],
        actionUrl: `${CLIENT_URL}/orders/${orderId}`,
        actionText: 'View Order Details',
    });

    return await sendEmail({
        to: email,
        subject: `Order #${orderId} Update from Seller: ${decision.replace('_', ' ')}`,
        html,
        text: `Order #${orderId} update from seller ${vendorName}: ${decision}. View details at ${CLIENT_URL}/orders/${orderId}`,
        recipientType: 'customer',
        template: `vendor_decision_${decision}`,
        metadata: { orderId, decision },
    });
};

/**
 * Item 28: Cancellation Requested
 */
export const sendOrderCancellationRequestedNotification = async ({ order, reason }) => {
    const { email, name } = resolveCustomerRecipient(order);
    if (!email) return;
    const orderId = order.orderId || order._id;

    const html = getCustomerOrderNotificationTemplate({
        customerName: name,
        orderId,
        title: 'Order Cancellation Request Received',
        badgeText: 'Cancellation Requested',
        badgeColor: 'amber',
        message: `We received your request to cancel Order #${orderId}. Our team is checking the fulfillment stage. If the order has not been dispatched, it will be cancelled and refunded promptly.`,
        details: [
            { label: 'Order ID', value: `#${orderId}` },
            { label: 'Reason', value: reason || 'Customer requested cancellation' },
            { label: 'Requested At', value: new Date().toLocaleDateString('en-IN') },
        ],
        actionUrl: `${CLIENT_URL}/orders/${orderId}`,
        actionText: 'Check Order Status',
    });

    return await sendEmail({
        to: email,
        subject: `Cancellation Request Received for Order #${orderId}`,
        html,
        text: `Your cancellation request for Order #${orderId} has been received and is being processed.`,
        recipientType: 'customer',
        template: 'order_cancellation_requested',
        idempotencyKey: `cancel_req_${orderId}`,
        metadata: { orderId, reason },
    });
};

/**
 * Item 29: Cancellation Approved / Rejected
 */
export const sendOrderCancellationDecisionNotification = async ({ order, decision, notes }) => {
    const { email, name } = resolveCustomerRecipient(order);
    if (!email) return;
    const orderId = order.orderId || order._id;
    const isApproved = decision === 'approved';

    const html = getCustomerOrderNotificationTemplate({
        customerName: name,
        orderId,
        title: isApproved ? 'Order Cancellation Approved' : 'Cancellation Request Declined',
        badgeText: isApproved ? 'Cancellation Approved' : 'Cancellation Declined',
        badgeColor: isApproved ? 'green' : 'red',
        message: isApproved
            ? `Your cancellation request for Order #${orderId} has been approved. Any payment will be refunded according to our refund policy.`
            : `We could not cancel Order #${orderId} because the package has already been dispatched. ${notes ? `Details: ${notes}` : 'You can request a return after delivery.'}`,
        details: [
            { label: 'Order ID', value: `#${orderId}` },
            { label: 'Status', value: isApproved ? 'Cancelled' : 'Shipped / In Progress' },
            { label: 'Note', value: notes || (isApproved ? 'Order successfully cancelled' : 'Already in transit') },
        ],
        actionUrl: `${CLIENT_URL}/orders/${orderId}`,
        actionText: 'View Order',
    });

    return await sendEmail({
        to: email,
        subject: `Cancellation ${isApproved ? 'Approved' : 'Declined'} for Order #${orderId}`,
        html,
        text: `Your cancellation request for Order #${orderId} was ${isApproved ? 'approved' : 'declined'}.`,
        recipientType: 'customer',
        template: `cancellation_${decision}`,
        metadata: { orderId, decision },
    });
};

// ─── 4. SHIPPING & DELIVERY EXCEPTIONS ──────────────────────────────────────────

/**
 * Item 34: Shipment Delayed
 */
export const sendShipmentDelayedNotification = async ({ order, expectedDate, delayReason }) => {
    const { email, name } = resolveCustomerRecipient(order);
    if (!email) return;
    const orderId = order.orderId || order._id;

    const html = getCustomerOrderNotificationTemplate({
        customerName: name,
        orderId,
        title: 'Shipment Schedule Update',
        badgeText: 'Shipment Delayed',
        badgeColor: 'amber',
        message: `Your shipment for Order #${orderId} is experiencing a brief transit delay. We are tracking it closely with our courier partner.`,
        details: [
            { label: 'Order ID', value: `#${orderId}` },
            { label: 'New Estimated Delivery', value: expectedDate || 'Within 2-3 Business Days' },
            { label: 'Delay Reason', value: delayReason || 'Operational / weather transit delay' },
            { label: 'Tracking Number', value: order.trackingNumber || 'Available in order details' },
        ],
        actionUrl: `${CLIENT_URL}/orders/${orderId}`,
        actionText: 'Track Live Shipment',
    });

    return await sendEmail({
        to: email,
        subject: `Delivery Update: Slight Delay on Order #${orderId}`,
        html,
        text: `Your shipment for Order #${orderId} is delayed. New estimated delivery: ${expectedDate || '2-3 days'}. Tracking: ${order.trackingNumber || 'N/A'}`,
        recipientType: 'customer',
        template: 'shipping_delayed',
        metadata: { orderId, delayReason },
    });
};

/**
 * Item 35: Shipment Exception
 */
export const sendShipmentExceptionNotification = async ({ order, exceptionDetails, trackingUrl }) => {
    const { email, name } = resolveCustomerRecipient(order);
    if (!email) return;
    const orderId = order.orderId || order._id;

    const html = getCustomerOrderNotificationTemplate({
        customerName: name,
        orderId,
        title: 'Shipment Exception Notice',
        badgeText: 'Courier Exception',
        badgeColor: 'red',
        message: `A logistics exception occurred during transit for Order #${orderId}. Our logistics team is resolving it with the courier partner.`,
        details: [
            { label: 'Order ID', value: `#${orderId}` },
            { label: 'Exception Details', value: exceptionDetails || 'Address clarification required' },
            { label: 'Carrier', value: order.carrier || 'Speedzeel / Logistics Partner' },
        ],
        actionUrl: trackingUrl || `${CLIENT_URL}/orders/${orderId}`,
        actionText: 'View Tracking Status',
    });

    return await sendEmail({
        to: email,
        subject: `Shipment Exception Alert for Order #${orderId}`,
        html,
        text: `A delivery exception occurred for Order #${orderId}: ${exceptionDetails || 'Please check order tracking.'}`,
        recipientType: 'customer',
        template: 'shipping_exception',
        metadata: { orderId, exceptionDetails },
    });
};

/**
 * Item 37: Delivery Attempted
 */
export const sendDeliveryAttemptedNotification = async ({ order, attemptCount = 1, nextAttemptDate }) => {
    const { email, name } = resolveCustomerRecipient(order);
    if (!email) return;
    const orderId = order.orderId || order._id;

    const html = getCustomerOrderNotificationTemplate({
        customerName: name,
        orderId,
        title: 'Delivery Attempted — We Missed You!',
        badgeText: `Attempt ${attemptCount} of 3`,
        badgeColor: 'amber',
        message: `Our delivery partner attempted to deliver Order #${orderId} today but could not reach you or access the premises. Another delivery attempt will be made soon.`,
        details: [
            { label: 'Order ID', value: `#${orderId}` },
            { label: 'Attempt', value: `${attemptCount} of 3` },
            { label: 'Next Attempt', value: nextAttemptDate || 'Next business day' },
            { label: 'Delivery Address', value: order.shippingAddress?.address || 'Your saved address' },
        ],
        actionUrl: `${CLIENT_URL}/orders/${orderId}`,
        actionText: 'Check Delivery Details',
    });

    return await sendEmail({
        to: email,
        subject: `Delivery Attempted for Order #${orderId}`,
        html,
        text: `We attempted to deliver Order #${orderId} today. A re-attempt will be scheduled on ${nextAttemptDate || 'the next business day'}.`,
        recipientType: 'customer',
        template: 'delivery_attempted',
        metadata: { orderId, attemptCount },
    });
};

/**
 * Item 39: Delivery Failed
 */
export const sendDeliveryFailedNotification = async ({ order, reason, nextSteps }) => {
    const { email, name } = resolveCustomerRecipient(order);
    if (!email) return;
    const orderId = order.orderId || order._id;

    const html = getCustomerOrderNotificationTemplate({
        customerName: name,
        orderId,
        title: 'Delivery Could Not Be Completed',
        badgeText: 'Delivery Failed',
        badgeColor: 'red',
        message: `After multiple attempts, delivery could not be completed for Order #${orderId}. The package may be returned to our facility.`,
        details: [
            { label: 'Order ID', value: `#${orderId}` },
            { label: 'Reason', value: reason || 'Customer unavailable / incomplete address' },
            { label: 'Next Steps', value: nextSteps || 'Package held at local hub or initiating return' },
        ],
        actionUrl: `${CLIENT_URL}/orders/${orderId}`,
        actionText: 'Contact Support',
    });

    return await sendEmail({
        to: email,
        subject: `Delivery Failed for Order #${orderId}`,
        html,
        text: `Delivery failed for Order #${orderId}: ${reason || 'Customer unavailable'}. Please contact support.`,
        recipientType: 'customer',
        template: 'delivery_failed',
        metadata: { orderId, reason },
    });
};

/**
 * Item 40 & 41: RTO Initiated / RTO Completed
 */
export const sendRtoNotification = async ({ order, stage = 'initiated', reason }) => {
    const { email, name } = resolveCustomerRecipient(order);
    if (!email) return;
    const orderId = order.orderId || order._id;
    const isCompleted = stage === 'completed';

    const html = getCustomerOrderNotificationTemplate({
        customerName: name,
        orderId,
        title: isCompleted ? 'Package Returned to Seller / PLE' : 'Return To Origin (RTO) Initiated',
        badgeText: isCompleted ? 'RTO Delivered' : 'RTO In Transit',
        badgeColor: isCompleted ? 'green' : 'amber',
        message: isCompleted
            ? `Your package for Order #${orderId} has been returned to the seller/warehouse. If this was a prepaid order, your refund is being processed.`
            : `Order #${orderId} could not be delivered and is being returned to origin (RTO). Reason: ${reason || 'Delivery attempts exhausted'}.`,
        details: [
            { label: 'Order ID', value: `#${orderId}` },
            { label: 'RTO Stage', value: isCompleted ? 'Delivered to Origin' : 'In Transit Back to Origin' },
            { label: 'Reason', value: reason || 'Undelivered' },
        ],
        actionUrl: `${CLIENT_URL}/orders/${orderId}`,
        actionText: 'View Order Status',
    });

    return await sendEmail({
        to: email,
        subject: `RTO Update for Order #${orderId}: ${isCompleted ? 'Returned to Origin' : 'Initiated'}`,
        html,
        text: `Order #${orderId} RTO status: ${stage}. ${isCompleted ? 'Refund processing initiated for prepaid orders.' : ''}`,
        recipientType: 'customer',
        template: `rto_${stage}`,
        metadata: { orderId, stage, reason },
    });
};

// ─── 5. RETURNS & REFUNDS ───────────────────────────────────────────────────────

/**
 * Item 42: Return Request Submitted
 */
export const sendReturnRequestSubmittedNotification = async ({ returnRequest, order }) => {
    const { email, name } = resolveCustomerRecipient(returnRequest.userId || order);
    if (!email) return;
    const returnId = returnRequest.returnId || returnRequest._id;
    const orderId = order?.orderId || returnRequest.orderId?._id || returnRequest.orderId;

    const html = getCustomerReturnRefundTemplate({
        customerName: name,
        orderId,
        returnId,
        title: 'Return Request Successfully Submitted',
        badgeText: 'Return Submitted',
        badgeColor: 'amber',
        message: 'We have received your return request. Our support team and the seller are reviewing your reason and item condition.',
        details: [
            { label: 'Return ID', value: `#${returnId}` },
            { label: 'Order ID', value: `#${orderId}` },
            { label: 'Reason', value: returnRequest.reason || 'Customer Return' },
            { label: 'Estimated Review', value: 'Within 24–48 Hours' },
        ],
        actionUrl: `${CLIENT_URL}/orders/${orderId}`,
        actionText: 'Track Return Status',
    });

    return await sendEmail({
        to: email,
        subject: `Return Request Submitted [#${returnId}] for Order #${orderId}`,
        html,
        text: `Your return request #${returnId} for Order #${orderId} has been received and is under review.`,
        recipientType: 'customer',
        template: 'return_request_submitted',
        idempotencyKey: `return_sub_${returnId}`,
        metadata: { returnId, orderId },
    });
};

/**
 * Item 43 & 44: Return Request Approved / Rejected
 */
export const sendReturnRequestDecisionNotification = async ({ returnRequest, order, decision, notes }) => {
    const { email, name } = resolveCustomerRecipient(returnRequest.userId || order);
    if (!email) return;
    const returnId = returnRequest.returnId || returnRequest._id;
    const orderId = order?.orderId || returnRequest.orderId?._id || returnRequest.orderId;
    const isApproved = decision === 'approved';

    const html = getCustomerReturnRefundTemplate({
        customerName: name,
        orderId,
        returnId,
        title: isApproved ? 'Return Request Approved' : 'Return Request Declined',
        badgeText: isApproved ? 'Return Approved' : 'Return Declined',
        badgeColor: isApproved ? 'green' : 'red',
        message: isApproved
            ? 'Your return request has been approved! A reverse pickup will be scheduled shortly by our logistics partner.'
            : `Your return request could not be approved. Reason: ${notes || 'Item condition or warranty eligibility mismatch.'}`,
        details: [
            { label: 'Return ID', value: `#${returnId}` },
            { label: 'Order ID', value: `#${orderId}` },
            { label: 'Decision', value: isApproved ? 'Approved for Pickup' : 'Declined' },
            { label: 'Notes', value: notes || (isApproved ? 'Keep original packaging ready' : 'Policy criteria not met') },
        ],
        actionUrl: `${CLIENT_URL}/orders/${orderId}`,
        actionText: 'View Return Details',
    });

    return await sendEmail({
        to: email,
        subject: `Return Request [#${returnId}] ${isApproved ? 'Approved' : 'Declined'}`,
        html,
        text: `Your return request #${returnId} was ${isApproved ? 'approved' : 'declined'}. Notes: ${notes || 'N/A'}`,
        recipientType: 'customer',
        template: `return_decision_${decision}`,
        metadata: { returnId, orderId, decision },
    });
};

/**
 * Item 45: Return Pickup Scheduled
 */
export const sendReturnPickupScheduledNotification = async ({ returnRequest, order, pickupDate, agentContact }) => {
    const { email, name } = resolveCustomerRecipient(returnRequest.userId || order);
    if (!email) return;
    const returnId = returnRequest.returnId || returnRequest._id;
    const orderId = order?.orderId || returnRequest.orderId?._id || returnRequest.orderId;

    const html = getCustomerReturnRefundTemplate({
        customerName: name,
        orderId,
        returnId,
        title: 'Return Pickup Scheduled',
        badgeText: 'Pickup Scheduled',
        badgeColor: 'blue',
        message: 'A pickup executive has been assigned to collect your return package. Please ensure the item is packed securely with all original accessories and box.',
        details: [
            { label: 'Return ID', value: `#${returnId}` },
            { label: 'Pickup Date', value: pickupDate || 'Next business day' },
            { label: 'Executive Contact', value: agentContact || 'Will contact on arrival' },
        ],
        actionUrl: `${CLIENT_URL}/orders/${orderId}`,
        actionText: 'View Pickup Details',
    });

    return await sendEmail({
        to: email,
        subject: `Pickup Scheduled for Return [#${returnId}]`,
        html,
        text: `Your return package pickup is scheduled for ${pickupDate || 'the next business day'}. Return #${returnId}.`,
        recipientType: 'customer',
        template: 'return_pickup_scheduled',
        metadata: { returnId, orderId },
    });
};

/**
 * Items 46–51: Return Milestones (picked up, received, inspection, replacement)
 */
export const sendReturnMilestoneNotification = async ({ returnRequest, order, milestone, notes }) => {
    const { email, name } = resolveCustomerRecipient(returnRequest.userId || order);
    if (!email) return;
    const returnId = returnRequest.returnId || returnRequest._id;
    const orderId = order?.orderId || returnRequest.orderId?._id || returnRequest.orderId;

    const milestoneConfig = {
        picked_up: { title: 'Return Item Picked Up', badge: 'Picked Up', color: 'blue', msg: 'Your return package has been successfully picked up and is in transit to the verification facility.' },
        received: { title: 'Return Package Received at Hub', badge: 'Received at Hub', color: 'blue', msg: 'Your returned package has arrived at our verification hub and is queued for quality inspection.' },
        inspection_completed: { title: 'Return Inspection Completed', badge: 'Inspection Passed', color: 'green', msg: 'Quality inspection has been successfully completed. Your refund or replacement is being processed.' },
        replacement_approved: { title: 'Replacement Item Approved', badge: 'Replacement Approved', color: 'green', msg: 'Your replacement request has been approved. A new item will be dispatched shortly.' },
        replacement_dispatched: { title: 'Replacement Dispatched', badge: 'Replacement In Transit', color: 'blue', msg: 'Your replacement item has been packed and handed over to our delivery partner.' },
        replacement_delivered: { title: 'Replacement Item Delivered', badge: 'Replacement Delivered', color: 'green', msg: 'Your replacement item has been successfully delivered. Thank you!' },
    };

    const cfg = milestoneConfig[milestone] || { title: 'Return Status Update', badge: milestone, color: 'amber', msg: 'Your return status has updated.' };

    const html = getCustomerReturnRefundTemplate({
        customerName: name,
        orderId,
        returnId,
        title: cfg.title,
        badgeText: cfg.badge,
        badgeColor: cfg.color,
        message: cfg.msg,
        details: [
            { label: 'Return ID', value: `#${returnId}` },
            { label: 'Milestone', value: cfg.badge },
            { label: 'Date', value: new Date().toLocaleDateString('en-IN') },
            ...(notes ? [{ label: 'Note', value: notes }] : []),
        ],
        actionUrl: `${CLIENT_URL}/orders/${orderId}`,
        actionText: 'View Status',
    });

    return await sendEmail({
        to: email,
        subject: `Return [#${returnId}] Update: ${cfg.badge}`,
        html,
        text: `Return #${returnId} milestone: ${cfg.badge}. ${cfg.msg}`,
        recipientType: 'customer',
        template: `return_milestone_${milestone}`,
        metadata: { returnId, orderId, milestone },
    });
};

/**
 * Items 52–55, 60: Refund Initiated / Processed / Failed / Rejected
 */
export const sendRefundStatusNotification = async (payload = {}) => {
    const { order, returnRequest, destination, transactionId, rrn } = payload;
    const refundObj = payload.refund || {};
    const rawStatus = payload.status || refundObj.status || 'initiated';
    const status = String(rawStatus).toLowerCase();
    const refundAmount = payload.refundAmount ?? refundObj.amount ?? 0;
    const refundDestination = destination || refundObj.method || refundObj.destination || 'Original Payment Mode / PLE Wallet';

    const { email, name } = resolveCustomerRecipient(returnRequest?.userId || order);
    if (!email) return;
    const orderId = order?.orderId || returnRequest?.orderId?._id || returnRequest?.orderId;
    const returnId = returnRequest?.returnId || returnRequest?._id;

    const statusTitles = {
        initiated: 'Refund Initiated',
        processed: 'Refund Successfully Processed',
        completed: 'Refund Successfully Processed',
        failed: 'Refund Processing Delay',
        rejected: 'Refund Request Rejected',
    };

    const badgeColors = {
        initiated: 'amber',
        processed: 'green',
        completed: 'green',
        failed: 'red',
        rejected: 'red',
    };

    const isProcessed = status === 'processed' || status === 'completed';

    const html = getCustomerReturnRefundTemplate({
        customerName: name,
        orderId,
        returnId,
        title: statusTitles[status] || 'Refund Update',
        badgeText: `Refund ${status.toUpperCase()}`,
        badgeColor: badgeColors[status] || 'amber',
        message: isProcessed
            ? `We have successfully credited your refund of ₹${Number(refundAmount || 0).toLocaleString('en-IN')}. It should reflect in your account within standard banking turnaround time.`
            : `Your refund for Order #${orderId} is currently ${status}. ${status === 'initiated' ? 'Bank transfers usually take 2-4 business days.' : ''}`,
        refundDetails: {
            amount: refundAmount,
            destination: refundDestination,
            transactionId: rrn || transactionId || null,
        },
        details: [
            { label: 'Order ID', value: `#${orderId}` },
            { label: 'Status', value: String(status).toUpperCase() },
            { label: 'Date', value: new Date().toLocaleDateString('en-IN') },
        ],
        actionUrl: `${CLIENT_URL}/wallet`,
        actionText: 'View Wallet & Transactions',
    });

    return await sendEmail({
        to: email,
        subject: `Refund ${status.toUpperCase()} for Order #${orderId} [₹${Number(refundAmount || 0).toLocaleString('en-IN')}]`,
        html,
        text: `Your refund of ₹${refundAmount} for Order #${orderId} has been ${status}. Destination: ${refundDestination}. Ref: ${rrn || transactionId || 'N/A'}`,
        recipientType: 'customer',
        template: `refund_status_${status}`,
        idempotencyKey: `refund_${orderId}_${status}_${Number(refundAmount || 0)}`,
        metadata: { orderId, returnId, refundAmount, status, transactionId },
    });
};

/**
 * Item 58: Credit Note Generated
 */
export const sendCreditNoteNotification = async ({ order, creditNoteNumber, amount, reason, pdfBuffer }) => {
    const { email, name } = resolveCustomerRecipient(order);
    if (!email) return;
    const orderId = order.orderId || order._id;

    const html = getCustomerReturnRefundTemplate({
        customerName: name,
        orderId,
        title: 'Official Credit Note Issued',
        badgeText: 'Credit Note',
        badgeColor: 'blue',
        message: `An official tax credit note [${creditNoteNumber}] has been issued for your cancelled or returned order. It is attached to this email.`,
        refundDetails: {
            amount,
            destination: 'Credit Adjustment',
            transactionId: creditNoteNumber,
        },
        details: [
            { label: 'Credit Note #', value: creditNoteNumber },
            { label: 'Order ID', value: `#${orderId}` },
            { label: 'Reason', value: reason || 'Goods return / order cancellation adjustment' },
        ],
        actionUrl: `${CLIENT_URL}/orders/${orderId}`,
        actionText: 'View Invoices & Credit Notes',
    });

    const attachments = [];
    if (pdfBuffer && Buffer.isBuffer(pdfBuffer)) {
        attachments.push({
            filename: `CreditNote-${creditNoteNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
        });
    }

    return await sendEmail({
        to: email,
        subject: `Credit Note [${creditNoteNumber}] for Order #${orderId}`,
        html,
        text: `Credit Note ${creditNoteNumber} for ₹${amount} issued for Order #${orderId}.`,
        attachments,
        recipientType: 'customer',
        template: 'credit_note_generated',
        idempotencyKey: `credit_note_${creditNoteNumber}`,
        metadata: { orderId, creditNoteNumber, amount },
    });
};

/**
 * Item 59: Payment Receipt
 */
export const sendPaymentReceiptNotification = async ({ order, transactionId, amount, paymentMethod }) => {
    const { email, name } = resolveCustomerRecipient(order);
    if (!email) return;
    const orderId = order.orderId || order._id;

    const html = getCustomerOrderNotificationTemplate({
        customerName: name,
        orderId,
        title: 'Payment Receipt Confirmation',
        badgeText: 'Payment Received',
        badgeColor: 'green',
        message: `We have received your payment of ₹${Number(amount || order.total || 0).toLocaleString('en-IN')}. Thank you!`,
        details: [
            { label: 'Order ID', value: `#${orderId}` },
            { label: 'Amount Paid', value: `₹${Number(amount || order.total || 0).toLocaleString('en-IN')}` },
            { label: 'Payment Method', value: paymentMethod || order.paymentMethod || 'Online' },
            { label: 'Transaction / RRN', value: transactionId || 'Verified' },
            { label: 'Date', value: new Date().toLocaleDateString('en-IN') },
        ],
        actionUrl: `${CLIENT_URL}/orders/${orderId}`,
        actionText: 'View Order Details',
    });

    return await sendEmail({
        to: email,
        subject: `Payment Receipt for Order #${orderId} [₹${Number(amount || order.total || 0).toLocaleString('en-IN')}]`,
        html,
        text: `Payment receipt for Order #${orderId}: ₹${amount || order.total} received via ${paymentMethod || 'Online'}. Transaction ID: ${transactionId || 'Verified'}.`,
        recipientType: 'customer',
        template: 'payment_receipt',
        idempotencyKey: `pay_receipt_${orderId}_${transactionId || 'success'}`,
        metadata: { orderId, transactionId, amount },
    });
};
