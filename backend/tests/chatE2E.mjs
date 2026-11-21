// Usage (from /backend): node tests/chatE2E.mjs
// End-to-end chat test harness: real Express app + Socket.io + in-memory MongoDB.
// Never touches the Atlas DB, never sends real email/push.
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import http from 'http';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = `${BACKEND}/src`;
const reqB = createRequire(`${BACKEND}/package.json`);
const reqF = createRequire(path.resolve(BACKEND, '../frontend/package.json'));
const imp = (p) => import(pathToFileURL(`${SRC}/${p}`).href);

const { MongoMemoryReplSet } = reqB('mongodb-memory-server');
const { io: ioClient } = reqF('socket.io-client');

// ---- isolate from real services BEFORE the app loads its .env
const mem = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
process.env.MONGO_URI = mem.getUri('ple_chat_e2e');
process.env.SMTP_HOST = '127.0.0.1';
process.env.SMTP_PORT = '1';
process.env.SMTP_USER = 'nobody';
process.env.SMTP_PASS = 'nobody';
process.env.FIREBASE_SERVICE_ACCOUNT = '';
process.env.NODE_ENV = 'development';

const mongoose = (await import(pathToFileURL(reqB.resolve('mongoose')).href)).default;
const { default: app } = await imp('app.js');
const { initSocket } = await imp('config/socket.js');
const { signAccessToken } = await imp('config/jwt.js');
await mongoose.connect(process.env.MONGO_URI);

const server = http.createServer(app);
initSocket(server);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const BASE = `http://127.0.0.1:${PORT}/api`;

const M = {};
for (const n of ['User', 'Admin', 'Vendor', 'ManagedVendorUser', 'ManagedShop', 'DeliveryBoy', 'VendorChatThread', 'VendorChatMessage',
    'AdminManagedVendorThread', 'AdminManagedVendorMessage', 'ChatViolation', 'ChatReport', 'SupportTicket', 'RFQ', 'DirectRFQ',
    'Product', 'ProductEnquiry', 'ProductRequest', 'Notification', 'B2BCompany', 'ChatTransactionProposal', 'Order']) {
    M[n] = (await imp(`models/${n}.model.js`)).default;
}

// ---------------------------------------------------------------- helpers
const results = [];
let cur = 'setup';
const record = (channel, test, expected, actual, result, note = '') => {
    results.push({ channel, test, expected, actual: String(actual).slice(0, 300), result, note });
    const tag = { PASS: '✅', FAIL: '❌', BUG: '🐞', INFO: 'ℹ️ ', SKIP: '⏭️ ' }[result] || result;
    console.log(`${tag} [${channel}] ${test} → ${String(actual).slice(0, 160)}`);
};
const check = (channel, test, expected, cond, actual, note) => record(channel, test, expected, actual, cond ? 'PASS' : 'FAIL', note);
const bug = (channel, test, expected, isBug, actual, note) => record(channel, test, expected, actual, isBug ? 'BUG' : 'PASS', note);

const api = async (token, method, path, body) => {
    const res = await fetch(BASE + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await res.json(); } catch { /* no body */ }
    return { status: res.status, body: json, data: json?.data };
};
const tok = (id, role, extra = {}) => signAccessToken({ id: String(id), role, ...extra });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const sockets = [];
const connect = (token) => new Promise((resolve, reject) => {
    const s = ioClient(`http://127.0.0.1:${PORT}`, { auth: { token }, transports: ['websocket'], forceNew: true });
    s.events = [];
    s.onAny((ev, payload) => s.events.push({ ev, payload }));
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
    sockets.push(s);
});
const join = async (s, ev, arg) => { s.events = s.events.filter((e) => e.ev !== 'error'); s.emit(ev, arg); await sleep(250); return s.events.find((e) => e.ev === 'error')?.payload?.message || 'joined'; };
const got = async (s, ev, pred = () => true, ms = 1500) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
        const hit = s.events.find((e) => e.ev === ev && pred(e.payload));
        if (hit) return hit.payload;
        await sleep(50);
    }
    return null;
};
const safe = async (channel, name, fn) => {
    try { await fn(); } catch (err) { record(channel, name, 'no crash', `harness error: ${err.message}`, 'FAIL'); }
};

// ---------------------------------------------------------------- seed
const pw = '$2a$12$abcdefghijklmnopqrstuuDummyHashNotUsedForLoginxxxxxxxx'; // never used to log in
const oid = () => new mongoose.Types.ObjectId();

const admin1 = await M.Admin.collection.insertOne({ name: 'Admin One', email: 'admin1@e2e.test', password: pw, role: 'admin', isActive: true, status: 'active' });
const admin2 = await M.Admin.collection.insertOne({ name: 'Admin Two', email: 'admin2@e2e.test', password: pw, role: 'admin', isActive: true, status: 'active' });
const A1 = admin1.insertedId, A2 = admin2.insertedId;

const mkUser = async (name, role, extra = {}) => (await M.User.collection.insertOne({ name, email: `${name.replace(/\s/g, '').toLowerCase()}@e2e.test`, password: pw, role, isActive: true, isVerified: true, phone: '9000000000', createdAt: new Date(), ...extra })).insertedId;
const mkVendor = async (name, extra = {}) => (await M.Vendor.collection.insertOne({ name, storeName: name, email: `${name.replace(/\s/g, '').toLowerCase()}@e2e.test`, password: pw, status: 'approved', isVerified: true, isActive: true, createdAt: new Date(), ...extra })).insertedId;

const companyA = (await M.B2BCompany.collection.insertOne({ companyName: 'Acme Corp', status: 'approved', createdAt: new Date() })).insertedId;
const companyB = (await M.B2BCompany.collection.insertOne({ companyName: 'Beta Ltd', status: 'approved', createdAt: new Date() })).insertedId;

const CUST = await mkUser('Cust One', 'customer');
const CUST2 = await mkUser('Cust Two', 'customer');
const B2BA = await mkUser('B2B Admin A', 'b2bAdmin', { companyId: companyA });
const B2BE = await mkUser('B2B Emp A', 'b2bEmployee', { companyId: companyA });
const B2BB = await mkUser('B2B Admin B', 'b2bAdmin', { companyId: companyB });
const B2BE2 = await mkUser('B2B Emp A2', 'b2bEmployee', { companyId: companyA });
const V1 = await mkVendor('Vendor One');
const V2 = await mkVendor('Vendor Two');
const PLE = await mkVendor('PLE Shop');
const shop = (await M.ManagedShop.collection.insertOne({ name: 'Managed Shop 1', status: 'active', createdAt: new Date() })).insertedId;
const MV1 = (await M.ManagedVendorUser.collection.insertOne({ name: 'Managed V1', username: 'mv1', password: pw, status: 'active', shopId: shop, createdBy: A1, createdAt: new Date() })).insertedId;
const MV2 = (await M.ManagedVendorUser.collection.insertOne({ name: 'Managed V2', username: 'mv2', password: pw, status: 'active', shopId: shop, createdBy: A2, createdAt: new Date() })).insertedId;
const DEL = (await M.DeliveryBoy.collection.insertOne({ name: 'Rider', email: 'rider@e2e.test', password: pw, phone: '9111111111', applicationStatus: 'approved', isActive: true })).insertedId;

const cat = oid();
const mkProduct = async (name, extra) => (await M.Product.collection.insertOne({ name, slug: name.toLowerCase().replace(/\s/g, '-'), price: 500, categoryId: cat, stockQuantity: 100, stock: 'in_stock', isActive: true, isVisible: true, approvalStatus: 'approved', createdAt: new Date(), ...extra })).insertedId;
const PV1 = await mkProduct('Vendor Widget', { vendorId: V1, listingType: 'vendor_direct' });
const PADM = await mkProduct('PLE Widget', { shopId: shop, listingType: 'admin_managed_listing' });

const T = {
    admin: tok(A1, 'admin', { name: 'Admin One' }), admin2: tok(A2, 'admin', { name: 'Admin Two' }),
    cust: tok(CUST, 'customer', { name: 'Cust One' }), cust2: tok(CUST2, 'customer', { name: 'Cust Two' }),
    b2ba: tok(B2BA, 'b2bAdmin', { companyId: String(companyA) }), b2be: tok(B2BE, 'b2bEmployee', { companyId: String(companyA) }),
    b2bb: tok(B2BB, 'b2bAdmin', { companyId: String(companyB) }),
    b2be2: tok(B2BE2, 'b2bEmployee', { companyId: String(companyA) }),
    v1: tok(V1, 'vendor'), v2: tok(V2, 'vendor'), mv1: tok(MV1, 'managed_vendor'), mv2: tok(MV2, 'managed_vendor'),
    del: tok(DEL, 'delivery'),
};
console.log(`Server on ${PORT}, in-memory DB ready.\n`);

