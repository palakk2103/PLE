/**
 * Isolated backend for browser-testing the CGST/SGST/IGST checkout display.
 * In-memory MongoDB; never touches the real database, never sends email.
 *   - Customer (cathy@example.com / Passw0rd!) has a default address in Maharashtra.
 *   - "MH Seller" is registered in Maharashtra (GSTIN 27...) -> intra-state -> CGST + SGST
 *   - "KA Seller" is in Karnataka                              -> inter-state -> IGST
 * Usage: node testing_scripts/e2e-gst-server.js [port]
 */
process.env.JWT_SECRET = 'e2e-secret';
process.env.JWT_REFRESH_SECRET = 'e2e-refresh';
process.env.NODE_ENV = 'test';
for (const k of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SHIPROCKET_EMAIL', 'SHIPROCKET_PASSWORD']) process.env[k] = '';
delete process.env.PLATFORM_GST_STATE;

import http from 'node:http';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const port = Number(process.argv[2] || 5056);
const repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
await mongoose.connect(repl.getUri('e2e_gst'));

const M = (n) => import(`../src/models/${n}.model.js`).then((m) => m.default || m[n]);
const [User, Vendor, Category, Product, Address] = await Promise.all(['User', 'Vendor', 'Category', 'Product', 'Address'].map(M));

const PASSWORD = 'Passw0rd!';
const customer = await User.create({ name: 'Cathy Customer', email: 'cathy@example.com', password: PASSWORD, phone: '9000000001', isVerified: true, isActive: true, role: 'customer' });
await Address.create({ userId: customer._id, name: 'Home', fullName: 'Cathy Customer', phone: '9000000001', address: '12 MG Road', city: 'Pune', state: 'Maharashtra', zipCode: '411001', country: 'India', isDefault: true });
const mh = await Vendor.create({ name: 'MH Seller', email: 'mh@example.com', password: PASSWORD, storeName: 'Mumbai Electronics', status: 'approved', isVerified: true, commissionRate: 10, gstNumber: '27ABCDE1234F1Z5', defaultGstRate: 18, shippingEnabled: false });
const ka = await Vendor.create({ name: 'KA Seller', email: 'ka@example.com', password: PASSWORD, storeName: 'Bengaluru Gadgets', status: 'approved', isVerified: true, commissionRate: 10, state: 'Karnataka', defaultGstRate: 18, shippingEnabled: false });
const cat = await Category.create({ name: 'Electronics', slug: 'electronics', isActive: true });
const base = { categoryId: cat._id, price: 1000, stockQuantity: 50, stock: 'in_stock', description: 'Test product', images: [], salesChannel: 'B2C', gstMode: 'custom', gstRate: 18, approvalStatus: 'approved', isActive: true, isVisible: true };
const pMH = await Product.create({ ...base, name: 'Mumbai Speaker', slug: 'mumbai-speaker', vendorId: mh._id });
const pKA = await Product.create({ ...base, name: 'Bengaluru Earbuds', slug: 'bengaluru-earbuds', vendorId: ka._id });

const { default: app } = await import('../src/app.js');
const server = http.createServer(app);
server.listen(port, '127.0.0.1', () => {
    console.log(JSON.stringify({ ready: true, port, customer: customer.email, password: PASSWORD, pMH: String(pMH._id), pKA: String(pKA._id) }));
});
