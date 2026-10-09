import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import toast from "react-hot-toast";
import logoImage from "../../../data/logos/ChatGPT Image Dec 2, 2025, 03_01_19 PM.png";
import api from "../utils/api";
import { applyThemeToDom } from "../hooks/useDynamicTheme";

const defaultSettings = {
  general: {
    storeName: "Appzeto E-commerce",
    storeLogo: logoImage,
    favicon: logoImage,
    contactEmail: "contact@example.com",
    contactPhone: "+1234567890",
    address: "",
    businessHours: "Mon-Fri 9AM-6PM",
    timezone: "UTC",
    currency: "INR",
    language: "en",
    socialMedia: {
      facebook: "",
      instagram: "",
      twitter: "",
      linkedin: "",
    },
    accentColor: "#FFE11B",
    storeDescription: "",
  },
  payment: {
    paymentMethods: ["cod", "card", "wallet"],
    codEnabled: true,
    cardEnabled: true,
    walletEnabled: true,
    upiEnabled: false,
    paymentGateway: "stripe",
    stripePublicKey: "",
    stripeSecretKey: "",
    paymentFees: {
      cod: 0,
      card: 2.5,
      wallet: 1.5,
      upi: 0.5,
    },
  },
  shipping: {
    shippingZones: [],
    freeShippingThreshold: 100,
    defaultShippingRate: 5,
    shippingMethods: ["standard", "express"],
  },
  orders: {
    cancellationTimeLimit: 24, // hours
    minimumOrderValue: 0,
    orderTrackingEnabled: true,
    orderConfirmationEmail: true,
    orderStatuses: [
      "pending",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ],
  },
  customers: {
    guestCheckoutEnabled: true,
    registrationRequired: false,
    emailVerificationRequired: false,
    customerAccountFeatures: {
      orderHistory: true,
      wishlist: true,
      addresses: true,
    },
  },
  products: {
    itemsPerPage: 12,
    gridColumns: 4,
    defaultSort: "popularity",
    lowStockThreshold: 10,
    outOfStockBehavior: "show", // 'hide' or 'show'
    stockAlertsEnabled: true,
  },
  tax: {
    defaultTaxRate: 18,
    taxCalculationMethod: "exclusive", // 'inclusive' or 'exclusive'
    priceDisplayFormat: "INR", // Currency format
  },
  content: {
    privacyPolicy: "",
    termsConditions: "",
    refundPolicy: "",
  },
  features: {
    wishlistEnabled: true,
    reviewsEnabled: true,
    flashSaleEnabled: true,
    dailyDealsEnabled: true,
    liveChatEnabled: true,
    couponCodesEnabled: true,
  },
  homepage: {
    heroBannerEnabled: true,
    sections: {
      mostPopular: { enabled: true, order: 1 },
      trending: { enabled: true, order: 2 },
      flashSale: { enabled: true, order: 3 },
      dailyDeals: { enabled: true, order: 4 },
      recommended: { enabled: true, order: 5 },
    },
  },
  reviews: {
    moderationMode: "manual", // 'auto' or 'manual'
    purchaseRequired: true,
    displaySettings: {
      showAll: true,
      verifiedOnly: false,
      withPhotosOnly: false,
    },
  },
  email: {
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPassword: "",
    fromEmail: "noreply@example.com",
    fromName: "Appzeto Store",
  },
  notifications: {
    email: {
      orderConfirmation: true,
      shippingUpdate: true,
      deliveryUpdate: true,
    },
    smsEnabled: false,
    pushEnabled: false,
    admin: {
      newOrders: true,
      lowStock: true,
    },
  },
  seo: {
    metaTitle: "Appzeto E-commerce - Shop Online",
    metaDescription: "Shop the latest trends and products",
    metaKeywords: "ecommerce, shopping, online store",
    ogImage: logoImage,
    canonicalUrl: "",
  },
  theme: {
    primaryColor: "#7B0A0A",
    secondaryColor: "#3B82F6",
    accentColor: "#FFE11B",
    fontFamily: "Inter",
  },
};