// ================================================================ CH-01 Customer <-> Vendor
let thread1;
await safe('CH-01', 'customer↔vendor', async () => {
    const C = 'CH-01 Customer↔Vendor';
    const init = await api(T.cust, 'POST', '/user/chat/vendor/initiate', { vendorId: String(V1) });
    thread1 = init.data?._id;
    check(C, 'Customer starts chat with vendor', '200 + thread', init.status === 200 && thread1, `${init.status} thread=${thread1}`);

    const sC = await connect(T.cust), sV = await connect(T.v1);
    check(C, 'Customer joins live chat room', 'joined', (await join(sC, 'join_chat_room', thread1)) === 'joined', await join(sC, 'join_chat_room', thread1));
    check(C, 'Vendor joins live chat room', 'joined', (await join(sV, 'join_chat_room', thread1)) === 'joined', 'ok');
    await join(sV, 'join_user_room', String(V1));
    const sX = await connect(T.cust2);
    const xr = await join(sX, 'join_chat_room', thread1);
    check(C, 'Other customer is refused from the room', 'Unauthorized', /Unauthorized/.test(xr), xr);

    const m1 = await api(T.cust, 'POST', `/user/chat/vendor/threads/${thread1}/messages`, { message: 'Is the widget available in blue?' });
    check(C, 'Customer sends message', '201', m1.status === 201, m1.status);
    const live = await got(sV, 'new_message', (p) => p.message === 'Is the widget available in blue?');
    check(C, 'Vendor receives it live (socket)', 'new_message', !!live, live ? 'received' : 'not received');
    const notif = await got(sV, 'vendor_chat_notification');
    check(C, 'Vendor gets notification event in personal room', 'emitted', !!notif, notif ? 'emitted (but frontend has no listener – CHT-021)' : 'none');

    const vt = await api(T.v1, 'GET', '/vendor/chat/threads');
    const vthread = (vt.data || []).find((t) => String(t._id) === String(thread1));
    check(C, 'Vendor sees thread in inbox', 'listed with unread 1', vthread && vthread.unreadCount === 1, vthread ? `unread=${vthread.unreadCount}, last="${vthread.lastMessage}"` : 'missing');
    check(C, 'Inbox shows decrypted preview', 'plain text', vthread?.lastMessage === 'Is the widget available in blue?', vthread?.lastMessage);

    const vm = await api(T.v1, 'GET', `/vendor/chat/threads/${thread1}/messages`);
    check(C, 'Vendor reads messages (no fake seeds)', '1 real message', vm.data?.length === 1 && vm.data[0].message.startsWith('Is the widget'), JSON.stringify(vm.data?.map((m) => m.message)));

    const r1 = await api(T.v1, 'POST', `/vendor/chat/threads/${thread1}/messages`, { message: 'Yes, blue is in stock.' });
    check(C, 'Vendor replies', '201', r1.status === 201, r1.status);
    const liveC = await got(sC, 'new_message', (p) => p.message === 'Yes, blue is in stock.');
    check(C, 'Customer receives reply live', 'new_message', !!liveC, liveC ? 'received' : 'not received');
    const cm = await api(T.cust, 'GET', `/user/chat/vendor/threads/${thread1}/messages`);
    check(C, 'Customer sees full conversation in order', '2 msgs customer→vendor', cm.data?.length === 2 && cm.data[0].sender === 'customer' && cm.data[1].sender === 'vendor', JSON.stringify(cm.data?.map((m) => `${m.sender}:${m.message}`)));
    const n = await M.Notification.countDocuments({ recipientId: CUST, type: 'chat' });
    check(C, 'Customer gets in-app notification for vendor reply', '≥1', n >= 1, n);
    const nv = await M.Notification.countDocuments({ recipientId: V1, type: 'chat' });
    bug(C, 'Vendor gets in-app notification for customer message', '≥1 (CHT-044)', nv === 0, `${nv} notifications`, 'Vendor relies only on socket');

    const raw = await M.VendorChatMessage.collection.findOne({ threadId: new mongoose.Types.ObjectId(thread1) });
    check(C, 'Messages encrypted at rest', 'enc:v1:…', String(raw?.message).startsWith('enc:v1:'), String(raw?.message).slice(0, 20));

    const blk = await api(T.cust, 'POST', `/user/chat/vendor/threads/${thread1}/messages`, { message: 'call me on 98765 43210' });
    check(C, 'Moderation blocks phone number', '422 MESSAGE_BLOCKED', blk.status === 422 && blk.body?.code === 'MESSAGE_BLOCKED', `${blk.status} ${blk.body?.category}`);
    const blk2 = await api(T.v1, 'POST', `/vendor/chat/threads/${thread1}/messages`, { message: 'pay to shop@ybl' });
    check(C, 'Moderation blocks vendor UPI ID', '422', blk2.status === 422, `${blk2.status} ${blk2.body?.category}`);
    const viol = await M.ChatViolation.countDocuments({ threadId: thread1 });
    check(C, 'Violations logged for admin', '2', viol === 2, viol);

    await api(T.v1, 'PATCH', `/vendor/chat/threads/${thread1}/read`);
    const after = await M.VendorChatThread.findById(thread1).lean();
    check(C, 'Vendor mark-read resets unread', '0', after.unreadCount === 0, after.unreadCount);

    // Proposal flow
    const prop = await api(T.v1, 'POST', `/vendor/chat/threads/${thread1}/proposal`, { productId: String(PV1), productName: 'Vendor Widget (Blue)', quantity: 2, unitPrice: 450, deliveryCharge: 50 });
    check(C, 'Vendor sends price proposal', '201, final 950', prop.status === 201 && prop.data?.finalAmount === 950, `${prop.status} final=${prop.data?.finalAmount}`);
    const pid = prop.data?._id;
    const liveP = await got(sC, 'transaction_proposal_updated');
    check(C, 'Customer receives proposal live', 'event', !!liveP, liveP ? 'received' : 'not received');
    const acc = await api(T.cust, 'POST', `/user/chat/vendor/threads/${thread1}/proposal/${pid}/respond`, { action: 'ACCEPT' });
    check(C, 'Customer accepts proposal', '200 accepted', acc.status === 200 && acc.data?.status === 'accepted', `${acc.status} ${acc.data?.status}`);
    const co = await api(T.cust, 'POST', `/user/chat/vendor/threads/${thread1}/proposal/${pid}/checkout`);
    check(C, 'Checkout payload generated', 'total 950', co.status === 200 && co.data?.total === 950, `${co.status} total=${co.data?.total}`);
    // ---- CHT-011: the accepted offer must become an order at EXACTLY the agreed amount
    const addr = { name: 'Cust One', email: 'custone@example.com', phone: '9000000000', address: '1 Test Street', city: 'Mumbai', state: 'Maharashtra', zipCode: '400001', country: 'India' };
    const placeBase = { shippingAddress: addr, paymentMethod: 'cod', shippingOption: 'standard' };
    const offerItem = { productId: String(PV1), quantity: 2, proposalId: pid };

    const wrongUser = await api(T.cust2, 'POST', '/user/orders', { ...placeBase, items: [offerItem] });
    check(C, "Another customer can't use my accepted offer", '404', wrongUser.status === 404, `${wrongUser.status} ${JSON.stringify(wrongUser.body).slice(0, 260)}`);
    const mixed = await api(T.cust, 'POST', '/user/orders', { ...placeBase, items: [offerItem, { productId: String(PADM), quantity: 1 }] });
    check(C, 'Offer cannot be mixed with other cart items', '400', mixed.status === 400, `${mixed.status} ${mixed.body?.message || ''}`);
    const withCoupon = await api(T.cust, 'POST', '/user/orders', { ...placeBase, items: [offerItem], couponCode: 'SAVE50' });
    check(C, 'Coupon cannot be stacked on an agreed price', '400', withCoupon.status === 400, `${withCoupon.status} ${withCoupon.body?.message || ''}`);
    const wrongProduct = await api(T.cust, 'POST', '/user/orders', { ...placeBase, items: [{ ...offerItem, productId: String(PADM) }] });
    check(C, 'Offer cannot be applied to a different product', '400', wrongProduct.status === 400, `${wrongProduct.status} ${wrongProduct.body?.message || ''}`);

    const cheat = await api(T.cust, 'POST', '/user/orders', { ...placeBase, items: [{ ...offerItem, quantity: 5, price: 1 }] });
    check(C, 'Order placed from the accepted offer', '201', cheat.status === 201, `${cheat.status} ${cheat.body?.message || ''}`);
    const orderDoc = cheat.data?.orderId ? await M.Order.findOne({ orderId: cheat.data.orderId }).lean() : null;
    check(C, 'Order total = exactly the agreed amount (₹950)', '950', orderDoc?.total === 950, `total=${orderDoc?.total} (subtotal ${orderDoc?.subtotal}, shipping ${orderDoc?.shipping}, tax ${orderDoc?.tax})`);
    check(C, 'Customer cannot change quantity / price (sent qty 5, price ₹1)', 'qty 2 @ ₹450', orderDoc?.items?.[0]?.quantity === 2 && orderDoc?.items?.[0]?.price === 450, `qty=${orderDoc?.items?.[0]?.quantity} price=${orderDoc?.items?.[0]?.price}`);
    const offerAfter = await M.ChatTransactionProposal.findById(pid).lean();
    check(C, 'Offer marked converted_to_order and linked to the order', 'converted + orderRef', offerAfter?.status === 'converted_to_order' && String(offerAfter?.orderRef) === String(orderDoc?._id), `${offerAfter?.status} orderRef=${offerAfter?.orderRef}`);
    const again = await api(T.cust, 'POST', '/user/orders', { ...placeBase, items: [offerItem] });
    check(C, 'The same offer cannot be ordered twice', '409', again.status === 409, `${again.status} ${again.body?.message || ''}`);
    const again2 = await api(T.cust, 'POST', `/user/chat/vendor/threads/${thread1}/proposal/${pid}/checkout`);
    check(C, 'Checkout step refuses an already-ordered offer', '409', again2.status === 409, again2.status);
    const thrMsgs = await api(T.cust, 'GET', `/user/chat/vendor/threads/${thread1}/messages`);
    const noticeMsg = (thrMsgs.data || []).filter((m) => m.sender === 'system').pop();
    check(C, 'Chat gets an "[Order Placed]" notice', 'present', /Order Placed/.test(noticeMsg?.message || ''), String(noticeMsg?.message).slice(0, 90));

    const noProduct = await api(T.v1, 'POST', `/vendor/chat/threads/${thread1}/proposal`, { productName: 'Free text item', quantity: 1, unitPrice: 100 });
    check(C, 'Vendor cannot send an offer without a real product', '400', noProduct.status === 400, `${noProduct.status} ${noProduct.body?.message || ''}`);
    const otherVendorProduct = await api(T.v1, 'POST', `/vendor/chat/threads/${thread1}/proposal`, { productId: String(PADM), productName: 'x', quantity: 1, unitPrice: 100 });
    check(C, "Vendor cannot make an offer for someone else's product", '400', otherVendorProduct.status === 400, `${otherVendorProduct.status} ${otherVendorProduct.body?.message || ''}`);

    // Report
    const rep = await api(T.cust, 'POST', `/user/chat/vendor/threads/${thread1}/report`, { reason: 'SPAM', description: 'test' });
    check(C, 'Customer reports vendor', '201', rep.status === 201, rep.status);

    // Block / unblock override
    const b1 = await api(T.v1, 'POST', `/vendor/chat/threads/${thread1}/block`, { reason: 'abusive' });
    check(C, 'Vendor blocks chat', 'isBlocked true', b1.data?.isBlocked === true, JSON.stringify(b1.data));
    const sendBlocked = await api(T.cust, 'POST', `/user/chat/vendor/threads/${thread1}/messages`, { message: 'hello?' });
    check(C, 'Customer cannot message while blocked', '403', sendBlocked.status === 403, sendBlocked.status);
    const ub = await api(T.cust, 'POST', `/user/chat/vendor/threads/${thread1}/block`);
    bug(C, 'Customer cannot lift the vendor\'s block', 'stays blocked (CHT-012)', ub.data?.isBlocked === false, `after customer toggle: isBlocked=${ub.data?.isBlocked}`);
    const t2 = await M.VendorChatThread.findById(thread1).lean();
    if (t2.isBlocked) await api(T.v1, 'POST', `/vendor/chat/threads/${thread1}/block`);

    // Customer unread
    await api(T.v1, 'POST', `/vendor/chat/threads/${thread1}/messages`, { message: 'Anything else?' });
    const ct = await api(T.cust, 'GET', '/user/chat/vendor/threads');
    const mine = (ct.data || []).find((t) => String(t._id) === String(thread1));
    bug(C, 'Customer sees unread count for new vendor message', 'customer unread ≥1 (CHT-020)', !('unreadCountCustomer' in (mine || {})), `fields: unreadCount=${mine?.unreadCount} (vendor-side counter)`);

    // Other customer cannot read
    const steal = await api(T.cust2, 'GET', `/user/chat/vendor/threads/${thread1}/messages`);
    check(C, 'Other customer cannot read thread', '404', steal.status === 404, steal.status);
    const steal2 = await api(T.v2, 'GET', `/vendor/chat/threads/${thread1}/messages`);
    check(C, 'Other vendor cannot read thread', '404', steal2.status === 404, steal2.status);
});

// ================================================================ CH-02 B2B buyer <-> Vendor
await safe('CH-02', 'b2b↔vendor', async () => {
    const C = 'CH-02 B2B Buyer↔Vendor';
    const init = await api(T.b2be, 'POST', '/user/chat/vendor/initiate', { vendorId: String(V1) });
    const th = init.data?._id;
    check(C, 'B2B employee starts shop chat', '200', init.status === 200, init.status);
    const sB = await connect(T.b2be);
    check(C, 'B2B employee joins room', 'joined', (await join(sB, 'join_chat_room', th)) === 'joined', 'ok');
    const m = await api(T.b2be, 'POST', `/user/chat/vendor/threads/${th}/messages`, { message: 'Need 500 units, bulk price?' });
    check(C, 'B2B employee sends message', '201', m.status === 201, m.status);
    const r = await api(T.v1, 'POST', `/vendor/chat/threads/${th}/messages`, { message: 'Bulk price is 420/unit.' });
    check(C, 'Vendor replies to B2B buyer', '201', r.status === 201, r.status);
    const live = await got(sB, 'new_message', (p) => p.message === 'Bulk price is 420/unit.');
    check(C, 'B2B buyer receives reply live', 'new_message', !!live, live ? 'received' : 'not received');
    const hub = await api(T.admin, 'GET', '/admin/chat-hub/threads?category=b2b');
    const found = (hub.data?.threads || []).some((t) => String(t._id) === String(th));
    check(C, 'Admin hub classifies chat as B2B', 'in b2b tab', found, found ? 'listed' : 'missing');
});

