// Usage (from /backend): node tests/chatEnquiryE2E.mjs
// Phase 3: (a) "Enquire Now" as a live product chat, (b) delivered / seen ticks pushed live over
// real sockets, (c) chat start/end times in the admin hub, (d) chat moderation still blocking
// phone numbers / UPI ids, (e) read-only Super Admin monitoring of direct employee->vendor RFQs.
// Real Express app + Socket.io + in-memory MongoDB. No real email / push.
process.env.TZ = 'UTC';
import { createRequire } from 'module';
import { pathToFileURL, fileURLToPath } from 'url';
import http from 'http';
import path from 'path';

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = `${BACKEND}/src`;
const reqB = createRequire(`${BACKEND}/package.json`);
const reqF = createRequire(path.resolve(BACKEND, '../frontend/package.json'));
const imp = (p) => import(pathToFileURL(`${SRC}/${p}`).href);

const { MongoMemoryReplSet } = reqB('mongodb-memory-server');
const { io: ioClient } = reqF('socket.io-client');
const mem = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
process.env.MONGO_URI = mem.getUri('ple_chat_enquiry');
Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', SMTP_USER: 'x', SMTP_PASS: 'x', FIREBASE_SERVICE_ACCOUNT: '', NODE_ENV: 'development' });

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
for (const n of ['User', 'Admin', 'Vendor', 'Product', 'VendorChatThread', 'VendorChatMessage', 'Notification', 'DirectRFQ', 'B2BCompany', 'ChatViolation']) M[n] = (await imp(`models/${n}.model.js`)).default;

let pass = 0, fail = 0;
const check = (name, cond, actual) => {
    cond ? pass++ : fail++;
    console.log(`${cond ? '✅' : '❌'} ${name} → ${typeof actual === 'string' ? actual : JSON.stringify(actual)}`);
};
const api = async (token, method, p, body) => {
    const res = await fetch(BASE + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    let json = null;
    try { json = await res.json(); } catch { /* none */ }
    return { status: res.status, body: json, data: json?.data, headers: res.headers };
};
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
const got = async (s, ev, pred = () => true, ms = 1500) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
        const hit = s.events.find((e) => e.ev === ev && pred(e.payload));
        if (hit) return hit.payload;
        await sleep(50);
    }
    return null;
};
const count = (s, ev) => s.events.filter((e) => e.ev === ev).length;

// ── seed
const pw = '$2a$12$abcdefghijklmnopqrstuuDummyHashNotUsedForLoginxxxxxxxx';
const ins = async (Model, doc) => (await Model.collection.insertOne({ createdAt: new Date(), updatedAt: new Date(), ...doc })).insertedId;
const C1 = await ins(M.User, { name: 'Cathy Customer', email: 'cathy@example.com', password: pw, role: 'customer', isActive: true, isVerified: true, phone: '9000000001' });
const C2 = await ins(M.User, { name: 'Dan Customer', email: 'dan@example.com', password: pw, role: 'customer', isActive: true, isVerified: true, phone: '9000000002' });
const C3 = await ins(M.User, { name: 'Eve Customer', email: 'eve@example.com', password: pw, role: 'customer', isActive: true, isVerified: true, phone: '9000000003' });
const ADMIN = await ins(M.Admin, { name: 'Admin One', email: 'admin1@example.com', password: pw, role: 'admin', isActive: true, status: 'active' });
const mkVendor = (name, extra = {}) => ins(M.Vendor, { name, storeName: name, email: `${name.replace(/\s/g, '').toLowerCase()}@example.com`, password: pw, status: 'approved', isVerified: true, isActive: true, ...extra });
const V = await mkVendor('Volt Supplies');
const V_PENDING = await mkVendor('Pending Store', { status: 'pending' });
const V3 = await mkVendor('Lumen Lighting');
const mkProduct = (name, extra) => ins(M.Product, { name, slug: name.toLowerCase().replace(/\s/g, '-'), price: 500, stockQuantity: 10, isActive: true, isVisible: true, approvalStatus: 'approved', ...extra });
const P_V = await mkProduct('Office Chair', { vendorId: V });
const P_SHOP = await mkProduct('Shop Lamp', { shopId: new mongoose.Types.ObjectId(), listingType: 'admin_managed_listing' });
const P_V3 = await mkProduct('Desk Lamp', { vendorId: V3 });
const P_PENDING = await mkProduct('Ghost Product', { vendorId: V_PENDING });
const P_OFF = await mkProduct('Retired Product', { vendorId: V, isActive: false });

