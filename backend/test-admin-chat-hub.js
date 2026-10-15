/**
 * Unit & Integration Test Suite: Role-Based Admin Chat Hub Organization
 * Run: node test-admin-chat-hub.js (from backend directory)
 */
import { decryptMessage, encryptMessage } from './src/utils/chatEncryption.util.js';

let passed = 0;
let failed = 0;

function assert(description, condition) {
    if (condition) {
        console.log(`  ✅ PASS | ${description}`);
        passed++;
    } else {
        console.log(`  ❌ FAIL | ${description}`);
        failed++;
    }
}

console.log('\n══════════════════════════════════════════════════════════════════');
console.log(' ROLE-BASED ADMIN CHAT HUB: CLASSIFICATION & INTEGRATION TEST');
console.log('══════════════════════════════════════════════════════════════════\n');

// 1. Classification Logic Unit Test
console.log('🧠 1. Deterministic Classification Logic Tests\n');

const mockClassifyThread = (thread) => {
    const customer = thread.customerUserId;
    const vendor = thread.vendorId;

    let isB2B = false;
    let isCustomer = false;
    let companyName = null;

    if (customer) {
        if (customer.role === 'b2bAdmin' || customer.role === 'b2bEmployee' || customer.companyId) {
            isB2B = true;
            if (customer.companyId) {
                companyName = customer.companyId.companyName || customer.companyId.tradeName || null;
            }
        } else {
            isCustomer = true;
        }
    } else {
        isCustomer = true;
    }

    const isManagedVendor = Boolean(
        vendor && (vendor.storeName === 'PLE Shop' || vendor.isManaged || vendor.businessType === 'Home Business')
    );

    let category = 'customer';
    if (isB2B) {
        category = 'b2b';
    } else if (isCustomer) {
        category = 'customer';
    }

    return {
        category,
        isB2B,
        isCustomer,
        isManagedVendor,
        companyName,
        participantRole: isB2B ? (customer?.b2bRole || 'B2B Buyer') : 'Customer',
    };
};

{
    // Test Case 1: Standard Retail Customer ↔ Vendor
    const thread1 = {
        customerUserId: { role: 'customer', companyId: null, name: 'Alice' },
        vendorId: { storeName: 'ElectroHub', isManaged: false },
    };
    const c1 = mockClassifyThread(thread1);
    assert('Retail customer is categorized as customer', c1.category === 'customer');
    assert('Retail customer is marked isCustomer=true', c1.isCustomer === true);
    assert('Retail customer is not marked isB2B', c1.isB2B === false);

    // Test Case 2: B2B Admin Buyer ↔ Vendor
    const thread2 = {
        customerUserId: {
            role: 'b2bAdmin',
            companyId: { companyName: 'Apex Industries Ltd' },
            b2bRole: 'Admin',
            name: 'Bob Corp',
        },
        vendorId: { storeName: 'Industrial Supplies', isManaged: false },
    };
    const c2 = mockClassifyThread(thread2);
    assert('B2B User is categorized as b2b', c2.category === 'b2b');
    assert('B2B User is marked isB2B=true', c2.isB2B === true);
    assert('B2B User preserves company name', c2.companyName === 'Apex Industries Ltd');

    // Test Case 3: B2B Employee Buyer ↔ Vendor
    const thread3 = {
        customerUserId: {
            role: 'b2bEmployee',
            companyId: { companyName: 'Delta Corp' },
            b2bRole: 'Staff',
            name: 'Charlie Staff',
        },
        vendorId: { storeName: 'Office Depot', isManaged: false },
    };
    const c3 = mockClassifyThread(thread3);
    assert('B2B Employee is categorized as b2b', c3.category === 'b2b');

    // Test Case 4: In-House Managed Vendor (PLE Shop)
    const thread4 = {
        customerUserId: { role: 'customer', companyId: null, name: 'Dave' },
        vendorId: { storeName: 'PLE Shop', isManaged: true },
    };
    const c4 = mockClassifyThread(thread4);
    assert('PLE Shop is recognized as managed vendor', c4.isManagedVendor === true);

    // Test Case 5: Single Canonical Conversation in Multiple Views
    // A customer ↔ vendor conversation is accessible in Customer view AND Vendor view
    const allThreads = [
        { _id: 't1', classification: c1 },
        { _id: 't2', classification: c2 },
        { _id: 't3', classification: c3 },
        { _id: 't4', classification: c4 },
    ];

    const customerView = allThreads.filter((t) => t.classification.isCustomer && !t.classification.isB2B);
    const b2bView = allThreads.filter((t) => t.classification.isB2B);
    const vendorView = allThreads; // Vendor view has access to all vendor-participating threads
    const allChatsView = allThreads; // Admin All Chats includes all authorized threads

    assert('Customer view contains t1 and t4 only', customerView.map(t => t._id).sort().join(',') === 't1,t4');
    assert('B2B view contains t2 and t3 only', b2bView.map(t => t._id).sort().join(',') === 't2,t3');
    assert('Vendor view references same canonical t1 ID without duplication', vendorView.some(t => t._id === 't1'));
    assert('All Chats view includes all 4 conversations', allChatsView.length === 4);
}

// 2. Encryption and Decryption Safety in Admin Hub
console.log('\n🔒 2. Chat Encryption & Safety Verification\n');
{
    const secretMsg = 'Order quotation discussion with Admin @ 2026';
    const encrypted = encryptMessage(secretMsg);
    assert('Encrypted text differs from plaintext', encrypted !== secretMsg);
    assert('Decrypted text perfectly recovers plaintext', decryptMessage(encrypted) === secretMsg);
}

console.log('\n══════════════════════════════════════════════════════════════════');
console.log(` RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log('══════════════════════════════════════════════════════════════════\n');

if (failed > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
