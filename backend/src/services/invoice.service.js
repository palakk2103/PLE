import Invoice from '../models/Invoice.model.js';
import Order from '../models/Order.model.js';
import User from '../models/User.model.js';
import Vendor from '../models/Vendor.model.js';
import Commission from '../models/Commission.model.js';
import Settings from '../models/Settings.model.js';
import ProductRequest from '../models/ProductRequest.model.js';
import RFQ from '../models/RFQ.model.js';
import ApiError from '../utils/ApiError.js';
import PDFDocument from 'pdfkit';
import mongoose from 'mongoose';
import { sendInvoiceEmail } from './email.service.js';
import { resolveCustomerContact } from './orderStatus.service.js';

/**
 * Generate a unique, formatted invoice number.
 * E.g., INV-202609-AB1234
 */
export const generateInvoiceNumber = (orderNumber) => {
    const datePart = new Date().toISOString().slice(0, 7).replace('-', '');
    const cleanOrderNumber = String(orderNumber || '').replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    return `INV-${datePart}-${cleanOrderNumber || randomPart}`;
};

/**
 * Generate or retrieve an idempotent invoice for a given order ID.
 */
export const generateInvoiceForOrder = async (orderId, session = null) => {
    if (!orderId) return null;

    const isObjectId = mongoose.Types.ObjectId.isValid(orderId);

    // 1. Check if invoice already exists
    const existingInvoice = await Invoice.findOne({
        $or: [
            { orderNumber: String(orderId) },
            ...(isObjectId ? [{ orderId: new mongoose.Types.ObjectId(orderId) }, { _id: new mongoose.Types.ObjectId(orderId) }] : []),
        ],
    }).session(session);

    // Fetch the target order
    const order = await Order.findOne({
        $or: [
            { orderId: String(orderId) },
            ...(isObjectId ? [{ _id: new mongoose.Types.ObjectId(orderId) }] : []),
        ],
    })
        .populate({
            path: 'userId',
            populate: { path: 'companyId' },
        })
        .session(session);

    if (!order) {
        if (existingInvoice) return existingInvoice;
        throw new ApiError(404, 'Associated order not found for invoice generation.');
    }

    // 2. If invoice already exists, sync payment/order status idempotently
    if (existingInvoice) {
        let isModified = false;
        if (order.paymentStatus && existingInvoice.payment.status !== order.paymentStatus) {
            existingInvoice.payment.status = order.paymentStatus;
            isModified = true;
        }
        if (['paid', 'captured', 'success'].includes(order.paymentStatus) && existingInvoice.status !== 'paid') {
            existingInvoice.status = 'paid';
            existingInvoice.payment.status = 'paid';
            isModified = true;
        }
        if (order.status === 'cancelled' && existingInvoice.status !== 'cancelled') {
            existingInvoice.status = 'cancelled';
            isModified = true;
        }
        if (order.paymentDetails?.razorpayPaymentId && !existingInvoice.payment.transactionId) {
            existingInvoice.payment.transactionId = order.paymentDetails.razorpayPaymentId;
            existingInvoice.payment.transactionTime = order.paymentDetails.transactionTime || new Date();
            isModified = true;
        }
        // Lazy backfill of orderType if missing or generic
        if (!existingInvoice.orderType || (existingInvoice.orderType === 'b2c' && (order.requestProductId || order.rfqId || order.orderType !== 'b2c'))) {
            let backfilledType = order.orderType || 'b2c';
            if (order.requestProductId) backfilledType = 'product_request';
            else if (order.rfqId) backfilledType = 'rfq';
            else if (order.userId?.role === 'b2bAdmin' || order.userId?.role === 'b2bEmployee' || !!order.userId?.companyId) backfilledType = 'b2b';
            if (backfilledType && existingInvoice.orderType !== backfilledType) {
                existingInvoice.orderType = backfilledType;
                isModified = true;
            }
        }
        if (isModified) {
            await existingInvoice.save({ session });
        }
        return existingInvoice;
    }

    // 3. Collect customer & B2B details
    const user = order.userId;
    const isB2B = user?.role === 'b2bAdmin' || user?.role === 'b2bEmployee' || !!user?.companyId;
    const b2bCompany = user?.companyId;

    // Resolve order type (Direct + Backward-compatible detection)
    let orderType = order.orderType;
    let prDoc = null;
    let rfqDoc = null;

    if (!orderType || orderType === 'b2c') {
        if (order.requestProductId) {
            orderType = 'product_request';
        } else if (order.rfqId) {
            orderType = 'rfq';
        } else if (isB2B || !!user?.companyId) {
            orderType = 'b2b';
        }
    }

    // Deep historical detection if still unresolved
    if (!orderType || orderType === 'b2c') {
        prDoc = await ProductRequest.findOne({
            $or: [
                ...(order.requestProductId ? [{ _id: order.requestProductId }] : []),
                { associatedOrderId: order._id },
                { 'timeline.comment': { $regex: order.orderId } }
            ]
        }).session(session).lean();

        if (prDoc) {
            orderType = 'product_request';
        } else {
            rfqDoc = await RFQ.findOne({
                $or: [
                    ...(order.rfqId ? [{ _id: order.rfqId }] : []),
                    { 'timeline.notes': { $regex: order.orderId } },
                    { 'approvalHistory.notes': { $regex: order.orderId } }
                ]
            }).session(session).lean();

            if (rfqDoc) {
                orderType = 'rfq';
            }
        }
    }

    if (!orderType) orderType = isB2B ? 'b2b' : 'b2c';

    // Contextual snapshots
    if (orderType === 'product_request' && !prDoc && order.requestProductId) {
        prDoc = await ProductRequest.findById(order.requestProductId).session(session).lean();
    }
    if (orderType === 'rfq' && !rfqDoc && order.rfqId) {
        rfqDoc = await RFQ.findById(order.rfqId).session(session).lean();
    }

    const productRequestDetails = orderType === 'product_request' ? {
        requestId: prDoc?.requestId || '',
        requestDbId: prDoc?._id || order.requestProductId || undefined,
        productName: prDoc?.productName || order.items?.[0]?.name || 'Requested Product',
        category: prDoc?.category || 'General',
        requestedQuantity: prDoc?.quantity || order.items?.[0]?.quantity || 1,
        agreedQuantity: (order.items || []).reduce((acc, i) => acc + (i.quantity || 0), 0) || prDoc?.quantity || 1,
        finalPrice: prDoc?.selectedFulfillment?.finalPrice || order.items?.[0]?.price || order.total || 0,
        notes: prDoc?.description || 'Purchase originated from Product Request.'
    } : undefined;

    const rfqDetails = orderType === 'rfq' ? {
        rfqId: rfqDoc?.rfqId || (order.rfqId ? String(order.rfqId) : `RFQ-${order.orderId}`),
        rfqDbId: rfqDoc?._id || order.rfqId || undefined,
        productName: rfqDoc?.customProductName || order.items?.[0]?.name || 'Negotiated RFQ Item',
        quotedPrice: rfqDoc?.targetPrice || order.items?.[0]?.price || order.total || 0,
        agreedQuantity: (order.items || []).reduce((acc, i) => acc + (i.quantity || 0), 0) || rfqDoc?.quantity || 1,
        terms: rfqDoc?.termsConditions || 'Commercial RFQ Terms Negotiated with Vendor',
        notes: rfqDoc?.requirementDetails || 'Purchase originated from RFQ negotiation.'
    } : undefined;

    const totalBulkQuantity = (order.items || []).reduce((acc, i) => acc + (i.quantity || 0), 0);
    const b2bBulkDetails = (orderType === 'b2b' || isB2B) ? {
        companyName: b2bCompany?.companyName || order.shippingAddress?.name || user?.name || '',
        gstNumber: b2bCompany?.gstNumber || '',
        totalBulkQuantity,
        bulkPricingApplied: totalBulkQuantity >= 5 || !!b2bCompany,
        poNumber: `PO-${order.orderId}`,
        orderTerms: 'Commercial wholesale/bulk purchase terms apply.'
    } : undefined;

    const customerDetails = {
        name: order.shippingAddress?.name || user?.name || order.guestInfo?.name || 'Customer',
        email: order.shippingAddress?.email || user?.email || order.guestInfo?.email || '',
        phone: order.shippingAddress?.phone || user?.phone || order.guestInfo?.phone || '',
    };

    const b2bDetails = isB2B && b2bCompany ? {
        companyId: b2bCompany._id,
        companyName: b2bCompany.companyName || '',
        gstNumber: b2bCompany.gstNumber || '',
        businessEmail: b2bCompany.businessEmail || user?.email || '',
        businessPhone: b2bCompany.businessPhone || user?.phone || '',
        companyAddress: b2bCompany.companyAddress || '',
        companyType: b2bCompany.companyType || '',
    } : undefined;

    // 4. Extract Items with complete GST breakdown
    const invoiceItems = (order.items || []).map((item) => {
        const qty = item.quantity || 1;
        const price = item.price || 0;
        const lineTotal = price * qty;
        const gstRate = Number.isFinite(item.gstRate) ? item.gstRate : 18;
        const gstAmount = Number.isFinite(item.gstAmount) && item.gstAmount > 0
            ? item.gstAmount
            : parseFloat(((lineTotal * gstRate) / (100 + (item.taxIncluded ? gstRate : 0))).toFixed(2));
        const taxableAmount = Number.isFinite(item.taxableAmount) && item.taxableAmount > 0
            ? item.taxableAmount
            : parseFloat((lineTotal - (item.taxIncluded ? gstAmount : 0)).toFixed(2));

        return {
            productId: item.productId?._id || item.productId,
            vendorId: item.vendorId?._id || item.vendorId,
            name: item.name || 'Product',
            image: item.image || '',
            variantKey: item.variantKey || '',
            price,
            quantity: qty,
            taxableAmount,
            gstRate,
            gstAmount,
            discount: item.discount || 0,
            totalAmount: lineTotal,
        };
    });

    // 5. Gather Seller breakdown & Commissions
    const vendorIds = [
        ...new Set([
            ...(order.vendorItems || []).map((vi) => (vi.vendorId?._id || vi.vendorId)?.toString()),
            ...(order.items || []).map((item) => (item.vendorId?._id || item.vendorId)?.toString()),
        ].filter(Boolean)),
    ];

    // Query vendors to get current store info & documents
    const vendors = vendorIds.length > 0 ? await Vendor.find({ _id: { $in: vendorIds } }).session(session).lean() : [];
    const vendorMap = new Map(vendors.map((v) => [v._id.toString(), v]));

    // Query commission records created for this order
    const commissions = await Commission.find({ orderId: order._id }).session(session).lean();
    const commissionMap = new Map(commissions.map((c) => [c.vendorId?.toString(), c]));

    let totalPlatformCommission = 0;
    let totalSellerEarnings = 0;

    let sellerBreakdown = [];
    if (order.vendorItems && order.vendorItems.length > 0) {
        sellerBreakdown = order.vendorItems.map((vi) => {
            const vid = (vi.vendorId?._id || vi.vendorId)?.toString();
            const vendorDoc = vendorMap.get(vid);
            const commDoc = commissionMap.get(vid);

            const subtotal = vi.subtotal ?? 0;
            const shipping = vi.shipping ?? 0;
            const tax = vi.tax ?? 0;
            const discount = vi.discount ?? 0;
            const total = subtotal + shipping + tax - discount;

            const commissionRate = commDoc?.commissionRate ?? vendorDoc?.commissionRate ?? 10;
            const commissionAmount = commDoc?.commission ?? parseFloat(((subtotal * commissionRate) / 100).toFixed(2));
            const sellerPayableAmount = commDoc?.vendorEarnings ?? parseFloat((subtotal - commissionAmount).toFixed(2));

            totalPlatformCommission += commissionAmount;
            totalSellerEarnings += sellerPayableAmount;

            return {
                vendorId: vi.vendorId?._id || vi.vendorId || undefined,
                storeName: vi.vendorName || vendorDoc?.storeName || 'Vendor Store',
                sellerName: vendorDoc?.name || '',
                sellerEmail: vendorDoc?.email || '',
                sellerPhone: vendorDoc?.phone || '',
                sellerAddress: {
                    street: vendorDoc?.address?.street || '',
                    city: vendorDoc?.address?.city || '',
                    state: vendorDoc?.address?.state || '',
                    zipCode: vendorDoc?.address?.zipCode || '',
                    country: vendorDoc?.address?.country || 'India',
                },
                sellerGst: vendorDoc?.documents?.gst || '',
                subtotal,
                shipping,
                tax,
                discount,
                total,
                commissionRate,
                commissionAmount,
                sellerPayableAmount,
                settlementStatus: commDoc?.status === 'paid' ? 'settled' : 'pending',
                settledAt: commDoc?.paidAt || undefined,
            };
        });
    } else {
        const subtotal = order.subtotal ?? (order.total ?? 0);
        const shipping = order.shipping ?? 0;
        const tax = order.tax ?? 0;
        const discount = order.discount ?? 0;
        const total = order.total ?? (subtotal + shipping + tax - discount);

        sellerBreakdown = vendorIds.length > 0 ? vendorIds.map((vid) => {
            const vendorDoc = vendorMap.get(vid);
            const commDoc = commissionMap.get(vid);
            const commissionRate = commDoc?.commissionRate ?? vendorDoc?.commissionRate ?? 10;
            const commissionAmount = commDoc?.commission ?? parseFloat(((subtotal * commissionRate) / 100).toFixed(2));
            const sellerPayableAmount = commDoc?.vendorEarnings ?? parseFloat((subtotal - commissionAmount).toFixed(2));

            totalPlatformCommission += commissionAmount;
            totalSellerEarnings += sellerPayableAmount;

            return {
                vendorId: vendorDoc?._id || vid,
                storeName: vendorDoc?.storeName || 'Vendor Store',
                sellerName: vendorDoc?.name || '',
                sellerEmail: vendorDoc?.email || '',
                sellerPhone: vendorDoc?.phone || '',
                sellerAddress: {
                    street: vendorDoc?.address?.street || '',
                    city: vendorDoc?.address?.city || '',
                    state: vendorDoc?.address?.state || '',
                    zipCode: vendorDoc?.address?.zipCode || '',
                    country: vendorDoc?.address?.country || 'India',
                },
                sellerGst: vendorDoc?.documents?.gst || '',
                subtotal,
                shipping,
                tax,
                discount,
                total,
                commissionRate,
                commissionAmount,
                sellerPayableAmount,
                settlementStatus: commDoc?.status === 'paid' ? 'settled' : 'pending',
                settledAt: commDoc?.paidAt || undefined,
            };
        }) : [
            {
                storeName: 'Direct Seller / Store',
                sellerName: 'Store Administrator',
                sellerEmail: '',
                sellerPhone: '',
                sellerAddress: {
                    street: '',
                    city: '',
                    state: '',
                    zipCode: '',
                    country: 'India',
                },
                sellerGst: '',
                subtotal,
                shipping,
                tax,
                discount,
                total,
                commissionRate: 0,
                commissionAmount: 0,
                sellerPayableAmount: total,
                settlementStatus: 'settled',
            }
        ];
    }

    // 6. Build Financial Summary
    const financialSummary = {
        subtotal: order.subtotal ?? 0,
        shipping: order.shipping ?? 0,
        tax: order.tax ?? 0,
        discount: order.discount ?? 0,
        couponCode: order.couponCode || '',
        couponDiscount: order.couponDiscount ?? 0,
        loyaltyDiscount: order.loyaltyDiscount ?? 0,
        grandTotal: order.total ?? 0,
        walletAmountUsed: order.walletAmountUsed ?? 0,
        amountPaid: ['paid', 'captured', 'success'].includes(order.paymentStatus) ? order.total : (order.walletAmountUsed || 0),
        totalPlatformCommission: parseFloat(totalPlatformCommission.toFixed(2)),
        totalSellerEarnings: parseFloat(totalSellerEarnings.toFixed(2)),
    };

    // 7. Payment details
    const payment = {
        method: order.paymentMethod || 'cod',
        status: order.paymentStatus || 'pending',
        gateway: order.paymentDetails?.gatewayName || 'Razorpay',
        transactionId: order.paymentDetails?.razorpayPaymentId || '',
        transactionTime: order.paymentDetails?.transactionTime || order.createdAt,
        cardLast4: order.paymentDetails?.cardLast4 || '',
        cardNetwork: order.paymentDetails?.cardNetwork || '',
        bankName: order.paymentDetails?.bankName || '',
    };

    let invoiceStatus = 'issued';
    if (['paid', 'captured', 'success'].includes(order.paymentStatus)) {
        invoiceStatus = 'paid';
    } else if (order.status === 'cancelled') {
        invoiceStatus = 'cancelled';
    }

    // 8. Create and persist Invoice
    const invoiceNumber = generateInvoiceNumber(order.orderId);

    const [createdInvoice] = await Invoice.create(
        [
            {
                invoiceNumber,
                orderId: order._id,
                orderNumber: order.orderId,
                invoiceDate: order.createdAt || new Date(),
                customerType: isB2B ? 'b2b' : 'b2c',
                orderType,
                b2bBulkDetails,
                productRequestDetails,
                rfqDetails,
                userId: user?._id || null,
                customer: customerDetails,
                b2bDetails,
                billingAddress: order.shippingAddress || {},
                shippingAddress: order.shippingAddress || {},
                items: invoiceItems,
                sellerBreakdown,
                financialSummary,
                payment,
                status: invoiceStatus,
            },
        ],
        { session }
    );

    return createdInvoice;
};

