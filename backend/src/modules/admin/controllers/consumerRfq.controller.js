import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import * as svc from '../../../services/consumerRfq.service.js';

const actorOf = (req) => svc.makeActor('admin', req.user.id);

// GET /api/admin/consumer-rfq?scope=admin|vendor
export const list = asyncHandler(async (req, res) => {
    res.status(200).json(new ApiResponse(200, await svc.listConsumerRfqs(await actorOf(req), req.query), 'RFQs fetched successfully.'));
});

// GET /api/admin/consumer-rfq/:id  (any consumer RFQ; read-only for seller-owned)
export const detail = asyncHandler(async (req, res) => {
    res.status(200).json(new ApiResponse(200, await svc.getConsumerRfq(req.params.id, await actorOf(req)), 'RFQ fetched successfully.'));
});

// Mutations: the service enforces that admin may only act when targetType === 'admin'.
const respond = (fn, message) => asyncHandler(async (req, res) => {
    const actor = await actorOf(req);
    const rfq = await fn(req.params.id, actor, req.body);
    res.status(200).json(new ApiResponse(200, await svc.serialize(rfq, actor), message));
});

export const quote = respond(svc.ownerQuote, 'Quotation sent.');
export const acceptOffer = respond(svc.ownerAcceptCustomerOffer, 'Customer offer accepted.');
export const reject = respond(svc.rejectRfq, 'RFQ rejected.');
export const message = respond(svc.addMessage, 'Message sent.');
