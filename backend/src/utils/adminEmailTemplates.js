/**
 * PLE Store Admin, Operational & Security Email Template Generators
 * Peoples League of Electronics (PLE)
 * 
 * Supports Master Checklist Categories C & D (Items 130–195):
 * - Order & Fulfillment alerts (high value, suspicious, stuck, SLA breaches, RTO)
 * - Vendor compliance & lifecycle alerts (KYC, suspension, disputes, expiry)
 * - Finance, payouts, and gateway escalations
 * - Speedzeel Logistics milestones & exceptions
 * - User/Vendor authentication, security lockouts, 2FA, staff RBAC
 */

const BADGE_COLORS = {
    red: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: '#ef4444' },
    amber: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: '#f59e0b' },
    green: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', border: '#10b981' },
    blue: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', border: '#3b82f6' },
    purple: { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', border: '#a855f7' }
};

/**
 * Base Admin & Security Wrapper
 */
const baseAdminWrapper = ({ title, subtitle = 'PLE Internal Alert System', severity = 'info', content, footerNote = '' }) => {
    const headerGradients = {
        critical: 'linear-gradient(135deg, #450a0a 0%, #7f1d1d 50%, #991b1b 100%)',
        warning: 'linear-gradient(135deg, #451a03 0%, #78350f 50%, #92400e 100%)',
        success: 'linear-gradient(135deg, #022c22 0%, #064e3b 50%, #065f46 100%)',
        info: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
        security: 'linear-gradient(135deg, #18181b 0%, #27272a 50%, #3f3f46 100%)',
    };

    const gradient = headerGradients[severity] || headerGradients.info;
    const accentBorder = severity === 'critical' ? '#ef4444' : (severity === 'warning' ? '#f59e0b' : '#3b82f6');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || 'PLE Admin Alert'}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #090a0f;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
  </style>
</head>
<body style="margin: 0; padding: 20px 10px; background-color: #090a0f;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #12141a; border: 1px solid #1f232e; border-radius: 12px; overflow: hidden; box-shadow: 0 16px 36px rgba(0,0,0,0.7);" border="0" cellspacing="0" cellpadding="0">
          
          <!-- Admin Terminal Header -->
          <tr>
            <td style="background: ${gradient}; padding: 20px 24px; border-bottom: 2px solid ${accentBorder}; text-align: left;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <h1 style="margin: 0 0 4px 0; color: #ffffff; font-size: 18px; font-weight: 800; letter-spacing: 0.5px;">
                      ⚡ Peoples League of Electronics
                    </h1>
                    <p style="margin: 0; color: rgba(255, 255, 255, 0.8); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.2px;">
                      ${subtitle}
                    </p>
                  </td>
                  <td align="right" valign="middle">
                    <span style="display: inline-block; padding: 4px 10px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #ffffff; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px;">
                      ${severity.toUpperCase()}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Alert Body -->
          <tr>
            <td style="padding: 24px 24px; color: #e2e8f0;">
              ${content}
            </td>
          </tr>

          <!-- Admin Footer -->
          <tr>
            <td style="background-color: #0b0d13; padding: 16px 24px; text-align: center; border-top: 1px solid #1a1e29;">
              <p style="margin: 0 0 6px 0; color: #94a3b8; font-size: 11px; line-height: 1.4;">
                ${footerNote || 'Confidential internal system notification. Intended solely for authorized PLE administrative and operations personnel.'}
              </p>
              <p style="margin: 0; color: #64748b; font-size: 10px;">
                © ${new Date().getFullYear()} Peoples League of Electronics Pvt Ltd. Security & Infrastructure Operations.
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

/**
 * 1. Admin Operational Alert Template (Orders, Logistics, Vendors, Finance)
 * Master Checklist Items 130–165
 */
