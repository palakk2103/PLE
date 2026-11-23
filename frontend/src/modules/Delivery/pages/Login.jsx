import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { FiMail, FiLock, FiEye, FiEyeOff, FiTruck, FiArrowLeft } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useDeliveryAuthStore } from '../store/deliveryStore';
import toast from 'react-hot-toast';
import PageTransition from '../../../shared/components/PageTransition';
import TwoFactorVerify from '../../../shared/components/TwoFactorVerify';

const DeliveryLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isLoading } = useDeliveryAuthStore();
  const [twoFactorData, setTwoFactorData] = useState(null);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    const hasDeliveryToken = Boolean(sessionStorage.getItem('delivery-token') || localStorage.getItem('delivery-token'));
    if (isAuthenticated && hasDeliveryToken) {
      const from = location.state?.from?.pathname || '/delivery/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      const result = await login(formData.email, formData.password, rememberMe);
      if (result?.twoFactorRequired) {
        setTwoFactorData({
          tempToken: result.tempToken,
          email: result.email,
          apiVerifyEndpoint: '/delivery/auth/2fa/verify-login'
        });
        return;
      }
      toast.success('Login successful!');
      // Redirect is handled by auth effect above to avoid duplicate navigation.
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Invalid credentials');
    }
  };

  if (twoFactorData) {
    const handleSuccess = () => {
      toast.success('Login successful!');
      const from = location.state?.from?.pathname || '/delivery/dashboard';
      navigate(from, { replace: true });
    };

    return (
      <PageTransition>
        <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-900 flex items-center justify-center p-4">
          <TwoFactorVerify
            tempToken={twoFactorData.tempToken}
            email={twoFactorData.email}
            apiVerifyEndpoint={twoFactorData.apiVerifyEndpoint}
            onSuccess={handleSuccess}
            onCancel={() => setTwoFactorData(null)}
          />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-900 flex items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="glass-card rounded-2xl p-6 shadow-xl relative">
            {/* Back Button */}
            <button
              onClick={() => navigate(-1)}
              className="absolute left-6 top-6 text-gray-500 hover:text-gray-900 transition-colors p-1 hover:bg-black/5 rounded-full"
              title="Go Back"
            >
              <FiArrowLeft className="text-xl" />
            </button>

            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 gradient-green rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glow-green">
                <FiTruck className="text-white text-2xl" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Delivery Login</h1>
              <p className="text-gray-600 text-sm">Sign in to manage your deliveries</p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Field */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <FiMail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="your.email@example.com"
                    className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary-500 focus:outline-none transition-colors text-base"
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <FiLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    className="w-full pl-12 pr-12 py-3 rounded-xl border-2 border-gray-200 focus:border-primary-500 focus:outline-none transition-colors text-base"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center justify-between">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Remember me</span>
                </label>
                <Link
                  to="/delivery/forgot-password"
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full gradient-green text-white py-4 rounded-xl font-semibold text-base hover:shadow-glow-green transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Logging in...' : 'Sign In'}
              </button>
            </form>

            {/* Demo credentials: development builds only — never shown in production */}
            {import.meta.env.DEV && (
              <div className="mt-6 p-4 bg-primary-50 rounded-xl">
                <p className="text-sm text-gray-700 font-semibold mb-2">Demo Credentials (dev only):</p>
                <p className="text-xs text-gray-600">Email: delivery@delivery.com</p>
                <p className="text-xs text-gray-600">Password: delivery123</p>
              </div>
            )}

            <div className="text-center pt-4">
              <p className="text-sm text-gray-600">
                New delivery partner?{' '}
                <Link to="/delivery/register" className="text-primary-600 hover:text-primary-700 font-semibold">
                  Register here
                </Link>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </PageTransition>
  );
};

export default DeliveryLogin;

