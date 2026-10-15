import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiSave, FiArrowLeft, FiPlus, FiTrash } from 'react-icons/fi';
import { useLandingPageStore } from '../../store/landingPageStore';
import toast from 'react-hot-toast';

const StatsEditor = () => {
  const navigate = useNavigate();
  const { stats, updateStats } = useLandingPageStore();

  const [items, setItems] = useState(stats || []);
  const [newStat, setNewStat] = useState({ value: '', label: '' });

  const handleStatChange = (index, field, val) => {
    const updated = [...items];
    updated[index][field] = val;
    setItems(updated);
  };

  const handleAddStat = () => {
    if (newStat.value.trim() && newStat.label.trim()) {
      setItems((prev) => [...prev, { ...newStat }]);
      setNewStat({ value: '', label: '' });
    } else {
      toast.error('Value and Label are required!');
    }
  };

  const handleRemoveStat = (index) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSave = () => {
    updateStats(items);
    toast.success('Stats Counter updated successfully!');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 max-w-2xl mx-auto p-4"
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
            <h1 className="text-xl font-bold text-gray-900">Stats Counter Editor</h1>
            <p className="text-xs text-gray-500 mt-0.5">Edit counts, metrics, and milestones displayed on the homepage.</p>
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
        <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-4">Milestones & Metrics</h2>

        <div className="space-y-4">
          {items.map((stat, idx) => (
            <div key={idx} className="flex gap-4 items-center bg-gray-50 p-4 rounded-xl border border-gray-100">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Value / Number</label>
                <input
                  type="text"
                  placeholder="e.g. 15,000+"
                  value={stat.value}
                  onChange={(e) => handleStatChange(idx, 'value', e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Metric Label</label>
                <input
                  type="text"
                  placeholder="e.g. Products Listed"
                  value={stat.label}
                  onChange={(e) => handleStatChange(idx, 'label', e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
                />
              </div>
              <button
                onClick={() => handleRemoveStat(idx)}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg self-end mb-0.5"
              >
                <FiTrash size={16} />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-6 border-t border-gray-100 pt-5 space-y-3">
          <h3 className="text-xs font-bold text-gray-500 uppercase">Add New Stat Counter</h3>
          <div className="flex gap-4 items-center bg-amber-50/40 p-4 rounded-xl border border-amber-100/50">
            <div className="flex-1">
              <input
                type="text"
                placeholder="e.g. 99%"
                value={newStat.value}
                onChange={(e) => setNewStat((p) => ({ ...p, value: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#C07A3D]"
              />
            </div>
            <div className="flex-1">
              <input
                type="text"
                placeholder="e.g. Customer Satisfaction"
                value={newStat.label}
                onChange={(e) => setNewStat((p) => ({ ...p, label: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#C07A3D]"
              />
            </div>
            <button
              onClick={handleAddStat}
              className="px-4 py-2 bg-[#C07A3D] text-white rounded-lg text-xs font-semibold hover:bg-[#a6642d] transition flex items-center gap-1.5"
            >
              <FiPlus />
              Add
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default StatsEditor;
