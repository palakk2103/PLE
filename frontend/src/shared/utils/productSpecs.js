// Shared helpers for the dynamic product specification system.
// Shape (matches backend Product.specifications):
//   { features: [entry], additional: [entry], itemDetails: [entry], whatsInBox: [string] }
//   entry = { key, label, type?, value, unit? }

export const SPEC_GROUP_META = [
  { id: 'features', title: 'Features & Specs', hint: 'Key technical and product-specific attributes.' },
  { id: 'additional', title: 'Additional Details', hint: 'Dimensions, weight, origin and packaging.' },
  { id: 'itemDetails', title: 'Item Details', hint: 'Model, manufacturer, identifiers and warranty.' },
];

export const emptySpecifications = () => ({ features: [], additional: [], itemDetails: [], whatsInBox: [] });

/** Normalises whatever the API returned (including legacy products with no specs). */
export const normalizeSpecifications = (raw) => {
  const base = emptySpecifications();
  if (!raw || typeof raw !== 'object') return base;
  for (const g of ['features', 'additional', 'itemDetails']) {
    base[g] = Array.isArray(raw[g]) ? raw[g].filter((e) => e && typeof e === 'object').map((e) => ({ ...e })) : [];
  }
  base.whatsInBox = Array.isArray(raw.whatsInBox) ? raw.whatsInBox.map(String) : [];
  return base;
};

export const isEmptySpecValue = (v) =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);

/** Formats an entry value + unit for display. Returns '' when there is nothing meaningful to show. */
export const formatSpecValue = (entry) => {
  if (!entry || isEmptySpecValue(entry.value)) return '';
  let v = entry.value;
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) v = v.filter((x) => !isEmptySpecValue(x)).join(', ');
  v = String(v).trim();
  if (!v || ['undefined', 'null', 'n/a', 'na', '-'].includes(v.toLowerCase())) return '';
  return entry.unit ? `${v} ${entry.unit}` : v;
};

/** True when a specifications object has at least one displayable row. */
export const hasSpecContent = (specs) => {
  const s = normalizeSpecifications(specs);
  return (
    ['features', 'additional', 'itemDetails'].some((g) => s[g].some((e) => formatSpecValue(e))) ||
    s.whatsInBox.some((x) => x.trim())
  );
};

/** Removes empty rows before sending to the backend (backend also validates). */
export const cleanSpecificationsForSubmit = (specs) => {
  const s = normalizeSpecifications(specs);
  const out = emptySpecifications();
  for (const g of ['features', 'additional', 'itemDetails']) {
    out[g] = s[g]
      .filter((e) => !isEmptySpecValue(e.value) && String(e.label || '').trim())
      .map((e) => ({
        key: e.key,
        label: String(e.label).trim(),
        value: typeof e.value === 'string' ? e.value.trim() : e.value,
        ...(e.unit ? { unit: e.unit } : {}),
      }));
  }
  out.whatsInBox = s.whatsInBox.map((x) => x.trim()).filter(Boolean);
  return out;
};

/** Client-side validation against the template. Returns an object { [key]: message }. */
export const validateSpecifications = (specs, templateFields = []) => {
  const s = normalizeSpecifications(specs);
  const errors = {};
  const byKey = new Map();
  for (const g of ['features', 'additional', 'itemDetails']) s[g].forEach((e) => byKey.set(e.key, e));

  for (const field of templateFields) {
    const entry = byKey.get(field.key);
    const empty = !entry || isEmptySpecValue(entry.value);
    if (field.required && empty) {
      errors[field.key] = `${field.label} is required`;
      continue;
    }
    if (!empty && field.type === 'number') {
      const n = Number(String(entry.value).replace(/,/g, ''));
      if (!Number.isFinite(n) || n < 0) errors[field.key] = `${field.label} must be a valid positive number`;
    }
  }
  return errors;
};
