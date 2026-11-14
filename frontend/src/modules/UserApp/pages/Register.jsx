import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FiMail, FiLock, FiEye, FiEyeOff, FiUser, FiPhone, FiArrowLeft } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../../shared/store/authStore';
import { isValidEmail, isValidPhone } from '../../../shared/utils/helpers';
import toast from 'react-hot-toast';
import MobileLayout from "../components/Layout/MobileLayout";
import PageTransition from '../../../shared/components/PageTransition';
import B2BRegistrationWizard from '../components/B2B/B2BRegistrationWizard';
import { useBusinessBuyer } from '../hooks/useBusinessBuyer';
import { useEffect } from 'react';

const MobileRegister = ({ isB2BRoute }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { register: registerUser, login, isLoading } = useAuthStore();
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

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const {
    register: registerB2C,
    handleSubmit: handleSubmitB2C,
    formState: { errors: b2cErrors },
  } = useForm();

  const onB2CSubmit = async (data) => {
    try {
      const fullName = `${data.firstName} ${data.lastName}`;
      await registerUser(fullName, data.email, data.password, data.phone);
      toast.success('Registration successful! A verification OTP has been sent to your email.');
      navigate('/verification', { state: { email: data.email } });
    } catch (error) {
      toast.error(error.message || 'Registration failed. Please try again.');
    }
  };

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
              <button
                onClick={() => navigate(-1)}
                className="absolute left-4 top-4 md:left-6 md:top-6 text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition-colors p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full"
                title="Go Back"
              >
                <FiArrowLeft className="text-lg md:text-xl" />
              </button>

              <div className="text-center mb-4 md:mb-6 pt-1">
                <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-zinc-50 mb-1 md:mb-2">Get Started Now</h1>
                <p className="text-xs md:text-sm text-gray-600 dark:text-zinc-400">Create an account to unlock full portal features</p>
              </div>


              {!isBusinessMode && (
                <form onSubmit={handleSubmitB2C(onB2CSubmit)} className="space-y-3 md:space-y-4">
                  <div className="grid grid-cols-2 gap-2.5 md:gap-4">
                    <div>
                      <label className="block text-xs md:text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1 md:mb-1.5">First Name</label>
                      <div className="relative">
                        <FiUser className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-zinc-500 text-xs md:text-base" />
                        <input
                          type="text"
                          {...registerB2C('firstName', {
                            required: 'First name is required',
                            minLength: { value: 2, message: 'Must be at least 2 characters' },
                          })}
                          className={`w-full pl-8 md:pl-12 pr-2.5 md:pr-4 py-2.5 md:py-3 rounded-xl border-2 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white ${b2cErrors.firstName ? 'border-red-300 focus:border-red-500' : 'border-gray-200 dark:border-zinc-800 focus:border-[#AE020B]'} focus:outline-none transition-colors text-xs md:text-base`}
                          placeholder="Raj"
                        />
                      </div>
                      {b2cErrors.firstName && <p className="mt-1 text-[11px] md:text-sm text-red-650">{b2cErrors.firstName.message}</p>}
                    </div>

                    <div>
                      <label className="block text-xs md:text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1 md:mb-1.5">Last Name</label>
                      <div className="relative">
                        <FiUser className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-zinc-500 text-xs md:text-base" />
                        <input
                          type="text"
                          {...registerB2C('lastName', {
                            required: 'Last name is required',
                            minLength: { value: 2, message: 'Must be at least 2 characters' },
                          })}
                          className={`w-full pl-8 md:pl-12 pr-2.5 md:pr-4 py-2.5 md:py-3 rounded-xl border-2 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white ${b2cErrors.lastName ? 'border-red-300 focus:border-red-500' : 'border-gray-200 dark:border-zinc-800 focus:border-[#AE020B]'} focus:outline-none transition-colors text-xs md:text-base`}
                          placeholder="Sarkar"
                        />
                      </div>
                      {b2cErrors.lastName && <p className="mt-1 text-[11px] md:text-sm text-red-650">{b2cErrors.lastName.message}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs md:text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1 md:mb-1.5">Email</label>
                    <div className="relative">
                      <FiMail className="absolute left-3.5 md:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-zinc-500 text-xs md:text-base" />
                      <input
                        type="email"
                        {...registerB2C('email', {
                          required: 'Email is required',
                          validate: (value) => isValidEmail(value) || 'Please enter a valid email',
                        })}
                        className={`w-full pl-9 md:pl-12 pr-3 md:pr-4 py-2.5 md:py-3 rounded-xl border-2 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white ${b2cErrors.email ? 'border-red-300 focus:border-red-500' : 'border-gray-200 dark:border-zinc-800 focus:border-[#AE020B]'} focus:outline-none transition-colors text-xs md:text-base`}
                        placeholder="sarkarraj0766@gmail.com"
                      />
                    </div>
                    {b2cErrors.email && <p className="mt-1 text-[11px] md:text-sm text-red-655">{b2cErrors.email.message}</p>}
                  </div>

                  <div>
                    <label className="block text-xs md:text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1 md:mb-1.5">Phone Number</label>
                    <div className="relative">
                      <FiPhone className="absolute left-3.5 md:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-zinc-500 text-xs md:text-base" />
                      <input
                        type="tel"
                        {...registerB2C('phone', {
                          required: 'Phone number is required',
                          validate: (value) => isValidPhone(value) || 'Please enter a valid phone number',
                        })}
                        className={`w-full pl-9 md:pl-12 pr-3 md:pr-4 py-2.5 md:py-3 rounded-xl border-2 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white ${b2cErrors.phone ? 'border-red-300 focus:border-red-500' : 'border-gray-200 dark:border-zinc-800 focus:border-[#AE020B]'} focus:outline-none transition-colors text-xs md:text-base`}
                        placeholder="9876543210"
                      />
                    </div>
                    {b2cErrors.phone && <p className="mt-1 text-[11px] md:text-sm text-red-655">{b2cErrors.phone.message}</p>}
                  </div>

                  <div>
                    <label className="block text-xs md:text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1 md:mb-1.5">Password</label>
                    <div className="relative">
                      <FiLock className="absolute left-3.5 md:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-zinc-500 text-xs md:text-base" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        {...registerB2C('password', {
                          required: 'Password is required',
                          minLength: { value: 6, message: 'Password must be at least 6 characters' },
                        })}
                        className={`w-full pl-9 md:pl-12 pr-10 md:pr-12 py-2.5 md:py-3 rounded-xl border-2 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white ${b2cErrors.password ? 'border-red-300 focus:border-red-500' : 'border-gray-200 dark:border-zinc-800 focus:border-[#AE020B]'} focus:outline-none transition-colors text-xs md:text-base`}
                        placeholder="Create a password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 md:right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                      </button>
                    </div>
                    {b2cErrors.password && <p className="mt-1 text-[11px] md:text-sm text-red-655">{b2cErrors.password.message}</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-[#AE020B] hover:bg-[#8d0208] text-white py-2.5 md:py-3.5 rounded-xl font-bold text-xs md:text-base transition-all duration-300 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider active:scale-[0.99]"
                  >
                    {isLoading ? 'Creating Account...' : 'Sign Up'}
                  </button>
                </form>
              )}

              {isBusinessMode && <B2BRegistrationWizard />}

              <div className="mt-4 md:mt-6 text-center">
                <p className="text-xs md:text-sm text-gray-600 dark:text-zinc-400">
                  Already have an account?{' '}
                  <Link to={isBusinessMode ? "/b2b/login" : "/login"} className="text-[#AE020B] dark:text-red-400 hover:text-[#8d0208] font-bold">Sign In</Link>
                </p>
              </div>

              <div className="mt-3.5 md:mt-6 text-center text-[11px] md:text-xs text-gray-500 dark:text-zinc-500 leading-relaxed px-2 md:px-4">
                By creating an account, you agree to our{' '}
                <Link to="/terms-and-conditions" className="text-[#7B0A0A] dark:text-red-400 hover:text-[#AE020B] font-bold underline transition-colors">Terms & Conditions</Link>{' '}
                and{' '}
                <Link to="/privacy-policy" className="text-[#7B0A0A] dark:text-red-400 hover:text-[#AE020B] font-bold underline transition-colors">Privacy Policy</Link>.
              </div>
            </div>
          </motion.div>
        </div>

      </MobileLayout>
    </PageTransition>
  );
};

export default MobileRegister;
