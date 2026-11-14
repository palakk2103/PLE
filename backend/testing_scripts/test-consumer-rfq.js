/**
 * Consumer RFQ integration tests (real Express app + in-memory MongoDB replica set).
 * Run:  node testing_scripts/test-consumer-rfq.js
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh';
process.env.NODE_ENV = 'test';
// Never send real email from tests (dotenv does not override already-set vars).
for (const k of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS']) process.env[k] = '';

import assert from 'node:assert/strict';
import http from 'node:http';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const results = [];
const check = async (name, fn) => {
    try { await fn(); results.push([name, true]); console.log(`  PASS  ${name}`); }
    catch (e) { results.push([name, false, e]); console.log(`  FAIL  ${name}\n        ${e.message}`); }
};

const repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
await mongoose.connect(repl.getUri('rfqtest'));

const { default: app } = await import('../src/app.js');
const { signAccessToken } = await import('../src/config/jwt.js');
const M = (n) => import(`../src/models/${n}.model.js`).then((m) => m.default || m[n]);
const [User, Vendor, Admin, Category, Product, ManagedShop, RFQ, Order, Commission, Address, Invoice] = await Promise.all(
    ['User', 'Vendor', 'Admin', 'Category', 'Product', 'ManagedShop', 'RFQ', 'Order', 'Commission', 'Address', 'Invoice'].map(M),
);

const server = http.createServer(app).listen(0);
(await import('../src/config/socket.js')).initSocket(server);
const base = `http://127.0.0.1:${server.address().port}/api`;
const call = async (method, path, token, body) => {
    const res = await fetch(base + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    });
    let json = {};
    try { json = await res.json(); } catch { /* empty */ }
    return { status: res.status, body: json, data: json.data };
};

/* ── seed ── */
const mkUser = (email, name) => User.create({ name, email, password: 'x'.repeat(10), isVerified: true, isActive: true, role: 'customer' });
const custA = await mkUser('a@test.com', 'Customer A');
const custB = await mkUser('b@test.com', 'Customer B');
const mkVendor = (n, rate) => Vendor.create({ name: `V${n}`, email: `v${n}@test.com`, password: 'x'.repeat(10), storeName: `Store ${n}`, status: 'approved', isVerified: true, commissionRate: rate });
const v1 = await mkVendor(1, 12);
const v2 = await mkVendor(2, 10);
const admin = await Admin.create({ name: 'Super Admin', email: 'admin@test.com', password: 'x'.repeat(10), role: 'superadmin' });
const cat = await Category.create({ name: 'Electronics', slug: 'electronics' });
const shop = await ManagedShop.create({ name: 'PLE Shop' });
const baseProd = { categoryId: cat._id, price: 120, stockQuantity: 100, stock: 'in_stock', image: 'x.png' };
const adminProd = await Product.create({ ...baseProd, name: 'Admin Listing', slug: 'admin-listing', shopId: shop._id, listingType: 'admin_managed_listing', negotiatedSupplyPrice: 70 });
const venProd = await Product.create({ ...baseProd, name: 'Vendor Item', slug: 'vendor-item', vendorId: v1._id });
const inactiveProd = await Product.create({ ...baseProd, name: 'Dead Item', slug: 'dead-item', vendorId: v1._id, isActive: false });
await Address.create({ userId: custA._id, name: 'Home', fullName: 'Customer A', phone: '9000000001', address: '1 Road', city: 'Pune', state: 'MH', zipCode: '411001', country: 'India', isDefault: true });

const tok = (id, role) => signAccessToken({ id: String(id), role, email: `${role}@test.com` });
const tA = tok(custA._id, 'customer'), tB = tok(custB._id, 'customer');
const tV1 = tok(v1._id, 'vendor'), tV2 = tok(v2._id, 'vendor');
const tAdmin = tok(admin._id, 'superadmin');

const stockOf = async (id) => (await Product.findById(id)).stockQuantity;
const mk = (productId, extra = {}) => call('POST', '/user/consumer-rfq', tA, { productId: String(productId), quantity: 5, expectedPrice: 90, message: 'Need bulk', ...extra });