/**
 * Retrieves invoice with role-based field projections:
 * - Customer: Hides internal commission, settlement, and admin margins.
 * - Vendor: Filters to vendor's own items and shows vendor-specific payout.
 * - Admin: Returns complete financial ledger.
 */
export const getInvoiceWithRoleProjection = async (orderIdOrInvoiceNum, user) => {
    if (!user) throw new ApiError(401, 'Authentication required.');

    const filter = [
        { invoiceNumber: orderIdOrInvoiceNum },
        { orderNumber: orderIdOrInvoiceNum },
    ];
    if (mongoose.Types.ObjectId.isValid(orderIdOrInvoiceNum)) {
        filter.push({ orderId: orderIdOrInvoiceNum });
        filter.push({ _id: orderIdOrInvoiceNum });
    }

    let invoice = await Invoice.findOne({ $or: filter }).lean();

    // Lazy generation for orders placed before invoice system existed
    if (!invoice) {
        try {
            const created = await generateInvoiceForOrder(orderIdOrInvoiceNum);
            if (created) {
                invoice = created.toObject ? created.toObject() : created;
            }
        } catch (err) {
            console.warn('Lazy invoice generation note:', err.message);
        }
    }

    if (!invoice) {
        throw new ApiError(404, 'Invoice not found.');
    }

    const role = String(user.role).toLowerCase();

    // ─── ADMIN ROLE ─────────────────────────────────────────────────────────────
    if (role === 'admin' || role === 'superadmin') {
        return {
            ...invoice,
            roleScope: 'admin',
        };
    }

    // ─── VENDOR ROLE ────────────────────────────────────────────────────────────
    if (role === 'vendor' || role === 'managed_vendor') {
        const vendorIdsToMatch = (
            role === 'managed_vendor'
                ? [user.shopId, user.id]
                : [user.id, user._id]
        )
            .filter(Boolean)
            .map((id) => id.toString());

        // Check if this vendor fulfills any item in this invoice
        const matchedSeller = invoice.sellerBreakdown?.find((sb) =>
            vendorIdsToMatch.includes(sb.vendorId?.toString())
        );

        if (!matchedSeller) {
            throw new ApiError(403, 'Access denied. You do not have products in this invoice.');
        }

        // Filter items to only those belonging to this vendor
        const vendorItems = (invoice.items || []).filter((item) =>
            vendorIdsToMatch.includes(item.vendorId?.toString())
        );

        return {
            invoiceNumber: invoice.invoiceNumber,
            orderNumber: invoice.orderNumber,
            invoiceDate: invoice.invoiceDate,
            customerType: invoice.customerType,
            orderType: invoice.orderType || 'b2c',
            b2bBulkDetails: invoice.b2bBulkDetails,
            productRequestDetails: invoice.productRequestDetails,
            rfqDetails: invoice.rfqDetails,
            customer: {
                name: invoice.customer?.name,
            },
            shippingAddress: invoice.shippingAddress,
            items: vendorItems,
            sellerInfo: {
                storeName: matchedSeller.storeName,
                sellerGst: matchedSeller.sellerGst,
                subtotal: matchedSeller.subtotal,
                shipping: matchedSeller.shipping,
                tax: matchedSeller.tax,
                discount: matchedSeller.discount,
                total: matchedSeller.total,
                commissionRate: matchedSeller.commissionRate,
                commissionAmount: matchedSeller.commissionAmount,
                sellerPayableAmount: matchedSeller.sellerPayableAmount,
                settlementStatus: matchedSeller.settlementStatus,
            },
            payment: {
                method: invoice.payment?.method,
                status: invoice.payment?.status,
            },
            status: invoice.status,
            roleScope: 'vendor',
        };
    }

    // ─── CUSTOMER / B2B ROLE ───────────────────────────────────────────────────
    if (role === 'customer' || role === 'b2badmin' || role === 'b2bemployee') {
        const currentUserId = String(user.id || user._id || '');
        const invoiceUserId = invoice.userId ? String(invoice.userId) : '';
        const userEmail = (user.email || '').toLowerCase().trim();
        const invoiceEmail = (invoice.customer?.email || '').toLowerCase().trim();

        const isOwner =
            (invoiceUserId && invoiceUserId === currentUserId) ||
            (userEmail && invoiceEmail && userEmail === invoiceEmail) ||
            (!invoiceUserId);

        const isB2BCompanyOwner =
            user.companyId &&
            invoice.b2bDetails?.companyId &&
            String(invoice.b2bDetails.companyId) === String(user.companyId);

        if (!isOwner && !isB2BCompanyOwner) {
            throw new ApiError(403, 'Access denied. You can only access invoices for your own orders.');
        }

        // Clean customer-facing invoice (STRIP ALL INTERNAL COMMISSIONS)
        const sanitizedSellerBreakdown = (invoice.sellerBreakdown || []).map((sb) => ({
            storeName: sb.storeName,
            sellerCity: sb.sellerAddress?.city || '',
            sellerState: sb.sellerAddress?.state || '',
            sellerGst: sb.sellerGst || '',
        }));

        return {
            invoiceNumber: invoice.invoiceNumber,
            orderNumber: invoice.orderNumber,
            invoiceDate: invoice.invoiceDate,
            customerType: invoice.customerType,
            orderType: invoice.orderType || 'b2c',
            b2bBulkDetails: invoice.b2bBulkDetails,
            productRequestDetails: invoice.productRequestDetails,
            rfqDetails: invoice.rfqDetails,
            customer: invoice.customer,
            b2bDetails: invoice.b2bDetails,
            billingAddress: invoice.billingAddress,
            shippingAddress: invoice.shippingAddress,
            items: invoice.items,
            sellers: sanitizedSellerBreakdown,
            financialSummary: {
                subtotal: invoice.financialSummary?.subtotal,
                shipping: invoice.financialSummary?.shipping,
                tax: invoice.financialSummary?.tax,
                discount: invoice.financialSummary?.discount,
                couponCode: invoice.financialSummary?.couponCode,
                couponDiscount: invoice.financialSummary?.couponDiscount,
                loyaltyDiscount: invoice.financialSummary?.loyaltyDiscount,
                grandTotal: invoice.financialSummary?.grandTotal,
                walletAmountUsed: invoice.financialSummary?.walletAmountUsed,
                amountPaid: invoice.financialSummary?.amountPaid,
            },
            payment: {
                method: invoice.payment?.method,
                status: invoice.payment?.status,
                transactionId: invoice.payment?.transactionId,
                transactionTime: invoice.payment?.transactionTime,
            },
            status: invoice.status,
            roleScope: 'customer',
        };
    }

    throw new ApiError(403, 'Unauthorized role.');
};