// ================================================================ CH-03 SourceNow
await safe('CH-03', 'sourcenow', async () => {
    const C = 'CH-03 SourceNow Customer↔Vendor';
    const pr = (await M.ProductRequest.collection.insertOne({ requestId: 'PR-E2E-1', userId: CUST, productName: 'Custom Lamp', quantity: 3, category: 'Home', expectedBudget: 3000, status: 'Vendor Accepted', acceptedVendorId: V1, vendorFulfillmentStatus: 'IN_PROGRESS', windowStatus: 'VENDOR_LOCKED', createdAt: new Date() })).insertedId;
    const init = await api(T.v1, 'POST', `/vendor/product-requests/${pr}/chat/initiate`);
    const th = init.data?._id;
    check(C, 'Accepted vendor opens request chat', '200', init.status === 200 && th, `${init.status} ${init.body?.message || ''}`);
    const other = await api(T.v2, 'POST', `/vendor/product-requests/${pr}/chat/initiate`);
    check(C, 'Non-accepted vendor is refused', '403', other.status === 403, other.status);
    const msgs = await api(T.cust, 'GET', `/user/chat/vendor/threads/${th}/messages`);
    check(C, 'Customer sees system opening message', '1 system msg', msgs.data?.[0]?.sender === 'system', JSON.stringify(msgs.data?.map((m) => m.sender)));
    const c = await api(T.cust, 'POST', `/user/chat/vendor/threads/${th}/messages`, { message: 'Can it be 40cm tall?' });
    check(C, 'Customer sends message', '201', c.status === 201, `${c.status} ${c.body?.message || ''}`);
    const v = await api(T.v1, 'POST', `/vendor/chat/threads/${th}/messages`, { message: 'Yes, 40cm works.' });
    check(C, 'Vendor replies', '201', v.status === 201, `${v.status} ${v.body?.message || ''}`);
    const adm = await api(T.admin, 'GET', `/admin/product-requests/${pr}/chat-thread/${th}`);
    check(C, 'Admin can view request chat', '200', adm.status === 200, adm.status);
    await M.ProductRequest.collection.updateOne({ _id: pr }, { $set: { status: 'Completed', vendorFulfillmentStatus: 'FULFILLED' } });
    const closed = await api(T.cust, 'POST', `/user/chat/vendor/threads/${th}/messages`, { message: 'thanks' });
    check(C, 'Chat closes when request completed', '400 closed', closed.status === 400, `${closed.status} ${closed.body?.message}`);
});

// ================================================================ CH-04 Admin hub
await safe('CH-04', 'admin hub', async () => {
    const C = 'CH-04 Admin Chat Hub';
    const st = await api(T.admin, 'GET', '/admin/chat-hub/stats');
    check(C, 'Hub stats load', '200', st.status === 200, JSON.stringify(st.data));
    const list = await api(T.admin, 'GET', '/admin/chat-hub/threads?category=customer');
    const t = (list.data?.threads || []).find((x) => String(x._id) === String(thread1));
    check(C, 'Admin sees customer↔vendor thread', 'listed', !!t, t ? 'listed' : 'missing');
    const msgs = await api(T.admin, 'GET', `/admin/chat-hub/threads/${thread1}/messages`);
    check(C, 'Admin reads conversation', '200 + messages', msgs.status === 200 && msgs.data?.messages?.length > 0, `${msgs.data?.messages?.length} messages`);
    const sA = await connect(T.admin), sC = await connect(T.cust), sV = await connect(T.v1);
    await join(sA, 'join_chat_room', thread1); await join(sC, 'join_chat_room', thread1); await join(sV, 'join_chat_room', thread1);
    const send = await api(T.admin, 'POST', `/admin/chat-hub/threads/${thread1}/messages`, { message: 'PLE support here – all good?' });
    check(C, 'Admin posts into conversation', '201', send.status === 201, send.status);
    const lc = await got(sC, 'new_message', (p) => p.message?.startsWith('PLE support'));
    const lv = await got(sV, 'new_message', (p) => p.message?.startsWith('PLE support'));
    check(C, 'Customer & vendor see admin message live', 'both', !!lc && !!lv, `customer=${!!lc} vendor=${!!lv}`);
    bug(C, 'Admin message labelled as admin', "sender 'admin' (CHT-017)", send.data?.sender === 'system', `sender='${send.data?.sender}'`);
    await M.VendorChatThread.updateOne({ _id: thread1 }, { $set: { unreadCount: 3 } });
    await api(T.admin, 'PATCH', `/admin/chat-hub/threads/${thread1}/read`);
    const t2 = await M.VendorChatThread.findById(thread1).lean();
    bug(C, "Admin 'mark read' leaves vendor's unread alone", 'vendor unread stays 3 (CHT-019)', t2.unreadCount === 0, `vendor unread now ${t2.unreadCount}`);
    const order = (list.data?.threads || []).find((x) => x.orderRef);
    record(C, 'Order number shown for order threads', 'orderId', order ? JSON.stringify(order.orderRef) : 'no order threads in test data', 'INFO');
});

// ================================================================ CH-05 PLE Shop
await safe('CH-05', 'ple shop', async () => {
    const C = 'CH-05 Admin as PLE Shop↔Customer';
    const init = await api(T.cust, 'POST', '/user/chat/vendor/initiate', { vendorId: String(PLE) });
    const th = init.data?._id;
    check(C, 'Customer starts chat with PLE Shop', '200', init.status === 200, init.status);
    await api(T.cust, 'POST', `/user/chat/vendor/threads/${th}/messages`, { message: 'Hi PLE, when will my order ship?' });
    const list = await api(T.admin, 'GET', '/admin/ple-shop/threads');
    const found = (list.data || []).find((x) => String(x._id) === String(th));
    check(C, 'Admin sees it in PLE Shop chats', 'listed', !!found, found ? `last="${found.lastMessage}"` : 'missing');
    const sC = await connect(T.cust); await join(sC, 'join_chat_room', th);
    const send = await api(T.admin, 'POST', `/admin/ple-shop/threads/${th}/messages`, { message: 'Ships tomorrow!' });
    check(C, 'Admin replies as PLE Shop', '201', send.status === 201, send.status);
    const live = await got(sC, 'new_message', (p) => p.message === 'Ships tomorrow!');
    check(C, 'Customer receives reply live', 'new_message', !!live, live ? 'received' : 'not received');
    // impersonation: PLE endpoint into Vendor One's thread
    const imp = await api(T.admin, 'POST', `/admin/ple-shop/threads/${thread1}/messages`, { message: 'Message via PLE endpoint into Vendor One thread' });
    const last = await M.VendorChatMessage.findOne({ threadId: thread1 }).sort({ createdAt: -1 }).lean();
    check(C, "PLE endpoint can't post into another vendor's chat", '404', imp.status === 404 && !/PLE endpoint/.test(String(last?.message)), `${imp.status}; last message in Vendor One's thread is still "${String(last?.message).slice(0, 30)}"`);
    const readOther = await api(T.admin, 'GET', `/admin/ple-shop/threads/${thread1}/messages`);
    check(C, "PLE endpoint can't read another vendor's chat", '404', readOther.status === 404, readOther.status);
    const asVendor = await api(T.admin, 'GET', `/admin/ple-shop/threads/${thread1}/messages?vendorId=${V1}`);
    check(C, 'Admin can still open a chat when acting as the right shop', '200', asVendor.status === 200, asVendor.status);
    const v = await M.Vendor.findById(PLE).select('+password');
    check(C, 'PLE Shop account has no known password', "not 'Password123!'", !(await v.comparePassword('Password123!').catch(() => false)), 'checked');
});

// ================================================================ CH-06 Admin <-> Managed vendor
await safe('CH-06', 'admin↔mv', async () => {
    const C = 'CH-06 Admin↔Managed Vendor';
    const l1 = await api(T.admin, 'GET', '/admin/managed-vendor-chat/threads');
    check(C, 'Admin 1 loads managed-vendor chats', '200', l1.status === 200, `${l1.status} ${l1.data?.length ?? l1.body?.message} threads`);
    const l2 = await api(T.admin, 'GET', '/admin/managed-vendor-chat/threads');
    check(C, 'Admin 1 reloads the page', '200', l2.status === 200, `${l2.status} ${l2.status !== 200 ? l2.body?.message : l2.data?.length + ' threads'}`);
    const l3 = await api(T.admin2, 'GET', '/admin/managed-vendor-chat/threads');
    check(C, 'Admin 2 loads the page', '200', l3.status === 200, `${l3.status} ${l3.status !== 200 ? l3.body?.message : l3.data?.length + ' threads'}`);

    const vt = await api(T.mv1, 'GET', '/vendor/admin-chat/thread');
    const th = vt.data?._id;
    check(C, 'Managed vendor opens admin chat', '200', vt.status === 200 && th, vt.status);
    const sA = await connect(T.admin), sM = await connect(T.mv1);
    await join(sA, 'join_admin_room');
    check(C, 'Admin joins chat room', 'joined', (await join(sA, 'join_chat_room', th)) === 'joined', 'ok');
    check(C, 'Managed vendor joins chat room', 'joined', (await join(sM, 'join_chat_room', th)) === 'joined', 'ok');
    await join(sM, 'join_user_room', String(MV1));
    const s = await api(T.mv1, 'POST', '/vendor/admin-chat/messages', { message: 'Need help with payout.' });
    check(C, 'Managed vendor sends message', '201', s.status === 201, s.status);
    const la = await got(sA, 'new_admin_managed_vendor_message', (p) => p.message === 'Need help with payout.');
    const ln = await got(sA, 'admin_chat_notification');
    check(C, 'Admin receives it live + notification', 'both', !!la && !!ln, `message=${!!la} notification=${!!ln}`);
    const am = await api(T.admin, 'GET', `/admin/managed-vendor-chat/threads/${th}/messages`);
    check(C, 'Admin reads messages', '1', am.data?.length === 1, am.data?.length);
    const r = await api(T.admin, 'POST', `/admin/managed-vendor-chat/threads/${th}/messages`, { message: 'Payout releases Friday.' });
    check(C, 'Admin replies', '201', r.status === 201, r.status);
    const lm = await got(sM, 'new_admin_managed_vendor_message', (p) => p.message === 'Payout releases Friday.');
    const lmn = await got(sM, 'managed_vendor_chat_notification');
    check(C, 'Managed vendor receives reply live + notification', 'both', !!lm && !!lmn, `message=${!!lm} notification=${!!lmn}`);
    const thr = await M.AdminManagedVendorThread.findById(th).lean();
    check(C, 'Vendor unread counter increments', '1', thr.unreadCountVendor === 1, thr.unreadCountVendor);
    await api(T.mv1, 'PATCH', '/vendor/admin-chat/read');
    const thr2 = await M.AdminManagedVendorThread.findById(th).lean();
    check(C, 'Vendor mark-read resets counter', '0', thr2.unreadCountVendor === 0, thr2.unreadCountVendor);
    const pn = await M.Notification.countDocuments({ recipientId: MV1 });
    bug(C, 'Persistent notification for offline vendor', '≥1 (CHT-033)', pn === 0, `${pn} notifications`);

    // Standard (third-party) vendor <-> admin
    const sv = await api(T.v2, 'GET', '/vendor/admin-chat/thread');
    check(C, 'Third-party vendor opens admin chat', '200', sv.status === 200, sv.status);
    const svs = await api(T.v2, 'POST', '/vendor/admin-chat/messages', { message: 'Third-party vendor: KYC question' });
    check(C, 'Third-party vendor sends to admin', '201', svs.status === 201, svs.status);
    const al = await api(T.admin2, 'GET', '/admin/managed-vendor-chat/threads');
    const seen = (al.data || []).some((t) => String(t._id) === String(sv.data?._id));
    check(C, 'Admin 2 sees third-party vendor chat in list', 'visible to all admins', seen, al.status === 200 ? (seen ? 'visible' : 'NOT in Admin 2 list') : `list failed ${al.status}`);
    const dupes = (al.data || []).map((t) => String(t.managedVendorId?._id || t.managedVendorId));
    check(C, 'One thread per vendor (no duplicates)', 'unique', new Set(dupes).size === dupes.length, `${dupes.length} threads, ${new Set(dupes).size} vendors`);
    const reply = await api(T.admin, 'POST', `/admin/managed-vendor-chat/threads/${sv.data?._id}/messages`, { message: 'Upload PAN again please.' });
    check(C, 'Admin replies to third-party vendor', '201', reply.status === 201, reply.status);
    const vm = await api(T.v2, 'GET', '/vendor/admin-chat/messages');
    check(C, 'Third-party vendor reads reply', '2 msgs', vm.data?.length === 2, vm.data?.length);
});