const tok = (id, role, extra = {}) => signAccessToken({ id: String(id), role, ...extra });
const TC1 = tok(C1, 'customer', { name: 'Cathy Customer', email: 'cathy@example.com' });
const TC2 = tok(C2, 'customer', { name: 'Dan Customer', email: 'dan@example.com' });
const TC3 = tok(C3, 'customer', { name: 'Eve Customer', email: 'eve@example.com' });
const TV = tok(V, 'vendor');
const TV3 = tok(V3, 'vendor');
const TA = tok(ADMIN, 'admin');
const enquire = (t, productId) => api(t, 'POST', '/user/chat/vendor/enquire', { productId: String(productId) });
console.log('In-memory DB ready.\n');

// ── 1. Enquire Now -> chat
let T1;
{
    const anon = await enquire(null, P_V);
    check('Enquire: requires login (401)', anon.status === 401, anon.status);
    check('Enquire: invalid id -> 400', (await api(TC1, 'POST', '/user/chat/vendor/enquire', { productId: 'abc' })).status === 400, 'checked');
    check('Enquire: unknown product -> 404', (await enquire(TC1, new mongoose.Types.ObjectId())).status === 404, 'checked');
    check('Enquire: inactive product -> 404', (await enquire(TC1, P_OFF)).status === 404, 'checked');
    const pend = await enquire(TC1, P_PENDING);
    check('Enquire: seller not approved -> 404', pend.status === 404 && /not available/.test(pend.body?.message || ''), `${pend.status} ${pend.body?.message}`);

    const r = await enquire(TC1, P_V);
    T1 = r.data?.thread;
    check('Enquire: 201 new chat with product context', r.status === 201 && r.data?.created === true && T1?.productName === 'Office Chair' && String(T1?.productRef) === String(P_V) && String(T1?.vendorId) === String(V), [r.status, T1?.productName]);
    check('Enquire: starts active with a start time and no end time', T1?.status === 'active' && !!T1?.startedAt && T1?.endedAt === null, [T1?.status, T1?.startedAt, T1?.endedAt]);
    const msgs = await api(TC1, 'GET', `/user/chat/vendor/threads/${T1._id}/messages`);
    check('Enquire: opening system line "Enquiry about …"', msgs.data?.length === 1 && msgs.data[0].sender === 'system' && /Enquiry about "Office Chair"/.test(msgs.data[0].message), msgs.data?.map((m) => `${m.sender}:${m.message}`));
    const vt = await api(TV, 'GET', '/vendor/chat/threads');
    const vthread = vt.data?.find((t) => String(t._id) === String(T1._id));
    check('Seller sees the enquiry in their inbox with product + unread badge', vthread?.productName === 'Office Chair' && vthread?.unreadCount === 1, [vthread?.productName, vthread?.unreadCount]);
    const note = await M.Notification.findOne({ recipientId: V, title: 'New product enquiry' }).lean();
    check('Seller notified', /Cathy Customer wants to know about Office Chair/.test(note?.message || ''), note?.message);

    const again = await enquire(TC1, P_V);
    check('Enquire again: same chat resumed (200), no duplicate / second opening line', again.status === 200 && again.data?.created === false && String(again.data?.thread?._id) === String(T1._id) && (await M.VendorChatMessage.countDocuments({ threadId: T1._id })) === 1, [again.status, again.data?.created]);
    const gen = await api(TC1, 'POST', '/user/chat/vendor/initiate', { vendorId: String(V) });
    check('General "chat with store" stays a separate chat from the enquiry', gen.status === 200 && String(gen.data?._id) !== String(T1._id) && !gen.data?.productRef, [String(gen.data?._id) !== String(T1._id)]);
    const other = await enquire(TC2, P_V);
    check('Another customer gets their own chat', other.status === 201 && String(other.data?.thread?._id) !== String(T1._id), other.status);
    const shop = await enquire(TC1, P_SHOP);
    const shopVendor = await M.Vendor.findById(shop.data?.thread?.vendorId).lean();
    check('Admin-managed shop product -> chat with PLE Shop staff', shop.status === 201 && shopVendor?.storeName === 'PLE Shop', [shop.status, shopVendor?.storeName]);
}

