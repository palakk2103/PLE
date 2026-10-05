import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiSave, FiArrowLeft, FiPlus, FiTrash, FiEdit, FiInfo } from 'react-icons/fi';
import { useLandingPageStore } from '../../store/landingPageStore';
import toast from 'react-hot-toast';

const FeaturesEditor = () => {
  const navigate = useNavigate();
  const { whyChooseUs, updateWhyChooseUs, whyChooseUsHeader, updateWhyChooseUsHeader } = useLandingPageStore();

  const [headerData, setHeaderData] = useState({
    tagline: whyChooseUsHeader?.tagline || 'Why Shop With Us',
    heading: whyChooseUsHeader?.heading || 'A Smarter Way to',
    highlightText: whyChooseUsHeader?.highlightText || 'Shop Online'
  });

  const [editingIndex, setEditingIndex] = useState(null);
  const [formData, setFormData] = useState({ title: '', description: '', icon: 'DollarSign' });

  const handleHeaderChange = (e) => {
    const { name, value } = e.target;
    setHeaderData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveHeader = () => {
    updateWhyChooseUsHeader(headerData);
    toast.success('Section header copy updated!');
  };

  const handleStartEdit = (index) => {
    setEditingIndex(index);
    setFormData(whyChooseUs[index]);
  };

  const handleStartAdd = () => {
    setEditingIndex(-1);
    setFormData({ title: '', description: '', icon: 'DollarSign' });
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveItem = () => {
    if (!formData.title.trim()) {
      toast.error('Title is required!');
      return;
    }

    let updatedList = [...whyChooseUs];
    if (editingIndex === -1) {
      updatedList.push(formData);
    } else {
      updatedList[editingIndex] = formData;
    }

    updateWhyChooseUs(updatedList);
    setEditingIndex(null);
    toast.success('Features list updated successfully!');
  };

  const handleDeleteItem = (index) => {
    if (window.confirm('Delete this feature card?')) {
      const updatedList = whyChooseUs.filter((_, idx) => idx !== index);
      updateWhyChooseUs(updatedList);
      toast.success('Feature card deleted!');
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
            <h1 className="text-xl font-bold text-gray-900">Why Choose Us (Features)</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage key company selling points, descriptions, and icons.</p>
          </div>
        </div>

        {editingIndex === null && (
          <button
            onClick={handleStartAdd}
            className="flex items-center gap-2 px-4 py-2 bg-[#C07A3D] text-white rounded-lg hover:bg-[#a6642d] transition text-sm font-semibold shadow-sm"
          >
            <FiPlus />
            Add Feature Card
          </button>
        )}
      </div>

      {/* Section Header Controls */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-4">
        <h2 className="text-xs font-bold text-[#C07A3D] uppercase tracking-wider">
          Section Title & Header Settings
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Badge / Tagline</label>
            <input
              type="text"
              name="tagline"
              value={headerData.tagline}
              onChange={handleHeaderChange}
              className="w-full text-sm border border-gray-200 rounded-lg p-2.5 outline-none focus:border-[#C07A3D]"
              placeholder="e.g. Why Shop With Us"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Heading Prefix</label>
            <input
              type="text"
              name="heading"
              value={headerData.heading}
              onChange={handleHeaderChange}
              className="w-full text-sm border border-gray-200 rounded-lg p-2.5 outline-none focus:border-[#C07A3D]"
              placeholder="e.g. A Smarter Way to"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Highlighted Heading Text</label>
            <input
              type="text"
              name="highlightText"
              value={headerData.highlightText}
              onChange={handleHeaderChange}
              className="w-full text-sm border border-gray-200 rounded-lg p-2.5 outline-none focus:border-[#C07A3D]"
              placeholder="e.g. Shop Online"
            />
          </div>
        </div>
        <div className="flex justify-end pt-2">
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
            {editingIndex === -1 ? 'Add Feature Card' : 'Edit Feature Card'}
          </h2>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Feature Title</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleFormChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>
          <div>
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
              placeholder="DollarSign, Award, Clock, Users, ShieldCheck"
              value={formData.icon}
              onChange={handleFormChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
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
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
          {whyChooseUs.map((item, idx) => (
            <div key={idx} className="p-5 flex items-center justify-between hover:bg-gray-50/50 transition">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-50 rounded-xl text-[#C07A3D]">
                  <FiInfo size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800">{item.title}</h3>
                  <p className="text-xs text-gray-400 mt-1 max-w-lg leading-relaxed">{item.description}</p>
                  <span className="inline-block text-[10px] bg-gray-100 px-2 py-0.5 rounded font-mono mt-2">Icon: {item.icon}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleStartEdit(idx)}
                  className="p-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  <FiEdit size={16} />
                </button>
                <button
                  onClick={() => handleDeleteItem(idx)}
                  className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition"
                >
                  <FiTrash size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default FeaturesEditor;