/**
 * Render the complete vector PDF content onto a PDFDocument instance.
 * Shared between buildInvoicePdfStream (HTTP download) and generateInvoicePdfBuffer (email attachment).
 */
export const renderInvoicePdf = (doc, invoice, role = 'customer', vendorId = null) => {
    const primaryColor = '#1e3a8a';   // Deep navy blue
    const secondaryColor = '#475569'; // Slate
    const borderColor = '#cbd5e1';    // Slate border

    // Helper: Header bar
    doc.rect(40, 40, 515, 60).fill('#f8fafc');
    doc.strokeColor(borderColor).rect(40, 40, 515, 60).stroke();

    // Store / Company Name
    doc.fillColor(primaryColor).fontSize(20).font('Helvetica-Bold').text('PLE MARKETPLACE', 55, 52);
    doc.fontSize(8).font('Helvetica').fillColor(secondaryColor).text('Multi-Vendor Commercial Platform', 55, 76);

    // Invoice Title & Status
    const statusText = (invoice.status || 'ISSUED').toUpperCase();
    let statusColor = '#059669'; // Green
    if (statusText === 'PENDING' || invoice.payment?.status === 'pending') statusColor = '#d97706';
    if (statusText === 'CANCELLED') statusColor = '#dc2626';

    let orderTypeTitle = 'B2C ORDER';
    if (invoice.orderType === 'b2b') orderTypeTitle = 'B2B / BULK ORDER';
    else if (invoice.orderType === 'product_request') orderTypeTitle = 'PRODUCT REQUEST ORDER';
    else if (invoice.orderType === 'rfq') orderTypeTitle = 'RFQ ORDER';

    doc.fillColor(primaryColor).fontSize(12.5).font('Helvetica-Bold').text(`TAX INVOICE [${orderTypeTitle}]`, 240, 48, { align: 'right', width: 300 });
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(statusColor).text(`STATUS: ${statusText}`, 370, 70, { align: 'right', width: 170 });

    doc.moveDown(2);

    // Invoice Details & Billing Info Section
    let currentY = 115;
    doc.rect(40, currentY, 250, 110).strokeColor(borderColor).stroke();
    doc.rect(300, currentY, 255, 110).strokeColor(borderColor).stroke();

    // Left Box: Customer / Billing
    doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text('BILL TO / SHIP TO:', 50, currentY + 8);
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e293b').text(invoice.customer?.name || 'Customer', 50, currentY + 24);
    doc.font('Helvetica').fontSize(8).fillColor(secondaryColor);
    
    if (invoice.b2bDetails?.companyName) {
        doc.text(`Company: ${invoice.b2bDetails.companyName}`, 50, currentY + 38);
        doc.text(`GSTIN: ${invoice.b2bDetails.gstNumber || 'N/A'}`, 50, currentY + 49);
    }

    const addr = invoice.shippingAddress || invoice.billingAddress || {};
    const street = addr.address ? `${addr.address}, ` : '';
    const cityState = `${addr.city || ''} ${addr.state || ''} ${addr.zipCode || ''}`.trim();
    doc.text(`${street}${cityState}`, 50, currentY + (invoice.b2bDetails?.companyName ? 60 : 38), { width: 230 });
    doc.text(`Phone: ${invoice.customer?.phone || addr.phone || 'N/A'}`, 50, currentY + (invoice.b2bDetails?.companyName ? 82 : 62));
    doc.text(`Email: ${invoice.customer?.email || 'N/A'}`, 50, currentY + (invoice.b2bDetails?.companyName ? 94 : 74));

    // Right Box: Invoice Metadata
    doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text('INVOICE DETAILS:', 310, currentY + 8);
    doc.font('Helvetica').fontSize(8.5).fillColor(secondaryColor);
    doc.text(`Invoice No:`, 310, currentY + 25);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(invoice.invoiceNumber, 410, currentY + 25);

    doc.font('Helvetica').fillColor(secondaryColor).text(`Order No:`, 310, currentY + 40);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(invoice.orderNumber, 410, currentY + 40);

    doc.font('Helvetica').fillColor(secondaryColor).text(`Date:`, 310, currentY + 55);
    doc.font('Helvetica').fillColor('#0f172a').text(new Date(invoice.invoiceDate).toLocaleDateString(), 410, currentY + 55);

    doc.font('Helvetica').fillColor(secondaryColor).text(`Payment Method:`, 310, currentY + 70);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text((invoice.payment?.method || 'N/A').toUpperCase(), 410, currentY + 70);

    if (invoice.payment?.transactionId) {
        doc.font('Helvetica').fillColor(secondaryColor).text(`Txn Ref:`, 310, currentY + 85);
        doc.font('Helvetica').fillColor('#0f172a').text(String(invoice.payment.transactionId).slice(0, 22), 410, currentY + 85);
    }

    // Contextual Order Type Banner (if B2B, Product Request, or RFQ)
    currentY = 232;
    let bannerHeight = 0;
    if (invoice.orderType === 'product_request' && invoice.productRequestDetails) {
        bannerHeight = 28;
        doc.rect(40, currentY, 515, bannerHeight).fill('#fffbeb');
        doc.strokeColor('#fde68a').rect(40, currentY, 515, bannerHeight).stroke();
        doc.fillColor('#92400e').fontSize(8).font('Helvetica-Bold').text('ORIGIN: PRODUCT REQUEST ORDER', 50, currentY + 5);
        doc.font('Helvetica').fontSize(7.5).fillColor('#78350f').text(
            `Request ID: ${invoice.productRequestDetails.requestId || 'N/A'}  |  Category: ${invoice.productRequestDetails.category || 'N/A'}  |  Agreed Qty: ${invoice.productRequestDetails.agreedQuantity || 'N/A'}  |  Notes: ${(invoice.productRequestDetails.notes || 'Sourced on demand').slice(0, 45)}`,
            50, currentY + 16
        );
        currentY += bannerHeight + 8;
    } else if (invoice.orderType === 'rfq' && invoice.rfqDetails) {
        bannerHeight = 28;
        doc.rect(40, currentY, 515, bannerHeight).fill('#ecfdf5');
        doc.strokeColor('#a7f3d0').rect(40, currentY, 515, bannerHeight).stroke();
        doc.fillColor('#065f46').fontSize(8).font('Helvetica-Bold').text('ORIGIN: RFQ ORDER', 50, currentY + 5);
        doc.font('Helvetica').fontSize(7.5).fillColor('#047857').text(
            `RFQ Ref: ${invoice.rfqDetails.rfqId || 'N/A'}  |  Quoted Price: Rs. ${invoice.rfqDetails.quotedPrice || 0}  |  Agreed Qty: ${invoice.rfqDetails.agreedQuantity || 'N/A'}  |  Terms: ${(invoice.rfqDetails.terms || 'Standard RFQ Terms').slice(0, 45)}`,
            50, currentY + 16
        );
        currentY += bannerHeight + 8;
    } else if (invoice.orderType === 'b2b') {
        bannerHeight = 28;
        doc.rect(40, currentY, 515, bannerHeight).fill('#f5f3ff');
        doc.strokeColor('#ddd6fe').rect(40, currentY, 515, bannerHeight).stroke();
        doc.fillColor('#5b21b6').fontSize(8).font('Helvetica-Bold').text('ORIGIN: B2B / BULK ORDER', 50, currentY + 5);
        doc.font('Helvetica').fontSize(7.5).fillColor('#4c1d95').text(
            `Company: ${invoice.b2bBulkDetails?.companyName || invoice.b2bDetails?.companyName || 'Corporate Client'}  |  GSTIN: ${invoice.b2bBulkDetails?.gstNumber || invoice.b2bDetails?.gstNumber || 'N/A'}  |  Total Bulk Units: ${invoice.b2bBulkDetails?.totalBulkQuantity || 'Bulk'}`,
            50, currentY + 16
        );
        currentY += bannerHeight + 8;
    } else {
        currentY += 8;
    }

    // Line Items Table
    doc.rect(40, currentY, 515, 20).fill('#f1f5f9');
    doc.strokeColor(borderColor).rect(40, currentY, 515, 20).stroke();

    doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold');
    doc.text('#', 45, currentY + 6, { width: 20 });
    doc.text('Item Description', 70, currentY + 6, { width: 190 });
    doc.text('GST %', 270, currentY + 6, { width: 40, align: 'center' });
    doc.text('Qty', 320, currentY + 6, { width: 30, align: 'center' });
    doc.text('Price (Rs)', 360, currentY + 6, { width: 55, align: 'right' });
    doc.text('GST (Rs)', 425, currentY + 6, { width: 55, align: 'right' });
    doc.text('Total (Rs)', 490, currentY + 6, { width: 60, align: 'right' });

    currentY += 20;

    const itemsToRender = (invoice.items || []).filter((item) => {
        if (role === 'vendor' && vendorId) {
            return item.vendorId?.toString() === vendorId.toString();
        }
        return true;
    });

    itemsToRender.forEach((item, index) => {
        const itemTotal = item.totalAmount || (item.price * item.quantity);
        const gst = item.gstAmount || 0;

        doc.strokeColor('#e2e8f0').rect(40, currentY, 515, 22).stroke();
        doc.fillColor('#1e293b').fontSize(8).font('Helvetica');
        doc.text(String(index + 1), 45, currentY + 6, { width: 20 });
        doc.text(String(item.name || 'Item').slice(0, 36), 70, currentY + 6, { width: 190 });
        doc.text(`${item.gstRate ?? 18}%`, 270, currentY + 6, { width: 40, align: 'center' });
        doc.text(String(item.quantity || 1), 320, currentY + 6, { width: 30, align: 'center' });
        doc.text(Number(item.price || 0).toFixed(2), 360, currentY + 6, { width: 55, align: 'right' });
        doc.text(Number(gst).toFixed(2), 425, currentY + 6, { width: 55, align: 'right' });
        doc.font('Helvetica-Bold').text(Number(itemTotal).toFixed(2), 490, currentY + 6, { width: 60, align: 'right' });

        currentY += 22;
    });

    // Summary Box (Right aligned)
    currentY += 10;
    const summaryX = 330;
    const summaryWidth = 225;

    doc.rect(summaryX, currentY, summaryWidth, 100).fill('#f8fafc');
    doc.strokeColor(borderColor).rect(summaryX, currentY, summaryWidth, 100).stroke();

    const renderSummaryRow = (label, val, y, isBold = false) => {
        doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5);
        doc.fillColor(isBold ? primaryColor : secondaryColor).text(label, summaryX + 10, y);
        doc.text(`Rs. ${Number(val || 0).toFixed(2)}`, summaryX + 100, y, { width: 110, align: 'right' });
    };

    const fin = invoice.financialSummary || {};
    renderSummaryRow('Items Subtotal:', fin.subtotal, currentY + 8);
    renderSummaryRow('Discount:', fin.discount ? -fin.discount : 0, currentY + 22);
    renderSummaryRow('Total Tax (GST):', fin.tax, currentY + 36);
    renderSummaryRow('Shipping / Delivery:', fin.shipping, currentY + 50);

    doc.strokeColor(borderColor).moveTo(summaryX + 5, currentY + 66).lineTo(summaryX + summaryWidth - 5, currentY + 66).stroke();
    renderSummaryRow('Grand Total:', fin.grandTotal, currentY + 74, true);

    // Left Bottom Box: Role-specific notes / Internal financial settlement info
    if (role === 'admin') {
        const adminY = currentY;
        doc.rect(40, adminY, 275, 100).fill('#eff6ff');
        doc.strokeColor('#bfdbfe').rect(40, adminY, 275, 100).stroke();

        doc.fillColor('#1e40af').fontSize(9).font('Helvetica-Bold').text('INTERNAL ADMIN / PLATFORM SETTLEMENT', 50, adminY + 8);
        doc.font('Helvetica').fontSize(8).fillColor('#334155');
        doc.text(`Platform Commission: Rs. ${Number(fin.totalPlatformCommission || 0).toFixed(2)}`, 50, adminY + 26);
        doc.text(`Total Vendor Payout: Rs. ${Number(fin.totalSellerEarnings || 0).toFixed(2)}`, 50, adminY + 40);
        doc.text(`Settlement Status: Audited`, 50, adminY + 54);
        doc.text(`Payment Gateway: ${invoice.payment?.gateway || 'Razorpay'} (${invoice.payment?.status || 'N/A'})`, 50, adminY + 68);
        doc.text(`Transaction Reference: ${invoice.payment?.transactionId || 'None'}`, 50, adminY + 82);
    } else if (role === 'vendor') {
        const vendorY = currentY;
        doc.rect(40, vendorY, 275, 100).fill('#f0fdf4');
        doc.strokeColor('#bbf7d0').rect(40, vendorY, 275, 100).stroke();

        const sellerInfo = invoice.sellerInfo || (invoice.sellerBreakdown || []).find((sb) => sb.vendorId?.toString() === vendorId?.toString());
        doc.fillColor('#166534').fontSize(9).font('Helvetica-Bold').text('SELLER PAYOUT INFORMATION', 50, vendorY + 8);
        doc.font('Helvetica').fontSize(8).fillColor('#334155');
        doc.text(`Fulfillment Store: ${sellerInfo?.storeName || 'My Store'}`, 50, vendorY + 26);
        doc.text(`Gross Order Value: Rs. ${Number(sellerInfo?.total || fin.grandTotal).toFixed(2)}`, 50, vendorY + 40);
        doc.text(`Commission Fee (${sellerInfo?.commissionRate || 10}%): -Rs. ${Number(sellerInfo?.commissionAmount || 0).toFixed(2)}`, 50, vendorY + 54);
        doc.font('Helvetica-Bold').fillColor('#166534').text(`Net Payable: Rs. ${Number(sellerInfo?.sellerPayableAmount || 0).toFixed(2)}`, 50, vendorY + 68);
        doc.font('Helvetica').fillColor('#334155').text(`Settlement Status: ${(sellerInfo?.settlementStatus || 'PENDING').toUpperCase()}`, 50, vendorY + 82);
    } else {
        // Customer note: STRICTLY NO COMMISSIONS
        const custY = currentY;
        doc.rect(40, custY, 275, 100).fill('#fafafa');
        doc.strokeColor(borderColor).rect(40, custY, 275, 100).stroke();

        doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold').text('CUSTOMER NOTICE & TERMS', 50, custY + 8);
        doc.font('Helvetica').fontSize(8).fillColor(secondaryColor);
        doc.text('Thank you for purchasing with PLE Marketplace.', 50, custY + 26);
        doc.text('• This is an electronically generated valid tax invoice.', 50, custY + 40);
        doc.text('• Applicable GST has been charged per Government of India norms.', 50, custY + 54);
        doc.text('• For returns, replacements or warranty, visit your orders page.', 50, custY + 68);
        doc.text('• Customer Support: support@ple.com | www.ple.com', 50, custY + 82);
    }

    // Bottom Footer
    doc.fontSize(7.5).font('Helvetica').fillColor('#94a3b8');
    doc.text('System Generated Computer Invoice • No Signature Required • PLE Marketplace', 40, 770, { align: 'center', width: 515 });
};

