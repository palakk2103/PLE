import mongoose from 'mongoose';
import Category from '../models/Category.model.js';
import ApiError from '../utils/ApiError.js';

/**
 * Dynamic, category-aware product specification system.
 *
 * Storage shape (Product.specifications):
 *   { features: [entry], additional: [entry], itemDetails: [entry], whatsInBox: [string] }
 *   entry = { key, label, type, value, unit? }
 *
 * Field definitions ("template") are resolved per category:
 *   1. Common fields (additional + item details) apply to every product.
 *   2. A built-in preset (electronics, clothing, grocery, furniture, ...) adds "Features & Specs" fields
 *      based on the category / ancestor names.
 *   3. Admin-configured Category.specFields (own or inherited from the nearest ancestor that has any)
 *      override / extend the above by key. Adding a new field never needs a form change.
 */

export const SPEC_GROUPS = ['features', 'additional', 'itemDetails'];
const FIELD_TYPES = ['text', 'textarea', 'number', 'select', 'multiselect', 'boolean', 'date'];
const MAX_ENTRIES_PER_GROUP = 100;
const MAX_BOX_ITEMS = 50;
const MAX_LABEL = 100;
const MAX_VALUE = 2000;

const f = (key, label, group, extra = {}) => ({ key, label, group, type: 'text', required: false, ...extra });

const LENGTH_UNITS = ['cm', 'mm', 'm', 'inches'];
const WEIGHT_UNITS = ['kg', 'g', 'lb', 'oz'];

const COMMON_FIELDS = [
    // Additional Details
    f('item_dimensions', 'Item Dimensions (L x W x H)', 'additional', { placeholder: 'e.g. 30 x 20 x 10', unit: 'cm', units: LENGTH_UNITS }),
    f('item_weight', 'Item Weight', 'additional', { type: 'number', unit: 'kg', units: WEIGHT_UNITS }),
    f('package_dimensions', 'Package Dimensions (L x W x H)', 'additional', { placeholder: 'e.g. 35 x 25 x 15', unit: 'cm', units: LENGTH_UNITS }),
    f('package_weight', 'Package Weight', 'additional', { type: 'number', unit: 'kg', units: WEIGHT_UNITS }),
    f('country_of_origin', 'Country of Origin', 'additional'),
    f('unit_count', 'Unit Count', 'additional', { type: 'number' }),
    f('number_of_items', 'Number of Items', 'additional', { type: 'number' }),
    f('item_type_name', 'Item Type Name', 'additional'),
    // Item Details
    f('brand_name', 'Brand Name', 'itemDetails'),
    f('model_name', 'Model Name', 'itemDetails'),
    f('model_number', 'Model Number', 'itemDetails'),
    f('manufacturer', 'Manufacturer', 'itemDetails'),
    f('manufacturer_part_number', 'Manufacturer Part Number', 'itemDetails'),
    f('gtin', 'GTIN / UPC / EAN', 'itemDetails'),
    f('warranty_description', 'Warranty Description', 'itemDetails', { type: 'textarea' }),
    f('importer', 'Importer Contact Information', 'itemDetails', { type: 'textarea' }),
    f('packer', 'Packer Contact Information', 'itemDetails', { type: 'textarea' }),
];

const GENERIC_FEATURES = [
    f('material', 'Material', 'features'),
    f('color', 'Color', 'features'),
    f('size', 'Size', 'features'),
    f('compatibility', 'Compatibility', 'features'),
];

