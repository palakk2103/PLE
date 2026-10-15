import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiSave, FiArrowLeft, FiPlus, FiTrash, FiEdit, FiLayers } from 'react-icons/fi';
import { useLandingPageStore } from '../../store/landingPageStore';
import toast from 'react-hot-toast';

const ServicesEditor = () => {
  const navigate = useNavigate();
  const { services, updateServices } = useLandingPageStore();

  const [editingIndex, setEditingIndex] = useState(null);
  const [formData, setFormData] = useState({
    id: '',
    slug: '',
    title: '',
    subtitle: '',
    shortDescription: '',
    description: '',
    subServices: '',
    icon: 'Globe',
    features: [],
    cta: 'Get Started'
  });

  const [featureInput, setFeatureInput] = useState('');

  const handleStartEdit = (index) => {
    setEditingIndex(index);
    setFormData(services[index]);
  };

  const handleStartAdd = () => {
    setEditingIndex(-1); // -1 signifies a new item
    setFormData({
      id: `service-${Date.now()}`,
      slug: '',
      title: '',
      subtitle: '',
      shortDescription: '',
      description: '',
      subServices: '',
      icon: 'Globe',
      features: [],
      cta: 'Get Started'
    });
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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
    if (!formData.title.trim()) {
      toast.error('Title is required!');
      return;
    }
    
    // Auto slug if empty
    const updatedForm = {
      ...formData,
      slug: formData.slug || formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    };

    let updatedList = [...services];
    if (editingIndex === -1) {
      updatedList.push(updatedForm);
    } else {
      updatedList[editingIndex] = updatedForm;
    }

    updateServices(updatedList);
    setEditingIndex(null);
    toast.success('Services updated successfully!');
  };

  const handleDeleteItem = (index) => {
    if (window.confirm('Are you sure you want to delete this service?')) {
      const updatedList = services.filter((_, idx) => idx !== index);
      updateServices(updatedList);
      toast.success('Service removed!');
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
            <h1 className="text-xl font-bold text-gray-900">Services & Categories Editor</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage services featured in the categories and pages sections.</p>
          </div>
        </div>

        {editingIndex === null && (
          <button
            onClick={handleStartAdd}
            className="flex items-center gap-2 px-4 py-2 bg-[#C07A3D] text-white rounded-lg hover:bg-[#a6642d] transition text-sm font-semibold shadow-sm"
          >
            <FiPlus />
            Add New Service
          </button>
        )}
      </div>

      {editingIndex !== null ? (
        /* Edit Form */
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-50 pb-3">
            <h2 className="text-sm font-bold text-[#C07A3D] uppercase">
              {editingIndex === -1 ? 'Add New Service' : `Editing: ${formData.title}`}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setEditingIndex(null)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-50 text-gray-600 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveItem}
                className="px-3 py-1.5 bg-[#C07A3D] text-white rounded-lg text-xs font-semibold hover:bg-[#a6642d] transition"
              >
                Save Item
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Service Title</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Service Slug</label>
              <input
                type="text"
                name="slug"
                placeholder="website-development (auto-generated if empty)"
                value={formData.slug}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Subtitle / Highlight Tagline</label>
              <input
                type="text"
                name="subtitle"
                value={formData.subtitle}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sub-Services (comma separated)</label>
              <input
                type="text"
                name="subServices"
                placeholder="Static sites, CMS, E-commerce"
                value={formData.subServices}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Short Description</label>
              <input
                type="text"
                name="shortDescription"
                value={formData.shortDescription}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Detailed Description</label>
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
                placeholder="Globe, Smartphone, ShieldCheck"
                value={formData.icon}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CTA Button Text</label>
              <input
                type="text"
                name="cta"
                value={formData.cta}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
              />
            </div>

            <div className="md:col-span-2 border-t border-gray-50 pt-4">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Bullet Point Features</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={featureInput}
                  onChange={(e) => setFeatureInput(e.target.value)}
                  placeholder="e.g. SEO Optimized Code Structure"
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
        </div>
      ) : (
        /* List Display */
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
          {services.map((serv, index) => (
            <div key={serv.id} className="p-5 flex items-center justify-between hover:bg-gray-50/50 transition">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-50 rounded-xl text-[#C07A3D]">
                  <FiLayers size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800">{serv.title}</h3>
                  <p className="text-xs text-gray-400 mt-1 max-w-lg leading-relaxed">{serv.shortDescription}</p>
                  <div className="flex gap-1.5 mt-2">
                    <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded font-mono">Slug: {serv.slug}</span>
                    <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded font-mono">Icon: {serv.icon}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleStartEdit(index)}
                  className="p-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  <FiEdit size={16} />
                </button>
                <button
                  onClick={() => handleDeleteItem(index)}
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

export default ServicesEditor;
