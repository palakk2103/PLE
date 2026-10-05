import SupportTicket from '../../../models/SupportTicket.model.js';
import TicketType from '../../../models/TicketType.model.js';
import { ApiError } from '../../../utils/ApiError.js';
import { ApiResponse } from '../../../utils/ApiResponse.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findTicketByIdOrNumber = async (id, populate = false) => {
    let query = null;
    if (id && /^[0-9a-fA-F]{24}$/.test(id)) {
        query = SupportTicket.findById(id);
    } else {
        query = SupportTicket.findOne({ ticketNumber: id });
    }

    if (populate && query) {
        query = query
            .populate('userId', 'name email phone')
            .populate('vendorId', 'shopName email')
            .populate('ticketTypeId', 'name');
    }

    return query ? await query : null;
};

/**
 * @desc    Get all support tickets with filtering and pagination
 * @route   GET /api/admin/support/tickets
 * @access  Private (Admin)
 */
export const getAllTickets = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, search = '', status, priority } = req.query;
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.max(parseInt(limit, 10) || 10, 1);

    const filter = {};

    if (status && status !== 'all') {
        filter.status = status;
    }

    if (priority && priority !== 'all') {
        filter.priority = priority;
    }

    if (search) {
        const safeSearch = escapeRegex(search.trim());
        filter.$or = [
            { subject: { $regex: safeSearch, $options: 'i' } },
            { description: { $regex: safeSearch, $options: 'i' } },
            { ticketNumber: { $regex: safeSearch, $options: 'i' } },
            ...(search.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: search }] : [])
        ];
    }

    const tickets = await SupportTicket.find(filter)
        .populate('userId', 'name email phone')
        .populate('vendorId', 'shopName email')
        .populate('ticketTypeId', 'name')
        .sort({ updatedAt: -1 })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber);

    const total = await SupportTicket.countDocuments(filter);

    // Normalize for frontend
    const normalizedTickets = tickets.map(ticket => ({
        ...ticket._doc,
        id: ticket.ticketNumber || String(ticket._id),
        _id: ticket._id,
        customer: ticket.userId ? {
            name: ticket.userId.name,
            email: ticket.userId.email,
            phone: ticket.userId.phone
        } : (ticket.vendorId ? {
            name: ticket.vendorId.shopName,
            email: ticket.vendorId.email
        } : { name: 'Anonymous' }),
        category: ticket.ticketTypeId ? ticket.ticketTypeId.name : (ticket.category || 'General'),
        lastUpdate: ticket.updatedAt
    }));

    res.status(200).json(
        new ApiResponse(200, {
            tickets: normalizedTickets,
            pagination: {
                total,
                page: pageNumber,
                limit: limitNumber,
                pages: Math.ceil(total / limitNumber)
            }
        }, 'Support tickets fetched successfully')
    );
});

/**
 * @desc    Get ticket details with messages
 * @route   GET /api/admin/support/tickets/:id
 * @access  Private (Admin)
 */
export const getTicketById = asyncHandler(async (req, res) => {
    const ticket = await findTicketByIdOrNumber(req.params.id, true);

    if (!ticket) {
        throw new ApiError(404, 'Ticket not found');
    }

    // Normalize
    const normalized = {
        ...ticket._doc,
        id: ticket.ticketNumber || String(ticket._id),
        _id: ticket._id,
        customer: ticket.userId ? {
            name: ticket.userId.name,
            email: ticket.userId.email,
            phone: ticket.userId.phone
        } : (ticket.vendorId ? {
            name: ticket.vendorId.shopName,
            email: ticket.vendorId.email
        } : { name: 'Anonymous' }),
        category: ticket.ticketTypeId ? ticket.ticketTypeId.name : (ticket.category || 'General'),
        lastUpdate: ticket.updatedAt
    };

    res.status(200).json(
        new ApiResponse(200, normalized, 'Ticket details fetched successfully')
    );
});

/**
 * @desc    Update ticket status
 * @route   PATCH /api/admin/support/tickets/:id/status
 * @access  Private (Admin)
 */
export const updateTicketStatus = asyncHandler(async (req, res) => {
    const { status, priority, note } = req.body;

    const ticket = await findTicketByIdOrNumber(req.params.id, false);

    if (!ticket) {
        throw new ApiError(404, 'Ticket not found');
    }

    if (status) ticket.status = status;
    if (priority) ticket.priority = priority;

    if (!ticket.timeline) ticket.timeline = [];
    if (status || note) {
        ticket.timeline.push({
            status: status || ticket.status,
            changedAt: new Date(),
            note: note || `Admin updated status to ${(status || ticket.status).replace('_', ' ')}`
        });
    }

    await ticket.save();

    res.status(200).json(
        new ApiResponse(200, {
            ...ticket._doc,
            id: ticket.ticketNumber || String(ticket._id)
        }, 'Ticket status updated successfully')
    );
});

/**
 * @desc    Add message to ticket
 * @route   POST /api/admin/support/tickets/:id/messages
 * @access  Private (Admin)
 */
