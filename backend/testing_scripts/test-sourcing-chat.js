/**
 * SourceNow (product request) chat integration test: real app + socket.io + in-memory MongoDB.
 * Run: node testing_scripts/test-sourcing-chat.js
 */
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh';
process.env.NODE_ENV = 'test';
for (const k of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS']) process.env[k] = '';

import assert from 'node:assert/strict';
import http from 'node:http';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { io: ioc } = require('../../frontend/node_modules/socket.io-client');

let failed = 0;
const check = async (name, fn) => {
    try { await fn(); console.log(`  PASS  ${name}`); }
    catch (e) { failed++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
await mongoose.connect(repl.getUri('chattest'));
const { default: app } = await import('../src/app.js');
const { signAccessToken } = await import('../src/config/jwt.js');
const M = (n) => import(`../src/models/${n}.model.js`).then((m) => m.default || m[n]);
const [User, Vendor, ProductRequest, VendorChatThread, ChatReport] =
    await Promise.all(['User', 'Vendor', 'ProductRequest', 'VendorChatThread', 'ChatReport'].map(M));

const server = http.createServer(app).listen(0);
(await import('../src/config/socket.js')).initSocket(server);
const port = server.address().port;
const base = `http://127.0.0.1:${port}/api`;
const tok = (id, role) => signAccessToken({ id: String(id), role, email: `${role}@test.com` });
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

const mkU = (n, e) => User.create({ name: n, email: e, password: 'x'.repeat(10), isVerified: true, isActive: true, role: 'customer' });
const cust = await mkU('Cathy', 'c@t.com');
const other = await mkU('Other', 'o@t.com');
const mkV = (n) => Vendor.create({ name: `V${n}`, email: `v${n}@t.com`, password: 'x'.repeat(10), storeName: `Store ${n}`, status: 'approved', isVerified: true });
const v1 = await mkV(1);
const v2 = await mkV(2);
const cT = tok(cust._id, 'customer');
const oT = tok(other._id, 'customer');
const v1T = tok(v1._id, 'vendor');
const v2T = tok(v2._id, 'vendor');

const pr = await ProductRequest.create({
    requestId: 'PR-TEST-1', userId: cust._id, requestType: 'GENERAL', productName: 'Widget', category: 'Misc',
    quantity: 5, expectedBudget: 1000, description: 'need widgets', status: 'Vendor Window Open',
    windowStatus: 'OPEN', windowExpiresAt: new Date(Date.now() + 864e5),
    assignedVendors: [{ vendorId: v1._id }],
});

let threadId;
await check('vendor accepts window -> chat thread auto-created & linked', async () => {
    const r = await call('POST', '/vendor/product-requests/PR-TEST-1/accept-window', v1T);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const fresh = await ProductRequest.findById(pr._id);
    assert.ok(fresh.chatThreadId, 'chatThreadId not set');
    threadId = String(fresh.chatThreadId);
    const t = await VendorChatThread.findById(threadId);
    assert.equal(String(t.customerUserId), String(cust._id));
    assert.equal(String(t.vendorId), String(v1._id));
});

await check('initiate chat is idempotent (same thread)', async () => {
    const r = await call('POST', '/vendor/product-requests/PR-TEST-1/chat/initiate', v1T);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(String(r.data._id), threadId);
    assert.equal(await VendorChatThread.countDocuments({ productRequestRef: pr._id }), 1);
});

await check('customer sees thread in list + system welcome message', async () => {
    const l = await call('GET', '/user/chat/vendor/threads', cT);
    assert.ok(l.data.some((t) => t._id === threadId));
    const m = await call('GET', `/user/chat/vendor/threads/${threadId}/messages`, cT);
    assert.equal(m.data[0].sender, 'system');
});

await check('non-participants are rejected', async () => {
    assert.equal((await call('GET', `/user/chat/vendor/threads/${threadId}/messages`, oT)).status, 404);
    assert.equal((await call('GET', `/vendor/chat/threads/${threadId}/messages`, v2T)).status, 404);
});

const connect = (token) => new Promise((res) => {
    const s = ioc(`http://127.0.0.1:${port}`, { transports: ['websocket'], auth: { token } });
    s.on('connect', () => res(s));
});
const cs = await connect(cT);
const vs = await connect(v1T);
const os = await connect(oT);
let otherErr = null;
os.on('error', (e) => { otherErr = e; });
for (const s of [cs, vs, os]) s.emit('join_chat_room', threadId);
await wait(500);
const got = { c: [], v: [], o: [] };
cs.on('new_message', (m) => got.c.push(m));
vs.on('new_message', (m) => got.v.push(m));
os.on('new_message', (m) => got.o.push(m));

await check('customer message reaches vendor live, not outsider', async () => {
    const r = await call('POST', `/user/chat/vendor/threads/${threadId}/messages`, cT, { message: 'Can you do 5 units?' });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    await wait(300);
    assert.ok(got.v.some((m) => m.message === 'Can you do 5 units?'), 'vendor did not get it');
    assert.equal(got.o.length, 0, 'outsider received message');
    assert.ok(otherErr, 'outsider not rejected');
});

await check('vendor reply reaches customer live', async () => {
    const r = await call('POST', `/vendor/chat/threads/${threadId}/messages`, v1T, { message: 'Yes, ready in 3 days' });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    await wait(300);
    assert.ok(got.c.some((m) => m.message === 'Yes, ready in 3 days'));
});

await check('vendor unread counter resets on mark-read', async () => {
    let t = await VendorChatThread.findById(threadId);
    assert.ok(t.unreadCount > 0);
    await call('PATCH', `/vendor/chat/threads/${threadId}/read`, v1T);
    t = await VendorChatThread.findById(threadId);
    assert.equal(t.unreadCount, 0);
});

await check('contact-sharing message is blocked (422)', async () => {
    const r = await call('POST', `/user/chat/vendor/threads/${threadId}/messages`, cT, { message: 'call me on 9876543210' });
    assert.equal(r.status, 422);
});

await check('report with UI reason codes works (both sides)', async () => {
    const a = await call('POST', `/user/chat/vendor/threads/${threadId}/report`, cT, { reason: 'OFF_PLATFORM_SOLICITATION', details: 'pushy' });
    assert.equal(a.status, 201, JSON.stringify(a.body));
    const b = await call('POST', `/vendor/chat/threads/${threadId}/report`, v1T, { reason: 'FRAUD', details: 'x' });
    assert.equal(b.status, 201, JSON.stringify(b.body));
    assert.equal((await ChatReport.findOne({ reporterType: 'customer' })).description, 'pushy');
});

await check('customer mute toggles', async () => {
    const r = await call('POST', `/user/chat/vendor/threads/${threadId}/mute`, cT);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.data.customerMuted, true);
});

await check('general vendor chat does not reuse sourcing thread', async () => {
    const r = await call('POST', '/user/chat/vendor/initiate', cT, { vendorId: String(v1._id) });
    assert.equal(r.status, 200);
    assert.notEqual(String(r.data._id), threadId);
});

await check('vendor block stops customer messages', async () => {
    await call('POST', `/vendor/chat/threads/${threadId}/block`, v1T);
    assert.equal((await call('POST', `/user/chat/vendor/threads/${threadId}/messages`, cT, { message: 'hello' })).status, 403);
    await call('POST', `/vendor/chat/threads/${threadId}/block`, v1T);
});

let propId;
const propEvents = [];
cs.on('transaction_proposal_updated', (p) => propEvents.push(p.status));
// Proposals must reference one of the vendor's own catalogue products (enforced by the API).
const Product = await M('Product');
const proposalProduct = await Product.create({ name: 'Studio Monitor', slug: 'studio-monitor', categoryId: new mongoose.Types.ObjectId(), price: 3000, vendorId: v1._id, stockQuantity: 50, stock: 'in_stock', isActive: true, isVisible: true, approvalStatus: 'approved' });
const body1 = { productId: String(proposalProduct._id), productName: 'Studio Monitor', quantity: 3, unitPrice: 2900, discount: 100, tax: 50, deliveryCharge: 150, notes: 'Includes stands' };

await check('vendor creates proposal; customer gets it live + via GET', async () => {
    const r = await call('POST', `/vendor/chat/threads/${threadId}/proposal`, v1T, body1);
    assert.equal(r.status, 201, JSON.stringify(r.body));
    propId = r.data._id;
    assert.equal(r.data.finalAmount, 3 * 2900 - 100 + 50 + 150, 'final amount math');
    await wait(300);
    assert.ok(propEvents.includes('pending_customer_confirmation'), 'no live proposal event');
    const g = await call('GET', `/user/chat/vendor/threads/${threadId}/proposal`, cT);
    assert.equal(g.data._id, propId);
});

await check('new proposal supersedes the pending one', async () => {
    const r = await call('POST', `/vendor/chat/threads/${threadId}/proposal`, v1T, { ...body1, unitPrice: 2800 });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.data.version, 2);
    const old = await call('GET', `/vendor/chat/threads/${threadId}/proposal`, v1T);
    assert.equal(old.data._id, r.data._id);
    propId = r.data._id;
});

await check('vendor cancel works; customer cannot respond to cancelled', async () => {
    const r = await call('PATCH', `/vendor/chat/threads/${threadId}/proposal/${propId}/cancel`, v1T);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const c = await call('POST', `/user/chat/vendor/threads/${threadId}/proposal/${propId}/respond`, cT, { action: 'ACCEPT' });
    assert.equal(c.status, 400);
});

await check('customer rejects a proposal with reason', async () => {
    const p = await call('POST', `/vendor/chat/threads/${threadId}/proposal`, v1T, body1);
    const r = await call('POST', `/user/chat/vendor/threads/${threadId}/proposal/${p.data._id}/respond`, cT, { action: 'REJECT', rejectionReason: 'too costly' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.data.status, 'rejected');
});

await check('checkout is refused before acceptance, outsider cannot respond', async () => {
    const p = await call('POST', `/vendor/chat/threads/${threadId}/proposal`, v1T, body1);
    propId = p.data._id;
    assert.equal((await call('POST', `/user/chat/vendor/threads/${threadId}/proposal/${propId}/checkout`, cT)).status, 400);
    assert.equal((await call('POST', `/user/chat/vendor/threads/${threadId}/proposal/${propId}/respond`, oT, { action: 'ACCEPT' })).status, 404);
});

await check('customer accepts -> vendor notified live, checkout payload correct', async () => {
    const before = got.v.length;
    const r = await call('POST', `/user/chat/vendor/threads/${threadId}/proposal/${propId}/respond`, cT, { action: 'ACCEPT' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    await wait(300);
    assert.ok(got.v.length > before, 'vendor not notified of acceptance');
    const c = await call('POST', `/user/chat/vendor/threads/${threadId}/proposal/${propId}/checkout`, cT);
    assert.equal(c.status, 200, JSON.stringify(c.body));
    assert.equal(c.data.total, 3 * 2900 - 100 + 50 + 150);
    assert.equal(c.data.quantity, 3);
    assert.equal(String(c.data.vendorId), String(v1._id));
    assert.equal((await call('POST', `/vendor/chat/threads/${threadId}/proposal/${propId}/cancel`, v1T)).status, 404);
});

await check('vendor cannot cancel an accepted proposal', async () => {
    const r = await call('PATCH', `/vendor/chat/threads/${threadId}/proposal/${propId}/cancel`, v1T);
    assert.equal(r.status, 400);
});

await check('proposal with contact info in notes is blocked', async () => {
    const r = await call('POST', `/vendor/chat/threads/${threadId}/proposal`, v1T, { ...body1, notes: 'pay me on 9876543210' });
    assert.equal(r.status, 422);
});

await check('release closes the chat for the customer', async () => {
    const r = await call('POST', '/vendor/product-requests/PR-TEST-1/release', v1T, { reason: 'no stock' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const s = await call('POST', `/user/chat/vendor/threads/${threadId}/messages`, cT, { message: 'hello?' });
    assert.equal(s.status, 400, JSON.stringify(s.body));
});

[cs, vs, os].forEach((s) => s.close());
server.close();
await mongoose.disconnect();
await repl.stop();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
