import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api';

const TwoFactorVerify = ({ tempToken, email, apiVerifyEndpoint, onSuccess, onCancel }) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(30);
  const inputRefs = useRef([]);

  // Focus the first input on load
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  // Cooldown timer for resend
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleChange = (index, value) => {
    if (isNaN(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    // Move to next input if filled
    if (value && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0 && inputRefs.current[index - 1]) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').substring(0, 6);
    if (pastedData.length === 6) {
      const newOtp = pastedData.split('');
      setOtp(newOtp);
      inputRefs.current[5].focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) {
      toast.error('Please enter all 6 digits.');
      return;
    }

    setIsLoading(false);
    setIsLoading(true);
    try {
      const response = await api.post(apiVerifyEndpoint, { tempToken, otp: code });
      const payload = response?.data || response;
      toast.success('Verification successful!');
      onSuccess(payload);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Invalid or expired 2FA code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setIsLoading(true);
    try {
      const resendEndpoint = apiVerifyEndpoint.replace('/verify-login', '/resend');
      await api.post(resendEndpoint, { tempToken });
      toast.success('Verification code resent successfully!');
      setCooldown(30);
      setOtp(['', '', '', '', '', '']);
      if (inputRefs.current[0]) {
        inputRefs.current[0].focus();
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to resend code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-5 sm:p-8 bg-white/80 backdrop-blur-lg rounded-2xl border border-gray-100 shadow-xl">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Two-Factor Authentication</h2>
        <p className="text-sm text-gray-500 break-all px-1">
          Enter the 6-digit verification code sent to <span className="font-semibold text-gray-700">{email}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center justify-center gap-1.5 sm:gap-2.5" onPaste={handlePaste}>
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="w-10 h-11 xs:w-11 xs:h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-bold border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-gray-55/30 transition-all shadow-inner flex-shrink-0"
            />
          ))}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {isLoading ? 'Verifying...' : 'Verify & Continue'}
        </button>
      </form>

      <div className="mt-6 flex flex-col items-center justify-between text-xs text-gray-500 space-y-3">
        <button
          onClick={handleResend}
          disabled={cooldown > 0 || isLoading}
          className="text-primary-600 hover:underline font-medium disabled:text-gray-400 disabled:no-underline"
        >
          {cooldown > 0 ? `Resend Code in ${cooldown}s` : 'Resend Code'}
        </button>

        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600 hover:underline font-medium transition-all"
        >
          Cancel and return to Login
        </button>
      </div>
    </div>
  );
};

export default TwoFactorVerify;
