import { create } from "zustand";
import {
  getAllB2BUsers,
  getB2BUserById,
  updateB2BUserStatus as updateB2BUserStatusApi,
  requestB2BDocumentResubmission,
  deleteB2BUser as deleteB2BUserApi,
} from "../services/adminService";

const normalizeB2BUser = (b2bUser) => {
  if (!b2bUser || typeof b2bUser !== "object") return b2bUser;
  const id = String(b2bUser.id || b2bUser._id || "");
  return {
    ...b2bUser,
    id,
    _id: String(b2bUser._id || id),
  };
};

export const useB2BUserStore = create((set, get) => ({
  b2bUsers: [],
  selectedB2BUser: null,
  isLoading: false,

  initialize: async () => {
    set({ isLoading: true });
    try {
      const b2bUsers = [];
      let page = 1;
      let totalPages = 1;

      do {
        const response = await getAllB2BUsers({ page, limit: 200 });
        const payload = response?.data ?? response;
        const pageUsers = Array.isArray(payload?.b2bUsers)
          ? payload.b2bUsers.map(normalizeB2BUser)
          : [];

        b2bUsers.push(...pageUsers);
        totalPages = Math.max(Number(payload?.pages) || 1, 1);
        page += 1;
      } while (page <= totalPages);

      set({ b2bUsers, isLoading: false });
      return b2bUsers;
    } catch {
      console.warn("Admin getAllB2BUsers API call failed.");
      set({ b2bUsers: [], isLoading: false });
      return [];
    }
  },

  getAllB2BUsers: () => get().b2bUsers,

  getB2BUser: async (id) => {
    const existing = get().b2bUsers.find(
      (v) => String(v.id || v._id) === String(id)
    );
    if (existing) {
      set({ selectedB2BUser: existing });
      return existing;
    }

    try {
      const response = await getB2BUserById(id);
      const user = normalizeB2BUser(response?.data ?? response);
      if (!user) return null;
      set((state) => ({
        selectedB2BUser: user,
        b2bUsers: state.b2bUsers.some(
          (v) => String(v.id || v._id) === String(user.id)
        )
          ? state.b2bUsers.map((v) =>
            String(v.id || v._id) === String(user.id) ? user : v
          )
          : [...state.b2bUsers, user],
      }));
      return user;
    } catch {
      return null;
    }
  },

  updateB2BUserStatus: async (id, status, reason = "", requestedDocs = []) => {
    try {
      const response = await updateB2BUserStatusApi(id, status, reason, requestedDocs);
      const user = normalizeB2BUser(response?.data ?? response);
      if (!user) return false;

      await get().initialize();
      return true;
    } catch {
      console.warn("updateB2BUserStatus API failed");
      return false;
    }
  },

  requestDocumentResubmission: async (id, reason, requestedDocs = []) => {
    try {
      const response = await requestB2BDocumentResubmission(id, reason, requestedDocs);
      const user = normalizeB2BUser(response?.data ?? response);
      if (!user) return false;

      await get().initialize();
      return true;
    } catch {
      console.warn("requestDocumentResubmission API failed");
      return false;
    }
  },

  deleteB2BUser: async (id) => {
    try {
      await deleteB2BUserApi(id);
      await get().initialize();
      return true;
    } catch {
      console.warn("deleteB2BUser API failed");
      return false;
    }
  },
}));
