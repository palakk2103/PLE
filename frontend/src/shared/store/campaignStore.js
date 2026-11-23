import { create } from 'zustand';
import * as adminService from '../../modules/Admin/services/adminService';
import { ADMIN_BASE_ROUTE } from '../../modules/Admin/config/adminRoutesConfig';
import toast from 'react-hot-toast';
import api from '../utils/api';

// Campaigns come ONLY from the backend. (This store used to seed two fake "Festive Season" /
// "Holiday Deals" campaigns into every browser's localStorage and merge them with real data, and it
// reported "created successfully" even when the API call had failed. Both are gone.)
const LEGACY_MOCK_KEY = 'mock-campaigns';

const clearLegacyMockData = () => {
  try {
    localStorage.removeItem(LEGACY_MOCK_KEY);
  } catch {
    // storage unavailable — nothing to clear
  }
};

const normalizeCampaign = (c) => {
  const id = c?._id || c?.id;
  return { ...c, _id: id, id };
};

const errorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

export const useCampaignStore = create((set, get) => {
  // Only one festival campaign may be active at a time: switch the others off before saving.
  const deactivateOtherActiveFestivals = async (exceptId = null) => {
    const others = get().campaigns.filter(
      (c) => c.type === 'festival' && c.isActive && String(c._id) !== String(exceptId)
    );
    await Promise.all(
      others.map((c) => adminService.updateCampaign(c._id, { ...c, isActive: false }))
    );
  };

  return {
    campaigns: [],
    isLoading: false,

    initialize: async (params = {}) => {
      clearLegacyMockData();
      await get().fetchCampaigns(params);
    },

    fetchCampaigns: async (params = {}) => {
      set({ isLoading: true });
      clearLegacyMockData();
      try {
        const isAdminPath =
          window.location.pathname.startsWith(ADMIN_BASE_ROUTE) ||
          window.location.pathname.startsWith('/admin');
        let data;
        if (isAdminPath) {
          const response = await adminService.getAllCampaigns(params);
          data = response.data;
        } else {
          const response = await api.get('/campaigns', { params });
          data = response.data?.data || response.data;
        }
        const list = Array.isArray(data) ? data : data?.campaigns || [];
        set({
          campaigns: list.filter((c) => c && (c._id || c.id)).map(normalizeCampaign),
          isLoading: false,
        });
      } catch (error) {
        console.warn('fetchCampaigns failed:', error?.message);
        set({ isLoading: false });
      }
    },

    createCampaign: async (campaignData) => {
      set({ isLoading: true });
      try {
        if (campaignData.type === 'festival' && campaignData.isActive) {
          await deactivateOtherActiveFestivals();
        }
        const response = await adminService.createCampaign({
          ...campaignData,
          productIds: campaignData.productIds || [],
        });
        toast.success('Campaign created successfully');
        await get().fetchCampaigns();
        return response?.data;
      } catch (error) {
        set({ isLoading: false });
        toast.error(errorMessage(error, 'Failed to create campaign'));
        throw error;
      }
    },

    updateCampaign: async (id, campaignData) => {
      set({ isLoading: true });
      try {
        if (campaignData.type === 'festival' && campaignData.isActive) {
          await deactivateOtherActiveFestivals(id);
        }
        await adminService.updateCampaign(id, campaignData);
        toast.success('Campaign updated successfully');
        await get().fetchCampaigns();
      } catch (error) {
        set({ isLoading: false });
        toast.error(errorMessage(error, 'Failed to update campaign'));
        throw error;
      }
    },

    deleteCampaign: async (id) => {
      set({ isLoading: true });
      try {
        await adminService.deleteCampaign(id);
        toast.success('Campaign deleted successfully');
        await get().fetchCampaigns();
      } catch (error) {
        set({ isLoading: false });
        toast.error(errorMessage(error, 'Failed to delete campaign'));
        throw error;
      }
    },

    toggleCampaignStatus: async (id) => {
      const campaign = get().campaigns.find((c) => String(c._id) === String(id));
      if (!campaign) return;
      await get().updateCampaign(id, { ...campaign, isActive: !campaign.isActive });
    },

    getCampaignsByType: (type) => {
      if (!type) return get().campaigns;
      return get().campaigns.filter((campaign) => campaign.type === type);
    },
  };
});

export const generateSlug = (name, existingCampaigns = []) => {
  if (!name) return '';

  const slug = name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();

  let finalSlug = slug;
  let counter = 1;

  while (existingCampaigns.some((c) => c.slug === finalSlug)) {
    finalSlug = `${slug}-${counter}`;
    counter++;
  }

  return finalSlug;
};
