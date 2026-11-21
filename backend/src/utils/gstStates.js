/**
 * Indian GST state codes (first two digits of a GSTIN) and helpers to turn free-form
 * state names / GSTINs into a canonical { code, name } pair.
 *
 * Used to decide the "place of supply" rule:
 *   seller state === buyer state  -> intra-state supply -> CGST + SGST (rate split 50/50)
 *   seller state !== buyer state  -> inter-state supply -> IGST (full rate)
 */

export const GST_STATES = [
    { code: '01', name: 'Jammu and Kashmir', aliases: ['jammu & kashmir', 'j&k', 'jk'] },
    { code: '02', name: 'Himachal Pradesh', aliases: ['hp'] },
    { code: '03', name: 'Punjab', aliases: ['pb'] },
    { code: '04', name: 'Chandigarh', aliases: ['ch'] },
    { code: '05', name: 'Uttarakhand', aliases: ['uttaranchal', 'uk'] },
    { code: '06', name: 'Haryana', aliases: ['hr'] },
    { code: '07', name: 'Delhi', aliases: ['new delhi', 'nct of delhi', 'nct delhi', 'dl'] },
    { code: '08', name: 'Rajasthan', aliases: ['rj'] },
    { code: '09', name: 'Uttar Pradesh', aliases: ['up'] },
    { code: '10', name: 'Bihar', aliases: ['br'] },
    { code: '11', name: 'Sikkim', aliases: ['sk'] },
    { code: '12', name: 'Arunachal Pradesh', aliases: ['ar'] },
    { code: '13', name: 'Nagaland', aliases: ['nl'] },
    { code: '14', name: 'Manipur', aliases: ['mn'] },
    { code: '15', name: 'Mizoram', aliases: ['mz'] },
    { code: '16', name: 'Tripura', aliases: ['tr'] },
    { code: '17', name: 'Meghalaya', aliases: ['ml'] },
    { code: '18', name: 'Assam', aliases: ['as'] },
    { code: '19', name: 'West Bengal', aliases: ['wb'] },
    { code: '20', name: 'Jharkhand', aliases: ['jh'] },
    { code: '21', name: 'Odisha', aliases: ['orissa', 'od', 'or'] },
    { code: '22', name: 'Chhattisgarh', aliases: ['chattisgarh', 'cg'] },
    { code: '23', name: 'Madhya Pradesh', aliases: ['mp'] },
    { code: '24', name: 'Gujarat', aliases: ['gj'] },
    { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu', aliases: ['dadra and nagar haveli', 'daman and diu', 'daman & diu', 'dnh', 'dd'] },
    { code: '27', name: 'Maharashtra', aliases: ['mh'] },
    { code: '29', name: 'Karnataka', aliases: ['ka'] },
    { code: '30', name: 'Goa', aliases: ['ga'] },
    { code: '31', name: 'Lakshadweep', aliases: ['ld'] },
    { code: '32', name: 'Kerala', aliases: ['kl'] },
    { code: '33', name: 'Tamil Nadu', aliases: ['tamilnadu', 'tn'] },
    { code: '34', name: 'Puducherry', aliases: ['pondicherry', 'py'] },
    { code: '35', name: 'Andaman and Nicobar Islands', aliases: ['andaman & nicobar', 'andaman and nicobar', 'an'] },
    { code: '36', name: 'Telangana', aliases: ['ts', 'tg'] },
    { code: '37', name: 'Andhra Pradesh', aliases: ['ap'] },
    { code: '38', name: 'Ladakh', aliases: ['la'] },
];

const clean = (s) => String(s || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const BY_CODE = new Map(GST_STATES.map((s) => [s.code, s]));
const BY_NAME = new Map();
for (const s of GST_STATES) {
    BY_NAME.set(clean(s.name), s);
    for (const a of s.aliases) BY_NAME.set(clean(a), s);
}
// Legacy code 25 (Daman & Diu) merged into 26 in 2020; keep old GSTINs resolving.
BY_CODE.set('25', BY_CODE.get('26'));
// Legacy code 28 (undivided Andhra Pradesh) -> treat as Andhra Pradesh.
BY_CODE.set('28', BY_CODE.get('37'));

const toResult = (s) => (s ? { code: s.code, name: s.name } : null);

/** GSTIN -> { code, name } using its first two digits, or null if not a GSTIN. */
export const stateFromGstin = (gstin) => {
    const g = String(gstin || '').trim().toUpperCase();
    if (!/^\d{2}[A-Z0-9]{13}$/.test(g)) return null;
    return toResult(BY_CODE.get(g.slice(0, 2)));
};

/** Free-form state name / abbreviation / 2-digit code -> { code, name }, or null. */
export const normalizeState = (input) => {
    if (!input) return null;
    const raw = String(input).trim();
    if (/^\d{1,2}$/.test(raw)) return toResult(BY_CODE.get(raw.padStart(2, '0')));
    return toResult(BY_NAME.get(clean(raw)));
};

/**
 * Finds a state name inside a free-text address ("12 MG Road, Pune, Maharashtra 411001").
 * Only full state names are matched (not 2-letter abbreviations) to avoid false hits.
 */
export const stateFromAddressText = (text) => {
    const t = ` ${clean(text)} `;
    if (t.trim() === '') return null;
    let best = null;
    for (const s of GST_STATES) {
        for (const candidate of [s.name, ...s.aliases.filter((a) => a.length > 3)]) {
            const c = clean(candidate);
            if (t.includes(` ${c} `) && (!best || c.length > best.len)) best = { s, len: c.length };
        }
    }
    return best ? toResult(best.s) : null;
};
