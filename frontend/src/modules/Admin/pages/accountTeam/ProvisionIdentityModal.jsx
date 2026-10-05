import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiX,
  FiUserCheck,
  FiMail,
  FiPhone,
  FiBriefcase,
  FiCalendar,
  FiLock,
  FiKey,
  FiRefreshCw,
  FiCopy,
  FiCheck,
  FiEye,
  FiEyeOff,
  FiAlertCircle
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { getNextIdentityId, provisionAccountTeamMember } from '../../services/adminService';

const IDENTITY_CLASSES = [
  { id: 'employee', label: 'Employee', prefix: 'PLE-EMP-', desc: 'Full-time / regular team personnel' },
  { id: 'director', label: 'Director', prefix: 'PLE-DIR-', desc: 'Executive leadership & directors' },
  { id: 'consultant', label: 'Consultant', prefix: 'PLE-CON-', desc: 'External advisory & specialized staff' },
  { id: 'intern', label: 'Intern', prefix: 'PLE-INT-', desc: 'Trainees & seasonal interns' },
];

const CONTRACT_TYPES = ['Full-Time', 'Part-Time', 'Contract', 'Internship'];

const COMMON_DEPARTMENTS = [
  'PLE Finance',
  'PLE Operations',
  'PLE Catalog & Products',
  'PLE Order Management',
  'PLE Vendor Relations',
  'PLE Logistics & Fulfillment',
  'PLE Customer Support',
  'PLE Quality & Moderation'
];

const generateRandomSecret = (length = 8) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$';
  let res = 'PLE#';
  for (let i = 0; i < length - 4; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
};