export const addTicketMessage = asyncHandler(async (req, res) => {
    const { message, attachment } = req.body;
    const trimmedMessage = String(message || '').trim();
    if (!trimmedMessage && !attachment) {
        throw new ApiError(400, 'Message or attachment is required');
    }

    const ticket = await findTicketByIdOrNumber(req.params.id, false);

    if (!ticket) {
        throw new ApiError(404, 'Ticket not found');
    }

    const newMsg = {
        senderId: req.user?._id || req.user?.id,
        senderType: 'admin',
        message: trimmedMessage,
        attachment: attachment || null,
        attachments: attachment ? [attachment] : [],
        createdAt: new Date()
    };

    if (!ticket.messages) ticket.messages = [];
    ticket.messages.push(newMsg);

    // Automatically set to in_progress if an admin replies
    if (ticket.status === 'open') {
        ticket.status = 'in_progress';
        if (!ticket.timeline) ticket.timeline = [];
        ticket.timeline.push({
            status: 'in_progress',
            changedAt: new Date(),
            note: 'Admin replied to ticket'
        });
    }

    await ticket.save();

    res.status(200).json(
        new ApiResponse(200, newMsg, 'Message added successfully')
    );
});

/**
 * @desc    Delete ticket
 * @route   DELETE /api/admin/support/tickets/:id
 * @access  Private (Admin)
 */
export const deleteTicket = asyncHandler(async (req, res) => {
    let ticket = null;
    if (/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
        ticket = await SupportTicket.findByIdAndDelete(req.params.id);
    } else {
        ticket = await SupportTicket.findOneAndDelete({ ticketNumber: req.params.id });
    }

    if (!ticket) throw new ApiError(404, 'Ticket not found');

    res.status(200).json(new ApiResponse(200, null, 'Ticket deleted successfully'));
});

/**
 * @desc    Get all ticket types
 * @route   GET /api/admin/support/ticket-types
 * @access  Private (Admin)
 */
export const getAllTicketTypes = asyncHandler(async (req, res) => {
    const { status } = req.query;
    const filter = {};

    if (status === 'active') filter.isActive = true;
    if (status === 'inactive') filter.isActive = false;

    let ticketTypes = await TicketType.find(filter).sort({ createdAt: -1 });

    // Seed defaults if empty
    if (ticketTypes.length === 0 && (!status || status === 'all')) {
        const totalCount = await TicketType.countDocuments();
        if (totalCount === 0) {
            await TicketType.insertMany([
                { name: 'Order Issue', description: 'Order placement, fulfillment, or tracking issues', isActive: true },
                { name: 'Delivery Issue', description: 'Delayed, missing, or delivery address issues', isActive: true },
                { name: 'Payment Issue', description: 'Payment deducted, gateway errors, or duplicate charges', isActive: true },
                { name: 'Return & Refund', description: 'Damaged item returns, pickup, or refund inquiries', isActive: true },
                { name: 'Account & Login', description: 'Password resets, 2FA, or profile update problems', isActive: true },
                { name: 'General Inquiry', description: 'General questions regarding PLE services', isActive: true }
            ]);
            ticketTypes = await TicketType.find(filter).sort({ createdAt: -1 });
        }
    }

    const normalized = ticketTypes.map((type) => ({
        ...type._doc,
        id: type._id,
        status: type.isActive ? 'active' : 'inactive',
    }));

    res.status(200).json(new ApiResponse(200, normalized, 'Ticket types fetched successfully'));
});


/**
 * @desc    Create ticket type
 * @route   POST /api/admin/support/ticket-types
 * @access  Private (Admin)
 */
export const createTicketType = asyncHandler(async (req, res) => {
    const { name, description, status } = req.body;
    const trimmedName = String(name || '').trim();

    if (!trimmedName) throw new ApiError(400, 'Ticket type name is required');

    const existing = await TicketType.findOne({ name: new RegExp(`^${escapeRegex(trimmedName)}$`, 'i') });
    if (existing) throw new ApiError(409, 'Ticket type already exists');

    const ticketType = await TicketType.create({
        name: trimmedName,
        description: String(description || '').trim(),
        isActive: status ? status === 'active' : true,
    });

    res.status(201).json(
        new ApiResponse(
            201,
            { ...ticketType._doc, id: ticketType._id, status: ticketType.isActive ? 'active' : 'inactive' },
            'Ticket type created successfully'
        )
    );
});

/**
 * @desc    Update ticket type
 * @route   PUT /api/admin/support/ticket-types/:id
 * @access  Private (Admin)
 */
export const updateTicketType = asyncHandler(async (req, res) => {
    const { name, description, status } = req.body;
    const ticketType = await TicketType.findById(req.params.id);

    if (!ticketType) throw new ApiError(404, 'Ticket type not found');

    if (name !== undefined) {
        const trimmedName = String(name || '').trim();
        if (!trimmedName) throw new ApiError(400, 'Ticket type name is required');

        const existing = await TicketType.findOne({
            _id: { $ne: req.params.id },
            name: new RegExp(`^${escapeRegex(trimmedName)}$`, 'i'),
        });
        if (existing) throw new ApiError(409, 'Ticket type already exists');

        ticketType.name = trimmedName;
    }

    if (description !== undefined) {
        ticketType.description = String(description || '').trim();
    }

    if (status !== undefined) {
        ticketType.isActive = String(status).toLowerCase() === 'active';
    }

    await ticketType.save();

    res.status(200).json(
        new ApiResponse(
            200,
            { ...ticketType._doc, id: ticketType._id, status: ticketType.isActive ? 'active' : 'inactive' },
            'Ticket type updated successfully'
        )
    );
});

/**
 * @desc    Delete ticket type
 * @route   DELETE /api/admin/support/ticket-types/:id
 * @access  Private (Admin)
 */
export const deleteTicketType = asyncHandler(async (req, res) => {
    const ticketType = await TicketType.findByIdAndDelete(req.params.id);
    if (!ticketType) throw new ApiError(404, 'Ticket type not found');

    res.status(200).json(new ApiResponse(200, null, 'Ticket type deleted successfully'));
});
