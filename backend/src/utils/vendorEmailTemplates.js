/**
 * Vendor / Seller HTML Email Template Generators
 * Peoples League of Electronics (PLE)
 * Professional merchant styling with clear tabular breakdowns and Indian compliance
 */

const baseVendorWrapper = ({ title, subtitle, content, storeName = 'PLE Merchant Portal', footerNote = '' }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subtitle || title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0b0c10;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
  </style>
</head>
<body style="margin: 0; padding: 18px 8px; background-color: #0b0c10;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #15161c; border: 1px solid #232530; border-radius: 12px; overflow: hidden; box-shadow: 0 12px 30px rgba(0,0,0,0.6);" border="0" cellspacing="0" cellpadding="0">
          
          <!-- Vendor Gradient Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%); padding: 22px 20px; text-align: center; border-bottom: 2px solid #6366f1;">
              <h1 style="margin: 0 0 4px 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">
                ${storeName}
              </h1>
              ${subtitle ? `<p style="margin: 0; color: rgba(255, 255, 255, 0.9); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.4px;">${subtitle}</p>` : ''}
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td style="padding: 24px 22px; color: #f3f4f6;">
              ${content}
            </td>
          </tr>

          <!-- Merchant Footer -->
          <tr>
            <td style="background-color: #0f1015; padding: 16px 20px; text-align: center; border-top: 1px solid #1c1d26;">
              <p style="margin: 0 0 6px 0; color: #9ca3af; font-size: 11px; line-height: 1.4;">
                ${footerNote || 'This is an official merchant operations notification from Peoples League of Electronics (PLE) Seller Network.'}
              </p>
              <p style="margin: 0; color: #6b7280; font-size: 10px;">
                © ${new Date().getFullYear()} Peoples League of Electronics Pvt Ltd. Vendor Partner Operations.
              </p>
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
 * 1. Vendor Onboarding, Verification & Security Template (Items 62-75)
 */
export const getVendorOnboardingTemplate = ({
    vendorName = 'Merchant Partner',
    storeName = '',
    title,
    badgeText = 'Account Notice',
    badgeColor = 'blue', // 'blue', 'green', 'amber', 'red'
    message,
    details = [],
    actionUrl,
    actionText = 'Open Vendor Portal',
    portalUrl = process.env.CLIENT_URL || 'http://localhost:5173',
}) => {
    const badgeColors = {
        blue: { bg: '#1e1b4b', border: '#4338ca', text: '#818cf8' },
        green: { bg: '#064e3b', border: '#059669', text: '#34d399' },
        amber: { bg: '#451a03', border: '#d97706', text: '#fbbf24' },
        red: { bg: '#450a0a', border: '#dc2626', text: '#f87171' },
    };
    const bColor = badgeColors[badgeColor] || badgeColors.blue;

    const detailsHtml = details.length > 0 ? `
      <div style="background-color: #1a1c24; border: 1px solid #2a2c3a; border-radius: 8px; padding: 14px; margin: 16px 0;">
        <table role="presentation" width="100%" style="font-size: 13px; line-height: 1.6;">
          ${details.map(d => `
            <tr>
              <td style="color: #9ca3af; padding: 4px 0; width: 42%; font-weight: 500;">${d.label}:</td>
              <td style="color: #ffffff; padding: 4px 0; font-weight: 600;">${d.value}</td>
            </tr>
          `).join('')}
        </table>
      </div>
    ` : '';

    const content = `
      <div style="margin-bottom: 14px;">
        <span style="background-color: ${bColor.bg}; border: 1px solid ${bColor.border}; color: ${bColor.text}; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 6px;">
          ${badgeText}
        </span>
      </div>

      <h2 style="margin: 0 0 10px 0; font-size: 18px; font-weight: 700; color: #ffffff;">
        ${title}
      </h2>
      <p style="margin: 0 0 12px 0; color: #9ca3af; font-size: 14px; line-height: 1.5;">
        Dear ${vendorName}${storeName ? ` (${storeName})` : ''},
      </p>
      <p style="margin: 0 0 14px 0; color: #e5e7eb; font-size: 14px; line-height: 1.6;">
        ${message}
      </p>

      ${detailsHtml}

      <div style="text-align: center; margin: 24px 0 12px 0;">
        <a href="${actionUrl || `${portalUrl}/vendor/login`}" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 600; padding: 12px 28px; border-radius: 8px; display: inline-block;">
          ${actionText}
        </a>
      </div>
    `;

    return baseVendorWrapper({
        title: 'Vendor Partner Operations',
        subtitle: 'Merchant Account',
        content,
    });
};

