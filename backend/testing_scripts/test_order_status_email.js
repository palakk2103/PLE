import '../src/loadEnv.js';
import dns from 'dns';
try {
    dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {}
import mongoose from 'mongoose';
import Order from '../src/models/Order.model.js';
import { handleOrderStatusTransition } from '../src/services/orderStatus.service.js';
import { ORDER_STATUSES } from '../src/constants/orderStatus.constants.js';

async function runTests() {
    console.log('=== STARTING ORDER STATUS & EMAIL NOTIFICATION VERIFICATION TESTS ===\n');

    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/appzeto';
    await mongoose.connect(mongoUri);
    console.log('✓ Connected to MongoDB');

    const testOrderId = `TEST-ORD-${Date.now()}`;
    let testOrder = null;

    try {
        // --- TEST 1: Initial Order Creation (pending / Order Confirmed) ---
        console.log('\n--- TEST 1: Create Order & Transition to Pending (Order Confirmed) ---');
        testOrder = await Order.create({
            orderId: testOrderId,
            guestInfo: {
                name: 'Test Customer',
                email: 'test.customer@example.com',
                phone: '9876543210',
            },
            shippingAddress: {
                name: 'Test Customer',
                email: 'test.customer@example.com',
                phone: '9876543210',
                address: '123 Tech Lane, Electronic City',
                city: 'Bengaluru',
                state: 'Karnataka',
                zipCode: '560100',
                country: 'India',
            },
            items: [
                {
                    name: 'Noise Cancelling Wireless Headphones',
                    price: 2999,
                    quantity: 1,
                },
            ],
            subtotal: 2999,
            shipping: 100,
            tax: 540,
            discount: 0,
            total: 3639,
            status: 'pending',
        });

        await handleOrderStatusTransition(testOrder, ORDER_STATUSES.PENDING, {
            note: 'Order placed by customer',
            updatedByRole: 'user',
        });

        let reloaded = await Order.findOne({ orderId: testOrderId });
        if (reloaded.status !== 'pending') throw new Error(`Expected pending, got ${reloaded.status}`);
        if (!reloaded.statusHistory || reloaded.statusHistory.length === 0) throw new Error('statusHistory is empty');
        console.log(`✓ Order initialized with status: ${reloaded.status}`);
        console.log(`✓ statusHistory count: ${reloaded.statusHistory.length} (latest: ${reloaded.statusHistory[0].status})`);

        // --- TEST 2: Progression to Packed (processing) ---
        console.log('\n--- TEST 2: Transition to Packed (processing) ---');
        await handleOrderStatusTransition(reloaded, ORDER_STATUSES.PROCESSING, {
            note: 'Vendor packed all items',
            updatedByRole: 'vendor',
        });

        reloaded = await Order.findOne({ orderId: testOrderId });
        if (reloaded.status !== 'processing') throw new Error(`Expected processing, got ${reloaded.status}`);
        if (!reloaded.processingAt) throw new Error('processingAt timestamp was not set');
        if (reloaded.statusHistory.length !== 2) throw new Error(`Expected 2 history entries, got ${reloaded.statusHistory.length}`);
        console.log(`✓ Order status updated to: ${reloaded.status}`);
        console.log(`✓ processingAt timestamp set: ${reloaded.processingAt.toISOString()}`);
        console.log(`✓ statusHistory count: ${reloaded.statusHistory.length}`);

        // --- TEST 3: Progression to Shipped ---
        console.log('\n--- TEST 3: Transition to Shipped ---');
        reloaded.trackingNumber = `AWB-${Date.now()}`;
        await handleOrderStatusTransition(reloaded, ORDER_STATUSES.SHIPPED, {
            note: 'Dispatched via Express Courier',
            updatedByRole: 'admin',
        });

        reloaded = await Order.findOne({ orderId: testOrderId });
        if (reloaded.status !== 'shipped') throw new Error(`Expected shipped, got ${reloaded.status}`);
        if (!reloaded.shippedAt) throw new Error('shippedAt timestamp was not set');
        if (reloaded.statusHistory.length !== 3) throw new Error(`Expected 3 history entries, got ${reloaded.statusHistory.length}`);
        console.log(`✓ Order status updated to: ${reloaded.status}`);
        console.log(`✓ shippedAt timestamp set: ${reloaded.shippedAt.toISOString()}`);

        // --- TEST 4: Progression to Out for Delivery ---
        console.log('\n--- TEST 4: Transition to Out for Delivery ---');
        await handleOrderStatusTransition(reloaded, ORDER_STATUSES.OUT_FOR_DELIVERY, {
            note: 'Delivery executive out for final delivery',
            updatedByRole: 'delivery',
        });

        reloaded = await Order.findOne({ orderId: testOrderId });
        if (reloaded.status !== 'out_for_delivery') throw new Error(`Expected out_for_delivery, got ${reloaded.status}`);
        if (!reloaded.outForDeliveryAt) throw new Error('outForDeliveryAt timestamp was not set');
        if (reloaded.statusHistory.length !== 4) throw new Error(`Expected 4 history entries, got ${reloaded.statusHistory.length}`);
        console.log(`✓ Order status updated to: ${reloaded.status}`);
        console.log(`✓ outForDeliveryAt timestamp set: ${reloaded.outForDeliveryAt.toISOString()}`);

        // --- TEST 5: Progression to Delivered ---
        console.log('\n--- TEST 5: Transition to Delivered ---');
        await handleOrderStatusTransition(reloaded, ORDER_STATUSES.DELIVERED, {
            note: 'Delivered and OTP verified by customer',
            updatedByRole: 'delivery',
        });

        reloaded = await Order.findOne({ orderId: testOrderId });
        if (reloaded.status !== 'delivered') throw new Error(`Expected delivered, got ${reloaded.status}`);
        if (!reloaded.deliveredAt) throw new Error('deliveredAt timestamp was not set');
        if (reloaded.statusHistory.length !== 5) throw new Error(`Expected 5 history entries, got ${reloaded.statusHistory.length}`);
        console.log(`✓ Order status updated to: ${reloaded.status}`);
        console.log(`✓ deliveredAt timestamp set: ${reloaded.deliveredAt.toISOString()}`);

        // --- TEST 6: Duplicate Status Protection ---
        console.log('\n--- TEST 6: Duplicate Status Protection (calling delivered again) ---');
        const countBefore = reloaded.statusHistory.length;
        await handleOrderStatusTransition(reloaded, ORDER_STATUSES.DELIVERED, {
            note: 'Accidental duplicate call',
            updatedByRole: 'system',
        });

        reloaded = await Order.findOne({ orderId: testOrderId });
        if (reloaded.statusHistory.length !== countBefore) {
            throw new Error(`Duplicate status history entry created! Expected ${countBefore}, got ${reloaded.statusHistory.length}`);
        }
        console.log('✓ Duplicate status update safely skipped without duplicate history entry');

        // --- TEST 7: Duplicate Email Protection ---
        console.log('\n--- TEST 7: Duplicate Email Protection ---');
        // Manually record that delivered email was sent
        await Order.updateOne(
            { orderId: testOrderId },
            {
                $push: {
                    emailNotifications: {
                        status: 'delivered',
                        recipientEmail: 'test.customer@example.com',
                        sentAt: new Date(),
                        success: true,
                        messageId: 'MOCK-MSG-123',
                    },
                },
            }
        );

        reloaded = await Order.findOne({ orderId: testOrderId });
        const emailNotificationsCountBefore = reloaded.emailNotifications.length;

        // Force a status transition call and verify duplicate email is not re-sent
        await handleOrderStatusTransition(reloaded, ORDER_STATUSES.DELIVERED, {
            force: true,
            notifyCustomer: true,
        });

        reloaded = await Order.findOne({ orderId: testOrderId });
        const emailNotificationsCountAfter = reloaded.emailNotifications.length;
        if (emailNotificationsCountAfter !== emailNotificationsCountBefore) {
            throw new Error(`Duplicate email sent! Count before: ${emailNotificationsCountBefore}, after: ${emailNotificationsCountAfter}`);
        }
        console.log('✓ Duplicate email prevented successfully');

        // --- TEST 8: Email Failure Resilience ---
        console.log('\n--- TEST 8: Email Failure Resilience (status update must succeed even if SMTP fails) ---');
        const failOrderId = `FAIL-TEST-${Date.now()}`;
        const failOrder = await Order.create({
            orderId: failOrderId,
            guestInfo: {
                name: 'Failing Email Customer',
                email: 'invalid-email-address',
            },
            status: 'pending',
            total: 1500,
        });

        // Temporarily break SMTP host to simulate failure
        const originalHost = process.env.SMTP_HOST;
        process.env.SMTP_HOST = 'invalid.unreachable.smtp.domain';

        try {
            // Update status to processing with invalid SMTP
            await handleOrderStatusTransition(failOrder, ORDER_STATUSES.PROCESSING, {
                note: 'Testing SMTP failure resilience',
                notifyCustomer: true,
            });

            const reloadedFailOrder = await Order.findOne({ orderId: failOrderId });
            if (reloadedFailOrder.status !== 'processing') {
                throw new Error('Order status failed to update due to email error!');
            }
            console.log('✓ Order status in DB updated to processing despite email failure');
            console.log('✓ Email failure was caught gracefully without throwing to caller');
        } finally {
            process.env.SMTP_HOST = originalHost;
            await Order.deleteOne({ orderId: failOrderId });
        }

        console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
        // Wait briefly for asynchronous email callbacks to settle before disconnecting
        await new Promise((resolve) => setTimeout(resolve, 2500));
    } catch (err) {
        console.error('\n❌ TEST FAILED:', err);
        process.exitCode = 1;
    } finally {
        if (testOrder) {
            await Order.deleteOne({ orderId: testOrderId });
            console.log('\n✓ Cleaned up test orders');
        }
        await mongoose.disconnect();
        console.log('✓ Disconnected from MongoDB');
    }
}

runTests();
