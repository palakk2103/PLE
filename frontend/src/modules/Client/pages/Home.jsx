import React from 'react';
import { motion } from 'framer-motion';
import Hero from '../components/home/Hero';
import CatalogueSection from '../components/home/Catalogue/CatalogueSection';
import ServicesPreview from '../components/home/ServicesPreview';
import WhyChooseUs from '../components/home/WhyChooseUs';
import ComparisonTable from '../components/home/ComparisonTable';
import StatsCounter from '../components/home/StatsCounter';
import Testimonials from '../components/home/Testimonials';
import PortfolioPreview from '../components/home/PortfolioPreview';
import PresenceMap from '../components/home/PresenceMap';
import CTABanner from '../components/home/CTABanner';
import Gallery from '../components/home/Gallery';
import TrustedBrands from '../components/home/TrustedBrands';
import ProductCategories from '../components/home/ProductCategories';
import PortfolioHighlights from '../components/home/PortfolioHighlights';
import CPOSection from '../components/home/CPOSection';
import GPOSection from '../components/home/GPOSection';
import SmartDeals from '../components/home/SmartDeals';
import LoyaltyRewards from '../components/home/LoyaltyRewards';
import ZeroMaintenance from '../components/home/ZeroMaintenance';
import { useCMS } from '../hooks/useCMS';
import SEO from '../../../shared/components/SEO/SEO';

export default function Home() {
  const { sections } = useCMS();

  const origin = window.location.origin;

  const homepageSchema = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "Peoples League of Electronics",
      "url": origin,
      "potentialAction": {
        "@type": "SearchAction",
        "target": `${origin}/search?q={search_term_string}`,
        "query-input": "required name=search_term_string"
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Peoples League of Electronics",
      "alternateName": "PLE",
      "url": origin,
      "logo": `${origin}/PLE-logo-light-transparent.png`
    }
  ];

  // Mapping from section IDs to components
  const componentMap = {
    hero: <Hero key="hero" />,
    catalogue: <CatalogueSection key="catalogue" />,
    trustedBrands: <TrustedBrands key="trustedBrands" />,
    productCategories: <ProductCategories key="productCategories" />,
    portfolioHighlights: <PortfolioHighlights key="portfolioHighlights" />,
    cpoSection: <CPOSection key="cpoSection" />,
    gpoSection: <GPOSection key="gpoSection" />,
    smartDeals: <SmartDeals key="smartDeals" />,
    loyaltyRewards: <LoyaltyRewards key="loyaltyRewards" />,
    zeroMaintenance: <ZeroMaintenance key="zeroMaintenance" />,
    services: null,
    whyChooseUs: <WhyChooseUs key="whyChooseUs" />,
    comparison: <ComparisonTable key="comparison" />,
    stats: <StatsCounter key="stats" />,
    testimonials: <Testimonials key="testimonials" />,
    portfolio: <PortfolioPreview key="portfolio" />,
    gallery: <Gallery key="gallery" />,
    presenceMap: <PresenceMap key="presenceMap" />,
    ctaBanner: <CTABanner key="ctaBanner" />,
  };

  // Sort and filter visible sections, ensuring pricing is removed
  const visibleSections = Array.isArray(sections)
    ? [...sections]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .filter((sec) => sec && sec.visible && sec.id !== 'pricing')
    : [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-app-bg text-app-text-muted min-h-screen relative"
    >
      <SEO
        title="Home"
        description="Welcome to Peoples League of Electronics (PLE) - Your premier multi-vendor electronics e-commerce platform for high-quality electronics, smart deals, and zero-maintenance products."
        schema={homepageSchema}
      />
      {visibleSections.map((sec) => componentMap[sec.id] || null)}
    </motion.div>
  );
}


