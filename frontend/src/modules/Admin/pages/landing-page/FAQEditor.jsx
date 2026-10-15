import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiSave, FiArrowLeft, FiPlus, FiTrash, FiEdit, FiHelpCircle } from 'react-icons/fi';
import { useLandingPageStore } from '../../store/landingPageStore';
import toast from 'react-hot-toast';

const FAQEditor = () => {
  const navigate = useNavigate();
  const { faq, updateFaq } = useLandingPageStore();

  const [editingIndex, setEditingIndex] = useState(null);
  const [formData, setFormData] = useState({ question: '', answer: '' });

  const handleStartEdit = (index) => {
    setEditingIndex(index);
    setFormData(faq[index]);
  };

  const handleStartAdd = () => {
    setEditingIndex(-1);
    setFormData({ question: '', answer: '' });
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveItem = () => {
    if (!formData.question.trim() || !formData.answer.trim()) {
      toast.error('Question and Answer are required!');
      return;
    }

    let updatedList = [...faq];
    if (editingIndex === -1) {
      updatedList.push(formData);
    } else {
      updatedList[editingIndex] = formData;
    }

    updateFaq(updatedList);
    setEditingIndex(null);
    toast.success('FAQ list updated successfully!');
  };

  const handleDeleteItem = (index) => {
    if (window.confirm('Delete this FAQ item?')) {
      const updatedList = faq.filter((_, idx) => idx !== index);
      updateFaq(updatedList);
      toast.success('FAQ item deleted!');
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
            <h1 className="text-xl font-bold text-gray-900">FAQ Section Editor</h1>
            <p className="text-xs text-gray-500 mt-0.5">Customize questions, answers, and support queries for visitors.</p>
          </div>
        </div>

        {editingIndex === null && (
          <button
            onClick={handleStartAdd}
            className="flex items-center gap-2 px-4 py-2 bg-[#C07A3D] text-white rounded-lg hover:bg-[#a6642d] transition text-sm font-semibold shadow-sm"
          >
            <FiPlus />
            Add FAQ Item
          </button>
        )}
      </div>

      {editingIndex !== null ? (
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm">
          <h2 className="text-sm font-bold text-[#C07A3D] mb-4 uppercase">
            {editingIndex === -1 ? 'Add FAQ Item' : 'Edit FAQ Item'}
          </h2>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Question</label>
            <input
              type="text"
              name="question"
              value={formData.question}
              onChange={handleFormChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Answer</label>
            <textarea
              name="answer"
              value={formData.answer}
              onChange={handleFormChange}
              rows={4}
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
              Save Item
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
          {faq.map((item, idx) => (
            <div key={idx} className="p-5 flex items-center justify-between hover:bg-gray-50/50 transition">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-50 rounded-xl text-[#C07A3D]">
                  <FiHelpCircle size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800">{item.question}</h3>
                  <p className="text-xs text-gray-500 mt-2 max-w-2xl leading-relaxed">{item.answer}</p>
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

export default FAQEditor;