/**
 * Generate a professional vector PDF stream matching the requesting role's permissions.
 * Direct pipe to express res for download routes.
 */
export const buildInvoicePdfStream = (res, invoice, role = 'customer', vendorId = null) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);
    renderInvoicePdf(doc, invoice, role, vendorId);
    doc.end();
};

/**
 * Generate in-memory vector PDF buffer for email attachments.
 * Reuses identical layout and design as buildInvoicePdfStream.
 * @returns {Promise<Buffer>}
 */
export const generateInvoicePdfBuffer = (invoice, role = 'customer', vendorId = null) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40, size: 'A4' });
            const chunks = [];
            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', (err) => reject(err));

            renderInvoicePdf(doc, invoice, role, vendorId);
            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

/**
 * Safely sends the customer their order invoice as a PDF attachment by email.
 * 
 * Guarantees:
 * 1. Idempotent: Skips sending if already emailed, unless forceResend is specified.
 * 2. Uses trusted registered customer contact from order/user record.
 * 3. In-memory PDF buffer generation (reuses identical PDFKit layout).
 * 4. Updates Invoice.emailDelivery and Order.emailNotifications / invoiceEmailSent.
 * 5. Fail-safe: Errors never roll back order or throw to caller unless throwOnError is true.
 * 
 * @param {string|mongoose.Types.ObjectId} orderId - The order ID or document
 * @param {Object} [options]
 * @param {boolean} [options.forceResend=false] - Force resending even if already sent
 * @param {boolean} [options.throwOnError=false] - Re-throw error (useful for admin APIs)
 * @param {string} [options.triggeredBy] - Actor who initiated the email (e.g. admin id)
 * @param {Object} [options.invoice] - Pre-fetched invoice if available
 * @returns {Promise<Object>} Delivery result object
 */
