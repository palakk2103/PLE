import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiSave, FiArrowLeft, FiUpload } from 'react-icons/fi';
import { useLandingPageStore } from '../../store/landingPageStore';
import toast from 'react-hot-toast';
import { uploadAdminImage } from '../../services/adminService';

const SmartDealsEditor = () => {
  const navigate = useNavigate();
  const { smartDeals, updateSmartDeals } = useLandingPageStore();

  const [formData, setFormData] = useState({
    title: smartDeals?.title || '',
    description: smartDeals?.description || '',
    banner: smartDeals?.banner || '',
    image: smartDeals?.image || '',
    offerText: smartDeals?.offerText || '',
    buttonText: smartDeals?.buttonText || '',
    buttonLink: smartDeals?.buttonLink || '',
    priority: smartDeals?.priority !== undefined ? smartDeals?.priority : 1,
    status: smartDeals?.status !== undefined ? smartDeals?.status : true,
    expiry: smartDeals?.expiry || '',
  });

  const [uploadTarget, setUploadTarget] = useState(''); // 'banner' or 'image'
  const [isUploading, setIsUploading] = useState(false);

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleImageUpload = async (e, target) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const response = await uploadAdminImage(file, 'landing-page');
      const url = response?.data?.url;
      if (url) {
        setFormData(prev => ({ ...prev, [target]: url }));
        toast.success(`${target} uploaded successfully`);
      } else {
        toast.error('Upload failed');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error('Title and Description are required!');
      return;
    }
    updateSmartDeals(formData);
    toast.success('Smart Deals section updated successfully!');
    navigate('/ple-ops-desk/landing-page');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 max-w-3xl mx-auto p-4"
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
            <h1 className="text-xl font-bold text-gray-900">Smart Deals & Clearance Settings</h1>
            <p className="text-xs text-gray-500 mt-0.5">Configure Smart Deals title, description, banner, clearance offers, buttons, and expiry.</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#C07A3D] text-white rounded-lg hover:bg-[#a6642d] transition text-sm font-semibold shadow-sm"
        >
          <FiSave />
          Save Settings
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Section Title</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleFormChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Offer / Deal Text Highlight</label>
            <input
              type="text"
              name="offerText"
              value={formData.offerText}
              onChange={handleFormChange}
              placeholder="e.g. Save 60% on Office Laptop Clearance lots"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleFormChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Button Text</label>
            <input
              type="text"
              name="buttonText"
              value={formData.buttonText}
              onChange={handleFormChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Button Link</label>
            <input
              type="text"
              name="buttonLink"
              value={formData.buttonLink}
              onChange={handleFormChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Priority Order</label>
            <input
              type="number"
              name="priority"
              value={formData.priority}
              onChange={handleFormChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Expiry Date (YYYY-MM-DD)</label>
            <input
              type="date"
              name="expiry"
              value={formData.expiry ? formData.expiry.split('T')[0] : ''}
              onChange={handleFormChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>

          <div className="md:col-span-2 border-t border-gray-50 pt-4">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Deals Promo Banner Image</label>
            <div className="flex gap-2">
              <input
                type="text"
                name="banner"
                value={formData.banner}
                onChange={handleFormChange}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
              />
              <label className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 cursor-pointer text-xs font-semibold flex items-center gap-1">
                <FiUpload />
                Upload Banner
                <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'banner')} className="hidden" />
              </label>
            </div>
            {formData.banner && (
              <img src={formData.banner} alt="Promo Banner" className="mt-3 max-h-24 w-full object-cover rounded-lg border border-gray-100" />
            )}
          </div>

          <div className="md:col-span-2 border-t border-gray-50 pt-4">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Standard Visual Image</label>
            <div className="flex gap-2">
              <input
                type="text"
                name="image"
                value={formData.image}
                onChange={handleFormChange}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
              />
              <label className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 cursor-pointer text-xs font-semibold flex items-center gap-1">
                <FiUpload />
                Upload Image
                <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'image')} className="hidden" />
              </label>
            </div>
            {formData.image && (
              <img src={formData.image} alt="Standard Visual" className="mt-3 max-h-40 rounded-lg border border-gray-100 object-cover" />
            )}
          </div>

          <div className="flex items-center gap-2 py-2">
            <input
              type="checkbox"
              name="status"
              id="status"
              checked={formData.status}
              onChange={handleFormChange}
              className="w-4 h-4 text-[#C07A3D] focus:ring-[#C07A3D] border-gray-300 rounded"
            />
            <label htmlFor="status" className="text-sm font-semibold text-gray-700 select-none">Active / Published</label>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default SmartDealsEditor;
