// Maps the reason codes sent by the chat UIs to the ChatReport schema enum.
const REASON_MAP = {
    OFF_PLATFORM_SOLICITATION: 'CONTACT_SHARING',
    FRAUD: 'SCAM_FRAUD',
};

const VALID_REASONS = [
    'CONTACT_SHARING', 'PAYMENT_DIVERSION', 'SCAM_FRAUD', 'HARASSMENT',
    'ABUSE', 'SPAM', 'PHISHING', 'PROHIBITED_CONTENT', 'OTHER',
];

export const normalizeReportReason = (reason) => {
    const key = String(reason || '').trim().toUpperCase();
    const mapped = REASON_MAP[key] || key;
    return VALID_REASONS.includes(mapped) ? mapped : 'OTHER';
};
