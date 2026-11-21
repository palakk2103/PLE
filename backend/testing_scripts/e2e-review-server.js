/**
 * Isolated backend for browser-testing review photo upload + display.
 * In-memory MongoDB; Cloudinary is stubbed (files are copied to uploads/e2e-review and served
 * locally), so nothing is uploaded anywhere and the real database is never touched.
 *   - Customer riya@example.com / Passw0rd!  has a DELIVERED order for "Vee Headphones"
 *   - Admin    admin@example.com / Passw0rd!
 *   - Vendor   vee@example.com   / Passw0rd!  (store "Vee Electronics")
 * Usage: node testing_scripts/e2e-review-server.js [port]
 */
process.env.JWT_SECRET = 'e2e-secret';
process.env.JWT_REFRESH_SECRET = 'e2e-refresh';
process.env.NODE_ENV = 'test';
for (const k of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SHIPROCKET_EMAIL', 'SHIPROCKET_PASSWORD']) process.env[k] = '';

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const port = Number(process.argv[2] || 5057);
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '../uploads/e2e-review');
fs.mkdirSync(OUT, { recursive: true });

const repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
await mongoose.connect(repl.getUri('e2e_review'));

const { default: cloudinary } = await import('../src/config/cloudinary.js');
cloudinary.uploader.upload = async (filePath, opts) => {
    const name = path.basename(filePath);
    fs.copyFileSync(filePath, path.join(OUT, name));
    return { secure_url: `http://127.0.0.1:${port}/cdn/${name}`, public_id: name, resource_type: 'image' };
};

const M = (n) => import(`../src/models/${n}.model.js`).then((m) => m.default || m[n]);
const [User, Admin, Vendor, Category, Product, Order] = await Promise.all(['User', 'Admin', 'Vendor', 'Category', 'Product', 'Order'].map(M));

const PASSWORD = 'Passw0rd!';
const customer = await User.create({ name: 'Riya Reviewer', email: 'riya@example.com', password: PASSWORD, phone: '9000000002', isVerified: true, isActive: true, role: 'customer' });
await Admin.create({ name: 'Admin', email: 'admin@example.com', password: PASSWORD, role: 'superadmin', isActive: true });
const vendor = await Vendor.create({ name: 'Vee', email: 'vee@example.com', password: PASSWORD, storeName: 'Vee Electronics', status: 'approved', isVerified: true, commissionRate: 10 });
const cat = await Category.create({ name: 'Audio', slug: 'audio', isActive: true });
const product = await Product.create({ name: 'Vee Headphones', slug: 'vee-headphones', vendorId: vendor._id, categoryId: cat._id, price: 1500, stockQuantity: 20, stock: 'in_stock', description: 'Wireless headphones', images: [], salesChannel: 'B2C', approvalStatus: 'approved', isActive: true, isVisible: true });
const item = { productId: product._id, vendorId: vendor._id, name: product.name, price: 1500, quantity: 1 };
await Order.create({
    orderId: 'ORD-E2E-REVIEW-1', userId: customer._id, items: [item],
    vendorItems: [{ vendorId: vendor._id, vendorName: 'Vee Electronics', items: [item], subtotal: 1500, shipping: 0, tax: 0, discount: 0, status: 'delivered' }],
    shippingAddress: { name: 'Riya', phone: '9000000002', address: '1 Street', city: 'Pune', state: 'Maharashtra', zipCode: '411001', country: 'India' },
    paymentMethod: 'cod', paymentStatus: 'paid', status: 'delivered', subtotal: 1500, tax: 0, shipping: 0, total: 1500, deliveredAt: new Date(),
});

const { default: app } = await import('../src/app.js');
// Serve the stubbed "Cloudinary" files like a CDN would (cross-origin readable).
const cdn = (req, res) => {
    const file = path.join(OUT, path.basename(decodeURIComponent(req.url.split('?')[0])));
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'image/png', 'Cross-Origin-Resource-Policy': 'cross-origin', 'Access-Control-Allow-Origin': '*' });
    fs.createReadStream(file).pipe(res);
};
http.createServer((req, res) => (req.url.startsWith('/cdn/') ? cdn(req, res) : app(req, res))).listen(port, '127.0.0.1', () => {
    console.log(JSON.stringify({ ready: true, port, productId: String(product._id), slug: product.slug }));
});
