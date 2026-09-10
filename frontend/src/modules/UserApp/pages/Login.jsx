import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FiMail, FiLock, FiEye, FiEyeOff, FiPhone, FiArrowLeft } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../../shared/store/authStore';
import { useWishlistStore } from '../../../shared/store/wishlistStore';
import { useB2BAdminStore } from '../../B2BAdmin/store/b2bAdminStore';
import { useB2bStore } from '../../../shared/store/b2bStore';
import {
  clearPostLoginRedirect,
  consumePostLoginAction,
  getPostLoginRedirect,
} from '../../../shared/utils/postLoginAction';
import { isValidEmail } from '../../../shared/utils/helpers';
import toast from 'react-hot-toast';
import MobileLayout from '../components/Layout/MobileLayout';
import PageTransition from '../../../shared/components/PageTransition';
import TwoFactorVerify from '../../../shared/components/TwoFactorVerify';
import { useBusinessBuyer } from '../hooks/useBusinessBuyer';

const MobileLogin = ({ isB2BRoute }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, isAuthenticated } = useAuthStore();
  const [twoFactorData, setTwoFactorData] = useState(null);
  const { login: loginB2B, isLoading: isB2BLoading, isAuthenticated: isB2BAuthenticated } = useB2BAdminStore();
  const { setUserRole } = useBusinessBuyer();

  const isBusinessMode = isB2BRoute || location.pathname.startsWith('/b2b/');

  // Sync portal mode from route/path parameters
  useEffect(() => {
    if (isBusinessMode) {
      setUserRole('business_buyer');
    } else {
      setUserRole('customer');
    }
  }, [isBusinessMode, setUserRole]);

  useEffect(() => {
    const { adminProfile } = useB2BAdminStore.getState();
    const b2bStore = useB2bStore.getState();

    if (isB2BAuthenticated && adminProfile) {
      // Sync authStore to match the active B2B session
      const token = localStorage.getItem('b2bAdminToken') || sessionStorage.getItem('b2bAdminToken');
      const mainAuth = useAuthStore.getState();
      if (token && !mainAuth.isAuthenticated) {
        localStorage.setItem('token', token);
        sessionStorage.setItem('token', token);
        useAuthStore.setState({ isAuthenticated: true, token, user: adminProfile });
      }
    }

    if (isBusinessMode) {
      if (isB2BAuthenticated) {
        b2bStore.setUserRole('business_buyer');
        navigate('/home', { replace: true });
      }
    } else {
      if (isAuthenticated) {
        b2bStore.setUserRole('customer');
        navigate('/home', { replace: true });
      }
    }
  }, [isAuthenticated, isB2BAuthenticated, isBusinessMode, navigate]);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const storedFrom = getPostLoginRedirect();
  const from = location.state?.from?.pathname || storedFrom || '/home';

  const replayPendingAction = () => {
    const action = consumePostLoginAction();
    if (!action?.type) return;

    if (action.type === 'cart:add' && action.payload) {
      useCartStore.getState().addItem(action.payload);
      return;
    }

    if (action.type === 'wishlist:add' && action.payload) {
      useWishlistStore.getState().addItem(action.payload);
    }
  };

  const onSubmit = async (data) => {
    try {
      if (isBusinessMode) {
        const result = await loginB2B({ businessEmail: data.email, password: data.password });
        if (result?.twoFactorRequired) {
          setTwoFactorData({
            tempToken: result.tempToken,
            email: result.email,
            apiVerifyEndpoint: '/b2b-user/auth/2fa/verify-login',
            isB2B: true
          });
          return;
        }
        if (result?.success || result === true) {
          const { adminProfile } = useB2BAdminStore.getState();
          
          // Switch the app mode to business_buyer for B2B users
          useB2bStore.getState().setUserRole('business_buyer');

          // Manually sync authStore to prevent secondary login failure errors for BOTH admin and employee
          const token = localStorage.getItem('b2bAdminToken') || sessionStorage.getItem('b2bAdminToken');
          if (token) {
            localStorage.setItem('token', token);
            sessionStorage.setItem('token', token);
            useAuthStore.setState({ isAuthenticated: true, token, user: adminProfile });
          }

          navigate('/home', { replace: true });
        }
        return;
      }

      console.log('Login submit start', data);
      try {
        const result = await login(data.email, data.password, rememberMe);
        if (result?.twoFactorRequired) {
          setTwoFactorData({
            tempToken: result.tempToken,
            email: result.email,
            apiVerifyEndpoint: '/user/auth/2fa/verify-login',
            isB2B: false
          });
          return;
        }
        console.log('Login successful');
        
        // Check if the user who just logged in is actually a B2B user
        const userRole = result?.user?.role;
        const b2bState = useB2bStore.getState();
        const isMockEmployee = b2bState.companies?.some(c => 
          c.employees?.some(e => e.email?.toLowerCase() === data.email.toLowerCase())
        );

        if (userRole === 'b2bAdmin' || userRole === 'b2bEmployee' || isMockEmployee) {
           const token = useAuthStore.getState().token || localStorage.getItem('token');
           if (token) {
             localStorage.setItem('b2bAdminToken', token);
             if (userRole === 'b2bAdmin' || userRole === 'b2bEmployee') {
               useB2BAdminStore.setState({ 
                 isAuthenticated: true, 
                 adminProfile: result.user 
               });
             }
           }
           b2bState.setUserRole('business_buyer');
         } else {
          if (!isBusinessMode) {
            b2bState.setUserRole('customer');
          }
         }
        
        replayPendingAction();
        toast.success('Login successful!');
        clearPostLoginRedirect();
        
        // Instead of blind navigation, let the useEffect handle it now that we've synced the stores
      } catch (err) {
        const errorMsg = String(err?.response?.data?.message || err?.message || '').toLowerCase();
        // If standard user fails, try B2B login as fallback for employees
        if (errorMsg.includes('invalid') || errorMsg.includes('not found') || errorMsg.includes('failed')) {
          try {
            const b2bResult = await loginB2B({ businessEmail: data.email, password: data.password });
            if (b2bResult?.twoFactorRequired) {
              setTwoFactorData({
                tempToken: b2bResult.tempToken,
                email: b2bResult.email,
                apiVerifyEndpoint: '/b2b-user/auth/2fa/verify-login',
                isB2B: true
              });
              return;
            }
            if (b2bResult?.success || b2bResult === true) {
              const { adminProfile } = useB2BAdminStore.getState();
              // Manually sync authStore to prevent secondary login failure errors for BOTH admin and employee
              const token = localStorage.getItem('b2bAdminToken') || sessionStorage.getItem('b2bAdminToken');
              if (token) {
                localStorage.setItem('token', token);
                sessionStorage.setItem('token', token);
                useAuthStore.setState({ isAuthenticated: true, token, user: adminProfile });
              }

              if (adminProfile?.isEmployee) {
                // If it's an employee, switch the app mode to business
                useB2bStore.getState().setUserRole('business_buyer');
                
                toast.success('Login successful as B2B Employee!');
                navigate('/home', { replace: true });
                return;
              } else {
                useB2bStore.getState().setUserRole('business_buyer');
                toast.success('Login successful as B2B Admin!');
                navigate('/home', { replace: true });
                return;
              }
            }
          } catch (fallbackErr) {
            // ignore fallback error and let the original error show
          }
        }
        
        // Handle verification case or generic error
        if (
          errorMsg.includes('email not verified') ||
          errorMsg.includes('verify your email')
        ) {
          navigate('/verification', {
            state: { email: String(data.email || '').trim().toLowerCase() },
            replace: true,
          });
          return;
        }

        toast.error(
          err?.response?.data?.message || 
          err?.message || 
          'Login failed. Please check your credentials.'
        );
      }
    } catch (error) {
      toast.error(error?.message || 'Login failed. Please try again.');
    }
  };

  if (twoFactorData) {
    const handleSuccess = (payload) => {
      const accessToken = payload.accessToken || payload.data?.accessToken;
      const user = payload.user || payload.data?.user;

      if (twoFactorData.isB2B) {
        if (accessToken) {
          sessionStorage.setItem('b2bAdminToken', accessToken);
        }
        useB2BAdminStore.setState({ isAuthenticated: true, adminProfile: user });
        useB2bStore.getState().setUserRole('business_buyer');
        
        localStorage.setItem('token', accessToken);
        sessionStorage.setItem('token', accessToken);
        useAuthStore.setState({ isAuthenticated: true, token: accessToken, user });
      } else {
        const userRole = user?.role;
        const b2bState = useB2bStore.getState();
        const isMockEmployee = b2bState.companies?.some(c => 
          c.employees?.some(e => e.email?.toLowerCase() === user?.email?.toLowerCase())
        );

        if (userRole === 'b2bAdmin' || userRole === 'b2bEmployee' || isMockEmployee) {
          localStorage.setItem('b2bAdminToken', accessToken);
          useB2BAdminStore.setState({ isAuthenticated: true, adminProfile: user });
          b2bState.setUserRole('business_buyer');
        } else {
          b2bState.setUserRole('customer');
        }
      }

      toast.success('Login successful!');
      navigate('/home', { replace: true });
    };

    return (
      <PageTransition>
        <MobileLayout>
          <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-gray-50 dark:bg-zinc-955">
            <TwoFactorVerify
              tempToken={twoFactorData.tempToken}
              email={twoFactorData.email}
              apiVerifyEndpoint={twoFactorData.apiVerifyEndpoint}
              onSuccess={handleSuccess}
              onCancel={() => setTwoFactorData(null)}
            />
          </div>
        </MobileLayout>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <MobileLayout showBottomNav={false} showCartBar={false}>
        <div className="w-full min-h-screen flex items-start justify-center px-3.5 py-4 sm:px-4 sm:pt-6 pb-8 bg-gray-50 dark:bg-zinc-950 transition-colors duration-500">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 sm:p-6 shadow-sm relative border dark:border-zinc-800 transition-colors duration-500">
              {/* Back Button */}
              <button
                onClick={() => navigate(-1)}
                className="absolute left-4 top-4 md:left-6 md:top-6 text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition-colors p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full"
                title="Go Back"
              >
                <FiArrowLeft className="text-lg md:text-xl" />
              </button>

              {/* Header */}
              <div className="text-center mb-5 md:mb-8 pt-1">
                <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-zinc-50 mb-1 md:mb-2">Welcome Back</h1>
                <p className="text-xs md:text-sm text-gray-600 dark:text-zinc-400">Login to access your account</p>
              </div>

              {/* B2B Info Message */}
              {isBusinessMode && (
                <div className="mb-4 md:mb-6 p-3 md:p-4 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl text-center">
                  <p className="text-[11px] md:text-xs text-[#AE020B] dark:text-red-400 font-bold leading-relaxed">
                    ✨ Business mode: unlock wholesale prices, tier discounts, MOQ, GST credit, and credit terms.
                  </p>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5 md:space-y-5">
                <div>
                  <label className="block text-xs md:text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1.5 md:mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <FiMail className="absolute left-3.5 md:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-zinc-500 text-sm md:text-base" />
                    <input
                      type="email"
                      {...register('email', {
                        required: 'Email is required',
                        validate: (value) =>
                          !value || isValidEmail(value) || 'Please enter a valid email',
                      })}
                      className={`w-full pl-10 md:pl-12 pr-3 md:pr-4 py-2.5 md:py-3 rounded-xl border-2 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white ${errors.email
                          ? 'border-red-300 focus:border-red-500'
                          : 'border-gray-200 dark:border-zinc-800 focus:border-[#AE020B] dark:focus:border-[#AE020B]'
                        } focus:outline-none transition-colors text-xs md:text-base`}
                      placeholder="your.email@example.com"
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-1 text-xs md:text-sm text-red-600 dark:text-red-400">{errors.email.message}</p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs md:text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1.5 md:mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <FiLock className="absolute left-3.5 md:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-zinc-500 text-sm md:text-base" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      {...register('password', {
                        required: 'Password is required',
                        minLength: {
                          value: 6,
                          message: 'Password must be at least 6 characters',
                        },
                      })}
                      className={`w-full pl-10 md:pl-12 pr-10 md:pr-12 py-2.5 md:py-3 rounded-xl border-2 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white ${errors.password
                          ? 'border-red-300 focus:border-red-500'
                          : 'border-gray-200 dark:border-zinc-800 focus:border-[#AE020B] dark:focus:border-[#AE020B]'
                        } focus:outline-none transition-colors text-xs md:text-base`}
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 md:right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
                    >
                      {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-xs md:text-sm text-red-600 dark:text-red-400">{errors.password.message}</p>
                  )}
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between pt-0.5">
                  <label className="flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#AE020B] dark:text-[#AE020B] bg-white dark:bg-zinc-950 border-gray-300 dark:border-zinc-800 rounded focus:ring-[#AE020B] dark:focus:ring-offset-zinc-900 accent-[#AE020B]"
                    />
                    <span className="ml-2 text-xs md:text-sm text-gray-700 dark:text-zinc-300">Remember me</span>
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs md:text-sm text-[#AE020B] dark:text-red-400 hover:text-[#8d0208] font-medium"
                  >
                    Forgot password?
                  </Link>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isBusinessMode ? isB2BLoading : isLoading}
                  className="w-full bg-[#AE020B] hover:bg-[#8d0208] text-white py-2.5 md:py-3.5 rounded-xl font-bold text-xs md:text-base transition-all duration-300 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider active:scale-[0.99]"
                >
                  {isBusinessMode ? (isB2BLoading ? 'Logging in...' : 'Log In') : (isLoading ? 'Logging in...' : 'Log In')}
                </button>
              </form>

              {/* Sign Up Link */}
              <div className="mt-4 md:mt-6 text-center">
                <p className="text-xs md:text-sm text-gray-600 dark:text-zinc-400">
                  Don't have an account?{' '}
                  <Link
                    to={isBusinessMode ? "/b2b/register" : "/register"}
                    className="text-[#AE020B] dark:text-red-400 hover:text-[#8d0208] font-bold"
                  >
                    Sign Up
                  </Link>
                </p>
              </div>

              {/* Legal Disclosure */}
              <div className="mt-3.5 md:mt-6 text-center text-[11px] md:text-xs text-gray-500 dark:text-zinc-500 leading-relaxed px-2 md:px-4">
                By continuing, you agree to our{' '}
                <Link
                  to="/terms-and-conditions"
                  className="text-[#7B0A0A] dark:text-red-400 hover:text-[#AE020B] font-bold underline transition-colors"
                >
                  Terms & Conditions
                </Link>{' '}
                and{' '}
                <Link
                  to="/privacy-policy"
                  className="text-[#7B0A0A] dark:text-red-400 hover:text-[#AE020B] font-bold underline transition-colors"
                >
                  Privacy Policy
                </Link>
                .
              </div>
            </div>
          </motion.div>
        </div>

      </MobileLayout>
    </PageTransition>
  );
};

export default MobileLogin;
