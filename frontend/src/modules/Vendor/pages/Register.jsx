import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiMail, FiLock, FiEye, FiEyeOff, FiUser, FiPhone, FiShoppingBag, FiMapPin, FiArrowLeft } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useVendorAuthStore } from "../store/vendorAuthStore";
import toast from 'react-hot-toast';
import api from '../../../shared/utils/api';

const VendorRegister = () => {
  const navigate = useNavigate();
  const { register: registerVendor, isLoading } = useVendorAuthStore();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    storeName: '',
    storeDescription: '',
    businessType: 'Other',
    gstRegistered: false,
    businessName: '',
    tradeName: '',
    gstNumber: '',
    panNumber: '',
    ownerName: '',
    businessAddress: '',
    city: '',
    state: '',
    pincode: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'USA',
    },
  });

  const companyTypeProofs = {
    'Private Limited': { label: 'Certificate of Incorporation (CIN)', mandatory: true },
    'LLP': { label: 'LLP Incorporation Certificate (LLPIN)', mandatory: true },
    'Proprietorship': { label: 'Business Registration Proof', mandatory: true },
    'Partnership': { label: 'Partnership Registration Proof', mandatory: true },
    'Home Business': { label: 'Business Registration Proof', mandatory: true },
    'Small Business': { label: 'Business Registration Proof', mandatory: true },
    'MSME': { label: 'Business Registration Proof', mandatory: true },
    'Startup': { label: 'Business Registration Proof', mandatory: true },
    'Public Limited': { label: 'Certificate of Incorporation (CIN)', mandatory: true },
    'Other': { label: 'Business Registration Proof', mandatory: true }
  };

  const [gstCertificateFile, setGstCertificateFile] = useState(null);
  const [msmeCertificateFile, setMsmeCertificateFile] = useState(null);
  const [identityProofFile, setIdentityProofFile] = useState(null);
  const [registrationProofFile, setRegistrationProofFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [generalSettings, setGeneralSettings] = useState(null);
  const [businessLetterFile, setBusinessLetterFile] = useState(null);
  const [businessLetterProgress, setBusinessLetterProgress] = useState(0);

  const [partnershipAgreementFile, setPartnershipAgreementFile] = useState(null);
  const [partnershipAgreementProgress, setPartnershipAgreementProgress] = useState(0);

  const handlePartnershipAgreementChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    const fileExt = file.name.split('.').pop().toLowerCase();
    const allowedExts = ['pdf', 'jpg', 'jpeg', 'png'];
    if (!allowedTypes.includes(file.mimetype || file.type) && !allowedExts.includes(fileExt)) {
      toast.error('Invalid file type. Only PDF, JPG, JPEG, and PNG are allowed.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds the 10MB limit.');
      return;
    }

    setPartnershipAgreementFile(file);
    setPartnershipAgreementProgress(10);
    const interval = setInterval(() => {
      setPartnershipAgreementProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 20;
      });
    }, 100);
  };

  const handleRemovePartnershipAgreement = () => {
    setPartnershipAgreementFile(null);
    setPartnershipAgreementProgress(0);
  };

  useEffect(() => {
    const fetchGeneralSettings = async () => {
      try {
        const res = await api.get('/settings/general');
        if (res?.data) {
          setGeneralSettings(res.data);
        }
      } catch (err) {
        console.error("Failed to load general settings:", err);
      }
    };
    fetchGeneralSettings();
  }, []);

  const handleBusinessLetterChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    const fileExt = file.name.split('.').pop().toLowerCase();
    const allowedExts = ['pdf', 'jpg', 'jpeg', 'png'];
    if (!allowedTypes.includes(file.mimetype || file.type) && !allowedExts.includes(fileExt)) {
      toast.error('Invalid file type. Only PDF, JPG, JPEG, and PNG are allowed.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds the 10MB limit.');
      return;
    }

    setBusinessLetterFile(file);
    setBusinessLetterProgress(10);
    const interval = setInterval(() => {
      setBusinessLetterProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 20;
      });
    }, 100);
  };

  const handleRemoveBusinessLetter = () => {
    setBusinessLetterFile(null);
    setBusinessLetterProgress(0);
  };

  const handleRegistrationProofChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    const fileExt = file.name.split('.').pop().toLowerCase();
    const allowedExts = ['pdf', 'jpg', 'jpeg', 'png'];
    if (!allowedTypes.includes(file.mimetype || file.type) && !allowedExts.includes(fileExt)) {
      toast.error('Invalid file type. Only PDF, JPG, JPEG, and PNG are allowed.');
      return;
    }

    // Validate size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds the 10MB limit.');
      return;
    }

    setRegistrationProofFile(file);

    // Simulate progress
    setUploadProgress(10);
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 15;
      });
    }, 100);
  };

  const handleRemoveRegistrationProof = () => {
    setRegistrationProofFile(null);
    setUploadProgress(0);
  };

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name.startsWith('address.')) {
      const addressField = name.split('.')[1];
      setFormData({
        ...formData,
        address: {
          ...formData.address,
          [addressField]: value,
        },
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.name || !formData.email || !formData.phone || !formData.password || !formData.storeName) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    // New verification fields validation
    if (formData.gstRegistered) {
      if (!formData.businessName || !formData.gstNumber || !formData.panNumber) {
        toast.error('Business Legal Name, GSTIN, and PAN are mandatory for GST registration.');
        return;
      }
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstRegex.test(formData.gstNumber.trim().toUpperCase())) {
        toast.error('Invalid GST Number format.');
        return;
      }
      if (!gstCertificateFile) {
        toast.error('Please upload your GST Certificate.');
        return;
      }
    } else {
      if (!formData.businessName || !formData.ownerName) {
        toast.error('Business Name and Owner Name are mandatory.');
        return;
      }
      if (!identityProofFile) {
        toast.error('Please upload an Identity Proof document.');
        return;
      }
    }

    // Dynamic Registration Proof validation
    const proofConfig = companyTypeProofs[formData.businessType];
    if (proofConfig && proofConfig.mandatory && !registrationProofFile) {
      toast.error(`Please upload your ${proofConfig.label}`);
      return;
    }

    // Signed Business Letter validation
    const isLetterRequired = generalSettings?.businessLetterRequiredTypes?.includes(formData.businessType);
    if (isLetterRequired && !businessLetterFile) {
      toast.error('Please upload the signed Business Declaration Letter.');
      return;
    }

    // Signed & Sealed Partnership Agreement validation
    const isAgreementRequired = generalSettings?.partnershipAgreementRequiredTypes?.includes(formData.businessType);
    if (isAgreementRequired && !partnershipAgreementFile) {
      toast.error('Please upload the signed & sealed Partnership Agreement.');
      return;
    }

    // Build multipart Form Data
    const data = new FormData();
    data.append('name', formData.name.trim());
    data.append('email', formData.email.trim().toLowerCase());
    data.append('password', formData.password);
    data.append('phone', formData.phone.trim());
    data.append('storeName', formData.storeName.trim());
    data.append('storeDescription', formData.storeDescription.trim());
    data.append('businessType', formData.businessType);
    data.append('address', JSON.stringify({
      street: formData.businessAddress || formData.address.street,
      city: formData.city || formData.address.city,
      state: formData.state || formData.address.state,
      zipCode: formData.pincode || formData.address.zipCode,
      country: 'USA'
    }));

    data.append('gstRegistered', String(formData.gstRegistered));
    data.append('businessName', formData.businessName.trim());
    data.append('tradeName', formData.tradeName.trim());
    data.append('gstNumber', formData.gstNumber.trim().toUpperCase());
    data.append('panNumber', formData.panNumber.trim().toUpperCase());
    data.append('ownerName', formData.ownerName.trim());
    data.append('businessAddress', formData.businessAddress.trim());
    data.append('city', formData.city.trim());
    data.append('state', formData.state.trim());
    data.append('pincode', formData.pincode.trim());

    if (formData.gstRegistered) {
      if (gstCertificateFile) {
        data.append('gstCertificate', gstCertificateFile);
      }
      if (msmeCertificateFile) {
        data.append('msmeCertificate', msmeCertificateFile);
      }
    } else {
      if (identityProofFile) {
        data.append('identityProof', identityProofFile);
      }
    }

    if (registrationProofFile) {
      data.append('registrationProof', registrationProofFile);
    }

    if (businessLetterFile) {
      data.append('businessLetter', businessLetterFile);
    }

    if (partnershipAgreementFile) {
      data.append('partnershipAgreement', partnershipAgreementFile);
    }

    try {
      const result = await registerVendor(data);
      toast.success(result.message || 'Registration successful!');
      navigate('/vendor/verification', { state: { email: formData.email } });
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message || 'Registration failed. Please try again.';
      toast.error(errorMsg);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-900 flex items-center justify-center p-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-3xl p-8 w-full max-w-2xl shadow-2xl max-h-[95vh] overflow-y-auto relative"
      >
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
            <FiShoppingBag className="text-white text-2xl" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-800 mb-2">Become a Vendor</h1>
          <p className="text-gray-600">Register your store, verify your email, then await admin approval</p>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <FiUser className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="John Doe"
                    className="w-full pl-12 pr-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 placeholder:text-gray-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <FiMail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="vendor@example.com"
                    className="w-full pl-12 pr-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 placeholder:text-gray-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <FiPhone className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+1234567890"
                    className="w-full pl-12 pr-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 placeholder:text-gray-400"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Business Type & GST Verification Details */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Business Verification Details</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Business Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="businessType"
                  value={formData.businessType}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800"
                  required
                >
                  <option value="Home Business">Home Business</option>
                  <option value="Small Business">Small Business</option>
                  <option value="MSME">MSME</option>
                  <option value="Startup">Startup</option>
                  <option value="Proprietorship">Proprietorship</option>
                  <option value="Partnership">Partnership</option>
                  <option value="LLP">LLP</option>
                  <option value="Private Limited">Private Limited</option>
                  <option value="Public Limited">Public Limited</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Dynamic Registration Proof Upload Field */}
              {companyTypeProofs[formData.businessType] && (
                <div className="bg-gray-50/50 p-4 rounded-2xl border-2 border-dashed border-gray-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {companyTypeProofs[formData.businessType].label}{' '}
                    {companyTypeProofs[formData.businessType].mandatory && <span className="text-red-500">*</span>}
                  </label>
                  
                  {registrationProofFile ? (
                    <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-200">
                      <div className="flex flex-col min-w-0 mr-4">
                        <span className="text-sm font-medium text-gray-800 truncate">
                          {registrationProofFile.name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {(registrationProofFile.size / (1024 * 1024)).toFixed(2)} MB
                        </span>
                        {uploadProgress > 0 && (
                          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                            <div 
                              className="bg-primary-600 h-1.5 rounded-full transition-all duration-300" 
                              style={{ width: `${uploadProgress}%` }}
                            ></div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <label className="cursor-pointer text-xs font-semibold text-primary-600 hover:text-primary-700">
                          Replace File
                          <input
                            type="file"
                            accept="application/pdf,image/jpeg,image/png,image/jpg"
                            onChange={handleRegistrationProofChange}
                            className="hidden"
                          />
                        </label>
                        <span className="text-gray-300 text-xs">|</span>
                        <button
                          type="button"
                          onClick={handleRemoveRegistrationProof}
                          className="text-xs font-semibold text-red-600 hover:text-red-700"
                        >
                          Remove File
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png,image/jpg"
                        onChange={handleRegistrationProofChange}
                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                        required={companyTypeProofs[formData.businessType].mandatory}
                      />
                      <p className="text-[11px] text-gray-500 mt-1">
                        Accepted formats: PDF, JPG, JPEG, PNG (Max size: 10MB)
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Signed Business Declaration Letter Upload Field */}
              {generalSettings?.businessLetterRequiredTypes?.includes(formData.businessType) && (
                <div className="bg-gray-50/50 p-4 rounded-2xl border-2 border-dashed border-gray-200 space-y-3">
                  <div className="flex flex-col gap-1">
                    <label className="block text-sm font-semibold text-gray-700">
                      Signed Business Declaration Letter <span className="text-red-500">*</span>
                    </label>
                    <p className="text-[11px] text-gray-500">
                      As a {formData.businessType}, you must upload a signed & stamped declaration letter.
                    </p>
                  </div>

                  {generalSettings.businessLetterTemplateUrl ? (
                    <div className="bg-primary-50/50 p-3 rounded-xl border border-primary-100 flex items-center justify-between text-xs">
                      <span className="text-gray-700 font-medium">Declaration Template:</span>
                      <a
                        href={generalSettings.businessLetterTemplateUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary-700 font-bold hover:underline"
                      >
                        Download Template ({generalSettings.businessLetterTemplateName || "Download"})
                      </a>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-100 text-xs text-yellow-800">
                      Warning: Template file is not set by admin. Please contact support, or upload your own letter.
                    </div>
                  )}

                  {businessLetterFile ? (
                    <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-200">
                      <div className="flex flex-col min-w-0 mr-4">
                        <span className="text-sm font-medium text-gray-800 truncate">
                          {businessLetterFile.name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {(businessLetterFile.size / (1024 * 1024)).toFixed(2)} MB
                        </span>
                        {businessLetterProgress > 0 && (
                          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                            <div 
                              className="bg-primary-600 h-1.5 rounded-full transition-all duration-300" 
                              style={{ width: `${businessLetterProgress}%` }}
                            ></div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <label className="cursor-pointer text-xs font-semibold text-primary-600 hover:text-primary-700">
                          Replace File
                          <input
                            type="file"
                            accept="application/pdf,image/jpeg,image/png,image/jpg"
                            onChange={handleBusinessLetterChange}
                            className="hidden"
                          />
                        </label>
                        <span className="text-gray-300 text-xs">|</span>
                        <button
                          type="button"
                          onClick={handleRemoveBusinessLetter}
                          className="text-xs font-semibold text-red-600 hover:text-red-700"
                        >
                          Remove File
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png,image/jpg"
                        onChange={handleBusinessLetterChange}
                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                        required
                      />
                      <p className="text-[11px] text-gray-500 mt-1">
                        Accepted formats: PDF, JPG, JPEG, PNG (Max size: 10MB)
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Signed & Sealed Partnership Agreement Upload Field */}
              {generalSettings?.partnershipAgreementRequiredTypes?.includes(formData.businessType) && (
                <div className="bg-gray-50/50 p-4 rounded-2xl border-2 border-dashed border-gray-200 space-y-3">
                  <div className="flex flex-col gap-1">
                    <label className="block text-sm font-semibold text-gray-700">
                      Signed & Sealed Partnership Agreement <span className="text-red-500">*</span>
                    </label>
                    <p className="text-[11px] text-gray-500">
                      As a {formData.businessType}, you must upload a signed & sealed/stamped copy of the partnership agreement.
                    </p>
                  </div>

                  {generalSettings.partnershipAgreementTemplateUrl ? (
                    <div className="bg-primary-50/50 p-3 rounded-xl border border-primary-100 flex items-center justify-between text-xs">
                      <span className="text-gray-700 font-medium">Agreement Template:</span>
                      <a
                        href={generalSettings.partnershipAgreementTemplateUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary-700 font-bold hover:underline"
                      >
                        Download Template ({generalSettings.partnershipAgreementTemplateName || "Download"})
                      </a>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-100 text-xs text-yellow-800">
                      Warning: Template file is not set by admin. Please contact support, or upload your own signed agreement.
                    </div>
                  )}

                  {partnershipAgreementFile ? (
                    <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-200">
                      <div className="flex flex-col min-w-0 mr-4">
                        <span className="text-sm font-medium text-gray-800 truncate">
                          {partnershipAgreementFile.name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {(partnershipAgreementFile.size / (1024 * 1024)).toFixed(2)} MB
                        </span>
                        {partnershipAgreementProgress > 0 && (
                          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                            <div 
                              className="bg-primary-600 h-1.5 rounded-full transition-all duration-300" 
                              style={{ width: `${partnershipAgreementProgress}%` }}
                            ></div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <label className="cursor-pointer text-xs font-semibold text-primary-600 hover:text-primary-700">
                          Replace File
                          <input
                            type="file"
                            accept="application/pdf,image/jpeg,image/png,image/jpg"
                            onChange={handlePartnershipAgreementChange}
                            className="hidden"
                          />
                        </label>
                        <span className="text-gray-300 text-xs">|</span>
                        <button
                          type="button"
                          onClick={handleRemovePartnershipAgreement}
                          className="text-xs font-semibold text-red-600 hover:text-red-700"
                        >
                          Remove File
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png,image/jpg"
                        onChange={handlePartnershipAgreementChange}
                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                        required
                      />
                      <p className="text-[11px] text-gray-500 mt-1">
                        Accepted formats: PDF, JPG, JPEG, PNG (Max size: 10MB)
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Are you GST Registered? <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="gstRegistered"
                      checked={formData.gstRegistered === true}
                      onChange={() => setFormData({ ...formData, gstRegistered: true })}
                      className="w-5 h-5 text-primary-600 border-gray-300 focus:ring-primary-500"
                    />
                    <span className="text-sm font-semibold text-gray-700">Yes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="gstRegistered"
                      checked={formData.gstRegistered === false}
                      onChange={() => setFormData({ ...formData, gstRegistered: false })}
                      className="w-5 h-5 text-primary-600 border-gray-300 focus:ring-primary-500"
                    />
                    <span className="text-sm font-semibold text-gray-700">No</span>
                  </label>
                </div>
              </div>

              {formData.gstRegistered ? (
                /* GST Registered Fields */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50/50 p-4 rounded-2xl border-2 border-dashed border-gray-200">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Business Legal Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="businessName"
                      value={formData.businessName}
                      onChange={handleChange}
                      placeholder="As per GST registry"
                      className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Trade Name</label>
                    <input
                      type="text"
                      name="tradeName"
                      value={formData.tradeName}
                      onChange={handleChange}
                      placeholder="e.g. Brand Name"
                      className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      GST Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="gstNumber"
                      value={formData.gstNumber}
                      onChange={handleChange}
                      placeholder="15-digit GSTIN"
                      className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 text-sm font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      PAN Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="panNumber"
                      value={formData.panNumber}
                      onChange={handleChange}
                      placeholder="10-digit PAN"
                      className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 text-sm font-mono"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      GST Certificate (PDF/Image) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={(e) => setGstCertificateFile(e.target.files[0])}
                      className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      MSME Certificate (Optional)
                    </label>
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={(e) => setMsmeCertificateFile(e.target.files[0])}
                      className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                    />
                  </div>
                </div>
              ) : (
                /* Non-GST Registered Fields */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50/50 p-4 rounded-2xl border-2 border-dashed border-gray-200">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Business Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="businessName"
                      value={formData.businessName}
                      onChange={handleChange}
                      placeholder="Name of your business"
                      className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Owner Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="ownerName"
                      value={formData.ownerName}
                      onChange={handleChange}
                      placeholder="Full name of owner"
                      className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 text-sm"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Identity Proof (Aadhaar/PAN/Passport) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={(e) => setIdentityProofFile(e.target.files[0])}
                      className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Address details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50/30 p-4 rounded-2xl border border-gray-150">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Business Address</label>
                  <input
                    type="text"
                    name="businessAddress"
                    value={formData.businessAddress}
                    onChange={handleChange}
                    placeholder="Street, locality"
                    className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">City</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="City"
                    className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">State</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    placeholder="State"
                    className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Pincode</label>
                  <input
                    type="text"
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleChange}
                    placeholder="Pincode"
                    className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Store Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Store Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Store Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <FiShoppingBag className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    name="storeName"
                    value={formData.storeName}
                    onChange={handleChange}
                    placeholder="My Awesome Store"
                    className="w-full pl-12 pr-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 placeholder:text-gray-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Store Description
                </label>
                <textarea
                  name="storeDescription"
                  value={formData.storeDescription}
                  onChange={handleChange}
                  placeholder="Describe your store and products..."
                  rows={3}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 placeholder:text-gray-400"
                />
              </div>
            </div>
          </div>

          {/* Password */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Account Security</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <FiLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Minimum 6 characters"
                    className="w-full pl-12 pr-12 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 placeholder:text-gray-400"
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

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <FiLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Re-enter password"
                    className="w-full pl-12 pr-12 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 placeholder:text-gray-400"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Info Message */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> You must verify your email first, then your registration will be reviewed by admin.
              You will receive an email when your account is approved or rejected.
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full gradient-green text-white py-3 rounded-xl font-semibold hover:shadow-glow-green transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Registering...' : 'Register as Vendor'}
          </button>

          {/* Login Link */}
          <div className="text-center pt-4">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link
                to="/vendor/login"
                className="text-primary-600 hover:text-primary-700 font-semibold"
              >
                Login
              </Link>
            </p>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default VendorRegister;
