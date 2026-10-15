import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiSave, FiArrowLeft, FiPlus, FiTrash, FiLayout } from 'react-icons/fi';
import { useLandingPageStore } from '../../store/landingPageStore';
import toast from 'react-hot-toast';

const AdLandingPagesEditor = () => {
  const navigate = useNavigate();
  const { adLandingPages, updateAdLandingPages } = useLandingPageStore();

  const categories = [
    { key: 'website-development', label: 'Website Development (Ad Page)' },
    { key: 'app-development', label: 'App Development (Ad Page)' },
    { key: 'social-media', label: 'Social Media Management (Ad Page)' },
    { key: 'performance-marketing', label: 'Performance Marketing (Ad Page)' },
    { key: 'accounting', label: 'Accounting & Finance (Ad Page)' },
    { key: 'mis-reporting', label: 'MIS & Reporting (Ad Page)' },
  ];

  const [activeKey, setActiveKey] = useState('website-development');
  
  // Get active config or fallback
  const activeConfig = adLandingPages[activeKey] || {
    title: '',
    subtitle: '',
    primaryCta: 'Get Started',
    problem: '',
    solution: '',
    highlights: []
  };

  const handleFieldChange = (field, val) => {
    const updatedCategoryData = {
      ...activeConfig,
      [field]: val
    };
    
    updateAdLandingPages({
      [activeKey]: updatedCategoryData
    });
  };

  const handleHighlightChange = (idx, field, val) => {
    const updatedHighlights = [...(activeConfig.highlights || [])];
    updatedHighlights[idx] = {
      ...updatedHighlights[idx],
      [field]: val
    };
    handleFieldChange('highlights', updatedHighlights);
  };

  const handleAddHighlight = () => {
    const updatedHighlights = [...(activeConfig.highlights || [])];
    updatedHighlights.push({ title: 'New Highlight', desc: 'Detail about this feature.' });
    handleFieldChange('highlights', updatedHighlights);
  };

  const handleRemoveHighlight = (idx) => {
    const updatedHighlights = (activeConfig.highlights || []).filter((_, i) => i !== idx);
    handleFieldChange('highlights', updatedHighlights);
  };

  const handleSave = () => {
    toast.success('Ad landing page configurations saved!');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 max-w-4xl mx-auto p-4"
    >
      <div className="flex items-center justify-between border-b border-gray-100 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/ple-ops-desk/landing-page')}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition"
          >
            <FiArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Ad Landing Pages Editor</h1>
            <p className="text-xs text-gray-500 mt-0.5">Edit custom funnels and landing configurations for paid ad traffic.</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-[#C07A3D] text-white rounded-lg hover:bg-[#a6642d] transition text-sm font-semibold shadow-sm"
        >
          <FiSave />
          Save Settings
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Left selector */}
        <div className="md:col-span-1 bg-white rounded-xl border border-gray-100 p-4 space-y-1 shadow-sm h-fit">
          <span className="block text-[10px] font-bold text-gray-400 uppercase mb-2 px-2">SELECT AD CAMPAIGN</span>
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveKey(cat.key)}
              className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg transition ${
                activeKey === cat.key 
                  ? 'bg-amber-50 text-[#C07A3D]' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Right editor */}
        <div className="md:col-span-3 bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-2 flex items-center gap-2">
            <FiLayout className="text-[#C07A3D]" /> Editing: {categories.find((c) => c.key === activeKey)?.label}
          </h2>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Landing Heading (Title)</label>
            <input
              type="text"
              value={activeConfig.title}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sub-heading (Subtitle)</label>
            <textarea
              value={activeConfig.subtitle}
              onChange={(e) => handleFieldChange('subtitle', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Primary CTA Button</label>
              <input
                type="text"
                value={activeConfig.primaryCta}
                onChange={(e) => handleFieldChange('primaryCta', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Problem Statement</label>
            <input
              type="text"
              value={activeConfig.problem}
              onChange={(e) => handleFieldChange('problem', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Solution Statement</label>
            <input
              type="text"
              value={activeConfig.solution}
              onChange={(e) => handleFieldChange('solution', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>

          {/* Highlights */}
          <div className="border-t border-gray-50 pt-4">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-bold text-gray-500 uppercase">Key Value Highlights</label>
              <button
                onClick={handleAddHighlight}
                className="text-xs font-bold text-[#C07A3D] flex items-center gap-1 hover:underline"
              >
                <FiPlus /> Add Highlight
              </button>
            </div>

            <div className="space-y-3">
              {(activeConfig.highlights || []).map((hl, idx) => (
                <div key={idx} className="bg-gray-50 p-3 rounded-lg border border-gray-100 space-y-2 relative">
                  <button
                    onClick={() => handleRemoveHighlight(idx)}
                    className="absolute top-2 right-2 text-red-500 hover:text-red-700 p-1"
                  >
                    <FiTrash size={12} />
                  </button>
                  
                  <div className="grid grid-cols-3 gap-2 pr-6">
                    <input
                      type="text"
                      placeholder="Title (e.g. SEO Optimized)"
                      value={hl.title}
                      onChange={(e) => handleHighlightChange(idx, 'title', e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-gray-200 rounded text-xs focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Description (e.g. built to rank)"
                      value={hl.desc}
                      onChange={(e) => handleHighlightChange(idx, 'desc', e.target.value)}
                      className="col-span-2 w-full px-2 py-1 bg-white border border-gray-200 rounded text-xs focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AdLandingPagesEditor;
