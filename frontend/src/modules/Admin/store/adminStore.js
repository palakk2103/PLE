import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { adminLogin as apiLogin } from '../services/adminService';
import api from '../../../shared/utils/api';

export const useAdminAuthStore = create(
  persist(
    (set) => ({
      admin: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      // Admin login — calls real backend
      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const response = await apiLogin(email, password);
          const data = response.data || response;
          if (data?.status === '2FA_PENDING') {
            set({ isLoading: false });
            return { twoFactorRequired: true, tempToken: data.tempToken, email: data.email };
          }
          const { accessToken, refreshToken, admin } = data;

          // Store token under 'adminToken' key in localStorage
          localStorage.setItem('adminToken', accessToken);
          localStorage.setItem('adminRefreshToken', refreshToken);
          sessionStorage.removeItem('adminToken');
          sessionStorage.removeItem('adminRefreshToken');

          set({
            admin,
            token: accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });

          return { success: true, admin };
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      verify2FA: async (tempToken, otp) => {
        set({ isLoading: true });
        try {
          const response = await api.post('/admin/auth/2fa/verify-login', { tempToken, otp });
          const data = response.data || response;
          const { accessToken, refreshToken, admin } = data;

          localStorage.setItem('adminToken', accessToken);
          localStorage.setItem('adminRefreshToken', refreshToken);
          sessionStorage.removeItem('adminToken');
          sessionStorage.removeItem('adminRefreshToken');

          set({
            admin,
            token: accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });

          return { success: true, admin };
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      // Silent refresh for admin session
      refreshSession: async () => {
        const refreshToken = localStorage.getItem('adminRefreshToken') || sessionStorage.getItem('adminRefreshToken');
        if (!refreshToken) return false;
        try {
          const response = await api.post('/admin/auth/refresh', { refreshToken });
          const data = response?.data?.data || response?.data || response;
          const accessToken = data?.accessToken;
          const newRefreshToken = data?.refreshToken;
          if (accessToken) {
            set({
              token: accessToken,
              refreshToken: newRefreshToken || refreshToken,
              isAuthenticated: true,
            });
            localStorage.setItem('adminToken', accessToken);
            if (newRefreshToken) {
              localStorage.setItem('adminRefreshToken', newRefreshToken);
            }
            return true;
          }
          return false;
        } catch (err) {
          console.warn('Admin silent refresh failed:', err);
          if (err?.response?.status === 401) {
            get().logout();
          }
          return false;
        }
      },

      // Admin logout
      logout: () => {
        const refreshToken = localStorage.getItem('adminRefreshToken') || sessionStorage.getItem('adminRefreshToken');
        if (refreshToken) {
          api.post('/admin/auth/logout', { refreshToken }).catch(() => {});
        }

        set({ admin: null, token: null, refreshToken: null, isAuthenticated: false });
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminRefreshToken');
        sessionStorage.removeItem('adminToken');
        sessionStorage.removeItem('adminRefreshToken');
      },

      // Initialize admin auth state from localStorage
      initialize: () => {
        // Migrate legacy sessionStorage
        const sessionTok = sessionStorage.getItem('adminToken');
        const sessionRef = sessionStorage.getItem('adminRefreshToken');
        const sessionAuth = sessionStorage.getItem('admin-auth-storage');
        if (sessionTok && !localStorage.getItem('adminToken')) {
          localStorage.setItem('adminToken', sessionTok);
          if (sessionRef) localStorage.setItem('adminRefreshToken', sessionRef);
          if (sessionAuth && !localStorage.getItem('admin-auth-storage')) {
            localStorage.setItem('admin-auth-storage', sessionAuth);
          }
        }

        const token = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
        const refreshToken = localStorage.getItem('adminRefreshToken') || sessionStorage.getItem('adminRefreshToken');
        const storedState = JSON.parse(
          localStorage.getItem('admin-auth-storage') || 
          sessionStorage.getItem('admin-auth-storage') || 
          '{}'
        );

        if (token || refreshToken) {
          if (storedState.state?.admin) {
            set({
              admin: storedState.state.admin,
              token: token || null,
              refreshToken: refreshToken || null,
              isAuthenticated: true,
              isLoading: false,
            });
          }
        } else {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'admin-auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        admin: state.admin,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }), // Exclude loading UI state from persistence
    }
  )
);
