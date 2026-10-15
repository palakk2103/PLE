import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiSave, FiArrowLeft, FiPlus, FiTrash2 } from 'react-icons/fi';
import { useAboutPageStore } from '../../store/aboutPageStore';
import toast from 'react-hot-toast';

const OurEdgeEditor = () => {
  const navigate = useNavigate();
  const { ourEdge, updateOurEdge, fetchInitialData } = useAboutPageStore();
  
  const [formData, setFormData] = useState({ ...ourEdge });

  useEffect(() => {
    fetchInitialData().then(() => {
      setFormData(useAboutPageStore.getState().ourEdge);
    });
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleStepChange = (index, field, value) => {
    const newSteps = [...(formData.steps || [])];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setFormData((prev) => ({ ...prev, steps: newSteps }));
  };

  const addStep = () => {
    const nextStepNum = `0${(formData.steps?.length || 0) + 1}`.slice(-2);
    setFormData((prev) => ({ ...prev, steps: [...(prev.steps || []), { step: nextStepNum, title: '', description: '' }] }));
  };

  const removeStep = (index) => {
    const newSteps = [...(formData.steps || [])];
    newSteps.splice(index, 1);
    // Re-index steps
    newSteps.forEach((s, idx) => {
      s.step = `0${idx + 1}`.slice(-2);
    });
    setFormData((prev) => ({ ...prev, steps: newSteps }));
  };

  const handleSave = () => {
    updateOurEdge(formData);
    toast.success('Our Edge section updated successfully!');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-5xl mx-auto p-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/ple-ops-desk/about-page')} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition">
            <FiArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Edit Our Edge</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage the "Why Shoppers Trust PLE" steps section.</p>
          </div>
        </div>
        <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-[#C07A3D] text-white rounded-lg hover:bg-[#a6642d] transition text-sm font-semibold shadow-sm">
          <FiSave /> Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-2">Section Header</h2>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Title</label>
              <textarea name="title" value={formData.title || ''} onChange={handleChange} rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
              <textarea name="description" value={formData.description || ''} onChange={handleChange} rows={4} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]" />
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Steps</h2>
              <button onClick={addStep} className="flex items-center gap-1 px-3 py-1.5 bg-[#C07A3D] text-white rounded-lg text-xs font-semibold hover:bg-[#a6642d]">
                <FiPlus /> Add Step
              </button>
            </div>

            <div className="space-y-4">
              {(formData.steps || []).map((s, idx) => (
                <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200 relative flex gap-4 items-start">
                  <button onClick={() => removeStep(idx)} className="absolute top-2 right-2 p-1.5 text-red-500 hover:text-red-700 bg-red-50 rounded-md">
                    <FiTrash2 size={16} />
                  </button>
                  
                  <div className="text-2xl font-black text-gray-200 mt-1">
                    {s.step}
                  </div>
                  
                  <div className="flex-1 pr-8 space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Title</label>
                      <input type="text" value={s.title || ''} onChange={(e) => handleStepChange(idx, 'title', e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#C07A3D]" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Description</label>
                      <textarea value={s.description || ''} onChange={(e) => handleStepChange(idx, 'description', e.target.value)} rows={2} className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#C07A3D]" />
                    </div>
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

export default OurEdgeEditor;
