import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import * as svc from '../../../services/consumerRfq.service.js';

// Managed-shop vendor users never own consumer RFQs (their products are admin-owned).
const actorOf = async (req) => {
    if (req.user.role !== 'vendor') throw new ApiError(403, 'Only independent sellers can manage customer RFQs.');
    return svc.makeActor('seller', req.user.id);
};

export const list = asyncHandler(async (req, res) => {
    res.status(200).json(new ApiResponse(200, await svc.listConsumerRfqs(await actorOf(req), req.query), 'RFQs fetched successfully.'));
});

export const detail = asyncHandler(async (req, res) => {
    res.status(200).json(new ApiResponse(200, await svc.getConsumerRfq(req.params.id, await actorOf(req)), 'RFQ fetched successfully.'));
});

const respond = (fn, message) => asyncHandler(async (req, res) => {
    const actor = await actorOf(req);
    const rfq = await fn(req.params.id, actor, req.body);
    res.status(200).json(new ApiResponse(200, await svc.serialize(rfq, actor), message));
});

export const quote = respond(svc.ownerQuote, 'Quotation sent.');
export const acceptOffer = respond(svc.ownerAcceptCustomerOffer, 'Customer offer accepted.');
export const reject = respond(svc.rejectRfq, 'RFQ rejected.');
export const message = respond(svc.addMessage, 'Message sent.');
