import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as api from '../services/b2bAdminService';
import toast from 'react-hot-toast';

const normalizePayload = (response) => {
  const root = response?.data ?? response ?? {};
  if (Array.isArray(root)) {
    return {
      notifications: root,
      unreadCount: root.filter((n) => !n?.isRead).length,
      pages: 1,
    };
  }

  return {
    notifications: Array.isArray(root?.notifications) ? root.notifications : [],
    unreadCount: Number(root?.unreadCount || 0),
    pages: Number(root?.pages || 1),
  };
};

export const useB2BAdminStore = create(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      dashboardStats: null,
  employees: [],
  companyProfile: null,
  adminProfile: null,
  isLoading: false,
  error: null,
  notifications: [],
  unreadNotificationsCount: 0,
  notificationsPage: 1,
  notificationsHasMore: true,

  fetchDashboardStats: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getDashboardOverview();
      const payload = response.data || response;
      set({ dashboardStats: payload });
    } catch (err) {
      set({ error: err.response?.data?.message || 'Failed to fetch dashboard stats' });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchEmployees: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getEmployees();
      const payload = response.data || response;
      // Ensure we map standard MongoDB _id to id if needed by DataTable
      const employees = Array.isArray(payload) ? payload.map(emp => ({ ...emp, id: emp._id })) : [];
      set({ employees });
    } catch (err) {
      set({ error: err.response?.data?.message || 'Failed to fetch employees' });
    } finally {
      set({ isLoading: false });
    }
  },

  createEmployee: async (employeeData) => {
    set({ isLoading: true, error: null });
    try {
      await api.createEmployee(employeeData);
      await get().fetchEmployees();
      toast.success('Employee created successfully');
      return true;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create employee';
      set({ error: msg });
      toast.error(msg);
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  updateEmployee: async (id, employeeData) => {
    set({ isLoading: true, error: null });
    try {
      await api.updateEmployee(id, employeeData);
      await get().fetchEmployees();
      toast.success('Employee updated successfully');
      return true;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update employee';
      set({ error: msg });
      toast.error(msg);
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteEmployee: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await api.deleteEmployee(id);
      await get().fetchEmployees();
      toast.success('Employee deleted successfully');
      return true;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to delete employee';
      set({ error: msg });
      toast.error(msg);
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  allotEmployeeWallet: async (id, amount) => {
    set({ isLoading: true, error: null });
    try {
      await api.allotEmployeeWallet(id, amount);
      await get().fetchEmployees();
      toast.success('Wallet funds allotted successfully');
      return true;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to allot wallet funds';
      set({ error: msg });
      toast.error(msg);
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  fetchCompanyProfile: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getCompanyProfile();
      const payload = response.data || response;
      set({ companyProfile: payload });
    } catch (err) {
      set({ error: err.response?.data?.message || 'Failed to fetch company profile' });
    } finally {
      set({ isLoading: false });
    }
  },

  updateCompanyProfile: async (companyData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.updateCompanyProfile(companyData);
      const payload = response.data || response;
      set({ companyProfile: payload });
      toast.success('Company profile updated successfully');
      return true;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update company profile';
      set({ error: msg });
      toast.error(msg);
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  uploadCompanyLegalDocument: async (file, docType = 'acceptanceExecutionDocument') => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.uploadCompanyLegalDocument(file, docType);
      const payload = response.data || response;
      set({ companyProfile: payload });
      toast.success('Document uploaded successfully');
      return true;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to upload document';
      set({ error: msg });
      toast.error(msg);
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  fetchAdminProfile: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getAdminProfile();
      const payload = response.data || response;
      set({ adminProfile: payload });
    } catch (err) {
      set({ error: err.response?.data?.message || 'Failed to fetch admin profile' });
    } finally {
      set({ isLoading: false });
    }
  },

  updateAdminProfile: async (adminData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.updateAdminProfile(adminData);
      set({ isLoading: false });
      return { success: true, pendingUpdateId: response.data?.pendingUpdateId };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to initiate admin profile update';
      set({ error: msg });
      toast.error(msg);
      return { success: false };
    } finally {
      set({ isLoading: false });
    }
  },

  verifyAdminProfileOTP: async (pendingUpdateId, otp) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.verifyAdminProfileOTP({
        pendingUpdateId,
        otp
      });
      const payload = response.data || response;
      set({ adminProfile: payload });
      toast.success('Admin profile updated successfully');
      return true;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to verify OTP';
      set({ error: msg });
      toast.error(msg);
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  resendAdminProfileOTP: async (pendingUpdateId) => {
    set({ isLoading: true, error: null });
    try {
      await api.resendAdminProfileOTP({
        pendingUpdateId
      });
      toast.success('OTP resent successfully');
      return true;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to resend OTP';
      set({ error: msg });
      toast.error(msg);
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  // Auth methods
  login: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.loginB2BAdmin(credentials);
      const payload = response.data || response;

      if (payload?.status === '2FA_PENDING') {
        set({ isLoading: false });
        return { twoFactorRequired: true, tempToken: payload.tempToken, email: payload.email };
      }

      const accessToken = payload.accessToken || payload.data?.accessToken;
      const adminProfile = payload.b2bAdmin || payload.data?.b2bAdmin;
      
      if (accessToken) {
        sessionStorage.setItem('b2bAdminToken', accessToken);
        localStorage.removeItem('b2bAdminToken');
      }

      set({ isAuthenticated: true, adminProfile, error: null });
      return { success: true, isEmployee: !!adminProfile?.isEmployee };
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed';
      set({ error: msg });
      return { success: false, error: msg };
    } finally {
      set({ isLoading: false });
    }
  },

  verify2FA: async (tempToken, otp) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.verifyB2B2FA({ tempToken, otp });
      const payload = response.data || response;
      const accessToken = payload.accessToken || payload.data?.accessToken;
      const adminProfile = payload.b2bAdmin || payload.data?.b2bAdmin;

      if (accessToken) {
        sessionStorage.setItem('b2bAdminToken', accessToken);
        localStorage.removeItem('b2bAdminToken');
      }

      set({ isAuthenticated: true, adminProfile, error: null });
      return { success: true, isEmployee: !!adminProfile?.isEmployee };
    } catch (err) {
      const msg = err.response?.data?.message || 'Verification failed';
      set({ error: msg });
      return { success: false, error: msg };
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      await api.registerB2BAdmin(data);
      return true;
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed';
      set({ error: msg });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: () => {
    localStorage.removeItem('b2bAdminToken');
    localStorage.removeItem('b2bAdminRefreshToken');
    localStorage.removeItem('token');
    localStorage.removeItem('refresh-token');
    localStorage.removeItem('auth-storage');

    sessionStorage.removeItem('b2bAdminToken');
    sessionStorage.removeItem('b2bAdminRefreshToken');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('refresh-token');
    sessionStorage.removeItem('auth-storage');
    set({
      isAuthenticated: false,
      dashboardStats: null,
      employees: [],
      companyProfile: null,
      adminProfile: null,
      error: null,
      notifications: [],
      unreadNotificationsCount: 0,
      notificationsPage: 1,
      notificationsHasMore: true
    });

    // Also logout from main auth store if still authenticated
    try {
      import('../../../shared/store/authStore').then(({ useAuthStore }) => {
        const mainAuth = useAuthStore.getState();
        if (mainAuth.isAuthenticated) {
          mainAuth.logout();
        }
      }).catch(() => {});
    } catch (e) {}

    try {
      import('../../../shared/store/b2bStore').then(({ useB2bStore }) => {
        useB2bStore.getState().resetB2b();
      }).catch(() => {});
    } catch (e) {}
  },

  fetchNotifications: async (page = 1) => {
    if (!get().isAuthenticated) {
      set({
        notifications: [],
        unreadNotificationsCount: 0,
        notificationsPage: 1,
        notificationsHasMore: false,
      });
      return;
    }

    set({ isLoading: true });
    try {
      const response = await api.getNotifications(page);
      const payload = normalizePayload(response);
      set((state) => ({
        notifications:
          Number(page) === 1
            ? payload.notifications
            : [...state.notifications, ...payload.notifications],
        unreadNotificationsCount: Number(payload.unreadCount || 0),
        notificationsPage: Number(page),
        notificationsHasMore: Number(page) < Number(payload.pages || 1),
        isLoading: false,
      }));
    } catch (err) {
      console.error('Failed to fetch B2B notifications:', err);
      set({ isLoading: false });
    }
  },

  markNotificationAsRead: async (id) => {
    try {
      await api.markNotificationAsRead(id);
      set((state) => {
        const changed = state.notifications.some(
          (n) => String(n?._id) === String(id) && !n?.isRead
        );
        return {
          notifications: state.notifications.map((n) =>
            String(n?._id) === String(id) ? { ...n, isRead: true } : n
          ),
          unreadNotificationsCount: changed
            ? Math.max(0, Number(state.unreadNotificationsCount || 0) - 1)
            : state.unreadNotificationsCount,
        };
      });
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  },

  markAllNotificationsAsRead: async () => {
    try {
      await api.markAllNotificationsAsRead();
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
        unreadNotificationsCount: 0,
      }));
      toast.success('All notifications marked as read');
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
      toast.error('Failed to mark all notifications as read');
    }
  },

  deleteNotification: async (id) => {
    try {
      await api.deleteNotification(id);
      set((state) => {
        const existing = state.notifications.find(
          (n) => String(n?._id) === String(id)
        );
        return {
          notifications: state.notifications.filter(
            (n) => String(n?._id) !== String(id)
          ),
          unreadNotificationsCount:
            existing && !existing?.isRead
              ? Math.max(0, Number(state.unreadNotificationsCount || 0) - 1)
              : state.unreadNotificationsCount,
        };
      });
      toast.success('Notification deleted');
    } catch (err) {
      console.error('Failed to delete notification:', err);
      toast.error('Failed to delete notification');
    }
  }
    }),
    {
      name: 'b2badmin-auth-storage',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ 
        isAuthenticated: state.isAuthenticated,
        adminProfile: state.adminProfile
      })
    }
  )
);