const generateRandomPassword = (length = 10) => {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789@#$';
  let res = '';
  for (let i = 0; i < length; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res + '!';
};

const ProvisionIdentityModal = ({ isOpen, onClose, onMemberCreated }) => {
  const [loading, setLoading] = useState(false);
  const [fetchingNextId, setFetchingNextId] = useState(false);
  const [nextIdPreview, setNextIdPreview] = useState('PLE-EMP-...');

  const [formData, setFormData] = useState({
    identityClass: 'employee',
    identityId: '',
    name: '',
    email: '',
    phone: '',
    department: 'PLE Finance',
    designation: 'Account Executive',
    contractType: 'Full-Time',
    joiningDate: new Date().toISOString().split('T')[0],
    personalSecret: '',
    initialPassword: '',
  });

  const [showSecret, setShowSecret] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [createdSummary, setCreatedSummary] = useState(null);
  const [copied, setCopied] = useState(false);

  // Fetch next suggested ID when identityClass changes or modal opens
  useEffect(() => {
    if (!isOpen) {
      setCreatedSummary(null);
      return;
    }

    const fetchNextId = async () => {
      setFetchingNextId(true);
      try {
        const res = await getNextIdentityId(formData.identityClass);
        const nextId = res?.data?.nextId || res?.nextId;
        if (nextId) {
          setNextIdPreview(nextId);
          // If admin hasn't typed a custom ID yet, populate with suggested ID
          setFormData((prev) => {
            if (!prev.identityId || prev.identityId.startsWith('PLE-')) {
              return { ...prev, identityId: nextId };
            }
            return prev;
          });
        }
      } catch (err) {
        console.warn('Could not fetch next ID preview:', err);
      } finally {
        setFetchingNextId(false);
      }
    };

    fetchNextId();
  }, [isOpen, formData.identityClass]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleGenerateCredentials = () => {
    setFormData((prev) => ({
      ...prev,
      personalSecret: generateRandomSecret(8),
      initialPassword: generateRandomPassword(10),
    }));
    toast.success('Generated secure temporary credentials');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.identityId.trim()) return toast.error('Identity ID is required');
    if (!formData.name.trim()) return toast.error('Full Name is required');
    if (!formData.email.trim()) return toast.error('Corporate Email is required');
    if (!formData.department.trim()) return toast.error('Department is required');
    if (!formData.designation.trim()) return toast.error('Designation is required');
    if (!formData.personalSecret.trim() || formData.personalSecret.length < 4) {
      return toast.error('Personal Secret Code must be at least 4 characters');
    }
    if (!formData.initialPassword || formData.initialPassword.length < 6) {
      return toast.error('Initial Domain Password must be at least 6 characters');
    }

    setLoading(true);
    try {
      const res = await provisionAccountTeamMember({
        ...formData,
        identityId: formData.identityId.trim().toUpperCase(),
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
      });

      const member = res?.data || res;
      setCreatedSummary({
        identityId: member?.identityId || formData.identityId.trim().toUpperCase() || nextIdPreview,
        name: formData.name,
        email: formData.email,
        department: formData.department,
        designation: formData.designation,
        personalSecret: formData.personalSecret,
        initialPassword: formData.initialPassword,
      });

      toast.success(`Identity ${member?.identityId || formData.identityId} provisioned!`);
      if (onMemberCreated) onMemberCreated(member);
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to provision identity');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdSummary) return;
    const text = `PLE ORGANIZATIONAL IDENTITY CREDENTIALS
Identity ID: ${createdSummary.identityId}
Name: ${createdSummary.name}
Corporate Email: ${createdSummary.email}
Department: ${createdSummary.department} (${createdSummary.designation})
Initial Domain Password: ${createdSummary.initialPassword}
Personal Secret Code: ${createdSummary.personalSecret}
Login URL: ${window.location.origin}/admin/login`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Credentials copied to clipboard');
    setTimeout(() => setCopied(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl bg-white dark:bg-[#16161A] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden my-6 text-gray-900 dark:text-gray-100 transition-colors"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#121216]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D71920] to-[#E53E3E] flex items-center justify-center text-white shadow-md">
              <FiUserCheck size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                Provision Organizational Identity
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Issue personal identity & credentials for internal Account Team member
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Modal Body */}
        {createdSummary ? (
          // Success State View
          <div className="p-6 space-y-5">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl flex items-start gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-lg">
                <FiCheck size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                  Organizational Identity Provisioned Successfully
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                  The team member has been granted access to the Admin Dashboard under individual audit tracking.
                </p>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-[#121216] p-4 rounded-xl border border-gray-200 dark:border-white/10 space-y-3 text-xs sm:text-sm font-mono">
              <div className="flex justify-between border-b border-gray-200 dark:border-white/5 pb-2">
                <span className="text-gray-500 dark:text-gray-400">Identity ID:</span>
                <span className="font-bold text-base text-[#D71920]">
                  {createdSummary.identityId}
                </span>
              </div>
              <div className="flex justify-between border-b border-gray-200 dark:border-white/5 pb-2">
                <span className="text-gray-500 dark:text-gray-400">Member Name:</span>
                <span className="text-gray-900 dark:text-white font-medium">{createdSummary.name}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 dark:border-white/5 pb-2">
                <span className="text-gray-500 dark:text-gray-400">Corporate Email:</span>
                <span className="text-gray-900 dark:text-white font-medium">{createdSummary.email}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 dark:border-white/5 pb-2">
                <span className="text-gray-500 dark:text-gray-400">Department & Role:</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {createdSummary.department} · {createdSummary.designation}
                </span>
              </div>
              <div className="flex justify-between border-b border-gray-200 dark:border-white/5 pb-2 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded">
                <span className="text-amber-800 dark:text-amber-400 font-semibold">Initial Domain Password:</span>
                <span className="text-amber-900 dark:text-amber-300 font-bold">{createdSummary.initialPassword}</span>
              </div>
              <div className="flex justify-between bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded">
                <span className="text-amber-800 dark:text-amber-400 font-semibold">Personal Secret Code:</span>
                <span className="text-amber-900 dark:text-amber-300 font-bold">{createdSummary.personalSecret}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-amber-50/70 dark:bg-[#121216]/60 rounded-xl text-xs text-amber-800 dark:text-gray-400 border border-amber-200 dark:border-amber-500/20">
              <FiAlertCircle className="text-[#D71920] flex-shrink-0" size={16} />
              <span>
                Please securely relay these credentials to the individual. Personal secret codes are hashed and cannot be viewed again.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200 dark:border-white/10">
              <button
                type="button"
                onClick={handleCopyCredentials}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/15 text-gray-800 dark:text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 border border-gray-200 dark:border-white/10"
              >
                {copied ? <FiCheck className="text-emerald-500" /> : <FiCopy />}
                <span>{copied ? 'Copied All' : 'Copy All Credentials'}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 bg-[#D71920] hover:bg-[#B51218] text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          // Form View
          <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto scrollbar-admin">
            {/* SECTION 1: ORGANIZATIONAL IDENTITY CLASS */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-[#D71920] uppercase tracking-wider">
                  Section 1 · Organizational Identity Class
                </label>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                  {fetchingNextId ? 'Generating...' : `Next ID: ${nextIdPreview}`}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {IDENTITY_CLASSES.map((cls) => {
                  const isSelected = formData.identityClass === cls.id;
                  return (
                    <button
                      type="button"
                      key={cls.id}
                      onClick={() => setFormData((p) => ({ ...p, identityClass: cls.id }))}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-[#D71920] bg-red-50 dark:bg-[#D71920]/15 text-[#D71920] dark:text-white shadow-xs font-semibold'
                          : 'border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#121216] text-gray-700 dark:text-gray-400 hover:border-gray-300 dark:hover:border-white/20'
                      }`}
                    >
                      <div className="font-semibold text-xs">{cls.label}</div>
                      <div className="text-[10px] font-mono text-[#D71920] mt-0.5">{cls.prefix}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SECTION 2: IDENTITY IDENTIFICATION & CONTACT */}
            <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-white/5">
              <label className="text-xs font-bold text-[#D71920] uppercase tracking-wider block">
                Section 2 · Identity Identification & Contact
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Identity ID (Editable by Admin) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Identity ID <span className="text-[#D71920]">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, identityId: nextIdPreview }))}
                      className="text-[10px] text-[#D71920] hover:underline font-mono flex items-center gap-1 cursor-pointer"
                      title="Auto-fill suggested ID"
                    >
                      <FiRefreshCw className={`w-2.5 h-2.5 ${fetchingNextId ? 'animate-spin' : ''}`} />
                      <span>Use: {nextIdPreview}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      name="identityId"
                      value={formData.identityId}
                      onChange={handleChange}
                      placeholder={nextIdPreview || 'e.g. PLE-EMP-000001'}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-[#121216] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white font-mono text-xs font-medium focus:outline-none focus:border-[#D71920] uppercase transition-colors"
                      required
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                    Admin custom ID daal sakta hai (jaise PLE-EMP-001 ya apni pasand ki ID)
                  </p>
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Full Name <span className="text-[#D71920]">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#121216] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-xs focus:outline-none focus:border-[#D71920] transition-colors"
                    required
                  />
                </div>

                {/* Corporate Email */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Core Corporate Email <span className="text-[#D71920]">*</span>
                  </label>
                  <div className="relative">
                    <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="rahul.sharma@ple.internal"
                      className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-[#121216] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-xs focus:outline-none focus:border-[#D71920] transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
                  <div className="relative">
                    <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+91 98765 43210"
                      className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-[#121216] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-xs focus:outline-none focus:border-[#D71920] transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 3: ORGANIZATION & DESIGNATION */}
            <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-white/5">
              <label className="text-xs font-bold text-[#D71920] uppercase tracking-wider block">
                Section 3 · Organization & Designation
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Department */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Department <span className="text-[#D71920]">*</span>
                  </label>
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#121216] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-xs focus:outline-none focus:border-[#D71920] transition-colors"
                  >
                    {COMMON_DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept} className="bg-white dark:bg-[#121216] text-gray-900 dark:text-white">
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Designation */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Designation <span className="text-[#D71920]">*</span>
                  </label>
                  <input
                    type="text"
                    name="designation"
                    value={formData.designation}
                    onChange={handleChange}
                    placeholder="e.g. Account Executive"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#121216] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-xs focus:outline-none focus:border-[#D71920] transition-colors"
                    required
                  />
                </div>

                {/* RBAC Role */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">RBAC System Role</label>
                  <input
                    type="text"
                    disabled
                    value="ACCOUNT_TEAM (Standard Admin Operational Access)"
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-[#121216] border border-gray-200 dark:border-white/10 rounded-xl text-gray-500 dark:text-gray-400 text-xs cursor-not-allowed opacity-80"
                  />
                </div>

                {/* Contract Type */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Contract Type</label>
                  <select
                    name="contractType"
                    value={formData.contractType}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#121216] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-xs focus:outline-none focus:border-[#D71920] transition-colors"
                  >
                    {CONTRACT_TYPES.map((type) => (
                      <option key={type} value={type} className="bg-white dark:bg-[#121216] text-gray-900 dark:text-white">
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Joining Date */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Joining Date</label>
                  <div className="relative">
                    <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="date"
                      name="joiningDate"
                      value={formData.joiningDate}
                      onChange={handleChange}
                      className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-[#121216] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-xs focus:outline-none focus:border-[#D71920] transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 4: AUTHENTICATION CREDENTIALS */}
            <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-white/5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#D71920] uppercase tracking-wider">
                  Section 4 · Authentication Credentials
                </label>
                <button
                  type="button"
                  onClick={handleGenerateCredentials}
                  className="text-[11px] text-[#D71920] hover:text-[#B51218] flex items-center gap-1 font-semibold"
                >
                  <FiRefreshCw size={12} />
                  <span>Auto-generate Secure Credentials</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Initial Domain Password */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Initial Domain Password <span className="text-[#D71920]">*</span>
                  </label>
                  <div className="relative">
                    <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="initialPassword"
                      value={formData.initialPassword}
                      onChange={handleChange}
                      placeholder="Min 6 characters"
                      className="w-full pl-9 pr-9 py-2 bg-gray-50 dark:bg-[#121216] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-xs font-mono focus:outline-none focus:border-[#D71920] transition-colors"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-white"
                    >
                      {showPassword ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                    </button>
                  </div>
                </div>

                {/* Personal Secret Code */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Personal Secret Code <span className="text-[#D71920]">*</span>
                  </label>
                  <div className="relative">
                    <FiKey className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type={showSecret ? 'text' : 'password'}
                      name="personalSecret"
                      value={formData.personalSecret}
                      onChange={handleChange}
                      placeholder="e.g. PLE#Sec88"
                      className="w-full pl-9 pr-9 py-2 bg-gray-50 dark:bg-[#121216] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-xs font-mono focus:outline-none focus:border-[#D71920] transition-colors"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-white"
                    >
                      {showSecret ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-white/10">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 rounded-xl text-xs sm:text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-[#D71920] hover:bg-[#B51218] text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-2 active:scale-95"
              >
                {loading ? (
                  <span>Provisioning Identity...</span>
                ) : (
                  <>
                    <FiUserCheck size={16} />
                    <span>Provision Organizational Identity</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default ProvisionIdentityModal;
