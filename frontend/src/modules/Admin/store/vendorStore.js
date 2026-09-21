import { create } from "zustand";
import {
  getAllVendors,
  getVendorById,
  updateVendorStatus as updateVendorStatusApi,
  updateCommissionRate as updateCommissionRateApi,
  unflagVendor as unflagVendorApi,
  flagVendor as flagVendorApi,
} from "../services/adminService";

const normalizeVendor = (vendor) => {
  if (!vendor || typeof vendor !== "object") return vendor;
  const id = String(vendor.id || vendor._id || "");
  return {
    ...vendor,
    id,
    _id: String(vendor._id || id),
  };
};

export const useVendorStore = create((set, get) => ({
  vendors: [],
  selectedVendor: null,
  isLoading: false,

  initialize: async () => {
    set({ isLoading: true });
    try {
      const vendors = [];
      let page = 1;
      let totalPages = 1;

      do {
        const response = await getAllVendors({ page, limit: 200 });
        const payload = response?.data ?? response;
        const pageVendors = Array.isArray(payload?.vendors)
          ? payload.vendors.map(normalizeVendor)
          : [];

        vendors.push(...pageVendors);
        totalPages = Math.max(Number(payload?.pages) || 1, 1);
        page += 1;
      } while (page <= totalPages);

      set({ vendors, isLoading: false });
      return vendors;
    } catch {
      console.warn("Admin getAllVendors API call failed.");
      set({ vendors: [], isLoading: false });
      return [];
    }
  },

  getAllVendors: () => get().vendors,

  getVendor: async (id) => {
    const existing = get().vendors.find(
      (v) => String(v.id || v._id) === String(id)
    );
    if (existing) {
      set({ selectedVendor: existing });
      return existing;
    }

    try {
      const response = await getVendorById(id);
      const vendor = normalizeVendor(response?.data ?? response);
      if (!vendor) return null;
      set((state) => ({
        selectedVendor: vendor,
        vendors: state.vendors.some(
          (v) => String(v.id || v._id) === String(vendor.id)
        )
          ? state.vendors.map((v) =>
            String(v.id || v._id) === String(vendor.id) ? vendor : v
          )
          : [...state.vendors, vendor],
      }));
      return vendor;
    } catch {
      return null;
    }
  },

  updateVendorStatus: async (id, status, reason = "") => {
    try {
      const response = await updateVendorStatusApi(id, status, reason);
      const vendor = normalizeVendor(response?.data ?? response);
      if (!vendor) return false;
      
      await get().initialize();
      return true;
    } catch {
      console.warn("updateVendorStatus API failed.");
      return false;
    }
  },

  updateCommissionRate: async (id, commissionRate) => {
    try {
      const response = await updateCommissionRateApi(id, commissionRate);
      const vendor = normalizeVendor(response?.data ?? response);
      if (!vendor) return false;
      
      await get().initialize();
      return true;
    } catch {
      console.warn("updateCommissionRate API failed.");
      return false;
    }
  },

  unflagVendor: async (id, reason = "") => {
    try {
      const response = await unflagVendorApi(id, reason);
      const vendor = normalizeVendor(response?.data ?? response);
      if (!vendor) return false;
      await get().initialize();
      return true;
    } catch {
      console.warn("unflagVendor API failed.");
      return false;
    }
  },

  flagVendor: async (id, reason = "") => {
    try {
      const response = await flagVendorApi(id, reason);
      const vendor = normalizeVendor(response?.data ?? response);
      if (!vendor) return false;
      await get().initialize();
      return true;
    } catch {
      console.warn("flagVendor API failed.");
      return false;
    }
  },
}));
