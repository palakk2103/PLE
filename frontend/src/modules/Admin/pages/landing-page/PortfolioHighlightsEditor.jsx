import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiSave, FiArrowLeft, FiPlus, FiTrash, FiEdit, FiUpload } from 'react-icons/fi';
import { useLandingPageStore } from '../../store/landingPageStore';
import toast from 'react-hot-toast';
import { uploadAdminImage } from '../../services/adminService';

const PortfolioHighlightsEditor = () => {
  const navigate = useNavigate();
  const { portfolioHighlights, updatePortfolioHighlights, portfolioHighlightsHeader, updatePortfolioHighlightsHeader } = useLandingPageStore();

  const [headerData, setHeaderData] = useState({
    badge: portfolioHighlightsHeader?.badge || 'Capability Showcase',
    title: portfolioHighlightsHeader?.title || 'Enterprise Procurement Highlights',
    subtitle: portfolioHighlightsHeader?.subtitle || 'Strategic purchasing support options designed to maximize value, reduce IT administrative costs, and secure business operations.'
  });

  const handleHeaderChange = (e) => {
    const { name, value } = e.target;
    setHeaderData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveHeader = () => {
    updatePortfolioHighlightsHeader(headerData);
    toast.success('Section header copy updated!');
  };

  const [editingIndex, setEditingIndex] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    title: '',
    subtitle: '',
    description: '',
    icon: 'Shield',
    image: '',
    buttonText: 'Learn More',
    buttonLink: '',
    status: true,
    order: 0,
  });

  const handleStartEdit = (index) => {
    setEditingIndex(index);
    setFormData(portfolioHighlights[index] || {
      id: `hl-${Date.now()}`,
      title: '',
      subtitle: '',
      description: '',
      icon: 'Shield',
      image: '',
      buttonText: 'Learn More',
      buttonLink: '',
      status: true,
      order: portfolioHighlights.length,
    });
  };

  const handleStartAdd = () => {
    setEditingIndex(-1);
    setFormData({
      id: `hl-${Date.now()}`,
      title: '',
      subtitle: '',
      description: '',
      icon: 'Shield',
      image: '',
      buttonText: 'Learn More',
      buttonLink: '',
      status: true,
      order: portfolioHighlights.length,
    });
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
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
        setFormData(prev => ({ ...prev, image: url }));
        toast.success('Image uploaded successfully');
      } else {
        toast.error('Image upload failed');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveItem = () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error('Title and Description are required!');
      return;
    }

    let updatedList = [...(portfolioHighlights || [])];
    if (editingIndex === -1) {
      updatedList.push(formData);
    } else {
      updatedList[editingIndex] = formData;
    }

    // Sort by order
    updatedList.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

    updatePortfolioHighlights(updatedList);
    setEditingIndex(null);
    toast.success('Portfolio highlights updated successfully!');
  };

  const handleDeleteItem = (index) => {
    if (window.confirm('Delete this highlight card?')) {
      const updatedList = portfolioHighlights.filter((_, idx) => idx !== index);
      updatePortfolioHighlights(updatedList);
      toast.success('Highlight card deleted!');
    }
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
            onClick={() => navigate('/admin/landing-page')}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition"
          >
            <FiArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Portfolio Highlights</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage business capability cards appearing inside the Portfolio section.</p>
          </div>
        </div>

        {editingIndex === null && (
          <button
            onClick={handleStartAdd}
            className="flex items-center gap-2 px-4 py-2 bg-[#C07A3D] text-white rounded-lg hover:bg-[#a6642d] transition text-sm font-semibold shadow-sm"
          >
            <FiPlus />
            Add Capability Card
          </button>
        )}
      </div>

      {/* Section Header Controls */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-4">
        <h2 className="text-xs font-bold text-[#C07A3D] uppercase tracking-wider">
          Section Title & Header Settings
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Badge Text</label>
            <input
              type="text"
              name="badge"
              value={headerData.badge}
              onChange={handleHeaderChange}
              className="w-full text-sm border border-gray-200 rounded-lg p-2.5 outline-none focus:border-[#C07A3D]"
              placeholder="e.g. Capability Showcase"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Heading Title</label>
            <input
              type="text"
              name="title"
              value={headerData.title}
              onChange={handleHeaderChange}
              className="w-full text-sm border border-gray-200 rounded-lg p-2.5 outline-none focus:border-[#C07A3D]"
              placeholder="e.g. Enterprise Procurement Highlights"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Subtitle / Description</label>
          <textarea
            rows="2"
            name="subtitle"
            value={headerData.subtitle}
            onChange={handleHeaderChange}
            className="w-full text-sm border border-gray-200 rounded-lg p-2.5 outline-none focus:border-[#C07A3D]"
            placeholder="Description of the procurement capability showcase"
          />
        </div>
        <div className="flex justify-end pt-1">
          <button
            onClick={handleSaveHeader}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition text-xs font-bold uppercase tracking-wider"
          >
            <FiSave size={14} /> Save Header Settings
          </button>
        </div>
      </div>

      {editingIndex !== null ? (
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm">
          <h2 className="text-sm font-bold text-[#C07A3D] mb-4 uppercase">
            {editingIndex === -1 ? 'Add Capability Card' : 'Edit Capability Card'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Title</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Subtitle</label>
              <input
                type="text"
                name="subtitle"
                value={formData.subtitle}
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
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Lucide Icon Name</label>
              <input
                type="text"
                name="icon"
                value={formData.icon}
                onChange={handleFormChange}
                placeholder="Shield, Users, TrendingUp, Award, Settings"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Display Order</label>
              <input
                type="number"
                name="order"
                value={formData.order}
                onChange={handleFormChange}
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
                placeholder="e.g. #cpo or /get-quote"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Image URL</label>
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
                  {isUploading ? 'Uploading...' : 'Upload'}
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={isUploading} />
                </label>
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
              <label htmlFor="status" className="text-sm font-semibold text-gray-700">Active / Published</label>
            </div>
          </div>

          <div className="flex gap-2 justify-end mt-4">
            <button
              onClick={() => setEditingIndex(null)}
              className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-50 text-gray-600 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveItem}
              className="px-4 py-2 bg-[#C07A3D] text-white rounded-lg text-xs font-semibold hover:bg-[#a6642d] transition"
            >
              Save Card
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(portfolioHighlights || []).map((item, idx) => (
            <div key={item.id || idx} className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col justify-between hover:shadow-md transition">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${item.status ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                    {item.status ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">Order: {item.order}</span>
                </div>
                <h3 className="text-sm font-bold text-gray-800">{item.title}</h3>
                <h4 className="text-xs text-[#C07A3D] font-semibold mt-0.5">{item.subtitle}</h4>
                <p className="text-xs text-gray-400 mt-2 line-clamp-2 leading-relaxed">{item.description}</p>
                {item.image && (
                  <img src={item.image} alt={item.title} className="w-full h-32 object-cover rounded-xl mt-3 border border-gray-100" />
                )}
              </div>
              <div className="flex gap-2 mt-4 pt-3 border-t border-gray-50">
                <button
                  onClick={() => handleStartEdit(idx)}
                  className="flex-1 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition"
                >
                  <FiEdit size={12} /> Edit
                </button>
                <button
                  onClick={() => handleDeleteItem(idx)}
                  className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg transition"
                >
                  <FiTrash size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default PortfolioHighlightsEditor;
