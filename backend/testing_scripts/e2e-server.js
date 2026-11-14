/**
 * Isolated backend for browser (Playwright) tests.
 * Uses an in-memory MongoDB replica set and a throwaway port; never touches the real database.
 * Usage: node testing_scripts/e2e-server.js [port] [seedJsonOutPath]
 */
process.env.JWT_SECRET = 'e2e-secret';
process.env.JWT_REFRESH_SECRET = 'e2e-refresh';
process.env.NODE_ENV = 'test';
for (const k of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS']) process.env[k] = '';

import fs from 'node:fs';
import http from 'node:http';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const port = Number(process.argv[2] || 5055);
const out = process.argv[3];

const repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
await mongoose.connect(repl.getUri('e2e'));

const M = (n) => import(`../src/models/${n}.model.js`).then((m) => m.default || m[n]);
const [User, Vendor, Admin, Category, Product, ManagedShop, Address] = await Promise.all(
    ['User', 'Vendor', 'Admin', 'Category', 'Product', 'ManagedShop', 'Address'].map(M),
);

const PASSWORD = 'Passw0rd!';
const SECRET = 'Secret#123';
const customer = await User.create({ name: 'Cathy Customer', email: 'cathy@example.com', password: PASSWORD, isVerified: true, isActive: true, role: 'customer' });
const customer2 = await User.create({ name: 'Other Customer', email: 'other@example.com', password: PASSWORD, isVerified: true, isActive: true, role: 'customer' });
const vendor1 = await Vendor.create({ name: 'Vera Vendor', email: 'vera@example.com', password: PASSWORD, storeName: 'Vera Electronics', status: 'approved', isVerified: true, commissionRate: 10 });
const vendor2 = await Vendor.create({ name: 'Vic Vendor', email: 'vic@example.com', password: PASSWORD, storeName: 'Vic Gadgets', status: 'approved', isVerified: true, commissionRate: 10 });
await Admin.create({
    name: 'Super Admin', email: 'admin@e2e.test', password: PASSWORD, role: 'superadmin', identityId: 'PLE-SA-000001', identityClass: 'superadmin',
    personalSecretHash: await bcrypt.hash(SECRET, 10), isActive: true, status: 'active',
});
await Address.create({ userId: customer._id, name: 'Home', fullName: 'Cathy Customer', phone: '9000000001', address: '12 MG Road', city: 'Pune', state: 'Maharashtra', zipCode: '411001', country: 'India', isDefault: true });

const cat = await Category.create({ name: 'Electronics', slug: 'electronics', isActive: true });
const shop = await ManagedShop.create({ name: 'PLE Shop' });
const base = { categoryId: cat._id, price: 1200, stockQuantity: 50, stock: 'in_stock', description: 'Test product', images: [], salesChannel: 'B2C' };
const adminProduct = await Product.create({ ...base, name: 'PLE Smart Speaker', slug: 'ple-smart-speaker', shopId: shop._id, listingType: 'admin_managed_listing', negotiatedSupplyPrice: 800 });
const vendorProduct = await Product.create({ ...base, name: 'Vera Wireless Earbuds', slug: 'vera-wireless-earbuds', vendorId: vendor1._id });

const { default: app } = await import('../src/app.js');
const { initSocket } = await import('../src/config/socket.js');
const server = http.createServer(app);
initSocket(server);
server.listen(port, '0.0.0.0', () => {
    const seed = {
        port, password: PASSWORD, secret: SECRET,
        customer: { email: customer.email, id: String(customer._id) },
        customer2: { email: customer2.email },
        vendor1: { email: vendor1.email, id: String(vendor1._id) },
        vendor2: { email: vendor2.email },
        admin: { email: 'admin@e2e.test', identityId: 'PLE-SA-000001' },
        adminProductId: String(adminProduct._id),
        vendorProductId: String(vendorProduct._id),
    };
    if (out) fs.writeFileSync(out, JSON.stringify(seed, null, 2));
    console.log(`E2E_READY ${port}`);
});

const stop = async () => { server.close(); await mongoose.disconnect(); await repl.stop(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