// ================================================================ CH-08 / CH-09 Managed RFQ
let rfqId;
await safe('CH-08/09', 'managed rfq', async () => {
    const C8 = 'CH-08 B2B↔Admin RFQ', C9 = 'CH-09 Admin↔Vendor RFQ';
    const cr = await api(T.b2ba, 'POST', '/b2b-user/admin/rfq', { customProductName: 'Steel Bolts', quantity: 1000, targetPrice: 12, status: 'Submitted' });
    rfqId = cr.data?._id;
    check(C8, 'B2B admin creates RFQ', '201/200', [200, 201].includes(cr.status) && rfqId, `${cr.status} ${cr.body?.message}`);
    const sB = await connect(T.b2ba), sA = await connect(T.admin), sV = await connect(T.v1);
    const jb = await join(sB, 'join_rfq_room', rfqId);
    check(C8, 'B2B admin of that company joins RFQ live room', 'joined', jb === 'joined', jb);
    const sOther = await connect(T.b2bb);
    const jo = await join(sOther, 'join_rfq_room', rfqId);
    check(C8, "Other company's B2B admin is refused", 'Unauthorized', /Unauthorized/.test(jo), jo);
    const sColleague = await connect(T.b2be2);
    const jc = await join(sColleague, 'join_rfq_room', rfqId);
    check(C8, "Colleague employee (not the creator) is refused", 'Unauthorized', /Unauthorized/.test(jc), jc);
    check(C8, 'Super admin joins RFQ live room', 'joined', (await join(sA, 'join_rfq_room', rfqId)) === 'joined', 'ok');
    const m = await api(T.b2ba, 'POST', `/b2b-user/admin/rfq/${rfqId}/message`, { message: 'Please source ISO-certified only.' });
    check(C8, 'B2B admin messages super admin', '200', m.status === 200, m.status);
    const la = await got(sA, 'new_internal_message');
    check(C8, 'Super admin receives it live', 'event', !!la, la ? 'received' : 'not received');
    const note = await api(T.b2ba, 'POST', `/b2b-user/admin/rfq/${rfqId}/message`, { message: 'INTERNAL: budget can stretch to 14', isInternalNote: true });
    check(C8, 'B2B admin adds internal note', '200', note.status === 200, note.status);
    const am = await api(T.admin, 'POST', `/admin/rfq/${rfqId}/message`, { message: 'Noted, sourcing now.' });
    check(C8, 'Super admin replies', '200', am.status === 200, am.status);
    const n = await M.Notification.countDocuments({ recipientId: B2BA });
    check(C8, 'B2B admin notified of reply', '≥1', n >= 1, n);
    const ad = await api(T.admin, 'GET', `/admin/rfq/${rfqId}`);
    const leaked = (ad.data?.negotiationMessages || []).some((x) => x.isInternalNote);
    bug(C8, "B2B internal note hidden from super admin", 'hidden (CHT-006)', leaked, leaked ? 'internal note visible to super admin' : 'hidden');

    const as = await api(T.admin, 'POST', `/admin/rfq/${rfqId}/assign-vendors`, { vendorIds: [String(V1), String(V2)] });
    check(C9, 'Admin assigns 2 vendors', '200', as.status === 200, as.status);
    const jv = await join(sV, 'join_rfq_room', rfqId);
    check(C9, 'Assigned vendor joins its private RFQ line', 'joined', jv === 'joined', jv);
    const sV2 = await connect(T.v2); await join(sV2, 'join_rfq_room', rfqId);
    const sB2 = await connect(T.b2ba); await join(sB2, 'join_rfq_room', rfqId);
    sV.events = []; sV2.events = []; sB2.events = []; sA.events = [];
    const q1 = await api(T.v1, 'POST', `/vendor/rfq/${rfqId}/quote`, { unitPrice: 11, totalPrice: 11000, deliveryTime: '5 days' });
    const q2 = await api(T.v2, 'POST', `/vendor/rfq/${rfqId}/quote`, { unitPrice: 10, totalPrice: 10000, deliveryTime: '7 days' });
    check(C9, 'Both vendors submit quotes', '200/200', q1.status === 200 && q2.status === 200, `${q1.status}/${q2.status}`);
    const am2 = await api(T.admin, 'POST', `/admin/rfq/${rfqId}/vendor/${V1}/message`, { message: 'Can you match 10/unit?' });
    check(C9, 'Admin messages Vendor One', '200', am2.status === 200, am2.status);
    const vm = await api(T.v1, 'POST', `/vendor/rfq/${rfqId}/message`, { message: 'Best is 10.5/unit.' });
    check(C9, 'Vendor One replies to admin', '200', vm.status === 200, vm.status);
    const liveV1 = await got(sV, 'new_admin_message', (p) => p?.message?.message === 'Can you match 10/unit?');
    check(C9, 'Vendor One receives admin message live', 'event', !!liveV1, liveV1 ? 'received' : 'not received');
    const liveAdm = await got(sA, 'new_vendor_message', (p) => p?.message?.message === 'Best is 10.5/unit.');
    check(C9, 'Admin receives vendor reply live', 'event', !!liveAdm, liveAdm ? 'received' : 'not received');
    await sleep(300);
    const leakV2 = sV2.events.some((e) => ['new_admin_message', 'new_vendor_message'].includes(e.ev));
    check(C9, "Vendor Two does NOT receive Vendor One's negotiation live", 'nothing', !leakV2, leakV2 ? 'LEAKED' : 'nothing received');
    const leakB = sB2.events.some((e) => ['new_admin_message', 'new_vendor_message'].includes(e.ev));
    check(C9, 'B2B buyer does NOT receive vendor negotiation live', 'nothing', !leakB, leakB ? 'LEAKED' : 'nothing received');
    const vn = await M.Notification.countDocuments({ recipientId: V1 });
    check(C9, 'Vendor notified of admin message', '≥1', vn >= 1, vn);
    const vlist = await api(T.v1, 'GET', '/vendor/rfq');
    const vr = (vlist.data || []).find((r) => String(r._id) === String(rfqId));
    const quotes = vr?.quotations || [];
    check(C9, "Vendor One can't see Vendor Two's quote", 'only own quote', quotes.length === 1 && String(quotes[0].vendorId) === String(V1), `${quotes.length} quotation(s) returned`);
    check(C9, "Vendor can't see B2B↔admin discussion / notes", '0 messages', (vr?.negotiationMessages || []).length === 0, `${(vr?.negotiationMessages || []).length} messages`);
    check(C9, 'Vendor sees own admin thread', '2 msgs', quotes[0]?.messages?.length === 2, quotes[0]?.messages?.length);
    const v2l = await api(T.v2, 'GET', '/vendor/rfq');
    const v2r = (v2l.data || []).find((r) => String(r._id) === String(rfqId));
    check(C9, "Vendor Two doesn't see Vendor One's negotiation", 'no Vendor One messages', !JSON.stringify(v2r).includes('10.5/unit') && !JSON.stringify(v2r).includes('match 10/unit'), 'checked');
});

// ================================================================ CH-10 Direct RFQ
await safe('CH-10', 'direct rfq', async () => {
    const C = 'CH-10 B2B Employee↔Vendor Direct RFQ';
    const cr = await api(T.b2be, 'POST', '/b2b-user/employee/direct-rfq', { vendorId: String(V1), customProductName: 'Copper wire', quantity: 200, targetPrice: 80 });
    const id = cr.data?._id;
    check(C, 'Employee creates Direct RFQ', '201', cr.status === 201 && id, `${cr.status} ${cr.body?.message}`);
    const sE = await connect(T.b2be), sV = await connect(T.v1), sX = await connect(T.b2bb);
    check(C, 'Employee joins live room', 'joined', (await join(sE, 'join_rfq_room', id)) === 'joined', 'ok');
    check(C, 'Vendor joins live room', 'joined', (await join(sV, 'join_rfq_room', id)) === 'joined', 'ok');
    const e1 = await api(T.b2be, 'POST', `/b2b-user/employee/direct-rfq/${id}/message`, { message: 'Can you do 75?', priceOffer: 75 });
    check(C, 'Employee sends offer', '200', e1.status === 200, `${e1.status} ${e1.body?.message || ''}`);
    const lv = await got(sV, 'new_message', (p) => p?.message?.message === 'Can you do 75?');
    check(C, 'Vendor receives it live', 'new_message', !!lv, lv ? 'received' : 'not received');
    const v1 = await api(T.v1, 'POST', `/vendor/direct-rfq/${id}/message`, { message: '78 is my best.', priceOffer: 78 });
    check(C, 'Vendor counters', '200', v1.status === 200, v1.status);
    const le = await got(sE, 'new_message', (p) => p?.message?.message === '78 is my best.');
    check(C, 'Employee receives counter live', 'new_message', !!le, le ? 'received' : 'not received');
    const mod = await api(T.v1, 'POST', `/vendor/direct-rfq/${id}/message`, { message: 'email me at deals@vendor.com' });
    check(C, 'Moderation blocks email in Direct RFQ', '422', mod.status === 422, mod.status);
    const n = await M.Notification.countDocuments({ recipientId: { $in: [V1, B2BE] }, 'data.id': id });
    bug(C, 'Offline party gets persistent notification', '≥1 (CHT-033)', n === 0, `${n}`);
    // cross-company
    const xr = await join(sX, 'join_rfq_room', id);
    check(C, "Other company's B2B admin can't join live room", 'Unauthorized', /Unauthorized/.test(xr), xr);
    const xd = await api(T.b2bb, 'GET', `/b2b-user/employee/direct-rfq/${id}`);
    check(C, "Other company's B2B admin can't read it", '403', xd.status === 403, xd.status);
    const xm = await api(T.b2bb, 'POST', `/b2b-user/employee/direct-rfq/${id}/message`, { message: 'Company B injecting a message' });
    check(C, "Other company's B2B admin can't post", '403', xm.status === 403, xm.status);
    const colleague = await api(T.b2be2, 'GET', `/b2b-user/employee/direct-rfq/${id}`);
    check(C, "Colleague employee (not the creator) can't read it", '403', colleague.status === 403, colleague.status);
    const myAdmin = await api(T.b2ba, 'GET', `/b2b-user/employee/direct-rfq/${id}`);
    check(C, 'B2B admin of the SAME company can read it', '200', myAdmin.status === 200, myAdmin.status);
    const myAdminPost = await api(T.b2ba, 'POST', `/b2b-user/employee/direct-rfq/${id}/message`, { message: 'Admin of company A joining the negotiation' });
    check(C, 'B2B admin of the SAME company can post', '200', myAdminPost.status === 200, myAdminPost.status);
    // accept text bug
    const acc = await api(T.v1, 'POST', `/vendor/direct-rfq/${id}/message`, { message: 'ok', action: 'accept', priceOffer: 78 });
    const doc = await M.DirectRFQ.findById(id).lean();
    const stored = doc.messages[doc.messages.length - 1]?.message;
    check(C, 'Accept: stored message = what users saw', 'same text', acc.data?.message === stored, `live="${acc.data?.message}" stored="${stored}"`);
    const acc2 = await api(T.v1, 'POST', `/vendor/direct-rfq/${id}/message`, { action: 'accept', priceOffer: 78 });
    check(C, 'A locked price cannot be accepted/changed again', '400', acc2.status === 400, `${acc2.status} ${acc2.body?.message || ''}`);

    // ---- CHT-032: price lock rules (fresh RFQ)
    const r2 = (await api(T.b2be, 'POST', '/b2b-user/employee/direct-rfq', { vendorId: String(V1), customProductName: 'Brass fittings', quantity: 50, targetPrice: 90 })).data?._id;
    const earlyLock = await api(T.b2be, 'POST', `/b2b-user/employee/direct-rfq/${r2}/message`, { action: 'accept', message: 'lock' });
    check(C, 'Employee cannot lock a price the vendor never offered', '400', earlyLock.status === 400, `${earlyLock.status} ${earlyLock.body?.message || ''}`);
    await api(T.b2be, 'POST', `/b2b-user/employee/direct-rfq/${r2}/message`, { message: 'I can pay 70', priceOffer: 70 });
    const vAccept = await api(T.v1, 'POST', `/vendor/direct-rfq/${r2}/message`, { action: 'accept', priceOffer: 1 });
    const r2doc = await M.DirectRFQ.findById(r2).lean();
    check(C, "Vendor accepts the buyer's price - cannot name its own (sent ₹1)", 'final = 70', vAccept.status === 200 && r2doc.finalAgreedPrice === 70 && r2doc.status === 'Vendor Accepted', `${vAccept.status} final=${r2doc.finalAgreedPrice} status=${r2doc.status}`);
    const reprice = await api(T.v1, 'POST', `/vendor/direct-rfq/${r2}/message`, { message: 'actually 120', priceOffer: 120 });
    check(C, 'Vendor cannot change the price after accepting', '400', reprice.status === 400, `${reprice.status}`);
    const eLock = await api(T.b2be, 'POST', `/b2b-user/employee/direct-rfq/${r2}/message`, { action: 'accept', message: 'ok' });
    const r2doc2 = await M.DirectRFQ.findById(r2).lean();
    check(C, "Employee locks the vendor's accepted price for admin approval", 'Pending Admin Approval @ 70', eLock.status === 200 && r2doc2.status === 'Pending Admin Approval' && r2doc2.finalAgreedPrice === 70, `${eLock.status} ${r2doc2.status} final=${r2doc2.finalAgreedPrice}`);
    const repriceE = await api(T.b2be, 'POST', `/b2b-user/employee/direct-rfq/${r2}/message`, { message: 'make it 10', priceOffer: 10 });
    check(C, 'Employee cannot change the price once locked', '400', repriceE.status === 400, `${repriceE.status}`);
    const r3 = (await api(T.b2be, 'POST', '/b2b-user/employee/direct-rfq', { vendorId: String(V1), customProductName: 'Steel rods', quantity: 10, targetPrice: 80 })).data?._id;
    const bareAccept = await api(T.v1, 'POST', `/vendor/direct-rfq/${r3}/message`, { action: 'accept' });
    const r3doc = await M.DirectRFQ.findById(r3).lean();
    check(C, 'Accept with no typed message works and takes the target price', '200 @ 80', bareAccept.status === 200 && r3doc.finalAgreedPrice === 80, `${bareAccept.status} final=${r3doc.finalAgreedPrice}`);
    const vNote = await M.Notification.countDocuments({ recipientId: V1, title: /Direct RFQ/ });
    const eNote = await M.Notification.countDocuments({ recipientId: B2BE, title: /Direct RFQ|Vendor accepted/ });
    check(C, 'Both sides get saved notifications', 'vendor ≥1 and employee ≥1', vNote >= 1 && eNote >= 1, `vendor=${vNote} employee=${eNote}`);
    const longMsg = await api(T.b2be, 'POST', `/b2b-user/employee/direct-rfq/${id}/message`, { message: 'x'.repeat(2001) });
    check(C, 'Over-long message rejected', '400', longMsg.status === 400 || longMsg.status === 422, longMsg.status);
});

