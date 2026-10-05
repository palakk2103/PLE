import { create } from 'zustand';
import * as adminService from '../../modules/Admin/services/adminService';
import toast from 'react-hot-toast';
import api from '../utils/api';

const STORAGE_KEY = 'mock-campaigns';

const initializeLocalStorage = () => {
  const existing = localStorage.getItem(STORAGE_KEY);
  let needRefresh = !existing;
  
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      // If all campaigns have passed their endDate, refresh with future dates
      const hasActive = Array.isArray(parsed) && parsed.some(c => new Date(c.endDate) >= new Date());
      if (!hasActive) needRefresh = true;
    } catch {
      needRefresh = true;
    }
  }

  if (needRefresh) {
    const defaultCampaigns = [
      {
        _id: 'camp_diwali',
        name: 'Festive Season Mega Sale',
        type: 'festival',
        description: 'Celebrate the festive season with premium deals and special offers!',
        discountType: 'percentage',
        discountValue: 20,
        startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Started 2 days ago
        endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Valid for next 60 days
        productIds: [],
        isActive: true,
        slug: 'festive-season-sale',
        bannerConfig: {
          title: 'Festive Season Mega Sale',
          subtitle: 'Flat 20% Off on Featured Festival Products',
          image: 'https://images.unsplash.com/photo-1605152276897-4f618f831968?w=1200&auto=format&fit=crop&q=80',
          customImage: false
        }
      },
      {
        _id: 'camp_holiday',
        name: 'Special Holiday Deals',
        type: 'festival',
        description: 'Exclusive holiday season festival campaign for all verified sellers.',
        discountType: 'percentage',
        discountValue: 15,
        startDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        productIds: [],
        isActive: true,
        slug: 'holiday-deals',
        bannerConfig: {
          title: 'Special Holiday Deals',
          subtitle: 'Great discounts across top categories',
          image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=1200&auto=format&fit=crop&q=80',
          customImage: false
        }
      }
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultCampaigns));
  }
};

export const useCampaignStore = create((set, get) => ({
  campaigns: [],
  isLoading: false,

  initialize: async (params = {}) => {
    initializeLocalStorage();
    await get().fetchCampaigns(params);
  },

  fetchCampaigns: async (params = {}) => {
    set({ isLoading: true });
    initializeLocalStorage();
    
    let backendCampaigns = [];
    try {
      const isAdminPath = window.location.pathname.startsWith('/admin');
      if (isAdminPath) {
        const response = await adminService.getAllCampaigns(params);
        const data = response.data;
        backendCampaigns = Array.isArray(data) ? data : (data?.campaigns || []);
      } else {
        const response = await api.get('/campaigns', { params });
        const data = response.data?.data || response.data;
        backendCampaigns = Array.isArray(data) ? data : (data?.campaigns || []);
      }
    } catch (error) {
      console.warn("Backend fetchCampaigns failed, using localStorage fallback.");
    }

    const localCampaigns = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    
    // Merge local campaigns and backend campaigns
    const mergedMap = new Map();
    backendCampaigns.forEach(c => {
      if (c && (c._id || c.id)) {
        const id = c._id || c.id;
        mergedMap.set(String(id), { ...c, _id: id, id });
      }
    });
    
    localCampaigns.forEach(c => {
      if (c && (c._id || c.id)) {
        const id = c._id || c.id;
        mergedMap.set(String(id), { ...c, _id: id, id });
      }
    });

    set({ campaigns: Array.from(mergedMap.values()), isLoading: false });
  },

  createCampaign: async (campaignData) => {
    set({ isLoading: true });
    try {
      // Ensure only one active festival campaign
      if (campaignData.type === 'festival' && campaignData.isActive) {
        const localCampaigns = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        const updatedLocals = localCampaigns.map(c => 
          c.type === 'festival' ? { ...c, isActive: false } : c
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLocals));
      }

      let newCampaign = {
        ...campaignData,
        _id: 'camp_' + Date.now(),
        productIds: campaignData.productIds || []
      };

      try {
        const response = await adminService.createCampaign(campaignData);
        if (response?.data) {
          newCampaign = { ...newCampaign, ...response.data };
        }
      } catch (err) {
        console.warn("Backend createCampaign failed, running in offline mode.");
      }

      const localCampaigns = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      localCampaigns.push(newCampaign);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(localCampaigns));

      toast.success('Campaign created successfully');
      await get().fetchCampaigns();
      return newCampaign;
    } catch (error) {
      set({ isLoading: false });
      toast.error(error.message || 'Failed to create campaign');
      throw error;
    }
  },

  updateCampaign: async (id, campaignData) => {
    set({ isLoading: true });
    try {
      // Ensure only one active festival campaign
      if (campaignData.type === 'festival' && campaignData.isActive) {
        const localCampaigns = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        const updatedLocals = localCampaigns.map(c => 
          (c.type === 'festival' && String(c._id) !== String(id)) ? { ...c, isActive: false } : c
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLocals));
      }

      try {
        await adminService.updateCampaign(id, campaignData);
      } catch (err) {
        console.warn("Backend updateCampaign failed, running in offline mode.");
      }

      const localCampaigns = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const updated = localCampaigns.map(c => 
        String(c._id) === String(id) ? { ...c, ...campaignData, _id: id } : c
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

      toast.success('Campaign updated successfully');
      await get().fetchCampaigns();
    } catch (error) {
      set({ isLoading: false });
      toast.error(error.message || 'Failed to update campaign');
      throw error;
    }
  },

  deleteCampaign: async (id) => {
    set({ isLoading: true });
    try {
      try {
        await adminService.deleteCampaign(id);
      } catch (err) {
        console.warn("Backend deleteCampaign failed, running in offline mode.");
      }

      const localCampaigns = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const filtered = localCampaigns.filter(c => String(c._id) !== String(id));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));

      toast.success('Campaign deleted successfully');
      await get().fetchCampaigns();
    } catch (error) {
      set({ isLoading: false });
      toast.error(error.message || 'Failed to delete campaign');
      throw error;
    }
  },

  toggleCampaignStatus: async (id) => {
    const campaign = get().campaigns.find(c => String(c._id) === String(id));
    if (!campaign) return;
    const newStatus = !campaign.isActive;

    await get().updateCampaign(id, { ...campaign, isActive: newStatus });
  },

  getCampaignsByType: (type) => {
    if (!type) return get().campaigns;
    return get().campaigns.filter((campaign) => campaign.type === type);
  }
}));

export const generateSlug = (name, existingCampaigns = []) => {
  if (!name) return '';

  let slug = name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();

  let finalSlug = slug;
  let counter = 1;

  while (existingCampaigns.some(c => c.slug === finalSlug)) {
    finalSlug = `${slug}-${counter}`;
    counter++;
  }

  return finalSlug;
};


