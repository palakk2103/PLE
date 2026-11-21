import SupportTicket from '../models/SupportTicket.model.js';
import TicketType from '../models/TicketType.model.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';
import { createNotification } from './notification.service.js';
import { assertTextLength, MAX_LONG_TEXT_LENGTH, sanitizeAttachments } from '../utils/chatLimits.js';

const isObjectId = (v) => /^[0-9a-fA-F]{24}$/.test(String(v || ''));

export const generateTicketNumber = async () => {
    for (let i = 0; i < 10; i++) {
        const ticketNumber = `TKT-${Math.floor(100000 + Math.random() * 900000)}`;
        if (!(await SupportTicket.exists({ ticketNumber }))) return ticketNumber;
    }
    return `TKT-${Date.now().toString().slice(-8)}`;
};

/** Frontend shape shared by every portal: { id, customer:{name,email}, category, messages… } */
export const normalizeTicket = (ticket, requester = {}) => {
    const obj = typeof ticket.toObject === 'function' ? ticket.toObject() : { ...ticket };
    return {
        ...obj,
        id: obj.ticketNumber || String(obj._id),
        _id: obj._id,
        category: obj.ticketTypeId?.name || obj.category || 'General',
        customer: { name: requester.name || 'Me', email: requester.email || '' },
    };
};

/** Tell the support team about a new ticket / a requester reply (stored, so it survives being offline). */
export const notifyAdmins = async (ticket, title, message) => {
    try {
        await createNotification({
            recipientType: 'admin', title, message, type: 'system',
            data: { ticketId: String(ticket._id), ticketNumber: ticket.ticketNumber },
        });
    } catch (err) {
        console.warn('Support admin notification failed:', err.message);
    }
};

/** Tell whoever raised the ticket that support answered (or changed its status). */
export const notifyRequester = async (ticket, title, message) => {
    const map = [
        ['userId', 'user'],
        ['vendorId', 'vendor'],
        ['deliveryBoyId', 'delivery'],
    ];
    for (const [field, recipientType] of map) {
        const recipientId = ticket[field]?._id || ticket[field];
        if (!recipientId) continue;
        try {
            await createNotification({
                recipientId, recipientType, title, message, type: 'system',
                data: { ticketId: String(ticket._id), ticketNumber: ticket.ticketNumber },
            });
        } catch (err) {
            console.warn('Support requester notification failed:', err.message);
        }
        return;
    }
};

/**
 * Builds the five endpoints a portal needs for its own support tickets.
 *   ownerField    'vendorId' | 'deliveryBoyId'   (which field identifies the requester on the ticket)
 *   senderType    value stored on each message   ('vendor' | 'delivery')
 *   requesterType value stored on the ticket
 *   getProfile    async (req) => ({ name, email })
 */
