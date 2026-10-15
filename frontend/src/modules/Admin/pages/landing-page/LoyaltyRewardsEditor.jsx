import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiSave, FiArrowLeft, FiPlus, FiTrash, FiUpload } from 'react-icons/fi';
import { useLandingPageStore } from '../../store/landingPageStore';
import toast from 'react-hot-toast';
import { uploadAdminImage } from '../../services/adminService';

const LoyaltyRewardsEditor = () => {
  const navigate = useNavigate();
  const { loyaltyRewards, updateLoyaltyRewards } = useLandingPageStore();

  const [formData, setFormData] = useState({
    title: loyaltyRewards?.title || '',
    description: loyaltyRewards?.description || '',
    illustration: loyaltyRewards?.illustration || '',
    benefits: loyaltyRewards?.benefits || [],
    ctaText: loyaltyRewards?.ctaText || '',
    ctaLink: loyaltyRewards?.ctaLink || '',
    status: loyaltyRewards?.status !== undefined ? loyaltyRewards?.status : true,
    displayOrder: loyaltyRewards?.displayOrder || 0,
  });

  const [benefitInput, setBenefitInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleAddBenefit = () => {
    if (benefitInput.trim() && !formData.benefits.includes(benefitInput.trim())) {
      setFormData(prev => ({
        ...prev,
        benefits: [...prev.benefits, benefitInput.trim()]
      }));
      setBenefitInput('');
    }
  };

  const handleRemoveBenefit = (benefit) => {
    setFormData(prev => ({
      ...prev,
      benefits: prev.benefits.filter(b => b !== benefit)
    }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const response = await uploadAdminImage(file, 'landing-page');
      const url = response?.data?.url;
      if (url) {
        setFormData(prev => ({ ...prev, illustration: url }));
        toast.success('Illustration uploaded successfully');
      } else {
        toast.error('Upload failed');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload illustration');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error('Title and Description are required!');
      return;
    }
    updateLoyaltyRewards(formData);
    toast.success('Loyalty Rewards section updated successfully!');
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
            <h1 className="text-xl font-bold text-gray-900">Loyalty Rewards Settings</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage Loyalty Program B2B titles, benefits list, illustration images, and buttons.</p>
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
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Display Order</label>
            <input
              type="number"
              name="displayOrder"
              value={formData.displayOrder}
              onChange={handleFormChange}
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
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CTA Button Text</label>
            <input
              type="text"
              name="ctaText"
              value={formData.ctaText}
              onChange={handleFormChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CTA Button Link</label>
            <input
              type="text"
              name="ctaLink"
              value={formData.ctaLink}
              onChange={handleFormChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Illustration / Image</label>
            <div className="flex gap-2">
              <input
                type="text"
                name="illustration"
                value={formData.illustration}
                onChange={handleFormChange}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
              />
              <label className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 cursor-pointer text-xs font-semibold flex items-center gap-1">
                <FiUpload />
                {isUploading ? 'Uploading...' : 'Upload'}
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={isUploading} />
              </label>
            </div>
            {formData.illustration && (
              <img src={formData.illustration} alt="Loyalty illustration" className="mt-3 max-h-40 rounded-lg border border-gray-100 object-cover" />
            )}
          </div>

          <div className="md:col-span-2 border-t border-gray-50 pt-4">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Loyalty Program Benefits</label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={benefitInput}
                onChange={(e) => setBenefitInput(e.target.value)}
                placeholder="e.g. Earn 1 point for every Rs. 100 spent"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
              />
              <button
                type="button"
                onClick={handleAddBenefit}
                className="px-4 bg-[#C07A3D] text-white rounded-lg hover:bg-[#a6642d]"
              >
                <FiPlus />
              </button>
            </div>
            <div className="space-y-1.5">
              {formData.benefits.map((benefit, idx) => (
                <div key={idx} className="flex items-center justify-between bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                  <span className="text-xs text-gray-700 font-medium">{benefit}</span>
                  <button type="button" onClick={() => handleRemoveBenefit(benefit)} className="text-red-500 hover:text-red-700">
                    <FiTrash size={14} />
                  </button>
                </div>
              ))}
            </div>
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

export default LoyaltyRewardsEditor;
