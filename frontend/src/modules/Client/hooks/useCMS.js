import { useState, useEffect } from 'react';
import api from '../services/api';
import { LANDING_PAGE_DEFAULTS } from '../../Admin/data/landingPageDefaults';

export const useCMS = () => {
  const [cmsState, setCmsState] = useState(LANDING_PAGE_DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCMS = async () => {
      try {
        const response = await api.get('/settings/landingPageCms');
        let parsed = response?.data?.data || response?.data;
        
        // Auto-heal legacy nested data from previous bug
        if (parsed && parsed.value && !parsed.hero) {
          parsed = parsed.value;
        }

        if (parsed) {
          setCmsState((prev) => {
            let mergedSections = [...prev.sections];
            if (parsed.sections && Array.isArray(parsed.sections)) {
              const existingIds = parsed.sections.map(s => s.id);
              const newSections = prev.sections.filter(s => !existingIds.includes(s.id));
              mergedSections = [...parsed.sections, ...newSections];
            }
            return {
              ...prev,
              ...parsed,
              sections: mergedSections,
              portfolioHighlights: parsed.portfolioHighlights || prev.portfolioHighlights,
              catalogue: parsed.catalogue ? { ...prev.catalogue, ...parsed.catalogue } : prev.catalogue,
              cpoSection: parsed.cpoSection ? { ...prev.cpoSection, ...parsed.cpoSection } : prev.cpoSection,
              gpoSection: parsed.gpoSection ? { ...prev.gpoSection, ...parsed.gpoSection } : prev.gpoSection,
              smartDeals: parsed.smartDeals ? { ...prev.smartDeals, ...parsed.smartDeals } : prev.smartDeals,
              loyaltyRewards: parsed.loyaltyRewards ? { ...prev.loyaltyRewards, ...parsed.loyaltyRewards } : prev.loyaltyRewards,
              zeroMaintenance: parsed.zeroMaintenance ? { ...prev.zeroMaintenance, ...parsed.zeroMaintenance } : prev.zeroMaintenance,
              trustedBrands: parsed.trustedBrands ? { ...prev.trustedBrands, ...parsed.trustedBrands } : prev.trustedBrands,
              productCategories: parsed.productCategories ? { ...prev.productCategories, ...parsed.productCategories } : prev.productCategories,
              productCategoriesShowcase: parsed.productCategoriesShowcase ? { ...prev.productCategoriesShowcase, ...parsed.productCategoriesShowcase } : prev.productCategoriesShowcase,
              portfolioHighlightsHeader: parsed.portfolioHighlightsHeader ? { ...prev.portfolioHighlightsHeader, ...parsed.portfolioHighlightsHeader } : prev.portfolioHighlightsHeader,
              whyChooseUsHeader: parsed.whyChooseUsHeader ? { ...prev.whyChooseUsHeader, ...parsed.whyChooseUsHeader } : prev.whyChooseUsHeader,
              galleryHeader: parsed.galleryHeader ? { ...prev.galleryHeader, ...parsed.galleryHeader } : prev.galleryHeader,
              testimonialsHeader: parsed.testimonialsHeader ? { ...prev.testimonialsHeader, ...parsed.testimonialsHeader } : prev.testimonialsHeader,
              productsHeader: parsed.productsHeader ? { ...prev.productsHeader, ...parsed.productsHeader } : prev.productsHeader,
              adLandingPages: parsed.adLandingPages ? { ...prev.adLandingPages, ...parsed.adLandingPages } : prev.adLandingPages,
              presenceMap: parsed.presenceMap ? {
                ...parsed.presenceMap,
                locations: (parsed.presenceMap.locations || []).map(loc => 
                  loc.name.toLowerCase() === 'karnataka' ? { ...loc, top: '70%', left: '29%' } : loc
                )
              } : prev.presenceMap,
              // Fallback deep objects to prevent runtime errors
              hero: { ...prev.hero, ...parsed.hero },
              comparison: { ...prev.comparison, ...parsed.comparison },
              ctaBanner: { ...prev.ctaBanner, ...parsed.ctaBanner },
              contact: { 
                ...prev.contact, 
                ...(parsed.contact || {}),
                phone: parsed.contact?.phone || prev.contact?.phone || '+91 9071149100',
                phoneDisplay: parsed.contact?.phoneDisplay || prev.contact?.phoneDisplay || '+91 9071149100',
                email: parsed.contact?.email || prev.contact?.email || 'support@plebusiness.com'
              },
              social: { 
                ...prev.social, 
                ...(parsed.social || {}),
                facebook: parsed.social?.facebook || prev.social?.facebook || 'https://www.facebook.com/share/1EaNrat2yr/',
                instagram: parsed.social?.instagram || prev.social?.instagram || 'https://www.instagram.com/peoplesleagueofelectronics?igsh=MWdtbTNzajdqMGV4cQ==',
                linkedin: parsed.social?.linkedin || prev.social?.linkedin || 'https://www.linkedin.com/company/ple-electronics',
                twitter: parsed.social?.twitter || prev.social?.twitter || 'https://x.com/PeoplesE9405',
              },
              footer: { ...prev.footer, ...parsed.footer },
              seo: { ...prev.seo, ...parsed.seo },
            };
          });
        }
      } catch (e) {
        console.warn('Failed to fetch CMS data from backend, using defaults:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchCMS();
  }, []);

  return { ...cmsState, loading };
};