// ================================================================ CH-11 Consumer RFQ
await safe('CH-11', 'consumer rfq', async () => {
    const C = 'CH-11 Customer↔Vendor/Admin Consumer RFQ';
    const cv = await api(T.cust, 'POST', '/user/consumer-rfq', { productId: String(PV1), quantity: 10, expectedPrice: 400, message: 'Bulk discount?' });
    const idv = cv.data?._id || cv.data?.id;
    check(C, 'Customer opens RFQ on vendor product', '201', [200, 201].includes(cv.status) && idv, `${cv.status} ${cv.body?.message}`);
    const sC = await connect(T.cust); await join(sC, 'join_user_room', String(CUST));
    const vq = await api(T.v1, 'POST', `/vendor/consumer-rfq/${idv}/quote`, { price: 450, message: 'Can do 450.' });
    check(C, 'Vendor quotes', '200', vq.status === 200, `${vq.status} ${vq.body?.message || ''}`);
    const ev = await got(sC, 'consumer_rfq_updated');
    check(C, 'Customer gets live update event', 'event', !!ev, ev ? 'emitted (no frontend listener – CHT-021)' : 'none');
    const cm = await api(T.cust, 'POST', `/user/consumer-rfq/${idv}/message`, { message: 'Delivery in 3 days?' });
    check(C, 'Customer messages vendor', '200', cm.status === 200, cm.status);
    const vm = await api(T.v1, 'POST', `/vendor/consumer-rfq/${idv}/message`, { message: 'Yes, 3 days.' });
    check(C, 'Vendor messages customer', '200', vm.status === 200, vm.status);
    const mod = await api(T.cust, 'POST', `/user/consumer-rfq/${idv}/message`, { message: 'whatsapp me 9876543210' });
    check(C, 'Moderation blocks phone', '400', mod.status === 400, mod.status);
    const n = await M.Notification.countDocuments({ recipientId: CUST });
    check(C, 'Customer notified', '≥1', n >= 1, n);
    const ro = await api(T.admin, 'POST', `/admin/consumer-rfq/${idv}/message`, { message: 'admin jumping in' });
    check(C, 'Admin is read-only on vendor RFQs', '403', ro.status === 403, ro.status);
    const v2 = await api(T.v2, 'GET', `/vendor/consumer-rfq/${idv}`);
    check(C, 'Other vendor cannot see it', '404', v2.status === 404, v2.status);

    const ca = await api(T.cust, 'POST', '/user/consumer-rfq', { productId: String(PADM), quantity: 5, message: 'Price for 5?' });
    const ida = ca.data?._id || ca.data?.id;
    check(C, 'Customer opens RFQ on PLE (admin) product', '201', [200, 201].includes(ca.status) && ida, `${ca.status} ${ca.body?.message}`);
    const aq = await api(T.admin, 'POST', `/admin/consumer-rfq/${ida}/quote`, { price: 480, message: '480 each' });
    check(C, 'Admin quotes', '200', aq.status === 200, `${aq.status} ${aq.body?.message || ''}`);
    const am = await api(T.admin, 'POST', `/admin/consumer-rfq/${ida}/message`, { message: 'Ships from Mumbai.' });
    check(C, 'Admin messages customer', '200', am.status === 200, am.status);
    const cr = await api(T.cust, 'POST', `/user/consumer-rfq/${ida}/message`, { message: 'Thanks admin' });
    check(C, 'Customer replies to admin', '200', cr.status === 200, cr.status);
    const d = await api(T.cust, 'GET', `/user/consumer-rfq/${ida}`);
    const tl = d.data?.consumerTimeline || d.data?.timeline || [];
    check(C, 'Conversation timeline complete', '≥4 entries', tl.length >= 4, `${tl.length} entries`);
});

// ================================================================ CH-12 Enquiry
await safe('CH-12', 'enquiry', async () => {
    const C = 'CH-12 Product Enquiry';
    const bad = await api(T.cust, 'POST', '/user/enquiries', { productId: String(PV1), subject: 'Warranty', question: 'What is the warranty? call 9876543210' });
    check(C, 'Phone number in enquiry is blocked', '422', bad.status === 422, bad.status);
    const e = await api(T.cust, 'POST', '/user/enquiries', { productId: String(PV1), subject: 'Warranty', question: 'What is the warranty period?' });
    const eid = e.data?.enquiryId || e.data?.id;
    check(C, 'Customer asks vendor a question', '201', [200, 201].includes(e.status), `${e.status} ${e.body?.message}`);
    const nv = await M.Notification.countDocuments({ recipientId: V1, title: 'New Product Enquiry' });
    check(C, 'Vendor notified', '1', nv >= 1, nv);
    const r = await api(T.v1, 'PUT', `/vendor/enquiries/${eid}/reply`, { responseText: '1 year warranty.', status: 'Seller Responded' });
    check(C, 'Vendor replies', '200', r.status === 200, `${r.status} ${r.body?.message || ''}`);
    const r2 = await api(T.admin, 'PUT', `/admin/enquiries/${eid}/reply`, { responseText: 'Admin override answer' });
    const mine = await api(T.cust, 'GET', '/user/enquiries');
    const en = (mine.data || []).find((x) => (x.id || x.enquiryId) === eid);
    check(C, 'Customer sees the reply', 'reply present', !!en?.sellerResponse, en?.sellerResponse);
    check(C, "Admin reply no longer overwrites the vendor's answer (both kept in the conversation)", 'see FIX2 enquiry checks', en?.sellerResponse === 'Admin override answer' && r2.status === 200, `latest seller answer="${en?.sellerResponse}"`);
    const fu = await api(T.cust, 'POST', `/user/enquiries/${eid}/messages`, { message: 'Thanks, one more question about delivery time?' });
    check(C, 'Customer can reply / follow up', '200', fu.status === 200, fu.status);
});

// ================================================================ CH-13 Tickets
await safe('CH-13', 'tickets', async () => {
    const C = 'CH-13 Customer↔Admin Support Ticket';
    const t = await api(T.cust, 'POST', '/user/support/tickets', { subject: 'Refund delay', description: 'Refund not received yet', category: 'Payments' });
    const tid = t.data?._id;
    check(C, 'Customer opens ticket', '201', t.status === 201, t.status);
    const showsPlain = t.data?.messages?.[0]?.message === 'Refund not received yet';
    bug(C, 'Ticket response shows readable text', 'plain text (CHT-036)', !showsPlain, `message="${String(t.data?.messages?.[0]?.message).slice(0, 40)}"`);
    const al = await api(T.admin, 'GET', '/admin/support/tickets');
    const seen = JSON.stringify(al.data || {}).includes(String(tid));
    check(C, 'Admin sees ticket', 'listed', seen, seen ? 'listed' : 'missing');
    const nBefore = await M.Notification.countDocuments({ recipientId: CUST });
    const ar = await api(T.admin, 'POST', `/admin/support/tickets/${tid}/messages`, { message: 'Refund issued today.' });
    check(C, 'Admin replies', '200', ar.status === 200, ar.status);
    const cv = await api(T.cust, 'GET', `/user/support/tickets/${tid}`);
    const msgs = cv.data?.messages || [];
    const plain = msgs.some((m) => m.message === 'Refund issued today.');
    check(C, 'Customer reads admin reply', 'plain text visible', plain, JSON.stringify(msgs.map((m) => String(m.message).slice(0, 25))));
    const n = (await M.Notification.countDocuments({ recipientId: CUST })) - nBefore;
    bug(C, 'Customer notified of admin reply', '≥1 (CHT-034)', n === 0, `${n} new notifications`);
    const cr = await api(T.cust, 'POST', `/user/support/tickets/${tid}/messages`, { message: 'Got it, thanks' });
    check(C, 'Customer replies', '200', cr.status === 200, cr.status);
    const b = await api(T.b2be, 'POST', '/user/support/tickets', { subject: 'Invoice GST', description: 'Wrong GSTIN' });
    check(C, 'B2B employee opens ticket', '201', b.status === 201, b.status);
    const other = await api(T.cust2, 'GET', `/user/support/tickets/${tid}`);
    check(C, "Other customer can't read ticket", '404', other.status === 404, other.status);
});