/**
 * 2. Vendor Product & Inventory Template (Items 76-89)
 */
export const getVendorProductTemplate = ({
    vendorName = 'Merchant Partner',
    productName,
    sku,
    title,
    badgeText = 'Catalog Notice',
    badgeColor = 'amber',
    message,
    details = [],
    actionUrl,
    actionText = 'Manage Catalog',
}) => {
    const badgeColors = {
        amber: { bg: '#451a03', border: '#d97706', text: '#fbbf24' },
        red: { bg: '#450a0a', border: '#dc2626', text: '#f87171' },
        green: { bg: '#064e3b', border: '#059669', text: '#34d399' },
        blue: { bg: '#1e1b4b', border: '#4338ca', text: '#818cf8' },
    };
    const bColor = badgeColors[badgeColor] || badgeColors.amber;

    const detailsHtml = details.length > 0 ? `
      <div style="background-color: #1a1c24; border: 1px solid #2a2c3a; border-radius: 8px; padding: 14px; margin: 16px 0;">
        <table role="presentation" width="100%" style="font-size: 13px; line-height: 1.6;">
          ${details.map(d => `
            <tr>
              <td style="color: #9ca3af; padding: 4px 0; width: 42%; font-weight: 500;">${d.label}:</td>
              <td style="color: #ffffff; padding: 4px 0; font-weight: 600;">${d.value}</td>
            </tr>
          `).join('')}
        </table>
      </div>
    ` : '';

    const content = `
      <div style="margin-bottom: 14px;">
        <span style="background-color: ${bColor.bg}; border: 1px solid ${bColor.border}; color: ${bColor.text}; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 6px;">
          ${badgeText}
        </span>
      </div>

      <h2 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: #ffffff;">
        ${title}
      </h2>
      ${productName ? `
        <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px;">
          <div style="color: #ffffff; font-size: 14px; font-weight: 600;">${productName}</div>
          ${sku ? `<div style="color: #9ca3af; font-size: 12px; margin-top: 2px;">SKU: ${sku}</div>` : ''}
        </div>
      ` : ''}
      <p style="margin: 0 0 14px 0; color: #e5e7eb; font-size: 14px; line-height: 1.6;">
        ${message}
      </p>

      ${detailsHtml}

      ${actionUrl ? `
        <div style="text-align: center; margin: 24px 0 12px 0;">
          <a href="${actionUrl}" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 600; padding: 11px 26px; border-radius: 8px; display: inline-block;">
            ${actionText}
          </a>
        </div>
      ` : ''}
    `;

    return baseVendorWrapper({
        title: 'PLE Catalog Management',
        subtitle: 'Inventory & Products',
        content,
    });
};

/**
 * 3. Vendor Order & Fulfillment Template with Item Isolation (Items 90-108)
 */
