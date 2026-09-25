import { ORDER_STATUS_CONFIG, ORDER_TIMELINE_STEPS } from '../constants/orderStatus.constants.js';

/**
 * Generates a responsive, modern HTML email for order status updates.
 * Styled in Peoples League of Electronics (PLE) signature crimson/dark theme.
 * Compatible with Gmail, Apple Mail, Outlook, and mobile clients.
 */
export const getOrderStatusEmailTemplate = ({
    order,
    status,
    customerName = 'Valued Customer',
    storeName = 'Peoples League of Electronics',
    storeUrl = process.env.CLIENT_URL || 'http://localhost:5173',
    supportEmail = process.env.SUPPORT_EMAIL || 'support@peoplesleague.com',
}) => {
    const config = ORDER_STATUS_CONFIG[status] || {
        label: status ? status.toUpperCase() : 'Order Update',
        customerMessage: `Your order status has been updated to ${status}.`,
        color: 'gray',
    };

    const orderId = order.orderId || order.id || order._id;
    const orderDate = order.createdAt || order.date
        ? new Date(order.createdAt || order.date).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
        : new Date().toLocaleDateString('en-IN');

    const items = Array.isArray(order.items) ? order.items : [];
    const shipping = order.shippingAddress || {};
    const trackingNumber = order.trackingNumber || '';

    // Step timeline visualization for standard lifecycle
    const currentStepIndex = ORDER_TIMELINE_STEPS.indexOf(status);
    const isCancelledOrReturned = status === 'cancelled' || status === 'returned';

    // Format currency
    const formatINR = (amount) => {
        const val = Number(amount) || 0;
        return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Render timeline steps
    const renderTimeline = () => {
        if (isCancelledOrReturned) {
            return `
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 20px 0; background-color: #2b1414; border: 1px solid #7B0A0A; border-radius: 8px; padding: 14px;">
                    <tr>
                        <td align="center" style="color: #ff8080; font-size: 14px; font-weight: 700;">
                            ⚠️ Status Notice: ${config.label}
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="color: #d4d4d8; font-size: 12px; padding-top: 4px;">
                            ${config.customerMessage}
                        </td>
                    </tr>
                </table>
            `;
        }

        const stepLabels = ['Confirmed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered'];
        const stepCells = ORDER_TIMELINE_STEPS.map((stepKey, idx) => {
            const isCompleted = currentStepIndex >= idx;
            const isCurrent = currentStepIndex === idx;

            const circleBg = isCompleted ? '#22c55e' : '#3f3f46';
            const textColor = isCompleted ? '#ffffff' : '#71717a';
            const labelColor = isCurrent ? '#f43f5e' : isCompleted ? '#22c55e' : '#71717a';
            const checkIcon = isCompleted ? '✓' : (idx + 1);

            return `
                <td align="center" style="padding: 4px 2px; vertical-align: top; width: 20%;">
                    <div style="width: 26px; height: 26px; line-height: 26px; border-radius: 50%; background-color: ${circleBg}; color: ${textColor}; font-size: 11px; font-weight: bold; margin: 0 auto 6px auto; text-align: center; ${isCurrent ? 'box-shadow: 0 0 8px #AE020B;' : ''}">
                        ${checkIcon}
                    </div>
                    <span style="font-size: 10px; font-weight: ${isCurrent ? '700' : '500'}; color: ${labelColor}; display: block; line-height: 1.2;">
                        ${stepLabels[idx]}
                    </span>
                </td>
            `;
        }).join('');

        return `
            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 20px 0; background-color: #1a1a20; border: 1px solid #2e2e38; border-radius: 10px; padding: 16px 8px;">
                <tr>
                    ${stepCells}
                </tr>
            </table>
        `;
    };

    // Render order items rows
    const renderItemsTable = () => {
        if (!items.length) {
            return `<tr><td colspan="3" style="padding: 12px; color: #a1a1aa; font-size: 12px; text-align: center;">No item details available</td></tr>`;
        }

        return items.map((item) => {
            const itemName = item.name || 'Product';
            const itemQty = item.quantity || 1;
            const itemPrice = Number(item.price) || 0;
            const itemTotal = itemPrice * itemQty;
            const itemImg = item.image;

            return `
                <tr style="border-bottom: 1px solid #27272a;">
                    <td style="padding: 10px 8px; vertical-align: middle;">
                        <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                            <tr>
                                ${itemImg ? `
                                    <td style="width: 44px; padding-right: 10px;">
                                        <img src="${itemImg}" alt="${itemName}" width="40" height="40" style="border-radius: 6px; object-fit: cover; display: block; border: 1px solid #3f3f46;" />
                                    </td>
                                ` : ''}
                                <td>
                                    <p style="margin: 0; color: #f4f4f5; font-size: 13px; font-weight: 600; line-height: 1.3;">
                                        ${itemName}
                                    </p>
                                    <p style="margin: 2px 0 0 0; color: #a1a1aa; font-size: 11px;">
                                        Qty: ${itemQty} × ${formatINR(itemPrice)}
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </td>
                    <td align="right" style="padding: 10px 8px; vertical-align: middle; color: #f4f4f5; font-size: 13px; font-weight: 600;">
                        ${formatINR(itemTotal)}
                    </td>
                </tr>
            `;
        }).join('');
    };

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.label} - ${orderId}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0d0d11;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
  </style>
</head>
<body style="margin: 0; padding: 16px 8px; background-color: #0d0d11;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #16161b; border: 1px solid #2a2a32; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);" border="0" cellspacing="0" cellpadding="0">
          
          <!-- Gradient Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #AE020B 0%, #C7141B 50%, #7B0A0A 100%); padding: 24px 20px; text-align: center;">
              <h1 style="margin: 0 0 4px 0; color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: 0.5px;">
                ${storeName}
              </h1>
              <p style="margin: 0; color: rgba(255, 255, 255, 0.9); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px;">
                Order Update Notice
              </p>
            </td>
          </tr>

          <!-- Status Highlight Card -->
          <tr>
            <td style="padding: 22px 24px 10px 24px;">
              <p style="margin: 0 0 6px 0; color: #a1a1aa; font-size: 13px;">
                Hello <strong>${customerName}</strong>,
              </p>
              <h2 style="margin: 0 0 8px 0; color: #ffffff; font-size: 18px; font-weight: 700;">
                ${config.label}
              </h2>
              <p style="margin: 0; color: #d4d4d8; font-size: 13px; line-height: 1.5;">
                ${config.customerMessage}
              </p>

              <!-- Order Metadata Pill -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 14px; background-color: #1f1f26; border-radius: 8px; padding: 10px 14px;">
                <tr>
                  <td style="color: #a1a1aa; font-size: 12px;">
                    Order ID: <strong style="color: #ffffff; font-family: monospace;">#${orderId}</strong>
                  </td>
                  <td align="right" style="color: #a1a1aa; font-size: 12px;">
                    ${orderDate}
                  </td>
                </tr>
              </table>

              <!-- Stepper Timeline -->
              ${renderTimeline()}

              <!-- Tracking Info (if present) -->
              ${trackingNumber ? `
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 12px 0; background-color: #14231b; border: 1px dashed #22c55e; border-radius: 8px; padding: 10px 14px;">
                    <tr>
                        <td style="color: #86efac; font-size: 12px; font-weight: 600;">
                            🚚 Tracking / AWB: <span style="font-family: monospace; color: #ffffff;">${trackingNumber}</span>
                        </td>
                    </tr>
                </table>
              ` : ''}

              <!-- Order Items Section -->
              <h3 style="margin: 18px 0 10px 0; color: #f4f4f5; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #27272a; padding-bottom: 6px;">
                Order Summary
              </h3>

              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                ${renderItemsTable()}
              </table>

              <!-- Totals Breakdown -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 14px; border-top: 1px solid #27272a; padding-top: 10px;">
                <tr>
                  <td style="padding: 3px 0; color: #a1a1aa; font-size: 12px;">Subtotal</td>
                  <td align="right" style="padding: 3px 0; color: #e4e4e7; font-size: 12px;">${formatINR(order.subtotal || 0)}</td>
                </tr>
                ${Number(order.discount || 0) > 0 ? `
                  <tr>
                    <td style="padding: 3px 0; color: #22c55e; font-size: 12px;">Discount</td>
                    <td align="right" style="padding: 3px 0; color: #22c55e; font-size: 12px;">-${formatINR(order.discount)}</td>
                  </tr>
                ` : ''}
                <tr>
                  <td style="padding: 3px 0; color: #a1a1aa; font-size: 12px;">Shipping</td>
                  <td align="right" style="padding: 3px 0; color: #e4e4e7; font-size: 12px;">${formatINR(order.shipping || 0)}</td>
                </tr>
                <tr>
                  <td style="padding: 3px 0; color: #a1a1aa; font-size: 12px;">Tax</td>
                  <td align="right" style="padding: 3px 0; color: #e4e4e7; font-size: 12px;">${formatINR(order.tax || 0)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0 4px 0; color: #ffffff; font-size: 14px; font-weight: 700; border-top: 1px solid #3f3f46;">Total Amount</td>
                  <td align="right" style="padding: 8px 0 4px 0; color: #AE020B; font-size: 16px; font-weight: 800; border-top: 1px solid #3f3f46;">
                    ${formatINR(order.total || 0)}
                  </td>
                </tr>
              </table>

              <!-- Delivery Address Block -->
              ${shipping.address || shipping.city ? `
                <div style="margin-top: 18px; padding: 12px 14px; background-color: #1a1a20; border-radius: 8px; border-left: 3px solid #AE020B;">
                  <p style="margin: 0 0 4px 0; color: #a1a1aa; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">
                    Delivery Address
                  </p>
                  <p style="margin: 0; color: #f4f4f5; font-size: 12px; line-height: 1.4;">
                    ${shipping.name ? `<strong>${shipping.name}</strong><br/>` : ''}
                    ${shipping.address || ''}<br/>
                    ${[shipping.city, shipping.state, shipping.zipCode].filter(Boolean).join(', ')}<br/>
                    ${shipping.phone ? `Phone: ${shipping.phone}` : ''}
                  </p>
                </div>
              ` : ''}

              <!-- View Order CTA Button -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 24px 0 10px 0;">
                <tr>
                  <td align="center">
                    <a href="${storeUrl}/orders/${orderId}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #AE020B 0%, #7B0A0A 100%); color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 12px rgba(174, 2, 11, 0.4);">
                      Track Your Order
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #111114; padding: 14px 20px; text-align: center; border-top: 1px solid #24242c;">
              <p style="margin: 0 0 4px 0; color: #71717a; font-size: 11px;">
                Questions about your order? Contact us at <a href="mailto:${supportEmail}" style="color: #a1a1aa; text-decoration: underline;">${supportEmail}</a>
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
};
