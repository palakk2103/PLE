import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiSave, FiArrowLeft, FiPlus, FiTrash } from 'react-icons/fi';
import { useLandingPageStore } from '../../store/landingPageStore';
import toast from 'react-hot-toast';

const ComparisonEditor = () => {
  const navigate = useNavigate();
  const { comparison, updateComparison } = useLandingPageStore();

  const [headerData, setHeaderData] = useState({
    heading: comparison.header?.heading || '',
    description: comparison.header?.description || '',
    vedhuntColumnHeader: comparison.header?.vedhuntColumnHeader || '',
    typicalColumnHeader: comparison.header?.typicalColumnHeader || '',
    bottomNote: comparison.header?.bottomNote || '',
  });

  const [rows, setRows] = useState(comparison.rows || []);
  const [newRow, setNewRow] = useState({ feature: '', vedhunt: '', typical: '' });

  const handleHeaderChange = (e) => {
    const { name, value } = e.target;
    setHeaderData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRowChange = (index, field, value) => {
    const updated = [...rows];
    updated[index][field] = value;
    setRows(updated);
  };

  const handleAddRow = () => {
    if (newRow.feature.trim() && newRow.vedhunt.trim()) {
      setRows((prev) => [...prev, { ...newRow }]);
      setNewRow({ feature: '', vedhunt: '', typical: '' });
    } else {
      toast.error('Feature and Our Marketplace fields are required!');
    }
  };

  const handleRemoveRow = (index) => {
    setRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSave = async () => {
    try {
      await updateComparison({
        header: headerData,
        rows
      });
      toast.success('Comparison Table updated successfully!');
    } catch (error) {
      toast.error('Failed to update: Your admin session might have expired. Please refresh the page and log in again.');
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
            <h1 className="text-xl font-bold text-gray-900">Edit Comparison Table</h1>
            <p className="text-xs text-gray-500 mt-0.5">Customize the trust-building comparison matrix headers and rows.</p>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Headers info */}
        <div className="md:col-span-1 bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm h-fit">
          <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-2">Table Configuration</h2>
          
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Heading</label>
            <input
              type="text"
              name="heading"
              value={headerData.heading}
              onChange={handleHeaderChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
            <textarea
              name="description"
              value={headerData.description}
              onChange={handleHeaderChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Your Brand Column Header</label>
            <input
              type="text"
              name="vedhuntColumnHeader"
              value={headerData.vedhuntColumnHeader}
              onChange={handleHeaderChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Typical Store Column Header</label>
            <input
              type="text"
              name="typicalColumnHeader"
              value={headerData.typicalColumnHeader}
              onChange={handleHeaderChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Bottom Benchmarks Note</label>
            <input
              type="text"
              name="bottomNote"
              value={headerData.bottomNote}
              onChange={handleHeaderChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>
        </div>

        {/* Right Column: Rows list & editor */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-4">Comparison Matrix Rows</h2>
            
            <div className="space-y-4">
              {rows.map((row, idx) => (
                <div key={idx} className="flex gap-2 items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <input
                    type="text"
                    placeholder="Feature name"
                    value={row.feature}
                    onChange={(e) => handleRowChange(idx, 'feature', e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1 bg-white border border-gray-200 rounded text-xs focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Your value"
                    value={row.vedhunt}
                    onChange={(e) => handleRowChange(idx, 'vedhunt', e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1 bg-white border border-gray-200 rounded text-xs focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Typical value"
                    value={row.typical}
                    onChange={(e) => handleRowChange(idx, 'typical', e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1 bg-white border border-gray-200 rounded text-xs focus:outline-none"
                  />
                  <button
                    onClick={() => handleRemoveRow(idx)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                  >
                    <FiTrash size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add New Row Box */}
            <div className="mt-6 border-t border-gray-100 pt-4 space-y-3">
              <h3 className="text-xs font-bold text-gray-500 uppercase">Add Comparison Row</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Refund Policy"
                  value={newRow.feature}
                  onChange={(e) => setNewRow((p) => ({ ...p, feature: e.target.value }))}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#C07A3D]"
                />
                <input
                  type="text"
                  placeholder="e.g. 100% money back"
                  value={newRow.vedhunt}
                  onChange={(e) => setNewRow((p) => ({ ...p, vedhunt: e.target.value }))}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#C07A3D]"
                />
                <input
                  type="text"
                  placeholder="e.g. Store credit only"
                  value={newRow.typical}
                  onChange={(e) => setNewRow((p) => ({ ...p, typical: e.target.value }))}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#C07A3D]"
                />
                <button
                  onClick={handleAddRow}
                  className="px-4 py-2 bg-[#C07A3D] text-white rounded-lg text-xs font-semibold hover:bg-[#a6642d] transition flex items-center gap-1.5"
                >
                  <FiPlus />
                  Add
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ComparisonEditor;
