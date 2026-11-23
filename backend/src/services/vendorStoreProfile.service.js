import ApiError from '../utils/ApiError.js';
import { moderateMessage, MODERATION_ACTION } from './chatModeration.service.js';

export const DEFAULT_THEME = { primaryColor: '#7B0A0A', accentColor: '#F59E0B' };
const HEX = /^#[0-9a-fA-F]{6}$/;
const LIMITS = { tagline: 100, about: 1500, businessHours: 100 };

const isSafeText = (text) => moderateMessage(String(text)).action === MODERATION_ACTION.ALLOW;

const cleanImageUrl = (value, label) => {
    const v = String(value ?? '').trim();
    if (!v) return '';
    if (v.length > 500 || !/^https:\/\/\S+$/i.test(v)) {
        throw new ApiError(400, `${label} must be an https image link (upload an image instead).`);
    }
    return v;
};

const cleanText = (value, label, max) => {
    const v = String(value ?? '').trim();
    if (v.length > max) throw new ApiError(400, `${label} can be at most ${max} characters.`);
    // These are shown to every customer: no phone numbers, emails, links or other contact details.
    if (v && !isSafeText(v)) {
        throw new ApiError(400, `${label} cannot contain contact details (phone, email, links). Customers reach you through chat.`);
    }
    return v;
};

const cleanColor = (value, label) => {
    const v = String(value ?? '').trim();
    if (!HEX.test(v)) throw new ApiError(400, `${label} must be a colour like #7B0A0A.`);
    return v.toUpperCase();
};

/**
 * Validates only the fields that were sent and returns a Mongo $set object.
 * Logo is kept on the top-level `storeLogo` (the storefront already reads it from there).
 */
export const buildStoreProfileUpdates = (body = {}) => {
    const set = {};
    if (body.storeLogo !== undefined) set.storeLogo = cleanImageUrl(body.storeLogo, 'Store logo');
    if (body.bannerUrl !== undefined) set['storeProfile.bannerUrl'] = cleanImageUrl(body.bannerUrl, 'Store banner');
    if (body.tagline !== undefined) set['storeProfile.tagline'] = cleanText(body.tagline, 'Tagline', LIMITS.tagline);
    if (body.about !== undefined) set['storeProfile.about'] = cleanText(body.about, 'About your business', LIMITS.about);
    if (body.businessHours !== undefined) set['storeProfile.businessHours'] = cleanText(body.businessHours, 'Business hours', LIMITS.businessHours);
    if (body.storeDescription !== undefined) set.storeDescription = cleanText(body.storeDescription, 'Store description', 500);
    const theme = body.theme;
    if (theme && typeof theme === 'object') {
        if (theme.primaryColor !== undefined) set['storeProfile.theme.primaryColor'] = cleanColor(theme.primaryColor, 'Primary colour');
        if (theme.accentColor !== undefined) set['storeProfile.theme.accentColor'] = cleanColor(theme.accentColor, 'Accent colour');
    }
    if (Object.keys(set).length === 0) throw new ApiError(400, 'Nothing to update.');
    return set;
};

/** The address a customer sees: the verified business address, else the registered store address. */
export const publicAddress = (vendor) => {
    const a = vendor.address || {};
    const line = String(vendor.businessAddress || a.street || '').trim();
    const city = String(vendor.city || a.city || '').trim();
    const state = String(vendor.state || a.state || '').trim();
    const pincode = String(vendor.pincode || a.zipCode || '').trim();
    const text = [line, city, [state, pincode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    return { line, city, state, pincode, text };
};

/**
 * Everything a customer may see on the seller page beyond the basics.
 * Deliberately NOT included: phone, email, PAN, bank, documents. Free text is re-checked
 * for contact details on the way out, in case it was saved before the rule existed.
 */
export const buildPublicStoreProfile = (vendor) => {
    const sp = vendor.storeProfile || {};
    const safe = (v) => (v && isSafeText(v) ? String(v) : '');
    const address = publicAddress(vendor);
    const gst = String(vendor.gstNumber || '').trim().toUpperCase();
    return {
        theme: {
            primaryColor: HEX.test(sp.theme?.primaryColor || '') ? sp.theme.primaryColor : DEFAULT_THEME.primaryColor,
            accentColor: HEX.test(sp.theme?.accentColor || '') ? sp.theme.accentColor : DEFAULT_THEME.accentColor,
        },
        bannerUrl: sp.bannerUrl || '',
        tagline: safe(sp.tagline),
        about: safe(sp.about),
        businessHours: safe(sp.businessHours),
        business: {
            ownerName: String(vendor.ownerName || vendor.name || '').trim(),
            businessName: String(vendor.businessName || '').trim(),
            tradeName: String(vendor.tradeName || '').trim(),
            businessType: vendor.businessType && vendor.businessType !== 'Other' ? vendor.businessType : '',
            gstNumber: gst,
            gstVerified: !!gst && vendor.verificationStatus === 'Approved',
            address: address.text ? { ...address, text: safe(address.text) } : null,
        },
    };
};
