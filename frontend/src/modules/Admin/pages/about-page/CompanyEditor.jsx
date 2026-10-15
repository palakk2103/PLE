import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiSave, FiArrowLeft, FiPlus, FiTrash2, FiUpload, FiLoader } from 'react-icons/fi';
import { useAboutPageStore } from '../../store/aboutPageStore';
import { uploadAdminMedia } from '../../services/adminService';
import toast from 'react-hot-toast';

const CompanyEditor = () => {
  const navigate = useNavigate();
  const { aboutCompany, updateAboutCompany, fetchInitialData } = useAboutPageStore();
  
  const [formData, setFormData] = useState({ ...aboutCompany });
  const [isUploadingImg1, setIsUploadingImg1] = useState(false);
  const [isUploadingImg2, setIsUploadingImg2] = useState(false);

  useEffect(() => {
    fetchInitialData().then(() => {
      setFormData(useAboutPageStore.getState().aboutCompany);
    });
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleParagraphChange = (index, value) => {
    const newParagraphs = [...(formData.paragraphs || [])];
    newParagraphs[index] = value;
    setFormData((prev) => ({ ...prev, paragraphs: newParagraphs }));
  };

  const addParagraph = () => {
    setFormData((prev) => ({ ...prev, paragraphs: [...(prev.paragraphs || []), ''] }));
  };

  const removeParagraph = (index) => {
    const newParagraphs = [...(formData.paragraphs || [])];
    newParagraphs.splice(index, 1);
    setFormData((prev) => ({ ...prev, paragraphs: newParagraphs }));
  };

  const handleFeatureChange = (index, field, value) => {
    const newFeatures = [...(formData.features || [])];
    newFeatures[index] = { ...newFeatures[index], [field]: value };
    setFormData((prev) => ({ ...prev, features: newFeatures }));
  };

  const addFeature = () => {
    setFormData((prev) => ({ ...prev, features: [...(prev.features || []), { title: '', description: '', iconName: '' }] }));
  };

  const removeFeature = (index) => {
    const newFeatures = [...(formData.features || [])];
    newFeatures.splice(index, 1);
    setFormData((prev) => ({ ...prev, features: newFeatures }));
  };

  const handleImageUpload = async (e, fieldName, setUploading) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type?.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    setUploading(true);
    try {
      const response = await uploadAdminMedia(file, 'about_images');
      const url = response?.data?.url;
      if (!url) throw new Error('No URL returned');
      setFormData((prev) => ({ ...prev, [fieldName]: url }));
      toast.success('Image uploaded successfully');
    } catch (error) {
      toast.error('Image upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSave = () => {
    updateAboutCompany(formData);
    toast.success('Company section updated successfully!');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-5xl mx-auto p-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/ple-ops-desk/about-page')} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition">
            <FiArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Edit Company Section</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage paragraphs, checklist features, and dual images.</p>
          </div>
        </div>
        <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-[#C07A3D] text-white rounded-lg hover:bg-[#a6642d] transition text-sm font-semibold shadow-sm">
          <FiSave /> Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-2">Main Titles</h2>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Title 1</label>
              <input type="text" name="title1" value={formData.title1 || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Title 2</label>
              <input type="text" name="title2" value={formData.title2 || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Paragraphs</h2>
              <button onClick={addParagraph} className="flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 rounded text-xs font-semibold hover:bg-green-100">
                <FiPlus /> Add
              </button>
            </div>
            {(formData.paragraphs || []).map((p, idx) => (
              <div key={idx} className="flex gap-2">
                <textarea
                  value={p}
                  onChange={(e) => handleParagraphChange(idx, e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
                />
                <button onClick={() => removeParagraph(idx)} className="p-2 h-fit bg-red-50 text-red-600 rounded-lg hover:bg-red-100">
                  <FiTrash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          
          <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-2">Founder & Center Badge</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Founder Name</label>
                <input type="text" name="founderName" value={formData.founderName || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Years of Excellence</label>
                <input type="text" name="yearsOfExcellence" value={formData.yearsOfExcellence || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Founder Role</label>
              <input type="text" name="founderRole" value={formData.founderRole || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]" />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Features Checklist</h2>
              <button onClick={addFeature} className="flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 rounded text-xs font-semibold hover:bg-green-100">
                <FiPlus /> Add
              </button>
            </div>
            <div className="space-y-4">
              {(formData.features || []).map((f, idx) => (
                <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200 relative">
                  <button onClick={() => removeFeature(idx)} className="absolute top-2 right-2 p-1 text-red-500 hover:text-red-700">
                    <FiTrash2 size={16} />
                  </button>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Title</label>
                      <input type="text" value={f.title || ''} onChange={(e) => handleFeatureChange(idx, 'title', e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Icon Name (Lucide)</label>
                      <input type="text" value={f.iconName || ''} onChange={(e) => handleFeatureChange(idx, 'iconName', e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder="e.g. ShieldCheck" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Description</label>
                    <textarea value={f.description || ''} onChange={(e) => handleFeatureChange(idx, 'description', e.target.value)} rows={2} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-2">Dual Images</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Back Image (Top-Left)</label>
                <input type="text" name="compImg1" value={formData.compImg1 || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-2" />
                <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer text-xs font-semibold">
                  {isUploadingImg1 ? <FiLoader className="animate-spin" /> : <FiUpload />}
                  {isUploadingImg1 ? 'Uploading...' : 'Upload'}
                  <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'compImg1', setIsUploadingImg1)} className="hidden" disabled={isUploadingImg1} />
                </label>
                {formData.compImg1 && <img src={formData.compImg1} alt="preview" className="mt-2 h-24 object-cover rounded-lg" />}
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Front Image (Bottom-Right)</label>
                <input type="text" name="compImg2" value={formData.compImg2 || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-2" />
                <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer text-xs font-semibold">
                  {isUploadingImg2 ? <FiLoader className="animate-spin" /> : <FiUpload />}
                  {isUploadingImg2 ? 'Uploading...' : 'Upload'}
                  <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'compImg2', setIsUploadingImg2)} className="hidden" disabled={isUploadingImg2} />
                </label>
                {formData.compImg2 && <img src={formData.compImg2} alt="preview" className="mt-2 h-24 object-cover rounded-lg" />}
              </div>
            </div>
          </div>

        </div>
      </div>
    </motion.div>
  );
};

export default CompanyEditor;
