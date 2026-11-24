import crypto from 'crypto';

// True when the payload carries any shipment identifier, i.e. it would change data.
const payloadHasIdentifiers = (rawBody) => {
    let payload = rawBody;
    if (typeof rawBody === 'string' || Buffer.isBuffer(rawBody)) {
        try { payload = JSON.parse(rawBody.toString('utf-8')); } catch { payload = {}; }
    }
    return Boolean(
        payload && (payload.order_id || payload.channel_order_id || payload.custom_order_id ||
            payload.shipment_id || payload.awb || payload.awb_code || payload.courier_awb)
    );
};

export function verifyShiprocketWebhookSignature(rawBody, headers = {}) {
    const expectedToken = process.env.SHIPROCKET_WEBHOOK_TOKEN;
    if (!expectedToken) {
        // No secret configured: never accept data-changing webhooks in production (anyone could
        // forge a "delivered" update). Harmless identifier-less probes are still allowed.
        if (process.env.NODE_ENV === 'production' && payloadHasIdentifiers(rawBody)) {
            console.warn('[Shiprocket webhook] SHIPROCKET_WEBHOOK_TOKEN is not set — rejecting webhook.');
            return false;
        }
        return true;
    }

    // Normalize headers for case-insensitive lookup
    const normalized = {};
    for (const [k, v] of Object.entries(headers || {})) {
        normalized[k.toLowerCase()] = v;
    }

    const headerToken =
        normalized['x-api-key'] ||
        normalized['x-shiprocket-token'] ||
        normalized['x-shiprocket-signature'] ||
        normalized['authorization'] ||
        normalized['token'];

    if (!headerToken) {
        // A token is configured, so a request without one may only be a harmless probe/handshake
        // (no shipment identifiers). Anything that could change an order MUST carry the token.
        return !payloadHasIdentifiers(rawBody);
    }

    const incoming = String(headerToken).replace(/^Bearer\s+/i, '').trim();
    const expected = String(expectedToken).trim();

    if (incoming === expected) return true;

    try {
        const bufA = Buffer.from(incoming);
        const bufB = Buffer.from(expected);
        if (bufA.length === bufB.length) {
            return crypto.timingSafeEqual(bufA, bufB);
        }
    } catch {
        // fallback
    }

    return false;
}

export function parseShiprocketWebhookPayload(rawBody, headers) {
    let payload = rawBody;
    if (typeof rawBody === 'string' || Buffer.isBuffer(rawBody)) {
        try {
            payload = JSON.parse(rawBody.toString('utf-8'));
        } catch {
            payload = {};
        }
    }

    const orderId = payload.order_id || payload.channel_order_id || payload.custom_order_id;
    const externalShipmentId = payload.shipment_id ? String(payload.shipment_id) : null;
    const awbCode = payload.awb || payload.awb_code || payload.courier_awb;
    const currentStatus = payload.current_status || payload.status;
    const courierName = payload.courier_name;
    const etd = payload.etd;

    return {
        orderId: orderId ? String(orderId) : null,
        externalShipmentId,
        awbCode: awbCode ? String(awbCode) : null,
        providerStatus: currentStatus ? String(currentStatus) : null,
        courierName: courierName || null,
        etd: etd ? new Date(etd) : null,
        location: payload.current_timestamp_location || payload.location || '',
        activity: payload.scans || payload.activity || '',
        rawPayload: payload
    };
}
