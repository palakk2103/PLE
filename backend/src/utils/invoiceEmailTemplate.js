/**
 * Generates a responsive, ultra-clean, modern HTML email for customer tax invoice / order bill delivery.
 * Designed with generous whitespace, elegant typography, and a spacious layout
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

    const rawPaymentMethod = String(invoice?.payment?.method || order.paymentMethod || 'cod').toLowerCase();
    const paymentMethodLabel = rawPaymentMethod === 'cod' ? 'Cash on Delivery (COD)' : rawPaymentMethod.toUpperCase();
    const paymentStatus = String(invoice?.payment?.status || order.paymentStatus || 'pending').toUpperCase();
    const transactionId = invoice?.payment?.transactionId || order.paymentDetails?.razorpayPaymentId || '';

    // Currency formatting helper
    const formatINR = (amount) => {
        const val = Number(amount) || 0;
        return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Render line items with generous breathing room
    const renderItemsTable = () => {
        if (!items.length) {
            return `
                <tr>
                    <td colspan="2" style="padding: 24px; color: #64748b; font-size: 14px; text-align: center; background-color: #ffffff;">
                        No item details recorded
                    </td>
                </tr>
            `;
        }

        return items.map((item, idx) => {
            const name = item.name || 'Product Item';
            const qty = item.quantity || 1;
            const price = Number(item.price) || 0;
            const total = item.totalAmount || (price * qty);
            const gstRate = item.gstRate !== undefined ? `${item.gstRate}%` : '18%';
            const isLast = idx === items.length - 1;
            const borderStyle = isLast ? '' : 'border-bottom: 1px solid #e2e8f0;';

            return `
                <tr style="${borderStyle}">
                    <td style="padding: 18px 16px; vertical-align: top;">
                        <p style="margin: 0 0 6px 0; color: #0f172a; font-size: 14px; font-weight: 600; line-height: 1.4;">
                            ${name}
                        </p>
                        <p style="margin: 0; color: #64748b; font-size: 12px; line-height: 1.5;">
                            Quantity: <strong style="color: #1e293b;">${qty}</strong> &nbsp;•&nbsp; Unit Price: <strong style="color: #1e293b;">${formatINR(price)}</strong> &nbsp;•&nbsp; <span style="color: #475569;">GST: ${gstRate}</span>
                        </p>
                    </td>
                    <td align="right" style="padding: 18px 16px; vertical-align: top; white-space: nowrap;">
                        <p style="margin: 0; color: #0f172a; font-size: 15px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                            ${formatINR(total)}
                        </p>
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
      background-color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    @media only screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
        border-radius: 0 !important;
      }
      .responsive-column {
        display: block !important;
        width: 100% !important;
        box-sizing: border-box !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
        margin-bottom: 14px !important;
      }
      .content-padding {
        padding: 24px 18px !important;
      }
      .header-padding {
        padding: 24px 18px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 28px 12px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" class="email-container" width="100%" style="max-width: 620px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.06);" border="0" cellspacing="0" cellpadding="0">
          
          <!-- Top Brand Header Bar -->
          <tr>
            <td class="header-padding" style="background: linear-gradient(135deg, #7B0A0A 0%, #991B1B 50%, #B91C1C 100%); padding: 32px 32px 28px 32px; text-align: left;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align: middle;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: -0.3px; line-height: 1.2;">
                      ${storeName}
                    </h1>
                    <p style="margin: 4px 0 0 0; color: rgba(255, 255, 255, 0.85); font-size: 13px; font-weight: 500;">
                      Commercial Electronics & Wholesale Marketplace
                    </p>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.18); border: 1px solid rgba(255, 255, 255, 0.35); color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 6px 14px; border-radius: 20px;">
                      TAX INVOICE
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td class="content-padding" style="padding: 32px 32px 24px 32px; background-color: #ffffff;">

              <!-- Greeting & Hero Message -->
              <p style="margin: 0 0 6px 0; color: #64748b; font-size: 14px; font-weight: 500;">
                Hello <strong style="color: #0f172a;">${customerName}</strong>,
              </p>
              <h2 style="margin: 0 0 10px 0; color: #0f172a; font-size: 20px; font-weight: 700; letter-spacing: -0.3px; line-height: 1.3;">
                Thank you for your purchase! 🎉
              </h2>
              <p style="margin: 0 0 24px 0; color: #475569; font-size: 14px; line-height: 1.6;">
                Your order has been received and confirmed. Your official GST-compliant tax invoice has been generated and is attached to this email as a PDF document for your records.
              </p>

              <!-- PDF Attachment Highlight Box -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px 20px;">
                <tr>
                  <td style="width: 38px; vertical-align: top; font-size: 24px; line-height: 1;">
                    📄
                  </td>
                  <td style="vertical-align: middle;">
                    <p style="margin: 0 0 3px 0; color: #166534; font-size: 14px; font-weight: 700;">
                      Invoice PDF Attached: <span style="font-family: 'Courier New', Courier, monospace; color: #0f172a; background-color: #dcfce7; padding: 2px 6px; border-radius: 4px;">Invoice-${invoiceNumber}.pdf</span>
                    </p>
                    <p style="margin: 0; color: #15803d; font-size: 12px; line-height: 1.5;">
                      Please find your official tax bill attached at the bottom of this email. You can open, print, or download it anytime.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Invoice & Order Metadata Cards -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 28px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px;">
                <tr>
                  <td style="width: 50%; vertical-align: top; padding-right: 12px;">
                    <p style="margin: 0 0 4px 0; color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                      Invoice Number
                    </p>
                    <p style="margin: 0 0 14px 0; color: #0f172a; font-size: 14px; font-weight: 700; font-family: monospace;">
                      ${invoiceNumber}
                    </p>

                    <p style="margin: 0 0 4px 0; color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                      Order Reference
                    </p>
                    <p style="margin: 0; color: #0f172a; font-size: 14px; font-weight: 700; font-family: monospace;">
                      #${orderId}
                    </p>
                  </td>
                  <td style="width: 50%; vertical-align: top; padding-left: 12px; border-left: 1px solid #e2e8f0;">
                    <p style="margin: 0 0 4px 0; color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                      Invoice Date
                    </p>
                    <p style="margin: 0 0 14px 0; color: #0f172a; font-size: 13px; font-weight: 600;">
                      ${formattedDate}
                    </p>

                    <p style="margin: 0 0 4px 0; color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                      Payment Details
                    </p>
                    <p style="margin: 0; color: #0f172a; font-size: 13px; font-weight: 600;">
                      ${paymentMethodLabel} &nbsp;<span style="display: inline-block; background-color: #dbeafe; color: #1e40af; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 12px; text-transform: uppercase;">${paymentStatus}</span>
                    </p>
                    ${transactionId ? `<p style="margin: 3px 0 0 0; color: #64748b; font-size: 11px; font-family: monospace;">Txn: ${transactionId}</p>` : ''}
                  </td>
                </tr>
              </table>

              <!-- Section: Order Items -->
              <div style="margin-bottom: 28px;">
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 12px;">
                  <tr>
                    <td>
                      <h3 style="margin: 0; color: #0f172a; font-size: 15px; font-weight: 700; letter-spacing: -0.2px;">
                        Purchased Items Summary
                      </h3>
                    </td>
                    <td align="right">
                      <span style="color: #64748b; font-size: 12px; font-weight: 500;">
                        ${items.length} item${items.length !== 1 ? 's' : ''}
                      </span>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
                  <thead style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                    <tr>
                      <th align="left" style="padding: 12px 16px; color: #475569; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                        Item Description
                      </th>
                      <th align="right" style="padding: 12px 16px; color: #475569; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                        Total Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    ${renderItemsTable()}
                  </tbody>
                </table>
              </div>

              <!-- Section: Financial Breakdown Box -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 28px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 24px;">
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Items Subtotal</td>
                  <td align="right" style="padding: 6px 0; color: #1e293b; font-size: 13px; font-weight: 600;">${formatINR(financial.subtotal || 0)}</td>
                </tr>
                ${Number(financial.discount || 0) > 0 ? `
                  <tr>
                    <td style="padding: 6px 0; color: #16a34a; font-size: 13px; font-weight: 600;">Discount / Coupon Savings</td>
                    <td align="right" style="padding: 6px 0; color: #16a34a; font-size: 13px; font-weight: 700;">-${formatINR(financial.discount)}</td>
                  </tr>
                ` : ''}
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Applicable Taxes (GST)</td>
                  <td align="right" style="padding: 6px 0; color: #1e293b; font-size: 13px; font-weight: 600;">${formatINR(financial.tax || 0)}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Shipping & Delivery Charges</td>
                  <td align="right" style="padding: 6px 0; color: #16a34a; font-size: 13px; font-weight: 700;">
                    ${Number(financial.shipping || 0) > 0 ? formatINR(financial.shipping) : 'FREE'}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 0 0 0; color: #0f172a; font-size: 16px; font-weight: 800; border-top: 2px solid #cbd5e1;">
                    Total Payable Amount
                  </td>
                  <td align="right" style="padding: 16px 0 0 0; color: #7B0A0A; font-size: 20px; font-weight: 800; border-top: 2px solid #cbd5e1; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    ${formatINR(financial.grandTotal || order.total || 0)}
                  </td>
                </tr>
              </table>

              <!-- Section: Addresses (Side-by-Side with ample breathing room) -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 32px;">
                <tr>
                  <td class="responsive-column" style="width: 50%; vertical-align: top; padding-right: 10px;">
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 3px solid #7B0A0A; border-radius: 12px; padding: 18px 20px; min-height: 110px;">
                      <p style="margin: 0 0 8px 0; color: #7B0A0A; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.6px;">
                        📍 Shipping Address
                      </p>
                      <p style="margin: 0; color: #1e293b; font-size: 13px; line-height: 1.6;">
                        ${shipping.name ? `<strong>${shipping.name}</strong><br/>` : ''}
                        ${shipping.address ? `${shipping.address}<br/>` : ''}
                        ${[shipping.city, shipping.state, shipping.zipCode].filter(Boolean).join(', ')}<br/>
                        ${shipping.phone ? `<span style="color: #64748b;">Phone:</span> ${shipping.phone}` : ''}
                      </p>
                    </div>
                  </td>
                  <td class="responsive-column" style="width: 50%; vertical-align: top; padding-left: 10px;">
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 3px solid #64748b; border-radius: 12px; padding: 18px 20px; min-height: 110px;">
                      <p style="margin: 0 0 8px 0; color: #475569; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.6px;">
                        📋 Billing Address
                      </p>
                      <p style="margin: 0; color: #1e293b; font-size: 13px; line-height: 1.6;">
                        ${billing.name ? `<strong>${billing.name}</strong><br/>` : ''}
                        ${(billing.address || shipping.address) ? `${billing.address || shipping.address}<br/>` : ''}
                        ${[billing.city || shipping.city, billing.state || shipping.state, billing.zipCode || shipping.zipCode].filter(Boolean).join(', ')}<br/>
                        ${(billing.phone || shipping.phone) ? `<span style="color: #64748b;">Phone:</span> ${billing.phone || shipping.phone}` : ''}
                      </p>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Call to Action Button -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
                <tr>
                  <td align="center">
                    <a href="${storeUrl}/orders/${orderId}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #7B0A0A 0%, #991B1B 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 38px; border-radius: 10px; box-shadow: 0 4px 14px rgba(123, 10, 10, 0.28); letter-spacing: 0.2px;">
                      View Order & Bill Online
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center; line-height: 1.5;">
                Need help or have questions regarding this invoice? We're here for you at <a href="mailto:${supportEmail}" style="color: #7B0A0A; font-weight: 600; text-decoration: none;">${supportEmail}</a>
              </p>

            </td>
          </tr>

          <!-- Clean Modern Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 6px 0; color: #64748b; font-size: 12px; line-height: 1.5;">
                © ${new Date().getFullYear()} ${storeName}. All rights reserved.
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 11px; line-height: 1.5;">
                This is a system-generated electronic tax invoice compliant with Indian GST norms • No physical signature required.
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
