import VendorShippingZone from '../models/VendorShippingZone.model.js';
import VendorShippingRate from '../models/VendorShippingRate.model.js';
import Vendor from '../models/Vendor.model.js';
import ManagedShop from '../models/ManagedShop.model.js';
import PickupLocation from '../models/PickupLocation.model.js';
import { deliveryManager } from '../modules/delivery/deliveryManager.js';

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const isValidPincode = (val) => /^\d{6}$/.test(String(val || '').trim());

const pickRateByMethod = (rates = [], shippingOption = 'standard') => {
    if (!rates.length) return null;
    const option = normalizeText(shippingOption);
    const direct = rates.find((rate) => normalizeText(rate?.name).includes(option));
    if (direct) return direct;

    if (option === 'express') {
        const expressLike = rates.find((rate) => normalizeText(rate?.name).includes('express'));
        if (expressLike) return expressLike;
    }

    if (option === 'standard') {
        const standardLike = rates.find((rate) => normalizeText(rate?.name).includes('standard'));
        if (standardLike) return standardLike;
    }

    return rates[0];
};

export const calculateVendorShippingForGroups = async ({
    vendorGroups = [],
    shippingAddress = {},
    shippingOption = 'standard',
    paymentMethod = 'prepaid',
    couponType = null,
}) => {
    const groups = Array.isArray(vendorGroups) ? vendorGroups : [];
    if (!groups.length) {
        return {
            totalShipping: 0,
            shippingByVendor: {},
            isCodAvailable: true,
            isServiceable: true,
            courierInfo: {}
        };
    }

    const isCod = ['cod', 'cash'].includes(normalizeText(paymentMethod));
    const deliveryPincode = String(
        shippingAddress?.zipCode ||
        shippingAddress?.pincode ||
        shippingAddress?.postalCode ||
        ''
    ).trim();

    // 1. Check coupon-level free shipping
    if (normalizeText(couponType) === 'freeship') {
        const freeMap = groups.reduce((acc, group) => {
            acc[String(group.vendorId)] = 0;
            return acc;
        }, {});
        return {
            totalShipping: 0,
            shippingByVendor: freeMap,
            isCodAvailable: true,
            isServiceable: true,
            courierInfo: {}
        };
    }

    const vendorIds = [...new Set(groups.map((group) => String(group.vendorId || '')).filter(Boolean))];
    const validVendorObjectIds = vendorIds.filter((id) => /^[a-fA-F0-9]{24}$/.test(id));

    // Load vendor configurations, zones, and pickup locations in parallel
    const [zones, rates, vendors, managedShops, pickupLocations] = await Promise.all([
        validVendorObjectIds.length ? VendorShippingZone.find({ vendorId: { $in: validVendorObjectIds } }).select('vendorId countries').lean().catch(() => []) : [],
        validVendorObjectIds.length ? VendorShippingRate.find({ vendorId: { $in: validVendorObjectIds } }).select('vendorId zoneId name rate freeShippingThreshold').lean().catch(() => []) : [],
        validVendorObjectIds.length ? Vendor.find({ _id: { $in: validVendorObjectIds } }).select('_id pincode address shippingEnabled defaultShippingRate freeShippingThreshold').lean().catch(() => []) : [],
        validVendorObjectIds.length ? ManagedShop.find({ _id: { $in: validVendorObjectIds } }).select('_id warehouse address').lean().catch(() => []) : [],
        validVendorObjectIds.length ? PickupLocation.find({ vendorId: { $in: validVendorObjectIds } }).select('vendorId zipCode isDefault').lean().catch(() => []) : []
    ]);

    const vendorMap = new Map((vendors || []).map((v) => [String(v._id), v]));
    const shopMap = new Map((managedShops || []).map((s) => [String(s._id), s]));

    const pickupByVendor = new Map();
    (pickupLocations || []).forEach((pl) => {
        const vid = String(pl.vendorId);
        if (!pickupByVendor.has(vid) || pl.isDefault) {
            pickupByVendor.set(vid, String(pl.zipCode || '').trim());
        }
    });

    const zonesByVendor = new Map();
    zones.forEach((zone) => {
        const key = String(zone.vendorId);
        if (!zonesByVendor.has(key)) zonesByVendor.set(key, []);
        zonesByVendor.get(key).push(zone);
    });

    const ratesByVendor = new Map();
    rates.forEach((rate) => {
        const key = String(rate.vendorId);
        if (!ratesByVendor.has(key)) ratesByVendor.set(key, []);
        ratesByVendor.get(key).push(rate);
    });

    const shippingByVendor = {};
    const courierInfoByVendor = {};
    let overallCodAvailable = true;
    let overallServiceable = true;
    const shippingCountry = normalizeText(shippingAddress?.country);

    const defaultPlatformPincode = String(
        process.env.SHIPROCKET_PICKUP_PINCODE ||
        process.env.DEFAULT_PICKUP_PINCODE ||
        '110001'
    ).trim();

    // Iterate each vendor group and calculate rate
    for (const group of groups) {
        const vendorId = String(group.vendorId || '');
        const subtotal = Math.max(0, toNumber(group.subtotal, 0));
        const shippingEnabled = group.shippingEnabled !== false;
        const defaultRate = Math.max(0, toNumber(group.defaultShippingRate, 0));
        const defaultThreshold = Math.max(0, toNumber(group.freeShippingThreshold, 0));

        // If shipping disabled for vendor
        if (!shippingEnabled) {
            shippingByVendor[vendorId] = 0;
            continue;
        }

        // If vendor free-shipping threshold is met
        if (defaultThreshold > 0 && subtotal >= defaultThreshold) {
            shippingByVendor[vendorId] = 0;
            continue;
        }

        // Resolve vendor pickup pincode
        let pickupPincode = pickupByVendor.get(vendorId);
        if (!isValidPincode(pickupPincode)) {
            const vDoc = vendorMap.get(vendorId);
            if (vDoc) {
                pickupPincode = vDoc.pincode || vDoc.address?.zipCode;
            }
        }
        if (!isValidPincode(pickupPincode)) {
            const sDoc = shopMap.get(vendorId);
            if (sDoc) {
                const whMatch = String(sDoc.warehouse || '').match(/\b\d{6}\b/);
                const addrMatch = String(sDoc.address || '').match(/\b\d{6}\b/);
                pickupPincode = whMatch ? whMatch[0] : (addrMatch ? addrMatch[0] : null);
            }
        }
        if (!isValidPincode(pickupPincode)) {
            pickupPincode = defaultPlatformPincode;
        }

        // Calculate approximate package weight for this vendor group (default 0.5 kg per item)
        const groupItems = Array.isArray(group.items) ? group.items : [];
        const estimatedWeight = groupItems.reduce((acc, itm) => {
            const qty = Math.max(1, Number(itm.quantity || 1));
            const itemWeight = Number(itm.weight || itm.packageWeight || 0.5);
            return acc + (itemWeight * qty);
        }, 0) || 0.5;

        // Try Shiprocket dynamic quote if delivery pincode is valid
        let shiprocketRate = null;
        if (isValidPincode(deliveryPincode) && isValidPincode(pickupPincode)) {
            try {
                const quoteRes = await deliveryManager.getQuote({
                    preferredProvider: 'shiprocket',
                    pickupPincode,
                    deliveryPincode,
                    weight: Math.max(0.1, estimatedWeight),
                    cod: isCod ? 1 : 0,
                    declaredValue: subtotal,
                });

                if (quoteRes) {
                    if (quoteRes.isCodAvailable === false && isCod) {
                        overallCodAvailable = false;
                    }
                    if (quoteRes.isServiceable === false) {
                        overallServiceable = false;
                    }

                    if (quoteRes.isServiceable && Number.isFinite(quoteRes.applicableRate)) {
                        shiprocketRate = quoteRes.applicableRate;
                        courierInfoByVendor[vendorId] = quoteRes.selectedCourier ? {
                            ...quoteRes.selectedCourier,
                            source: 'shiprocket'
                        } : null;
                    }
                }
            } catch (srErr) {
                // If Shiprocket throws (e.g. rate limit, credentials, network), we log and fallback to database rules
                console.warn(`[vendorShipping] Shiprocket quote failed for vendor ${vendorId}: ${srErr.message}`);
            }
        }

        if (shiprocketRate !== null) {
            shippingByVendor[vendorId] = Math.max(0, shiprocketRate);
            continue;
        }

        // Fallback to existing database zones & rates if Shiprocket was unavailable or not configured
        const vendorZones = zonesByVendor.get(vendorId) || [];
        const vendorRates = ratesByVendor.get(vendorId) || [];

        let matchedZone = null;
        if (shippingCountry) {
            matchedZone = vendorZones.find((zone) =>
                Array.isArray(zone.countries) &&
                zone.countries.some((country) => normalizeText(country) === shippingCountry)
            );
        }
        if (!matchedZone) {
            matchedZone = vendorZones.find((zone) => !Array.isArray(zone.countries) || zone.countries.length === 0) || null;
        }

        const candidateRates = matchedZone
            ? vendorRates.filter((rate) => String(rate.zoneId) === String(matchedZone._id))
            : vendorRates;
        const chosenRate = pickRateByMethod(candidateRates, shippingOption);

        if (chosenRate) {
            const threshold = Math.max(0, toNumber(chosenRate.freeShippingThreshold, 0));
            if (threshold > 0 && subtotal >= threshold) {
                shippingByVendor[vendorId] = 0;
                courierInfoByVendor[vendorId] = {
                    courierName: 'Free Standard Delivery',
                    rate: 0,
                    estimatedDays: '3–5 Business Days',
                    source: 'free_shipping'
                };
            } else {
                const rateAmount = Math.max(0, toNumber(chosenRate.rate, 0));
                // If COD, add a nominal COD charge only if fallback table has no COD rate
                const codSurcharge = isCod ? 30 : 0;
                shippingByVendor[vendorId] = rateAmount + codSurcharge;
                courierInfoByVendor[vendorId] = {
                    courierName: chosenRate.name || 'Standard Logistics',
                    rate: rateAmount + codSurcharge,
                    estimatedDays: '3–5 Business Days',
                    source: 'zone_rate'
                };
            }
            continue;
        }

        const fallbackStandard = defaultRate > 0 ? defaultRate : 50;
        const baseRate = normalizeText(shippingOption) === 'express'
            ? (defaultRate > 0 ? defaultRate * 2 : 100)
            : fallbackStandard;
        const codSurcharge = isCod ? 30 : 0;
        shippingByVendor[vendorId] = baseRate + codSurcharge;
        if (!courierInfoByVendor[vendorId]) {
            courierInfoByVendor[vendorId] = {
                courierName: normalizeText(shippingOption) === 'express' ? 'Express Cargo Lines' : 'Standard Surface Logistics',
                rate: baseRate + codSurcharge,
                estimatedDays: normalizeText(shippingOption) === 'express' ? '1–2 Business Days' : '3–5 Business Days',
                source: 'standard_rate'
            };
        }
    }

    const totalShipping = Number(
        Object.values(shippingByVendor).reduce((sum, amount) => sum + toNumber(amount, 0), 0).toFixed(2)
    );

    return {
        totalShipping,
        shippingByVendor,
        isCodAvailable: overallCodAvailable,
        isServiceable: overallServiceable,
        courierInfo: courierInfoByVendor
    };
};


