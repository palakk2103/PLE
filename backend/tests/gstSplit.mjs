// Usage (from /backend): node tests/gstSplit.mjs
// Unit tests for CGST/SGST/IGST place-of-supply logic and invoice PDF rendering.
// Pure functions only — no database, no network.
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const imp = (p) => import(pathToFileURL(`${SRC}/${p}`).href);

const { normalizeState, stateFromGstin, stateFromAddressText } = await imp('utils/gstStates.js');
const {
    SUPPLY_TYPE, resolveSellerState, resolveBuyerState, determineSupplyType,
    splitGST, applyGSTSplit, summarizeGST, calculateItemGST,
} = await imp('utils/gstUtils.js');

let pass = 0, fail = 0;
const eq = (name, actual, expected) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    ok ? pass++ : fail++;
    console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : `\n     expected ${JSON.stringify(expected)}\n     got      ${JSON.stringify(actual)}`}`);
};

// ── state normalisation
eq('state name', normalizeState('Maharashtra')?.code, '27');
eq('state lowercase + spaces', normalizeState('  tamil   nadu ')?.code, '33');
eq('state abbreviation', normalizeState('MH')?.code, '27');
eq('state alias (Orissa)', normalizeState('Orissa')?.name, 'Odisha');
eq('state with &', normalizeState('Jammu & Kashmir')?.code, '01');
eq('state numeric code', normalizeState('7')?.name, 'Delhi');
eq('New Delhi -> Delhi', normalizeState('New Delhi')?.code, '07');
eq('unknown state', normalizeState('Atlantis'), null);
eq('empty state', normalizeState(''), null);

// ── GSTIN
eq('GSTIN Karnataka', stateFromGstin('29ABCDE1234F1Z5')?.name, 'Karnataka');
eq('GSTIN lowercase', stateFromGstin('27abcde1234f1z5')?.code, '27');
eq('legacy GSTIN 28 -> Andhra Pradesh', stateFromGstin('28ABCDE1234F1Z5')?.code, '37');
eq('bad GSTIN', stateFromGstin('ABC'), null);

// ── free-text address
eq('address text', stateFromAddressText('12 MG Road, Pune, Maharashtra 411001')?.code, '27');
eq('address prefers longest match', stateFromAddressText('Sector 5, Andhra Pradesh')?.code, '37');
eq('address: no 2-letter false positives', stateFromAddressText('Plot 4, Up the hill road'), null);

// ── seller state priority
eq('seller: GSTIN beats state field',
    resolveSellerState({ gstNumber: '29ABCDE1234F1Z5', state: 'Maharashtra' })?.code, '29');
eq('seller: state field when no GSTIN', resolveSellerState({ state: 'Gujarat' })?.code, '24');
eq('seller: pickup address state', resolveSellerState({ address: { state: 'Kerala' } })?.code, '32');
eq('managed shop: GSTIN in "gst"', resolveSellerState({ gst: '07ABCDE1234F1Z5', address: 'Pune, Maharashtra' })?.code, '07');
eq('managed shop: text address', resolveSellerState({ address: 'Warehouse 3, Chennai, Tamil Nadu' })?.code, '33');
delete process.env.PLATFORM_GST_STATE;
eq('seller unknown, no platform default', resolveSellerState({}), null);
process.env.PLATFORM_GST_STATE = 'Maharashtra';
eq('seller unknown -> PLATFORM_GST_STATE', resolveSellerState(null)?.source, 'platform_default');
delete process.env.PLATFORM_GST_STATE;

// ── buyer state
eq('buyer from state field', resolveBuyerState({ state: 'Karnataka' })?.code, '29');
eq('buyer from address text', resolveBuyerState({ address: 'Flat 2, Kochi, Kerala' })?.code, '32');
eq('buyer missing', resolveBuyerState(null), null);

// ── supply type
const MH = normalizeState('Maharashtra'), KA = normalizeState('Karnataka');
eq('same state -> INTRA', determineSupplyType(MH, MH), SUPPLY_TYPE.INTRA);
eq('different state -> INTER', determineSupplyType(MH, KA), SUPPLY_TYPE.INTER);
eq('missing seller -> UNKNOWN', determineSupplyType(null, KA), SUPPLY_TYPE.UNKNOWN);
eq('missing buyer -> UNKNOWN', determineSupplyType(MH, null), SUPPLY_TYPE.UNKNOWN);

// ── splitting
eq('intra split even', splitGST(180, SUPPLY_TYPE.INTRA), { cgstAmount: 90, sgstAmount: 90, igstAmount: 0 });
eq('intra split odd paisa adds back exactly', (() => {
    const s = splitGST(10.01, SUPPLY_TYPE.INTRA);
    return Math.round((s.cgstAmount + s.sgstAmount) * 100) / 100;
})(), 10.01);
eq('inter split', splitGST(180, SUPPLY_TYPE.INTER), { cgstAmount: 0, sgstAmount: 0, igstAmount: 180 });
eq('unknown split leaves GST unsplit', splitGST(180, SUPPLY_TYPE.UNKNOWN), { cgstAmount: 0, sgstAmount: 0, igstAmount: 0 });
eq('zero GST', splitGST(0, SUPPLY_TYPE.INTRA), { cgstAmount: 0, sgstAmount: 0, igstAmount: 0 });

// ── end-to-end with existing GST calculator (totals unchanged)
const excl = calculateItemGST(1000, 2, 18, 0, false);          // 2000 + 360
const incl = calculateItemGST(1180, 1, 18, 0, true);           // 1000 + 180 inside
const a = applyGSTSplit({ gstAmount: excl.gstAmount }, SUPPLY_TYPE.INTRA);
const b = applyGSTSplit({ gstAmount: incl.gstAmount }, SUPPLY_TYPE.INTER);
const c = applyGSTSplit({ gstAmount: 50 }, SUPPLY_TYPE.UNKNOWN);
eq('tax-exclusive line split', [a.cgstAmount, a.sgstAmount], [180, 180]);
eq('tax-inclusive line split', b.igstAmount, 180);
eq('summary of mixed order', summarizeGST([a, b, c]), { cgst: 180, sgst: 180, igst: 180, unsplit: 50 });
eq('summary total == sum of gstAmount', (() => {
    const s = summarizeGST([a, b, c]);
    return s.cgst + s.sgst + s.igst + s.unsplit;
})(), a.gstAmount + b.gstAmount + c.gstAmount);

// ── invoice PDF renders with split, unsplit and vendor-scoped data
const { generateInvoicePdfBuffer } = await imp('services/invoice.service.js');
const baseInvoice = {
    invoiceNumber: 'INV-T-1', orderNumber: 'ORD-T-1', invoiceDate: new Date(), status: 'paid',
    customer: { name: 'Test Buyer' }, shippingAddress: { state: 'Karnataka' },
    placeOfSupply: { state: 'Karnataka', code: '29' },
    items: [
        { name: 'Phone', price: 1000, quantity: 2, gstRate: 18, gstAmount: 360, totalAmount: 2000, supplyType: 'INTRA_STATE', cgstAmount: 180, sgstAmount: 180 },
        { name: 'Cable', price: 100, quantity: 1, gstRate: 18, gstAmount: 18, totalAmount: 100, supplyType: 'INTER_STATE', igstAmount: 18 },
    ],
    financialSummary: { subtotal: 2100, tax: 378, cgst: 180, sgst: 180, igst: 18, shipping: 0, grandTotal: 2478 },
    payment: { method: 'card', status: 'paid' },
};
for (const [label, inv, role] of [
    ['customer PDF with split', baseInvoice, 'customer'],
    ['admin PDF with split', baseInvoice, 'admin'],
    ['PDF for old invoice (no split)', { ...baseInvoice, placeOfSupply: undefined, items: [{ name: 'Old', price: 100, quantity: 1, gstRate: 18, gstAmount: 18, totalAmount: 100 }], financialSummary: { subtotal: 100, tax: 18, grandTotal: 118 } }, 'customer'],
    ['vendor PDF (sellerInfo only)', { ...baseInvoice, financialSummary: undefined, sellerInfo: { storeName: 'S', subtotal: 2000, tax: 360, cgst: 180, sgst: 180, igst: 0, total: 2360 } }, 'vendor'],
]) {
    try {
        const buf = await generateInvoicePdfBuffer(inv, role);
        eq(label, buf.slice(0, 4).toString(), '%PDF');
    } catch (e) {
        eq(label, e.message, '%PDF');
    }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
