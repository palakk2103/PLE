import mongoose from 'mongoose';
import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import VendorShippingZone from '../../../models/VendorShippingZone.model.js';
import VendorShippingRate from '../../../models/VendorShippingRate.model.js';
import Vendor from '../../../models/Vendor.model.js';
import ManagedShop from '../../../models/ManagedShop.model.js';
import PickupLocation from '../../../models/PickupLocation.model.js';
import { deliveryManager } from '../../delivery/deliveryManager.js';

const sanitizeCountries = (countries) => {
    if (!Array.isArray(countries)) return [];
    return countries
        .map((country) => String(country || '').trim())
        .filter(Boolean);
};

const parseNonNegativeNumber = (value, fieldName) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new ApiError(400, `${fieldName} must be a non-negative number.`);
    }
    return parsed;
};

export const getShippingZones = asyncHandler(async (req, res) => {
    const zones = await VendorShippingZone.find({ vendorId: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(new ApiResponse(200, zones, 'Shipping zones fetched.'));
});

export const createShippingZone = asyncHandler(async (req, res) => {
    if (req.user.role === 'managed_vendor') {
        throw new ApiError(403, 'Managed vendor shipping settings are managed by Administrator.');
    }
    const name = String(req.body?.name || '').trim();
    if (!name) throw new ApiError(400, 'Zone name is required.');

    const zone = await VendorShippingZone.create({
        vendorId: req.user.id,
        name,
        countries: sanitizeCountries(req.body?.countries),
    });

    res.status(201).json(new ApiResponse(201, zone, 'Shipping zone created.'));
});

export const updateShippingZone = asyncHandler(async (req, res) => {
    if (req.user.role === 'managed_vendor') {
        throw new ApiError(403, 'Managed vendor shipping settings are managed by Administrator.');
    }
    const zone = await VendorShippingZone.findOne({ _id: req.params.id, vendorId: req.user.id });
    if (!zone) throw new ApiError(404, 'Shipping zone not found.');

    if (req.body?.name !== undefined) {
        const name = String(req.body.name || '').trim();
        if (!name) throw new ApiError(400, 'Zone name is required.');
        zone.name = name;
    }

    if (req.body?.countries !== undefined) {
        zone.countries = sanitizeCountries(req.body.countries);
    }

    await zone.save();
    res.status(200).json(new ApiResponse(200, zone, 'Shipping zone updated.'));
});

export const deleteShippingZone = asyncHandler(async (req, res) => {
    if (req.user.role === 'managed_vendor') {
        throw new ApiError(403, 'Managed vendor shipping settings are managed by Administrator.');
    }
    const zone = await VendorShippingZone.findOneAndDelete({ _id: req.params.id, vendorId: req.user.id });
    if (!zone) throw new ApiError(404, 'Shipping zone not found.');

    await VendorShippingRate.deleteMany({ vendorId: req.user.id, zoneId: zone._id });
    res.status(200).json(new ApiResponse(200, null, 'Shipping zone deleted.'));
});

export const getShippingRates = asyncHandler(async (req, res) => {
    const rates = await VendorShippingRate.find({ vendorId: req.user.id })
        .populate('zoneId', 'name')
        .sort({ createdAt: -1 });

    const mappedRates = rates.map((rateDoc) => {
        const rate = rateDoc.toObject();
        return {
            ...rate,
            zoneName: rate.zoneId?.name || '',
        };
    });

    res.status(200).json(new ApiResponse(200, mappedRates, 'Shipping rates fetched.'));
});

export const createShippingRate = asyncHandler(async (req, res) => {
    if (req.user.role === 'managed_vendor') {
        throw new ApiError(403, 'Managed vendor shipping settings are managed by Administrator.');
    }
    const zoneId = String(req.body?.zoneId || '').trim();
    const name = String(req.body?.name || '').trim();
    if (!zoneId || !mongoose.Types.ObjectId.isValid(zoneId)) {
        throw new ApiError(400, 'Valid zone is required.');
    }
    if (!name) throw new ApiError(400, 'Rate method name is required.');

    const zone = await VendorShippingZone.findOne({ _id: zoneId, vendorId: req.user.id });
    if (!zone) throw new ApiError(404, 'Shipping zone not found.');

    const rate = await VendorShippingRate.create({
        vendorId: req.user.id,
        zoneId,
        name,
        rate: parseNonNegativeNumber(req.body?.rate ?? 0, 'Rate'),
        freeShippingThreshold: parseNonNegativeNumber(
            req.body?.freeShippingThreshold ?? 0,
            'Free shipping threshold'
        ),
    });

    const created = await VendorShippingRate.findById(rate._id).populate('zoneId', 'name');
    const payload = created.toObject();
    payload.zoneName = payload.zoneId?.name || '';

    res.status(201).json(new ApiResponse(201, payload, 'Shipping rate created.'));
});

export const updateShippingRate = asyncHandler(async (req, res) => {
    if (req.user.role === 'managed_vendor') {
        throw new ApiError(403, 'Managed vendor shipping settings are managed by Administrator.');
    }
    const rate = await VendorShippingRate.findOne({ _id: req.params.id, vendorId: req.user.id });
    if (!rate) throw new ApiError(404, 'Shipping rate not found.');

    if (req.body?.zoneId !== undefined) {
        const zoneId = String(req.body.zoneId || '').trim();
        if (!zoneId || !mongoose.Types.ObjectId.isValid(zoneId)) {
            throw new ApiError(400, 'Valid zone is required.');
        }
        const zone = await VendorShippingZone.findOne({ _id: zoneId, vendorId: req.user.id });
        if (!zone) throw new ApiError(404, 'Shipping zone not found.');
        rate.zoneId = zoneId;
    }

    if (req.body?.name !== undefined) {
        const name = String(req.body.name || '').trim();
        if (!name) throw new ApiError(400, 'Rate method name is required.');
        rate.name = name;
    }

    if (req.body?.rate !== undefined) {
        rate.rate = parseNonNegativeNumber(req.body.rate, 'Rate');
    }

    if (req.body?.freeShippingThreshold !== undefined) {
        rate.freeShippingThreshold = parseNonNegativeNumber(
            req.body.freeShippingThreshold,
            'Free shipping threshold'
        );
    }

    await rate.save();

    const updated = await VendorShippingRate.findById(rate._id).populate('zoneId', 'name');
    const payload = updated.toObject();
    payload.zoneName = payload.zoneId?.name || '';

    res.status(200).json(new ApiResponse(200, payload, 'Shipping rate updated.'));
});

export const deleteShippingRate = asyncHandler(async (req, res) => {
    if (req.user.role === 'managed_vendor') {
        throw new ApiError(403, 'Managed vendor shipping settings are managed by Administrator.');
    }
    const rate = await VendorShippingRate.findOneAndDelete({ _id: req.params.id, vendorId: req.user.id });
    if (!rate) throw new ApiError(404, 'Shipping rate not found.');

    res.status(200).json(new ApiResponse(200, null, 'Shipping rate deleted.'));
});

/* ───────────── delivery serviceability check (pincode → available / unavailable) ───────────── */

const PIN_RE = /^\d{6}$/;

const resolvePickupPincode = async (vendorId) => {
    const pickup = await PickupLocation.findOne({ vendorId }).sort({ isDefault: -1 }).select('zipCode').lean().catch(() => null);
    if (PIN_RE.test(String(pickup?.zipCode || '').trim())) return String(pickup.zipCode).trim();
    const vendor = await Vendor.findById(vendorId).select('pincode address').lean().catch(() => null);
    const vp = String(vendor?.pincode || vendor?.address?.zipCode || '').trim();
    if (PIN_RE.test(vp)) return vp;
    const shop = await ManagedShop.findById(vendorId).select('warehouse address').lean().catch(() => null);
    const m = `${shop?.warehouse || ''} ${shop?.address || ''}`.match(/\b\d{6}\b/);
    if (m) return m[0];
    return String(process.env.SHIPROCKET_PICKUP_PINCODE || process.env.DEFAULT_PICKUP_PINCODE || '110001').trim();
};

export const checkServiceability = asyncHandler(async (req, res) => {
    const deliveryPincode = String(req.body?.pincode || req.query?.pincode || '').trim();
    if (!PIN_RE.test(deliveryPincode)) {
        throw new ApiError(400, 'Enter a valid 6-digit delivery pincode.');
    }
    const weight = Math.min(50, Math.max(0.1, Number(req.body?.weight || req.query?.weight) || 0.5));
    const cod = String(req.body?.cod ?? req.query?.cod ?? '') === 'true' || req.body?.cod === true;
    const pickupPincode = await resolvePickupPincode(req.user.id);

    let quote;
    try {
        quote = await deliveryManager.getQuote({
            preferredProvider: 'shiprocket',
            pickupPincode,
            deliveryPincode,
            weight,
            cod: cod ? 1 : 0,
        });
    } catch (err) {
        throw new ApiError(502, 'Could not reach the courier service. Please try again shortly.');
    }

    const couriers = (quote?.availableCouriers || []).slice(0, 8).map((c) => ({
        name: c.courier_name,
        rate: Number(c.rate ?? c.freight_charge ?? 0),
        etd: c.etd || null,
        estimatedDays: c.estimated_delivery_days || null,
        cod: Number(c.cod) === 1 || Boolean(c.is_cod),
    }));

    res.status(200).json(new ApiResponse(200, {
        pickupPincode,
        deliveryPincode,
        serviceable: Boolean(quote?.isServiceable),
        codAvailable: Boolean(quote?.isCodAvailable),
        reason: quote?.isServiceable ? null : (quote?.reason || 'No courier delivers to this pincode.'),
        selectedCourier: quote?.selectedCourier || null,
        couriers,
    }, quote?.isServiceable ? 'Delivery available.' : 'Delivery not available.'));
});