export const getAdminAlertTemplate = ({
    title,
    badgeText = 'OPERATIONAL ALERT',
    badgeColor = 'amber',
    severity = 'warning',
    message,
    details = [],
    actionUrl,
    actionText = 'Open Admin Console',
    footerNote,
}) => {
    const badgeStyle = BADGE_COLORS[badgeColor] || BADGE_COLORS.amber;

    const detailsRows = (details || []).map(d => `
      <tr>
        <td style="padding: 9px 12px; color: #94a3b8; font-size: 12px; border-bottom: 1px solid #1e222e; width: 38%; font-weight: 600;">
          ${d.label}
        </td>
        <td style="padding: 9px 12px; color: #ffffff; font-size: 12px; border-bottom: 1px solid #1e222e; width: 62%; font-weight: 600; word-break: break-all;">
          ${d.value}
        </td>
      </tr>
    `).join('');

    const content = `
      <div style="margin-bottom: 18px;">
        <span style="display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: ${badgeStyle.text}; background-color: ${badgeStyle.bg}; border: 1px solid ${badgeStyle.border}; border-radius: 4px; margin-bottom: 12px;">
          ${badgeText}
        </span>
        <h2 style="margin: 0 0 10px 0; color: #ffffff; font-size: 18px; font-weight: 700; line-height: 1.3;">
          ${title}
        </h2>
        <p style="margin: 0 0 18px 0; color: #cbd5e1; font-size: 13px; line-height: 1.55;">
          ${message}
        </p>
      </div>

      ${details.length > 0 ? `
        <table role="presentation" width="100%" style="background-color: #171a23; border: 1px solid #232736; border-radius: 8px; margin-bottom: 22px; border-collapse: collapse;">
          ${detailsRows}
        </table>
      ` : ''}

      ${actionUrl ? `
        <div style="text-align: center; margin: 26px 0 10px 0;">
          <a href="${actionUrl}" style="display: inline-block; background: #3b82f6; color: #ffffff; font-size: 13px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 6px; letter-spacing: 0.4px;">
            ${actionText} &rarr;
          </a>
        </div>
      ` : ''}
    `;

    return baseAdminWrapper({
        title,
        subtitle: 'PLE Operational Control',
        severity,
        content,
        footerNote
    });
};

/**
 * 2. Security Incident, Login & Authentication Alert Template
 * Master Checklist Items 166–195
 */
export const getSecurityAlertTemplate = ({
    recipientName = 'User',
    title,
    badgeText = 'SECURITY NOTICE',
    badgeColor = 'red',
    severity = 'security',
    message,
    ipAddress = 'N/A',
    userAgent = 'N/A',
    timestamp = new Date().toLocaleString('en-IN'),
    details = [],
    actionUrl,
    actionText = 'Review Account Security',
    footerNote,
}) => {
    const badgeStyle = BADGE_COLORS[badgeColor] || BADGE_COLORS.red;

    const securityDetails = [
        { label: 'Recipient / Account', value: recipientName },
        { label: 'Event Timestamp', value: timestamp },
        { label: 'Source IP Address', value: ipAddress },
        { label: 'Client / User Agent', value: userAgent },
        ...details
    ];

    const detailsRows = securityDetails.map(d => `
      <tr>
        <td style="padding: 9px 12px; color: #94a3b8; font-size: 12px; border-bottom: 1px solid #1e222e; width: 38%; font-weight: 600;">
          ${d.label}
        </td>
        <td style="padding: 9px 12px; color: #ffffff; font-size: 12px; border-bottom: 1px solid #1e222e; width: 62%; font-weight: 600; word-break: break-all;">
          ${d.value}
        </td>
      </tr>
    `).join('');

    const content = `
      <div style="margin-bottom: 18px;">
        <span style="display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: ${badgeStyle.text}; background-color: ${badgeStyle.bg}; border: 1px solid ${badgeStyle.border}; border-radius: 4px; margin-bottom: 12px;">
          ${badgeText}
        </span>
        <h2 style="margin: 0 0 10px 0; color: #ffffff; font-size: 18px; font-weight: 700; line-height: 1.3;">
          ${title}
        </h2>
        <p style="margin: 0 0 18px 0; color: #cbd5e1; font-size: 13px; line-height: 1.55;">
          ${message}
        </p>
      </div>

      <table role="presentation" width="100%" style="background-color: #171a23; border: 1px solid #232736; border-radius: 8px; margin-bottom: 22px; border-collapse: collapse;">
        ${detailsRows}
      </table>

      <div style="background-color: rgba(239, 68, 68, 0.08); border-left: 3px solid #ef4444; padding: 12px 14px; border-radius: 4px; margin-bottom: 22px;">
        <p style="margin: 0; color: #fca5a5; font-size: 12px; line-height: 1.45;">
          <strong>Security Advisory:</strong> If you did not initiate this action or suspect unauthorized access to your account, please immediately rotate your password and contact platform security at security@peoplesleague.com.
        </p>
      </div>

      ${actionUrl ? `
        <div style="text-align: center; margin: 26px 0 10px 0;">
          <a href="${actionUrl}" style="display: inline-block; background: #ef4444; color: #ffffff; font-size: 13px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 6px; letter-spacing: 0.4px;">
            ${actionText} &rarr;
          </a>
        </div>
      ` : ''}
    `;

    return baseAdminWrapper({
        title,
        subtitle: 'PLE Security Operations Center',
        severity,
        content,
        footerNote
    });
};