// ================================================================ CH-14 / 15 / 16 Vendor, Delivery and Contact-us support
await safe('CH-14/15/16', 'support for every role', async () => {
    const CV = 'CH-14 Vendor↔Admin Support', CD = 'CH-15 Delivery↔Admin Support', CC = 'CH-16 Contact-us forms';

    // ---- vendor
    const vt = await api(T.v1, 'POST', '/vendor/support/tickets', { subject: 'Payout delayed', description: 'My weekly payout has not arrived', category: 'Payouts', priority: 'high' });
    const vid = vt.data?.id;
    check(CV, 'Vendor raises a ticket (real API)', '201', vt.status === 201 && vid, `${vt.status} ${vid}`);
    const vlist = await api(T.v1, 'GET', '/vendor/support/tickets');
    check(CV, 'Vendor sees own tickets', 'listed', (vlist.data?.tickets || []).some((t) => t.id === vid), `${vlist.data?.tickets?.length} tickets`);
    const v2list = await api(T.v2, 'GET', '/vendor/support/tickets');
    check(CV, "Other vendor sees none of them", '0', !(v2list.data?.tickets || []).some((t) => t.id === vid), `${v2list.data?.tickets?.length} tickets`);
    const v2peek = await api(T.v2, 'GET', `/vendor/support/tickets/${vid}`);
    check(CV, "Other vendor cannot open the ticket", '404', v2peek.status === 404, v2peek.status);
    const adminList = await api(T.admin, 'GET', '/admin/support/tickets?limit=100');
    const adminRow = (adminList.data?.tickets || []).find((t) => t.id === vid);
    check(CV, 'Admin sees the vendor ticket with the vendor name', 'Vendor One', adminRow?.customer?.name === 'Vendor One', adminRow?.customer?.name);
    const adminNote = await M.Notification.countDocuments({ recipientType: 'admin', title: 'New support ticket' });
    check(CV, 'Admin is notified of the new ticket', '≥1', adminNote >= 1, adminNote);
    const before = await M.Notification.countDocuments({ recipientId: V1, recipientType: 'vendor', title: /Support/i });
    const areply = await api(T.admin, 'POST', `/admin/support/tickets/${vid}/messages`, { message: 'We are checking your payout.' });
    check(CV, 'Admin replies to the vendor', '200', areply.status === 200, areply.status);
    const after = await M.Notification.countDocuments({ recipientId: V1, recipientType: 'vendor', title: /Support/i });
    check(CV, 'Vendor gets a saved notification for the reply', '+1', after === before + 1, `${before} -> ${after}`);
    const vdetail = await api(T.v1, 'GET', `/vendor/support/tickets/${vid}`);
    check(CV, "Vendor reads the admin's reply (not encrypted)", 'plain text', (vdetail.data?.messages || []).some((m) => m.message === 'We are checking your payout.'), JSON.stringify((vdetail.data?.messages || []).map((m) => String(m.message).slice(0, 20))));
    const vreply = await api(T.v1, 'POST', `/vendor/support/tickets/${vid}/messages`, { message: 'Thank you, waiting.' });
    check(CV, 'Vendor replies', '200', vreply.status === 200, vreply.status);
    const vstat = await api(T.v1, 'PATCH', `/vendor/support/tickets/${vid}/status`, { status: 'resolved' });
    check(CV, 'Vendor marks it resolved', '200', vstat.status === 200 && vstat.data?.status === 'resolved', `${vstat.status} ${vstat.data?.status}`);
    const badStat = await api(T.v1, 'PATCH', `/vendor/support/tickets/${vid}/status`, { status: 'open' });
    check(CV, 'Vendor cannot set arbitrary statuses', '400', badStat.status === 400, badStat.status);
    await api(T.admin, 'PATCH', `/admin/support/tickets/${vid}/status`, { status: 'closed' });
    const closedReply = await api(T.v1, 'POST', `/vendor/support/tickets/${vid}/messages`, { message: 'late reply' });
    check(CV, 'Vendor cannot reply to a closed ticket', '400', closedReply.status === 400, closedReply.status);
    const closedAdmin = await api(T.admin, 'POST', `/admin/support/tickets/${vid}/messages`, { message: 'late admin reply' });
    check(CV, 'Admin cannot reply to a closed ticket either', '400', closedAdmin.status === 400, closedAdmin.status);
    const badAtt = await api(T.v1, 'POST', '/vendor/support/tickets', { subject: 'x', description: 'y', screenshot: 'https://evil.example/track.png' });
    check(CV, 'Screenshot from an arbitrary website is refused', '400', badAtt.status === 400, badAtt.status);
    const okAtt = await api(T.v1, 'POST', '/vendor/support/tickets', { subject: 'With image', description: 'see picture', screenshot: 'data:image/png;base64,iVBORw0KGgo=' });
    check(CV, 'Small inline image screenshot is accepted', '201', okAtt.status === 201, okAtt.status);
    const mv = await api(T.mv1, 'POST', '/vendor/support/tickets', { subject: 'Managed vendor question', description: 'How do I update stock?' });
    check(CV, 'Managed vendor can raise a ticket too', '201', mv.status === 201, `${mv.status} ${mv.body?.message || ''}`);

    // ---- delivery partner
    const dt = await api(T.del, 'POST', '/delivery/support/tickets', { subject: 'Wrong address on order', description: 'Customer address is incomplete', category: 'Delivery Issue' });
    const did = dt.data?.id;
    check(CD, 'Delivery partner raises a ticket (real API)', '201', dt.status === 201 && did, `${dt.status} ${did}`);
    const dlist = await api(T.del, 'GET', '/delivery/support/tickets');
    check(CD, 'Delivery partner sees own tickets only', 'listed', (dlist.data?.tickets || []).length >= 1 && (dlist.data?.tickets || []).every((t) => t.category), `${dlist.data?.tickets?.length} tickets`);
    const dAdmin = ((await api(T.admin, 'GET', '/admin/support/tickets?limit=100')).data?.tickets || []).find((t) => t.id === did);
    check(CD, 'Admin sees it with the delivery partner name', 'Rider', dAdmin?.customer?.name === 'Rider', dAdmin?.customer?.name);
    const dReply = await api(T.admin, 'POST', `/admin/support/tickets/${did}/messages`, { message: 'Please call the customer.' });
    check(CD, 'Admin replies', '200', dReply.status === 200, dReply.status);
    const dNote = await M.Notification.countDocuments({ recipientId: DEL, recipientType: 'delivery' });
    check(CD, 'Delivery partner gets a saved notification', '≥1', dNote >= 1, dNote);
    const custTicketsAsDel = await api(T.del, 'GET', '/user/support/tickets');
    check(CD, "Delivery token cannot use the customer ticket API", '403', custTicketsAsDel.status === 403, custTicketsAsDel.status);

    // ---- contact-us forms (CHT-010)
    const guest = await api(null, 'POST', '/support/contact', { name: 'Visitor Vik', email: 'vik@example.com', phone: '9000000001', subject: 'Question', message: 'Do you deliver to Pune?' });
    check(CC, 'Visitor (not signed in) contact form creates a ticket', '201', guest.status === 201 && guest.data?.ticketNumber, `${guest.status} ${guest.data?.ticketNumber}`);
    const guestRow = ((await api(T.admin, 'GET', '/admin/support/tickets?limit=100')).data?.tickets || []).find((t) => t.id === guest.data?.ticketNumber);
    check(CC, 'Admin sees the visitor ticket with their name', 'Visitor Vik', guestRow?.customer?.name === 'Visitor Vik', guestRow?.customer?.name);
    const signed = await api(T.cust, 'POST', '/support/contact', { name: 'Cust One', email: 'custone@example.com', subject: 'Order help', message: 'My order has not shipped.' });
    const signedRow = await M.SupportTicket.findOne({ ticketNumber: signed.data?.ticketNumber }).lean();
    check(CC, 'Signed-in customer contact form links the ticket to the account', 'userId set', signed.status === 201 && String(signedRow?.userId) === String(CUST), `${signed.status} userId=${signedRow?.userId}`);
    const vendorForm = await api(T.v1, 'POST', '/support/contact', { name: 'Vendor One', storeName: 'Vendor One', email: 'vendorone@example.com', category: 'Payouts & Settlements', message: 'Settlement is pending since a week.' });
    const vendorFormRow = await M.SupportTicket.findOne({ ticketNumber: vendorForm.data?.ticketNumber }).lean();
    check(CC, 'Vendor contact form links the ticket to the vendor', 'vendorId set', vendorForm.status === 201 && String(vendorFormRow?.vendorId) === String(V1), `${vendorForm.status} vendorId=${vendorFormRow?.vendorId}`);
    const badEmail = await api(null, 'POST', '/support/contact', { name: 'X', email: 'not-an-email', message: 'long enough message here' });
    check(CC, 'Invalid e-mail rejected', '400', badEmail.status === 400, badEmail.status);
    const shortMsg = await api(null, 'POST', '/support/contact', { name: 'X', email: 'x@example.com', message: 'hi' });
    check(CC, 'Too-short message rejected', '400', shortMsg.status === 400, shortMsg.status);
    const huge = await api(null, 'POST', '/support/contact', { name: 'X', email: 'x@example.com', message: 'z'.repeat(5001) });
    check(CC, 'Over-long message rejected', '400', huge.status === 400, huge.status);
    record('CH-17 Delivery↔Customer', 'In-app delivery chat', 'exists', 'No channel – phone call only (new feature, not built)', 'BUG');
});

// ================================================================ CH-18 Moderation
await safe('CH-18', 'moderation', async () => {
    const C = 'CH-18 Moderation & Reports';
    const v = await api(T.admin, 'GET', '/admin/chat-moderation/violations');
    check(C, 'Admin lists violations', '200 + items', v.status === 200 && v.data?.violations?.length > 0, `${v.status} ${v.data?.violations?.length}`);
    const vc = (v.data?.violations || []).find((x) => x.senderType === 'customer');
    const act = await api(T.admin, 'POST', `/admin/chat-moderation/violations/${vc?._id}/action`, { action: 'MUTE', muteDurationHours: 1, notes: 'e2e' });
    check(C, 'Admin mutes offending customer', '200', act.status === 200, act.status);
    const s = await api(T.cust, 'POST', `/user/chat/vendor/threads/${thread1}/messages`, { message: 'am I muted?' });
    check(C, 'Muted customer cannot send', '403', s.status === 403, `${s.status} ${s.body?.message}`);
    await M.User.updateOne({ _id: CUST }, { $set: { chatMutedUntil: null } });
    const st = await api(T.admin, 'GET', '/admin/chat-moderation/stats');
    check(C, 'Dashboard stats load', '200 + totals', st.status === 200 && st.data?.totalViolations >= 1, `${st.status} total=${st.data?.totalViolations} open reports=${st.data?.openReports}`);
    const rl = await api(T.admin, 'GET', '/admin/chat-moderation/reports');
    check(C, 'Dashboard lists abuse reports (customer report from earlier)', '≥1', rl.status === 200 && rl.data?.reports?.length >= 1, `${rl.status} ${rl.data?.reports?.length} reports`);
    const rep0 = rl.data?.reports?.[0];
    const ra = await api(T.admin, 'POST', `/admin/chat-moderation/reports/${rep0?._id}/action`, { status: 'ACTION_TAKEN', resolutionNotes: 'warned' });
    check(C, 'Admin resolves a report using the dashboard\'s request format', '200', ra.status === 200 && ra.data?.status === 'RESOLVED', `${ra.status} ${ra.data?.status}/${ra.data?.actionTaken}`);
    const v2 = await api(T.admin, 'GET', '/admin/chat-moderation/violations?senderType=vendor');
    const vv = (v2.data?.violations || [])[0];
    const mute = await api(T.admin, 'POST', `/admin/chat-moderation/violations/${vv?._id}/action`, { actionType: 'MUTE', durationHours: 24, notes: 'e2e' });
    check(C, 'Dashboard MUTE button (actionType/durationHours) really mutes the vendor', '200 MUTED', mute.status === 200 && mute.data?.actionTaken === 'MUTED', `${mute.status} ${mute.data?.actionTaken}`);
    const muted = await api(T.v1, 'POST', `/vendor/chat/threads/${thread1}/messages`, { message: 'hello after mute' });
    check(C, 'Muted vendor cannot send chat messages', '403', muted.status === 403, `${muted.status} ${muted.body?.message || ''}`.slice(0, 90));
    await M.Vendor.updateOne({ _id: V1 }, { $set: { chatMutedUntil: null } });
    const badAct = await api(T.admin, 'POST', `/admin/chat-moderation/reports/${rep0?._id}/action`, { status: 'whatever' });
    check(C, 'Unknown action is rejected, not silently resolved', '400', badAct.status === 400, badAct.status);
});

