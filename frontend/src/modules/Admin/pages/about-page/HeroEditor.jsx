import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiSave, FiArrowLeft, FiUpload, FiLoader } from 'react-icons/fi';
import { useAboutPageStore } from '../../store/aboutPageStore';
import { uploadAdminMedia } from '../../services/adminService';
import toast from 'react-hot-toast';

const HeroEditor = () => {
  const navigate = useNavigate();
  const { hero, updateHero, fetchInitialData } = useAboutPageStore();
  
  const [formData, setFormData] = useState({ ...hero });
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  useEffect(() => {
    fetchInitialData().then(() => {
      setFormData(useAboutPageStore.getState().hero);
    });
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type?.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    setIsUploadingImage(true);
    try {
      const response = await uploadAdminMedia(file, 'about_images');
      const url = response?.data?.url;
      if (!url) throw new Error('No URL returned');
      setFormData((prev) => ({ ...prev, teamImg: url }));
      toast.success('Image uploaded successfully');
    } catch (error) {
      toast.error('Image upload failed');
    } finally {
      setIsUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleSave = () => {
    updateHero(formData);
    toast.success('Hero section updated successfully!');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-4xl mx-auto p-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/ple-ops-desk/about-page')} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition">
            <FiArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Edit Hero Section</h1>
            <p className="text-xs text-gray-500 mt-0.5">Customize the main about hero title, description, and stats.</p>
          </div>
        </div>
        <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-[#C07A3D] text-white rounded-lg hover:bg-[#a6642d] transition text-sm font-semibold shadow-sm">
          <FiSave /> Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-2">Main Content</h2>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Title</label>
            <input type="text" name="title" value={formData.title || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Subtitle</label>
            <input type="text" name="subtitle" value={formData.subtitle || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description Paragraph</label>
            <textarea name="description" value={formData.description || ''} onChange={handleChange} rows={4} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]" />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-2">Hero Stats</h2>
            
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 space-y-3">
              <h3 className="text-xs font-bold text-gray-700">Stat 1 (Left side)</h3>
              <div className="grid grid-cols-3 gap-2">
                <input type="text" name="secureStatValue" placeholder="Value (e.g. 99%)" value={formData.secureStatValue || ''} onChange={handleChange} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]" />
                <input type="text" name="secureStatLabel1" placeholder="Label 1 (Secure)" value={formData.secureStatLabel1 || ''} onChange={handleChange} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]" />
                <input type="text" name="secureStatLabel2" placeholder="Label 2 (Checkout)" value={formData.secureStatLabel2 || ''} onChange={handleChange} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]" />
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 space-y-3">
              <h3 className="text-xs font-bold text-gray-700">Stat 2 (Right side)</h3>
              <div className="grid grid-cols-3 gap-2">
                <input type="text" name="categoryStatValue" placeholder="Value (e.g. 25+)" value={formData.categoryStatValue || ''} onChange={handleChange} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]" />
                <input type="text" name="categoryStatLabel1" placeholder="Label 1 (Product)" value={formData.categoryStatLabel1 || ''} onChange={handleChange} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]" />
                <input type="text" name="categoryStatLabel2" placeholder="Label 2 (Categories)" value={formData.categoryStatLabel2 || ''} onChange={handleChange} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-2">Assets</h2>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Center Circular Image</label>
              <input type="text" name="teamImg" value={formData.teamImg || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D] mb-2" />
              <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer text-xs font-semibold">
                {isUploadingImage ? <FiLoader className="animate-spin" /> : <FiUpload />}
                {isUploadingImage ? 'Uploading...' : 'Upload Image'}
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={isUploadingImage} />
              </label>
              {formData.teamImg && (
                <div className="mt-2">
                  <img src={formData.teamImg} alt="Preview" className="h-20 w-20 object-cover rounded-full border-4 border-gray-200 shadow" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default HeroEditor;
