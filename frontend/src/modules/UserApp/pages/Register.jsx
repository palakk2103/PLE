import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FiMail, FiLock, FiEye, FiEyeOff, FiUser, FiPhone, FiArrowLeft, FiDownload, FiUploadCloud, FiTrash2, FiFileText } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../../shared/store/authStore';
import { isValidEmail, isValidPhone } from '../../../shared/utils/helpers';
import toast from 'react-hot-toast';
import MobileLayout from "../components/Layout/MobileLayout";
import PageTransition from '../../../shared/components/PageTransition';
import { useB2bStore } from '../../../shared/store/b2bStore';
import { useB2BAdminStore } from '../../B2BAdmin/store/b2bAdminStore';
import { useBusinessBuyer } from '../hooks/useBusinessBuyer';
import api from '../../../shared/utils/api';
import { useEffect } from 'react';

const MobileRegister = ({ isB2BRoute }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { register: registerUser, login, isLoading } = useAuthStore();
  const { setUserRole } = useBusinessBuyer();
  const registerCompany = useB2bStore((state) => state.registerCompany);
  const { register: registerB2BAdminAPI, login: loginB2B, isLoading: isB2BLoading } = useB2BAdminStore();

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
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showConfirmSecretKey, setShowConfirmSecretKey] = useState(false);
  const [showEmpPassword, setShowEmpPassword] = useState(false);
  const [showEmpConfirmPassword, setShowEmpConfirmPassword] = useState(false);
  const [b2bStep, setB2bStep] = useState(1);
  const [b2bSettings, setB2bSettings] = useState({ requireGST: true, requirePAN: true });

  const [activeTemplate, setActiveTemplate] = useState(null);
  const [uploadedAgreement, setUploadedAgreement] = useState(null);
  const [uploadingAgreement, setUploadingAgreement] = useState(false);
  const [dragOverAgreement, setDragOverAgreement] = useState(false);

  useEffect(() => {
    api.get('/agreement-template/active')
      .then(res => {
        const template = res?.data?.data || res?.data || res;
        if (template && (template.url || template._id)) {
          setActiveTemplate(template);
        }
      })
      .catch(err => console.warn('Failed to load active platform template', err));
  }, []);

  useEffect(() => {
    api.get('/settings/b2b').then(res => {
      const settings = res?.data?.data || res?.data || res;
      if (settings && typeof settings === 'object') {
        setB2bSettings({
          requireGST: settings.requireGST !== false,
          requirePAN: settings.requirePAN !== false
        });
      }
    }).catch(err => console.error('Failed to load b2b settings', err));
  }, []);

  const [b2bData, setB2bData] = useState({
    companyName: '',
    gstNumber: '',
    businessEmail: '',
    businessPhone: '',
    businessAddress: '',
    businessType: '',
    website: '',
    adminName: '',
    adminEmail: '',
    adminPhone: '',
    password: '',
    confirmPassword: '',
    secretKey: '',
    confirmSecretKey: '',
  });

  const [employees, setEmployees] = useState([]);
  const [empInput, setEmpInput] = useState({
    name: '',
    email: '',
    phone: '',
    designation: '',
    department: '',
    address: '',
  });

  const {
    register: registerB2C,
    handleSubmit: handleSubmitB2C,
    formState: { errors: b2cErrors },
  } = useForm();

  const handleB2bChange = (e) => {
    const { name, value } = e.target;
    setB2bData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEmpChange = (e) => {
    const { name, value } = e.target;
    setEmpInput((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddEmployee = () => {
    if (!empInput.name || !empInput.email || !empInput.phone || !empInput.designation) {
      toast.error('All employee fields are required.');
      return;
    }
    if (!isValidEmail(empInput.email)) {
      toast.error('Please enter a valid employee email.');
      return;
    }
    if (employees.some(emp => emp.email.toLowerCase() === empInput.email.toLowerCase())) {
      toast.error('Employee with this email already added.');
      return;
    }

    setEmployees((prev) => [...prev, { ...empInput }]);
    setEmpInput({ name: '', email: '', phone: '', designation: '', department: '', address: '' });
    toast.success('Employee added successfully!');
  };

  const handleRemoveEmployee = (index) => {
    setEmployees((prev) => prev.filter((_, i) => i !== index));
    toast.success('Employee removed.');
  };

  const handleAgreementUpload = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are allowed.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Maximum file size is 10 MB.');
      return;
    }
    
    setUploadingAgreement(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/b2b-user/auth/upload-agreement', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const data = response?.data?.data || response?.data || response;
      if (data && data.url) {
        setUploadedAgreement(data);
        toast.success('Signed agreement uploaded successfully!');
      } else {
        toast.error('Failed to upload signed agreement.');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error?.message || 'Failed to upload signed agreement.');
    } finally {
      setUploadingAgreement(false);
    }
  };

  const validateStep1 = () => {
    if (!b2bData.companyName || !b2bData.businessEmail || !b2bData.businessPhone || !b2bData.businessAddress || !b2bData.businessType) {
      toast.error('Please fill all required company details.');
      return false;
    }
    if (b2bSettings.requireGST && !b2bData.gstNumber) {
      toast.error('GST Number is required.');
      return false;
    }
    if (!isValidEmail(b2bData.businessEmail)) {
      toast.error('Please enter a valid business email.');
      return false;
    }
    if (b2bData.gstNumber) {
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstRegex.test(b2bData.gstNumber.toUpperCase())) {
        toast.error('Please enter a valid Indian GSTIN format.');
        return false;
      }
    }
    if (!uploadedAgreement) {
      toast.error('Please upload the signed Acceptance & Execution Agreement.');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!b2bData.adminName || !b2bData.adminEmail || !b2bData.adminPhone || !b2bData.password || !b2bData.confirmPassword || !b2bData.secretKey || !b2bData.confirmSecretKey) {
      toast.error('Please fill all admin and secret key details.');
      return false;
    }
    if (!isValidEmail(b2bData.adminEmail)) {
      toast.error('Please enter a valid admin email.');
      return false;
    }
    if (b2bData.password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return false;
    }
    if (b2bData.password !== b2bData.confirmPassword) {
      toast.error('Passwords do not match.');
      return false;
    }
    if (b2bData.secretKey.length < 6) {
      toast.error('Secret Key must be at least 6 characters.');
      return false;
    }
    if (b2bData.secretKey !== b2bData.confirmSecretKey) {
      toast.error('Secret Keys do not match.');
      return false;
    }
    return true;
  };

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

  const handleB2BSubmit = async (e) => {
    e.preventDefault();
    if (isB2BLoading) return;
    try {
      const payload = {
        companyData: {
          companyName: b2bData.companyName,
          gstNumber: b2bData.gstNumber.toUpperCase(),
          businessEmail: b2bData.businessEmail,
          businessPhone: b2bData.businessPhone,
          businessAddress: b2bData.businessAddress,
          businessType: b2bData.businessType,
          website: b2bData.website,
          secretKey: b2bData.secretKey,
          acceptanceExecutionDocument: uploadedAgreement,
        },
        adminData: {
          adminName: b2bData.adminName,
          adminEmail: b2bData.adminEmail,
          adminPhone: b2bData.adminPhone,
          password: b2bData.password,
        },
        employees
      };

      const success = await registerB2BAdminAPI(payload);

      if (success) {
        toast.success('Company Registration Successful! Logging you in...');
        try {
          const loginResult = await loginB2B({ 
            businessEmail: b2bData.adminEmail, 
            password: b2bData.password 
          });
          
          if (loginResult?.success || loginResult === true) {
            const { adminProfile } = useB2BAdminStore.getState();
            useB2bStore.getState().setUserRole('business_buyer');

            // Sync authStore tokens
            const token = localStorage.getItem('b2bAdminToken') || sessionStorage.getItem('b2bAdminToken');
            if (token) {
              localStorage.setItem('token', token);
              sessionStorage.setItem('token', token);
              useAuthStore.setState({ isAuthenticated: true, token, user: adminProfile });
            }

            navigate('/home', { replace: true });
            return;
          }
        } catch (loginErr) {
          console.error("Auto login after B2B registration failed:", loginErr);
        }
        
        // Fallback to B2B login page if auto-login fails
        navigate('/b2b/login', { replace: true });
      }
    } catch (error) {
      toast.error(error.message || 'Registration failed. Please try again.');
    }
  };

  const [empConfirmPassword, setEmpConfirmPassword] = useState('');

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
                onClick={() => {
                  if (isBusinessMode && b2bStep > 1) {
                    setB2bStep(b2bStep - 1);
                  } else {
                    navigate(-1);
                  }
                }}
                className="absolute left-4 top-4 md:left-6 md:top-6 text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition-colors p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full"
                title="Go Back"
              >
                <FiArrowLeft className="text-lg md:text-xl" />
              </button>

              <div className="text-center mb-4 md:mb-6 pt-1">
                <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-zinc-50 mb-1 md:mb-2">Get Started Now</h1>
                <p className="text-xs md:text-sm text-gray-600 dark:text-zinc-400">Create an account to unlock full portal features</p>
              </div>

              {isBusinessMode && (
                <div className="mb-4 md:mb-6 p-3 md:p-4 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl text-center">
                  <p className="text-[11px] md:text-xs text-[#AE020B] dark:text-red-400 font-bold">
                    ✨ Step {b2bStep} of 3: {b2bStep === 1 ? 'Company Details' : b2bStep === 2 ? 'Company Admin Details' : 'Add Employees (Optional)'}
                  </p>
                  <div className="w-full bg-gray-200 dark:bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className="bg-[#AE020B] h-full transition-all duration-300"
                      style={{ width: `${(b2bStep / 3) * 100}%` }}
                    />
                  </div>
                </div>
              )}

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

              {isBusinessMode && (
                <form onSubmit={handleB2BSubmit} className="space-y-3.5 md:space-y-5">
                  {b2bStep === 1 && (
                    <div className="space-y-3 md:space-y-4">
                      <div>
                        <label className="block text-xs md:text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1 md:mb-1.5">Company Name *</label>
                        <input type="text" name="companyName" value={b2bData.companyName} onChange={handleB2bChange} className="w-full px-3.5 md:px-4 py-2.5 md:py-3 rounded-xl border-2 border-gray-200 dark:border-zinc-800 focus:border-[#AE020B] bg-white dark:bg-zinc-950 text-gray-900 dark:text-white focus:outline-none text-xs md:text-base" placeholder="Apex General Enterprises" />
                      </div>
                      <div>
                        <label className="block text-xs md:text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1 md:mb-1.5">GST Number {b2bSettings.requireGST ? '*' : '(Optional)'}</label>
                        <input type="text" name="gstNumber" value={b2bData.gstNumber} onChange={handleB2bChange} className="w-full px-3.5 md:px-4 py-2.5 md:py-3 rounded-xl border-2 border-gray-200 dark:border-zinc-800 focus:border-[#AE020B] bg-white dark:bg-zinc-950 text-gray-900 dark:text-white focus:outline-none text-xs md:text-base font-mono uppercase" placeholder="27AAPCG9838F1Z1" />
                      </div>
                      <div>
                        <label className="block text-xs md:text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1 md:mb-1.5">Business Email *</label>
                        <input type="email" name="businessEmail" value={b2bData.businessEmail} onChange={handleB2bChange} className="w-full px-3.5 md:px-4 py-2.5 md:py-3 rounded-xl border-2 border-gray-200 dark:border-zinc-800 focus:border-[#AE020B] bg-white dark:bg-zinc-950 text-gray-900 dark:text-white focus:outline-none text-xs md:text-base" placeholder="procurement@apexenterprises.in" />
                      </div>
                      <div>
                        <label className="block text-xs md:text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1 md:mb-1.5">Business Phone *</label>
                        <input type="tel" name="businessPhone" value={b2bData.businessPhone} onChange={handleB2bChange} className="w-full px-3.5 md:px-4 py-2.5 md:py-3 rounded-xl border-2 border-gray-200 dark:border-zinc-800 focus:border-[#AE020B] bg-white dark:bg-zinc-950 text-gray-900 dark:text-white focus:outline-none text-xs md:text-base" placeholder="9876543210" />
                      </div>
                      <div>
                        <label className="block text-xs md:text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1 md:mb-1.5">Company Address *</label>
                        <textarea name="businessAddress" rows={2} value={b2bData.businessAddress} onChange={handleB2bChange} className="w-full px-3.5 md:px-4 py-2.5 md:py-3 rounded-xl border-2 border-gray-200 dark:border-zinc-800 focus:border-[#AE020B] bg-white dark:bg-zinc-950 text-gray-900 dark:text-white focus:outline-none text-xs md:text-base" placeholder="404 Business Hub, BKC, Mumbai" />
                      </div>
                      <div>
                        <label className="block text-xs md:text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1 md:mb-1.5">Company Type *</label>
                        <select name="businessType" value={b2bData.businessType} onChange={handleB2bChange} className="w-full px-3.5 md:px-4 py-2.5 md:py-3 rounded-xl border-2 border-gray-200 dark:border-zinc-800 focus:border-[#AE020B] bg-white dark:bg-zinc-950 text-gray-900 dark:text-white focus:outline-none text-xs md:text-base">
                          <option value="">Select Company Type</option>
                          <option value="Proprietorship">Proprietorship</option>
                          <option value="Partnership Firm">Partnership Firm</option>
                          <option value="LLP (Limited Liability Partnership)">LLP (Limited Liability Partnership)</option>
                          <option value="Private Limited Company">Private Limited Company</option>
                          <option value="Public Limited Company">Public Limited Company</option>
                          <option value="One Person Company (OPC)">One Person Company (OPC)</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs md:text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1 md:mb-1.5">Website (Optional)</label>
                        <input type="text" name="website" value={b2bData.website} onChange={handleB2bChange} className="w-full px-3.5 md:px-4 py-2.5 md:py-3 rounded-xl border-2 border-gray-200 dark:border-zinc-800 focus:border-[#AE020B] bg-white dark:bg-zinc-950 text-gray-900 dark:text-white focus:outline-none text-xs md:text-base" placeholder="https://apexenterprises.in" />
                      </div>

                      {/* Acceptance & Execution Agreement Section */}
                      <div className="border-t dark:border-zinc-800 pt-3 md:pt-4 space-y-2.5 md:space-y-3">
                        <h3 className="text-xs md:text-sm font-bold text-gray-800 dark:text-zinc-150 flex items-center gap-1.5">
                          <FiFileText className="text-[#AE020B]" /> Acceptance & Execution Agreement
                        </h3>
                        <p className="text-[11px] md:text-xs text-gray-500 dark:text-zinc-400">
                          Please download the Platform Agreement template, sign it, apply your official company seal, and upload the signed PDF below.
                        </p>
                        
                        {activeTemplate ? (
                          <div className="flex items-center justify-between p-2.5 md:p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 rounded-xl">
                            <div className="flex items-center gap-2 overflow-hidden mr-2">
                              <FiFileText className="text-emerald-600 dark:text-emerald-400 text-base md:text-lg shrink-0" />
                              <div className="overflow-hidden">
                                <p className="text-[11px] md:text-xs font-bold text-gray-800 dark:text-zinc-100 truncate">
                                  {activeTemplate.fileName || activeTemplate.templateName || 'Acceptance & Execution Agreement.pdf'}
                                </p>
                                <p className="text-[9px] md:text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                  Official Platform Template (v{activeTemplate.version || 1})
                                </p>
                              </div>
                            </div>
                            <a
                              href={activeTemplate.url}
                              download={activeTemplate.fileName || 'Acceptance_Agreement.pdf'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 inline-flex items-center gap-1 text-[11px] md:text-xs font-bold text-white bg-[#AE020B] hover:bg-[#8d0208] px-2.5 md:px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                            >
                              <FiDownload /> Download
                            </a>
                          </div>
                        ) : (
                          <p className="text-[11px] md:text-xs text-amber-600 dark:text-amber-500 font-semibold flex items-center gap-1 bg-amber-50 dark:bg-amber-950/10 p-2 border border-amber-100 dark:border-amber-900/30 rounded-lg">
                            ⚠️ Platform Agreement template is currently not configured by the Admin. Please contact support.
                          </p>
                        )}

                        <div
                          onDragOver={(e) => { e.preventDefault(); setDragOverAgreement(true); }}
                          onDragLeave={() => setDragOverAgreement(false)}
                          onDrop={async (e) => {
                            e.preventDefault();
                            setDragOverAgreement(false);
                            const files = e.dataTransfer.files;
                            if (files.length > 0) {
                              await handleAgreementUpload(files[0]);
                            }
                          }}
                          onClick={() => document.getElementById('agreement-upload-input').click()}
                          className={`border-2 border-dashed rounded-xl p-4 md:p-6 text-center cursor-pointer transition-colors ${
                            dragOverAgreement
                              ? 'border-[#AE020B] bg-red-50/10'
                              : 'border-gray-200 dark:border-zinc-800 hover:border-[#AE020B]'
                          }`}
                        >
                          <input
                            type="file"
                            id="agreement-upload-input"
                            accept=".pdf"
                            className="hidden"
                            onChange={async (e) => {
                              const files = e.target.files;
                              if (files.length > 0) {
                                await handleAgreementUpload(files[0]);
                              }
                            }}
                          />
                          <FiUploadCloud className="text-2xl md:text-3xl text-gray-400 dark:text-zinc-650 mx-auto mb-1.5 md:mb-2" />
                          <p className="text-xs font-bold text-gray-700 dark:text-zinc-350">
                            Drag & Drop Signed PDF or Browse
                          </p>
                          <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-0.5">
                            PDF only (Max 10 MB)
                          </p>
                        </div>

                        {uploadingAgreement && (
                          <p className="text-xs text-blue-500 font-semibold text-center animate-pulse">
                            Uploading signed agreement...
                          </p>
                        )}

                        {uploadedAgreement && (
                          <div className="bg-gray-50 dark:bg-zinc-900 p-2.5 md:p-3 rounded-lg border dark:border-zinc-850 flex items-center justify-between">
                            <div className="flex items-center gap-2 max-w-[80%]">
                              <FiFileText className="text-lg md:text-xl text-[#AE020B]" />
                              <div className="overflow-hidden">
                                <p className="text-xs font-bold text-gray-800 dark:text-zinc-200 truncate">
                                  {uploadedAgreement.fileName}
                                </p>
                                <p className="text-[10px] text-gray-400">
                                  {(uploadedAgreement.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setUploadedAgreement(null)}
                              className="text-red-500 hover:bg-gray-200 dark:hover:bg-zinc-850 p-1.5 rounded-lg transition-colors"
                              title="Remove File"
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        )}
                      </div>

                      <button type="button" onClick={() => { if (validateStep1()) setB2bStep(2); }} className="w-full bg-[#AE020B] hover:bg-[#8d0208] text-white py-2.5 md:py-3.5 rounded-xl font-bold text-xs md:text-base transition-all duration-300 uppercase tracking-wider active:scale-[0.99]">Next: Admin Information</button>
                    </div>
                  )}

                  {b2bStep === 2 && (
                    <div className="space-y-3 md:space-y-4">
                      <div>
                        <label className="block text-xs md:text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1 md:mb-1.5">Admin Name *</label>
                        <input type="text" name="adminName" value={b2bData.adminName} onChange={handleB2bChange} className="w-full px-3.5 md:px-4 py-2.5 md:py-3 rounded-xl border-2 border-gray-200 dark:border-zinc-800 focus:border-[#AE020B] bg-white dark:bg-zinc-950 text-gray-900 dark:text-white focus:outline-none text-xs md:text-base" placeholder="Sarkar Raj" />
                      </div>
                      <div>
                        <label className="block text-xs md:text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1 md:mb-1.5">Admin Email *</label>
                        <input type="email" name="adminEmail" value={b2bData.adminEmail} onChange={handleB2bChange} className="w-full px-3.5 md:px-4 py-2.5 md:py-3 rounded-xl border-2 border-gray-200 dark:border-zinc-800 focus:border-[#AE020B] bg-white dark:bg-zinc-950 text-gray-900 dark:text-white focus:outline-none text-xs md:text-base" placeholder="admin@apexenterprises.in" />
                      </div>
                      <div>
                        <label className="block text-xs md:text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1 md:mb-1.5">Admin Phone *</label>
                        <input type="tel" name="adminPhone" value={b2bData.adminPhone} onChange={handleB2bChange} className="w-full px-3.5 md:px-4 py-2.5 md:py-3 rounded-xl border-2 border-gray-200 dark:border-zinc-800 focus:border-[#AE020B] bg-white dark:bg-zinc-950 text-gray-900 dark:text-white focus:outline-none text-xs md:text-base" placeholder="9876543210" />
                      </div>
                      <div>
                        <label className="block text-xs md:text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1 md:mb-1.5">Password *</label>
                        <div className="relative">
                          <input type={showPassword ? 'text' : 'password'} name="password" value={b2bData.password} onChange={handleB2bChange} className="w-full pl-3.5 md:pl-4 pr-10 md:pr-12 py-2.5 md:py-3 rounded-xl border-2 border-gray-200 dark:border-zinc-800 focus:border-[#AE020B] bg-white dark:bg-zinc-950 text-gray-900 dark:text-white focus:outline-none text-xs md:text-base" placeholder="Create admin password" />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 md:right-4 top-1/2 transform -translate-y-1/2 text-gray-400"><FiEye size={18} /></button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs md:text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1 md:mb-1.5">Confirm Password *</label>
                        <div className="relative">
                          <input type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword" value={b2bData.confirmPassword} onChange={handleB2bChange} className="w-full pl-3.5 md:pl-4 pr-10 md:pr-12 py-2.5 md:py-3 rounded-xl border-2 border-gray-200 dark:border-zinc-800 focus:border-[#AE020B] bg-white dark:bg-zinc-950 text-gray-900 dark:text-white focus:outline-none text-xs md:text-base" placeholder="Confirm admin password" />
                          <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3.5 md:right-4 top-1/2 transform -translate-y-1/2 text-gray-400"><FiEye size={18} /></button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs md:text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1 md:mb-1.5">Company Owner Secret Key *</label>
                        <div className="relative">
                          <input type={showSecretKey ? 'text' : 'password'} name="secretKey" value={b2bData.secretKey} onChange={handleB2bChange} className="w-full pl-3.5 md:pl-4 pr-10 md:pr-12 py-2.5 md:py-3 rounded-xl border-2 border-gray-200 dark:border-zinc-800 focus:border-[#AE020B] bg-white dark:bg-zinc-950 text-gray-900 dark:text-white focus:outline-none text-xs md:text-base" placeholder="Min 6 characters (For handover protection)" />
                          <button type="button" onClick={() => setShowSecretKey(!showSecretKey)} className="absolute right-3.5 md:right-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                            {showSecretKey ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs md:text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1 md:mb-1.5">Confirm Secret Key *</label>
                        <div className="relative">
                          <input type={showConfirmSecretKey ? 'text' : 'password'} name="confirmSecretKey" value={b2bData.confirmSecretKey} onChange={handleB2bChange} className="w-full pl-3.5 md:pl-4 pr-10 md:pr-12 py-2.5 md:py-3 rounded-xl border-2 border-gray-200 dark:border-zinc-800 focus:border-[#AE020B] bg-white dark:bg-zinc-950 text-gray-900 dark:text-white focus:outline-none text-xs md:text-base" placeholder="Confirm Owner Secret Key" />
                          <button type="button" onClick={() => setShowConfirmSecretKey(!showConfirmSecretKey)} className="absolute right-3.5 md:right-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                            {showConfirmSecretKey ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-2.5 md:gap-3 pt-2">
                        <button type="button" onClick={() => setB2bStep(1)} className="flex-1 border-2 border-gray-200 dark:border-zinc-800 hover:bg-gray-50 text-gray-700 py-2.5 md:py-3 rounded-xl font-bold text-xs md:text-sm">Back</button>
                        <button type="button" onClick={() => { if (validateStep2()) setB2bStep(3); }} className="flex-1 bg-[#AE020B] hover:bg-[#8d0208] text-white py-2.5 md:py-3 rounded-xl font-bold text-xs md:text-sm">Next: Employees</button>
                      </div>
                    </div>
                  )}

                  {b2bStep === 3 && (
                    <div className="space-y-3.5 md:space-y-4 text-xs font-semibold">
                      <div className="border border-gray-150 p-3.5 md:p-4 rounded-xl bg-gray-50 dark:bg-zinc-900 space-y-2.5 md:space-y-3">
                        <h3 className="font-bold text-xs md:text-sm text-gray-800 dark:text-zinc-100 flex items-center gap-1.5">Add Employee</h3>
                        <div>
                          <label className="block text-gray-600 dark:text-zinc-400 mb-1">Employee Name *</label>
                          <input type="text" name="name" value={empInput.name} onChange={handleEmpChange} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-zinc-950 text-gray-900 dark:text-white text-xs" placeholder="John Doe" />
                        </div>
                        <div>
                          <label className="block text-gray-600 dark:text-zinc-400 mb-1">Employee Email *</label>
                          <input type="email" name="email" value={empInput.email} onChange={handleEmpChange} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-zinc-950 text-gray-900 dark:text-white text-xs" placeholder="john@apexenterprises.in" />
                        </div>
                        <div>
                          <label className="block text-gray-600 dark:text-zinc-400 mb-1">Employee Phone *</label>
                          <input type="tel" name="phone" value={empInput.phone} onChange={handleEmpChange} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-zinc-950 text-gray-900 dark:text-white text-xs" placeholder="9876500003" />
                        </div>
                        <div>
                          <label className="block text-gray-600 dark:text-zinc-400 mb-1">Designation *</label>
                          <input type="text" name="designation" value={empInput.designation} onChange={handleEmpChange} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-zinc-950 text-gray-900 dark:text-white text-xs" placeholder="Purchase Manager" />
                        </div>
                        <div>
                          <label className="block text-gray-600 dark:text-zinc-400 mb-1">Department</label>
                          <input type="text" name="department" value={empInput.department} onChange={handleEmpChange} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-zinc-950 text-gray-900 dark:text-white text-xs" placeholder="E.g. Procurement" />
                        </div>
                        <div>
                          <label className="block text-gray-600 dark:text-zinc-400 mb-1">Address</label>
                          <textarea name="address" value={empInput.address} onChange={handleEmpChange} rows="2" className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-zinc-950 text-gray-900 dark:text-white text-xs" placeholder="Employee Address"></textarea>
                        </div>
                        <div>
                          <label className="block text-gray-600 dark:text-zinc-400 mb-1">Password *</label>
                          <div className="relative">
                            <input type={showEmpPassword ? 'text' : 'password'} name="password" value={empInput.password || ''} onChange={(e) => setEmpInput(prev => ({ ...prev, password: e.target.value }))} className="w-full pl-3 pr-10 py-2 border rounded-lg bg-white dark:bg-zinc-950 text-gray-900 dark:text-white text-xs" placeholder="Employee password" />
                            <button type="button" onClick={() => setShowEmpPassword(!showEmpPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                              {showEmpPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-gray-600 dark:text-zinc-400 mb-1">Confirm Password *</label>
                          <div className="relative">
                            <input type={showEmpConfirmPassword ? 'text' : 'password'} value={empConfirmPassword} onChange={(e) => setEmpConfirmPassword(e.target.value)} className="w-full pl-3 pr-10 py-2 border rounded-lg bg-white dark:bg-zinc-950 text-gray-900 dark:text-white text-xs" placeholder="Confirm password" />
                            <button type="button" onClick={() => setShowEmpConfirmPassword(!showEmpConfirmPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                              {showEmpConfirmPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                            </button>
                          </div>
                        </div>
                        <button type="button" onClick={() => {
                          if (!empInput.name || !empInput.email || !empInput.phone || !empInput.designation || !empInput.password) {
                            toast.error('All employee fields including password are required.');
                            return;
                          }
                          if (empInput.password !== empConfirmPassword) {
                            toast.error('Employee passwords do not match.');
                            return;
                          }
                          handleAddEmployee();
                          setEmpConfirmPassword('');
                        }} className="w-full py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-bold">Add to Team</button>
                      </div>

                      {employees.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-bold text-gray-800 dark:text-zinc-150">Added Team Members ({employees.length})</h4>
                          <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto border border-gray-100 rounded-xl bg-white dark:bg-zinc-950">
                            {employees.map((emp, index) => (
                              <div key={index} className="p-3 space-y-2 text-xs border-b last:border-b-0 dark:border-zinc-800">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <p className="font-bold text-gray-800 dark:text-zinc-105">{emp.name}</p>
                                    <p className="text-gray-500 font-semibold">{emp.email} • {emp.designation}</p>
                                  </div>
                                  <button type="button" onClick={() => handleRemoveEmployee(index)} className="text-red-650 font-bold hover:underline">Remove</button>
                                </div>
                                <div className="bg-gray-50 dark:bg-zinc-900 p-2 rounded-lg space-y-1 border dark:border-zinc-800">
                                  <p className="text-[10px] text-gray-400 font-bold">Credentials & Login Details:</p>
                                  <div className="flex flex-wrap gap-2 text-[10px]">
                                    <button type="button" onClick={() => {
                                      navigator.clipboard.writeText(`Email: ${emp.email}\nPassword: ${emp.password || 'Employee@123'}`);
                                      toast.success('Credentials copied to clipboard!');
                                    }} className="text-blue-500 hover:underline">Copy Credentials</button>
                                    <button type="button" onClick={() => {
                                      const loginLink = `${window.location.origin}/login`;
                                      navigator.clipboard.writeText(loginLink);
                                      toast.success('Login link copied to clipboard!');
                                    }} className="text-emerald-500 hover:underline">Copy Login Link</button>
                                    <button type="button" onClick={() => {
                                      toast.success(`Invitation resending simulated to ${emp.email}`);
                                    }} className="text-purple-550 hover:underline">Resend Invitation</button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col gap-2.5 md:gap-3 pt-2">
                        <div className="flex gap-2.5 md:gap-3">
                          <button type="button" onClick={() => setB2bStep(2)} className="flex-1 border-2 border-gray-200 dark:border-zinc-800 hover:bg-gray-50 text-gray-750 py-2.5 md:py-3 rounded-xl font-bold text-xs md:text-sm">Back</button>
                          <button type="submit" disabled={isB2BLoading} className="flex-1 bg-[#AE020B] hover:bg-[#8d0208] text-white py-2.5 md:py-3 rounded-xl font-bold text-xs md:text-sm">{isB2BLoading ? 'Registering...' : 'Register Company'}</button>
                        </div>
                        {employees.length === 0 && (
                          <button type="submit" disabled={isB2BLoading} className="w-full border-2 border-dashed border-[#AE020B] text-[#AE020B] hover:bg-red-50/50 dark:hover:bg-red-950/10 py-2.5 md:py-3 rounded-xl font-bold text-xs transition-colors">
                            {isB2BLoading ? 'Registering...' : 'Skip Employee Setup & Register Company'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </form>
              )}

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