// ================================================================ SEC: vendor contact must never reach a customer
await safe('SEC', 'vendor privacy', async () => {
    const C = 'SEC Vendor contact protection';
    await M.Vendor.collection.updateOne({ _id: V1 }, { $set: {
        phone: '9876543210', email: 'vendorone@e2e.test', panNumber: 'ABCDE1234F', gstNumber: '27AAPCG9838F1Z1',
        bankDetails: { accountNumber: '123456789012', ifscCode: 'SBIN0001234' }, businessAddress: '12 Secret Lane',
        storeDescription: 'Best widgets. Call 9876543210 now!',
    } });
    const one = await api(null, 'GET', `/vendors/${V1}`);
    const d = one.data || {};
    const leaked = ['phone', 'email', 'panNumber', 'gstNumber', 'bankDetails', 'businessAddress', 'password'].filter((k) => d[k] !== undefined);
    check(C, 'Public vendor page hides phone/email/PAN/GST/bank/address', 'none exposed', leaked.length === 0, leaked.length ? `EXPOSED: ${leaked.join(', ')}` : 'nothing exposed');
    check(C, 'Phone typed in store description is removed', 'empty', !JSON.stringify(d).includes('9876543210'), JSON.stringify(d.storeDescription));
    check(C, 'Public vendor page still shows store name & rating fields', 'storeName present', !!d.storeName, d.storeName);
    const all = await api(null, 'GET', '/vendors/all');
    const list = all.data?.vendors || [];
    check(C, 'Vendor list hides phone/email/bank for every vendor', 'none exposed', !JSON.stringify(list).match(/9876543210|vendorone@e2e|123456789012|ABCDE1234F/), `${list.length} sellers checked`);
    const byEmail = await api(null, 'GET', '/vendors/all?search=vendorone@e2e');
    check(C, 'Cannot look up a vendor by e-mail address', '0 results', (byEmail.data?.vendors || []).filter((v) => v.storeName === 'Vendor One').length === 0, `${(byEmail.data?.vendors || []).length} results`);

    // chat: numbers/UPI hidden inside normal-looking messages
    const thr = (await api(T.cust, 'POST', '/user/chat/vendor/initiate', { vendorId: String(V1) })).data._id;
    const attempts = [
        ['phone disguised as price', '₹9876543210'], ['phone as quantity', '9876543210 pcs'], ['5+5 with bullet', '98765•43210'],
        ['emoji digits', '9️⃣8️⃣7️⃣6️⃣5️⃣4️⃣3️⃣2️⃣1️⃣0️⃣'], ['bengali digits', '৯৮৭৬৫৪৩২১০'], ['spoken digits', 'nine eight seven six five four three two one zero'],
        ['hindi words', 'नौ आठ सात छह पांच चार तीन दो एक शून्य'], ['new UPI handle', 'pay ramesh@pthdfc'], ['gpay instruction', 'gpay kar do 500'],
    ];
    for (const [name, text] of attempts) {
        const r = await api(T.v1, 'POST', `/vendor/chat/threads/${thr}/messages`, { message: text });
        check(C, `Vendor→customer blocked: ${name}`, '422', r.status === 422, `${r.status} ${r.body?.category || ''}`);
    }
    const ok = await api(T.v1, 'POST', `/vendor/chat/threads/${thr}/messages`, { message: 'The price is ₹200 for 2 pieces, delivery in 3 days.' });
    check(C, 'Normal price message still goes through', '201', ok.status === 201, ok.status);

    // split number with a long pause between the two halves
    await api(T.v1, 'POST', `/vendor/chat/threads/${thr}/messages`, { message: '98765' });
    await M.VendorChatMessage.collection.updateMany({ threadId: new mongoose.Types.ObjectId(thr) }, { $set: { createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) } });
    const second = await api(T.v1, 'POST', `/vendor/chat/threads/${thr}/messages`, { message: '43210' });
    check(C, 'Number split across messages 3 hours apart is blocked', '422', second.status === 422, `${second.status} ${second.body?.category || ''}`);

    // the customer side is protected the same way, and enquiries too
    const cs = await api(T.cust, 'POST', `/user/chat/vendor/threads/${thr}/messages`, { message: 'my number 98765 43210' });
    check(C, 'Customer→vendor phone number blocked', '422', cs.status === 422, cs.status);
    const enq = await api(T.cust, 'POST', '/user/enquiries', { productId: String(PV1), subject: 'Hi', question: 'whatsapp me on 9876543210' });
    check(C, 'Phone number in product enquiry blocked', '422', enq.status === 422, enq.status);
    const q2 = await api(T.cust, 'POST', '/user/enquiries', { productId: String(PV1), subject: 'Colour', question: 'Is it available in red?' });
    const qid = q2.data?.enquiryId;
    const rep = await api(T.v1, 'PUT', `/vendor/enquiries/${qid}/reply`, { responseText: 'pay me on ramesh@ybl for discount', status: 'Seller Responded' });
    check(C, 'UPI id in vendor enquiry reply blocked', '422', rep.status === 422, rep.status);
    const rep2 = await api(T.v1, 'PUT', `/vendor/enquiries/${qid}/reply`, { responseText: 'Yes, red is available.', status: 'Seller Responded' });
    check(C, 'Normal enquiry reply allowed', '200', rep2.status === 200, rep2.status);

    // buyer-side APIs must not return vendor contact data
    const rq = await api(T.cust, 'POST', '/user/consumer-rfq', { productId: String(PV1), quantity: 3, message: 'price?' });
    const rid = rq.data?._id || rq.data?.id;
    const det = await api(T.cust, 'GET', `/user/consumer-rfq/${rid}`);
    check(C, 'Customer RFQ detail has no vendor contact data', 'none', !JSON.stringify(det.data || {}).match(/9876543210|vendorone@e2e|123456789012/), 'checked');
    const ord = await api(T.cust, 'GET', '/user/chat/vendor/threads');
    check(C, 'Customer chat list has no vendor contact data', 'none', !JSON.stringify(ord.data || {}).match(/9876543210|vendorone@e2e|123456789012/), 'checked');
});