// ── 2. Moderation still applies inside enquiry chats
{
    const phone = await api(TC1, 'POST', `/user/chat/vendor/threads/${T1._id}/messages`, { message: 'call me on 9876543210 for the price' });
    check('Phone number blocked (422 MESSAGE_BLOCKED)', phone.status === 422 && phone.body?.code === 'MESSAGE_BLOCKED', `${phone.status} ${phone.body?.code}`);
    const upi = await api(TC1, 'POST', `/user/chat/vendor/threads/${T1._id}/messages`, { message: 'pay me at rahul@okhdfcbank please' });
    check('UPI id blocked (422)', upi.status === 422, `${upi.status} ${upi.body?.code}`);
    const vphone = await api(TV, 'POST', `/vendor/chat/threads/${T1._id}/messages`, { message: 'whatsapp me 9123456780' });
    check('Seller cannot share a number either (blocked)', vphone.status === 422, vphone.status);
    const count0 = await M.VendorChatMessage.countDocuments({ threadId: T1._id });
    check('Blocked messages were never stored', count0 === 1, count0);
    const ok = await api(TC1, 'POST', `/user/chat/vendor/threads/${T1._id}/messages`, { message: 'Is this chair available in black?' });
    check('Normal question goes through (201)', ok.status === 201, ok.status);
}

