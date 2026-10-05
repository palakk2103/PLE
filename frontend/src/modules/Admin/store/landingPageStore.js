import { create } from 'zustand';
import api from '../../../shared/utils/api';
import { LANDING_PAGE_DEFAULTS } from '../data/landingPageDefaults';

export const useLandingPageStore = create(
  (set, get) => ({
    ...LANDING_PAGE_DEFAULTS,

    saveToBackend: async () => {
      try {
        const state = get();
        const { 
          sections, hero, services, whyChooseUs, comparison, stats, testimonials, products, 
          pricing, gallery, presenceMap, ctaBanner, faq, contact, social, footer, seo, blogs, 
          adLandingPages, trustedBrands, productCategories, portfolioHighlights, cpoSection, 
          gpoSection, smartDeals, loyaltyRewards, zeroMaintenance,
          whyChooseUsHeader, portfolioHighlightsHeader, galleryHeader, testimonialsHeader, productsHeader,
          catalogue, productCategoriesShowcase
        } = state;
        
        const payload = { 
          sections, hero, services, whyChooseUs, comparison, stats, testimonials, products, 
          pricing, gallery, presenceMap, ctaBanner, faq, contact, social, footer, seo, blogs, 
          adLandingPages, trustedBrands, productCategories, portfolioHighlights, cpoSection, 
          gpoSection, smartDeals, loyaltyRewards, zeroMaintenance,
          whyChooseUsHeader, portfolioHighlightsHeader, galleryHeader, testimonialsHeader, productsHeader,
          catalogue, productCategoriesShowcase
        };
        await api.put('/admin/settings/landingPageCms', { value: payload });
        return true;
      } catch (error) {
        console.error("Failed to save landing page CMS to backend:", error);
        throw error;
      }
    },

    fetchInitialData: async () => {
      try {
        const response = await api.get('/settings/landingPageCms');
        let payload = response?.data?.data || response?.data;
        // Auto-heal legacy nested data from previous bug
        if (payload && payload.value && !payload.hero) {
          payload = payload.value;
        }
        if (payload && Object.keys(payload).length > 0) {
          set((state) => {
            let mergedSections = [...state.sections];
            if (payload.sections && Array.isArray(payload.sections)) {
              const existingIds = payload.sections.map(s => s.id);
              const newSections = state.sections.filter(s => !existingIds.includes(s.id));
              mergedSections = [...payload.sections, ...newSections];
            }
            return {
              ...state,
              ...payload,
              sections: mergedSections,
              portfolioHighlights: payload.portfolioHighlights || state.portfolioHighlights,
              cpoSection: payload.cpoSection ? { ...state.cpoSection, ...payload.cpoSection } : state.cpoSection,
              gpoSection: payload.gpoSection ? { ...state.gpoSection, ...payload.gpoSection } : state.gpoSection,
              smartDeals: payload.smartDeals ? { ...state.smartDeals, ...payload.smartDeals } : state.smartDeals,
              loyaltyRewards: payload.loyaltyRewards ? { ...state.loyaltyRewards, ...payload.loyaltyRewards } : state.loyaltyRewards,
              zeroMaintenance: payload.zeroMaintenance ? { ...state.zeroMaintenance, ...payload.zeroMaintenance } : state.zeroMaintenance,
              trustedBrands: payload.trustedBrands ? { ...state.trustedBrands, ...payload.trustedBrands } : state.trustedBrands,
              productCategories: payload.productCategories ? { ...state.productCategories, ...payload.productCategories } : state.productCategories,
              presenceMap: payload.presenceMap ? {
                ...payload.presenceMap,
                locations: (payload.presenceMap.locations || []).map(loc => 
                  loc.name.toLowerCase() === 'karnataka' ? { ...loc, top: '70%', left: '29%' } : loc
                )
              } : state.presenceMap,
              contact: {
                ...state.contact,
                ...(payload.contact || {})
              },
              whyChooseUsHeader: payload.whyChooseUsHeader ? { ...state.whyChooseUsHeader, ...payload.whyChooseUsHeader } : state.whyChooseUsHeader,
              portfolioHighlightsHeader: payload.portfolioHighlightsHeader ? { ...state.portfolioHighlightsHeader, ...payload.portfolioHighlightsHeader } : state.portfolioHighlightsHeader,
              galleryHeader: payload.galleryHeader ? { ...state.galleryHeader, ...payload.galleryHeader } : state.galleryHeader,
              testimonialsHeader: payload.testimonialsHeader ? { ...state.testimonialsHeader, ...payload.testimonialsHeader } : state.testimonialsHeader,
              productsHeader: payload.productsHeader ? { ...state.productsHeader, ...payload.productsHeader } : state.productsHeader,
              catalogue: payload.catalogue ? { ...state.catalogue, ...payload.catalogue } : state.catalogue,
              productCategoriesShowcase: payload.productCategoriesShowcase ? { ...state.productCategoriesShowcase, ...payload.productCategoriesShowcase } : state.productCategoriesShowcase,
            };
          });
        }
      } catch (error) {
        console.error("Failed to fetch landing page CMS from backend:", error);
      }
    },

    // Actions
    updateSectionVisibility: (sectionId, visible) => {
      set((state) => ({
        sections: state.sections.map((sec) =>
          sec.id === sectionId ? { ...sec, visible } : sec
        ),
      }));
      get().saveToBackend();
    },

    updateSectionsOrder: (newSections) => {
      set({ sections: newSections });
      get().saveToBackend();
    },

    updateHero: (data) => {
      set((state) => ({ hero: { ...state.hero, ...data } }));
      get().saveToBackend();
    },

    updateTrustedBrands: (data) => {
      set((state) => ({ trustedBrands: { ...state.trustedBrands, ...data } }));
      get().saveToBackend();
    },

    updateProductCategories: (data) => {
      set((state) => ({ productCategories: { ...state.productCategories, ...data } }));
      get().saveToBackend();
    },

    updatePortfolioHighlights: (portfolioHighlights) => {
      set({ portfolioHighlights });
      get().saveToBackend();
    },

    updateCpoSection: (data) => {
      set((state) => ({ cpoSection: { ...state.cpoSection, ...data } }));
      get().saveToBackend();
    },

    updateGpoSection: (data) => {
      set((state) => ({ gpoSection: { ...state.gpoSection, ...data } }));
      get().saveToBackend();
    },

    updateSmartDeals: (data) => {
      set((state) => ({ smartDeals: { ...state.smartDeals, ...data } }));
      get().saveToBackend();
    },

    updateLoyaltyRewards: (data) => {
      set((state) => ({ loyaltyRewards: { ...state.loyaltyRewards, ...data } }));
      get().saveToBackend();
    },

    updateZeroMaintenance: (data) => {
      set((state) => ({ zeroMaintenance: { ...state.zeroMaintenance, ...data } }));
      get().saveToBackend();
    },

    updateServices: (services) => {
      set({ services });
      get().saveToBackend();
    },
    
    updateWhyChooseUs: (whyChooseUs) => {
      set({ whyChooseUs });
      get().saveToBackend();
    },

    updateComparison: async (data) => {
      set((state) => ({ comparison: { ...state.comparison, ...data } }));
      await get().saveToBackend();
    },

    updateStats: (stats) => {
      set({ stats });
      get().saveToBackend();
    },

    updateTestimonials: (testimonials) => {
      set({ testimonials });
      get().saveToBackend();
    },

    updateProducts: (products) => {
      set({ products });
      get().saveToBackend();
    },

    updatePricing: (pricing) => {
      set({ pricing });
      get().saveToBackend();
    },

    updateGallery: (gallery) => {
      set({ gallery });
      get().saveToBackend();
    },

    updatePresenceMap: (data) => {
      set((state) => ({ presenceMap: { ...state.presenceMap, ...data } }));
      get().saveToBackend();
    },

    updateCtaBanner: (data) => {
      set((state) => ({ ctaBanner: { ...state.ctaBanner, ...data } }));
      get().saveToBackend();
    },

    updateFaq: (faq) => {
      set({ faq });
      get().saveToBackend();
    },

    updateContact: (data) => {
      set((state) => ({ contact: { ...state.contact, ...data } }));
      get().saveToBackend();
    },

    updateSocial: (data) => {
      set((state) => ({ social: { ...state.social, ...data } }));
      get().saveToBackend();
    },

    updateFooter: (data) => {
      set((state) => ({ footer: { ...state.footer, ...data } }));
      get().saveToBackend();
    },

    updateSeo: (data) => {
      set((state) => ({ seo: { ...state.seo, ...data } }));
      get().saveToBackend();
    },

    updateBlogs: (blogs) => {
      set({ blogs });
      get().saveToBackend();
    },

    updateAdLandingPages: (data) => {
      set((state) => ({ adLandingPages: { ...state.adLandingPages, ...data } }));
      get().saveToBackend();
    },

    updateWhyChooseUsHeader: (data) => {
      set((state) => ({ whyChooseUsHeader: { ...state.whyChooseUsHeader, ...data } }));
      get().saveToBackend();
    },

    updatePortfolioHighlightsHeader: (data) => {
      set((state) => ({ portfolioHighlightsHeader: { ...state.portfolioHighlightsHeader, ...data } }));
      get().saveToBackend();
    },

    updateGalleryHeader: (data) => {
      set((state) => ({ galleryHeader: { ...state.galleryHeader, ...data } }));
      get().saveToBackend();
    },

    updateTestimonialsHeader: (data) => {
      set((state) => ({ testimonialsHeader: { ...state.testimonialsHeader, ...data } }));
      get().saveToBackend();
    },

    updateProductsHeader: (data) => {
      set((state) => ({ productsHeader: { ...state.productsHeader, ...data } }));
      get().saveToBackend();
    },

    updateCatalogue: (data) => {
      set((state) => ({ catalogue: { ...state.catalogue, ...data } }));
      get().saveToBackend();
    },

    updateProductCategoriesShowcase: (data) => {
      set((state) => ({ productCategoriesShowcase: { ...state.productCategoriesShowcase, ...data } }));
      get().saveToBackend();
    },

    resetToDefaults: () => {
      set(LANDING_PAGE_DEFAULTS);
      get().saveToBackend();
    },
  })
);
