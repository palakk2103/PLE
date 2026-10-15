import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiSave, FiArrowLeft, FiSearch } from 'react-icons/fi';
import { useLandingPageStore } from '../../store/landingPageStore';
import toast from 'react-hot-toast';

const SEOSettingsEditor = () => {
  const navigate = useNavigate();
  const { seo, updateSeo } = useLandingPageStore();

  const [formData, setFormData] = useState({
    metaTitle: seo.metaTitle || '',
    metaDescription: seo.metaDescription || '',
    keywords: seo.keywords || '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    updateSeo(formData);
    
    // Dynamically apply title to the head if we are in testing
    document.title = formData.metaTitle;
    
    toast.success('SEO metadata settings saved successfully!');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 max-w-xl mx-auto p-4"
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
            <h1 className="text-xl font-bold text-gray-900">SEO Settings Editor</h1>
            <p className="text-xs text-gray-500 mt-0.5">Customize global search engine optimization tags, title, and keywords.</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-[#C07A3D] text-white rounded-lg hover:bg-[#a6642d] transition text-sm font-semibold shadow-sm"
        >
          <FiSave />
          Save Changes
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm">
        <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-2 flex items-center gap-2">
          <FiSearch className="text-[#C07A3D]" /> SEO Meta Tags
        </h2>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Page Title (Meta Title)</label>
          <input
            type="text"
            name="metaTitle"
            value={formData.metaTitle}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Meta Description</label>
          <textarea
            name="metaDescription"
            value={formData.metaDescription}
            onChange={handleChange}
            rows={4}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Keywords (Comma separated)</label>
          <input
            type="text"
            name="keywords"
            placeholder="e.g. technology, marketplace, retail, shipping"
            value={formData.keywords}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
          />
        </div>
      </div>
    </motion.div>
  );
};

export default SEOSettingsEditor;
