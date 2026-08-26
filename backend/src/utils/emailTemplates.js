/**
 * Generates a sleek, compact HTML email template for OTP & Verifications
 * Styled in dark mode matching exact compact dimensions from mobile preview
 */
export const getOtpEmailTemplate = ({
    otp,
    title = 'Peoples League of Electronics',
    subtitle = 'Email Verification',
    purpose = 'Customer verification',
    recipientName = '',
    expiryMinutes = 10
}) => {
    // Keep clean numeric string without spaces so HTML never breaks line
    const cleanOtp = String(otp).replace(/\s+/g, '');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subtitle}</title>
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
<body style="margin: 0; padding: 12px 8px; background-color: #0d0d10;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <!-- Compact Card Container -->
        <table role="presentation" width="100%" style="max-width: 380px; background-color: #16161a; border: 1px solid #28282e; border-radius: 14px; overflow: hidden; box-shadow: 0 8px 20px rgba(0,0,0,0.4);" border="0" cellspacing="0" cellpadding="0">
          
          <!-- Compact Gradient Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #AE020B 0%, #C7141B 50%, #7B0A0A 100%); padding: 18px 16px; text-align: center;">
              <h1 style="margin: 0 0 2px 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: 0.3px;">
                ${title}
              </h1>
              <p style="margin: 0; color: rgba(255, 255, 255, 0.88); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.2px;">
                ${subtitle}
              </p>
            </td>
          </tr>

          <!-- Compact Content Body -->
          <tr>
            <td style="padding: 18px 20px;">
              <p style="margin: 0 0 8px 0; color: #f4f4f5; font-size: 14px; font-weight: 500;">
                Hello${recipientName ? ' ' + recipientName : ''},
              </p>
              
              <p style="margin: 0 0 18px 0; color: #a1a1aa; font-size: 13px; line-height: 1.5;">
                Use the following One-Time Password (OTP) to complete your <strong>${purpose}</strong>:
              </p>

              <!-- Single-Row Stylized OTP Box (Fixed width & nowrap) -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 16px 0;">
                <tr>
                  <td align="center">
                    <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="background-color: #1a1e2b; border: 1px dashed #596a94; border-radius: 10px; padding: 12px 18px; width: auto; margin: 0 auto;">
                      <tr>
                        <td align="center" style="white-space: nowrap; word-break: keep-all; font-family: 'Courier New', Courier, monospace; font-size: 30px; font-weight: 700; letter-spacing: 10px; color: #b8c8fd; padding-left: 10px;">
                          ${cleanOtp}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Single-line Validity Info -->
              <p style="margin: 0 0 12px 0; color: #d4d4d8; font-size: 12px; line-height: 1.4; text-align: center;">
                ⏰ This code is valid for <strong>${expiryMinutes} minutes</strong>. Do not share it with anyone.
              </p>

              <!-- Subtle Divider -->
              <div style="border-top: 1px solid #26262c; margin: 12px 0;"></div>

              <!-- Compact Disclaimer -->
              <p style="margin: 0; color: #71717a; font-size: 11px; line-height: 1.4; text-align: center;">
                If you did not request this verification code, please ignore this email or contact support.
              </p>
            </td>
          </tr>

          <!-- Compact Footer -->
          <tr>
            <td style="background-color: #111114; padding: 10px 16px; text-align: center; border-top: 1px solid #1f1f24;">
              <p style="margin: 0; color: #52525b; font-size: 10px;">
                © ${new Date().getFullYear()} Peoples League of Electronics
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
