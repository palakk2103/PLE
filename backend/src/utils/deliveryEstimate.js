// Vendors type delivery estimates as free text ("3-5 business days"). Only a real ISO date can be
// stored as a date; anything else must not turn into "Invalid Date" and block the approval.
export const toDeliveryDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}/.test(String(value || '').trim())) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
};
