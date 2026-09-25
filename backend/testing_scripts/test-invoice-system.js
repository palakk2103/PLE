import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { generateInvoicePdfBuffer, sendOrderInvoiceEmail } from '../src/services/invoice.service.js';
import { getInvoiceEmailTemplate } from '../src/utils/invoiceEmailTemplate.js';
import { Invoice } from '../src/models/Invoice.model.js';
import { Order } from '../src/models/Order.model.js';

async function runTests() {
    console.log('--- Starting Invoice & Email System Tests ---');

    // 1. Test Mock Invoice Data
    const mockInvoice = {
        invoiceNumber: 'INV-202609-TEST',
        orderNumber: 'ORD-987654',
        invoiceDate: new Date(),
        orderType: 'b2c',
        customer: {
            name: 'Priya Sharma',
            email: 'priya.sharma@example.com',
            phone: '+91 98765 43210'
        },
        shippingAddress: {
            name: 'Priya Sharma',
            address: '42 MG Road, Indiranagar',
            city: 'Bengaluru',
            state: 'Karnataka',
            zipCode: '560038',
            country: 'India',
            phone: '+91 98765 43210'
        },
        items: [
            {
                name: 'Sony WH-1000XM5 Wireless Headphones',
                quantity: 1,
                price: 29990,
                gstRate: 18,
                gstAmount: 4574.75,
                totalAmount: 29990
            },
            {
                name: 'Anker 65W Fast Charger',
                quantity: 2,
                price: 2499,
                gstRate: 18,
                gstAmount: 762.41,
                totalAmount: 4998
            }
        ],
        financialSummary: {
            subtotal: 34988,
            discount: 1000,
            tax: 5337.16,
            shipping: 0,
            grandTotal: 33988,
            amountPaid: 33988
        },
        payment: {
            method: 'upi',
            status: 'paid',
            gateway: 'Razorpay',
            transactionId: 'pay_ABC123XYZ'
        },
        status: 'paid'
    };

    const mockOrder = {
        orderId: 'ORD-987654',
        createdAt: new Date(),
        total: 33988,
        subtotal: 34988,
        discount: 1000,
        tax: 5337.16,
        shipping: 0,
        paymentMethod: 'upi',
        paymentStatus: 'paid',
        shippingAddress: mockInvoice.shippingAddress,
        items: mockInvoice.items
    };

    // Test 1: Generate in-memory PDF Buffer
    console.log('\n[Test 1] Testing vector PDF Buffer generation...');
    const pdfBuffer = await generateInvoicePdfBuffer(mockInvoice, 'customer');
    if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
        throw new Error('PDF Buffer is empty or not a Buffer.');
    }
    const pdfHeader = pdfBuffer.slice(0, 5).toString('ascii');
    if (!pdfHeader.startsWith('%PDF')) {
        throw new Error(`PDF Header invalid: got ${pdfHeader}`);
    }
    console.log(`✅ PDF Buffer successfully generated! Size: ${pdfBuffer.length} bytes, Header: ${pdfHeader}`);

    // Test 2: Generate HTML Email Template
    console.log('\n[Test 2] Testing HTML Email Template rendering...');
    const htmlEmail = getInvoiceEmailTemplate({
        order: mockOrder,
        invoice: mockInvoice,
        customerName: mockInvoice.customer.name,
        storeName: 'Peoples League of Electronics'
    });

    if (!htmlEmail || typeof htmlEmail !== 'string') {
        throw new Error('HTML Email output is invalid.');
    }

    const checks = [
        'Peoples League of Electronics',
        'INV-202609-TEST',
        'ORD-987654',
        'Sony WH-1000XM5',
        'Anker 65W Fast Charger',
        '₹33,988.00',
        'Invoice PDF Attached',
        'View Order & Bill Online',
    ];

    for (const check of checks) {
        if (!htmlEmail.includes(check)) {
            throw new Error(`HTML Email missing expected substring: "${check}"`);
        }
    }
    console.log(`✅ HTML Email template generated cleanly (${htmlEmail.length} chars) with all required billing sections.`);

    // Test 3: Verify Mongoose Schemas have email tracking fields
    console.log('\n[Test 3] Verifying Schema definitions...');
    const invoicePaths = Invoice.schema.paths;
    if (!invoicePaths['emailDelivery.sent'] || !invoicePaths['emailDelivery.recipientEmail']) {
        throw new Error('Invoice schema missing emailDelivery fields.');
    }
    const orderPaths = Order.schema.paths;
    if (!orderPaths['invoiceEmailSent']) {
        throw new Error('Order schema missing invoiceEmailSent field.');
    }
    console.log('✅ Invoice and Order schema tracking paths are properly defined.');

    // Test 4: Verify sendOrderInvoiceEmail function contract
    console.log('\n[Test 4] Verifying sendOrderInvoiceEmail contract...');
    if (typeof sendOrderInvoiceEmail !== 'function') {
        throw new Error('sendOrderInvoiceEmail is not an exported function.');
    }
    // Test with missing orderId (should return skipped without throwing)
    const result = await sendOrderInvoiceEmail(null);
    if (!result?.skipped) {
        throw new Error('Expected sendOrderInvoiceEmail(null) to return skipped: true.');
    }
    console.log('✅ sendOrderInvoiceEmail handled empty input safely without throwing.');

    console.log('\n🎉 ALL INVOICE & EMAIL SYSTEM TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
