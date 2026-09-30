import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import RFQ from '../../../models/RFQ.model.js';
import B2BCompany from '../../../models/B2BCompany.model.js';
import User from '../../../models/User.model.js';
import PurchaseOrder from '../../../models/PurchaseOrder.model.js';
import Order from '../../../models/Order.model.js';
import Vendor from '../../../models/Vendor.model.js';
import Product from '../../../models/Product.model.js';
import DirectRFQ from '../../../models/DirectRFQ.model.js';
import Category from '../../../models/Category.model.js';
import { createNotification } from '../../../services/notification.service.js';
import {
    uploadLocalFileToCloudinaryAndCleanup,
    cleanupLocalFiles
} from '../../../services/upload.service.js';
import { getIO } from '../../../config/socket.js';

// Helper to get company ID from request
const getCompanyId = async (req) => {
    let companyId = req.user.companyId;
    if (!companyId) {
        const admin = await User.findById(req.user.id);
        if (admin) companyId = admin.companyId;
    }
    if (!companyId) throw new ApiError(404, 'Admin not found or company ID missing.');
    return companyId;
};

// Generate a random RFQ ID
const generateRfqId = () => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    return `RFQ-${dateStr}-${randomDigits}`;
};

// Generate a random PO ID
const generatePoId = () => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    return `PO-${dateStr}-${randomDigits}`;
};

// GET /api/b2b-user/admin/vendors
export const getVendorsForSourcing = asyncHandler(async (req, res) => {
    const vendors = await Vendor.find({ status: 'approved' }).lean().select('name storeName email phone companyName');
    
    // Attach categories each vendor sells in
    const vendorsWithCategories = await Promise.all(vendors.map(async (vendor) => {
        const products = await Product.find({ vendorId: vendor._id }).populate('categoryId', 'name').lean();
        const categories = [...new Set(products.map(p => p.categoryId?.name).filter(Boolean))];
        return { ...vendor, categories };
    }));

    res.status(200).json(new ApiResponse(200, { vendors: vendorsWithCategories }, 'Fetched sourcing vendors.'));
});

// GET /api/b2b-user/admin/rfq
export const getRFQs = asyncHandler(async (req, res) => {
    const companyId = await getCompanyId(req);
    const filter = { companyId };
    if (req.user.role === 'b2bEmployee') {
        filter.createdByEmployeeId = req.user.id;
    }
    const rfqs = await RFQ.find(filter)
        .populate('productId', 'name image price')
        .populate('assignedVendorIds', 'storeName name email phone')
        .populate('createdByEmployeeId', 'name email')
        .populate('createdByAdminId', 'name email')
        .sort({ createdAt: -1 });

    const processedRfqs = rfqs.map(rfq => {
        const rfqObj = rfq.toObject();
        if (['Awaiting B2B Approval', 'Vendor Selected', 'Approved', 'Purchase Order Generated', 'Completed'].includes(rfqObj.status)) {
            rfqObj.quotations = rfqObj.quotations.filter(q => q.status === 'Selected');
        } else {
            rfqObj.quotations = [];
        }
        return rfqObj;
    });

    res.status(200).json(new ApiResponse(200, processedRfqs, 'Company RFQs fetched successfully.'));
});

// GET /api/b2b-user/admin/rfq/stats
export const getRFQStats = asyncHandler(async (req, res) => {
    const companyId = await getCompanyId(req);
    const filter = { companyId };
    if (req.user.role === 'b2bEmployee') {
        filter.createdByEmployeeId = req.user.id;
    }
    const rfqs = await RFQ.find(filter);

    const stats = {
        total: rfqs.length,
        pending: rfqs.filter(r => ['Submitted', 'Under Review', 'Sent To Vendors', 'Quotations Received', 'Vendor Evaluation', 'Vendor Negotiation', 'Vendor Selected', 'Awaiting B2B Approval'].includes(r.status)).length,
        underReview: rfqs.filter(r => ['Under Review', 'Vendor Evaluation', 'Vendor Negotiation', 'Vendor Selected'].includes(r.status)).length,
        quotationsReceived: rfqs.filter(r => ['Sent To Vendors', 'Quotations Received', 'Vendor Evaluation', 'Vendor Negotiation'].includes(r.status)).length,
        approved: rfqs.filter(r => ['Vendor Selected', 'Awaiting B2B Approval', 'Purchase Order Generated', 'Completed'].includes(r.status)).length,
        ordersGenerated: rfqs.filter(r => r.status === 'Purchase Order Generated' || r.status === 'Completed').length
    };

    res.status(200).json(new ApiResponse(200, stats, 'RFQ stats fetched successfully.'));
});

