import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiSave, FiArrowLeft } from 'react-icons/fi';
import { useAboutPageStore } from '../../store/aboutPageStore';
import toast from 'react-hot-toast';

const VisionMissionEditor = () => {
  const navigate = useNavigate();
  const { vision, mission, updateVision, updateMission, fetchInitialData } = useAboutPageStore();
  
  const [visionData, setVisionData] = useState({ ...vision });
  const [missionData, setMissionData] = useState({ ...mission });

  useEffect(() => {
    fetchInitialData().then(() => {
      setVisionData(useAboutPageStore.getState().vision);
      setMissionData(useAboutPageStore.getState().mission);
    });
  }, []);

  const handleVisionChange = (e) => {
    const { name, value } = e.target;
    setVisionData((prev) => ({ ...prev, [name]: value }));
  };

  const handleMissionChange = (e) => {
    const { name, value } = e.target;
    setMissionData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    updateVision(visionData);
    updateMission(missionData);
    toast.success('Vision and Mission updated successfully!');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-4xl mx-auto p-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/ple-ops-desk/about-page')} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition">
            <FiArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Edit Vision & Mission</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage the vision and mission statements.</p>
          </div>
        </div>
        <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-[#C07A3D] text-white rounded-lg hover:bg-[#a6642d] transition text-sm font-semibold shadow-sm">
          <FiSave /> Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-2">Our Vision</h2>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Title</label>
            <input type="text" name="title" value={visionData.title || ''} onChange={handleVisionChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
            <textarea name="description" value={visionData.description || ''} onChange={handleVisionChange} rows={5} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-2">Our Mission</h2>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Title</label>
            <input type="text" name="title" value={missionData.title || ''} onChange={handleMissionChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
            <textarea name="description" value={missionData.description || ''} onChange={handleMissionChange} rows={5} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]" />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default VisionMissionEditor;
