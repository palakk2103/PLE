import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiSave, FiArrowLeft, FiGlobe, FiFacebook, FiInstagram, FiLinkedin, FiYoutube } from 'react-icons/fi';
import { useLandingPageStore } from '../../store/landingPageStore';
import toast from 'react-hot-toast';

const FooterEditor = () => {
  const navigate = useNavigate();
  const { footer, social, ctaBanner, updateFooter, updateSocial, updateCtaBanner } = useLandingPageStore();

  const [footerText, setFooterText] = useState(footer.text || '');
  const [footerCopyright, setFooterCopyright] = useState(footer.copyright || '');
  
  const [socials, setSocials] = useState({
    facebook: social.facebook || '',
    instagram: social.instagram || '',
    linkedin: social.linkedin || '',
    youtube: social.youtube || '',
  });

  const [ctaData, setCtaData] = useState({
    heading: ctaBanner.heading || '',
    description: ctaBanner.description || '',
    primaryBtnText: ctaBanner.primaryBtnText || '',
    primaryBtnLink: ctaBanner.primaryBtnLink || '',
    secondaryBtnText: ctaBanner.secondaryBtnText || '',
    secondaryBtnLink: ctaBanner.secondaryBtnLink || '',
  });

  const handleSocialChange = (e) => {
    const { name, value } = e.target;
    setSocials((prev) => ({ ...prev, [name]: value }));
  };

  const handleCtaChange = (e) => {
    const { name, value } = e.target;
    setCtaData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    updateFooter({ text: footerText, copyright: footerCopyright });
    updateSocial(socials);
    updateCtaBanner(ctaData);
    toast.success('Footer and CTA Banner updated successfully!');
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
            <h1 className="text-xl font-bold text-gray-900">Footer & CTA Banner Editor</h1>
            <p className="text-xs text-gray-500 mt-0.5">Customize the footer description, social media profiles, and call-to-action banner.</p>
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
        {/* Footer & Socials Card */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm h-fit">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-2 flex items-center gap-2">
            <FiGlobe className="text-[#C07A3D]" /> Footer & Social Profiles
          </h2>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Footer Main Text</label>
            <textarea
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Copyright Line</label>
            <input
              type="text"
              value={footerCopyright}
              onChange={(e) => setFooterCopyright(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>

          <div className="border-t border-gray-50 pt-4 space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-1">Social Media Links</h3>
            
            <div className="flex items-center gap-2">
              <span className="p-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-600"><FiFacebook /></span>
              <input
                type="text"
                name="facebook"
                placeholder="Facebook profile URL"
                value={socials.facebook}
                onChange={handleSocialChange}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="p-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-600"><FiInstagram /></span>
              <input
                type="text"
                name="instagram"
                placeholder="Instagram profile URL"
                value={socials.instagram}
                onChange={handleSocialChange}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="p-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-600"><FiLinkedin /></span>
              <input
                type="text"
                name="linkedin"
                placeholder="LinkedIn profile URL"
                value={socials.linkedin}
                onChange={handleSocialChange}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="p-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-600"><FiYoutube /></span>
              <input
                type="text"
                name="youtube"
                placeholder="YouTube channel URL"
                value={socials.youtube}
                onChange={handleSocialChange}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
              />
            </div>
          </div>
        </div>

        {/* CTA Banner Card */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm h-fit">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-2 flex items-center gap-2">
            <FiGlobe className="text-[#C07A3D]" /> CTA Banner Details
          </h2>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Banner Heading</label>
            <input
              type="text"
              name="heading"
              value={ctaData.heading}
              onChange={handleCtaChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description Paragraph</label>
            <textarea
              name="description"
              value={ctaData.description}
              onChange={handleCtaChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Primary CTA Button</label>
              <input
                type="text"
                name="primaryBtnText"
                value={ctaData.primaryBtnText}
                onChange={handleCtaChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Primary Link</label>
              <input
                type="text"
                name="primaryBtnLink"
                value={ctaData.primaryBtnLink}
                onChange={handleCtaChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Secondary CTA Button</label>
              <input
                type="text"
                name="secondaryBtnText"
                value={ctaData.secondaryBtnText}
                onChange={handleCtaChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Secondary Link</label>
              <input
                type="text"
                name="secondaryBtnLink"
                value={ctaData.secondaryBtnLink}
                onChange={handleCtaChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default FooterEditor;