const PRESETS = [
    {
        id: 'electronics',
        match: /\b(?:electronic|mobile|phone|laptop|computer|graphics|gpu|tablet|camera|audio|headphone|tv|television|appliance|gadget|accessor)/i,
        fields: [
            f('processor', 'Processor', 'features'),
            f('ram', 'RAM', 'features', { type: 'number', unit: 'GB', units: ['MB', 'GB'] }),
            f('storage', 'Storage', 'features', { type: 'number', unit: 'GB', units: ['GB', 'TB'] }),
            f('gpu', 'Graphics Processor / GPU', 'features'),
            f('display_resolution', 'Display Resolution', 'features', { placeholder: 'e.g. 3840 x 2160' }),
            f('clock_speed', 'Clock Speed', 'features', { type: 'number', unit: 'MHz', units: ['MHz', 'GHz'] }),
            f('connectivity', 'Connectivity', 'features', { type: 'multiselect', options: ['Wi-Fi', 'Bluetooth', 'USB', 'HDMI', 'DisplayPort', 'Ethernet', 'NFC'] }),
            f('number_of_fans', 'Number of Fans', 'features', { type: 'number' }),
            f('compatible_devices', 'Compatible Devices', 'features'),
            f('color', 'Color', 'features'),
            f('warranty_period', 'Warranty Information', 'features'),
        ],
    },
    {
        id: 'clothing',
        match: /\b(?:cloth|apparel|fashion|wear|shirt|t-shirt|jean|dress|saree|kurta|footwear|shoe|garment)/i,
        fields: [
            f('fabric', 'Fabric', 'features'),
            f('pattern', 'Pattern', 'features'),
            f('fit_type', 'Fit Type', 'features', { type: 'select', options: ['Regular', 'Slim', 'Relaxed', 'Oversized', 'Skinny'] }),
            f('sleeve_type', 'Sleeve Type', 'features', { type: 'select', options: ['Full Sleeve', 'Half Sleeve', 'Sleeveless', '3/4 Sleeve'] }),
            f('size', 'Size', 'features'),
            f('color', 'Color', 'features'),
            f('material', 'Material', 'features'),
            f('care_instructions', 'Care Instructions', 'features', { type: 'textarea' }),
        ],
    },
    {
        id: 'grocery',
        match: /\b(?:grocer|food|beverage|snack|fruit|vegetable|dairy|staple|spice|oil|rice|atta|tea|coffee)/i,
        fields: [
            f('ingredients', 'Ingredients', 'features', { type: 'textarea' }),
            f('net_quantity', 'Net Quantity', 'features', { type: 'number', unit: 'g', units: ['g', 'kg', 'ml', 'l', 'pcs'] }),
            f('shelf_life', 'Shelf Life', 'features', { placeholder: 'e.g. 12 months' }),
            f('expiry_information', 'Expiry Information', 'features'),
            f('nutritional_information', 'Nutritional Information', 'features', { type: 'textarea' }),
            f('storage_instructions', 'Storage Instructions', 'features', { type: 'textarea' }),
            f('diet_type', 'Diet Type', 'features', { type: 'select', options: ['Vegetarian', 'Non-Vegetarian', 'Vegan'] }),
        ],
    },
    {
        id: 'furniture',
        match: /\b(?:furniture|sofa|bed|table|chair|wardrobe|decor|home|kitchen|storage|shelf|mattress)/i,
        fields: [
            f('material', 'Material', 'features'),
            f('dimensions', 'Dimensions (L x W x H)', 'features', { unit: 'cm', units: LENGTH_UNITS }),
            f('weight', 'Weight', 'features', { type: 'number', unit: 'kg', units: WEIGHT_UNITS }),
            f('finish', 'Finish', 'features'),
            f('assembly_required', 'Assembly Required', 'features', { type: 'boolean' }),
            f('room_type', 'Room Type', 'features', { type: 'select', options: ['Living Room', 'Bedroom', 'Dining Room', 'Kitchen', 'Office', 'Outdoor'] }),
            f('color', 'Color', 'features'),
        ],
    },
];

const cleanKey = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);

/** Walks from the category up through its ancestors. Returns [category, parent, grandparent...]. */
const loadCategoryChain = async (categoryId) => {
    const chain = [];
    if (!categoryId || !mongoose.Types.ObjectId.isValid(String(categoryId))) return chain;
    let currentId = categoryId;
    const seen = new Set();
    while (currentId && chain.length < 6 && !seen.has(String(currentId))) {
        seen.add(String(currentId));
        const cat = await Category.findById(currentId).select('name parentId specFields').lean();
        if (!cat) break;
        chain.push(cat);
        currentId = cat.parentId;
    }
    return chain;
};

const normalizeConfiguredField = (raw) => {
    const type = FIELD_TYPES.includes(raw.type) ? raw.type : 'text';
    return {
        key: cleanKey(raw.key) || cleanKey(raw.label),
        label: String(raw.label || '').trim(),
        group: SPEC_GROUPS.includes(raw.group) ? raw.group : 'features',
        type,
        options: Array.isArray(raw.options) ? raw.options.filter(Boolean) : [],
        unit: raw.unit || undefined,
        units: Array.isArray(raw.units) && raw.units.length ? raw.units : undefined,
        required: !!raw.required,
        placeholder: raw.placeholder || undefined,
    };
};

/** Resolves the ordered list of field definitions applicable to a category. */
export const resolveSpecTemplate = async (categoryId) => {
    const chain = await loadCategoryChain(categoryId);
    const names = chain.map((c) => c.name).join(' ');
    const preset = names ? PRESETS.find((p) => p.match.test(names)) : null;

    const byKey = new Map();
    const add = (field) => {
        if (!field.key || !field.label) return;
        byKey.set(field.key, { options: [], ...field });
    };
    (preset ? preset.fields : GENERIC_FEATURES).forEach(add);
    COMMON_FIELDS.forEach(add);

    // Admin-configured fields from the nearest category in the chain that defines any.
    const configured = chain.find((c) => Array.isArray(c.specFields) && c.specFields.length);
    if (configured) configured.specFields.map(normalizeConfiguredField).forEach(add);

    return {
        categoryId: chain[0] ? String(chain[0]._id) : null,
        preset: preset ? preset.id : 'generic',
        fields: Array.from(byKey.values()),
    };
};

