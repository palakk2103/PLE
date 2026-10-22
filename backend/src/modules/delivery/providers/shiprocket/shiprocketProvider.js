import shiprocketClient from './shiprocketClient.js';
import { mapShiprocketStatusToCanonical } from './shiprocketStatusMap.js';
import { verifyShiprocketWebhookSignature, parseShiprocketWebhookPayload } from './shiprocketWebhookParser.js';
import { ProviderError } from '../../IDeliveryProvider.js';

export class ShiprocketDeliveryProvider {
    constructor() {
        this.name = 'shiprocket';
    }

    /**
     * Create an order + shipment in Shiprocket
     * @param {Object} context Order & item payload context
     */
    async createShipment(context) {
        const {
            orderId,
            orderDate = new Date(),
            pickupLocation = process.env.SHIPROCKET_PICKUP_LOCATION || 'Primary',
            billingAddress,
            shippingAddress,
            orderItems = [],
            paymentMethod = 'Prepaid',
            subtotal = 0,
            weight = 0.5,
            length = 10,
            breadth = 10,
            height = 10
        } = context;

        const dateStr = new Date(orderDate).toISOString().slice(0, 19).replace('T', ' ');

        const formattedItems = orderItems.map((item, idx) => ({
            name: item.name || `Item ${idx + 1}`,
            sku: item.sku || item.productId || `SKU-${idx + 1}`,
            units: item.quantity || 1,
            selling_price: item.price || 0,
            discount: item.discount || 0,
            tax: item.tax || 0,
            hsn: item.hsn || ''
        }));

        const isCod = String(paymentMethod).toLowerCase() === 'cod';

        const payload = {
            order_id: String(orderId),
            order_date: dateStr,
            pickup_location: pickupLocation,
            billing_customer_name: billingAddress?.name || 'Customer',
            billing_last_name: '',
            billing_address: billingAddress?.address || 'Street address',
            billing_city: billingAddress?.city || 'City',
            billing_pincode: billingAddress?.zipCode || billingAddress?.pincode || '110001',
            billing_state: billingAddress?.state || 'State',
            billing_country: billingAddress?.country || 'India',
            billing_email: billingAddress?.email || 'customer@example.com',
            billing_phone: billingAddress?.phone || '9999999999',
            shipping_is_billing: true,
            order_items: formattedItems,
            payment_method: isCod ? 'COD' : 'Prepaid',
            sub_total: subtotal,
            length,
            breadth,
            height,
            weight
        };

        try {
            // Step 1: Create Custom Order in Shiprocket
            const createRes = await shiprocketClient.request('POST', '/orders/create/adhoc', payload);

            if (!createRes || !createRes.order_id) {
                throw new ProviderError('CREATE_FAILED', 'Shiprocket order creation returned invalid response', createRes);
            }

            const shiprocketOrderId = createRes.order_id;
            const shipmentId = createRes.shipment_id;

            // Step 2: Generate AWB for the shipment if courier auto-assign is requested or default
            let awbCode = null;
            let courierName = null;
            let courierCompanyId = null;

            if (shipmentId) {
                try {
                    const awbRes = await shiprocketClient.request('POST', '/courier/assign/awb', {
                        shipment_id: shipmentId
                    });
                    if (awbRes && awbRes.response && awbRes.response.data) {
                        awbCode = awbRes.response.data.awb_code;
                        courierName = awbRes.response.data.courier_name;
                        courierCompanyId = awbRes.response.data.courier_company_id;
                    }
                } catch (awbErr) {
                    // AWB generation can be deferred to pickup scheduling step if needed
                    console.warn(`[ShiprocketProvider] AWB assignment warning for order ${orderId}: ${awbErr.message}`);
                }
            }

            return {
                providerName: this.name,
                externalShipmentId: shipmentId ? String(shipmentId) : null,
                shiprocketOrderId: String(shiprocketOrderId),
                awbCode: awbCode ? String(awbCode) : null,
                courierCompanyId,
                courierName,
                pickupLocation,
                trackingUrl: awbCode ? `https://shiprocket.co/tracking/${awbCode}` : null,
                rawStatus: 'NEW',
                canonicalStatus: 'processing',
                rawResponse: createRes
            };
        } catch (err) {
            if (err instanceof ProviderError) throw err;
            throw new ProviderError('SHIPMENT_CREATION_FAILED', err.message, err);
        }
    }

    /**
     * Cancel an existing shipment
     */
    async cancelShipment(context) {
        const { orderIds = [], shiprocketOrderId } = context;
        const idsToCancel = shiprocketOrderId ? [shiprocketOrderId] : orderIds;

        if (!idsToCancel.length) {
            return { cancelled: false, reason: 'No order IDs supplied' };
        }

        try {
            const res = await shiprocketClient.request('POST', '/orders/cancel', {
                ids: idsToCancel
            });
            return {
                cancelled: true,
                rawResponse: res
            };
        } catch (err) {
            throw new ProviderError('CANCEL_FAILED', err.message, err);
        }
    }

    /**
     * Fetch real-time tracking details by AWB Code
     */
    async getTrackingInfo(context) {
        const { awbCode, shipmentId } = context;

        if (!awbCode && !shipmentId) {
            throw new ProviderError('INVALID_ARGUMENTS', 'awbCode or shipmentId required for tracking');
        }

        try {
            const endpoint = awbCode
                ? `/courier/track/awb/${awbCode}`
                : `/courier/track/shipment/${shipmentId}`;

            const trackingRes = await shiprocketClient.request('GET', endpoint);

            const trackingData = trackingRes?.tracking_data || {};
            const currentStatus = trackingData.current_status || 'NEW';
            const scans = trackingData.shipment_track_activities || [];

            return {
                providerStatus: currentStatus,
                canonicalStatus: this.mapStatus(currentStatus),
                location: trackingData.current_timestamp_location || '',
                etd: trackingData.etd ? new Date(trackingData.etd) : null,
                events: scans.map(s => ({
                    status: s.activity,
                    location: s.location,
                    timestamp: new Date(s.date),
                    raw: s
                })),
                rawResponse: trackingRes
            };
        } catch (err) {
            throw new ProviderError('TRACKING_FAILED', err.message, err);
        }
    }