export const getVendorOrderTemplate = ({
    vendorName = 'Merchant Partner',
    orderId,
    title,
    badgeText = 'Order Alert',
    badgeColor = 'green',
    message,
    vendorItems = [],
    vendorSubtotal = 0,
    shippingDeadline,
    details = [],
    actionUrl,
    actionText = 'View Order Details',
}) => {
    const badgeColors = {
        green: { bg: '#064e3b', border: '#059669', text: '#34d399' },
        blue: { bg: '#1e1b4b', border: '#4338ca', text: '#818cf8' },
        amber: { bg: '#451a03', border: '#d97706', text: '#fbbf24' },
        red: { bg: '#450a0a', border: '#dc2626', text: '#f87171' },
    };
    const bColor = badgeColors[badgeColor] || badgeColors.green;

    // Itemized table strictly containing ONLY this vendor's allocated items
    const itemsTableHtml = Array.isArray(vendorItems) && vendorItems.length > 0 ? `
      <div style="background-color: #1a1c24; border: 1px solid #2a2c3a; border-radius: 8px; padding: 14px; margin: 16px 0;">
        <div style="color: #9ca3af; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 10px;">
          Your Order Items (Exclusive Fulfillment)
        </div>
        <table role="presentation" width="100%" style="font-size: 13px; line-height: 1.6; border-collapse: collapse;">
          ${vendorItems.map(item => `
            <tr style="border-bottom: 1px solid #242634;">
              <td style="color: #ffffff; padding: 6px 0; font-weight: 500;">
                ${item.name || item.title || 'Product Item'} 
                <span style="color: #9ca3af; font-size: 12px;">(x${item.quantity || 1})</span>
              </td>
              <td align="right" style="color: #34d399; padding: 6px 0; font-weight: 600;">
                ₹${Number(item.price || item.unitPrice || 0).toLocaleString('en-IN')}
              </td>
            </tr>
          `).join('')}
          ${vendorSubtotal > 0 ? `
            <tr>
              <td style="color: #ffffff; padding: 8px 0 2px 0; font-weight: 700;">Subtotal (Your Payout Base):</td>
              <td align="right" style="color: #34d399; padding: 8px 0 2px 0; font-weight: 700;">
                ₹${Number(vendorSubtotal).toLocaleString('en-IN')}
              </td>
            </tr>
          ` : ''}
        </table>
      </div>
    ` : '';

    const detailsHtml = details.length > 0 ? `
      <div style="background-color: #1a1c24; border: 1px solid #2a2c3a; border-radius: 8px; padding: 14px; margin: 16px 0;">
        <table role="presentation" width="100%" style="font-size: 13px; line-height: 1.6;">
          ${details.map(d => `
            <tr>
              <td style="color: #9ca3af; padding: 4px 0; width: 42%; font-weight: 500;">${d.label}:</td>
              <td style="color: #ffffff; padding: 4px 0; font-weight: 600;">${d.value}</td>
            </tr>
          `).join('')}
        </table>
      </div>
    ` : '';

    const content = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span style="background-color: ${bColor.bg}; border: 1px solid ${bColor.border}; color: ${bColor.text}; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 6px;">
          ${badgeText}
        </span>
        <span style="color: #9ca3af; font-size: 12px; font-weight: 600;">
          Order #${orderId}
        </span>
      </div>

      <h2 style="margin: 0 0 10px 0; font-size: 18px; font-weight: 700; color: #ffffff;">
        ${title}
      </h2>
      <p style="margin: 0 0 12px 0; color: #9ca3af; font-size: 14px; line-height: 1.5;">
        Hello ${vendorName},
      </p>
      <p style="margin: 0 0 14px 0; color: #e5e7eb; font-size: 14px; line-height: 1.6;">
        ${message}
      </p>

      ${shippingDeadline ? `
        <div style="background-color: #451a03; border: 1px solid #78350f; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px;">
          <span style="color: #fbbf24; font-size: 13px; font-weight: 600;">⏰ Dispatch SLA Deadline: ${shippingDeadline}</span>
        </div>
      ` : ''}

      ${itemsTableHtml}
      ${detailsHtml}

      ${actionUrl ? `
        <div style="text-align: center; margin: 24px 0 12px 0;">
          <a href="${actionUrl}" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 600; padding: 12px 28px; border-radius: 8px; display: inline-block;">
            ${actionText}
          </a>
        </div>
      ` : ''}
    `;

    return baseVendorWrapper({
        title: 'PLE Merchant Fulfillment',
        subtitle: `Order #${orderId}`,
        content,
    });
};

/**
 * 4. Vendor Return & Replacement Template (Items 109-119)
 */