/* ── A: admin-owned ── */
console.log('\nFlow A: admin-owned product');
let rfqA, startStock;
await check('create routes to admin (targetType=admin, no sellerId)', async () => {
    const r = await mk(adminProd._id);
    assert.equal(r.status, 201, JSON.stringify(r.body));
    rfqA = r.data;
    assert.equal(rfqA.targetType, 'admin'); assert.ok(!rfqA.sellerId); assert.equal(rfqA.status, 'Pending'); assert.equal(rfqA.awaiting, 'admin');
});
await check('client-supplied targetType/sellerId are ignored', async () => {
    const r = await mk(venProd._id, { targetType: 'admin', sellerId: String(v2._id) });
    assert.equal(r.status, 201); assert.equal(r.data.targetType, 'vendor'); assert.equal(String(r.data.sellerId._id), String(v1._id));
    await RFQ.deleteOne({ _id: r.data._id });
});
await check('vendor cannot see/act on admin-owned RFQ', async () => {
    assert.equal((await call('GET', '/vendor/consumer-rfq', tV1)).data.items.length, 0);
    assert.equal((await call('GET', `/vendor/consumer-rfq/${rfqA._id}`, tV1)).status, 404);
    assert.equal((await call('POST', `/vendor/consumer-rfq/${rfqA._id}/quote`, tV1, { price: 50 })).status, 404);
});
await check('admin lists it under scope=admin with full permissions', async () => {
    const l = await call('GET', '/admin/consumer-rfq?scope=admin', tAdmin);
    assert.ok(l.data.items.some((x) => x._id === rfqA._id));
    assert.equal(l.data.items[0].permissions.canQuote, true);
});
await check('admin quotes 100 -> Quotation Sent (v2)', async () => {
    const r = await call('POST', `/admin/consumer-rfq/${rfqA._id}/quote`, tAdmin, { price: 100, message: 'Best price' });
    assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.data.status, 'Quotation Sent'); assert.equal(r.data.currentOffer.version, 2); assert.equal(r.data.awaiting, 'customer');
});
await check('customer counters 95 -> Counter Offer (v3); admin revises 97 (v4)', async () => {
    let r = await call('POST', `/user/consumer-rfq/${rfqA._id}/counter`, tA, { price: 95 });
    assert.equal(r.status, 200); assert.equal(r.data.status, 'Counter Offer');
    r = await call('POST', `/admin/consumer-rfq/${rfqA._id}/quote`, tAdmin, { price: 97 });
    assert.equal(r.data.currentOffer.version, 4);
    assert.ok(r.data.consumerTimeline.length >= 4, 'history preserved');
});
await check('accepting an outdated quotation version is rejected (409)', async () => {
    const r = await call('POST', `/user/consumer-rfq/${rfqA._id}/accept`, tA, { offerVersion: 2 });
    assert.equal(r.status, 409);
});
await check('missing address blocks conversion for a customer with none', async () => {
    const own = await call('POST', '/user/consumer-rfq', tB, { productId: String(adminProd._id), quantity: 1, expectedPrice: 100 });
    await call('POST', `/admin/consumer-rfq/${own.data._id}/quote`, tAdmin, { price: 110 });
    const r = await call('POST', `/user/consumer-rfq/${own.data._id}/accept`, tB, { offerVersion: 2 });
    assert.equal(r.status, 400); assert.match(r.body.message, /address/i);
    assert.equal((await RFQ.findById(own.data._id)).status, 'Quotation Sent');
    await RFQ.deleteOne({ _id: own.data._id });
});
await check('customer accepts latest -> order (rfq type), stock deducted once, commission + invoice', async () => {
    startStock = await stockOf(adminProd._id);
    const r = await call('POST', `/user/consumer-rfq/${rfqA._id}/accept`, tA, { offerVersion: 4 });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.data.rfq.status, 'Converted To Order');
    const order = await Order.findById(r.data.order._id);
    assert.equal(order.orderType, 'rfq'); assert.equal(String(order.rfqId), rfqA._id);
    assert.equal(order.items[0].price, 97); assert.equal(order.items[0].quantity, 5); assert.equal(order.subtotal, 485);
    assert.equal(await stockOf(adminProd._id), startStock - 5);
    const com = await Commission.findOne({ orderId: order._id });
    assert.equal(com.vendorEarnings, 350, 'supply price 70*5'); assert.equal(com.commission, 135, 'admin margin');
    await new Promise((res) => setTimeout(res, 1500));
    assert.ok(await Invoice.findOne({ orderId: order._id }), 'invoice generated');
});
await check('duplicate acceptance -> 409, no extra order or stock deduction', async () => {
    const r = await call('POST', `/user/consumer-rfq/${rfqA._id}/accept`, tA, { offerVersion: 4 });
    assert.equal(r.status, 409);
    assert.equal(await Order.countDocuments({ rfqId: rfqA._id }), 1);
    assert.equal(await stockOf(adminProd._id), startStock - 5);
});
await check('converted RFQ rejects further price changes', async () => {
    assert.equal((await call('POST', `/admin/consumer-rfq/${rfqA._id}/quote`, tAdmin, { price: 1 })).status, 400);
    assert.equal((await call('POST', `/user/consumer-rfq/${rfqA._id}/counter`, tA, { price: 1 })).status, 400);
});