// GET /api/b2b-user/admin/rfq/:id
export const getRFQDetail = asyncHandler(async (req, res) => {
    const companyId = await getCompanyId(req);
    const filter = { _id: req.params.id, companyId };
    if (req.user.role === 'b2bEmployee') {
        filter.createdByEmployeeId = req.user.id;
    }
    const rfq = await RFQ.findOne(filter)
        .populate('productId', 'name image price unit stockQuantity')
        .populate('assignedVendorIds', 'storeName name email phone')
        .populate('createdByEmployeeId', 'name email')
        .populate('createdByAdminId', 'name email');

    if (!rfq) {
        throw new ApiError(404, 'RFQ not found.');
    }

    const rfqObj = rfq.toObject();
    if (['Awaiting B2B Approval', 'Vendor Selected', 'Approved', 'Purchase Order Generated', 'Completed'].includes(rfqObj.status)) {
        rfqObj.quotations = rfqObj.quotations.filter(q => q.status === 'Selected');
    } else {
        rfqObj.quotations = [];
    }

    res.status(200).json(new ApiResponse(200, rfqObj, 'RFQ details fetched successfully.'));
});

// POST /api/b2b-user/admin/rfq
export const createRFQ = asyncHandler(async (req, res) => {
    const companyId = await getCompanyId(req);
    const company = await B2BCompany.findById(companyId);
    if (!company) {
        throw new ApiError(404, 'Company not found.');
    }

    const {
        title,
        category,
        priority,
        productId,
        customProductName,
        quantity,
        targetPrice,
        requirementDetails,
        qualityStandards,
        termsConditions,
        expectedDeliveryDate,
        attachment,
        status // 'Draft' or 'Submitted'
    } = req.body;

    if (!quantity || !targetPrice) {
        throw new ApiError(400, 'Quantity and target rate/price are required.');
    }

    let productName = customProductName || 'Custom Product';
    if (productId) {
        const product = await Product.findById(productId);
        if (product) productName = product.name;
    }

    const initialStatus = status === 'Submitted' ? 'Submitted' : 'Draft';

    const rfqVal = {
        rfqId: generateRfqId(),
        companyId,
        companyName: company.companyName,
        productId: productId || undefined,
        customProductName: productId ? undefined : productName,
        quantity,
        targetPrice,
        requirementDetails,
        qualityStandards,
        termsConditions,
        expectedDeliveryDate,
        attachment,
        priority: priority || 'Medium',
        category: category || 'General',
        status: initialStatus,
        quotations: [],
        negotiationMessages: [],
        approvalHistory: []
    };

    if (req.user.role === 'b2bAdmin') {
        rfqVal.createdByAdminId = req.user.id;
    } else {
        rfqVal.createdByEmployeeId = req.user.id;
    }

    // Add creation to history
    rfqVal.approvalHistory.push({
        status: initialStatus,
        action: initialStatus === 'Submitted' ? 'RFQ Created & Submitted' : 'RFQ Created (Draft)',
        updatedBy: req.user.id,
        updaterType: req.user.role === 'b2bAdmin' ? 'b2bAdmin' : 'b2bEmployee',
        notes: requirementDetails || 'Initial RFQ created.'
    });

    const rfq = await RFQ.create(rfqVal);

    if (initialStatus === 'Submitted') {
        // Notify Super Admin
        await createNotification({
            recipientType: 'admin',
            title: 'New B2B RFQ Submitted',
            message: `A new B2B RFQ ${rfq.rfqId} has been submitted by ${company.companyName} for review.`,
            type: 'system',
            data: { rfqId: rfq.rfqId, id: String(rfq._id) }
        });
    }

    res.status(201).json(new ApiResponse(201, rfq, 'RFQ created successfully.'));
});

