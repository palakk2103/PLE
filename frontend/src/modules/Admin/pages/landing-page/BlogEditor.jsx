import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiSave, FiArrowLeft, FiPlus, FiTrash, FiEdit, FiFileText } from 'react-icons/fi';
import { useLandingPageStore } from '../../store/landingPageStore';
import toast from 'react-hot-toast';

const BlogEditor = () => {
  const navigate = useNavigate();
  const { blogs, updateBlogs } = useLandingPageStore();

  const [editingIndex, setEditingIndex] = useState(null);
  const [formData, setFormData] = useState({
    id: '',
    title: '',
    category: '',
    date: '',
    excerpt: '',
    image: '',
    author: ''
  });

  const handleStartEdit = (index) => {
    setEditingIndex(index);
    setFormData(blogs[index]);
  };

  const handleStartAdd = () => {
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    setEditingIndex(-1);
    setFormData({
      id: Date.now(),
      title: '',
      category: 'DEVELOPMENT',
      date: today,
      excerpt: '',
      image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=800&h=500&fit=crop',
      author: 'Andrew Wills'
    });
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveItem = () => {
    if (!formData.title.trim() || !formData.excerpt.trim()) {
      toast.error('Title and Excerpt are required!');
      return;
    }

    let updatedList = [...blogs];
    if (editingIndex === -1) {
      updatedList.push(formData);
    } else {
      updatedList[editingIndex] = formData;
    }

    updateBlogs(updatedList);
    setEditingIndex(null);
    toast.success('Blogs updated successfully!');
  };

  const handleDeleteItem = (index) => {
    if (window.confirm('Delete this blog post?')) {
      const updatedList = blogs.filter((_, idx) => idx !== index);
      updateBlogs(updatedList);
      toast.success('Blog post deleted!');
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
            <h1 className="text-xl font-bold text-gray-900">Blog Editor</h1>
            <p className="text-xs text-gray-500 mt-0.5">Customize, add, or delete blog posts featured on the client site.</p>
          </div>
        </div>

        {editingIndex === null && (
          <button
            onClick={handleStartAdd}
            className="flex items-center gap-2 px-4 py-2 bg-[#C07A3D] text-white rounded-lg hover:bg-[#a6642d] transition text-sm font-semibold shadow-sm"
          >
            <FiPlus />
            Add Blog Post
          </button>
        )}
      </div>

      {editingIndex !== null ? (
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm">
          <h2 className="text-sm font-bold text-[#C07A3D] mb-4 uppercase">
            {editingIndex === -1 ? 'Add Blog Post' : 'Edit Blog Post'}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Blog Title</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
              />
            </div>
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
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category / Tag</label>
              <input
                type="text"
                name="category"
                value={formData.category}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Publication Date</label>
              <input
                type="text"
                name="date"
                value={formData.date}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Image URL</label>
              <input
                type="text"
                name="image"
                value={formData.image}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Excerpt Summary</label>
              <textarea
                name="excerpt"
                value={formData.excerpt}
                onChange={handleFormChange}
                rows={3}
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
              Save Blog Post
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
          {blogs.map((item, idx) => (
            <div key={item.id || idx} className="p-5 flex items-center justify-between hover:bg-gray-50/50 transition">
              <div className="flex items-start gap-4">
                <img 
                  src={item.image} 
                  alt={item.title} 
                  className="w-16 h-16 rounded-xl object-cover border border-gray-200"
                />
                <div>
                  <span className="text-[10px] bg-amber-50 text-[#C07A3D] border border-amber-100 px-2 py-0.5 rounded font-black uppercase tracking-wider">{item.category}</span>
                  <h3 className="text-sm font-bold text-gray-800 mt-1">{item.title}</h3>
                  <p className="text-xs text-gray-400 mt-0.5 font-medium">By {item.author} on {item.date}</p>
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

export default BlogEditor;
