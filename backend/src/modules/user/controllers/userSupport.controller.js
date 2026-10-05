import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import SupportTicket from '../../../models/SupportTicket.model.js';
import TicketType from '../../../models/TicketType.model.js';

/**
 * Helper to generate a unique ticket number
 */
const generateTicketNumber = async () => {
    let ticketNumber = '';
    let exists = true;
    while (exists) {
        ticketNumber = `TKT-${Math.floor(100000 + Math.random() * 900000)}`;
        const found = await SupportTicket.findOne({ ticketNumber });
        if (!found) exists = false;
    }
    return ticketNumber;
};

/**
 * @desc    Get all tickets submitted by the authenticated user
 * @route   GET /api/user/support/tickets
 * @access  Private (Customer/B2B)
 */
export const getMyTickets = asyncHandler(async (req, res) => {
    const userId = req.user._id || req.user.id;
    const { status } = req.query;

    const filter = { userId };
    if (status && status !== 'all') {
        filter.status = status;
    }

    const tickets = await SupportTicket.find(filter)
        .populate('ticketTypeId', 'name')
        .sort({ updatedAt: -1 });

    const normalized = tickets.map((t) => ({
        ...t._doc,
        id: t.ticketNumber || String(t._id),
        _id: t._id,
        category: t.ticketTypeId ? t.ticketTypeId.name : (t.category || 'General'),
        customer: {
            name: req.user.name || 'Me',
            email: req.user.email || ''
        }
    }));

    res.status(200).json(
        new ApiResponse(200, { tickets: normalized, total: normalized.length }, 'Support tickets fetched successfully')
    );
});

/**
 * @desc    Create a new support ticket
 * @route   POST /api/user/support/tickets
 * @access  Private (Customer/B2B)
 */
export const createTicket = asyncHandler(async (req, res) => {
    const userId = req.user._id || req.user.id;
    const { subject, category, description, priority, screenshot, ticketTypeId } = req.body;

    const trimmedSubject = String(subject || '').trim();
    const trimmedDesc = String(description || '').trim();

    if (!trimmedSubject) throw new ApiError(400, 'Subject is required');
    if (!trimmedDesc) throw new ApiError(400, 'Description is required');

    const ticketNumber = await generateTicketNumber();

    const newTicket = await SupportTicket.create({
        ticketNumber,
        userId,
        ticketTypeId: ticketTypeId || null,
        category: category || 'General',
        subject: trimmedSubject,
        description: trimmedDesc,
        screenshot: screenshot || null,
        priority: priority || 'medium',
        status: 'open',
        messages: [
            {
                senderId: userId,
                senderType: 'user',
                message: trimmedDesc,
                attachment: screenshot || null,
                attachments: screenshot ? [screenshot] : [],
                createdAt: new Date()
            }
        ],
        timeline: [
            {
                status: 'open',
                changedAt: new Date(),
                note: 'Ticket created by user'
            }
        ]
    });

    const normalized = {
        ...newTicket._doc,
        id: newTicket.ticketNumber || String(newTicket._id),
        _id: newTicket._id,
        customer: {
            name: req.user.name || 'Me',
            email: req.user.email || ''
        }
    };

    res.status(201).json(new ApiResponse(201, normalized, 'Support ticket created successfully'));
});

/**
 * @desc    Get details of a user's ticket
 * @route   GET /api/user/support/tickets/:id
 * @access  Private (Customer/B2B)
 */
export const getTicketById = asyncHandler(async (req, res) => {
    const userId = req.user._id || req.user.id;
    const { id } = req.params;

    let ticket = null;
    if (id && /^[0-9a-fA-F]{24}$/.test(id)) {
        ticket = await SupportTicket.findOne({ _id: id, userId })
            .populate('ticketTypeId', 'name');
    }
    if (!ticket) {
        ticket = await SupportTicket.findOne({ ticketNumber: id, userId })
            .populate('ticketTypeId', 'name');
    }

    if (!ticket) {
        throw new ApiError(404, 'Ticket not found');
    }

    const normalized = {
        ...ticket._doc,
        id: ticket.ticketNumber || String(ticket._id),
        _id: ticket._id,
        category: ticket.ticketTypeId ? ticket.ticketTypeId.name : (ticket.category || 'General'),
        customer: {
            name: req.user.name || 'Me',
            email: req.user.email || ''
        }
    };

    res.status(200).json(new ApiResponse(200, normalized, 'Ticket details fetched successfully'));
});

/**
 * @desc    Add reply message to ticket
 * @route   POST /api/user/support/tickets/:id/messages
 * @access  Private (Customer/B2B)
 */
export const addTicketReply = asyncHandler(async (req, res) => {
    const userId = req.user._id || req.user.id;
    const { id } = req.params;
    const { message, attachment } = req.body;

    const trimmed = String(message || '').trim();
    if (!trimmed && !attachment) {
        throw new ApiError(400, 'Message or attachment is required');
    }

    let ticket = null;
    if (id && /^[0-9a-fA-F]{24}$/.test(id)) {
        ticket = await SupportTicket.findOne({ _id: id, userId });
    }
    if (!ticket) {
        ticket = await SupportTicket.findOne({ ticketNumber: id, userId });
    }

    if (!ticket) {
        throw new ApiError(404, 'Ticket not found');
    }

    if (ticket.status === 'closed') {
        throw new ApiError(400, 'Cannot reply to a closed ticket. Please open a new ticket.');
    }

    const newMsg = {
        senderId: userId,
        senderType: 'user',
        message: trimmed,
        attachment: attachment || null,
        attachments: attachment ? [attachment] : [],
        createdAt: new Date()
    };

    if (!ticket.messages) ticket.messages = [];
    ticket.messages.push(newMsg);

    // If ticket was waiting for user or resolved, move it back to in_progress
    if (ticket.status === 'waiting_for_user' || ticket.status === 'resolved') {
        ticket.status = 'in_progress';
        if (!ticket.timeline) ticket.timeline = [];
        ticket.timeline.push({
            status: 'in_progress',
            changedAt: new Date(),
            note: 'User responded; status changed to In Progress'
        });
    }

    await ticket.save();

    const normalized = {
        ...ticket._doc,
        id: ticket.ticketNumber || String(ticket._id),
        _id: ticket._id,
        customer: {
            name: req.user.name || 'Me',
            email: req.user.email || ''
        }
    };

    res.status(200).json(new ApiResponse(200, normalized, 'Message sent successfully'));
});

/**
 * @desc    Get active ticket types (categories)
 * @route   GET /api/user/support/ticket-types
 * @access  Public / Private
 */
export const getPublicTicketTypes = asyncHandler(async (req, res) => {
    const types = await TicketType.find({ isActive: true }).sort({ name: 1 });
    const normalized = types.map((t) => ({
        id: t._id,
        name: t.name,
        description: t.description
    }));
    res.status(200).json(new ApiResponse(200, normalized, 'Ticket types fetched'));
});