// PUT /api/b2b-user/admin/rfq/:id
export const updateRFQ = asyncHandler(async (req, res) => {
    const companyId = await getCompanyId(req);
    const filterRfq = { _id: req.params.id, companyId };
    if (req.user.role === 'b2bEmployee') {
        filterRfq.createdByEmployeeId = req.user.id;
    }
    const rfq = await RFQ.findOne(filterRfq);

    if (!rfq) {
        throw new ApiError(404, 'RFQ not found.');
    }

    if (rfq.status !== 'Draft' && rfq.status !== 'Submitted') {
        throw new ApiError(400, 'Cannot edit an RFQ that is already under review or processed.');
    }

    const {
        title,
        category,
        priority,
        productId,
        customProductName,
        quantity,
        targetPrice,
        requirementDetails,
        qualityStandards,
        termsConditions,
        expectedDeliveryDate,
        attachment
    } = req.body;

    let productName = customProductName || rfq.customProductName;
    if (productId && productId !== String(rfq.productId)) {
        const product = await Product.findById(productId);
        if (product) productName = product.name;
    }

    rfq.productId = productId || rfq.productId;
    rfq.customProductName = productId ? undefined : productName;
    rfq.quantity = quantity || rfq.quantity;
    rfq.targetPrice = targetPrice || rfq.targetPrice;
    rfq.requirementDetails = requirementDetails || rfq.requirementDetails;
    rfq.qualityStandards = qualityStandards !== undefined ? qualityStandards : rfq.qualityStandards;
    rfq.termsConditions = termsConditions !== undefined ? termsConditions : rfq.termsConditions;
    rfq.expectedDeliveryDate = expectedDeliveryDate || rfq.expectedDeliveryDate;
    rfq.attachment = attachment || rfq.attachment;
    rfq.priority = priority || rfq.priority;
    rfq.category = category || rfq.category;

    await rfq.save();

    res.status(200).json(new ApiResponse(200, rfq, 'RFQ updated successfully.'));
});

// POST /api/b2b-user/admin/rfq/:id/submit
export const submitRFQ = asyncHandler(async (req, res) => {
    const companyId = await getCompanyId(req);
    const filterRfq = { _id: req.params.id, companyId };
    if (req.user.role === 'b2bEmployee') {
        filterRfq.createdByEmployeeId = req.user.id;
    }
    const rfq = await RFQ.findOne(filterRfq);

    if (!rfq) {
        throw new ApiError(404, 'RFQ not found.');
    }

    if (rfq.status !== 'Draft') {
        throw new ApiError(400, 'Only Draft RFQs can be submitted.');
    }

    rfq.status = 'Submitted';
    rfq.approvalHistory.push({
        status: 'Submitted',
        action: 'RFQ Submitted',
        updatedBy: req.user.id,
        updaterType: req.user.role === 'b2bAdmin' ? 'b2bAdmin' : 'b2bEmployee',
        notes: 'Submitted to Super Admin for review.'
    });

    await rfq.save();

    const io = getIO();
    io.to(`rfq_${rfq._id}`).emit('status_update', { rfqId: rfq._id, status: rfq.status });

    // Notify Super Admin
    await createNotification({
        recipientType: 'admin',
        title: 'B2B RFQ Submitted',
        message: `B2B RFQ ${rfq.rfqId} has been submitted by ${rfq.companyName}.`,
        type: 'system',
        data: { rfqId: rfq.rfqId, id: String(rfq._id) }
    });

    res.status(200).json(new ApiResponse(200, rfq, 'RFQ submitted successfully.'));
});

// POST /api/b2b-user/admin/rfq/:id/withdraw
export const withdrawRFQ = asyncHandler(async (req, res) => {
    const companyId = await getCompanyId(req);
    const filterRfq = { _id: req.params.id, companyId };
    if (req.user.role === 'b2bEmployee') {
        filterRfq.createdByEmployeeId = req.user.id;
    }
    const rfq = await RFQ.findOne(filterRfq);

    if (!rfq) {
        throw new ApiError(404, 'RFQ not found.');
    }

    if (!['Submitted', 'Under Super Admin Review', 'Negotiation In Progress'].includes(rfq.status)) {
        throw new ApiError(400, 'Cannot withdraw RFQ in current status.');
    }

    rfq.status = 'Draft';
    rfq.approvalHistory.push({
        status: 'Draft',
        action: 'RFQ Withdrawn',
        updatedBy: req.user.id,
        updaterType: req.user.role === 'b2bAdmin' ? 'b2bAdmin' : 'b2bEmployee',
        notes: 'RFQ withdrawn back to draft state.'
    });

    await rfq.save();

    const io = getIO();
    io.to(`rfq_${rfq._id}`).emit('status_update', { rfqId: rfq._id, status: rfq.status });

    res.status(200).json(new ApiResponse(200, rfq, 'RFQ withdrawn successfully.'));
});

