/**
 * Customer HTML Email Template Generators
 * Peoples League of Electronics (PLE)
 * Compatible with all desktop, mobile, and webmail clients.
 */

const baseWrapper = ({ title, subtitle, content, storeName = 'Peoples League of Electronics', footerNote = '' }) => `
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
      background-color: #0d0d10;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
  </style>
</head>
<body style="margin: 0; padding: 16px 8px; background-color: #0d0d10;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #16161a; border: 1px solid #28282e; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);" border="0" cellspacing="0" cellpadding="0">
          
          <!-- Gradient Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #AE020B 0%, #C7141B 50%, #7B0A0A 100%); padding: 22px 20px; text-align: center;">
              <h1 style="margin: 0 0 4px 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">
                ${storeName}
              </h1>
              ${subtitle ? `<p style="margin: 0; color: rgba(255, 255, 255, 0.9); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.2px;">${subtitle}</p>` : ''}
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 24px 22px; color: #f4f4f5;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #111114; padding: 16px 20px; text-align: center; border-top: 1px solid #1f1f24;">
              <p style="margin: 0 0 6px 0; color: #71717a; font-size: 11px; line-height: 1.4;">
                ${footerNote || 'You are receiving this notification regarding your Peoples League of Electronics account or order.'}
              </p>
              <p style="margin: 0; color: #52525b; font-size: 10px;">
                © ${new Date().getFullYear()} ${storeName}. All rights reserved.
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
 * 1. Customer Welcome Email Template (Item 1)
 */
export const getCustomerWelcomeTemplate = ({
    customerName = 'Valued Customer',
    loginUrl = process.env.CLIENT_URL || 'http://localhost:5173',
    storeName = 'Peoples League of Electronics',
}) => {
    const content = `
      <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #ffffff;">
        Welcome to ${storeName}, ${customerName}! 🎉
      </h2>
      <p style="margin: 0 0 16px 0; color: #a1a1aa; font-size: 14px; line-height: 1.6;">
        We are thrilled to have you join our marketplace. Your account has been successfully created and verified. You can now explore high-quality electronics, track your purchases in real-time, and enjoy exclusive member privileges.
      </p>

      <div style="background-color: #1c1c22; border: 1px solid #2e2e38; border-radius: 10px; padding: 16px; margin: 0 0 20px 0;">
        <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600; color: #ffffff;">
          What you can do next:
        </h3>
        <ul style="margin: 0; padding-left: 20px; color: #a1a1aa; font-size: 13px; line-height: 1.8;">
          <li>Browse thousands of verified electronics with GST invoices</li>
          <li>Save items to your personal wishlist and receive stock alerts</li>
          <li>Request custom quotes or submit PRS requests via SourceNow</li>
          <li>Earn PLE reward points on eligible purchases</li>
        </ul>
      </div>

      <div style="text-align: center; margin: 24px 0 16px 0;">
        <a href="${loginUrl}" style="background-color: #AE020B; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 8px; display: inline-block;">
          Start Shopping
        </a>
      </div>
    `;

    return baseWrapper({
        title: storeName,
        subtitle: 'Welcome to PLE',
        content,
        storeName,
        footerNote: 'This is an automated account confirmation message.',
    });
};

/**
 * 2. Security Alert Email Template (Items 3, 4, 6, 7, 8, 9, 10)
 */
export const getSecurityAlertTemplate = ({
    customerName = 'Valued Customer',
    title = 'Security Alert',
    message,
    details = [],
    device,
    ip,
    location,
    time,
    actionUrl,
    actionText = 'Review Security Settings',
    alertType = 'info', // 'info', 'warning', 'danger'
    storeName = 'Peoples League of Electronics',
}) => {
    const badgeColors = {
        info: { bg: '#1e293b', border: '#334155', text: '#38bdf8' },
        warning: { bg: '#3b2512', border: '#78350f', text: '#fbbf24' },
        danger: { bg: '#361214', border: '#7f1d1d', text: '#f87171' },
    };
    const bColor = badgeColors[alertType] || badgeColors.info;

    const mergedDetails = [...details];
    if (device && !mergedDetails.some(d => String(d.label).toLowerCase().includes('device'))) {
        mergedDetails.push({ label: 'Device / Browser', value: device });
    }
    if (ip && !mergedDetails.some(d => String(d.label).toLowerCase().includes('ip'))) {
        mergedDetails.push({ label: 'IP Address', value: ip });
    }
    if (location && !mergedDetails.some(d => String(d.label).toLowerCase().includes('location'))) {
        mergedDetails.push({ label: 'Location', value: location });
    }
    if (time && !mergedDetails.some(d => String(d.label).toLowerCase().includes('time'))) {
        mergedDetails.push({ label: 'Timestamp', value: time });
    }

    const detailsHtml = mergedDetails.length > 0 ? `
      <div style="background-color: #1a1a20; border: 1px solid #2a2a34; border-radius: 8px; padding: 14px; margin: 16px 0;">
        <table role="presentation" width="100%" style="font-size: 13px; line-height: 1.6;">
          ${mergedDetails.map(d => `
            <tr>
              <td style="color: #71717a; padding: 4px 0; width: 40%; font-weight: 500;">${d.label}:</td>
              <td style="color: #ffffff; padding: 4px 0; font-weight: 600;">${d.value}</td>
            </tr>
          `).join('')}
        </table>
      </div>
    ` : '';

    const content = `
      <div style="display: inline-block; background-color: ${bColor.bg}; border: 1px solid ${bColor.border}; border-radius: 6px; padding: 4px 10px; margin-bottom: 14px;">
        <span style="color: ${bColor.text}; font-size: 11px; font-weight: 700; text-transform: uppercase;">Security Notice</span>
      </div>

      <h2 style="margin: 0 0 10px 0; font-size: 17px; font-weight: 700; color: #ffffff;">
        ${title}
      </h2>
      <p style="margin: 0 0 12px 0; color: #a1a1aa; font-size: 14px; line-height: 1.5;">
        Hello ${customerName},
      </p>
      <p style="margin: 0 0 16px 0; color: #d4d4d8; font-size: 14px; line-height: 1.6;">
        ${message}
      </p>

      ${detailsHtml}

      ${actionUrl ? `
        <div style="text-align: center; margin: 24px 0 12px 0;">
          <a href="${actionUrl}" style="background-color: #AE020B; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 600; padding: 10px 24px; border-radius: 8px; display: inline-block;">
            ${actionText}
          </a>
        </div>
      ` : ''}

      <p style="margin: 20px 0 0 0; color: #71717a; font-size: 12px; line-height: 1.5;">
        If you did not authorize this change or recognize this activity, please contact support or immediately update your password.
      </p>
    `;

    return baseWrapper({
        title: storeName,
        subtitle: 'Account Security Notification',
        content,
        storeName,
    });
};

/**
 * 3. Shopping / Sourcing / RFQ Notification Template (Items 11, 12, 13, 14, 15, 16, 17)
 */
export const getShoppingAlertTemplate = ({
    customerName = 'Valued Customer',
    title,
    subtitle = 'Shopping Update',
    message,
    product = null,
    details = [],
    actionUrl,
    actionText = 'View Details',
    storeName = 'Peoples League of Electronics',
}) => {
    const productHtml = product ? `
      <div style="background-color: #1a1a22; border: 1px solid #2d2d38; border-radius: 10px; padding: 14px; margin: 16px 0; display: flex; align-items: center;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            ${product.image ? `
              <td width="70" valign="top">
                <img src="${product.image}" alt="${product.name}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; border: 1px solid #333;" />
              </td>
            ` : ''}
            <td valign="middle" style="padding-left: ${product.image ? '12px' : '0'};">
              <div style="color: #ffffff; font-size: 14px; font-weight: 600; margin-bottom: 4px;">${product.name}</div>
              ${product.price ? `<div style="color: #4ade80; font-size: 14px; font-weight: 700;">₹${Number(product.price).toLocaleString('en-IN')}</div>` : ''}
              ${product.oldPrice ? `<div style="color: #71717a; font-size: 12px; text-decoration: line-through;">Previous: ₹${Number(product.oldPrice).toLocaleString('en-IN')}</div>` : ''}
            </td>
          </tr>
        </table>
      </div>
    ` : '';

    const detailsHtml = details.length > 0 ? `
      <div style="background-color: #1a1a20; border: 1px solid #2a2a34; border-radius: 8px; padding: 12px 16px; margin: 16px 0;">
        <table role="presentation" width="100%" style="font-size: 13px; line-height: 1.6;">
          ${details.map(d => `
            <tr>
              <td style="color: #71717a; padding: 3px 0; width: 40%; font-weight: 500;">${d.label}:</td>
              <td style="color: #ffffff; padding: 3px 0; font-weight: 600;">${d.value}</td>
            </tr>
          `).join('')}
        </table>
      </div>
    ` : '';

    const content = `
      <h2 style="margin: 0 0 10px 0; font-size: 17px; font-weight: 700; color: #ffffff;">
        ${title}
      </h2>
      <p style="margin: 0 0 12px 0; color: #a1a1aa; font-size: 14px; line-height: 1.5;">
        Hello ${customerName},
      </p>
      <p style="margin: 0 0 14px 0; color: #d4d4d8; font-size: 14px; line-height: 1.6;">
        ${message}
      </p>

      ${productHtml}
      ${detailsHtml}

      ${actionUrl ? `
        <div style="text-align: center; margin: 24px 0 12px 0;">
          <a href="${actionUrl}" style="background-color: #AE020B; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 600; padding: 11px 26px; border-radius: 8px; display: inline-block;">
            ${actionText}
          </a>
        </div>
      ` : ''}
    `;

    return baseWrapper({
        title: storeName,
        subtitle,
        content,
        storeName,
    });
};

