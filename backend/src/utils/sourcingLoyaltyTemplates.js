/**
 * PLE Store - Sourcing (SourceNow / PRS / RFQ), Marketing & Loyalty Email Templates
 * Premium responsive HTML templates with inline styles for maximum cross-client compatibility.
 */

const PLE_LOGO = 'https://ple.store/logo.png';
const CLIENT_URL = process.env.CLIENT_URL || 'https://ple.store';

const baseContainer = (content, headerBadge = 'SOURCING & PROCUREMENT') => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PLE Store Notification</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f3f4f6; padding: 24px 0;">
        <tr>
            <td align="center">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 620px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); border: 1px solid #e5e7eb;">
                    <!-- Brand Header -->
                    <tr>
                        <td style="background-color: #0b1528; padding: 24px 32px; text-align: left;">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td>
                                        <div style="color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">
                                            PLE <span style="color: #f59e0b;">STORE</span>
                                        </div>
                                        <div style="color: #94a3b8; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px;">
                                            Procurement & Loyalty Engine
                                        </div>
                                    </td>
                                    <td align="right">
                                        <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.12); color: #f8fafc; font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: 20px; letter-spacing: 0.5px; text-transform: uppercase;">
                                            ${headerBadge}
                                        </span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <!-- Main Body Content -->
                    <tr>
                        <td style="padding: 32px 32px 24px 32px;">
                            ${content}
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 32px; text-align: center;">
                            <div style="color: #64748b; font-size: 12px; line-height: 18px;">
                                © ${new Date().getFullYear()} PLE Store Pvt Ltd. All rights reserved.<br>
                                Automated notification from the PLE Commercial & Loyalty Platform.<br>
                                Need help? Contact <a href="mailto:support@ple.store" style="color: #2563eb; text-decoration: none; font-weight: 600;">support@ple.store</a>
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`;

/**
 * 1. SourceNow / PRS Email Template (Items 196–212)
 */
export const getSourceNowTemplate = ({
    title,
    subtitle,
    recipientName = 'Valued Partner',
    requestId,
    productName,
    category,
    quantity,
    budget,
    statusText,
    badgeColor = '#2563eb',
    message,
    details = [],
    quoteDetails = null,
    alternativeDetails = null,
    actionUrl,
    actionText = 'View Request Details'
}) => {
    let quoteHtml = '';
    if (quoteDetails) {
        quoteHtml = `
            <div style="background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 18px; margin: 20px 0;">
                <div style="font-weight: 700; color: #166534; font-size: 14px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
                    ✓ Supplier Quote Received
                </div>
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; color: #14532d;">
                    ${quoteDetails.price ? `<tr><td style="padding: 4px 0; font-weight: 600;">Offered Price:</td><td align="right" style="font-weight: 700; font-size: 16px; color: #15803d;">₹${quoteDetails.price}</td></tr>` : ''}
                    ${quoteDetails.deliveryTimeline ? `<tr><td style="padding: 4px 0; font-weight: 600;">Estimated Delivery:</td><td align="right">${quoteDetails.deliveryTimeline}</td></tr>` : ''}
                    ${quoteDetails.validUntil ? `<tr><td style="padding: 4px 0; font-weight: 600;">Quote Valid Until:</td><td align="right">${quoteDetails.validUntil}</td></tr>` : ''}
                    ${quoteDetails.notes ? `<tr><td colspan="2" style="padding-top: 8px; font-style: italic; color: #166534;">"${quoteDetails.notes}"</td></tr>` : ''}
                </table>
            </div>
        `;
    }

    let altHtml = '';
    if (alternativeDetails) {
        altHtml = `
            <div style="background-color: #fefce8; border: 1px solid #fde047; border-radius: 8px; padding: 18px; margin: 20px 0;">
                <div style="font-weight: 700; color: #854d0e; font-size: 14px; margin-bottom: 8px;">
                    Suggested Alternative Product
                </div>
                <div style="font-weight: 600; font-size: 15px; color: #713f12; margin-bottom: 4px;">
                    ${alternativeDetails.name || 'Recommended Alternative'}
                </div>
                <div style="font-size: 13px; color: #854d0e; line-height: 18px;">
                    ${alternativeDetails.description || 'Our sourcing team matched this in-stock product fitting your technical specifications.'}
                </div>
                ${alternativeDetails.price ? `<div style="font-weight: 700; color: #713f12; margin-top: 8px; font-size: 15px;">Price: ₹${alternativeDetails.price}</div>` : ''}
            </div>
        `;
    }

    let detailsRows = details.map(d => `
        <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 13px; width: 40%; font-weight: 500;">${d.label}:</td>
            <td style="padding: 8px 0; color: #0f172a; font-size: 13px; font-weight: 700; text-align: right;">${d.value}</td>
        </tr>
    `).join('');

    const content = `
        <div style="margin-bottom: 20px;">
            <span style="display: inline-block; background-color: ${badgeColor}; color: #ffffff; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 4px; text-transform: uppercase;">
                ${statusText || 'SourceNow'}
            </span>
            <div style="color: #0f172a; font-size: 22px; font-weight: 800; margin-top: 10px; line-height: 28px;">
                ${title}
            </div>
            ${subtitle ? `<div style="color: #64748b; font-size: 14px; margin-top: 4px;">${subtitle}</div>` : ''}
        </div>

        <p style="font-size: 15px; line-height: 22px; color: #334155; margin: 0 0 18px 0;">
            Hello <strong>${recipientName}</strong>,
        </p>

        <p style="font-size: 14px; line-height: 22px; color: #475569; margin: 0 0 20px 0;">
            ${message}
        </p>

        <!-- Sourcing Request Specs Card -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px;">
            <tr>
                <td colspan="2" style="border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; font-weight: 700; color: #0f172a; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">
                    Request Specifications
                </td>
            </tr>
            ${requestId ? `<tr><td style="padding: 8px 0; color: #64748b; font-size: 13px; width: 40%;">Request ID:</td><td style="padding: 8px 0; color: #0f172a; font-size: 13px; font-weight: 700; text-align: right;">#${requestId}</td></tr>` : ''}
            ${productName ? `<tr><td style="padding: 8px 0; color: #64748b; font-size: 13px; width: 40%;">Product:</td><td style="padding: 8px 0; color: #0f172a; font-size: 13px; font-weight: 700; text-align: right;">${productName}</td></tr>` : ''}
            ${category ? `<tr><td style="padding: 8px 0; color: #64748b; font-size: 13px; width: 40%;">Category:</td><td style="padding: 8px 0; color: #0f172a; font-size: 13px; font-weight: 600; text-align: right;">${category}</td></tr>` : ''}
            ${quantity ? `<tr><td style="padding: 8px 0; color: #64748b; font-size: 13px; width: 40%;">Required Quantity:</td><td style="padding: 8px 0; color: #0f172a; font-size: 13px; font-weight: 700; text-align: right;">${quantity} units</td></tr>` : ''}
            ${budget ? `<tr><td style="padding: 8px 0; color: #64748b; font-size: 13px; width: 40%;">Target Budget:</td><td style="padding: 8px 0; color: #0f172a; font-size: 13px; font-weight: 700; text-align: right;">₹${budget}</td></tr>` : ''}
            ${detailsRows}
        </table>

        ${quoteHtml}
        ${altHtml}

        <!-- CTA Button -->
        ${actionUrl ? `
            <div style="text-align: center; margin: 28px 0 16px 0;">
                <a href="${actionUrl}" style="display: inline-block; background-color: #0b1528; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 28px; border-radius: 6px; letter-spacing: 0.3px;">
                    ${actionText} →
                </a>
            </div>
        ` : ''}
    `;

    return baseContainer(content, 'SourceNow Procurement');
};

/**
 * 2. RFQ Email Template (Items 213–219)
 */
export const getRfqTemplate = ({
    title,
    subtitle,
    recipientName = 'Customer',
    rfqId,
    productName,
    quantity,
    targetPrice,
    statusText,
    badgeColor = '#2563eb',
    message,
    quotations = [],
    selectedQuotation = null,
    actionUrl,
    actionText = 'Review RFQ in Portal'
}) => {
    let quotesSection = '';
    if (quotations && quotations.length > 0) {
        const rows = quotations.map((q, idx) => `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 8px; font-weight: 600; color: #0f172a;">${q.vendorName || `Supplier #${idx + 1}`}</td>
                <td style="padding: 10px 8px; text-align: center; color: #475569;">${q.deliveryTime || 'Standard'}</td>
                <td style="padding: 10px 8px; text-align: right; font-weight: 700; color: #16a34a;">₹${q.totalPrice || q.unitPrice}</td>
            </tr>
        `).join('');

        quotesSection = `
            <div style="margin: 20px 0; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
                <div style="padding: 12px 16px; background-color: #f1f5f9; font-weight: 700; color: #1e293b; font-size: 13px; text-transform: uppercase;">
                    Quotations Summary (${quotations.length} Available)
                </div>
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px;">
                    <thead style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 11px; text-transform: uppercase;">
                        <tr>
                            <th align="left" style="padding: 8px;">Vendor</th>
                            <th align="center" style="padding: 8px;">Delivery</th>
                            <th align="right" style="padding: 8px;">Offered Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    }

    let selectedSection = '';
    if (selectedQuotation) {
        selectedSection = `
            <div style="background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 16px; margin: 18px 0;">
                <div style="font-weight: 700; color: #166534; font-size: 14px; margin-bottom: 6px;">
                    ✓ Accepted Proposal Details
                </div>
                <div style="font-size: 13px; color: #15803d; line-height: 20px;">
                    <strong>Vendor:</strong> ${selectedQuotation.vendorName || 'Verified Merchant'}<br>
                    <strong>Agreed Price:</strong> ₹${selectedQuotation.totalPrice || selectedQuotation.unitPrice}<br>
                    <strong>Delivery Window:</strong> ${selectedQuotation.deliveryTime || 'As scheduled'}<br>
                    ${selectedQuotation.notes ? `<strong>Notes:</strong> "${selectedQuotation.notes}"` : ''}
                </div>
            </div>
        `;
    }

    const content = `
        <div style="margin-bottom: 20px;">
            <span style="display: inline-block; background-color: ${badgeColor}; color: #ffffff; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 4px; text-transform: uppercase;">
                ${statusText || 'RFQ System'}
            </span>
            <div style="color: #0f172a; font-size: 22px; font-weight: 800; margin-top: 10px; line-height: 28px;">
                ${title}
            </div>
            ${subtitle ? `<div style="color: #64748b; font-size: 14px; margin-top: 4px;">${subtitle}</div>` : ''}
        </div>

        <p style="font-size: 15px; line-height: 22px; color: #334155; margin: 0 0 16px 0;">
            Hello <strong>${recipientName}</strong>,
        </p>

        <p style="font-size: 14px; line-height: 22px; color: #475569; margin: 0 0 20px 0;">
            ${message}
        </p>

        <!-- RFQ Info Card -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px;">
            ${rfqId ? `<tr><td style="padding: 6px 0; color: #64748b; font-size: 13px; width: 40%;">RFQ ID:</td><td style="padding: 6px 0; color: #0f172a; font-size: 13px; font-weight: 700; text-align: right;">#${rfqId}</td></tr>` : ''}
            ${productName ? `<tr><td style="padding: 6px 0; color: #64748b; font-size: 13px; width: 40%;">Product:</td><td style="padding: 6px 0; color: #0f172a; font-size: 13px; font-weight: 700; text-align: right;">${productName}</td></tr>` : ''}
            ${quantity ? `<tr><td style="padding: 6px 0; color: #64748b; font-size: 13px; width: 40%;">Quantity:</td><td style="padding: 6px 0; color: #0f172a; font-size: 13px; font-weight: 700; text-align: right;">${quantity} units</td></tr>` : ''}
            ${targetPrice ? `<tr><td style="padding: 6px 0; color: #64748b; font-size: 13px; width: 40%;">Target Price:</td><td style="padding: 6px 0; color: #0f172a; font-size: 13px; font-weight: 700; text-align: right;">₹${targetPrice}</td></tr>` : ''}
        </table>

        ${quotesSection}
        ${selectedSection}

        ${actionUrl ? `
            <div style="text-align: center; margin: 28px 0 16px 0;">
                <a href="${actionUrl}" style="display: inline-block; background-color: #0b1528; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 28px; border-radius: 6px;">
                    ${actionText} →
                </a>
            </div>
        ` : ''}
    `;

    return baseContainer(content, 'B2B & Commercial RFQ');
};

/**
 * 3. Marketing & Promotional Template (Items 220–225)
 */
export const getMarketingTemplate = ({
    headline,
    subheadline,
    customerName = 'Valued Customer',
    message,
    promoCode = null,
    discountText = null,
    validUntil = null,
    products = [],
    actionUrl,
    actionText = 'Shop Now'
}) => {
    let promoBanner = '';
    if (promoCode || discountText) {
        promoBanner = `
            <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border: 1px solid #f59e0b; border-radius: 10px; padding: 20px; text-align: center; color: #ffffff; margin: 24px 0;">
                ${discountText ? `<div style="font-size: 24px; font-weight: 800; color: #f59e0b; margin-bottom: 4px;">${discountText}</div>` : ''}
                <div style="font-size: 13px; color: #cbd5e1; margin-bottom: 12px;">Use promo code at checkout:</div>
                ${promoCode ? `<div style="display: inline-block; background-color: #ffffff; color: #0f172a; font-family: monospace; font-size: 18px; font-weight: 800; padding: 8px 24px; border-radius: 6px; letter-spacing: 2px;">${promoCode}</div>` : ''}
                ${validUntil ? `<div style="font-size: 11px; color: #94a3b8; margin-top: 10px;">Valid until: ${validUntil}</div>` : ''}
            </div>
        `;
    }

    let productsGrid = '';
    if (products && products.length > 0) {
        const productCards = products.slice(0, 4).map(p => `
            <td width="50%" style="padding: 8px; vertical-align: top;">
                <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; background-color: #ffffff;">
                    ${p.image ? `<img src="${p.image}" alt="${p.name}" style="width: 100%; max-height: 120px; object-fit: contain; margin-bottom: 8px; border-radius: 4px;" />` : ''}
                    <div style="font-weight: 700; font-size: 13px; color: #0f172a; height: 36px; overflow: hidden; margin-bottom: 4px;">${p.name}</div>
                    <div style="color: #16a34a; font-weight: 800; font-size: 15px;">₹${p.price}</div>
                    ${p.url ? `<a href="${p.url}" style="display: inline-block; margin-top: 8px; font-size: 11px; font-weight: 700; color: #2563eb; text-decoration: none;">View Item →</a>` : ''}
                </div>
            </td>
        `).join('');

        productsGrid = `
            <div style="margin: 24px 0;">
                <div style="font-weight: 700; color: #0f172a; font-size: 14px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                    Featured For You
                </div>
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                        ${productCards}
                    </tr>
                </table>
            </div>
        `;
    }

    const content = `
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="color: #0f172a; font-size: 24px; font-weight: 800; line-height: 30px;">
                ${headline}
            </div>
            ${subheadline ? `<div style="color: #64748b; font-size: 15px; margin-top: 6px;">${subheadline}</div>` : ''}
        </div>

        <p style="font-size: 15px; line-height: 24px; color: #334155; margin: 0 0 16px 0;">
            Hello <strong>${customerName}</strong>,
        </p>

        <p style="font-size: 14px; line-height: 22px; color: #475569; margin: 0 0 20px 0;">
            ${message}
        </p>

        ${promoBanner}
        ${productsGrid}

        ${actionUrl ? `
            <div style="text-align: center; margin: 28px 0 16px 0;">
                <a href="${actionUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 32px; border-radius: 6px;">
                    ${actionText} →
                </a>
            </div>
        ` : ''}
    `;

    return baseContainer(content, 'PLE Store Offers');
};

/**
 * 4. Abandoned Cart / Checkout Template (Items 226–227)
 */
export const getAbandonedCartTemplate = ({
    isCheckout = false,
    customerName = 'Valued Customer',
    items = [],
    totalAmount,
    recoveryUrl,
    discountOffer = null
}) => {
    const title = isCheckout ? 'Finish Your PLE Checkout' : 'Items Waiting In Your Cart';
    const subtitle = isCheckout
        ? 'You were almost there! Complete your purchase before items sell out.'
        : 'Don’t forget the items saved in your shopping cart.';

    const itemsRows = items.map(item => `
        <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0;">
                <div style="font-weight: 600; color: #0f172a; font-size: 13px;">${item.name || 'Product'}</div>
                <div style="color: #64748b; font-size: 12px;">Qty: ${item.quantity || 1}</div>
            </td>
            <td align="right" style="padding: 10px 0; font-weight: 700; color: #0f172a; font-size: 14px;">
                ₹${item.price || item.totalPrice}
            </td>
        </tr>
    `).join('');

    const content = `
        <div style="margin-bottom: 20px;">
            <span style="display: inline-block; background-color: #f59e0b; color: #ffffff; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 4px; text-transform: uppercase;">
                ${isCheckout ? 'Checkout Reminder' : 'Cart Reminder'}
            </span>
            <div style="color: #0f172a; font-size: 22px; font-weight: 800; margin-top: 10px; line-height: 28px;">
                ${title}
            </div>
            <div style="color: #64748b; font-size: 14px; margin-top: 4px;">${subtitle}</div>
        </div>

        <p style="font-size: 15px; line-height: 22px; color: #334155; margin: 0 0 16px 0;">
            Hi <strong>${customerName}</strong>,
        </p>

        <p style="font-size: 14px; line-height: 22px; color: #475569; margin: 0 0 20px 0;">
            We noticed you didn't finish your order. Your items are temporarily reserved for you:
        </p>

        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            ${itemsRows}
            ${totalAmount ? `
                <tr>
                    <td style="padding-top: 12px; font-weight: 700; color: #0f172a; font-size: 14px;">Total Value:</td>
                    <td align="right" style="padding-top: 12px; font-weight: 800; color: #16a34a; font-size: 16px;">₹${totalAmount}</td>
                </tr>
            ` : ''}
        </table>

        ${discountOffer ? `
            <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px; text-align: center; margin-bottom: 20px;">
                <div style="color: #1d4ed8; font-weight: 700; font-size: 13px;">Special Checkout Offer</div>
                <div style="color: #1e40af; font-size: 14px; margin-top: 4px;">Use code <strong>${discountOffer.code || 'COMPLETE10'}</strong> for ${discountOffer.text || 'an extra 10% off'}!</div>
            </div>
        ` : ''}

        <div style="text-align: center; margin: 28px 0 16px 0;">
            <a href="${recoveryUrl || `${CLIENT_URL}/cart`}" style="display: inline-block; background-color: #0b1528; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 32px; border-radius: 6px;">
                ${isCheckout ? 'Resume Checkout Now' : 'Return to My Cart'} →
            </a>
        </div>
    `;

    return baseContainer(content, 'Shopping Reminder');
};

/**
 * 5. Loyalty / PLE Points Template (Items 230–240)
 */
export const getLoyaltyTemplate = ({
    title,
    subtitle,
    customerName = 'Member',
    pointsDelta = 0,
    isDebit = false,
    balance = 0,
    rupeeValue = null,
    reason,
    orderNumber = null,
    expiryDate = null,
    milestoneName = null,
    benefits = [],
    actionUrl,
    actionText = 'View Loyalty Wallet'
}) => {
    const badgeColor = isDebit ? '#ef4444' : '#16a34a';
    const deltaSign = isDebit ? '-' : '+';

    let benefitsList = '';
    if (benefits && benefits.length > 0) {
        benefitsList = `
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <div style="font-weight: 700; color: #0f172a; font-size: 13px; text-transform: uppercase; margin-bottom: 8px;">
                    Exclusive Tier Perks Unlocked:
                </div>
                <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #475569; line-height: 20px;">
                    ${benefits.map(b => `<li>${b}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    const content = `
        <div style="margin-bottom: 20px;">
            <span style="display: inline-block; background-color: #f59e0b; color: #ffffff; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 4px; text-transform: uppercase;">
                PLE Points Rewards
            </span>
            <div style="color: #0f172a; font-size: 22px; font-weight: 800; margin-top: 10px; line-height: 28px;">
                ${title}
            </div>
            ${subtitle ? `<div style="color: #64748b; font-size: 14px; margin-top: 4px;">${subtitle}</div>` : ''}
        </div>

        <p style="font-size: 15px; line-height: 22px; color: #334155; margin: 0 0 16px 0;">
            Hello <strong>${customerName}</strong>,
        </p>

        <p style="font-size: 14px; line-height: 22px; color: #475569; margin: 0 0 20px 0;">
            ${reason}
        </p>

        <!-- Points Highlight Card -->
        <div style="background: linear-gradient(135deg, #0b1528 0%, #1e293b 100%); border-radius: 12px; padding: 24px; text-align: center; color: #ffffff; margin-bottom: 20px;">
            ${pointsDelta ? `
                <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 4px;">Transaction Amount</div>
                <div style="font-size: 32px; font-weight: 800; color: ${isDebit ? '#f87171' : '#4ade80'};">
                    ${deltaSign}${pointsDelta} Points
                </div>
            ` : ''}
            ${milestoneName ? `
                <div style="font-size: 20px; font-weight: 800; color: #f59e0b; margin-top: 8px;">
                    ★ ${milestoneName} Tier Member ★
                </div>
            ` : ''}
            <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255, 255, 255, 0.15); display: flex; justify-content: space-around;">
                <div>
                    <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase;">Current Balance</div>
                    <div style="font-size: 18px; font-weight: 700; color: #ffffff; margin-top: 2px;">${balance} Points</div>
                </div>
                ${rupeeValue ? `
                    <div>
                        <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase;">Worth In Store Credit</div>
                        <div style="font-size: 18px; font-weight: 700; color: #f59e0b; margin-top: 2px;">₹${rupeeValue}</div>
                    </div>
                ` : ''}
            </div>
        </div>

        ${orderNumber ? `
            <div style="font-size: 13px; color: #64748b; margin-bottom: 12px; text-align: center;">
                Related to Order <strong>#${orderNumber}</strong>
            </div>
        ` : ''}

        ${expiryDate ? `
            <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px; text-align: center; margin-bottom: 20px;">
                <div style="color: #991b1b; font-weight: 700; font-size: 13px;">⚠️ Points Expiry Notice</div>
                <div style="color: #b91c1c; font-size: 13px; margin-top: 4px;">Points scheduled to expire on <strong>${expiryDate}</strong>. Use them at checkout to save!</div>
            </div>
        ` : ''}

        ${benefitsList}

        <div style="text-align: center; margin: 28px 0 16px 0;">
            <a href="${actionUrl || `${CLIENT_URL}/account/loyalty`}" style="display: inline-block; background-color: #0b1528; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 28px; border-radius: 6px;">
                ${actionText} →
            </a>
        </div>
    `;

    return baseContainer(content, 'PLE Loyalty Club');
};