// POST /api/b2b-user/admin/rfq/:id/message
export const sendDiscussionMessage = asyncHandler(async (req, res) => {
    const companyId = await getCompanyId(req);
    const filterRfq = { _id: req.params.id, companyId };
    if (req.user.role === 'b2bEmployee') {
        filterRfq.createdByEmployeeId = req.user.id;
    }
    const rfq = await RFQ.findOne(filterRfq);

    if (!rfq) {
        throw new ApiError(404, 'RFQ not found.');
    }

    const { message, attachments, isInternalNote } = req.body;
    if (!message) {
        throw new ApiError(400, 'Message body is required.');
    }

    // Resolve sender name
    let senderName = 'B2B User';
    const user = await User.findById(req.user.id);
    if (user) {
        senderName = user.name;
    }

    rfq.negotiationMessages.push({
        senderId: req.user.id,
        senderType: req.user.role === 'b2bAdmin' ? 'b2bAdmin' : 'b2bEmployee',
        senderName,
        message,
        attachments: attachments || [],
        isInternalNote: !!isInternalNote
    });

    await rfq.save();

    // Notify Super Admin (unless it is an internal note)
    if (!isInternalNote) {
        await createNotification({
            recipientType: 'admin',
            title: 'New B2B RFQ Message',
            message: `New message on RFQ ${rfq.rfqId} from ${senderName} (${rfq.companyName}).`,
            type: 'system',
            data: { rfqId: rfq.rfqId, id: String(rfq._id) }
        });
    }

    const savedMessage = rfq.negotiationMessages[rfq.negotiationMessages.length - 1];

    // Emit socket event
    const io = getIO();
    io.to(`rfq_${rfq._id}`).emit('new_internal_message', { rfqId: rfq._id, message: savedMessage });

    res.status(200).json(new ApiResponse(200, savedMessage, 'Message sent successfully.'));
});

