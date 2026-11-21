import ApiError from './ApiError.js';

// A plain date (YYYY-MM-DD) means that whole calendar day in India time (IST), so results never
// depend on the server's timezone. A full timestamp is used exactly as given.
const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const parseFilterDate = (value, { endOfDay }, label) => {
    const raw = String(value).trim();
    const d = PLAIN_DATE.test(raw)
        ? new Date(`${raw}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+05:30`)
        : new Date(raw);
    if (isNaN(d)) throw new ApiError(400, `Invalid "${label}" date.`);
    return d;
};

/** { [field]: { $gte, $lte } } for ?from=&to= query params, or {} when neither is given. */
export const istDateRangeFilter = ({ from, to } = {}, field = 'createdAt') => {
    const range = {};
    if (from) range.$gte = parseFilterDate(from, { endOfDay: false }, 'from');
    if (to) range.$lte = parseFilterDate(to, { endOfDay: true }, 'to');
    return Object.keys(range).length ? { [field]: range } : {};
};