    async getETA(context) {
        const info = await this.getTrackingInfo(context);
        return {
            etd: info.etd,
            canonicalStatus: info.canonicalStatus
        };
    }

    async getQuote(context) {
        const {
            pickupPincode,
            deliveryPincode,
            weight = 0.5,
            cod = 0,
            declaredValue,
            length = 10,
            breadth = 10,
            height = 10
        } = context;

        const isCodRequested = Boolean(Number(cod) === 1 || String(cod).toLowerCase() === 'cod');
        const numericCod = isCodRequested ? 1 : 0;
        const normalizedPickup = String(pickupPincode || '').trim();
        const normalizedDelivery = String(deliveryPincode || '').trim();
        const safeWeight = Math.max(0.05, Number(weight) || 0.5);

        if (!normalizedPickup || !normalizedDelivery) {
            return {
                providerName: this.name,
                isServiceable: false,
                isCodAvailable: false,
                applicableRate: 0,
                selectedCourier: null,
                recommendedCourier: null,
                availableCouriers: [],
                reason: 'Missing pickup or delivery pincode'
            };
        }

        // Quote cache key with 5-minute TTL
        const cacheKey = `${normalizedPickup}:${normalizedDelivery}:${safeWeight.toFixed(2)}:${numericCod}:${Math.round(Number(declaredValue) || 0)}`;
        if (!this._quoteCache) this._quoteCache = new Map();
        const cached = this._quoteCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.data;
        }

        try {
            const queryParams = {
                pickup_postcode: normalizedPickup,
                delivery_postcode: normalizedDelivery,
                weight: safeWeight,
                cod: numericCod,
                length,
                breadth,
                height
            };
            if (Number.isFinite(Number(declaredValue)) && Number(declaredValue) > 0) {
                queryParams.declared_value = Number(declaredValue);
            }

            const res = await shiprocketClient.request('GET', '/courier/serviceability/', null, queryParams);
            const data = res?.data || {};
            const availableCouriers = Array.isArray(data.available_courier_companies) ? data.available_courier_companies : [];
            const recommendedId = data.recommended_courier_company_id;

            // Check if any courier offers COD on this route
            const codAvailableAny = availableCouriers.some((c) => Number(c.cod) === 1 || Boolean(c.is_cod));

            // Eligible couriers for the requested payment mode
            let eligibleCouriers = availableCouriers;
            if (isCodRequested) {
                eligibleCouriers = availableCouriers.filter((c) => Number(c.cod) === 1 || Boolean(c.is_cod));
            }

            const isServiceable = eligibleCouriers.length > 0;
            let selectedCourier = null;

            if (isServiceable) {
                // Priority 1: Recommended courier if eligible
                const recommendedCourier = recommendedId
                    ? eligibleCouriers.find((c) => (c.courier_company_id === recommendedId || c.id === recommendedId))
                    : null;

                if (recommendedCourier) {
                    selectedCourier = recommendedCourier;
                } else {
                    // Priority 2: Courier with lowest rate
                    selectedCourier = [...eligibleCouriers].sort((a, b) => {
                        const rateA = Number(a.rate ?? (Number(a.freight_charge || 0) + (isCodRequested ? Number(a.cod_charges || 0) : 0)));
                        const rateB = Number(b.rate ?? (Number(b.freight_charge || 0) + (isCodRequested ? Number(b.cod_charges || 0) : 0)));
                        return rateA - rateB;
                    })[0];
                }
            }

            const applicableRate = selectedCourier
                ? Number(selectedCourier.rate ?? (Number(selectedCourier.freight_charge || 0) + (isCodRequested ? Number(selectedCourier.cod_charges || 0) : 0)))
                : 0;

            const quoteResult = {
                providerName: this.name,
                isServiceable,
                isCodAvailable: codAvailableAny,
                applicableRate: parseFloat(Math.max(0, applicableRate).toFixed(2)),
                selectedCourier: selectedCourier ? {
                    courierCompanyId: selectedCourier.courier_company_id || selectedCourier.id,
                    courierName: selectedCourier.courier_name,
                    rate: parseFloat(Number(selectedCourier.rate || applicableRate).toFixed(2)),
                    freightCharge: Number(selectedCourier.freight_charge || 0),
                    codCharges: Number(selectedCourier.cod_charges || 0),
                    etd: selectedCourier.etd || null,
                    estimatedDays: selectedCourier.estimated_delivery_days || null,
                    rating: selectedCourier.rating || null,
                } : null,
                recommendedCourier: recommendedId,
                availableCouriers,
                rawResponse: res
            };

            // Save in cache for 5 minutes
            this._quoteCache.set(cacheKey, {
                data: quoteResult,
                expiresAt: Date.now() + 5 * 60 * 1000
            });

            return quoteResult;
        } catch (err) {
            throw new ProviderError('QUOTE_FAILED', err.message, err);
        }
    }

    mapStatus(providerStatus) {
        return mapShiprocketStatusToCanonical(providerStatus);
    }

    verifyWebhookSignature(rawBody, headers) {
        return verifyShiprocketWebhookSignature(rawBody, headers);
    }

    parseWebhookPayload(rawBody, headers) {
        return parseShiprocketWebhookPayload(rawBody, headers);
    }
}

export const shiprocketProvider = new ShiprocketDeliveryProvider();
export default shiprocketProvider;