// POST /api/b2b-user/admin/rfq/:id/confirm-quote
export const confirmQuote = asyncHandler(async (req, res) => {
    const companyId = await getCompanyId(req);
    let rfq = await RFQ.findOne({ _id: req.params.id, companyId }).populate('productId');
    let isDirect = false;
    let directRfq = null;

    if (!rfq) {
        directRfq = await DirectRFQ.findOne({ _id: req.params.id, companyId }).populate('productId');
        if (!directRfq) {
            throw new ApiError(404, 'RFQ not found.');
        }

        // Allowed statuses for Direct RFQ approval
        if (!['Vendor Accepted', 'Pending Admin Approval', 'PO Generated'].includes(directRfq.status)) {
            throw new ApiError(400, 'Direct RFQ is not accepted by the vendor or awaiting admin approval.');
        }
        isDirect = true;
    }

    if (!isDirect && !['Awaiting B2B Approval', 'Vendor Selected', 'Approved', 'Purchase Order Generated'].includes(rfq.status)) {
        throw new ApiError(400, 'No selected vendor quotation is awaiting final confirmation.');
    }

    const company = await B2BCompany.findById(companyId);
    if (!company) {
        throw new ApiError(404, 'Company details not found.');
    }

    let vendor = null;

    if (isDirect) {
        vendor = await Vendor.findById(directRfq.vendorId);
        if (!vendor) {
            throw new ApiError(404, 'Vendor not found.');
        }

        // Avoid duplicate dummy RFQs
        let existingDummyRfq = await RFQ.findOne({ rfqId: directRfq.directRfqId });
        if (existingDummyRfq) {
            rfq = existingDummyRfq;
        } else {
            rfq = await RFQ.create({
                rfqId: directRfq.directRfqId,
                companyId: directRfq.companyId,
                companyName: company.companyName,
                createdByAdminId: req.user.id, // B2B Admin approving it
                createdByEmployeeId: directRfq.employeeId, // Track the employee who created the direct RFQ
                productId: directRfq.productId?._id || directRfq.productId,
                customProductName: directRfq.customProductName || 'Direct RFQ Product',
                category: directRfq.category || 'Direct Sourcing',
                quantity: directRfq.quantity,
                targetPrice: directRfq.targetPrice,
                expectedDeliveryDate: directRfq.expectedDeliveryDate,
                status: 'Purchase Order Generated',
                quotations: [{
                    vendorId: directRfq.vendorId,
                    vendorName: vendor.storeName || vendor.name || 'Vendor',
                    unitPrice: directRfq.finalAgreedPrice || directRfq.targetPrice,
                    totalPrice: (directRfq.finalAgreedPrice || directRfq.targetPrice) * directRfq.quantity,
                    deliveryTime: directRfq.expectedDeliveryDate ? new Date(directRfq.expectedDeliveryDate).toLocaleDateString() : 'Flexible',
                    status: 'Selected'
                }]
            });
        }

        // Also update DirectRFQ status
        directRfq.status = 'PO Generated';
        await directRfq.save();
    }

    // Find the quote that was selected by the admin (fallback to any submitted/highest quote)
    let selectedQuote = rfq.quotations.find(q => q.status === 'Selected');
    if (!selectedQuote) {
        // Fallback: pick the quotation with lowest total price (best deal) among submitted ones
        const submittedQuotes = rfq.quotations.filter(q => ['Submitted', 'Negotiating'].includes(q.status));
        if (submittedQuotes.length > 0) {
            selectedQuote = submittedQuotes.reduce((best, q) =>
                (!best || q.totalPrice < best.totalPrice) ? q : best, null
            );
            // Mark it as Selected
            selectedQuote.status = 'Selected';
        }
    }
    if (!selectedQuote) {
        throw new ApiError(400, 'No quotation found in this RFQ. Vendor must submit a quotation first.');
    }

    if (!vendor) {
        vendor = await Vendor.findById(selectedQuote.vendorId);
        if (!vendor) {
            throw new ApiError(404, 'Selected vendor not found.');
        }
    }

    const b2bAdmin = await User.findById(req.user.id);
    const adminName = b2bAdmin ? b2bAdmin.name : 'B2B Admin';

    // Pricing details
    const subtotal = selectedQuote.totalPrice;
    const tax = selectedQuote.taxDetails ? parseFloat(selectedQuote.taxDetails) || 0 : 0;
    const total = subtotal + tax;

    // Create Purchase Order
    const poNumber = generatePoId();
    const po = await PurchaseOrder.create({
        poNumber,
        rfqId: rfq._id,
        companyId,
        companyDetails: {
            name: company.companyName,
            email: company.businessEmail,
            phone: company.businessPhone,
            address: company.companyAddress,
            gstin: company.gstNumber
        },
        vendorId: vendor._id,
        vendorDetails: {
            storeName: vendor.storeName || 'Vendor Store',
            name: vendor.name,
            email: vendor.email,
            phone: vendor.phone || '9876543210'
        },
        productId: rfq.productId?._id || undefined,
        productDetails: {
            name: rfq.productId?.name || rfq.customProductName || 'Product',
            qty: rfq.quantity,
            unitPrice: selectedQuote.unitPrice,
            totalPrice: subtotal
        },
        terms: {
            warranty: selectedQuote.warranty || '1 Year Standard',
            paymentTerms: 'NET 30 Days',
            deliveryTerms: 'FOB Origin',
            termsConditions: 'All goods must comply with provided specifications.'
        },
        pricing: {
            subtotal,
            tax,
            total
        },
        deliveryInformation: {
            expectedDeliveryDate: rfq.expectedDeliveryDate,
            shippingAddress: company.companyAddress
        },
        status: 'Sent'
    });

    // Update RFQ Status
    rfq.status = 'Purchase Order Generated';
    rfq.approvalHistory.push({
        status: 'Purchase Order Generated',
        action: 'Quotation Confirmed & PO Generated',
        updatedBy: req.user.id,
        updaterType: 'b2bAdmin',
        notes: `Selected quotation confirmed by B2B Admin ${adminName}. Generated Purchase Order: ${poNumber}`
    });

    await rfq.save();

    const io = getIO();
    io.to(`rfq_${rfq._id}`).emit('status_update', { rfqId: rfq._id, status: rfq.status });

    // Deduct stock if product exists in platform catalog
    if (rfq.productId && rfq.productId.stockQuantity !== undefined) {
        rfq.productId.stockQuantity = Math.max(0, rfq.productId.stockQuantity - rfq.quantity);
        await rfq.productId.save();
    }

    // Send notifications to Super Admin and Vendor
    await createNotification({
        recipientType: 'admin',
        title: 'RFQ Confirmed & PO Generated',
        message: `B2B Admin confirmed RFQ ${rfq.rfqId}. PO ${poNumber} has been generated.`,
        type: 'system',
        data: { rfqId: rfq.rfqId, poNumber }
    });

    await createNotification({
        recipientId: vendor._id,
        recipientType: 'vendor',
        title: 'New Purchase Order Received',
        message: `You have received Purchase Order ${poNumber} for RFQ ${rfq.rfqId}.`,
        type: 'system',
        data: { rfqId: rfq.rfqId, poNumber }
    });

    res.status(201).json(new ApiResponse(201, { rfq, po }, 'Quotation confirmed and Purchase Order generated successfully.'));
});

