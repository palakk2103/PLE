import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';
import Invoice from '../models/Invoice.model.js';
import {
    getInvoiceWithRoleProjection,
    buildInvoicePdfStream,
    generateInvoiceForOrder,
} from '../services/invoice.service.js';

// ─── CUSTOMER / B2B INVOICE CONTROLLERS ────────────────────────────────────────

export const getUserInvoice = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const invoice = await getInvoiceWithRoleProjection(id, req.user);
    res.status(200).json(new ApiResponse(200, invoice, 'Invoice retrieved successfully.'));
});

export const downloadUserInvoicePdf = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const invoice = await getInvoiceWithRoleProjection(id, req.user);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice-${invoice.invoiceNumber}.pdf"`);

    buildInvoicePdfStream(res, invoice, 'customer');
});

// ─── VENDOR / SELLER INVOICE CONTROLLERS ────────────────────────────────────────

export const getVendorInvoice = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const invoice = await getInvoiceWithRoleProjection(id, req.user);
    res.status(200).json(new ApiResponse(200, invoice, 'Vendor invoice retrieved successfully.'));
});

export const downloadVendorInvoicePdf = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const invoice = await getInvoiceWithRoleProjection(id, req.user);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Vendor-Invoice-${invoice.invoiceNumber}.pdf"`);

    const vendorId = req.user.role === 'managed_vendor' ? (req.user.shopId || req.user.id) : req.user.id;
    buildInvoicePdfStream(res, invoice, 'vendor', vendorId);
});

// ─── ADMIN INVOICE CONTROLLERS ──────────────────────────────────────────────────

export const getAdminInvoice = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const invoice = await getInvoiceWithRoleProjection(id, req.user);
    res.status(200).json(new ApiResponse(200, invoice, 'Admin invoice retrieved successfully.'));
});

export const downloadAdminInvoicePdf = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const invoice = await getInvoiceWithRoleProjection(id, req.user);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Admin-Invoice-${invoice.invoiceNumber}.pdf"`);

    buildInvoicePdfStream(res, invoice, 'admin');
});

export const getAllInvoices = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 20,
        search,
        status,
        customerType,
        orderType,
        startDate,
        endDate,
    } = req.query;

    const numericPage = Math.max(1, Number(page) || 1);
    const numericLimit = Math.max(1, Number(limit) || 20);
    const skip = (numericPage - 1) * numericLimit;

    const filter = {};

    if (status && status !== 'all') {
        filter.status = status;
    }

    if (customerType && customerType !== 'all') {
        filter.customerType = customerType;
    }

    if (orderType && orderType !== 'all') {
        filter.orderType = orderType;
    }

    if (search) {
        const regex = new RegExp(search.trim(), 'i');
        filter.$or = [
            { invoiceNumber: regex },
            { orderNumber: regex },
            { 'customer.name': regex },
            { 'customer.email': regex },
            { 'customer.phone': regex },
            { 'b2bDetails.companyName': regex },
            { 'b2bDetails.gstNumber': regex },
        ];
    }

    if (startDate || endDate) {
        filter.invoiceDate = {};
        if (startDate) filter.invoiceDate.$gte = new Date(startDate);
        if (endDate) filter.invoiceDate.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }

    const [invoices, total] = await Promise.all([
        Invoice.find(filter)
            .sort({ invoiceDate: -1 })
            .skip(skip)
            .limit(numericLimit)
            .lean(),
        Invoice.countDocuments(filter),
    ]);

    res.status(200).json(
        new ApiResponse(
            200,
            {
                invoices,
                total,
                page: numericPage,
                pages: Math.ceil(total / numericLimit),
            },
            'Invoices fetched successfully.'
        )
    );
});

