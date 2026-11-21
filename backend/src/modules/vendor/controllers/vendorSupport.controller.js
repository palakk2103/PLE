import Vendor from '../../../models/Vendor.model.js';
import ManagedVendorUser from '../../../models/ManagedVendorUser.model.js';
import { makeRequesterSupportController } from '../../../services/supportTicket.service.js';

// Vendors and managed vendors raise tickets to PLE support (stored on SupportTicket.vendorId).
export default makeRequesterSupportController({
    ownerField: 'vendorId',
    senderType: 'vendor',
    requesterType: 'vendor',
    getProfile: async (req) => {
        const id = req.user.id;
        const v = (await Vendor.findById(id).select('storeName name email').lean())
            || (await ManagedVendorUser.findById(id).select('name companyName email').lean());
        return { name: v?.storeName || v?.companyName || v?.name || 'Vendor', email: v?.email || '' };
    },
});
