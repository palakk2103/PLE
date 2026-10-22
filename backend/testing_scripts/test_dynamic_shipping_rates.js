import { shiprocketProvider } from '../src/modules/delivery/providers/shiprocket/shiprocketProvider.js';
import shiprocketClient from '../src/modules/delivery/providers/shiprocket/shiprocketClient.js';
import { calculateVendorShippingForGroups } from '../src/services/vendorShipping.service.js';

console.log('=== Shiprocket Dynamic Delivery Rate & COD Serviceability Verification ===\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`  ✅ [PASS] ${message}`);
    } else {
        console.error(`  ❌ [FAIL] ${message}`);
    }
}

async function runTests() {
    // Save original shiprocketClient.request
    const originalRequest = shiprocketClient.request;

    try {
        console.log('1. Testing Shiprocket Quote Selection Logic & COD Surcharge Handling:');

        // Mock Shiprocket API response for serviceability
        shiprocketClient.request = async (method, endpoint, data, params) => {
            if (endpoint === '/courier/serviceability/') {
                const isCod = Number(params?.cod) === 1;
                return {
                    status: 200,
                    data: {
                        recommended_courier_company_id: 24,
                        available_courier_companies: [
                            {
                                id: 24,
                                courier_company_id: 24,
                                courier_name: 'Delhivery Surface',
                                rate: isCod ? 75 : 55,
                                freight_charge: 55,
                                cod_charges: isCod ? 20 : 0,
                                cod: 1,
                                is_cod: 1,
                                etd: '2026-10-25 18:00:00',
                                estimated_delivery_days: '3',
                                rating: 4.6
                            },
                            {
                                id: 50,
                                courier_company_id: 50,
                                courier_name: 'Bluedart Air',
                                rate: isCod ? 120 : 100,
                                freight_charge: 100,
                                cod_charges: isCod ? 20 : 0,
                                cod: isCod ? 1 : 1,
                                is_cod: 1,
                                etd: '2026-10-24 14:00:00',
                                estimated_delivery_days: '2',
                                rating: 4.8
                            }
                        ]
                    }
                };
            }
            throw new Error(`Unexpected endpoint ${endpoint}`);
        };

        // Test 1: Prepaid rate
        const prepaidQuote = await shiprocketProvider.getQuote({
            pickupPincode: '110001',
            deliveryPincode: '400001',
            weight: 0.5,
            cod: 0,
            declaredValue: 1000
        });

        assert(prepaidQuote.isServiceable === true, 'Prepaid route is serviceable');
        assert(prepaidQuote.applicableRate === 55, `Prepaid applicable rate is ₹55 (got ${prepaidQuote.applicableRate})`);
        assert(prepaidQuote.selectedCourier?.courierName === 'Delhivery Surface', 'Delhivery Surface selected as recommended courier');

        // Test 2: COD rate
        const codQuote = await shiprocketProvider.getQuote({
            pickupPincode: '110001',
            deliveryPincode: '400001',
            weight: 0.5,
            cod: 1,
            declaredValue: 1000
        });

        assert(codQuote.isServiceable === true, 'COD route is serviceable');
        assert(codQuote.applicableRate === 75, `COD applicable rate is ₹75 including COD charge (got ${codQuote.applicableRate})`);
        assert(codQuote.isCodAvailable === true, 'COD is available on this route');
        assert(codQuote.applicableRate !== prepaidQuote.applicableRate, 'Prepaid and COD return different dynamic rates as expected');

        // Test 3: Cache verification
        let apiCalls = 0;
        const countingMock = shiprocketClient.request;
        shiprocketClient.request = async (...args) => {
            apiCalls++;
            return countingMock(...args);
        };

        // Identical parameters should return cached result without calling API
        const cachedQuote = await shiprocketProvider.getQuote({
            pickupPincode: '110001',
            deliveryPincode: '400001',
            weight: 0.5,
            cod: 1,
            declaredValue: 1000
        });
        assert(cachedQuote.applicableRate === 75, 'Cached quote returns correct rate');
        assert(apiCalls === 0, 'Quote was retrieved from in-memory cache without external API call');

        console.log('\n2. Testing Non-Serviceable COD Route:');
        shiprocketClient.request = async (method, endpoint, data, params) => {
            if (endpoint === '/courier/serviceability/') {
                return {
                    status: 200,
                    data: {
                        recommended_courier_company_id: 10,
                        available_courier_companies: [
                            {
                                id: 10,
                                courier_company_id: 10,
                                courier_name: 'Speed Post Prepaid Only',
                                rate: 45,
                                freight_charge: 45,
                                cod_charges: 0,
                                cod: 0, // No COD support
                                is_cod: 0
                            }
                        ]
                    }
                };
            }
            throw new Error(`Unexpected endpoint ${endpoint}`);
        };

        // Clear cache for fresh route test
        shiprocketProvider._quoteCache.clear();

        const nonCodQuote = await shiprocketProvider.getQuote({
            pickupPincode: '700001',
            deliveryPincode: '799001',
            weight: 1.0,
            cod: 1, // Customer wants COD
            declaredValue: 500
        });

        assert(nonCodQuote.isCodAvailable === false, 'Detects that COD is unavailable on route');
        assert(nonCodQuote.isServiceable === false, 'Route is marked non-serviceable for COD payment');

        console.log('\n3. Testing calculateVendorShippingForGroups Business Rules:');

        // Test 4: Free shipping coupon rule
        const freeShipResult = await calculateVendorShippingForGroups({
            vendorGroups: [
                { vendorId: 'vendor1', subtotal: 800, shippingEnabled: true },
                { vendorId: 'vendor2', subtotal: 400, shippingEnabled: true }
            ],
            shippingAddress: { zipCode: '110001' },
            couponType: 'freeship'
        });
        assert(freeShipResult.totalShipping === 0, 'Free shipping coupon gives ₹0 total shipping');
        assert(freeShipResult.shippingByVendor.vendor1 === 0, 'Vendor 1 shipping is 0');
        assert(freeShipResult.shippingByVendor.vendor2 === 0, 'Vendor 2 shipping is 0');

        // Test 5: Vendor Free Shipping Threshold
        const thresholdResult = await calculateVendorShippingForGroups({
            vendorGroups: [
                { vendorId: 'vendor1', subtotal: 1500, shippingEnabled: true, freeShippingThreshold: 1000 }
            ],
            shippingAddress: { zipCode: '110001' },
            paymentMethod: 'card'
        });
        assert(thresholdResult.totalShipping === 0, 'Subtotal exceeding vendor threshold gives ₹0 shipping');

        // Test 6: Fallback when Shiprocket API is unreachable
        shiprocketClient.request = async () => {
            throw new Error('Network timeout simulation');
        };
        shiprocketProvider._quoteCache.clear();

        const fallbackResult = await calculateVendorShippingForGroups({
            vendorGroups: [
                { vendorId: 'vendor_fallback', subtotal: 300, shippingEnabled: true, defaultShippingRate: 60 }
            ],
            shippingAddress: { zipCode: '560001' },
            paymentMethod: 'card'
        });
        assert(fallbackResult.totalShipping > 0, `Fallback provides valid shipping rate when provider fails (got ₹${fallbackResult.totalShipping})`);

        console.log(`\n==================================================`);
        console.log(`Result: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
        console.log(`==================================================\n`);

    } finally {
        shiprocketClient.request = originalRequest;
    }
}

runTests().catch(err => {
    console.error('Test execution failed with error:', err);
    process.exit(1);
});
