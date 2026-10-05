import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiSave, FiArrowLeft, FiUpload, FiBookOpen, FiVideo, FiCheckCircle } from 'react-icons/fi';
import { useLandingPageStore } from '../../store/landingPageStore';
import { uploadAdminMedia } from '../../services/adminService';
import toast from 'react-hot-toast';

const CatalogueEditor = () => {
  const navigate = useNavigate();
  const { catalogue, updateCatalogue } = useLandingPageStore();

  const [formData, setFormData] = useState({
    badge: catalogue?.badge || 'Catalogue Portfolio',
    title: catalogue?.title || 'Explore Our Digital Catalogue',
    subtitle: catalogue?.subtitle || 'Flip through our verified selection of commercial components, IT infrastructure assets, corporate categories, and service capabilities.',
    pdfUrl: catalogue?.pdfUrl || '/catalogue/PLE-Catalogue.pdf',
    videoUrl: catalogue?.videoUrl || '/PLE_2026_Catalogue_Book_Slow_Pages.mp4',
    status: catalogue?.status ?? true
  });

  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.pdf')) {
      toast.error('Please upload a valid PDF file');
      return;
    }

    setIsUploadingPdf(true);
    try {
      const res = await uploadAdminMedia(file, 'catalogue');
      const url = res?.data?.url;
      if (url) {
        setFormData((prev) => ({ ...prev, pdfUrl: url }));
        toast.success('Catalogue PDF uploaded successfully!');
      } else {
        toast.error('Failed to get uploaded file URL');
      }
    } catch (err) {
      toast.error('Failed to upload PDF file');
    } finally {
      setIsUploadingPdf(false);
      e.target.value = '';
    }
  };

  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type?.startsWith('video/')) {
      toast.error('Please upload a valid video file');
      return;
    }

    setIsUploadingVideo(true);
    try {
      const res = await uploadAdminMedia(file, 'catalogue_videos');
      const url = res?.data?.url;
      if (url) {
        setFormData((prev) => ({ ...prev, videoUrl: url }));
        toast.success('Fallback video uploaded successfully!');
      } else {
        toast.error('Failed to get uploaded video URL');
      }
    } catch (err) {
      toast.error('Failed to upload video');
    } finally {
      setIsUploadingVideo(false);
      e.target.value = '';
    }
  };

  const handleSave = () => {
    updateCatalogue(formData);
    toast.success('Digital Catalogue settings updated successfully!');
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
            <h1 className="text-xl font-bold text-gray-900">Digital Catalogue Editor</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage the interactive flipbook PDF, video fallback, and header copy.</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#C07A3D] text-white rounded-lg hover:bg-[#a6642d] transition text-sm font-semibold shadow-sm"
        >
          <FiSave />
          Save Changes
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5 shadow-sm">
        <h2 className="text-xs font-bold text-[#C07A3D] uppercase tracking-wider">
          Header Copy
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Badge Text</label>
            <input
              type="text"
              name="badge"
              value={formData.badge}
              onChange={handleChange}
              className="w-full text-sm border border-gray-200 rounded-lg p-2.5 outline-none focus:border-[#C07A3D]"
              placeholder="e.g. Catalogue Portfolio"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Section Heading</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="w-full text-sm border border-gray-200 rounded-lg p-2.5 outline-none focus:border-[#C07A3D]"
              placeholder="e.g. Explore Our Digital Catalogue"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Subtitle / Description</label>
          <textarea
            rows="2"
            name="subtitle"
            value={formData.subtitle}
            onChange={handleChange}
            className="w-full text-sm border border-gray-200 rounded-lg p-2.5 outline-none focus:border-[#C07A3D]"
            placeholder="Description of the catalogue"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-6 shadow-sm">
        <h2 className="text-xs font-bold text-[#C07A3D] uppercase tracking-wider flex items-center gap-2">
          <FiBookOpen /> PDF & Media Configuration
        </h2>

        {/* PDF File */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-500 uppercase">
            Catalogue PDF URL / File
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              name="pdfUrl"
              value={formData.pdfUrl}
              onChange={handleChange}
              className="flex-1 text-sm border border-gray-200 rounded-lg p-2.5 outline-none focus:border-[#C07A3D]"
              placeholder="/catalogue/PLE-Catalogue.pdf or https://..."
            />
            <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg cursor-pointer transition text-xs font-bold">
              <FiUpload /> {isUploadingPdf ? 'Uploading...' : 'Upload PDF'}
              <input
                type="file"
                accept=".pdf"
                onChange={handlePdfUpload}
                disabled={isUploadingPdf}
                className="hidden"
              />
            </label>
          </div>
          <p className="text-[11px] text-gray-400">The PDF is rendered inside the 3D realistic flipbook reader.</p>
        </div>

        {/* Video Fallback File */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-500 uppercase">
            Fallback Video URL / File
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              name="videoUrl"
              value={formData.videoUrl}
              onChange={handleChange}
              className="flex-1 text-sm border border-gray-200 rounded-lg p-2.5 outline-none focus:border-[#C07A3D]"
              placeholder="/PLE_2026_Catalogue_Book_Slow_Pages.mp4 or https://..."
            />
            <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg cursor-pointer transition text-xs font-bold">
              <FiVideo /> {isUploadingVideo ? 'Uploading...' : 'Upload Video'}
              <input
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                disabled={isUploadingVideo}
                className="hidden"
              />
            </label>
          </div>
          <p className="text-[11px] text-gray-400">Rendered if the user browser or mobile fails to load the interactive PDF reader.</p>
        </div>

        {/* Active Toggle */}
        <div className="pt-2 flex items-center gap-3">
          <input
            type="checkbox"
            id="status"
            name="status"
            checked={formData.status}
            onChange={handleChange}
            className="w-4 h-4 accent-[#C07A3D] rounded cursor-pointer"
          />
          <label htmlFor="status" className="text-sm font-semibold text-gray-700 cursor-pointer">
            Section Enabled on Landing Page
          </label>
        </div>
      </div>
    </motion.div>
  );
};

export default CatalogueEditor;
