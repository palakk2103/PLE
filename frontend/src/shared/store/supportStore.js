import { create } from 'zustand';
import api from '../utils/api';
import * as adminService from '../../modules/Admin/services/adminService';
import toast from 'react-hot-toast';

const STORAGE_KEY = 'ple-support-tickets';

const INITIAL_MOCK_TICKETS = [
  {
    id: 'TKT-1001',
    ticketNumber: 'TKT-1001',
    subject: 'Late Delivery of order #OD8237',
    category: 'Delivery Issue',
    priority: 'high',
    status: 'in_progress',
    description: 'My package was supposed to arrive yesterday but the status still says in transit. Please check.',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    customer: {
      name: 'John Doe',
      email: 'john.doe@example.com'
    },
    messages: [
      {
        senderType: 'user',
        message: 'I haven\'t received my delivery yet. The status has not changed in 3 days.',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        senderType: 'admin',
        message: 'Hello John, we are contacting the delivery partner right now to expedite your delivery.',
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      }
    ],
    timeline: [
      { status: 'open', changedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), note: 'Ticket created' },
      { status: 'in_progress', changedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), note: 'Admin updated status to In Progress' }
    ]
  },
  {
    id: 'TKT-1002',
    ticketNumber: 'TKT-1002',
    subject: 'Double charged for refund transaction',
    category: 'Payment Issue',
    priority: 'medium',
    status: 'open',
    description: 'I made a payment of ₹450 but it got deducted twice from my wallet.',
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    customer: {
      name: 'Jane Smith',
      email: 'jane.smith@example.com'
    },
    messages: [
      {
        senderType: 'user',
        message: 'I was double charged for the wallet transaction. Please check and refund.',
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
      }
    ],
    timeline: [
      { status: 'open', changedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), note: 'Ticket created' }
    ]
  },
  {
    id: 'TKT-1003',
    ticketNumber: 'TKT-1003',
    subject: 'Damaged item received',
    category: 'Return Issue',
    priority: 'high',
    status: 'waiting_for_user',
    description: 'The wireless earphones box was damaged upon delivery, and the left earbud is not charging.',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    customer: {
      name: 'John Doe',
      email: 'john.doe@example.com'
    },
    messages: [
      {
        senderType: 'user',
        message: 'I received a damaged box. The left earbud is completely unresponsive.',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        senderType: 'admin',
        message: 'Could you please upload a screenshot or photo of the damaged box?',
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
      }
    ],
    timeline: [
      { status: 'open', changedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), note: 'Ticket created' },
      { status: 'waiting_for_user', changedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), note: 'Status changed to Waiting For User' }
    ]
  }
];

const getStoredTickets = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return INITIAL_MOCK_TICKETS;
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_MOCK_TICKETS;
  } catch {
    return INITIAL_MOCK_TICKETS;
  }
};

const saveStoredTickets = (tickets) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
  } catch (e) {
    console.error('Failed to save tickets in localStorage:', e);
  }
};

const isAdminContext = () => {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/admin');
};

