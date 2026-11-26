import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { FiArrowLeft, FiEye, FiEyeOff, FiLock } from 'react-icons/fi';
import toast from 'react-hot-toast';
import MobileLayout from '../components/Layout/MobileLayout';
import AuthSplitLayout from '../components/Auth/AuthSplitLayout';
import PageTransition from '../../../shared/components/PageTransition';
import { useAuthStore } from '../../../shared/store/authStore';

const MobileResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { resetPassword, isLoading } = useAuthStore();

  const email = location.state?.email || searchParams.get('email') || '';
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error('Session expired. Please start forgot password again.');
      navigate('/forgot-password', { replace: true });
      return;
    }
    if (!formData.password || !formData.confirmPassword) {
      toast.error('Please fill both password fields.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    try {
      await resetPassword(email, formData.password, formData.confirmPassword);
      toast.success('Password reset successful. Please login.');
      navigate('/login', { replace: true });
    } catch {
      // Global API interceptor shows toast
    }
  };

  return (
    <PageTransition>
      <MobileLayout showBottomNav={false} showCartBar={false}>
        <AuthSplitLayout>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 lg:p-10 shadow-sm lg:shadow-xl border dark:border-zinc-800 transition-colors duration-500">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-50 mb-2">Reset Password</h1>
                <p className="text-sm text-gray-600 dark:text-zinc-400">
                  Set a new password for <span className="font-medium text-gray-900 dark:text-zinc-300">{email || 'your account'}</span>
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">New Password</label>
                  <div className="relative">
                    <FiLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder="Enter new password"
                      className="w-full pl-12 pr-12 py-3 rounded-xl border-2 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white border-gray-200 dark:border-zinc-800 focus:border-[#AE020B] dark:focus:border-[#AE020B] focus:outline-none transition-colors text-base"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
                    >
                      {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">Confirm Password</label>
                  <div className="relative">
                    <FiLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Confirm new password"
                      className="w-full pl-12 pr-12 py-3 rounded-xl border-2 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white border-gray-200 dark:border-zinc-800 focus:border-[#AE020B] dark:focus:border-[#AE020B] focus:outline-none transition-colors text-base"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
                    >
                      {showConfirmPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#AE020B] hover:bg-[#8d0208] text-white py-3.5 rounded-xl font-semibold text-base transition-all duration-300 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>

              <div className="text-center pt-6">
                <Link to="/login" className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-white font-medium">
                  <FiArrowLeft />
                  Back to Login
                </Link>
              </div>
            </div>
        </AuthSplitLayout>
      </MobileLayout>
    </PageTransition>
  );
};

export default MobileResetPassword;