export const useSettingsStore = create(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      isLoading: false,

      // Initialize settings
      initialize: async () => {
        let loadedSettings = defaultSettings;
        try {
          const savedSettings = localStorage.getItem("admin-settings");
          if (savedSettings) {
            const parsed = JSON.parse(savedSettings);
            if (parsed && typeof parsed === "object") {
              loadedSettings = {
                ...defaultSettings,
                ...parsed,
                general: { ...defaultSettings.general, ...(parsed.general || {}) },
                payment: { ...defaultSettings.payment, ...(parsed.payment || {}) },
                shipping: { ...defaultSettings.shipping, ...(parsed.shipping || {}) },
                orders: { ...defaultSettings.orders, ...(parsed.orders || {}) },
                customers: { ...defaultSettings.customers, ...(parsed.customers || {}) },
                products: { ...defaultSettings.products, ...(parsed.products || {}) },
                tax: { ...defaultSettings.tax, ...(parsed.tax || {}) },
                content: { ...defaultSettings.content, ...(parsed.content || {}) },
                features: { ...defaultSettings.features, ...(parsed.features || {}) },
                homepage: { ...defaultSettings.homepage, ...(parsed.homepage || {}) },
                reviews: { ...defaultSettings.reviews, ...(parsed.reviews || {}) },
                email: { ...defaultSettings.email, ...(parsed.email || {}) },
                notifications: { ...defaultSettings.notifications, ...(parsed.notifications || {}) },
                seo: { ...defaultSettings.seo, ...(parsed.seo || {}) },
                theme: { ...defaultSettings.theme, ...(parsed.theme || {}) },
              };
            }
          }
        } catch (e) {
          console.warn("Failed to parse admin-settings from localStorage", e);
        }

        set({ settings: loadedSettings });
        if (loadedSettings.theme) {
          try {
            applyThemeToDom(loadedSettings.theme);
          } catch (e) {
            console.warn("Failed to apply initial theme to DOM", e);
          }
        }

        try {
          localStorage.setItem(
            "admin-settings",
            JSON.stringify(loadedSettings)
          );
        } catch (_) {}
        
        // 1. Public theme sync from backend (accessible by all users/guests)
        try {
          const themeRes = await api.get('/settings/theme');
          if (themeRes?.data && typeof themeRes.data === 'object') {
            const backendTheme = themeRes.data;
            set((state) => {
              const updatedTheme = {
                ...state.settings.theme,
                ...backendTheme,
              };
              const updated = {
                ...state.settings,
                theme: updatedTheme,
              };
              try {
                localStorage.setItem("admin-settings", JSON.stringify(updated));
              } catch (_) {}
              applyThemeToDom(updatedTheme);
              return { settings: updated };
            });
          }
        } catch (error) {
          console.debug("Public theme sync bypassed or unavailable:", error.message);
        }

        // 2. Async fetch from backend to sync admin general settings
        try {
          const res = await api.get('/admin/settings/general');
          if (res?.data) {
            const backendGeneral = res.data;
            set((state) => {
              const updated = {
                ...state.settings,
                general: {
                  ...state.settings.general,
                  ...backendGeneral,
                }
              };
              try {
                localStorage.setItem("admin-settings", JSON.stringify(updated));
              } catch (_) {}
              return { settings: updated };
            });
          }
        } catch (error) {
          // Silent catch to handle guest page / unauthenticated states gracefully
          console.debug("Backend settings sync bypassed or unauthorized:", error.message);
        }
      },

      // Get settings
      getSettings: () => {
        const state = get();
        if (!state.settings) {
          state.initialize();
        }
        return get().settings;
      },

      // Update settings
      updateSettings: async (category, settingsData) => {
        set({ isLoading: true });
        try {
          const currentSettings = get().settings;
          const updatedSettings = {
            ...currentSettings,
            [category]: {
              ...currentSettings[category],
              ...settingsData,
            },
          };
          
          if (category === 'general') {
            await api.put('/admin/settings/general', updatedSettings.general);
          } else if (category === 'theme') {
            await api.put('/admin/settings/theme', updatedSettings.theme);
            applyThemeToDom(updatedSettings.theme);
          }
          
          set({ settings: updatedSettings, isLoading: false });
          try {
            localStorage.setItem(
              "admin-settings",
              JSON.stringify(updatedSettings)
            );
          } catch (_) {}

          if (category === 'theme') {
            applyThemeToDom(updatedSettings.theme);
          }

          toast.success("Settings updated successfully");
          return updatedSettings;
        } catch (error) {
          set({ isLoading: false });
          toast.error("Failed to update settings");
          throw error;
        }
      },
    }),
    {
      name: "settings-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