// ── 3. Ticks: sent -> delivered -> seen, live over sockets
{
    // fresh thread for a clean receipt story
    const T = (await enquire(TC3, P_V3)).data.thread;
    const custSock = await connect(TC3);
    custSock.emit('join_user_room', String(C3));
    custSock.emit('join_chat_room', String(T._id));
    await sleep(300);

    // 3a. seller offline -> "sent" (one tick)
    const m1 = await api(TC3, 'POST', `/user/chat/vendor/threads/${T._id}/messages`, { message: 'Does the lamp come with a bulb?' });
    check('Seller offline: message is "sent" (one tick)', m1.status === 201 && m1.data?.status === 'sent' && !m1.data?.deliveredAt && !m1.data?.seenAt, m1.data?.status);

    // 3b. seller's app loads their inbox -> "delivered"; customer is told live
    const shopVendorId = V3;
    const shopTok = TV3;
    await api(shopTok, 'GET', '/vendor/chat/threads');
    const delivered = await got(custSock, 'messages_delivered', (p) => p.threadId === String(T._id));
    check('Seller fetches inbox -> customer gets live "messages_delivered"', !!delivered && delivered.by === 'vendor', delivered);
    let list = (await api(TC3, 'GET', `/user/chat/vendor/threads/${T._id}/messages`)).data;
    check('Message now "delivered" (two grey ticks), not seen', list.find((m) => m.sender === 'customer')?.status === 'delivered', list.map((m) => m.status));

    // 3c. seller opens the chat -> "seen"; customer told live
    const read = await api(shopTok, 'PATCH', `/vendor/chat/threads/${T._id}/read`);
    const seen = await got(custSock, 'messages_seen', (p) => p.threadId === String(T._id));
    check('Seller opens chat -> customer gets live "messages_seen"', read.status === 200 && read.data?.seen === 1 && seen?.by === 'vendor', [read.data, seen]);
    list = (await api(TC3, 'GET', `/user/chat/vendor/threads/${T._id}/messages`)).data;
    const mine = list.find((m) => m.sender === 'customer');
    check('Message now "seen" (blue ticks) with timestamps', mine?.status === 'seen' && !!mine?.seenAt && !!mine?.deliveredAt && new Date(mine.seenAt) >= new Date(mine.deliveredAt), [mine?.status, mine?.deliveredAt, mine?.seenAt]);
    const before = count(custSock, 'messages_seen');
    await api(shopTok, 'PATCH', `/vendor/chat/threads/${T._id}/read`);
    await sleep(300);
    check('Reading again changes nothing and sends no extra event', count(custSock, 'messages_seen') === before, [before, count(custSock, 'messages_seen')]);
    const sysMsg = list.find((m) => m.sender === 'system');
    check('System notice carries no seen/delivered stamp', sysMsg && !sysMsg.seenAt && !sysMsg.deliveredAt, sysMsg?.status);

    // 3d. seller online (user room) when the customer writes -> delivered at once
    const vendSock = await connect(shopTok);
    vendSock.emit('join_user_room', String(shopVendorId));
    await sleep(300);
    const m2 = await api(TC3, 'POST', `/user/chat/vendor/threads/${T._id}/messages`, { message: 'And how long is the cord?' });
    check('Seller online: delivered immediately (two ticks on the send response)', m2.data?.status === 'delivered' && !!m2.data?.deliveredAt && !m2.data?.seenAt, m2.data?.status);
    const live = await got(vendSock, 'vendor_chat_notification', (p) => String(p.threadId) === String(T._id));
    check('Seller on their inbox is alerted live', !!live && /cord/.test(live.message), live?.message);

    // 3e. seller replies; customer has the chat open (joined room) -> delivered; reading -> seen, seller notified
    const r1 = await api(shopTok, 'POST', `/vendor/chat/threads/${T._id}/messages`, { message: 'Yes, a 2 m cord.' });
    check('Customer online with chat open: reply is delivered at once', r1.status === 201 && r1.data?.status === 'delivered', r1.data?.status);
    const cread = await api(TC3, 'PATCH', `/user/chat/vendor/threads/${T._id}/read`);
    const seenByCust = await got(vendSock, 'messages_seen', (p) => p.by === 'customer' && p.threadId === String(T._id));
    check('Customer opens chat -> seller gets live "messages_seen"', cread.status === 200 && cread.data?.seen === 1 && !!seenByCust, [cread.data, seenByCust]);
    const vlist = (await api(shopTok, 'GET', `/vendor/chat/threads/${T._id}/messages`)).data;
    check("Seller's reply is seen; the customer's 2nd message is only delivered (seller hasn't opened it yet)", vlist.find((m) => m.sender === 'vendor')?.status === 'seen' && vlist.filter((m) => m.sender === 'customer').map((m) => m.status).join(',') === 'seen,delivered', vlist.map((m) => `${m.sender}:${m.status}`));

    // 3f. someone else cannot mark my chat read
    const intruder = await api(TC2, 'PATCH', `/user/chat/vendor/threads/${T._id}/read`);
    check("Another customer can't mark this chat read (404)", intruder.status === 404, intruder.status);
    const intruderV = await api(TV, 'PATCH', `/vendor/chat/threads/${T._id}/read`);
    check("Another seller can't mark this chat read (404)", intruderV.status === 404, intruderV.status);

    // 3g. admin messages: ticks depend on the customer only; admin opening the hub marks nothing
    const am = await api(TA, 'POST', `/admin/chat-hub/threads/${T._id}/messages`, { message: 'PLE support here, anything we can help with?' });
    check('Admin message while customer online -> delivered', am.status === 201 && am.data?.status === 'delivered', am.data?.status);
    await api(TA, 'PATCH', `/admin/chat-hub/threads/${T._id}/read`);
    await api(shopTok, 'PATCH', `/vendor/chat/threads/${T._id}/read`);
    let adminView = (await api(TA, 'GET', `/admin/chat-hub/threads/${T._id}/messages`)).data;
    check('Neither admin nor seller opening the chat marks the admin message seen', adminView.messages.find((m) => m.sender === 'admin')?.status === 'delivered', adminView.messages.map((m) => `${m.sender}:${m.status}`));
    await api(TC3, 'PATCH', `/user/chat/vendor/threads/${T._id}/read`);
    adminView = (await api(TA, 'GET', `/admin/chat-hub/threads/${T._id}/messages`)).data;
    check('Customer opening the chat marks it seen; admin hub shows the ticks', adminView.messages.find((m) => m.sender === 'admin')?.status === 'seen' && adminView.messages.every((m) => 'status' in m), adminView.messages.map((m) => `${m.sender}:${m.status}`));

    // 3h. other threads are untouched
    const otherThread = (await enquire(TC3, P_V)).data.thread;
    await api(TC3, 'POST', `/user/chat/vendor/threads/${otherThread._id}/messages`, { message: 'Hello, is this chair still in stock?' });
    await api(shopTok, 'PATCH', `/vendor/chat/threads/${T._id}/read`);
    const untouched = await M.VendorChatMessage.find({ threadId: otherThread._id, senderType: 'customer' }).lean();
    check('Reading one chat never marks another chat\'s messages', untouched.length === 1 && !untouched[0].seenAt, untouched.map((m) => m.seenAt));
}

