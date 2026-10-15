import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiSave, FiArrowLeft, FiPlus, FiTrash, FiMapPin, FiPhone } from 'react-icons/fi';
import { useLandingPageStore } from '../../store/landingPageStore';
import toast from 'react-hot-toast';

const ContactEditor = () => {
  const navigate = useNavigate();
  const { contact, presenceMap, updateContact, updatePresenceMap } = useLandingPageStore();

  const [contactData, setContactData] = useState({
    phone: contact.phone || '',
    phoneDisplay: contact.phoneDisplay || '',
    email: contact.email || '',
    hours: contact.hours || '',
    cin: contact.cin || '',
    registration: contact.registration || '',
    copyright: contact.copyright || '',
  });

  const [mapHeading, setMapHeading] = useState(presenceMap.heading || 'Our Presence');
  const [mapDescription, setMapDescription] = useState(presenceMap.description || '');
  const [pins, setPins] = useState(presenceMap.locations || []);
  const [newPin, setNewPin] = useState({ name: '', top: '50%', left: '50%' });

  const handleContactChange = (e) => {
    const { name, value } = e.target;
    setContactData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddPin = () => {
    if (newPin.name.trim()) {
      setPins((prev) => [...prev, { ...newPin }]);
      setNewPin({ name: '', top: '50%', left: '50%' });
    } else {
      toast.error('Location/State name is required!');
    }
  };

  const handleRemovePin = (idx) => {
    setPins((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    updateContact(contactData);
    updatePresenceMap({
      heading: mapHeading,
      description: mapDescription,
      locations: pins,
    });
    toast.success('Contact information and Presence Map saved successfully!');
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
            <h1 className="text-xl font-bold text-gray-900">Contact & Locations</h1>
            <p className="text-xs text-gray-500 mt-0.5">Customize global contact numbers, email address, hours, registration IDs, and Presence Map pins.</p>
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
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm h-fit">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-2 flex items-center gap-2">
            <FiPhone className="text-[#C07A3D]" /> Global Contact Info
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phone Number</label>
              <input
                type="text"
                name="phone"
                value={contactData.phone}
                onChange={handleContactChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phone Display Text</label>
              <input
                type="text"
                name="phoneDisplay"
                value={contactData.phoneDisplay}
                onChange={handleContactChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email Address</label>
            <input
              type="email"
              name="email"
              value={contactData.email}
              onChange={handleContactChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Working Hours Description</label>
            <input
              type="text"
              name="hours"
              value={contactData.hours}
              onChange={handleContactChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Corporate Registration ID (CIN)</label>
            <input
              type="text"
              name="cin"
              value={contactData.cin}
              onChange={handleContactChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Company Registration Text</label>
            <input
              type="text"
              name="registration"
              value={contactData.registration}
              onChange={handleContactChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Global Copyright Footer Text</label>
            <input
              type="text"
              name="copyright"
              value={contactData.copyright}
              onChange={handleContactChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-2 flex items-center gap-2">
              <FiMapPin className="text-[#C07A3D]" /> Presence Map Configuration
            </h2>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Map Heading</label>
              <input
                type="text"
                value={mapHeading}
                onChange={(e) => setMapHeading(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Map Description</label>
              <textarea
                value={mapDescription}
                onChange={(e) => setMapDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C07A3D]"
              />
            </div>

            <div className="border-t border-gray-50 pt-4">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Location Pins (India Map Coordinates)</label>
              
              <div className="space-y-2">
                {pins.map((pin, idx) => (
                  <div key={idx} className="flex gap-2 items-center bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                    <span className="text-xs font-bold text-gray-700 flex-1">{pin.name}</span>
                    <span className="text-[10px] text-gray-400 font-mono">T: {pin.top} | L: {pin.left}</span>
                    <button
                      onClick={() => handleRemovePin(idx)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <FiTrash size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-4 bg-amber-50/40 p-3 rounded-lg border border-amber-100/50 space-y-2">
                <input
                  type="text"
                  placeholder="State/Location Name (e.g. Maharashtra)"
                  value={newPin.name}
                  onChange={(e) => setNewPin((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#C07A3D]"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Top position % (e.g. 50%)"
                    value={newPin.top}
                    onChange={(e) => setNewPin((p) => ({ ...p, top: e.target.value }))}
                    className="flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Left position % (e.g. 45%)"
                    value={newPin.left}
                    onChange={(e) => setNewPin((p) => ({ ...p, left: e.target.value }))}
                    className="flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none"
                  />
                  <button
                    onClick={handleAddPin}
                    className="px-3 py-1.5 bg-[#C07A3D] text-white rounded-lg text-xs font-semibold hover:bg-[#a6642d]"
                  >
                    Add Pin
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ContactEditor;
