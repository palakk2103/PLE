import mongoose from 'mongoose';
import crypto from 'crypto';
import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import User from '../../../models/User.model.js';
import WalletRequest from '../../../models/WalletRequest.model.js';
import * as walletService from '../../../services/wallet.service.js';
import { createNotification } from '../../../services/notification.service.js';
import { sendEmail } from '../../../services/email.service.js';
import { sendNotificationToUser } from '../../../utils/pushNotificationHelper.js';
import { getCompanyId, transferFundsToEmployee } from './employee.controller.js';

/**
 * Employee wallet top-up requests.
 *   Employee: create (amount + reason), list own, cancel while pending.
 *   Company admin: list, approve (optionally a different amount; funds move from the admin's
 *   wallet atomically) or reject with a note. Both sides are notified (in-app, push, email).
 */

export const MAX_REQUEST_AMOUNT = 1000000; // ₹10,00,000
export const MAX_PENDING_PER_EMPLOYEE = 3;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const inr = (n) => `₹${round2(n).toLocaleString('en-IN')}`;
const esc = (str) => String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const newRequestNumber = () => `WR-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

const parseAmount = (value, label = 'Amount') => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) throw new ApiError(400, `${label} must be more than ₹0.`);
    if (n > MAX_REQUEST_AMOUNT) throw new ApiError(400, `${label} can be at most ${inr(MAX_REQUEST_AMOUNT)}.`);
    return round2(n);
};

const cleanText = (value, { min = 0, max = 500, label }) => {
    const t = String(value ?? '').trim();
    if (t.length < min) throw new ApiError(400, `${label} must be at least ${min} characters.`);
    if (t.length > max) throw new ApiError(400, `${label} can be at most ${max} characters.`);
    return t;
};

const notify = async ({ userId, email, title, message, data, emailHtml }) => {
    await createNotification({ recipientId: userId, recipientType: 'user', title, message, type: 'payment', data })
        .catch((e) => console.error('[WalletRequest] notification failed:', e?.message));
    sendNotificationToUser(userId, { title, body: message, data: { type: 'wallet_request', ...Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, String(v)])) } })
        .catch(() => null);
    if (email) {
        sendEmail({ to: email, subject: title, text: message, html: emailHtml || `<p>${esc(message)}</p>` })
            .catch((e) => console.error('[WalletRequest] email failed:', e?.message));
    }
};

const toView = (r) => {
    const o = r?.toObject ? r.toObject() : r;
    return { ...o, id: String(o._id) };
};

/* ─────────────────────────── Employee ─────────────────────────── */

// POST /api/b2b-user/employee/wallet-requests   { amount, reason }
export const createWalletRequest = asyncHandler(async (req, res) => {
    if (req.user.role !== 'b2bEmployee') throw new ApiError(403, 'Only employees can request wallet funds.');
    const employee = await User.findOne({ _id: req.user.id, role: 'b2bEmployee' }).select('name email companyId isActive b2bWalletBalance');
    if (!employee?.companyId) throw new ApiError(400, 'Your account is not linked to a company.');
    if (employee.isActive === false) throw new ApiError(403, 'Your account is inactive.');

    const amount = parseAmount(req.body?.amount);
    const reason = cleanText(req.body?.reason, { min: 5, max: 500, label: 'Reason' });

    const pending = await WalletRequest.countDocuments({ employeeId: employee._id, status: 'pending' });
    if (pending >= MAX_PENDING_PER_EMPLOYEE) {
        throw new ApiError(400, `You already have ${pending} pending requests. Wait for a decision or cancel one first.`);
    }

    const request = await WalletRequest.create({
        requestNumber: newRequestNumber(),
        companyId: employee.companyId,
        employeeId: employee._id,
        amount,
        reason,
    });

    const admins = await User.find({ companyId: employee.companyId, role: 'b2bAdmin', isActive: { $ne: false } }).select('_id email name').lean();
    const title = 'New wallet request';
    const message = `${employee.name} requested ${inr(amount)}: "${reason.slice(0, 120)}"`;
    await Promise.all(admins.map((a) => notify({
        userId: a._id,
        email: a.email,
        title,
        message,
        data: { requestId: String(request._id), requestNumber: request.requestNumber, link: '/b2b-dashboard/wallet-requests' },
        emailHtml: `<p><strong>${esc(employee.name)}</strong> (${esc(employee.email)}) requested <strong>${inr(amount)}</strong> for their company wallet.</p><p>Reason: ${esc(reason)}</p><p>Request ${esc(request.requestNumber)} — review it in the B2B dashboard under Wallet Requests.</p>`,
    })));

    res.status(201).json(new ApiResponse(201, toView(request), 'Request sent to your company admin.'));
});

// GET /api/b2b-user/employee/wallet-requests
export const getMyWalletRequests = asyncHandler(async (req, res) => {
    const requests = await WalletRequest.find({ employeeId: req.user.id }).sort({ createdAt: -1 }).limit(100).lean();
    const me = await User.findById(req.user.id).select('b2bWalletBalance').lean();
    res.status(200).json(new ApiResponse(200, {
        requests: requests.map(toView),
        walletBalance: round2(me?.b2bWalletBalance),
        pendingCount: requests.filter((r) => r.status === 'pending').length,
        maxPending: MAX_PENDING_PER_EMPLOYEE,
    }, 'Wallet requests fetched.'));
});

// POST /api/b2b-user/employee/wallet-requests/:id/cancel
export const cancelWalletRequest = asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, 'Invalid request id.');
    const request = await WalletRequest.findOneAndUpdate(
        { _id: req.params.id, employeeId: req.user.id, status: 'pending' },
        { $set: { status: 'cancelled', decidedAt: new Date() } },
        { new: true }
    );
    if (!request) {
        const exists = await WalletRequest.exists({ _id: req.params.id, employeeId: req.user.id });
        throw new ApiError(exists ? 409 : 404, exists ? 'Only pending requests can be cancelled.' : 'Request not found.');
    }
    res.status(200).json(new ApiResponse(200, toView(request), 'Request cancelled.'));
});

/* ─────────────────────────── Company admin ─────────────────────────── */

// GET /api/b2b-user/admin/wallet-requests?status=pending
export const getCompanyWalletRequests = asyncHandler(async (req, res) => {
    const companyId = await getCompanyId(req);
    const filter = { companyId };
    if (['pending', 'approved', 'rejected', 'cancelled'].includes(req.query.status)) filter.status = req.query.status;

    const [requests, counts, adminWallet] = await Promise.all([
        WalletRequest.find(filter)
            .populate('employeeId', 'name email department designation b2bWalletBalance isActive')
            .populate('decidedBy', 'name')
            .sort({ status: 1, createdAt: -1 })
            .limit(200)
            .lean(),
        WalletRequest.aggregate([{ $match: { companyId: new mongoose.Types.ObjectId(String(companyId)) } }, { $group: { _id: '$status', n: { $sum: 1 }, amount: { $sum: '$amount' } } }]),
        walletService.getOrCreateWallet(req.user.id),
    ]);
    const summary = { pending: 0, approved: 0, rejected: 0, cancelled: 0, pendingAmount: 0 };
    for (const c of counts) {
        summary[c._id] = c.n;
        if (c._id === 'pending') summary.pendingAmount = round2(c.amount);
    }

    res.status(200).json(new ApiResponse(200, {
        requests: requests.map(toView),
        summary,
        companyWalletBalance: round2(adminWallet?.balance),
    }, 'Wallet requests fetched.'));
});

// POST /api/b2b-user/admin/wallet-requests/:id/approve   { amount?, note? }
export const approveWalletRequest = asyncHandler(async (req, res) => {
    const companyId = await getCompanyId(req);
    if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, 'Invalid request id.');
    const existing = await WalletRequest.findOne({ _id: req.params.id, companyId });
    if (!existing) throw new ApiError(404, 'Request not found.');
    if (existing.status !== 'pending') throw new ApiError(409, `This request is already ${existing.status}.`);

    const amount = req.body?.amount !== undefined && req.body?.amount !== '' ? parseAmount(req.body.amount, 'Approved amount') : existing.amount;
    if (amount > existing.amount) throw new ApiError(400, `You can approve at most the requested ${inr(existing.amount)}.`);
    const note = cleanText(req.body?.note, { max: 500, label: 'Note' });

    const employee = await User.findOne({ _id: existing.employeeId, companyId, role: 'b2bEmployee' });
    if (!employee) throw new ApiError(404, 'Employee not found in your company.');
    if (employee.isActive === false) throw new ApiError(400, 'This employee is inactive. Reactivate them before approving.');

    const adminWallet = await walletService.getOrCreateWallet(req.user.id);
    if (adminWallet.isFrozen) throw new ApiError(400, 'Company wallet is frozen. Cannot transfer funds.');
    if (adminWallet.balance < amount) {
        throw new ApiError(400, `Insufficient company wallet balance: ${inr(adminWallet.balance)} available, ${inr(amount)} needed. Top up the company wallet or approve a smaller amount.`);
    }

    // Claim the request and move the money in one transaction: either both happen or neither.
    const session = await mongoose.startSession();
    let request;
    let result;
    try {
        await session.withTransaction(async () => {
            request = await WalletRequest.findOneAndUpdate(
                { _id: existing._id, companyId, status: 'pending' },
                { $set: { status: 'approved', approvedAmount: amount, decisionNote: note || undefined, decidedBy: req.user.id, decidedAt: new Date() } },
                { new: true, session }
            );
            if (!request) throw new ApiError(409, 'This request was already decided.');
            result = await transferFundsToEmployee({
                adminId: req.user.id,
                employee,
                companyId,
                amount,
                description: `Wallet request ${request.requestNumber} approved`,
                session,
            });
            request.walletTransactionId = result.creditTransaction._id;
            request.employeeBalanceAfter = employee.b2bWalletBalance;
            await request.save({ session });
        });
    } catch (err) {
        if (/Insufficient wallet balance/i.test(err?.message || '')) {
            throw new ApiError(400, 'Insufficient company wallet balance. Top up the company wallet or approve a smaller amount.');
        }
        throw err;
    } finally {
        await session.endSession();
    }

    const partial = amount < existing.amount;
    const message = partial
        ? `Your wallet request ${request.requestNumber} was approved for ${inr(amount)} (you asked for ${inr(existing.amount)}). New balance: ${inr(employee.b2bWalletBalance)}.`
        : `Your wallet request ${request.requestNumber} for ${inr(amount)} was approved. New balance: ${inr(employee.b2bWalletBalance)}.`;
    await notify({
        userId: employee._id,
        email: employee.email,
        title: 'Wallet request approved',
        message: note ? `${message} Note: ${note}` : message,
        data: { requestId: String(request._id), requestNumber: request.requestNumber, link: '/wallet' },
    });

    res.status(200).json(new ApiResponse(200, {
        request: toView(request),
        employeeBalance: employee.b2bWalletBalance,
        companyWalletBalance: round2(result.adminWallet.balance),
    }, 'Request approved and funds transferred.'));
});

// POST /api/b2b-user/admin/wallet-requests/:id/reject   { note }
export const rejectWalletRequest = asyncHandler(async (req, res) => {
    const companyId = await getCompanyId(req);
    if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, 'Invalid request id.');
    const note = cleanText(req.body?.note, { min: 3, max: 500, label: 'Reason for rejection' });

    const request = await WalletRequest.findOneAndUpdate(
        { _id: req.params.id, companyId, status: 'pending' },
        { $set: { status: 'rejected', decisionNote: note, decidedBy: req.user.id, decidedAt: new Date() } },
        { new: true }
    );
    if (!request) {
        const exists = await WalletRequest.findOne({ _id: req.params.id, companyId }).select('status').lean();
        throw new ApiError(exists ? 409 : 404, exists ? `This request is already ${exists.status}.` : 'Request not found.');
    }

    const employee = await User.findById(request.employeeId).select('email').lean();
    await notify({
        userId: request.employeeId,
        email: employee?.email,
        title: 'Wallet request rejected',
        message: `Your wallet request ${request.requestNumber} for ${inr(request.amount)} was rejected. Reason: ${note}`,
        data: { requestId: String(request._id), requestNumber: request.requestNumber, link: '/wallet' },
    });

    res.status(200).json(new ApiResponse(200, toView(request), 'Request rejected.'));
});
