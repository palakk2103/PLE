import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiSave, FiArrowLeft, FiPlus, FiTrash, FiUpload, FiLoader } from 'react-icons/fi';
import { useLandingPageStore } from '../../store/landingPageStore';
import { uploadAdminMedia } from '../../services/adminService';
import toast from 'react-hot-toast';

const HeroEditor = () => {
  const navigate = useNavigate();
  const { hero, updateHero } = useLandingPageStore();

  const [formData, setFormData] = useState({
    tagline: hero.tagline || '',
    heading: hero.heading || '',
    subheading: hero.subheading || '',
    description: hero.description || '',
    primaryBtnText: hero.primaryBtnText || '',
    primaryBtnLink: hero.primaryBtnLink || '',
    secondaryBtnText: hero.secondaryBtnText || '',
    secondaryBtnLink: hero.secondaryBtnLink || '',
    videoBackground: hero.videoBackground || '',
    imageFallback: hero.imageFallback || '',
  });

  const [phraseInput, setPhraseInput] = useState('');
  const [rotatingPhrases, setRotatingPhrases] = useState(hero.rotatingPhrases || []);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type?.startsWith('video/')) {
      toast.error('Please select a valid video file');
      return;
    }

    setIsUploadingVideo(true);
    try {
      const response = await uploadAdminMedia(file, 'hero_videos');
      const url = response?.data?.url;
      if (!url) {
        toast.error('Video upload failed');
        return;
      }
      setFormData((prev) => ({ ...prev, videoBackground: url }));
      toast.success('Video uploaded successfully');
    } catch (error) {
      toast.error('Video upload failed');
    } finally {
      setIsUploadingVideo(false);
      e.target.value = '';
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type?.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    setIsUploadingImage(true);
    try {
      const response = await uploadAdminMedia(file, 'hero_images');
      const url = response?.data?.url;
      if (!url) {
        toast.error('Image upload failed');
        return;
      }
      setFormData((prev) => ({ ...prev, imageFallback: url }));
      toast.success('Image uploaded successfully');
    } catch (error) {
      toast.error('Image upload failed');
    } finally {
      setIsUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleAddPhrase = () => {
    if (phraseInput.trim() && !rotatingPhrases.includes(phraseInput.trim())) {
      setRotatingPhrases((prev) => [...prev, phraseInput.trim()]);
      setPhraseInput('');
    }
  };

  const handleRemovePhrase = (phrase) => {
    setRotatingPhrases((prev) => prev.filter((p) => p !== phrase));
  };

  const handleSave = () => {
    updateHero({
      ...formData,
      rotatingPhrases
    });
    toast.success('Hero section updated successfully!');
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
            <h1 className="text-xl font-bold text-gray-900">Edit Hero Section</h1>
            <p className="text-xs text-gray-500 mt-0.5">Customize the main hero title, description, buttons, and animations.</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-2">Main Content</h2>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tagline</label>
            <input
              type="text"
              name="tagline"
              value={formData.tagline}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Heading</label>
            <input
              type="text"
              name="heading"
              value={formData.heading}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Subheading</label>
            <textarea
              name="subheading"
              value={formData.subheading}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description Paragraph</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-2">Call to Action Buttons</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Primary CTA Text</label>
                <input
                  type="text"
                  name="primaryBtnText"
                  value={formData.primaryBtnText}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Primary Link</label>
                <input
                  type="text"
                  name="primaryBtnLink"
                  value={formData.primaryBtnLink}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Secondary CTA Text</label>
                <input
                  type="text"
                  name="secondaryBtnText"
                  value={formData.secondaryBtnText}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Secondary Link</label>
                <input
                  type="text"
                  name="secondaryBtnLink"
                  value={formData.secondaryBtnLink}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-2">Assets & Animations</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Video BG URL/Path</label>
                <input
                  type="text"
                  name="videoBackground"
                  value={formData.videoBackground}
                  onChange={handleChange}
                  placeholder="e.g. /hero-video.mp4"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D] mb-2"
                />
                <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer text-xs font-semibold">
                  {isUploadingVideo ? <FiLoader className="animate-spin" /> : <FiUpload />}
                  {isUploadingVideo ? 'Uploading...' : 'Upload Video'}
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleVideoUpload}
                    className="hidden"
                    disabled={isUploadingVideo}
                  />
                </label>
                {formData.videoBackground && (
                  <div className="mt-2 text-xs text-gray-500 truncate max-w-full">
                    <span className="font-semibold">Current:</span> <span className="underline">{formData.videoBackground}</span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Image Fallback Path</label>
                <input
                  type="text"
                  name="imageFallback"
                  value={formData.imageFallback}
                  onChange={handleChange}
                  placeholder="e.g. /hero_modern.png"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D] mb-2"
                />
                <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer text-xs font-semibold">
                  {isUploadingImage ? <FiLoader className="animate-spin" /> : <FiUpload />}
                  {isUploadingImage ? 'Uploading...' : 'Upload Image'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={isUploadingImage}
                  />
                </label>
                {formData.imageFallback && (
                  <div className="mt-2">
                    <img
                      src={formData.imageFallback}
                      alt="Preview"
                      className="h-16 w-full object-cover rounded-lg border border-gray-200"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Rotating Phrases</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={phraseInput}
                  onChange={(e) => setPhraseInput(e.target.value)}
                  placeholder="e.g. Daily Deals"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
                />
                <button
                  onClick={handleAddPhrase}
                  className="px-3 py-2 bg-[#C07A3D] text-white rounded-lg hover:bg-[#a6642d]"
                >
                  <FiPlus />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {rotatingPhrases.map((phrase, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-full"
                  >
                    {phrase}
                    <button
                      type="button"
                      onClick={() => handleRemovePhrase(phrase)}
                      className="text-amber-500 hover:text-amber-700"
                    >
                      <FiTrash size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default HeroEditor;

