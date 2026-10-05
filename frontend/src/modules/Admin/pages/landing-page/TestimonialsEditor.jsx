import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiSave, FiArrowLeft, FiPlus, FiTrash, FiEdit, FiMessageSquare } from 'react-icons/fi';
import { useLandingPageStore } from '../../store/landingPageStore';
import toast from 'react-hot-toast';

const TestimonialsEditor = () => {
  const navigate = useNavigate();
  const { testimonials, updateTestimonials, testimonialsHeader, updateTestimonialsHeader } = useLandingPageStore();

  const [headerData, setHeaderData] = useState({
    title: testimonialsHeader?.title || 'CLIENT SAYS:'
  });

  const handleHeaderChange = (e) => {
    const { name, value } = e.target;
    setHeaderData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveHeader = () => {
    updateTestimonialsHeader(headerData);
    toast.success('Testimonials header title updated!');
  };

  const [editingIndex, setEditingIndex] = useState(null);
  const [formData, setFormData] = useState({
    quote: '',
    author: '',
    role: '',
    avatar: '',
    country: '',
    countryFlag: ''
  });

  const handleStartEdit = (index) => {
    setEditingIndex(index);
    setFormData(testimonials[index]);
  };

  const handleStartAdd = () => {
    setEditingIndex(-1);
    setFormData({
      quote: '',
      author: '',
      role: '',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&h=150&fit=crop',
      country: 'India',
      countryFlag: '🇮🇳'
    });
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveItem = () => {
    if (!formData.author.trim() || !formData.quote.trim()) {
      toast.error('Author and Quote are required!');
      return;
    }

    let updatedList = [...testimonials];
    if (editingIndex === -1) {
      updatedList.push(formData);
    } else {
      updatedList[editingIndex] = formData;
    }

    updateTestimonials(updatedList);
    setEditingIndex(null);
    toast.success('Testimonials list updated successfully!');
  };

  const handleDeleteItem = (index) => {
    if (window.confirm('Delete this testimonial?')) {
      const updatedList = testimonials.filter((_, idx) => idx !== index);
      updateTestimonials(updatedList);
      toast.success('Testimonial deleted!');
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
            <h1 className="text-xl font-bold text-gray-900">Testimonials Editor</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage customer reviews, avatars, roles, and locations.</p>
          </div>
        </div>

        {editingIndex === null && (
          <button
            onClick={handleStartAdd}
            className="flex items-center gap-2 px-4 py-2 bg-[#C07A3D] text-white rounded-lg hover:bg-[#a6642d] transition text-sm font-semibold shadow-sm"
          >
            <FiPlus />
            Add Testimonial
          </button>
        )}
      </div>

      {/* Section Header Controls */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-4">
        <h2 className="text-xs font-bold text-[#C07A3D] uppercase tracking-wider">
          Section Title & Header Settings
        </h2>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Section Heading Title</label>
          <input
            type="text"
            name="title"
            value={headerData.title}
            onChange={handleHeaderChange}
            className="w-full text-sm border border-gray-200 rounded-lg p-2.5 outline-none focus:border-[#C07A3D]"
            placeholder="e.g. CLIENT SAYS:"
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
            {editingIndex === -1 ? 'Add Testimonial' : 'Edit Testimonial'}
          </h2>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Author Name</label>
            <input
              type="text"
              name="author"
              value={formData.author}
              onChange={handleFormChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Role / Designation</label>
            <input
              type="text"
              name="role"
              placeholder="e.g. CEO at Brand"
              value={formData.role}
              onChange={handleFormChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Quote</label>
            <textarea
              name="quote"
              value={formData.quote}
              onChange={handleFormChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Avatar Image URL</label>
            <input
              type="text"
              name="avatar"
              value={formData.avatar}
              onChange={handleFormChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Country</label>
              <input
                type="text"
                name="country"
                value={formData.country}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Country Flag Emoji</label>
              <input
                type="text"
                name="countryFlag"
                placeholder="e.g. 🇮🇳"
                value={formData.countryFlag}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
              />
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
              Save Item
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
          {testimonials.map((item, idx) => (
            <div key={idx} className="p-5 flex items-center justify-between hover:bg-gray-50/50 transition">
              <div className="flex items-start gap-4">
                <img 
                  src={item.avatar} 
                  alt={item.author} 
                  className="w-12 h-12 rounded-full object-cover border border-gray-200"
                />
                <div>
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                    {item.author} {item.countryFlag && <span>{item.countryFlag}</span>}
                  </h3>
                  <p className="text-xs text-gray-400 font-medium">{item.role} ({item.country})</p>
                  <p className="text-xs text-gray-500 italic mt-2 max-w-lg leading-relaxed">"{item.quote}"</p>
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

export default TestimonialsEditor;
