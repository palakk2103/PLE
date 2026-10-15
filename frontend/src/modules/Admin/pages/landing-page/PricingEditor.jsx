import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiSave, FiArrowLeft, FiPlus, FiTrash, FiEdit, FiDollarSign } from 'react-icons/fi';
import { useLandingPageStore } from '../../store/landingPageStore';
import toast from 'react-hot-toast';

const PricingEditor = () => {
  const navigate = useNavigate();
  const { pricing, updatePricing } = useLandingPageStore();

  const [editingIndex, setEditingIndex] = useState(null);
  const [formData, setFormData] = useState({
    id: '',
    title: '',
    description: '',
    price: '',
    period: '/one-time',
    features: [],
    ctaText: 'Get Started',
    highlight: false
  });

  const [featureInput, setFeatureInput] = useState('');

  const handleStartEdit = (index) => {
    setEditingIndex(index);
    setFormData(pricing[index]);
  };

  const handleStartAdd = () => {
    setEditingIndex(-1);
    setFormData({
      id: `price-${Date.now()}`,
      title: '',
      description: '',
      price: '',
      period: '/one-time',
      features: [],
      ctaText: 'Get Started',
      highlight: false
    });
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleAddFeature = () => {
    if (featureInput.trim() && !formData.features.includes(featureInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        features: [...prev.features, featureInput.trim()]
      }));
      setFeatureInput('');
    }
  };

  const handleRemoveFeature = (fText) => {
    setFormData((prev) => ({
      ...prev,
      features: prev.features.filter((f) => f !== fText)
    }));
  };

  const handleSaveItem = () => {
    if (!formData.title.trim() || !formData.price.trim()) {
      toast.error('Plan Title and Price are required!');
      return;
    }

    let updatedList = [...pricing];
    if (editingIndex === -1) {
      updatedList.push(formData);
    } else {
      updatedList[editingIndex] = formData;
    }

    updatePricing(updatedList);
    setEditingIndex(null);
    toast.success('Pricing plans list updated successfully!');
  };

  const handleDeleteItem = (index) => {
    if (window.confirm('Delete this pricing plan card?')) {
      const updatedList = pricing.filter((_, idx) => idx !== index);
      updatePricing(updatedList);
      toast.success('Pricing plan card deleted!');
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
            onClick={() => navigate('/ple-ops-desk/landing-page')}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition"
          >
            <FiArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Deals & Pricing plans</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage pricing plans, cards, highlights, and bullet points features.</p>
          </div>
        </div>

        {editingIndex === null && (
          <button
            onClick={handleStartAdd}
            className="flex items-center gap-2 px-4 py-2 bg-[#C07A3D] text-white rounded-lg hover:bg-[#a6642d] transition text-sm font-semibold shadow-sm"
          >
            <FiPlus />
            Add New Plan
          </button>
        )}
      </div>

      {editingIndex !== null ? (
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm">
          <h2 className="text-sm font-bold text-[#C07A3D] mb-4 uppercase">
            {editingIndex === -1 ? 'Add Plan Card' : 'Edit Plan Card'}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Plan Title</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Price tag</label>
              <input
                type="text"
                name="price"
                placeholder="e.g. ₹24,999"
                value={formData.price}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Period</label>
              <input
                type="text"
                name="period"
                placeholder="e.g. /one-time"
                value={formData.period}
                onChange={handleFormChange}
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
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description / Subtitle</label>
              <input
                type="text"
                name="description"
                value={formData.description}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
              />
            </div>
            <div className="md:col-span-2 flex items-center gap-2 py-2">
              <input
                type="checkbox"
                name="highlight"
                id="highlight"
                checked={formData.highlight}
                onChange={handleFormChange}
                className="w-4 h-4 text-[#C07A3D] focus:ring-[#C07A3D] border-gray-300 rounded"
              />
              <label htmlFor="highlight" className="text-sm font-semibold text-gray-700 select-none">
                Highlight this card (Recommended / Best Deal styling)
              </label>
            </div>

            <div className="md:col-span-2 border-t border-gray-50 pt-4">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Include Features / Deliverables</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={featureInput}
                  onChange={(e) => setFeatureInput(e.target.value)}
                  placeholder="e.g. 10 Business Days Delivery"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
                />
                <button
                  onClick={handleAddFeature}
                  className="px-3 py-2 bg-[#C07A3D] text-white rounded-lg hover:bg-[#a6642d]"
                >
                  <FiPlus />
                </button>
              </div>
              <div className="space-y-1 mt-2">
                {formData.features.map((feat, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                    <span className="text-xs font-medium text-gray-700">{feat}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFeature(feat)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <FiTrash size={14} />
                    </button>
                  </div>
                ))}
              </div>
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
              Save plan
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {pricing.map((item, idx) => (
            <div 
              key={item.id || idx} 
              className={`bg-white rounded-2xl border p-5 flex flex-col justify-between hover:shadow-md transition relative ${
                item.highlight ? 'border-[#C07A3D] ring-2 ring-[#C07A3D]/10' : 'border-gray-100'
              }`}
            >
              {item.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#C07A3D] text-white text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm">
                  HIGHLIGHTED
                </span>
              )}
              
              <div>
                <h3 className="text-sm font-bold text-gray-800">{item.title}</h3>
                <p className="text-xs text-gray-400 mt-1">{item.description}</p>
                <div className="mt-4 flex items-baseline">
                  <span className="text-xl font-black text-gray-900">{item.price}</span>
                  <span className="text-gray-400 text-xs font-semibold ml-1">{item.period}</span>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-50 space-y-1.5">
                  {item.features.slice(0, 3).map((f, i) => (
                    <div key={i} className="text-xs text-gray-500 flex items-center gap-1.5">
                      <span className="w-1 h-1 bg-[#C07A3D] rounded-full"></span>
                      <span className="truncate">{f}</span>
                    </div>
                  ))}
                  {item.features.length > 3 && (
                    <span className="text-[10px] text-gray-400 font-semibold italic mt-1 block">
                      + {item.features.length - 3} more features
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => handleStartEdit(idx)}
                  className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition"
                >
                  <FiEdit size={12} />
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteItem(idx)}
                  className="py-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg flex items-center justify-center transition"
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

export default PricingEditor;
