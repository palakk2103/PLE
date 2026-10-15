import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiSave, FiArrowLeft, FiPlus, FiTrash2 } from 'react-icons/fi';
import { useAboutPageStore } from '../../store/aboutPageStore';
import toast from 'react-hot-toast';

const WhatWeDoEditor = () => {
  const navigate = useNavigate();
  const { whatWeDo, updateWhatWeDo, fetchInitialData } = useAboutPageStore();
  
  const [formData, setFormData] = useState({ ...whatWeDo });

  useEffect(() => {
    fetchInitialData().then(() => {
      setFormData(useAboutPageStore.getState().whatWeDo);
    });
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleServiceChange = (index, field, value) => {
    const newServices = [...(formData.services || [])];
    newServices[index] = { ...newServices[index], [field]: value };
    setFormData((prev) => ({ ...prev, services: newServices }));
  };

  const addService = () => {
    setFormData((prev) => ({ ...prev, services: [...(prev.services || []), { title: '', description: '', icon: '' }] }));
  };

  const removeService = (index) => {
    const newServices = [...(formData.services || [])];
    newServices.splice(index, 1);
    setFormData((prev) => ({ ...prev, services: newServices }));
  };

  const handleSave = () => {
    updateWhatWeDo(formData);
    toast.success('What We Do section updated successfully!');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-5xl mx-auto p-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/ple-ops-desk/about-page')} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition">
            <FiArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Edit What We Do</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage main title, description, and the grid of services/features.</p>
          </div>
        </div>
        <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-[#C07A3D] text-white rounded-lg hover:bg-[#a6642d] transition text-sm font-semibold shadow-sm">
          <FiSave /> Save Changes
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm mb-6">
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-2">Section Header</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Title</label>
            <input type="text" name="title" value={formData.title || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
            <textarea name="description" value={formData.description || ''} onChange={handleChange} rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Services Grid</h2>
          <button onClick={addService} className="flex items-center gap-1 px-3 py-1.5 bg-[#C07A3D] text-white rounded-lg text-xs font-semibold hover:bg-[#a6642d]">
            <FiPlus /> Add Service
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(formData.services || []).map((s, idx) => (
            <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200 relative">
              <button onClick={() => removeService(idx)} className="absolute top-2 right-2 p-2 text-red-500 hover:text-red-700 bg-red-50 rounded-md">
                <FiTrash2 size={16} />
              </button>
              
              <div className="pr-10 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Title</label>
                    <input type="text" value={s.title || ''} onChange={(e) => handleServiceChange(idx, 'title', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#C07A3D]" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Icon Name (Lucide)</label>
                    <input type="text" value={s.icon || ''} onChange={(e) => handleServiceChange(idx, 'icon', e.target.value)} placeholder="e.g. Code, Share2" className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#C07A3D]" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Description</label>
                  <textarea value={s.description || ''} onChange={(e) => handleServiceChange(idx, 'description', e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#C07A3D]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default WhatWeDoEditor;
