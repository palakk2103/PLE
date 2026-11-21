import DeliveryBoy from '../../../models/DeliveryBoy.model.js';
import { makeRequesterSupportController } from '../../../services/supportTicket.service.js';

// Delivery partners raise tickets to PLE support (stored on SupportTicket.deliveryBoyId).
export default makeRequesterSupportController({
    ownerField: 'deliveryBoyId',
    senderType: 'delivery',
    requesterType: 'delivery',
    getProfile: async (req) => {
        const d = await DeliveryBoy.findById(req.user.id).select('name email').lean();
        return { name: d?.name || 'Delivery partner', email: d?.email || '' };
    },
});
