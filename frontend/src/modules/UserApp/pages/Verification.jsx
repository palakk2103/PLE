import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { FiArrowLeft, FiCheck } from 'react-icons/fi';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import MobileLayout from "../components/Layout/MobileLayout";
import PageTransition from '../../../shared/components/PageTransition';
import { useAuthStore } from '../../../shared/store/authStore';

const MobileVerification = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { verifyOTP, resendOTP, pendingEmail, isLoading } = useAuthStore();
  const [codes, setCodes] = useState(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(30);
  const [isResending, setIsResending] = useState(false);
  const inputRefs = useRef([]);

  const email =
    String(location.state?.email || pendingEmail || searchParams.get('email') || '')
      .trim()
      .toLowerCase();

  // Focus first input on mount
  useEffect(() => {
    if (!email) {
      navigate('/register', { replace: true });
      return;
    }
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [email, navigate]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleChange = (index, value) => {
    // Only allow single digit
    if (value.length > 1 || (value && !/^\d$/.test(value))) return;

    const newCodes = [...codes];
    newCodes[index] = value;
    setCodes(newCodes);

    // Auto-focus next input
    if (value && index < codes.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === 'Backspace' && !codes[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    if (pastedData.length === codes.length && /^\d+$/.test(pastedData)) {
      const newCodes = pastedData.split('');
      setCodes(newCodes);
      inputRefs.current[codes.length - 1]?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const verificationCode = codes.join('');

    if (verificationCode.length !== codes.length) {
      toast.error('Please enter the complete 6-digit code');
      return;
    }

    try {
      await verifyOTP(email, verificationCode);
      toast.success('Verification successful!');
      navigate('/home');
    } catch (error) {
      const errMsg = error?.response?.data?.message || error?.message || 'Invalid verification code. Please try again.';
      if (errMsg.toLowerCase().includes('already verified')) {
        toast.success('Account is already verified! Redirecting to login...');
        setTimeout(() => navigate('/login'), 1500);
        return;
      }
      toast.error(errMsg);
    }
  };

  const handleResend = async () => {
    if (!email || resendCooldown > 0 || isResending) return;
    setIsResending(true);
    try {
      await resendOTP(email);
      toast.success('New verification code sent to your email!');
      setResendCooldown(45);
    } catch (error) {
      const errMsg = error?.response?.data?.message || error?.message || 'Failed to resend code.';
      if (errMsg.toLowerCase().includes('already verified')) {
        toast.success('Your email is already verified! Redirecting to login...');
        setTimeout(() => navigate('/login'), 1500);
        return;
      }
      toast.error(errMsg);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <PageTransition>
      <MobileLayout showBottomNav={false} showCartBar={false}>
        <div className="w-full min-h-screen flex items-start justify-center px-4 pt-6 pb-8 bg-gray-50 dark:bg-zinc-950 transition-colors duration-500">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 dark:border-zinc-800 transition-colors duration-500">
              {/* Back Button */}
              <button
                onClick={() => navigate(-1)}
                className="mb-4 flex items-center text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <FiArrowLeft className="mr-2" size={20} />
                <span className="text-sm font-medium">Back</span>
              </button>

              {/* Header */}
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-50 mb-4">Verification</h1>

                {/* Verification Icon */}
                <div className="flex justify-center mb-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <div className="w-9 h-9 rounded-full bg-[#AE020B] flex items-center justify-center shadow-md shadow-red-900/20">
                          <FiCheck className="text-white" size={18} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-200 mb-1">Verification code</h2>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-zinc-400 max-w-xs mx-auto">
                  Enter the 6-digit verification code sent to <br />
                  <span className="font-semibold text-gray-900 dark:text-zinc-100 break-all">{email || 'your email'}</span>
                </p>
              </div>

              {/* Code Input Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex justify-center items-center gap-1.5 sm:gap-2.5">
                  {codes.map((code, index) => (
                    <input
                      key={index}
                      ref={(el) => (inputRefs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={code}
                      onChange={(e) => handleChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      onPaste={index === 0 ? handlePaste : undefined}
                      className={`w-11 h-12 sm:w-12 sm:h-14 rounded-xl border-2 text-center text-lg sm:text-xl font-bold focus:outline-none transition-all ${code
                          ? 'border-[#AE020B] bg-red-50/60 dark:bg-red-950/20 text-[#AE020B] dark:text-red-400 shadow-sm'
                          : 'border-gray-200 dark:border-zinc-800 focus:border-[#AE020B] dark:focus:border-[#AE020B] focus:ring-2 focus:ring-[#AE020B]/20 text-gray-900 dark:text-white bg-white dark:bg-zinc-950'
                        }`}
                    />
                  ))}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading || codes.some(code => !code)}
                  className="w-full bg-[#AE020B] hover:bg-[#8d0208] text-white py-3.5 rounded-xl font-semibold text-base transition-all duration-300 hover:shadow-lg hover:shadow-red-900/20 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Verifying...' : 'Confirm'}
                </button>
              </form>

              {/* Resend Link */}
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600 dark:text-zinc-400">
                  Didn't receive the code?{' '}
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || isResending}
                    className="text-[#AE020B] dark:text-red-400 hover:text-[#8d0208] dark:hover:text-red-300 font-semibold transition-colors disabled:text-gray-400 dark:disabled:text-zinc-600 disabled:cursor-not-allowed"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : (isResending ? 'Sending...' : 'Resend')}
                  </button>
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </MobileLayout>
    </PageTransition>
  );
};

export default MobileVerification;

