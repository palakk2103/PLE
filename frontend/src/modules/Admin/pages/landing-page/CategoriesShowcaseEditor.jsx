import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiSave, FiArrowLeft, FiPlus, FiTrash, FiEdit, FiGrid } from 'react-icons/fi';
import { useLandingPageStore } from '../../store/landingPageStore';
import toast from 'react-hot-toast';

const CategoriesShowcaseEditor = () => {
  const navigate = useNavigate();
  const { productCategoriesShowcase, updateProductCategoriesShowcase } = useLandingPageStore();

  const [headerData, setHeaderData] = useState({
    badge: productCategoriesShowcase?.badge || 'Product Sourcing',
    title: productCategoriesShowcase?.title || 'Dynamic Categories',
    subtitle: productCategoriesShowcase?.subtitle || 'Procure authentic hardware, custom configurations, and volume software licensing built for business scalability.'
  });

  const categories = productCategoriesShowcase?.categories || [];
  const [editingIndex, setEditingIndex] = useState(null);
  const [formData, setFormData] = useState({
    id: '',
    title: '',
    categoryGroup: 'hardware',
    iconName: 'Cpu',
    description: '',
    subItemsText: '',
    brandsText: ''
  });

  const handleHeaderChange = (e) => {
    const { name, value } = e.target;
    setHeaderData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveHeader = () => {
    updateProductCategoriesShowcase({
      ...productCategoriesShowcase,
      ...headerData
    });
    toast.success('Categories showcase header updated!');
  };

  const handleStartEdit = (index) => {
    setEditingIndex(index);
    const item = categories[index];
    setFormData({
      id: item.id || `cat-${Date.now()}`,
      title: item.title || '',
      categoryGroup: item.categoryGroup || 'hardware',
      iconName: item.iconName || 'Cpu',
      description: item.description || '',
      subItemsText: Array.isArray(item.subItems) ? item.subItems.join(', ') : '',
      brandsText: Array.isArray(item.brands) ? item.brands.join(', ') : ''
    });
  };

  const handleStartAdd = () => {
    setEditingIndex(-1);
    setFormData({
      id: `cat-${Date.now()}`,
      title: '',
      categoryGroup: 'hardware',
      iconName: 'Cpu',
      description: '',
      subItemsText: '',
      brandsText: ''
    });
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveItem = () => {
    if (!formData.title.trim()) {
      toast.error('Category title is required');
      return;
    }

    const itemToSave = {
      id: formData.id,
      title: formData.title,
      categoryGroup: formData.categoryGroup,
      iconName: formData.iconName,
      description: formData.description,
      subItems: formData.subItemsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      brands: formData.brandsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    };

    let updated = [...categories];
    if (editingIndex === -1) {
      updated.push(itemToSave);
    } else {
      updated[editingIndex] = itemToSave;
    }

    updateProductCategoriesShowcase({
      ...productCategoriesShowcase,
      categories: updated
    });
    setEditingIndex(null);
    toast.success('Category showcase item saved!');
  };

  const handleDeleteItem = (index) => {
    if (window.confirm('Delete this showcase category?')) {
      const updated = categories.filter((_, i) => i !== index);
      updateProductCategoriesShowcase({
        ...productCategoriesShowcase,
        categories: updated
      });
      toast.success('Category removed!');
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
            <h1 className="text-xl font-bold text-gray-900">Product Categories Showcase</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage sourcing categories, brands, sub-items, and header copy.</p>
          </div>
        </div>

        {editingIndex === null && (
          <button
            onClick={handleStartAdd}
            className="flex items-center gap-2 px-4 py-2 bg-[#C07A3D] text-white rounded-lg hover:bg-[#a6642d] transition text-sm font-semibold shadow-sm"
          >
            <FiPlus />
            Add Showcase Category
          </button>
        )}
      </div>

      {/* Header Controls */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-4">
        <h2 className="text-xs font-bold text-[#C07A3D] uppercase tracking-wider">
          Section Title & Header Settings
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Badge Text</label>
            <input
              type="text"
              name="badge"
              value={headerData.badge}
              onChange={handleHeaderChange}
              className="w-full text-sm border border-gray-200 rounded-lg p-2.5 outline-none focus:border-[#C07A3D]"
              placeholder="e.g. Product Sourcing"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Heading Title</label>
            <input
              type="text"
              name="title"
              value={headerData.title}
              onChange={handleHeaderChange}
              className="w-full text-sm border border-gray-200 rounded-lg p-2.5 outline-none focus:border-[#C07A3D]"
              placeholder="e.g. Dynamic Categories"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Subtitle / Description</label>
          <textarea
            rows="2"
            name="subtitle"
            value={headerData.subtitle}
            onChange={handleHeaderChange}
            className="w-full text-sm border border-gray-200 rounded-lg p-2.5 outline-none focus:border-[#C07A3D]"
            placeholder="Description of the categories showcase"
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

      {/* Add / Edit Form */}
      {editingIndex !== null ? (
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm">
          <h2 className="text-sm font-bold text-[#C07A3D] mb-4 uppercase">
            {editingIndex === -1 ? 'Add Showcase Category' : 'Edit Showcase Category'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category Title</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleFormChange}
                className="w-full text-sm border border-gray-200 rounded-lg p-2.5 outline-none focus:border-[#C07A3D]"
                placeholder="e.g. PC Components"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Group / Filter</label>
              <select
                name="categoryGroup"
                value={formData.categoryGroup}
                onChange={handleFormChange}
                className="w-full text-sm border border-gray-200 rounded-lg p-2.5 outline-none focus:border-[#C07A3D] bg-white"
              >
                <option value="hardware">Computing & Hardware</option>
                <option value="network">Network & Security</option>
                <option value="av">Displays & AV</option>
                <option value="software">Software & Licenses</option>
                <option value="custom">Custom Sourcing</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Lucide Icon Name</label>
              <input
                type="text"
                name="iconName"
                value={formData.iconName}
                onChange={handleFormChange}
                className="w-full text-sm border border-gray-200 rounded-lg p-2.5 outline-none focus:border-[#C07A3D]"
                placeholder="e.g. Cpu, Laptop, Monitor, Wifi, Server"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
            <textarea
              rows="2"
              name="description"
              value={formData.description}
              onChange={handleFormChange}
              className="w-full text-sm border border-gray-200 rounded-lg p-2.5 outline-none focus:border-[#C07A3D]"
              placeholder="Brief details about what is sourced in this category"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sub-Items (comma separated)</label>
            <input
              type="text"
              name="subItemsText"
              value={formData.subItemsText}
              onChange={handleFormChange}
              className="w-full text-sm border border-gray-200 rounded-lg p-2.5 outline-none focus:border-[#C07A3D]"
              placeholder="e.g. Motherboards, GPUs, Cabinets, RAM"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Brands (comma separated)</label>
            <input
              type="text"
              name="brandsText"
              value={formData.brandsText}
              onChange={handleFormChange}
              className="w-full text-sm border border-gray-200 rounded-lg p-2.5 outline-none focus:border-[#C07A3D]"
              placeholder="e.g. ASUS ROG, MSI, Intel, NVIDIA"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setEditingIndex(null)}
              className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveItem}
              className="px-5 py-2 bg-[#C07A3D] text-white rounded-lg hover:bg-[#a6642d] transition text-sm font-semibold shadow-sm"
            >
              Save Item
            </button>
          </div>
        </div>
      ) : (
        /* Categories List */
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-3 bg-gray-50/70 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase">
            Active Showcase Categories ({categories.length})
          </div>
          <div className="divide-y divide-gray-100">
            {categories.map((cat, idx) => (
              <div key={cat.id || idx} className="p-4 flex items-center justify-between hover:bg-gray-50/50 transition">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#C07A3D]/10 text-[#C07A3D] flex items-center justify-center font-bold text-sm">
                    {idx + 1}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-800">{cat.title}</h3>
                    <p className="text-xs text-gray-400 line-clamp-1">Group: {cat.categoryGroup} • {cat.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleStartEdit(idx)}
                    className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
                    title="Edit Category"
                  >
                    <FiEdit size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteItem(idx)}
                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                    title="Delete Category"
                  >
                    <FiTrash size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default CategoriesShowcaseEditor;