// POST /api/b2b-user/admin/rfq/:id/reject
export const rejectRFQRecommendation = asyncHandler(async (req, res) => {
    const companyId = await getCompanyId(req);
    const filterRfq = { _id: req.params.id, companyId };
    if (req.user.role === 'b2bEmployee') {
        filterRfq.createdByEmployeeId = req.user.id;
    }
    const rfq = await RFQ.findOne(filterRfq);

    if (!rfq) {
        throw new ApiError(404, 'RFQ not found.');
    }

    if (!['Awaiting B2B Approval', 'Vendor Selected', 'Approved'].includes(rfq.status)) {
        throw new ApiError(400, 'RFQ must be awaiting B2B approval to reject recommendation.');
    }

    const selectedQuote = rfq.quotations.find(q => q.status === 'Selected');
    if (selectedQuote) {
        selectedQuote.status = 'Submitted';
    }

    rfq.status = 'Vendor Evaluation';
    rfq.approvalHistory.push({
        status: 'Vendor Evaluation',
        action: 'Vendor Recommendation Rejected',
        updatedBy: req.user.id,
        updaterType: 'b2bAdmin',
        notes: req.body.notes || 'B2B Admin rejected the vendor recommendation.'
    });

    await rfq.save();

    const io = getIO();
    io.to(`rfq_${rfq._id}`).emit('status_update', { rfqId: rfq._id, status: rfq.status });

    // Notify Super Admin
    await createNotification({
        recipientType: 'admin',
        title: 'Vendor Recommendation Rejected',
        message: `B2B Admin rejected the recommended quote for RFQ ${rfq.rfqId}. Sent back for evaluation.`,
        type: 'system',
        data: { rfqId: rfq.rfqId, id: String(rfq._id) }
    });

    res.status(200).json(new ApiResponse(200, rfq, 'Quotation recommendation rejected and returned to evaluation.'));
});

// POST /api/b2b-user/admin/rfq/:id/request-renegotiation
export const requestRenegotiation = asyncHandler(async (req, res) => {
    const companyId = await getCompanyId(req);
    const filterRfq = { _id: req.params.id, companyId };
    if (req.user.role === 'b2bEmployee') {
        filterRfq.createdByEmployeeId = req.user.id;
    }
    const rfq = await RFQ.findOne(filterRfq);

    if (!rfq) {
        throw new ApiError(404, 'RFQ not found.');
    }

    if (!['Awaiting B2B Approval', 'Vendor Selected', 'Approved'].includes(rfq.status)) {
        throw new ApiError(400, 'RFQ must be awaiting B2B approval to request renegotiation.');
    }

    const { message } = req.body;
    if (!message) {
        throw new ApiError(400, 'Re-negotiation note / message is required.');
    }

    const selectedQuote = rfq.quotations.find(q => q.status === 'Selected');
    if (selectedQuote) {
        selectedQuote.status = 'Submitted';
    }

    rfq.status = 'Vendor Negotiation';
    rfq.approvalHistory.push({
        status: 'Vendor Negotiation',
        action: 'Re-negotiation Requested',
        updatedBy: req.user.id,
        updaterType: 'b2bAdmin',
        notes: message
    });

    // Add discussion message
    rfq.negotiationMessages.push({
        senderId: req.user.id,
        senderType: 'b2bAdmin',
        senderName: 'B2B Admin',
        message: `Requested re-negotiation. Reason/Notes: ${message}`,
        isInternalNote: false
    });

    await rfq.save();

    const io = getIO();
    io.to(`rfq_${rfq._id}`).emit('status_update', { rfqId: rfq._id, status: rfq.status });

    // Notify Super Admin
    await createNotification({
        recipientType: 'admin',
        title: 'Re-negotiation Requested by B2B Admin',
        message: `B2B Admin requested re-negotiation for RFQ ${rfq.rfqId}.`,
        type: 'system',
        data: { rfqId: rfq.rfqId, id: String(rfq._id) }
    });

    res.status(200).json(new ApiResponse(200, rfq, 'Re-negotiation request submitted successfully.'));
});