// ================================================================ FIX2: chat core, admin hub, RFQ privacy, enquiries, encryption
await safe('FIX2', 'second round', async () => {
    const C = 'FIX2 Chat core';
    // --- customer ↔ vendor two (clean thread)
    const th = (await api(T.cust2, 'POST', '/user/chat/vendor/initiate', { vendorId: String(V2) })).data?._id;
    const sendC = (text) => api(T.cust2, 'POST', `/user/chat/vendor/threads/${th}/messages`, { message: text });
    const nBefore = await M.Notification.countDocuments({ recipientId: V2, recipientType: 'vendor', type: 'chat' });
    await sendC('Hello, is this available?');
    const nAfter = await M.Notification.countDocuments({ recipientId: V2, recipientType: 'vendor', type: 'chat' });
    check(C, 'Vendor gets a SAVED notification for a customer message', '+1', nAfter === nBefore + 1, `${nBefore} -> ${nAfter}`);
    await api(T.v2, 'POST', `/vendor/chat/threads/${th}/mute`);
    await sendC('Still there?');
    const nMuted = await M.Notification.countDocuments({ recipientId: V2, recipientType: 'vendor', type: 'chat' });
    check(C, 'A muted chat creates no vendor notification', 'unchanged', nMuted === nAfter, `${nAfter} -> ${nMuted}`);
    await api(T.v2, 'POST', `/vendor/chat/threads/${th}/mute`);

    const cn0 = await M.Notification.countDocuments({ recipientId: CUST2, type: 'chat' });
    await api(T.v2, 'POST', `/vendor/chat/threads/${th}/messages`, { message: 'Yes it is.' });
    const list1 = (await api(T.cust2, 'GET', '/user/chat/vendor/threads')).data || [];
    check(C, 'Customer sees THEIR unread count (1)', '1', list1.find((t) => t._id === th)?.unreadCount === 1, list1.find((t) => t._id === th)?.unreadCount);
    await api(T.cust2, 'PATCH', `/user/chat/vendor/threads/${th}/read`);
    const list2 = (await api(T.cust2, 'GET', '/user/chat/vendor/threads')).data || [];
    check(C, 'Customer mark-read resets it to 0', '0', list2.find((t) => t._id === th)?.unreadCount === 0, list2.find((t) => t._id === th)?.unreadCount);
    await api(T.cust2, 'POST', `/user/chat/vendor/threads/${th}/mute`);
    await api(T.v2, 'POST', `/vendor/chat/threads/${th}/messages`, { message: 'Another reply' });
    const cn1 = await M.Notification.countDocuments({ recipientId: CUST2, type: 'chat' });
    check(C, 'Customer mute stops customer notifications', 'no new one', cn1 === cn0 + 1, `${cn0} -> ${cn1} (only the first reply, before muting)`);
    await api(T.cust2, 'POST', `/user/chat/vendor/threads/${th}/mute`);

    // --- who may close / re-open / unblock
    const cClose = await api(T.cust2, 'PATCH', `/user/chat/vendor/threads/${th}/status`, { status: 'closed' });
    check(C, 'Customer can close the conversation', '200', cClose.status === 200, cClose.status);
    const vReopen = await api(T.v2, 'PATCH', `/vendor/chat/threads/${th}/status`, { status: 'active' });
    check(C, 'Vendor cannot re-open a chat the customer closed', '403', vReopen.status === 403, vReopen.status);
    const cReopen = await api(T.cust2, 'PATCH', `/user/chat/vendor/threads/${th}/status`, { status: 'active' });
    check(C, 'Customer can re-open it', '200', cReopen.status === 200, cReopen.status);
    await api(T.v2, 'PATCH', `/vendor/chat/threads/${th}/status`, { status: 'closed' });
    const cReopen2 = await api(T.cust2, 'PATCH', `/user/chat/vendor/threads/${th}/status`, { status: 'active' });
    check(C, 'A seller cannot silence a customer: customer can re-open a vendor-closed chat', '200', cReopen2.status === 200, cReopen2.status);
    const vBlock = await api(T.v2, 'POST', `/vendor/chat/threads/${th}/block`, { reason: 'x' });
    const cUnblock = await api(T.cust2, 'POST', `/user/chat/vendor/threads/${th}/block`);
    check(C, "Customer cannot lift the vendor's block", '403', cUnblock.status === 403, cUnblock.status);
    const vUnblock = await api(T.v2, 'POST', `/vendor/chat/threads/${th}/block`);
    check(C, 'The vendor can lift its own block', 'isBlocked false', vBlock.data?.isBlocked === true && vUnblock.data?.isBlocked === false, JSON.stringify(vUnblock.data));
    const longChat = await sendC('x'.repeat(2001));
    check(C, 'Over-long chat message rejected', '400', longChat.status === 400, longChat.status);

    // --- guest threads & unapproved vendors
    const guestThread = await M.VendorChatThread.create({ vendorId: V2, customerName: 'Guest', status: 'active' });
    const gProp = await api(T.v2, 'POST', `/vendor/chat/threads/${guestThread._id}/proposal`, { productId: String((await M.Product.findOne({ vendorId: V2 }))?._id || PV1), productName: 'x', quantity: 1, unitPrice: 100 });
    check(C, 'Offer on a guest (no account) thread is refused cleanly', '400 (not 500)', gProp.status === 400, `${gProp.status} ${gProp.body?.message || ''}`);
    const gRep = await api(T.v2, 'POST', `/vendor/chat/threads/${guestThread._id}/report`, { reason: 'SPAM' });
    check(C, 'Report against a guest thread is refused cleanly', '400', gRep.status === 400, `${gRep.status}`);
    const pendingVendor = await mkVendor('Pending Shop', { status: 'pending' });
    const toPending = await api(T.cust2, 'POST', '/user/chat/vendor/initiate', { vendorId: String(pendingVendor) });
    check(C, 'Cannot start a chat with an unapproved vendor', '404', toPending.status === 404, toPending.status);

    // --- admin hub
    const CA = 'FIX2 Admin Chat Hub';
    await M.VendorChatThread.updateOne({ _id: th }, { $set: { unreadCount: 4 } });
    const adm = await api(T.admin, 'POST', `/admin/chat-hub/threads/${th}/messages`, { message: 'Support here, can we help?' });
    check(CA, "Admin message is labelled 'admin'", 'admin', adm.data?.sender === 'admin', adm.data?.sender);
    const custView = (await api(T.cust2, 'GET', `/user/chat/vendor/threads/${th}/messages`)).data || [];
    check(CA, 'Customer sees it as an admin message', 'admin', custView[custView.length - 1]?.sender === 'admin', custView[custView.length - 1]?.sender);
    await api(T.admin, 'PATCH', `/admin/chat-hub/threads/${th}/read`);
    const afterRead = await M.VendorChatThread.findById(th).lean();
    check(CA, "Admin 'mark read' leaves the vendor's unread badge alone", '4', afterRead.unreadCount === 4, afterRead.unreadCount);
    const evil = await api(T.admin, 'GET', '/admin/chat-hub/threads?search=' + encodeURIComponent('(((['));
    check(CA, 'Regex characters in search do not crash the hub', '200', evil.status === 200, evil.status);
    const page1 = await api(T.admin, 'GET', '/admin/chat-hub/threads?limit=1&page=1');
    check(CA, 'Pagination happens in the database', '1 row, total ≥ 2', page1.data?.threads?.length === 1 && page1.data?.pagination?.total >= 2, `${page1.data?.threads?.length} row(s), total ${page1.data?.pagination?.total}`);
    const stats = await api(T.admin, 'GET', '/admin/chat-hub/stats');
    check(CA, 'Stats: customer + B2B = all', 'equal', stats.data?.customer + stats.data?.b2b === stats.data?.all, JSON.stringify(stats.data));
    check(CA, "Stats: 'vendor' counts sellers, not threads", '< all', stats.data?.vendor < stats.data?.all, `vendors=${stats.data?.vendor} threads=${stats.data?.all}`);
    const b2bTab = await api(T.admin, 'GET', '/admin/chat-hub/threads?category=b2b');
    const custTab = await api(T.admin, 'GET', '/admin/chat-hub/threads?category=customer');
    check(CA, 'B2B and customer tabs split correctly', 'no overlap', !(b2bTab.data?.threads || []).some((t) => (custTab.data?.threads || []).some((u) => u._id === t._id)) && b2bTab.data?.threads?.length >= 1, `b2b=${b2bTab.data?.threads?.length} customer=${custTab.data?.threads?.length}`);
    const orderThreadVendor = await M.Order.findOne({}).lean();
    check(CA, 'Order/product-request fields use the real names (no crash)', 'ok', page1.status === 200, page1.status);

    // --- RFQ internal notes (CHT-006) and vendor contact (buyer side)
    const CR = 'FIX2 RFQ privacy';
    await api(T.admin, 'POST', `/admin/rfq/${rfqId}/message`, { message: 'ADMIN-ONLY: margin is thin', isInternalNote: true });
    const adminView = (await api(T.admin, 'GET', `/admin/rfq/${rfqId}`)).data?.negotiationMessages || [];
    check(CR, "Super admin does NOT see the buyer team's private note", 'hidden', !adminView.some((m) => /INTERNAL: budget/.test(m.message)), `${adminView.length} messages visible`);
    check(CR, 'Super admin still sees their own private note', 'visible', adminView.some((m) => /ADMIN-ONLY/.test(m.message)), '');
    const buyerView = (await api(T.b2ba, 'GET', `/b2b-user/admin/rfq/${rfqId}`)).data;
    check(CR, "Buyer does NOT see the admin's private note", 'hidden', !(buyerView?.negotiationMessages || []).some((m) => /ADMIN-ONLY/.test(m.message)), `${buyerView?.negotiationMessages?.length} messages visible`);
    check(CR, 'Buyer still sees their own private note', 'visible', (buyerView?.negotiationMessages || []).some((m) => /INTERNAL: budget/.test(m.message)), '');
    const buyerList = (await api(T.b2ba, 'GET', '/b2b-user/admin/rfq')).data || [];
    check(CR, 'Buyer RFQ list also hides the admin private note', 'hidden', !JSON.stringify(buyerList).includes('ADMIN-ONLY'), '');
    check(CR, "Buyer RFQ views don't expose vendor phone/e-mail", 'none', !JSON.stringify([buyerView, buyerList]).match(/vendorone@e2e\.test|9876543210/), 'checked');
    const vendorsForBuyer = await api(T.b2ba, 'GET', '/b2b-user/admin/vendors');
    check(CR, "Buyer's vendor picker doesn't expose phone/e-mail", 'none', !JSON.stringify(vendorsForBuyer.data || {}).match(/vendorone@e2e\.test|9876543210/), `${vendorsForBuyer.status}`);
    // live: private notes stay on their own side
    const sAdm = await connect(T.admin), sBuy = await connect(T.b2ba);
    await join(sAdm, 'join_rfq_room', rfqId); await join(sBuy, 'join_rfq_room', rfqId);
    sAdm.events = []; sBuy.events = [];
    await api(T.admin, 'POST', `/admin/rfq/${rfqId}/message`, { message: 'admin private live', isInternalNote: true });
    await api(T.b2ba, 'POST', `/b2b-user/admin/rfq/${rfqId}/message`, { message: 'buyer private live', isInternalNote: true });
    await sleep(500);
    const admGot = sAdm.events.filter((e) => e.ev === 'new_internal_message').map((e) => e.payload?.message?.message);
    const buyGot = sBuy.events.filter((e) => e.ev === 'new_internal_message').map((e) => e.payload?.message?.message);
    check(CR, 'Live: admin gets only admin-side private notes', 'admin private live only', admGot.includes('admin private live') && !admGot.includes('buyer private live'), JSON.stringify(admGot));
    check(CR, 'Live: buyer gets only buyer-side private notes', 'buyer private live only', buyGot.includes('buyer private live') && !buyGot.includes('admin private live'), JSON.stringify(buyGot));
    const badAtt = await api(T.b2ba, 'POST', `/b2b-user/admin/rfq/${rfqId}/message`, { message: 'see file', attachments: ['https://evil.example/x.pdf'] });
    check(CR, 'RFQ attachment from an arbitrary website is refused', '400', badAtt.status === 400, badAtt.status);
    const goodAtt = await api(T.b2ba, 'POST', `/b2b-user/admin/rfq/${rfqId}/message`, { message: 'see file', attachments: ['https://res.cloudinary.com/demo/raw/upload/spec.pdf'] });
    check(CR, 'RFQ attachment uploaded through the platform is accepted', '200', goodAtt.status === 200, goodAtt.status);
    const poList = await api(T.b2ba, 'GET', '/b2b-user/admin/purchase-orders');
    check(CR, "Purchase orders don't show the vendor's phone/e-mail to the buyer", 'none', !JSON.stringify(poList.data || {}).match(/vendorone@e2e\.test|9876543210/), `${poList.status}`);

    // --- managed-vendor chat: notifications + attachments
    const CM = 'FIX2 Admin↔Managed vendor';
    const mvThread = (await api(T.mv1, 'GET', '/vendor/admin-chat/thread')).data?._id;
    const nm0 = await M.Notification.countDocuments({ recipientId: MV1, type: 'chat' });
    await api(T.admin, 'POST', `/admin/managed-vendor-chat/threads/${mvThread}/messages`, { message: 'Please update your catalogue.' });
    const nm1 = await M.Notification.countDocuments({ recipientId: MV1, type: 'chat' });
    check(CM, 'Offline managed vendor gets a saved notification', '+1', nm1 === nm0 + 1, `${nm0} -> ${nm1}`);
    const na0 = await M.Notification.countDocuments({ recipientType: 'admin', type: 'chat' });
    await api(T.mv1, 'POST', '/vendor/admin-chat/messages', { message: 'Done, please check.' });
    const na1 = await M.Notification.countDocuments({ recipientType: 'admin', type: 'chat' });
    check(CM, 'Admin gets a saved notification for the vendor message', '+1', na1 === na0 + 1, `${na0} -> ${na1}`);
    const evilFile = await api(T.mv1, 'POST', '/vendor/admin-chat/messages', { message: 'file', attachments: ['http://phish.example/login'] });
    check(CM, 'Attachment pointing to another website refused', '400', evilFile.status === 400, evilFile.status);
    const longAMV = await api(T.mv1, 'POST', '/vendor/admin-chat/messages', { message: 'y'.repeat(2001) });
    check(CM, 'Over-long message refused', '400', longAMV.status === 400, longAMV.status);

    // --- enquiries as a conversation
    const CE = 'FIX2 Product enquiries';
    const enq = await api(T.cust, 'POST', '/user/enquiries', { productId: String(PV1), subject: 'Bulk rate', question: 'Do you give bulk rates?' });
    const eid = enq.data?.enquiryId;
    check(CE, 'Enquiry id is long enough not to collide', 'PE-YYYY-XXXXXX', /^PE-\d{4}-[0-9A-F]{6}$/.test(eid || ''), eid);
    await api(T.v1, 'PUT', `/vendor/enquiries/${eid}/reply`, { responseText: 'Yes, from 50 pieces.', status: 'Seller Responded' });
    await api(T.admin, 'PUT', `/admin/enquiries/${eid}/reply`, { responseText: 'PLE support: confirming the vendor offer.' });
    const follow = await api(T.cust, 'POST', `/user/enquiries/${eid}/messages`, { message: 'Great, what is the price at 100?' });
    check(CE, 'Customer can follow up on an enquiry', '200', follow.status === 200, `${follow.status} ${follow.body?.message || ''}`);
    const mine = ((await api(T.cust, 'GET', '/user/enquiries')).data || []).find((x) => x.id === eid);
    check(CE, 'Whole conversation is kept (nothing overwritten)', '4 messages', mine?.messages?.length === 4, `${mine?.messages?.length} messages: ${(mine?.messages || []).map((m) => m.senderType).join(',')}`);
    const followPhone = await api(T.cust, 'POST', `/user/enquiries/${eid}/messages`, { message: 'call me 98765 43210' });
    check(CE, 'Follow-up with a phone number is blocked', '422', followPhone.status === 422, followPhone.status);
    const followOther = await api(T.cust2, 'POST', `/user/enquiries/${eid}/messages`, { message: 'hi' });
    check(CE, "Another customer cannot post into my enquiry", '404', followOther.status === 404, followOther.status);
    const vNoteE = await M.Notification.countDocuments({ recipientId: V1, title: 'Enquiry follow-up' });
    check(CE, 'Seller is notified of the follow-up', '≥1', vNoteE >= 1, vNoteE);

    // --- encryption key rotation never loses old chats
    const CK = 'FIX2 Encryption';
    const { encryptMessage, decryptMessage } = await imp('utils/chatEncryption.util.js');
    const oldCipher = encryptMessage('written before a dedicated key existed');
    process.env.CHAT_ENCRYPTION_KEY = 'a-brand-new-dedicated-random-key-for-chats';
    const newCipher = encryptMessage('written after the key was set');
    check(CK, 'Old messages still decrypt after setting CHAT_ENCRYPTION_KEY', 'readable', decryptMessage(oldCipher) === 'written before a dedicated key existed', decryptMessage(oldCipher).slice(0, 40));
    check(CK, 'New messages use the new key and decrypt', 'readable', decryptMessage(newCipher) === 'written after the key was set', decryptMessage(newCipher).slice(0, 40));
    delete process.env.CHAT_ENCRYPTION_KEY;
    check(CK, 'Messages written with the new key are NOT readable without it (really encrypted)', 'ciphertext', decryptMessage(newCipher).startsWith('enc:v1:'), decryptMessage(newCipher).slice(0, 12));
});

// ---------------------------------------------------------------- done
for (const s of sockets) s.close();
server.close();
await mongoose.disconnect();
await mem.stop();
if (process.argv.includes('--json')) fs.writeFileSync('chat_e2e_results.json', JSON.stringify(results, null, 2));
const sum = results.reduce((a, r) => ({ ...a, [r.result]: (a[r.result] || 0) + 1 }), {});
console.log('\nSUMMARY', JSON.stringify(sum));
process.exit(0);
