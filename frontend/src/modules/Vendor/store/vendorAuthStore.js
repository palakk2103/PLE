import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import api from "../../../shared/utils/api";
import {
  registerVendor,
  updateVendorProfile,
  forgotVendorPassword,
  verifyVendorResetOTP,
  resetVendorPassword,
} from "../services/vendorService";

export const useVendorAuthStore = create(
  persist(
    (set, get) => ({
      vendor: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      // Vendor login action
      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const response = await api.post("/vendor/auth/login", {
            email,
            password,
          });
          const authData = response?.data || {};
          if (authData?.status === '2FA_PENDING') {
            set({ isLoading: false });
            return { twoFactorRequired: true, tempToken: authData.tempToken, email: authData.email };
          }

          const vendor = authData.vendor;
          const accessToken = authData.accessToken;
          const refreshToken = authData.refreshToken;

          if (!vendor || !accessToken || !refreshToken) {
            throw new Error("Invalid login response");
          }

          set({
            vendor,
            token: accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });

          // Store token in localStorage for persistent vendor session
          localStorage.setItem("vendor-token", accessToken);
          localStorage.setItem("vendor-refresh-token", refreshToken);
          sessionStorage.removeItem("vendor-token");
          sessionStorage.removeItem("vendor-refresh-token");

          return { success: true, vendor };
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      verify2FA: async (tempToken, otp) => {
        set({ isLoading: true });
        try {
          const response = await api.post("/vendor/auth/2fa/verify-login", { tempToken, otp });
          const authData = response?.data || {};
          const vendor = authData.vendor;
          const accessToken = authData.accessToken;
          const refreshToken = authData.refreshToken;

          if (!vendor || !accessToken || !refreshToken) {
            throw new Error("Invalid verification response");
          }

          set({
            vendor,
            token: accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });

          localStorage.setItem("vendor-token", accessToken);
          localStorage.setItem("vendor-refresh-token", refreshToken);
          sessionStorage.removeItem("vendor-token");
          sessionStorage.removeItem("vendor-refresh-token");

          return { success: true, vendor };
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      // Vendor registration action — calls real POST /vendor/auth/register
      // Backend sends an OTP email; vendor is NOT authenticated until OTP verified.
      register: async (vendorData) => {
        set({ isLoading: true });

        try {
          const response = await registerVendor(vendorData);
          const data = response?.data ?? response;
          set({ isLoading: false });
          return {
            success: true,
            message: data?.message || "Registration successful! Please check your email for the OTP.",
          };
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      forgotPassword: async (email) => {
        set({ isLoading: true });
        try {
          const response = await forgotVendorPassword(email);
          const data = response?.data ?? response;
          set({ isLoading: false });
          return { success: true, message: data?.message };
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      verifyResetOtp: async (email, otp) => {
        set({ isLoading: true });
        try {
          const response = await verifyVendorResetOTP(email, otp);
          const data = response?.data ?? response;
          set({ isLoading: false });
          return { success: true, message: data?.message };
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      resetPassword: async (email, password, confirmPassword) => {
        set({ isLoading: true });
        try {
          const response = await resetVendorPassword(email, password, confirmPassword);
          const data = response?.data ?? response;
          set({ isLoading: false });
          return { success: true, message: data?.message };
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      // Vendor logout action
      logout: () => {
        const refreshToken = sessionStorage.getItem("vendor-refresh-token") || localStorage.getItem("vendor-refresh-token");
        if (refreshToken) {
          api.post("/vendor/auth/logout", { refreshToken }).catch(() => {});
        }

        set({
          vendor: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
        });
        localStorage.removeItem("vendor-token");
        localStorage.removeItem("vendor-refresh-token");
        sessionStorage.removeItem("vendor-token");
        sessionStorage.removeItem("vendor-refresh-token");
      },

      // Update vendor profile — calls real PUT /vendor/auth/profile
      updateProfile: async (profileData) => {
        set({ isLoading: true });
        try {
          const response = await updateVendorProfile(profileData);
          set({ isLoading: false });
          return { success: true, pendingUpdateId: response.data?.pendingUpdateId };
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      // Verify vendor profile update OTP
      verifyProfileOTP: async (pendingUpdateId, otp) => {
        set({ isLoading: true });
        try {
          const response = await api.post('/vendor/auth/profile/verify-otp', {
            pendingUpdateId,
            otp
          });
          const data = response?.data ?? response;
          const updatedVendor =
            data && (data._id || data.id)
              ? data
              : (data?.vendor ?? { ...get().vendor });

          set({
            vendor: updatedVendor,
            isLoading: false,
          });

          return { success: true, vendor: updatedVendor };
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      // Resend vendor profile update OTP
      resendProfileOTP: async (pendingUpdateId) => {
        set({ isLoading: true });
        try {
          await api.post('/vendor/auth/profile/resend-otp', {
            pendingUpdateId
          });
          set({ isLoading: false });
          return { success: true };
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      setVendor: (updatedVendor) => {
        set({ vendor: updatedVendor });
      },

      refreshProfile: async () => {
        try {
          const res = await api.get("/vendor/auth/profile");
          const vendorData = res?.data?.data || res?.data || res;
          if (vendorData && (vendorData._id || vendorData.id || vendorData.email)) {
            const normalized = {
              ...vendorData,
              id: vendorData._id || vendorData.id,
              b2bSellingStatus: vendorData.b2bSellingStatus || 'not_applied'
            };
            set({ vendor: normalized });
            return normalized;
          }
        } catch {
          // silently ignore if failed
        }
        return null;
      },

      // Silent refresh for vendor session
      refreshSession: async () => {
        const refreshToken = localStorage.getItem("vendor-refresh-token") || sessionStorage.getItem("vendor-refresh-token");
        if (!refreshToken) return false;
        try {
          const response = await api.post("/vendor/auth/refresh", { refreshToken });
          const authData = response?.data?.data || response?.data || response;
          const accessToken = authData?.accessToken;
          const newRefreshToken = authData?.refreshToken;
          if (accessToken) {
            set({
              token: accessToken,
              refreshToken: newRefreshToken || refreshToken,
              isAuthenticated: true,
            });
            localStorage.setItem("vendor-token", accessToken);
            if (newRefreshToken) {
              localStorage.setItem("vendor-refresh-token", newRefreshToken);
            }
            return true;
          }
          return false;
        } catch (err) {
          console.warn("Vendor silent refresh failed:", err);
          if (err?.response?.status === 401) {
            get().logout();
          }
          return false;
        }
      },

      // Initialize vendor auth state from localStorage
      initialize: () => {
        // Migrate legacy sessionStorage
        const sessionTok = sessionStorage.getItem("vendor-token");
        const sessionRef = sessionStorage.getItem("vendor-refresh-token");
        const sessionAuth = sessionStorage.getItem("vendor-auth-storage");
        if (sessionTok && !localStorage.getItem("vendor-token")) {
          localStorage.setItem("vendor-token", sessionTok);
          if (sessionRef) localStorage.setItem("vendor-refresh-token", sessionRef);
          if (sessionAuth && !localStorage.getItem("vendor-auth-storage")) {
            localStorage.setItem("vendor-auth-storage", sessionAuth);
          }
        }

        const token = localStorage.getItem("vendor-token") || sessionStorage.getItem("vendor-token");
        const refreshToken = localStorage.getItem("vendor-refresh-token") || sessionStorage.getItem("vendor-refresh-token");
        const storedState = JSON.parse(
          localStorage.getItem("vendor-auth-storage") ||
          sessionStorage.getItem("vendor-auth-storage") || "{}"
        );

        const persistedVendor = storedState.state?.vendor || null;
        if (token || refreshToken) {
          if (persistedVendor) {
            set({
              vendor: persistedVendor,
              token: token || null,
              refreshToken: refreshToken || null,
              isAuthenticated: true,
              isLoading: false,
            });
            // Automatically sync fresh permissions from database
            get().refreshProfile();
          }
        } else {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: "vendor-auth-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        vendor: state.vendor,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }), // Exclude transient loading variables from local disk persist
    }
  )
);