/**
 * 4. General Order / Logistics / Payment Event Template (Items 20, 21, 22, 24-29, 34, 35, 37, 39, 40, 41)
 */
export const getCustomerOrderNotificationTemplate = ({
    customerName = 'Valued Customer',
    orderId,
    title,
    badgeText = 'Order Update',
    badgeColor = 'amber', // 'amber', 'blue', 'green', 'red', 'purple'
    message,
    details = [],
    items = [],
    subtotal,
    tax,
    shipping,
    totalAmount,
    actionUrl,
    actionText = 'View Order',
    storeName = 'Peoples League of Electronics',
}) => {
    const badgeColors = {
        amber: { bg: '#332310', border: '#78350f', text: '#fbbf24' },
        blue: { bg: '#172554', border: '#1e40af', text: '#60a5fa' },
        green: { bg: '#142e1d', border: '#166534', text: '#4ade80' },
        red: { bg: '#3b1214', border: '#991b1b', text: '#f87171' },
        purple: { bg: '#2b163b', border: '#6b21a8', text: '#c084fc' },
    };
    const bColor = badgeColors[badgeColor] || badgeColors.amber;

    const itemsHtml = Array.isArray(items) && items.length > 0 ? `
      <div style="background-color: #18181e; border: 1px solid #282832; border-radius: 8px; padding: 14px; margin: 16px 0;">
        <table role="presentation" width="100%" style="font-size: 13px; line-height: 1.6; border-collapse: collapse;">
          ${items.map(item => `
            <tr>
              <td style="color: #ffffff; padding: 6px 0; font-weight: 500;">${item.name || item.title || 'Product'} (x${item.quantity || 1})</td>
              <td align="right" style="color: #4ade80; padding: 6px 0; font-weight: 600;">₹${Number(item.price || 0).toLocaleString('en-IN')}</td>
            </tr>
          `).join('')}
          ${typeof tax !== 'undefined' ? `
            <tr style="border-top: 1px solid #282832;">
              <td style="color: #71717a; padding: 6px 0 2px 0;">Estimated GST / Tax:</td>
              <td align="right" style="color: #a1a1aa; padding: 6px 0 2px 0;">₹${Number(tax).toLocaleString('en-IN')}</td>
            </tr>
          ` : ''}
          ${typeof totalAmount !== 'undefined' ? `
            <tr>
              <td style="color: #ffffff; padding: 4px 0; font-weight: 700;">Total Amount:</td>
              <td align="right" style="color: #ffffff; padding: 4px 0; font-weight: 700;">₹${Number(totalAmount).toLocaleString('en-IN')}</td>
            </tr>
          ` : ''}
        </table>
      </div>
    ` : '';

    const detailsHtml = details.length > 0 ? `
      <div style="background-color: #18181e; border: 1px solid #282832; border-radius: 8px; padding: 14px; margin: 16px 0;">
        <table role="presentation" width="100%" style="font-size: 13px; line-height: 1.6;">
          ${details.map(d => `
            <tr>
              <td style="color: #71717a; padding: 4px 0; width: 42%; font-weight: 500;">${d.label}:</td>
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
        <span style="color: #71717a; font-size: 12px; font-weight: 500;">
          Order #${orderId}
        </span>
      </div>

      <h2 style="margin: 0 0 10px 0; font-size: 17px; font-weight: 700; color: #ffffff;">
        ${title}
      </h2>
      <p style="margin: 0 0 12px 0; color: #a1a1aa; font-size: 14px; line-height: 1.5;">
        Hello ${customerName},
      </p>
      <p style="margin: 0 0 14px 0; color: #d4d4d8; font-size: 14px; line-height: 1.6;">
        ${message}
      </p>

      ${itemsHtml}
      ${detailsHtml}

      ${actionUrl ? `
        <div style="text-align: center; margin: 24px 0 12px 0;">
          <a href="${actionUrl}" style="background-color: #AE020B; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 600; padding: 11px 26px; border-radius: 8px; display: inline-block;">
            ${actionText}
          </a>
        </div>
      ` : ''}
    `;

    return baseWrapper({
        title: storeName,
        subtitle: `Order #${orderId}`,
        content,
        storeName,
    });
};

