/**
 * Generates a responsive, modern HTML email for customer tax invoice / order bill delivery.
 * Styled in Peoples League of Electronics (PLE) signature crimson / dark theme,
 * fully compatible with Gmail, Apple Mail, Outlook, Yahoo, and mobile email clients.
 */
export const getInvoiceEmailTemplate = ({
    order,
    invoice,
    customerName = 'Valued Customer',
    storeName = process.env.FROM_NAME || 'Peoples League of Electronics',
    storeUrl = process.env.CLIENT_URL || 'http://localhost:5173',
    supportEmail = process.env.SUPPORT_EMAIL || 'support@peoplesleague.com',
}) => {
    const orderId = order.orderId || order.id || order._id;
    const invoiceNumber = invoice?.invoiceNumber || `INV-${orderId}`;
    const orderDate = invoice?.invoiceDate || order.createdAt || new Date();
    const formattedDate = new Date(orderDate).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    const items = Array.isArray(invoice?.items) && invoice.items.length > 0
        ? invoice.items
        : (Array.isArray(order.items) ? order.items : []);

    const shipping = invoice?.shippingAddress || order.shippingAddress || {};
    const billing = invoice?.billingAddress || order.billingAddress || shipping;
    const financial = invoice?.financialSummary || {
        subtotal: order.subtotal || 0,
        shipping: order.shipping || 0,
        tax: order.tax || 0,
        discount: order.discount || 0,
        grandTotal: order.total || 0,
    };

    const paymentMethod = (invoice?.payment?.method || order.paymentMethod || 'cod').toUpperCase();
    const paymentStatus = (invoice?.payment?.status || order.paymentStatus || 'pending').toUpperCase();
    const transactionId = invoice?.payment?.transactionId || order.paymentDetails?.razorpayPaymentId || '';

    // Currency formatting helper
    const formatINR = (amount) => {
        const val = Number(amount) || 0;
        return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Render line items
    const renderItemsTable = () => {
        if (!items.length) {
            return `<tr><td colspan="3" style="padding: 12px; color: #a1a1aa; font-size: 12px; text-align: center;">No item details recorded</td></tr>`;
        }

        return items.map((item) => {
            const name = item.name || 'Product Item';
            const qty = item.quantity || 1;
            const price = Number(item.price) || 0;
            const total = item.totalAmount || (price * qty);
            const gstRate = item.gstRate !== undefined ? `${item.gstRate}%` : '18%';

            return `
                <tr style="border-bottom: 1px solid #27272a;">
                    <td style="padding: 10px 8px; vertical-align: middle;">
                        <p style="margin: 0; color: #f4f4f5; font-size: 13px; font-weight: 600; line-height: 1.3;">
                            ${name}
                        </p>
                        <p style="margin: 3px 0 0 0; color: #a1a1aa; font-size: 11px;">
                            Qty: <strong style="color: #e4e4e7;">${qty}</strong> × ${formatINR(price)} <span style="color: #71717a;">(GST: ${gstRate})</span>
                        </p>
                    </td>
                    <td align="right" style="padding: 10px 8px; vertical-align: middle; color: #f4f4f5; font-size: 13px; font-weight: 700;">
                        ${formatINR(total)}
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
  <title>Tax Invoice for Order #${orderId}</title>
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
        <!-- Main Container -->
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #16161b; border: 1px solid #2a2a32; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);" border="0" cellspacing="0" cellpadding="0">
          
          <!-- Gradient Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #AE020B 0%, #C7141B 50%, #7B0A0A 100%); padding: 24px 20px; text-align: center;">
              <h1 style="margin: 0 0 4px 0; color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: 0.5px;">
                ${storeName}
              </h1>
              <p style="margin: 0; color: rgba(255, 255, 255, 0.9); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;">
                Official Tax Invoice / Bill
              </p>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 24px 24px 12px 24px;">
              <p style="margin: 0 0 6px 0; color: #a1a1aa; font-size: 13px;">
                Hello <strong>${customerName}</strong>,
              </p>
              <h2 style="margin: 0 0 8px 0; color: #ffffff; font-size: 18px; font-weight: 700;">
                Your Order Bill & Invoice is Ready
              </h2>
              <p style="margin: 0; color: #d4d4d8; font-size: 13px; line-height: 1.5;">
                Thank you for shopping with ${storeName}. Your order has been placed and confirmed. Your official tax invoice has been generated and is attached to this email as a PDF document.
              </p>

              <!-- PDF Attachment Notice Card -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 16px 0; background-color: #1c261e; border: 1px dashed #22c55e; border-radius: 10px; padding: 12px 16px;">
                <tr>
                  <td style="width: 32px; font-size: 20px; vertical-align: middle;">
                    📎
                  </td>
                  <td style="vertical-align: middle;">
                    <p style="margin: 0; color: #86efac; font-size: 13px; font-weight: 700;">
                      Invoice PDF Attached: <span style="font-family: monospace; color: #ffffff;">Invoice-${invoiceNumber}.pdf</span>
                    </p>
                    <p style="margin: 2px 0 0 0; color: #d1fae5; font-size: 11px;">
                      Open or download the attachment to view your complete computer-generated tax bill.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Invoice & Order Metadata Box -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #1f1f26; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px;">
                <tr>
                  <td style="color: #a1a1aa; font-size: 12px; padding: 3px 0;">
                    Invoice No: <strong style="color: #ffffff; font-family: monospace;">${invoiceNumber}</strong>
                  </td>
                  <td align="right" style="color: #a1a1aa; font-size: 12px; padding: 3px 0;">
                    Date: <strong style="color: #ffffff;">${formattedDate}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="color: #a1a1aa; font-size: 12px; padding: 3px 0;">
                    Order ID: <strong style="color: #ffffff; font-family: monospace;">#${orderId}</strong>
                  </td>
                  <td align="right" style="color: #a1a1aa; font-size: 12px; padding: 3px 0;">
                    Status: <span style="color: #22c55e; font-weight: 700;">${paymentStatus}</span>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="color: #a1a1aa; font-size: 11px; padding: 3px 0; border-top: 1px solid #2a2a34; margin-top: 4px;">
                    Payment: <strong style="color: #e4e4e7;">${paymentMethod}</strong> ${transactionId ? `(Txn: ${transactionId})` : ''}
                  </td>
                </tr>
              </table>

              <!-- Order Items Section -->
              <h3 style="margin: 18px 0 10px 0; color: #f4f4f5; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #27272a; padding-bottom: 6px;">
                Order Summary
              </h3>

              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                ${renderItemsTable()}
              </table>

              <!-- Financial Totals Breakdown -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 14px; border-top: 1px solid #27272a; padding-top: 10px;">
                <tr>
                  <td style="padding: 4px 0; color: #a1a1aa; font-size: 12px;">Items Subtotal</td>
                  <td align="right" style="padding: 4px 0; color: #e4e4e7; font-size: 12px;">${formatINR(financial.subtotal || 0)}</td>
                </tr>
                ${Number(financial.discount || 0) > 0 ? `
                  <tr>
                    <td style="padding: 4px 0; color: #22c55e; font-size: 12px;">Discount Applied</td>
                    <td align="right" style="padding: 4px 0; color: #22c55e; font-size: 12px;">-${formatINR(financial.discount)}</td>
                  </tr>
                ` : ''}
                <tr>
                  <td style="padding: 4px 0; color: #a1a1aa; font-size: 12px;">Tax (GST)</td>
                  <td align="right" style="padding: 4px 0; color: #e4e4e7; font-size: 12px;">${formatINR(financial.tax || 0)}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #a1a1aa; font-size: 12px;">Shipping / Delivery</td>
                  <td align="right" style="padding: 4px 0; color: #e4e4e7; font-size: 12px;">${Number(financial.shipping || 0) > 0 ? formatINR(financial.shipping) : 'FREE'}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0 4px 0; color: #ffffff; font-size: 14px; font-weight: 700; border-top: 1px solid #3f3f46;">Total Amount</td>
                  <td align="right" style="padding: 10px 0 4px 0; color: #AE020B; font-size: 16px; font-weight: 800; border-top: 1px solid #3f3f46;">
                    ${formatINR(financial.grandTotal || order.total || 0)}
                  </td>
                </tr>
              </table>

              <!-- Addresses Section -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 20px;">
                <tr>
                  <td style="vertical-align: top; width: 50%; padding-right: 8px;">
                    <div style="padding: 12px; background-color: #1a1a20; border-radius: 8px; border-left: 3px solid #AE020B; min-height: 80px;">
                      <p style="margin: 0 0 4px 0; color: #a1a1aa; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">
                        Shipping Address
                      </p>
                      <p style="margin: 0; color: #f4f4f5; font-size: 11.5px; line-height: 1.4;">
                        ${shipping.name ? `<strong>${shipping.name}</strong><br/>` : ''}
                        ${shipping.address || ''}<br/>
                        ${[shipping.city, shipping.state, shipping.zipCode].filter(Boolean).join(', ')}<br/>
                        ${shipping.phone ? `Phone: ${shipping.phone}` : ''}
                      </p>
                    </div>
                  </td>
                  <td style="vertical-align: top; width: 50%; padding-left: 8px;">
                    <div style="padding: 12px; background-color: #1a1a20; border-radius: 8px; border-left: 3px solid #71717a; min-height: 80px;">
                      <p style="margin: 0 0 4px 0; color: #a1a1aa; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">
                        Billing Address
                      </p>
                      <p style="margin: 0; color: #f4f4f5; font-size: 11.5px; line-height: 1.4;">
                        ${billing.name ? `<strong>${billing.name}</strong><br/>` : ''}
                        ${billing.address || shipping.address || ''}<br/>
                        ${[billing.city || shipping.city, billing.state || shipping.state, billing.zipCode || shipping.zipCode].filter(Boolean).join(', ')}<br/>
                        ${billing.phone ? `Phone: ${billing.phone}` : (shipping.phone ? `Phone: ${shipping.phone}` : '')}
                      </p>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- View Order CTA Button -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 24px 0 12px 0;">
                <tr>
                  <td align="center">
                    <a href="${storeUrl}/orders/${orderId}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #AE020B 0%, #7B0A0A 100%); color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 12px 32px; border-radius: 8px; box-shadow: 0 4px 12px rgba(174, 2, 11, 0.4);">
                      View Order & Bill Online
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 12px 0 0 0; color: #71717a; font-size: 11px; text-align: center;">
                You can always view, print, or download your invoices anytime from your account dashboard.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #111114; padding: 16px 20px; text-align: center; border-top: 1px solid #24242c;">
              <p style="margin: 0 0 4px 0; color: #71717a; font-size: 11px;">
                Questions or issues with your bill? Contact our support team at <a href="mailto:${supportEmail}" style="color: #a1a1aa; text-decoration: underline;">${supportEmail}</a>
              </p>
              <p style="margin: 0; color: #52525b; font-size: 10px;">
                © ${new Date().getFullYear()} ${storeName}. All rights reserved. • This is an electronically generated valid tax invoice.
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
export default getInvoiceEmailTemplate;