export const sendOrderInvoiceEmail = async (orderId, options = {}) => {
    const {
        forceResend = false,
        throwOnError = false,
        triggeredBy = null,
        invoice: preloadedInvoice = null,
    } = options;

    try {
        if (!orderId) {
            console.warn('[InvoiceEmail] No orderId provided to sendOrderInvoiceEmail');
            return { skipped: true, reason: 'missing_order_id' };
        }

        const isObjectId = mongoose.Types.ObjectId.isValid(orderId);

        // Fetch Order
        let order = await Order.findOne({
            $or: [
                { orderId: String(orderId) },
                ...(isObjectId ? [{ _id: new mongoose.Types.ObjectId(orderId) }] : []),
            ],
        }).populate({
            path: 'userId',
            select: 'name fullName email phone companyId',
        });

        if (!order) {
            console.warn(`[InvoiceEmail] Order not found for orderId: ${orderId}`);
            if (throwOnError) throw new ApiError(404, `Order ${orderId} not found.`);
            return { skipped: true, reason: 'order_not_found' };
        }

        // Fetch or Generate Invoice
        let invoice = preloadedInvoice;
        if (!invoice) {
            invoice = await Invoice.findOne({
                $or: [
                    { orderNumber: String(order.orderId) },
                    { orderId: order._id },
                ],
            });
        }

        if (!invoice) {
            try {
                invoice = await generateInvoiceForOrder(order._id);
            } catch (genErr) {
                console.warn(`[InvoiceEmail] Could not generate invoice for order ${order.orderId}:`, genErr.message);
                if (throwOnError) throw genErr;
                return { skipped: true, reason: 'invoice_generation_failed', error: genErr.message };
            }
        }

        if (!invoice) {
            console.warn(`[InvoiceEmail] Invoice not found/generated for order ${order.orderId}`);
            if (throwOnError) throw new ApiError(404, 'Invoice not found.');
            return { skipped: true, reason: 'no_invoice' };
        }

        // Check if already sent (Duplicate email prevention)
        const alreadySent = invoice.emailDelivery?.sent === true || order.invoiceEmailSent === true;
        if (alreadySent && !forceResend) {
            console.log(`[InvoiceEmail] Invoice #${invoice.invoiceNumber} already emailed to customer for order ${order.orderId}. Skipping duplicate.`);
            return {
                skipped: true,
                reason: 'already_sent',
                invoiceNumber: invoice.invoiceNumber,
                sentAt: invoice.emailDelivery?.sentAt || order.invoiceEmailSentAt,
                recipientEmail: invoice.emailDelivery?.recipientEmail || invoice.customer?.email,
            };
        }

        // Resolve customer contact details
        const { email: recipientEmail, name: customerName } = await resolveCustomerContact(order);
        if (!recipientEmail) {
            console.warn(`[InvoiceEmail] No customer email found for order ${order.orderId}. Cannot send invoice email.`);
            await Invoice.updateOne(
                { _id: invoice._id },
                {
                    $set: {
                        'emailDelivery.sent': false,
                        'emailDelivery.error': 'Customer email address missing from order/user record.',
                    },
                }
            );
            if (throwOnError) throw new ApiError(400, 'Customer email address missing.');
            return { skipped: true, reason: 'missing_recipient_email' };
        }

        console.log(`[InvoiceEmail] Generating invoice PDF buffer and sending email to ${recipientEmail} for order ${order.orderId}...`);

        // Generate customer-facing PDF Buffer (no internal commissions/settlements)
        const pdfBuffer = await generateInvoicePdfBuffer(invoice, 'customer');

        // Send Email via existing email service
        const emailInfo = await sendInvoiceEmail({
            order,
            invoice,
            recipientEmail,
            customerName: customerName || invoice.customer?.name,
            pdfBuffer,
        });

        const now = new Date();

        // Update Invoice model with delivery audit
        await Invoice.updateOne(
            { _id: invoice._id },
            {
                $set: {
                    'emailDelivery.sent': true,
                    'emailDelivery.sentAt': now,
                    'emailDelivery.recipientEmail': recipientEmail,
                    'emailDelivery.messageId': emailInfo?.messageId || 'SENT',
                    'emailDelivery.error': '',
                    ...(forceResend ? {
                        'emailDelivery.lastResentAt': now,
                        ...(triggeredBy ? { 'emailDelivery.lastTriggeredBy': triggeredBy } : {}),
                    } : {}),
                },
                ...(forceResend ? { $inc: { 'emailDelivery.resendCount': 1 } } : {}),
            }
        );

        // Update Order model with delivery audit
        await Order.updateOne(
            { _id: order._id },
            {
                $set: {
                    invoiceEmailSent: true,
                    invoiceEmailSentAt: now,
                },
                $push: {
                    emailNotifications: {
                        status: 'invoice',
                        recipientEmail,
                        sentAt: now,
                        success: true,
                        messageId: emailInfo?.messageId || 'SENT',
                    },
                },
            }
        );

        console.log(`[InvoiceEmail] Successfully sent invoice #${invoice.invoiceNumber} to ${recipientEmail} for order ${order.orderId}`);

        return {
            success: true,
            invoiceNumber: invoice.invoiceNumber,
            recipientEmail,
            messageId: emailInfo?.messageId,
            sentAt: now,
        };
    } catch (error) {
        console.error(`[InvoiceEmail] Error sending invoice email for order ${orderId}:`, error?.message || error);

        // Record failure in Invoice and Order if documents exist
        try {
            const isObjectId = mongoose.Types.ObjectId.isValid(orderId);
            const ord = await Order.findOne({
                $or: [
                    { orderId: String(orderId) },
                    ...(isObjectId ? [{ _id: new mongoose.Types.ObjectId(orderId) }] : []),
                ],
            }).select('_id orderId shippingAddress guestInfo userId').lean();

            if (ord) {
                const { email: recipientEmail } = await resolveCustomerContact(ord);
                await Invoice.updateOne(
                    { orderId: ord._id },
                    {
                        $set: {
                            'emailDelivery.sent': false,
                            'emailDelivery.error': String(error?.message || 'Email sending failed'),
                        },
                    }
                );
                if (recipientEmail) {
                    await Order.updateOne(
                        { _id: ord._id },
                        {
                            $push: {
                                emailNotifications: {
                                    status: 'invoice',
                                    recipientEmail,
                                    sentAt: new Date(),
                                    success: false,
                                    error: String(error?.message || 'Email sending failed'),
                                },
                            },
                        }
                    );
                }
            }
        } catch (dbErr) {
            console.error('[InvoiceEmail] Failed to record email error in database:', dbErr.message);
        }

        if (throwOnError) {
            throw error;
        }

        return {
            success: false,
            error: error?.message || 'Email sending failed',
        };
    }
};