/**
 * 5. Returns and Refunds Notification Template (Items 42-55, 58, 60)
 */
export const getCustomerReturnRefundTemplate = ({
    customerName = 'Valued Customer',
    orderId,
    returnId,
    title,
    badgeText = 'Return Update',
    badgeColor = 'amber',
    message,
    details = [],
    refundDetails = null,
    actionUrl,
    actionText = 'View Return Status',
    storeName = 'Peoples League of Electronics',
}) => {
    const badgeColors = {
        amber: { bg: '#332310', border: '#78350f', text: '#fbbf24' },
        blue: { bg: '#172554', border: '#1e40af', text: '#60a5fa' },
        green: { bg: '#142e1d', border: '#166534', text: '#4ade80' },
        red: { bg: '#3b1214', border: '#991b1b', text: '#f87171' },
    };
    const bColor = badgeColors[badgeColor] || badgeColors.amber;

    const detailsHtml = details.length > 0 ? `
      <div style="background-color: #18181e; border: 1px solid #282832; border-radius: 8px; padding: 14px; margin: 16px 0;">
        <table role="presentation" width="100%" style="font-size: 13px; line-height: 1.6;">
          ${details.map(d => `
            <tr>
              <td style="color: #71717a; padding: 4px 0; width: 42%; font-weight: 500;">${d.label}:</td>
              <td style="color: #ffffff; padding: 4px 0; font-weight: 600;">${d.value}</td>
            </tr>
          `).join('')}
        </table>
      </div>
    ` : '';

    const refundHtml = refundDetails ? `
      <div style="background-color: #132418; border: 1px solid #166534; border-radius: 10px; padding: 16px; margin: 16px 0; text-align: center;">
        <div style="color: #86efac; font-size: 12px; font-weight: 600; text-transform: uppercase;">Refund Amount</div>
        <div style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 6px 0;">₹${Number(refundDetails.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        <div style="color: #a1a1aa; font-size: 12px;">Method: <strong>${refundDetails.destination || 'Original Payment Mode'}</strong></div>
        ${refundDetails.transactionId ? `<div style="color: #71717a; font-size: 11px; margin-top: 4px;">Ref/ARN: ${refundDetails.transactionId}</div>` : ''}
      </div>
    ` : '';

    const content = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span style="background-color: ${bColor.bg}; border: 1px solid ${bColor.border}; color: ${bColor.text}; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 6px;">
          ${badgeText}
        </span>
        <span style="color: #71717a; font-size: 12px; font-weight: 500;">
          ${returnId ? `Return #${returnId}` : `Order #${orderId}`}
        </span>
      </div>

      <h2 style="margin: 0 0 10px 0; font-size: 17px; font-weight: 700; color: #ffffff;">
        ${title}
      </h2>
      <p style="margin: 0 0 12px 0; color: #a1a1aa; font-size: 14px; line-height: 1.5;">
        Hello ${customerName},
      </p>
      <p style="margin: 0 0 14px 0; color: #d4d4d8; font-size: 14px; line-height: 1.6;">
        ${message}
      </p>

      ${refundHtml}
      ${detailsHtml}

      ${actionUrl ? `
        <div style="text-align: center; margin: 24px 0 12px 0;">
          <a href="${actionUrl}" style="background-color: #AE020B; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 600; padding: 11px 26px; border-radius: 8px; display: inline-block;">
            ${actionText}
          </a>
        </div>
      ` : ''}
    `;

    return baseWrapper({
        title: storeName,
        subtitle: 'Returns & Refunds',
        content,
        storeName,
    });
};