// GET /api/b2b-user/admin/purchase-orders
export const getPurchaseOrders = asyncHandler(async (req, res) => {
    const companyId = await getCompanyId(req);
    const company = await B2BCompany.findById(companyId);

    // Auto-sync any direct B2B orders belonging to this company/users that don't have POs yet
    try {
        const companyUsers = await User.find({ 
            $or: [{ companyId }, { _id: req.user.id }] 
        }).select('_id');
        const userIds = companyUsers.map(u => u._id);

        const directOrders = await Order.find({
            $or: [
                { userId: { $in: userIds } },
                { orderType: 'b2b' }
            ]
        }).lean();

        for (const ord of directOrders) {
            const isCompanyOrder = userIds.some(id => String(id) === String(ord.userId)) ||
                (ord.shippingAddress?.email && company?.businessEmail && ord.shippingAddress.email.toLowerCase() === company.businessEmail.toLowerCase());
            
            if (!isCompanyOrder) continue;

            const existingPo = await PurchaseOrder.findOne({ orderId: ord._id });
            if (!existingPo && ord.vendorItems && ord.vendorItems.length > 0) {
                for (const group of ord.vendorItems) {
                    for (const itm of group.items) {
                        const vendorDoc = await Vendor.findById(group.vendorId);
                        const poDateStr = (ord.createdAt ? new Date(ord.createdAt) : new Date()).toISOString().slice(0, 10).replace(/-/g, '');
                        const randomDigits = Math.floor(1000 + Math.random() * 9000);
                        const poNumber = `PO-${poDateStr}-${randomDigits}`;

                        await PurchaseOrder.create({
                            poNumber,
                            companyId,
                            orderId: ord._id,
                            orderNumber: ord.orderId,
                            sourceType: 'DirectPurchase',
                            companyDetails: {
                                name: company?.companyName || ord.shippingAddress?.name || 'B2B Procurement Buyer',
                                email: company?.businessEmail || ord.shippingAddress?.email || '',
                                phone: company?.businessPhone || ord.shippingAddress?.phone || '',
                                address: company?.companyAddress || (ord.shippingAddress ? `${ord.shippingAddress.address || ''}, ${ord.shippingAddress.city || ''}, ${ord.shippingAddress.state || ''}` : 'Address on File'),
                                gstin: company?.gstNumber || ''
                            },
                            vendorId: group.vendorId,
                            vendorDetails: {
                                storeName: vendorDoc?.storeName || group.vendorName || 'Vendor Store',
                                name: vendorDoc?.name || group.vendorName || 'Vendor Representative',
                                email: vendorDoc?.email || '',
                                phone: vendorDoc?.phone || '9876543210'
                            },
                            productId: itm.productId,
                            productDetails: {
                                name: itm.name,
                                qty: itm.quantity,
                                unitPrice: itm.price,
                                totalPrice: itm.price * itm.quantity
                            },
                            terms: {
                                warranty: 'Standard Warranty',
                                paymentTerms: ord.paymentMethod === 'wallet' ? 'Wallet Paid' : 'Direct B2B Checkout',
                                deliveryTerms: 'Standard Delivery',
                                termsConditions: 'Direct Wholesale Order from Platform.'
                            },
                            pricing: {
                                subtotal: itm.taxableAmount || (itm.price * itm.quantity),
                                tax: itm.gstAmount || 0,
                                total: (itm.price * itm.quantity) + (itm.gstAmount || 0)
                            },
                            deliveryInformation: {
                                shippingAddress: ord.shippingAddress ? `${ord.shippingAddress.address || ''}, ${ord.shippingAddress.city || ''}, ${ord.shippingAddress.state || ''} - ${ord.shippingAddress.zipCode || ''}` : 'Default Shipping'
                            },
                            status: ord.status === 'cancelled' ? 'Cancelled' : (ord.status === 'delivered' ? 'Completed' : 'Approved'),
                            paymentStatus: ord.paymentStatus === 'paid' ? 'Paid' : 'Unpaid',
                            paymentMethod: ord.paymentMethod === 'card' ? 'Card' : (ord.paymentMethod === 'upi' ? 'UPI' : (ord.paymentMethod === 'wallet' ? 'NetBanking' : 'None')),
                            createdAt: ord.createdAt || new Date()
                        });
                    }
                }
            }
        }
    } catch (err) {
        console.error('Error auto-syncing B2B orders to POs:', err.message);
    }

    const filter = { companyId };
    if (req.user.role === 'b2bEmployee') {
        const employeeRfqs = await RFQ.find({ createdByEmployeeId: req.user.id }).select('_id');
        filter.$or = [
            { rfqId: { $in: employeeRfqs.map(r => r._id) } },
            { companyId, sourceType: 'DirectPurchase' }
        ];
    }
    const pos = await PurchaseOrder.find(filter)
        .populate('rfqId', 'rfqId')
        .sort({ createdAt: -1 });

    res.status(200).json(new ApiResponse(200, pos, 'Purchase Orders fetched successfully.'));
});

