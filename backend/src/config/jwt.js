import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export const signAccessToken = (payload) =>
    jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '30d',
    });

// A unique id per refresh token: two tokens issued in the same second for the same user were
// byte-identical, so a "rotated" token was the old one and the old one could be reused.
export const signRefreshToken = (payload) =>
    jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '365d',
        jwtid: crypto.randomUUID(),
    });

export const verifyAccessToken = (token) =>
    jwt.verify(token, process.env.JWT_SECRET);

export const verifyRefreshToken = (token) =>
    jwt.verify(token, process.env.JWT_REFRESH_SECRET);