export const getVendorReturnTemplate = ({
    vendorName = 'Merchant Partner',
    orderId,
    returnId,
    title,
    badgeText = 'Return Update',
    badgeColor = 'amber',
    message,
    returnItems = [],
    details = [],
    actionUrl,
    actionText = 'Review Return Request',
}) => {
    const badgeColors = {
        amber: { bg: '#451a03', border: '#d97706', text: '#fbbf24' },
        red: { bg: '#450a0a', border: '#dc2626', text: '#f87171' },
        blue: { bg: '#1e1b4b', border: '#4338ca', text: '#818cf8' },
        green: { bg: '#064e3b', border: '#059669', text: '#34d399' },
    };
    const bColor = badgeColors[badgeColor] || badgeColors.amber;

    const detailsHtml = details.length > 0 ? `
      <div style="background-color: #1a1c24; border: 1px solid #2a2c3a; border-radius: 8px; padding: 14px; margin: 16px 0;">
        <table role="presentation" width="100%" style="font-size: 13px; line-height: 1.6;">
          ${details.map(d => `
            <tr>
              <td style="color: #9ca3af; padding: 4px 0; width: 42%; font-weight: 500;">${d.label}:</td>
              <td style="color: #ffffff; padding: 4px 0; font-weight: 600;">${d.value}</td>
            </tr>
          `).join('')}
        </table>
      </div>
    ` : '';

    const content = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span style="background-color: ${bColor.bg}; border: 1px solid ${bColor.border}; color: ${bColor.text}; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 6px;">
          ${badgeText}
        </span>
        <span style="color: #9ca3af; font-size: 12px; font-weight: 600;">
          Return #${returnId || orderId}
        </span>
      </div>

      <h2 style="margin: 0 0 10px 0; font-size: 18px; font-weight: 700; color: #ffffff;">
        ${title}
      </h2>
      <p style="margin: 0 0 12px 0; color: #9ca3af; font-size: 14px; line-height: 1.5;">
        Hello ${vendorName},
      </p>
      <p style="margin: 0 0 14px 0; color: #e5e7eb; font-size: 14px; line-height: 1.6;">
        ${message}
      </p>

      ${detailsHtml}

      ${actionUrl ? `
        <div style="text-align: center; margin: 24px 0 12px 0;">
          <a href="${actionUrl}" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 600; padding: 11px 26px; border-radius: 8px; display: inline-block;">
            ${actionText}
          </a>
        </div>
      ` : ''}
    `;

    return baseVendorWrapper({
        title: 'PLE Reverse Logistics',
        subtitle: 'Returns & Reverse Supply Chain',
        content,
    });
};

/**
 * 5. Vendor Settlements, Payouts & Tax Invoices (Items 120-129)
 */
export const getVendorPayoutTemplate = ({
    vendorName = 'Merchant Partner',
    payoutId,
    title,
    badgeText = 'Financial Notice',
    badgeColor = 'green',
    message,
    amount = 0,
    details = [],
    actionUrl,
    actionText = 'View Settlement Statement',
}) => {
    const badgeColors = {
        green: { bg: '#064e3b', border: '#059669', text: '#34d399' },
        blue: { bg: '#1e1b4b', border: '#4338ca', text: '#818cf8' },
        amber: { bg: '#451a03', border: '#d97706', text: '#fbbf24' },
        red: { bg: '#450a0a', border: '#dc2626', text: '#f87171' },
    };
    const bColor = badgeColors[badgeColor] || badgeColors.green;

    const detailsHtml = details.length > 0 ? `
      <div style="background-color: #1a1c24; border: 1px solid #2a2c3a; border-radius: 8px; padding: 14px; margin: 16px 0;">
        <table role="presentation" width="100%" style="font-size: 13px; line-height: 1.6;">
          ${details.map(d => `
            <tr>
              <td style="color: #9ca3af; padding: 4px 0; width: 42%; font-weight: 500;">${d.label}:</td>
              <td style="color: #ffffff; padding: 4px 0; font-weight: 600;">${d.value}</td>
            </tr>
          `).join('')}
        </table>
      </div>
    ` : '';

    const content = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span style="background-color: ${bColor.bg}; border: 1px solid ${bColor.border}; color: ${bColor.text}; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 6px;">
          ${badgeText}
        </span>
        ${payoutId ? `<span style="color: #9ca3af; font-size: 12px; font-weight: 600;">Ref #${payoutId}</span>` : ''}
      </div>

      <h2 style="margin: 0 0 10px 0; font-size: 18px; font-weight: 700; color: #ffffff;">
        ${title}
      </h2>
      <p style="margin: 0 0 12px 0; color: #9ca3af; font-size: 14px; line-height: 1.5;">
        Dear ${vendorName},
      </p>
      <p style="margin: 0 0 14px 0; color: #e5e7eb; font-size: 14px; line-height: 1.6;">
        ${message}
      </p>

      ${amount > 0 ? `
        <div style="background-color: #0d1f18; border: 1px solid #059669; border-radius: 8px; padding: 16px; text-align: center; margin: 16px 0;">
          <div style="color: #9ca3af; font-size: 12px; text-transform: uppercase; font-weight: 600;">Settlement Amount</div>
          <div style="color: #34d399; font-size: 24px; font-weight: 800; margin-top: 4px;">
            ₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
      ` : ''}

      ${detailsHtml}

      ${actionUrl ? `
        <div style="text-align: center; margin: 24px 0 12px 0;">
          <a href="${actionUrl}" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 600; padding: 12px 28px; border-radius: 8px; display: inline-block;">
            ${actionText}
          </a>
        </div>
      ` : ''}
    `;

    return baseVendorWrapper({
        title: 'PLE Financial Services',
        subtitle: 'Settlements & Payouts',
        content,
    });
};