// GET /api/b2b-user/admin/purchase-orders/:id
export const getPurchaseOrderDetail = asyncHandler(async (req, res) => {
    const companyId = await getCompanyId(req);
    const filter = { _id: req.params.id, companyId };
    if (req.user.role === 'b2bEmployee') {
        const employeeRfqs = await RFQ.find({ createdByEmployeeId: req.user.id }).select('_id');
        filter.$or = [
            { rfqId: { $in: employeeRfqs.map(r => r._id) } },
            { companyId, sourceType: 'DirectPurchase' }
        ];
    }
    const po = await PurchaseOrder.findOne(filter).populate('rfqId', 'rfqId');

    if (!po) {
        throw new ApiError(404, 'Purchase Order not found.');
    }

    res.status(200).json(new ApiResponse(200, po, 'Purchase Order details fetched successfully.'));
});

// PATCH /api/b2b-user/admin/purchase-orders/:id/pay
export const payPurchaseOrder = asyncHandler(async (req, res) => {
    const companyId = await getCompanyId(req);
    const po = await PurchaseOrder.findOne({ _id: req.params.id, companyId });

    if (!po) {
        throw new ApiError(404, 'Purchase Order not found.');
    }

    if (po.paymentStatus === 'Paid') {
        throw new ApiError(400, 'Purchase Order is already paid.');
    }

    const { paymentMethod, cardLast4 } = req.body;

    po.paymentStatus = 'Paid';
    po.paymentMethod = paymentMethod || 'Card';
    po.paymentDetails = {
        transactionId: `TXN-MOCK-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        paidAt: new Date(),
        cardLast4: paymentMethod === 'Card' ? (cardLast4 || '4242') : undefined
    };

    if (po.status === 'Sent') {
        po.status = 'Approved';
    }

    await po.save();

    try {
        const io = getIO();
        io.to('admin_room').emit('payment_status_updated', {
            poId: po._id,
            poNumber: po.poNumber,
            paymentStatus: po.paymentStatus,
            companyName: po.companyDetails?.name || 'Company'
        });
    } catch (err) {
        console.error('Socket emission failed for payment update:', err);
    }

    res.status(200).json(new ApiResponse(200, po, 'Purchase Order paid successfully (simulated).'));
});


// POST /api/b2b-user/admin/rfq/upload
export const uploadAttachment = asyncHandler(async (req, res) => {
    if (!req.file?.path) {
        throw new ApiError(400, 'Document file is required.');
    }

    let uploaded = null;
    try {
        uploaded = await uploadLocalFileToCloudinaryAndCleanup(
            req.file.path,
            'rfq/attachments'
        );
        res.status(200).json(
            new ApiResponse(200, { url: uploaded.url }, 'Attachment uploaded successfully.')
        );
    } catch (error) {
        await cleanupLocalFiles([req.file?.path]).catch(() => null);
        throw error;
    }
});