export const makeRequesterSupportController = ({ ownerField, senderType, requesterType, getProfile }) => {
    const ownerId = (req) => req.user._id || req.user.id;

    const findMine = async (req, idParam) => {
        const filter = { [ownerField]: ownerId(req) };
        if (isObjectId(idParam)) filter._id = idParam; else filter.ticketNumber = idParam;
        const ticket = await SupportTicket.findOne(filter).populate('ticketTypeId', 'name');
        if (!ticket) throw new ApiError(404, 'Ticket not found');
        return ticket;
    };

    return {
        listMine: asyncHandler(async (req, res) => {
            const filter = { [ownerField]: ownerId(req) };
            if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
            const term = String(req.query.search || '').trim().slice(0, 60);
            if (term) {
                const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
                filter.$or = [{ subject: rx }, { ticketNumber: rx }, { category: rx }];
            }
            const tickets = await SupportTicket.find(filter).populate('ticketTypeId', 'name').sort({ updatedAt: -1 }).limit(200);
            const profile = await getProfile(req);
            const normalized = tickets.map((t) => normalizeTicket(t, profile));
            res.status(200).json(new ApiResponse(200, { tickets: normalized, total: normalized.length }, 'Support tickets fetched successfully'));
        }),

        create: asyncHandler(async (req, res) => {
            const subject = String(req.body.subject || '').trim();
            const description = String(req.body.description || req.body.message || '').trim();
            if (!subject) throw new ApiError(400, 'Subject is required');
            if (!description) throw new ApiError(400, 'Description is required');
            assertTextLength(subject, 'Subject', 200);
            assertTextLength(description, 'Description', MAX_LONG_TEXT_LENGTH);
            const priority = ['low', 'medium', 'high'].includes(req.body.priority) ? req.body.priority : 'medium';
            const screenshot = req.body.screenshot ? sanitizeAttachments(req.body.screenshot, { allowInlineImages: true })[0] : null;
            const ticketTypeId = isObjectId(req.body.ticketTypeId) && await TicketType.exists({ _id: req.body.ticketTypeId, isActive: true })
                ? req.body.ticketTypeId : null;

            const ticket = await SupportTicket.create({
                ticketNumber: await generateTicketNumber(),
                [ownerField]: ownerId(req),
                requesterType,
                ticketTypeId,
                category: String(req.body.category || 'General').slice(0, 80),
                subject,
                description,
                screenshot,
                priority,
                status: 'open',
                messages: [{ senderId: ownerId(req), senderType, message: description, attachment: screenshot, attachments: screenshot ? [screenshot] : [], createdAt: new Date() }],
                timeline: [{ status: 'open', changedAt: new Date(), note: `Ticket created by ${requesterType}` }],
            });

            const profile = await getProfile(req);
            await notifyAdmins(ticket, 'New support ticket', `${profile.name || requesterType} raised ${ticket.ticketNumber}: ${subject}`);
            res.status(201).json(new ApiResponse(201, normalizeTicket(ticket, profile), 'Support ticket created successfully'));
        }),

        detail: asyncHandler(async (req, res) => {
            const ticket = await findMine(req, req.params.id);
            res.status(200).json(new ApiResponse(200, normalizeTicket(ticket, await getProfile(req)), 'Ticket details fetched successfully'));
        }),

        reply: asyncHandler(async (req, res) => {
            const message = String(req.body.message || '').trim();
            const attachment = req.body.attachment ? sanitizeAttachments(req.body.attachment, { allowInlineImages: true })[0] : null;
            if (!message && !attachment) throw new ApiError(400, 'Message or attachment is required');
            assertTextLength(message, 'Message', MAX_LONG_TEXT_LENGTH);

            const ticket = await findMine(req, req.params.id);
            if (ticket.status === 'closed') throw new ApiError(400, 'Cannot reply to a closed ticket. Please open a new ticket.');

            ticket.messages.push({ senderId: ownerId(req), senderType, message, attachment, attachments: attachment ? [attachment] : [], createdAt: new Date() });
            if (['waiting_for_user', 'resolved'].includes(ticket.status)) {
                ticket.status = 'in_progress';
                ticket.timeline.push({ status: 'in_progress', changedAt: new Date(), note: `${requesterType} responded; status changed to In Progress` });
            }
            await ticket.save();

            const profile = await getProfile(req);
            await notifyAdmins(ticket, 'Support ticket reply', `${profile.name || requesterType} replied on ${ticket.ticketNumber}`);
            res.status(200).json(new ApiResponse(200, normalizeTicket(ticket, profile), 'Message sent successfully'));
        }),

        setStatus: asyncHandler(async (req, res) => {
            const status = String(req.body.status || '');
            if (!['in_progress', 'resolved', 'closed'].includes(status)) {
                throw new ApiError(400, 'Status must be in_progress, resolved or closed.');
            }
            const ticket = await findMine(req, req.params.id);
            ticket.status = status;
            ticket.timeline.push({ status, changedAt: new Date(), note: String(req.body.note || `${requesterType} set status to ${status.replace('_', ' ')}`).slice(0, 300) });
            await ticket.save();

            const profile = await getProfile(req);
            await notifyAdmins(ticket, 'Support ticket updated', `${profile.name || requesterType} set ${ticket.ticketNumber} to ${status.replace('_', ' ')}`);
            res.status(200).json(new ApiResponse(200, normalizeTicket(ticket, profile), 'Ticket status updated successfully'));
        }),

        ticketTypes: asyncHandler(async (req, res) => {
            const types = await TicketType.find({ isActive: true }).sort({ name: 1 });
            res.status(200).json(new ApiResponse(200, types.map((t) => ({ id: t._id, name: t.name, description: t.description })), 'Ticket types fetched'));
        }),
    };
};
