import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiSave, FiArrowLeft, FiPlus, FiTrash, FiEdit, FiShoppingBag } from 'react-icons/fi';
import { useLandingPageStore } from '../../store/landingPageStore';
import toast from 'react-hot-toast';

const ProductShowcaseEditor = () => {
  const navigate = useNavigate();
  const { products, updateProducts, productsHeader, updateProductsHeader } = useLandingPageStore();

  const [headerData, setHeaderData] = useState({
    badge: productsHeader?.badge || 'Featured Picks',
    title: productsHeader?.title || 'Curated Collections'
  });

  const handleHeaderChange = (e) => {
    const { name, value } = e.target;
    setHeaderData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveHeader = () => {
    updateProductsHeader(headerData);
    toast.success('Product showcase header updated!');
  };

  const [editingIndex, setEditingIndex] = useState(null);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    price: '',
    image: '',
    link: '#',
    featured: true
  });

  const handleStartEdit = (index) => {
    setEditingIndex(index);
    setFormData(products[index]);
  };

  const handleStartAdd = () => {
    setEditingIndex(-1);
    setFormData({
      id: `prod-${Date.now()}`,
      name: '',
      price: '',
      image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=300&h=300&fit=crop',
      link: '#',
      featured: true
    });
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveItem = () => {
    if (!formData.name.trim() || !formData.price.trim()) {
      toast.error('Product Name and Price are required!');
      return;
    }

    let updatedList = [...products];
    if (editingIndex === -1) {
      updatedList.push(formData);
    } else {
      updatedList[editingIndex] = formData;
    }

    updateProducts(updatedList);
    setEditingIndex(null);
    toast.success('Featured products list updated successfully!');
  };

  const handleDeleteItem = (index) => {
    if (window.confirm('Delete this featured product?')) {
      const updatedList = products.filter((_, idx) => idx !== index);
      updateProducts(updatedList);
      toast.success('Product deleted!');
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
            <h1 className="text-xl font-bold text-gray-900">Featured Showcase Editor</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage products that are displayed in the landing page featured showcase.</p>
          </div>
        </div>

        {editingIndex === null && (
          <button
            onClick={handleStartAdd}
            className="flex items-center gap-2 px-4 py-2 bg-[#C07A3D] text-white rounded-lg hover:bg-[#a6642d] transition text-sm font-semibold shadow-sm"
          >
            <FiPlus />
            Add Featured Product
          </button>
        )}
      </div>

      {/* Section Header Controls */}
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
              placeholder="e.g. Featured Picks"
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
              placeholder="e.g. Curated Collections"
            />
          </div>
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
            {editingIndex === -1 ? 'Add Product' : 'Edit Product'}
          </h2>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Product Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleFormChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Price</label>
            <input
              type="text"
              name="price"
              placeholder="e.g. ₹2,499"
              value={formData.price}
              onChange={handleFormChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Image URL</label>
            <input
              type="text"
              name="image"
              value={formData.image}
              onChange={handleFormChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Redirect / Checkout Link</label>
            <input
              type="text"
              name="link"
              value={formData.link}
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
              Save Product
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {products.map((item, idx) => (
            <div key={item.id || idx} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition">
              <img 
                src={item.image} 
                alt={item.name} 
                className="w-full h-44 object-cover"
              />
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-800 line-clamp-1">{item.name}</h3>
                  <span className="text-sm font-black text-[#C07A3D] mt-1 block">{item.price}</span>
                </div>
                <div className="flex gap-1.5 mt-4">
                  <button
                    onClick={() => handleStartEdit(idx)}
                    className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition"
                  >
                    <FiEdit size={12} />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteItem(idx)}
                    className="py-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg flex items-center justify-center transition"
                  >
                    <FiTrash size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default ProductShowcaseEditor;
