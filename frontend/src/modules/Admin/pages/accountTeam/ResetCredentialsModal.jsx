import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiX, FiLock, FiKey, FiEye, FiEyeOff, FiCheck, FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { resetAccountTeamCredentials } from '../../services/adminService';

const generateSecret = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$';
  let res = 'PLE#';
  for (let i = 0; i < 4; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
  return res;
};

const ResetCredentialsModal = ({ isOpen, onClose, member, onSuccess }) => {
  const [newPassword, setNewPassword] = useState('');
  const [newPersonalSecret, setNewPersonalSecret] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen || !member) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword && !newPersonalSecret) {
      toast.error('Please enter at least a new password or a new personal secret code');
      return;
    }

    if (newPassword && newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (newPersonalSecret && newPersonalSecret.length < 4) {
      toast.error('Personal secret code must be at least 4 characters');
      return;
    }

    setLoading(true);
    try {
      await resetAccountTeamCredentials(member._id || member.id, {
        newPassword: newPassword || undefined,
        newPersonalSecret: newPersonalSecret || undefined,
      });

      toast.success(`Credentials reset for ${member.name}`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to reset credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-white dark:bg-[#16161A] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden text-gray-900 dark:text-gray-100 transition-colors"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#121216]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#D71920]/10 text-[#D71920]">
              <FiKey size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Reset Identity Credentials</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">{member.name} · {member.identityId || member.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white">
            <FiX size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Update credentials for this team member. Leave any field blank if you do not wish to change it.
          </p>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              New Domain Password
            </label>
            <div className="relative">
              <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Leave blank to keep current"
                className="w-full pl-9 pr-9 py-2 bg-gray-50 dark:bg-[#121216] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-xs font-mono focus:outline-none focus:border-[#D71920] transition-colors"
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

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                New Personal Secret Code
              </label>
              <button
                type="button"
                onClick={() => setNewPersonalSecret(generateSecret())}
                className="text-[11px] text-[#D71920] hover:text-[#B51218] flex items-center gap-1 font-semibold"
              >
                <FiRefreshCw size={10} />
                <span>Generate</span>
              </button>
            </div>
            <div className="relative">
              <FiKey className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type={showSecret ? 'text' : 'password'}
                value={newPersonalSecret}
                onChange={(e) => setNewPersonalSecret(e.target.value)}
                placeholder="Leave blank to keep current"
                className="w-full pl-9 pr-9 py-2 bg-gray-50 dark:bg-[#121216] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-xs font-mono focus:outline-none focus:border-[#D71920] transition-colors"
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

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200 dark:border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-[#D71920] hover:bg-[#B51218] text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 shadow-xs"
            >
              {loading ? 'Saving...' : 'Update Credentials'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default ResetCredentialsModal;
