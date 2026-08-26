import crypto from 'crypto';
import { sendEmail } from './email.service.js';
import { getOtpEmailTemplate } from '../utils/emailTemplates.js';

/**
 * Generates a 6-digit OTP and sets expiry (10 minutes)
 * @param {Object} user - Mongoose user/vendor document
 * @param {string} type - Purpose label (for logging)
 */
export const sendOTP = async (user, type = 'verification') => {
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save({ validateBeforeSave: false });

    const roleLabel = user.role === 'vendor' ? 'Vendor' : (user.role === 'b2bAdmin' || user.role === 'b2bEmployee' ? 'Business Partner' : 'Customer');

    try {
        const html = getOtpEmailTemplate({
            otp,
            title: 'Peoples League of Electronics',
            subtitle: 'Email Verification',
            purpose: `${roleLabel} verification`,
            recipientName: user.name || '',
            expiryMinutes: 10
        });

        await sendEmail({
            to: user.email,
            subject: `Email Verification Code - ${otp}`,
            text: `Your verification code is ${otp}. It expires in 10 minutes.`,
            html,
        });
    } catch (err) {
        // Keep auth flow working in environments where SMTP is not configured.
        console.warn(`[OTP] Email send failed for ${user.email}: ${err.message}`);
    }

    // Always log generated OTPs in non-production environments for verification fallback
    if (process.env.NODE_ENV !== 'production') {
        console.log(`\n==========================================`);
        console.log(`[OTP] ${type} for ${user.email}: ${otp}`);
        console.log(`==========================================\n`);
    }

    return otp;
};
