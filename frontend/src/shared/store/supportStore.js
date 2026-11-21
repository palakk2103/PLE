import { create } from 'zustand';
import api from '../utils/api';
import * as adminService from '../../modules/Admin/services/adminService';
import { ADMIN_BASE_ROUTE } from '../../modules/Admin/config/adminRoutesConfig';
import toast from 'react-hot-toast';

/**
 * Support tickets for every portal. Which API is used depends on where the person is:
 *   admin    -> /admin/support/...       (all tickets, can reply / change status / delete)
 *   vendor   -> /vendor/support/...      (their own tickets)
 *   delivery -> /delivery/support/...    (their own tickets)
 *   customer & B2B -> /user/support/...  (their own tickets)
 * Tickets always come from the server. There is no local/sample fallback any more:
 * if the server cannot be reached the user sees an error instead of fake tickets.
 */

const path = () => (typeof window === 'undefined' ? '' : window.location.pathname);
const isAdminContext = () => path().startsWith(ADMIN_BASE_ROUTE) || path().startsWith('/admin');
const isVendorContext = () => path().startsWith('/vendor');
const isDeliveryContext = () => path().startsWith('/delivery');

const portalBase = () => {
  if (isVendorContext()) return '/vendor/support';
  if (isDeliveryContext()) return '/delivery/support';
  return '/user/support';
};

const unwrap = (response) => response?.data || response;
const errorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const sameTicket = (t, id) => t.ticketNumber === id || t.id === id || t._id === id;

export const useSupportStore = create((set, get) => ({
  tickets: [],
  isLoading: false,
  error: null,
  pagination: { total: 0, page: 1, limit: 10, pages: 1 },

  // `silent: true` is for background refreshes: no loading flicker and no error toast every few seconds
  fetchTickets: async (allParams = {}) => {
    const { silent, ...params } = allParams;
    if (!silent) set({ isLoading: true, error: null });
    try {
      const response = isAdminContext()
        ? await adminService.getAllTickets(params)
        : await api.get(`${portalBase()}/tickets`, { params });
      const data = unwrap(response);
      const list = Array.isArray(data?.tickets) ? data.tickets : Array.isArray(data) ? data : null;
      if (!list) throw new Error('Unexpected response from the server.');

      const pagination = data?.pagination || { total: list.length, page: 1, limit: 20, pages: 1 };
      set({ tickets: list, pagination, isLoading: false, error: null });
      return list;
    } catch (error) {
      const message = errorMessage(error, 'Could not load tickets.');
      if (silent) return get().tickets; // keep what is on screen
      set({ tickets: [], isLoading: false, error: message });
      toast.error(message);
      return [];
    }
  },

  fetchTicketById: async (id) => {
    set({ isLoading: true });
    try {
      const response = isAdminContext()
        ? await adminService.getTicketById(id)
        : await api.get(`${portalBase()}/tickets/${id}`);
      const ticket = unwrap(response);
      set({ isLoading: false });
      return ticket && (ticket.id || ticket._id || ticket.ticketNumber) ? ticket : null;
    } catch (error) {
      set({ isLoading: false });
      toast.error(errorMessage(error, 'Could not load the ticket.'));
      return null;
    }
  },

  createTicket: async (ticketData) => {
    set({ isLoading: true });
    try {
      if (isAdminContext()) throw new Error('Admins reply to tickets; they do not raise them here.');
      const response = await api.post(`${portalBase()}/tickets`, ticketData);
      const created = unwrap(response);
      if (!created || (!created.id && !created._id && !created.ticketNumber)) {
        throw new Error('The server did not return the new ticket.');
      }
      set({ tickets: [created, ...get().tickets.filter((t) => !sameTicket(t, created.id))], isLoading: false });
      toast.success('Support ticket created successfully!');
      return created;
    } catch (error) {
      set({ isLoading: false });
      toast.error(errorMessage(error, 'Failed to create ticket'));
      return null;
    }
  },

  updateTicketStatus: async (id, status, note = '') => {
    try {
      if (isAdminContext()) {
        await adminService.updateTicketStatus(id, status, note);
      } else if (isVendorContext() || isDeliveryContext()) {
        await api.patch(`${portalBase()}/tickets/${id}/status`, { status, note });
      } else {
        throw new Error('Only support staff can change a ticket status.');
      }
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to update status'));
      return false;
    }

    set({
      tickets: get().tickets.map((t) =>
        sameTicket(t, id)
          ? {
              ...t,
              status,
              timeline: [
                ...(t.timeline || []),
                { status, changedAt: new Date().toISOString(), note: note || `Status updated to ${status.replace('_', ' ')}` },
              ],
            }
          : t
      ),
    });
    toast.success('Status updated successfully');
    return true;
  },

  addReply: async (id, message, senderType = 'admin', attachment = null) => {
    try {
      if (isAdminContext()) {
        await adminService.addTicketMessage(id, message, attachment);
      } else {
        await api.post(`${portalBase()}/tickets/${id}/messages`, { message, attachment });
      }
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to send the reply'));
      return null;
    }

    // Re-read the ticket so the screen shows exactly what the server stored
    const refreshed = await get().fetchTicketById(id);
    if (refreshed) {
      set({ tickets: get().tickets.map((t) => (sameTicket(t, id) ? { ...t, ...refreshed } : t)) });
    }
    toast.success('Reply sent');
    return refreshed;
  },

  deleteTicket: async (id) => {
    try {
      if (!isAdminContext()) throw new Error('Only support staff can delete tickets.');
      await adminService.deleteTicket(id);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to delete ticket'));
      return false;
    }
    set({ tickets: get().tickets.filter((t) => !sameTicket(t, id)) });
    toast.success('Ticket deleted successfully');
    return true;
  },
}));