/* ── B: seller-owned ── */
console.log('\nFlow B: seller-owned product');
let rfqB;
await check('create routes to the actual vendor', async () => {
    const r = await mk(venProd._id);
    assert.equal(r.status, 201); rfqB = r.data;
    assert.equal(rfqB.targetType, 'vendor'); assert.equal(String(rfqB.sellerId._id), String(v1._id)); assert.equal(rfqB.awaiting, 'vendor');
});
await check('owning vendor sees it; other vendor does not', async () => {
    assert.ok((await call('GET', '/vendor/consumer-rfq', tV1)).data.items.some((x) => x._id === rfqB._id));
    assert.equal((await call('GET', '/vendor/consumer-rfq', tV2)).data.items.length, 0);
    assert.equal((await call('GET', `/vendor/consumer-rfq/${rfqB._id}`, tV2)).status, 404);
    assert.equal((await call('POST', `/vendor/consumer-rfq/${rfqB._id}/quote`, tV2, { price: 10 })).status, 404);
    assert.equal((await call('POST', `/vendor/consumer-rfq/${rfqB._id}/message`, tV2, { message: 'hi' })).status, 404);
});
await check('admin can monitor (read-only) but every mutation is 403', async () => {
    const d = await call('GET', `/admin/consumer-rfq/${rfqB._id}`, tAdmin);
    assert.equal(d.status, 200); assert.equal(d.data.permissions.readOnly, true); assert.equal(d.data.permissions.canQuote, false);
    assert.ok(d.data.buyerId.email, 'admin sees customer details');
    for (const [p, b] of [['quote', { price: 50 }], ['message', { message: 'hello' }], ['reject', {}], ['accept-offer', {}]]) {
        const r = await call('POST', `/admin/consumer-rfq/${rfqB._id}/${p}`, tAdmin, b);
        assert.equal(r.status, 403, `${p} should be 403, got ${r.status}`);
    }
    assert.equal((await call('POST', `/admin/rfq/${rfqB._id}/status`, tAdmin, { status: 'Approved' })).status, 404, 'legacy admin endpoint cannot touch consumer RFQs');
    assert.equal((await RFQ.findById(rfqB._id)).status, 'Pending');
});
await check('chat moderation blocks phone numbers in negotiation messages', async () => {
    const r = await call('POST', `/user/consumer-rfq/${rfqB._id}/message`, tA, { message: 'call me on 9876543210' });
    assert.equal(r.status, 400);
});
await check('vendor quotes, customer counters, vendor re-quotes, customer accepts', async () => {
    let r = await call('POST', `/vendor/consumer-rfq/${rfqB._id}/quote`, tV1, { price: 110 });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    r = await call('POST', `/user/consumer-rfq/${rfqB._id}/counter`, tA, { price: 100, message: 'Please reduce' });
    assert.equal(r.data.status, 'Counter Offer');
    r = await call('POST', `/vendor/consumer-rfq/${rfqB._id}/quote`, tV1, { price: 104 });
    const sBefore = await stockOf(venProd._id);
    r = await call('POST', `/user/consumer-rfq/${rfqB._id}/accept`, tA, { offerVersion: r.data.currentOffer.version });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const order = await Order.findById(r.data.order._id);
    assert.equal(String(order.vendorItems[0].vendorId), String(v1._id));
    assert.equal(await stockOf(venProd._id), sBefore - 5);
    const com = await Commission.findOne({ orderId: order._id });
    assert.equal(com.commissionRate, 12); assert.equal(com.commission, 62.4);
});
await check('admin sees converted order on the RFQ', async () => {
    const d = await call('GET', `/admin/consumer-rfq/${rfqB._id}`, tAdmin);
    assert.equal(d.data.status, 'Converted To Order'); assert.ok(d.data.convertedOrderId.orderId);
    assert.equal(d.data.consumerTimeline.filter((t) => t.action === 'converted').length, 1);
});