export const getVendorInvoices = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 20,
        search,
        status,
        orderType,
    } = req.query;

    const vendorId = req.user.role === 'managed_vendor' ? (req.user.shopId || req.user.id) : req.user.id;
    const vendorIdStr = vendorId.toString();

    const numericPage = Math.max(1, Number(page) || 1);
    const numericLimit = Math.max(1, Number(limit) || 20);
    const skip = (numericPage - 1) * numericLimit;

    const filter = {
        'sellerBreakdown.vendorId': vendorId,
    };

    if (status && status !== 'all') {
        filter.status = status;
    }

    if (orderType && orderType !== 'all') {
        filter.orderType = orderType;
    }

    if (search) {
        const regex = new RegExp(search.trim(), 'i');
        filter.$or = [
            { invoiceNumber: regex },
            { orderNumber: regex },
            { 'customer.name': regex },
        ];
    }

    const [invoices, total] = await Promise.all([
        Invoice.find(filter)
            .sort({ invoiceDate: -1 })
            .skip(skip)
            .limit(numericLimit)
            .lean(),
        Invoice.countDocuments(filter),
    ]);

    const sanitizedInvoices = invoices.map((inv) => {
        const matchedSeller = (inv.sellerBreakdown || []).find(
            (sb) => sb.vendorId?.toString() === vendorIdStr
        );
        const vendorItems = (inv.items || []).filter(
            (item) => item.vendorId?.toString() === vendorIdStr
        );

        return {
            _id: inv._id,
            invoiceNumber: inv.invoiceNumber,
            orderNumber: inv.orderNumber,
            invoiceDate: inv.invoiceDate,
            orderType: inv.orderType || 'b2c',
            customerType: inv.customerType,
            productRequestDetails: inv.productRequestDetails,
            rfqDetails: inv.rfqDetails,
            b2bBulkDetails: inv.b2bBulkDetails,
            customer: {
                name: inv.customer?.name || 'Customer',
            },
            items: vendorItems,
            sellerInfo: matchedSeller || {},
            payment: {
                method: inv.payment?.method,
                status: inv.payment?.status,
            },
            status: inv.status,
        };
    });

    res.status(200).json(
        new ApiResponse(
            200,
            {
                invoices: sanitizedInvoices,
                total,
                page: numericPage,
                pages: Math.ceil(total / numericLimit),
            },
            'Vendor invoices fetched successfully.'
        )
    );
});

export const getUserInvoices = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 20,
        search,
        status,
        orderType,
    } = req.query;

    const currentUserId = req.user.id;
    const userEmail = (req.user.email || '').toLowerCase().trim();

    const numericPage = Math.max(1, Number(page) || 1);
    const numericLimit = Math.max(1, Number(limit) || 20);
    const skip = (numericPage - 1) * numericLimit;

    const userFilters = [
        { userId: currentUserId },
        ...(userEmail ? [{ 'customer.email': userEmail }] : []),
        ...(req.user.companyId ? [{ 'b2bDetails.companyId': req.user.companyId }] : []),
    ];

    const filter = { $or: userFilters };

    if (status && status !== 'all') {
        filter.status = status;
    }

    if (orderType && orderType !== 'all') {
        filter.orderType = orderType;
    }

    if (search) {
        const regex = new RegExp(search.trim(), 'i');
        filter.$or = [
            { invoiceNumber: regex },
            { orderNumber: regex },
        ];
    }

    const [invoices, total] = await Promise.all([
        Invoice.find(filter)
            .sort({ invoiceDate: -1 })
            .skip(skip)
            .limit(numericLimit)
            .lean(),
        Invoice.countDocuments(filter),
    ]);

    const sanitizedInvoices = invoices.map((inv) => ({
        _id: inv._id,
        invoiceNumber: inv.invoiceNumber,
        orderNumber: inv.orderNumber,
        invoiceDate: inv.invoiceDate,
        orderType: inv.orderType || 'b2c',
        customerType: inv.customerType,
        productRequestDetails: inv.productRequestDetails,
        rfqDetails: inv.rfqDetails,
        b2bBulkDetails: inv.b2bBulkDetails,
        customer: inv.customer,
        b2bDetails: inv.b2bDetails,
        shippingAddress: inv.shippingAddress,
        items: inv.items,
        financialSummary: {
            subtotal: inv.financialSummary?.subtotal,
            shipping: inv.financialSummary?.shipping,
            tax: inv.financialSummary?.tax,
            discount: inv.financialSummary?.discount,
            couponDiscount: inv.financialSummary?.couponDiscount,
            loyaltyDiscount: inv.financialSummary?.loyaltyDiscount,
            grandTotal: inv.financialSummary?.grandTotal,
            amountPaid: inv.financialSummary?.amountPaid,
        },
        payment: {
            method: inv.payment?.method,
            status: inv.payment?.status,
            transactionId: inv.payment?.transactionId,
        },
        status: inv.status,
    }));

    res.status(200).json(
        new ApiResponse(
            200,
            {
                invoices: sanitizedInvoices,
                total,
                page: numericPage,
                pages: Math.ceil(total / numericLimit),
            },
            'User invoices fetched successfully.'
        )
    );
});

export const regenerateAdminInvoice = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const invoice = await generateInvoiceForOrder(id);
    res.status(200).json(new ApiResponse(200, invoice, 'Invoice generated / synchronized successfully.'));
});
