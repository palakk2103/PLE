import deliveryProviderRegistry from '../deliveryProviderRegistry.js';
import { DeliveryShipment } from '../../../models/DeliveryShipment.model.js';
import { Order } from '../../../models/Order.model.js';
import { handleOrderStatusTransition } from '../../../services/orderStatus.service.js';

export async function processDeliveryWebhook(providerName, rawBody, headers) {
    const provider = deliveryProviderRegistry.getProvider(providerName);

    // Verify webhook signature
    const isValid = provider.verifyWebhookSignature(rawBody, headers);
    if (!isValid) {
        const err = new Error('Invalid webhook signature');
        err.statusCode = 401;
        throw err;
    }

    // Parse payload into standard object
    const parsed = provider.parseWebhookPayload(rawBody, headers);
    const { orderId, externalShipmentId, awbCode, providerStatus, courierName, etd, location, activity, rawPayload } = parsed;

    if (!orderId && !externalShipmentId && !awbCode) {
        return { processed: true, message: 'Webhook received. No shipment identifiers provided (test ping).' };
    }

    // Build query to find matching DeliveryShipment
    const queryConditions = [];
    if (orderId) queryConditions.push({ orderId: String(orderId) });
    if (externalShipmentId) queryConditions.push({ externalShipmentId: String(externalShipmentId) });
    if (awbCode) queryConditions.push({ awbCode: String(awbCode) });

    const query = { $or: queryConditions };

    const shipmentDoc = await DeliveryShipment.findOne(query);

    const canonicalStatus = provider.mapStatus(providerStatus);

    if (shipmentDoc) {
        // Append event log and timeline
        shipmentDoc.rawProviderStatus = providerStatus || shipmentDoc.rawProviderStatus;
        if (courierName) shipmentDoc.courierName = courierName;
        if (etd) shipmentDoc.etaTimestamp = etd;
        if (awbCode) shipmentDoc.awbCode = awbCode;

        if (canonicalStatus) {
            shipmentDoc.status = canonicalStatus;
        }

        shipmentDoc.timeline.push({
            status: providerStatus || 'UPDATE',
            activity: activity || `Status update: ${providerStatus}`,
            location: location || '',
            timestamp: new Date(),
            raw: rawPayload
        });

        shipmentDoc.webhookLogs.push({
            receivedAt: new Date(),
            payload: rawPayload,
            processed: true
        });

        await shipmentDoc.save();

        // Sync order status if matching order found
        if (canonicalStatus) {
            const orderDoc = await Order.findOne({ orderId: shipmentDoc.orderId });
            if (orderDoc) {
                if (awbCode && !orderDoc.trackingNumber) {
                    orderDoc.trackingNumber = awbCode;
                }
                await handleOrderStatusTransition(orderDoc, canonicalStatus, {
                    updatedByRole: 'system',
                    note: `Carrier update (${providerName}): ${providerStatus || canonicalStatus}`,
                    notifyCustomer: true,
                });
            }
        }
    } else {
        // Create unlinked / standalone shipment record for auditing
        await DeliveryShipment.create({
            orderId: orderId || `UNKNOWN-${Date.now()}`,
            providerName: provider.name,
            externalShipmentId,
            awbCode,
            rawProviderStatus: providerStatus,
            courierName,
            status: canonicalStatus || 'pending',
            timeline: [{
                status: providerStatus || 'UNKNOWN',
                activity: activity || 'Received webhook update for unlinked shipment',
                location: location || '',
                timestamp: new Date(),
                raw: rawPayload
            }],
            webhookLogs: [{
                receivedAt: new Date(),
                payload: rawPayload,
                processed: true
            }]
        });
    }

    return {
        processed: true,
        orderId,
        canonicalStatus,
        providerStatus
    };
}