/* ── C: authorization ── */
console.log('\nAuthorization');
await check('customer B cannot read or act on customer A RFQ', async () => {
    assert.equal((await call('GET', `/user/consumer-rfq/${rfqB._id}`, tB)).status, 404);
    assert.equal((await call('POST', `/user/consumer-rfq/${rfqB._id}/counter`, tB, { price: 5 })).status, 404);
    assert.equal((await call('GET', '/user/consumer-rfq', tB)).data.items.length, 0);
});
await check('no token = 401; vendor/admin tokens blocked on customer API; customer blocked on vendor/admin API', async () => {
    assert.equal((await call('GET', '/user/consumer-rfq')).status, 401);
    assert.equal((await call('GET', '/user/consumer-rfq', tV1)).status, 403);
    assert.equal((await call('GET', '/vendor/consumer-rfq', tA)).status, 403);
    assert.equal((await call('GET', '/admin/consumer-rfq', tA)).status, 403);
});

/* ── E: edge cases ── */
console.log('\nEdge cases');
await check('validation: missing product, bad qty, negative/zero price, unknown product, inactive product', async () => {
    assert.equal((await call('POST', '/user/consumer-rfq', tA, { quantity: 1 })).status, 400);
    assert.equal((await mk(adminProd._id, { quantity: 0 })).status, 400);
    assert.equal((await mk(adminProd._id, { quantity: 1.5 })).status, 400);
    assert.equal((await mk(adminProd._id, { expectedPrice: -5 })).status, 400);
    assert.equal((await mk(adminProd._id, { expectedPrice: 0 })).status, 400);
    assert.equal((await mk(new mongoose.Types.ObjectId())).status, 404);
    assert.equal((await mk(inactiveProd._id)).status, 400);
    assert.equal((await mk(adminProd._id, { quantity: 100000 })).status, 400, 'more than stock');
});
await check('duplicate open RFQ for same product is blocked (409)', async () => {
    const a = await mk(adminProd._id); assert.equal(a.status, 201);
    assert.equal((await mk(adminProd._id)).status, 409);
    await RFQ.deleteOne({ _id: a.data._id });
});
await check('quote validation: price must be positive; quantity valid', async () => {
    const a = await mk(adminProd._id);
    assert.equal((await call('POST', `/admin/consumer-rfq/${a.data._id}/quote`, tAdmin, { price: -1 })).status, 400);
    assert.equal((await call('POST', `/admin/consumer-rfq/${a.data._id}/quote`, tAdmin, { price: 10, quantity: 0 })).status, 400);
    assert.equal((await call('POST', `/user/consumer-rfq/${a.data._id}/counter`, tA, { price: 10 })).status, 400, 'cannot counter before a quotation');
    await RFQ.deleteOne({ _id: a.data._id });
});
await check('insufficient stock at conversion -> 409, nothing changes (rollback)', async () => {
    const a = await mk(adminProd._id, { quantity: 10 });
    const q = await call('POST', `/admin/consumer-rfq/${a.data._id}/quote`, tAdmin, { price: 100 });
    await Product.updateOne({ _id: adminProd._id }, { stockQuantity: 3 });
    const r = await call('POST', `/user/consumer-rfq/${a.data._id}/accept`, tA, { offerVersion: q.data.currentOffer.version });
    assert.equal(r.status, 409);
    assert.equal((await RFQ.findById(a.data._id)).status, 'Quotation Sent');
    assert.equal(await stockOf(adminProd._id), 3); assert.equal(await Order.countDocuments({ rfqId: a.data._id }), 0);
    await Product.updateOne({ _id: adminProd._id }, { stockQuantity: 100, stock: 'in_stock' });
    await RFQ.deleteOne({ _id: a.data._id });
});
await check('concurrent acceptance: exactly one order, stock deducted once', async () => {
    const a = await mk(adminProd._id, { quantity: 4 });
    const q = await call('POST', `/admin/consumer-rfq/${a.data._id}/quote`, tAdmin, { price: 100 });
    const before = await stockOf(adminProd._id);
    const v = q.data.currentOffer.version;
    const rs = await Promise.all([1, 2, 3].map(() => call('POST', `/user/consumer-rfq/${a.data._id}/accept`, tA, { offerVersion: v })));
    const codes = rs.map((r) => r.status).sort();
    assert.equal(codes.filter((c) => c === 200).length, 1, `statuses: ${codes}`);
    assert.equal(await Order.countDocuments({ rfqId: a.data._id }), 1);
    assert.equal(await stockOf(adminProd._id), before - 4);
    assert.equal(await Commission.countDocuments({ orderId: (await Order.findOne({ rfqId: a.data._id }))._id }), 1);
});
await check('owner accepts customer offer -> price locked, then customer converts', async () => {
    const a = await mk(adminProd._id, { expectedPrice: 80 });
    let r = await call('POST', `/admin/consumer-rfq/${a.data._id}/accept-offer`, tAdmin, {});
    assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.data.status, 'Accepted'); assert.equal(r.data.finalAgreedPrice, 80);
    assert.equal((await call('POST', `/admin/consumer-rfq/${a.data._id}/quote`, tAdmin, { price: 999 })).status, 400, 'price locked');
    assert.equal((await call('POST', `/user/consumer-rfq/${a.data._id}/counter`, tA, { price: 1 })).status, 400);
    r = await call('POST', `/user/consumer-rfq/${a.data._id}/convert`, tA, {});
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal((await Order.findById(r.data.order._id)).items[0].price, 80);
});
await check('reject flow: customer rejects open RFQ; further actions blocked', async () => {
    const a = await mk(venProd._id);
    const r = await call('POST', `/user/consumer-rfq/${a.data._id}/reject`, tA, {});
    assert.equal(r.data.status, 'Rejected');
    assert.equal((await call('POST', `/vendor/consumer-rfq/${a.data._id}/quote`, tV1, { price: 5 })).status, 400);
    assert.equal((await call('POST', `/user/consumer-rfq/${a.data._id}/message`, tA, { message: 'x' })).status, 400);
});

