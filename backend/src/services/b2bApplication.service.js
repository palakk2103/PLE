import jwt from 'jsonwebtoken';
import ApiError from '../utils/ApiError.js';

// A company that is pending, rejected or deactivated cannot sign in, but its admin still needs to see
// the application. This token proves the password was checked and opens only the application page.
// It uses its own signing key, so it can never be accepted as a normal login token.
const applicationSecret = () => `${process.env.JWT_SECRET}.b2b-application`;

export const signApplicationToken = ({ userId, companyId }) =>
    jwt.sign({ userId: String(userId), companyId: String(companyId) }, applicationSecret(), { expiresIn: '2h' });

export const verifyApplicationToken = (token) => {
    try {
        return jwt.verify(token, applicationSecret());
    } catch {
        throw new ApiError(401, 'This application link has expired. Please sign in again.');
    }
};

export const cleanApplicationMessage = (value) => {
    const message = String(value || '').trim();
    if (!message) throw new ApiError(400, 'Please write a message.');
    if (message.length > 2000) throw new ApiError(400, 'Messages can be up to 2000 characters.');
    return message;
};

export const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