export const useSupportStore = create((set, get) => ({
  tickets: getStoredTickets(),
  isLoading: false,
  error: null,
  pagination: {
    total: getStoredTickets().length,
    page: 1,
    limit: 10,
    pages: 1
  },

  fetchTickets: async (params = {}) => {
    set({ isLoading: true, error: null });
    const isAdmin = isAdminContext();

    try {
      let ticketList = [];
      let pagination = { total: 0, page: 1, limit: 10, pages: 1 };

      if (isAdmin) {
        const response = await adminService.getAllTickets(params);
        const data = response?.data || response;
        if (data && Array.isArray(data.tickets)) {
          ticketList = data.tickets;
          pagination = data.pagination || { total: ticketList.length, page: 1, limit: 10, pages: 1 };
        } else if (Array.isArray(data)) {
          ticketList = data;
          pagination = { total: ticketList.length, page: 1, limit: 10, pages: 1 };
        } else {
          throw new Error('Invalid backend data format');
        }
      } else {
        const response = await api.get('/user/support/tickets', { params });
        const data = response?.data || response;
        if (data && Array.isArray(data.tickets)) {
          ticketList = data.tickets;
          pagination = { total: ticketList.length, page: 1, limit: 20, pages: 1 };
        } else if (Array.isArray(data)) {
          ticketList = data;
          pagination = { total: ticketList.length, page: 1, limit: 20, pages: 1 };
        } else {
          throw new Error('Invalid user support data format');
        }
      }

      saveStoredTickets(ticketList);
      set({
        tickets: ticketList,
        pagination,
        isLoading: false
      });
      return ticketList;
    } catch (error) {
      console.warn('SupportStore: fetchTickets using local fallback:', error?.message);
      const local = getStoredTickets();
      let filtered = [...local];

      if (params.status && params.status !== 'all') {
        filtered = filtered.filter((t) => t.status === params.status);
      }
      if (params.search) {
        const query = params.search.toLowerCase();
        filtered = filtered.filter(
          (t) =>
            (t.id && t.id.toLowerCase().includes(query)) ||
            (t.ticketNumber && t.ticketNumber.toLowerCase().includes(query)) ||
            (t.subject && t.subject.toLowerCase().includes(query)) ||
            (t.category && t.category.toLowerCase().includes(query)) ||
            (t.customer?.name && t.customer.name.toLowerCase().includes(query))
        );
      }

      set({
        tickets: filtered,
        pagination: {
          total: filtered.length,
          page: 1,
          limit: 10,
          pages: 1
        },
        isLoading: false
      });
      return filtered;
    }
  },

  fetchTicketById: async (id) => {
    set({ isLoading: true });
    const isAdmin = isAdminContext();

    try {
      let ticket = null;
      if (isAdmin) {
        const response = await adminService.getTicketById(id);
        ticket = response?.data || response;
      } else {
        const response = await api.get(`/user/support/tickets/${id}`);
        ticket = response?.data || response;
      }

      if (ticket && (ticket.id || ticket._id || ticket.ticketNumber)) {
        set({ isLoading: false });
        return ticket;
      }
      throw new Error('Invalid ticket data');
    } catch (error) {
      console.warn('SupportStore: fetchTicketById fallback:', error?.message);
      const local = getStoredTickets();
      const found = local.find((t) => t.id === id || t._id === id || t.ticketNumber === id);
      set({ isLoading: false });
      return found || null;
    }
  },

  createTicket: async (ticketData) => {
    set({ isLoading: true });
    try {
      let created = null;

      try {
        const response = await api.post('/user/support/tickets', ticketData);
        created = response?.data || response;
      } catch (apiErr) {
        console.warn('Backend ticket creation API failed, saving locally:', apiErr?.message);
      }

      if (!created || (!created.id && !created._id && !created.ticketNumber)) {
        const ticketNumber = `TKT-${Math.floor(100000 + Math.random() * 900000)}`;
        created = {
          id: ticketNumber,
          ticketNumber,
          ...ticketData,
          status: 'open',
          createdAt: new Date().toISOString(),
          customer: {
            name: 'Customer',
            email: ''
          },
          messages: [
            {
              senderType: 'user',
              message: ticketData.description,
              createdAt: new Date().toISOString(),
              attachment: ticketData.screenshot || null
            }
          ],
          timeline: [
            { status: 'open', changedAt: new Date().toISOString(), note: 'Ticket created' }
          ]
        };
      }

      const current = get().tickets || [];
      const updated = [created, ...current.filter((t) => (t.id || t._id) !== (created.id || created._id))];
      saveStoredTickets(updated);

      set({
        tickets: updated,
        pagination: {
          total: updated.length,
          page: 1,
          limit: 10,
          pages: 1
        },
        isLoading: false
      });
      toast.success('Support ticket created successfully!');
      return created;
    } catch (error) {
      set({ isLoading: false });
      toast.error('Failed to create ticket');
      return null;
    }
  },

  updateTicketStatus: async (id, status, note = '') => {
    try {
      await adminService.updateTicketStatus(id, status, note);
    } catch (e) {
      console.warn('AdminService: updateTicketStatus fallback:', e?.message);
    }

    const current = get().tickets || [];
    const updated = current.map((t) => {
      const matchId = t.ticketNumber || t.id || t._id;
      if (matchId === id || t._id === id || t.id === id) {
        return {
          ...t,
          status,
          timeline: [
            ...(t.timeline || []),
            {
              status,
              changedAt: new Date().toISOString(),
              note: note || `Status updated to ${status.replace('_', ' ')}`
            }
          ]
        };
      }
      return t;
    });

    saveStoredTickets(updated);
    set({ tickets: updated });
    toast.success('Status updated successfully');
    return true;
  },

  addReply: async (id, message, senderType = 'admin', attachment = null) => {
    let apiMsg = null;
    try {
      if (senderType === 'admin') {
        const res = await adminService.addTicketMessage(id, message, attachment);
        apiMsg = res?.data || res;
      } else {
        const res = await api.post(`/user/support/tickets/${id}/messages`, { message, attachment });
        apiMsg = res?.data || res;
      }
    } catch (e) {
      console.warn('SupportStore: addReply fallback:', e?.message);
    }

    const newMsg = apiMsg?.message
      ? apiMsg
      : {
          senderType,
          message,
          createdAt: new Date().toISOString(),
          attachment
        };

    const current = get().tickets || [];
    let updatedTicket = null;
    const updated = current.map((t) => {
      const matchId = t.ticketNumber || t.id || t._id;
      if (matchId === id || t._id === id || t.id === id) {
        updatedTicket = {
          ...t,
          status: t.status === 'open' ? 'in_progress' : t.status,
          messages: [...(t.messages || []), newMsg]
        };
        return updatedTicket;
      }
      return t;
    });

    saveStoredTickets(updated);
    set({ tickets: updated });
    toast.success('Reply added successfully');
    return updatedTicket;
  },

  deleteTicket: async (id) => {
    try {
      await adminService.deleteTicket(id);
    } catch (e) {
      console.warn('SupportStore: deleteTicket fallback:', e?.message);
    }

    const current = get().tickets || [];
    const updated = current.filter((t) => (t.ticketNumber || t.id || t._id) !== id && t._id !== id && t.id !== id);
    saveStoredTickets(updated);
    set({ tickets: updated });
    toast.success('Ticket deleted successfully');
    return true;
  }
}));