/* ── D: regression (existing RFQ code paths) ── */
console.log('\nRegression: existing RFQ paths');
await check('managed RFQ schema still requires companyId/companyName/targetPrice', async () => {
    const err = new RFQ({ rfqId: 'RFQ-X', quantity: 1 }).validateSync();
    assert.ok(err.errors.companyId && err.errors.companyName && err.errors.targetPrice);
    const ok = new RFQ({ rfqId: 'RFQ-Y', quantity: 1, companyId: new mongoose.Types.ObjectId(), companyName: 'C', targetPrice: 5 }).validateSync();
    assert.equal(ok, undefined);
});
await check('legacy managed RFQ flows through legacy admin endpoints; consumer RFQs excluded from them', async () => {
    const m = await RFQ.create({ rfqId: 'RFQ-LEGACY-1', companyId: new mongoose.Types.ObjectId(), companyName: 'Acme', quantity: 10, targetPrice: 50, status: 'Submitted' });
    const l = await call('GET', '/admin/rfq', tAdmin);
    assert.equal(l.status, 200);
    assert.ok(l.data.some((x) => x._id === String(m._id)));
    assert.ok(l.data.every((x) => x.rfqType !== 'consumer'));
    const s = await call('POST', `/admin/rfq/${m._id}/status`, tAdmin, { status: 'Under Review', notes: 'ok' });
    assert.equal(s.status, 200, JSON.stringify(s.body));
    assert.equal((await RFQ.findById(m._id)).status, 'Under Review');
    assert.equal((await call('GET', '/admin/rfq/stats', tAdmin)).status, 200);
    assert.equal((await call('GET', '/user/rfq', tA)).data.every((x) => x.rfqType !== 'consumer'), true);
});

/* ── summary ── */
const failed = results.filter((r) => !r[1]);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
server.close();
await mongoose.disconnect();
await repl.stop();
process.exit(failed.length ? 1 : 0);
