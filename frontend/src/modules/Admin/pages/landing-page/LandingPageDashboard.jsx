import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  FiEye, 
  FiEyeOff, 
  FiArrowUp, 
  FiArrowDown, 
  FiEdit, 
  FiSettings, 
  FiRotateCcw 
} from 'react-icons/fi';
import { useLandingPageStore } from '../../store/landingPageStore';

const LandingPageDashboard = () => {
  const navigate = useNavigate();
  const { sections, updateSectionVisibility, updateSectionsOrder, resetToDefaults, fetchInitialData } = useLandingPageStore();

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const handleToggleVisibility = (id, currentVisible) => {
    updateSectionVisibility(id, !currentVisible);
  };

  const handleMove = (index, direction) => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sections.length - 1) return;

    const newSections = [...sections];
    const swapWithIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap
    const temp = newSections[index];
    newSections[index] = newSections[swapWithIndex];
    newSections[swapWithIndex] = temp;

    // Update order key
    const orderedSections = newSections.map((sec, idx) => ({
      ...sec,
      order: idx
    }));

    updateSectionsOrder(orderedSections);
  };

  const getSectionEditorPath = (id) => {
    const paths = {
      hero: '/ple-ops-desk/landing-page/hero',
      trustedBrands: '/ple-ops-desk/brands',
      productCategories: '/ple-ops-desk/landing-page/product-categories',
      catalogue: '/ple-ops-desk/landing-page/catalogue',
      portfolioHighlights: '/ple-ops-desk/landing-page/portfolio-highlights',
      cpoSection: '/ple-ops-desk/landing-page/cpo',
      gpoSection: '/ple-ops-desk/landing-page/gpo',
      smartDeals: '/ple-ops-desk/landing-page/smart-deals',
      loyaltyRewards: '/ple-ops-desk/landing-page/loyalty-rewards',
      zeroMaintenance: '/ple-ops-desk/landing-page/zero-maintenance',
      services: '/ple-ops-desk/landing-page/services',
      whyChooseUs: '/ple-ops-desk/landing-page/features',
      comparison: '/ple-ops-desk/landing-page/comparison',
      stats: '/ple-ops-desk/landing-page/stats',
      testimonials: '/ple-ops-desk/landing-page/testimonials',
      portfolio: '/ple-ops-desk/landing-page/products',
      pricing: '/ple-ops-desk/landing-page/pricing',
      gallery: '/ple-ops-desk/landing-page/gallery',
      presenceMap: '/ple-ops-desk/landing-page/contact', // map is edited alongside contact info
      ctaBanner: '/ple-ops-desk/landing-page/footer',
    };
    return paths[id] || `/ple-ops-desk/landing-page/${id}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-5xl mx-auto p-4"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="w-2.5 h-6 bg-[#C07A3D] rounded-full inline-block"></span>
            Landing Page Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Toggle visibility, rearrange section ordering, and manage content.
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (window.confirm('Reset all landing page sections and content to original defaults?')) {
                resetToDefaults();
              }
            }}
            className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition text-sm font-medium"
          >
            <FiRotateCcw />
            Reset Defaults
          </button>
        </div>
      </div>

      {/* Sections List */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-gray-50/70 px-6 py-3 border-b border-gray-100 flex items-center justify-between text-xs font-semibold text-gray-500 uppercase">
          <span>Section Name</span>
          <div className="flex items-center gap-8 mr-4">
            <span>Visibility</span>
            <span>Actions</span>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {sections.map((section, index) => (
            <div 
              key={section.id} 
              className={`px-6 py-4 flex items-center justify-between transition hover:bg-gray-50/50 ${
                !section.visible ? 'opacity-65' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-400 w-5">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-gray-800">{section.name}</h3>
                  <span className="text-[11px] text-gray-400 font-mono">ID: {section.id}</span>
                </div>
              </div>

              <div className="flex items-center gap-6">
                {/* Visibility Toggle */}
                <button
                  onClick={() => handleToggleVisibility(section.id, section.visible)}
                  className={`p-2 rounded-lg transition ${
                    section.visible 
                      ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100/70' 
                      : 'text-gray-400 bg-gray-50 hover:bg-gray-100'
                  }`}
                  title={section.visible ? 'Visible on Landing Page' : 'Hidden'}
                >
                  {section.visible ? <FiEye size={18} /> : <FiEyeOff size={18} />}
                </button>

                {/* Ordering & Editing */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleMove(index, 'up')}
                    disabled={index === 0}
                    className="p-1.5 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Move Up"
                  >
                    <FiArrowUp size={16} />
                  </button>
                  <button
                    onClick={() => handleMove(index, 'down')}
                    disabled={index === sections.length - 1}
                    className="p-1.5 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Move Down"
                  >
                    <FiArrowDown size={16} />
                  </button>
                  <button
                    onClick={() => navigate(getSectionEditorPath(section.id))}
                    className="p-2 text-[#C07A3D] bg-orange-50 hover:bg-orange-100/70 rounded-lg ml-2"
                    title="Edit Section Content"
                  >
                    <FiEdit size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default LandingPageDashboard;
