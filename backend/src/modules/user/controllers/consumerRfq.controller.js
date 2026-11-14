import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import * as svc from '../../../services/consumerRfq.service.js';

const actorOf = (req) => svc.makeActor('customer', req.user.id);

// POST /api/user/consumer-rfq
export const create = asyncHandler(async (req, res) => {
    const rfq = await svc.createConsumerRfq({ user: req.user, ...req.body });
    res.status(201).json(new ApiResponse(201, await svc.serialize(rfq, await actorOf(req)), 'RFQ submitted successfully.'));
});

// GET /api/user/consumer-rfq
export const list = asyncHandler(async (req, res) => {
    res.status(200).json(new ApiResponse(200, await svc.listConsumerRfqs(await actorOf(req), req.query), 'RFQs fetched successfully.'));
});

// GET /api/user/consumer-rfq/:id
export const detail = asyncHandler(async (req, res) => {
    res.status(200).json(new ApiResponse(200, await svc.getConsumerRfq(req.params.id, await actorOf(req)), 'RFQ fetched successfully.'));
});

const respond = (fn, message) => asyncHandler(async (req, res) => {
    const actor = await actorOf(req);
    const rfq = await fn(req.params.id, actor, req.body);
    res.status(200).json(new ApiResponse(200, await svc.serialize(rfq, actor), message));
});

export const counter = respond(svc.customerCounter, 'Counter offer sent.');
export const message = respond(svc.addMessage, 'Message sent.');
export const reject = respond(svc.rejectRfq, 'RFQ rejected.');

// POST /api/user/consumer-rfq/:id/accept  (accept quotation + convert to order)
export const accept = asyncHandler(async (req, res) => {
    const actor = await actorOf(req);
    const { rfq, order } = await svc.acceptAndConvert(req.params.id, actor, {
        expectedVersion: req.body.offerVersion, shippingAddressId: req.body.shippingAddressId,
    });
    res.status(200).json(new ApiResponse(200, {
        rfq: await svc.serialize(rfq, actor),
        order: { _id: order._id, orderId: order.orderId, total: order.total },
    }, 'Quotation accepted and order placed.'));
});

// POST /api/user/consumer-rfq/:id/convert  (confirm an owner-accepted offer)
export const convert = accept;
