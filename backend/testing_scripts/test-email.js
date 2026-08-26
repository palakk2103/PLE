import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const cleanPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: cleanPass,
    },
    tls: {
        rejectUnauthorized: false
    }
});

async function runTest() {
    try {
        console.log('Sending test email to:', process.env.SMTP_USER);
        const info = await transporter.sendMail({
            from: `"${process.env.FROM_NAME || 'Peoples League of Electronics'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
            to: process.env.SMTP_USER,
            subject: 'PLE Test OTP Code',
            text: 'Your verification OTP is 849201. Valid for 10 minutes.',
            html: '<h3>Your verification OTP is <strong>849201</strong></h3><p>Valid for 10 minutes.</p>'
        });
        console.log('✅ Email sent successfully! MessageId:', info.messageId);
    } catch (err) {
        console.error('❌ Email send error:', err);
    }
}

runTest();