// ── 4. Start / end times
{
    const T = (await enquire(TC1, P_V)).data?.thread; // resumes T1
    let hub = (await api(TA, 'GET', '/admin/chat-hub/threads?kind=enquiry&limit=100')).data;
    let row = hub.threads.find((t) => String(t._id) === String(T._id));
    check('Admin hub: ongoing chat has a start time, no end, positive duration', row?.isOngoing === true && !!row.startedAt && row.endedAt === null && row.durationMs >= 0, [row?.startedAt, row?.endedAt, row?.durationMs]);
    check('Admin hub: product enquiry flagged with product name', row?.isProductEnquiry === true && row?.productName === 'Office Chair', [row?.isProductEnquiry, row?.productName]);

    await sleep(1100);
    const close = await api(TV, 'PATCH', `/vendor/chat/threads/${T._id}/status`, { status: 'closed' });
    check('Seller closes the chat', close.status === 200, close.status);
    hub = (await api(TA, 'GET', '/admin/chat-hub/threads?kind=enquiry&limit=100')).data;
    row = hub.threads.find((t) => String(t._id) === String(T._id));
    const dur = new Date(row?.endedAt) - new Date(row?.startedAt);
    check('Closed: end time stamped, ended by seller, duration = end - start (>1s)', row?.isOngoing === false && !!row.endedAt && row.endedBy === 'vendor' && dur >= 1000 && Math.abs(row.durationMs - dur) < 5, [row?.endedAt, row?.endedBy, row?.durationMs]);
    const detail = (await api(TA, 'GET', `/admin/chat-hub/threads/${T._id}/messages`)).data.thread;
    check('Thread detail carries the same start/end', detail.endedAt === row.endedAt && detail.startedAt === row.startedAt, [detail.startedAt, detail.endedAt]);
    const stored = await M.VendorChatThread.findById(T._id).lean();
    check('Stored on the chat itself (startedAt / endedAt)', !!stored.startedAt && !!stored.endedAt, [stored.startedAt, stored.endedAt]);

    const blockedSend = await api(TC1, 'POST', `/user/chat/vendor/threads/${T._id}/messages`, { message: 'Hello again' });
    check('Closed chat is read-only for the customer', blockedSend.status === 400, blockedSend.status);
    const fresh = await enquire(TC1, P_V);
    check('Enquire after closing starts a NEW chat (own start time)', fresh.status === 201 && String(fresh.data?.thread?._id) !== String(T._id) && fresh.data?.thread?.endedAt === null, [fresh.status, fresh.data?.created]);
    hub = (await api(TA, 'GET', '/admin/chat-hub/threads?kind=enquiry&limit=100')).data;
    check('Admin sees both sessions for the product', hub.threads.filter((t) => String(t.productRef) === String(P_V) && String(t.customerUserId?._id || t.customerUserId) === String(C1)).length === 2, hub.threads.length);

    // re-open clears the end time
    const reopen = await api(TC1, 'PATCH', `/user/chat/vendor/threads/${T._id}/status`, { status: 'active' });
    const re = await M.VendorChatThread.findById(T._id).lean();
    check('Re-opening a chat clears its end time', reopen.status === 200 && re.status === 'active' && re.endedAt === null, [reopen.status, re.status, re.endedAt]);

    // hook covers every save path (e.g. order lifecycle auto-resolve)
    const th = await M.VendorChatThread.findById(T._id);
    th.status = 'resolved';
    await th.save();
    check('Any code path that resolves a chat stamps the end time (save hook)', !!(await M.VendorChatThread.findById(T._id).lean()).endedAt, 'checked');
    th.status = 'active';
    await th.save();

    // legacy thread without the new fields
    const legacyUpdated = new Date('2026-05-02T10:00:00Z');
    const LEG = await ins(M.VendorChatThread, { vendorId: V, customerUserId: C2, customerName: 'Dan Customer', status: 'closed', closedBy: 'customer', createdAt: new Date('2026-05-01T09:00:00Z'), updatedAt: legacyUpdated, lastActivity: legacyUpdated });
    hub = (await api(TA, 'GET', '/admin/chat-hub/threads?limit=100')).data;
    const legRow = hub.threads.find((t) => String(t._id) === String(LEG));
    check('Old chats (no stored times) fall back to created / last-updated time', legRow?.startedAt && new Date(legRow.startedAt).toISOString() === '2026-05-01T09:00:00.000Z' && new Date(legRow.endedAt).toISOString() === legacyUpdated.toISOString() && legRow.durationMs === 25 * 3600 * 1000, [legRow?.startedAt, legRow?.endedAt, legRow?.durationMs]);

    const stats = (await api(TA, 'GET', '/admin/chat-hub/stats')).data;
    check('Hub stats count product enquiries', stats?.enquiries >= 4, stats);
    const s1 = (await api(TA, 'GET', `/admin/chat-hub/threads?search=${encodeURIComponent('Retired')}`)).data;
    const s2 = (await api(TA, 'GET', `/admin/chat-hub/threads?search=${encodeURIComponent('Office Chair')}`)).data;
    check('Hub search finds chats by product name', s1.threads.length === 0 && s2.threads.length >= 2, [s1.threads.length, s2.threads.length]);

    // admin-closed enquiry cannot be bypassed by enquiring again
    await M.VendorChatThread.updateOne({ _id: fresh.data.thread._id }, { $set: { status: 'closed', closedBy: 'admin' } });
    const bypass = await enquire(TC1, P_V);
    check('PLE-closed enquiry cannot be bypassed by enquiring again (403)', bypass.status === 403, `${bypass.status} ${bypass.body?.message}`);
}