const isEmpty = (v) =>
    v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);

const coerceValue = (field, value, label) => {
    const type = field?.type || 'text';
    switch (type) {
        case 'number': {
            const n = Number(String(value).replace(/,/g, ''));
            if (!Number.isFinite(n) || n < 0) throw new ApiError(400, `${label} must be a valid positive number.`);
            return n;
        }
        case 'boolean':
            if (typeof value === 'boolean') return value;
            if (['true', 'yes', '1'].includes(String(value).toLowerCase())) return true;
            if (['false', 'no', '0'].includes(String(value).toLowerCase())) return false;
            throw new ApiError(400, `${label} must be Yes or No.`);
        case 'select': {
            const v = String(value).trim().slice(0, MAX_VALUE);
            if (field.options?.length && !field.options.includes(v)) throw new ApiError(400, `${label} has an invalid option.`);
            return v;
        }
        case 'multiselect': {
            const arr = (Array.isArray(value) ? value : String(value).split(','))
                .map((x) => String(x).trim()).filter(Boolean).slice(0, 50);
            if (field.options?.length && arr.some((x) => !field.options.includes(x))) {
                throw new ApiError(400, `${label} has an invalid option.`);
            }
            return arr;
        }
        case 'date': {
            const d = new Date(value);
            if (Number.isNaN(d.getTime())) throw new ApiError(400, `${label} must be a valid date.`);
            return d.toISOString().slice(0, 10);
        }
        default:
            return String(value).trim().slice(0, MAX_VALUE);
    }
};

/**
 * Validates + normalises incoming specifications. Drops empty rows, enforces required fields from the
 * category template, coerces types and caps sizes. Returns undefined when nothing meaningful remains.
 * Throws ApiError(400) on invalid data.
 */
export const sanitizeSpecifications = async (raw, categoryId) => {
    if (raw === undefined || raw === null) return undefined;
    let input = raw;
    if (typeof input === 'string') {
        try { input = JSON.parse(input); } catch { throw new ApiError(400, 'Invalid specifications payload.'); }
    }
    if (typeof input !== 'object' || Array.isArray(input)) throw new ApiError(400, 'Invalid specifications payload.');

    const template = await resolveSpecTemplate(categoryId);
    const fieldByKey = new Map(template.fields.map((fl) => [fl.key, fl]));

    const out = {};
    const seen = new Set();
    for (const group of SPEC_GROUPS) {
        const rows = input[group];
        if (rows === undefined || rows === null) { out[group] = []; continue; }
        if (!Array.isArray(rows)) throw new ApiError(400, `Specifications "${group}" must be a list.`);
        if (rows.length > MAX_ENTRIES_PER_GROUP) throw new ApiError(400, `Too many entries in "${group}".`);

        out[group] = [];
        for (const row of rows) {
            if (!row || typeof row !== 'object' || isEmpty(row.value)) continue;
            const key = cleanKey(row.key) || cleanKey(row.label);
            const def = fieldByKey.get(key);
            const label = String(row.label || def?.label || '').trim().slice(0, MAX_LABEL);
            if (!key || !label) continue;
            const dedupe = `${group}:${key}`;
            if (seen.has(dedupe)) continue;
            seen.add(dedupe);

            const value = coerceValue(def, row.value, label);
            const unit = String(row.unit || '').trim().slice(0, 20);
            const entry = { key, label, type: def?.type || 'text', value };
            if (unit && typeof value !== 'boolean') entry.unit = unit;
            out[group].push(entry);
        }
    }

    const box = Array.isArray(input.whatsInBox) ? input.whatsInBox : [];
    out.whatsInBox = box.map((x) => String(x ?? '').trim().slice(0, 200)).filter(Boolean).slice(0, MAX_BOX_ITEMS);

    // Required fields (from category template) must be present.
    const present = new Set();
    SPEC_GROUPS.forEach((g) => out[g].forEach((e) => present.add(e.key)));
    for (const field of template.fields) {
        if (field.required && !present.has(field.key)) throw new ApiError(400, `${field.label} is required.`);
    }

    const hasAny = SPEC_GROUPS.some((g) => out[g].length) || out.whatsInBox.length;
    return hasAny ? out : undefined;
};