// ── 5. Read-only Super Admin monitoring of direct RFQs
{
    const CO = await ins(M.B2BCompany, { companyName: 'Acme Pvt Ltd', businessEmail: 'asha@acme.example.com', verificationStatus: 'Approved' });
    const CO2 = await ins(M.B2BCompany, { companyName: 'Zenith Traders', businessEmail: 'z@zenith.example.com', verificationStatus: 'Approved' });
    const E1 = await ins(M.User, { name: 'Ravi Staff', email: 'ravi@acme.example.com', password: pw, role: 'b2bEmployee', companyId: CO, isActive: true });
    const E2 = await ins(M.User, { name: 'Zoya Buyer', email: 'zoya@zenith.example.com', password: pw, role: 'b2bEmployee', companyId: CO2, isActive: true });
    const V2 = await mkVendor('Bolt Industries');
    const msg = (type, id, name, text, extra = {}) => ({ _id: new mongoose.Types.ObjectId(), senderId: id, senderType: type, senderName: name, message: text, createdAt: new Date(), ...extra });
    const D1 = await ins(M.DirectRFQ, { directRfqId: 'DRFQ-AAA111', employeeId: E1, companyId: CO, vendorId: V, productId: P_V, quantity: 10, targetPrice: 400, status: 'Negotiating', requirementDetails: 'Need ergonomic chairs', createdAt: new Date('2026-11-10T20:00:00Z'), messages: [msg('Employee', E1, 'Ravi Staff', 'Can you do 400 each?'), msg('Vendor', V, 'Volt Supplies', 'We can do 450', { priceOffer: 450 }), msg('Employee', E1, 'Ravi Staff', 'Deal at 430?', { priceOffer: 430 })] });
    const D2 = await ins(M.DirectRFQ, { directRfqId: 'DRFQ-BBB222', employeeId: E2, companyId: CO2, vendorId: V2, customProductName: 'Industrial Bolts M12', quantity: 500, targetPrice: 12, status: 'Pending Vendor', messages: [] });
    const D3 = await ins(M.DirectRFQ, { directRfqId: 'DRFQ-CCC333', employeeId: E1, companyId: CO, vendorId: V2, customProductName: 'Safety Gloves', quantity: 100, targetPrice: 50, status: 'PO Generated', finalAgreedPrice: 45, messages: [msg('Vendor', V2, 'Bolt Industries', 'Agreed at 45', { priceOffer: 45 })] });

    const list = await api(TA, 'GET', '/admin/direct-rfqs');
    check('Admin lists all 3 direct RFQs with company / employee / vendor', list.status === 200 && list.data?.total === 3 && list.data?.items?.every((i) => i.company?.name && i.employee?.name && i.vendor?.storeName), [list.status, list.data?.total]);
    const d1 = list.data?.items?.find((i) => i.directRfqId === 'DRFQ-AAA111');
    check('Row summary: product, target total 4,000, 3 messages, last offer 430', d1?.productName === 'Office Chair' && d1?.targetTotal === 4000 && d1?.messageCount === 3 && d1?.lastOffer === 430, d1);
    const byStatus = await api(TA, 'GET', '/admin/direct-rfqs?status=PO%20Generated');
    check('Filter by status', byStatus.data?.total === 1 && byStatus.data.items[0].directRfqId === 'DRFQ-CCC333', byStatus.data?.total);
    check('Bad status -> 400', (await api(TA, 'GET', '/admin/direct-rfqs?status=Hacked')).status === 400, 'checked');
    const byVendor = await api(TA, 'GET', `/admin/direct-rfqs?vendorId=${V2}`);
    check('Filter by vendor', byVendor.data?.total === 2, byVendor.data?.total);
    const byCo = await api(TA, 'GET', `/admin/direct-rfqs?companyId=${CO}`);
    check('Filter by company', byCo.data?.total === 2, byCo.data?.total);
    check('Bad vendor id -> 400', (await api(TA, 'GET', '/admin/direct-rfqs?vendorId=nope')).status === 400, 'checked');
    for (const [q, label, expect] of [['Zoya', 'employee name', 'DRFQ-BBB222'], ['Bolt Ind', 'vendor name', 2], ['zenith', 'company name', 'DRFQ-BBB222'], ['Safety', 'product name', 'DRFQ-CCC333'], ['AAA111', 'RFQ id', 'DRFQ-AAA111']]) {
        const r = await api(TA, 'GET', `/admin/direct-rfqs?search=${encodeURIComponent(q)}`);
        check(`Search by ${label}`, typeof expect === 'number' ? r.data?.total === expect : r.data?.total === 1 && r.data.items[0].directRfqId === expect, [q, r.data?.total]);
    }
    const rx = await api(TA, 'GET', `/admin/direct-rfqs?search=${encodeURIComponent('.*')}`);
    check('Search text is not a regex', rx.status === 200 && rx.data?.total === 0, [rx.status, rx.data?.total]);
    const day = await api(TA, 'GET', '/admin/direct-rfqs?from=2026-11-11&to=2026-11-11');
    check('Date filter uses India days (20:00 UTC on 10 Nov = 11 Nov IST)', day.data?.total === 1 && day.data.items[0].directRfqId === 'DRFQ-AAA111', day.data?.total);
    const pg = await api(TA, 'GET', '/admin/direct-rfqs?limit=2&page=2');
    check('Paging', pg.data?.items?.length === 1 && pg.data?.pages === 2, [pg.data?.items?.length, pg.data?.pages]);

    const stats = await api(TA, 'GET', '/admin/direct-rfqs/stats');
    check('Stats: 3 total, status counts, target value 4,000 + 6,000 + 5,000, 4 messages', stats.data?.total === 3 && stats.data?.statusCounts?.Negotiating === 1 && stats.data?.statusCounts?.['PO Generated'] === 1 && stats.data?.targetValue === 15000 && stats.data?.agreedValue === 4500 && stats.data?.totalMessages === 4, stats.data);

    const detail = await api(TA, 'GET', '/admin/direct-rfqs/DRFQ-AAA111');
    check('Detail by RFQ id: full negotiation in order, flagged read-only', detail.status === 200 && detail.data?.readOnly === true && detail.data?.messages?.map((m) => m.message).join('|') === 'Can you do 400 each?|We can do 450|Deal at 430?' && detail.data?.requirementDetails === 'Need ergonomic chairs', [detail.status, detail.data?.messages?.length]);
    check('Detail shows who said what and the price offers', detail.data?.messages?.[1]?.senderType === 'Vendor' && detail.data?.messages?.[1]?.priceOffer === 450, detail.data?.messages?.[1]);
    const byObj = await api(TA, 'GET', `/admin/direct-rfqs/${D1}`);
    check('Detail by database id too', byObj.status === 200 && byObj.data?.directRfqId === 'DRFQ-AAA111', byObj.status);
    check('Unknown RFQ -> 404', (await api(TA, 'GET', '/admin/direct-rfqs/DRFQ-NOPE00')).status === 404, 'checked');

    // every write is refused and nothing changes
    const snapshot = JSON.stringify(await M.DirectRFQ.findById(D1).lean());
    const attempts = [
        ['PATCH', '/admin/direct-rfqs/DRFQ-AAA111', { status: 'Rejected' }],
        ['PUT', '/admin/direct-rfqs/DRFQ-AAA111', { quantity: 1 }],
        ['POST', '/admin/direct-rfqs/DRFQ-AAA111/message', { message: 'Admin butting in' }],
        ['POST', '/admin/direct-rfqs', { vendorId: String(V), quantity: 1, targetPrice: 1 }],
        ['DELETE', '/admin/direct-rfqs/DRFQ-AAA111'],
    ];
    const res = [];
    for (const [m, p, b] of attempts) res.push((await api(TA, m, p, b)).status);
    check('Edit / message / create / delete attempts all refused with 405', res.every((s) => s === 405), res);
    const r405 = await api(TA, 'PATCH', '/admin/direct-rfqs/DRFQ-AAA111', { status: 'Rejected' });
    check('Refusal explains itself and advertises Allow: GET', /read-only/i.test(r405.body?.message || '') && /GET/.test(r405.headers.get('allow') || ''), [r405.body?.message, r405.headers.get('allow')]);
    check('The RFQ is exactly as it was (no change, no admin message)', JSON.stringify(await M.DirectRFQ.findById(D1).lean()) === snapshot, 'unchanged');

    // access
    const paths = ['/admin/direct-rfqs', '/admin/direct-rfqs/stats', '/admin/direct-rfqs/DRFQ-AAA111'];
    const anon = await Promise.all(paths.map((p) => api(null, 'GET', p)));
    check('Anonymous -> 401 on all views', anon.every((r) => r.status === 401), anon.map((r) => r.status));
    const forbidden = await Promise.all([TC1, TV, tok(E1, 'b2bEmployee')].flatMap((t) => paths.map((p) => api(t, 'GET', p))));
    check('Customers, sellers and employees -> 403 on all views', forbidden.every((r) => r.status === 403), forbidden.map((r) => r.status));
    const anonWrite = await api(null, 'PATCH', '/admin/direct-rfqs/DRFQ-AAA111', { status: 'Rejected' });
    check('Anonymous write attempt -> 401 (not 405)', anonWrite.status === 401, anonWrite.status);
}

for (const s of sockets) s.disconnect();
console.log(`\n${pass} passed, ${fail} failed`);
server.close();
await mongoose.disconnect();
await mem.stop();
process.exit(fail ? 1 : 0);
