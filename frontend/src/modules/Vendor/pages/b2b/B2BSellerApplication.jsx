import { useState, useEffect } from 'react';
import { 
  FiCheckCircle, 
  FiAlertCircle, 
  FiXCircle, 
  FiUploadCloud, 
  FiFileText, 
  FiShield, 
  FiArrowRight, 
  FiClock, 
  FiLock, 
  FiUnlock, 
  FiInfo,
  FiExternalLink,
  FiRefreshCw
} from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { 
  getB2BApplication, 
  submitB2BApplication, 
  uploadB2BGstCertificate 
} from '../../services/vendorService';
import { useVendorAuthStore } from '../../store/vendorAuthStore';

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const B2BSellerApplication = () => {
  const { vendor, refreshProfile } = useVendorAuthStore();
  const isManagedVendor = vendor?.role === 'managed_vendor';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const [appData, setAppData] = useState({
    b2bSellingStatus: 'not_applied',
    b2bSellingGstStatus: 'gst_registered',
    b2bSellingGstNumber: '',
    b2bSellingGstCertificate: '',
    b2bSellingLegalName: '',
    b2bSellingTradeName: '',
    b2bSellingPan: '',
    b2bSellingAddress: '',
    b2bSellingCity: '',
    b2bSellingState: '',
    b2bSellingPincode: '',
    b2bSellingDeclaration: '',
    b2bSellingAppliedAt: null,
    b2bSellingApprovedAt: null,
    b2bSellingRejectedAt: null,
    b2bSellingRejectionReason: '',
  });

  const [fileToUpload, setFileToUpload] = useState(null);

  const fetchApplication = async () => {
    setLoading(true);
    try {
      const res = await getB2BApplication();
      const data = res?.data ?? res;
      if (data) {
        setAppData({
          b2bSellingStatus: data.b2bSellingStatus || 'not_applied',
          b2bSellingGstStatus: data.b2bSellingGstStatus || 'gst_registered',
          b2bSellingGstNumber: data.b2bSellingGstNumber || '',
          b2bSellingGstCertificate: data.b2bSellingGstCertificate || '',
          b2bSellingLegalName: data.b2bSellingLegalName || '',
          b2bSellingTradeName: data.b2bSellingTradeName || '',
          b2bSellingPan: data.b2bSellingPan || '',
          b2bSellingAddress: data.b2bSellingAddress || '',
          b2bSellingCity: data.b2bSellingCity || '',
          b2bSellingState: data.b2bSellingState || '',
          b2bSellingPincode: data.b2bSellingPincode || '',
          b2bSellingDeclaration: data.b2bSellingDeclaration || '',
          b2bSellingAppliedAt: data.b2bSellingAppliedAt,
          b2bSellingApprovedAt: data.b2bSellingApprovedAt,
          b2bSellingRejectedAt: data.b2bSellingRejectedAt,
          b2bSellingRejectionReason: data.b2bSellingRejectionReason || '',
        });
      }
    } catch (err) {
      console.error('Failed to fetch B2B application:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplication();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let formattedVal = value;

    if (name === 'b2bSellingGstNumber') {
      formattedVal = value.toUpperCase().trim();
      // Auto-populate PAN from GST if valid length (Chars 3 to 12)
      if (formattedVal.length >= 12 && !appData.b2bSellingPan) {
        const extractedPan = formattedVal.substring(2, 12);
        setAppData((prev) => ({
          ...prev,
          b2bSellingGstNumber: formattedVal,
          b2bSellingPan: extractedPan,
        }));
        return;
      }
    } else if (name === 'b2bSellingPan') {
      formattedVal = value.toUpperCase().trim();
    }

    setAppData((prev) => ({
      ...prev,
      [name]: formattedVal,
    }));
  };

  const handleFileSelection = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowed.includes(file.type)) {
      toast.error('Only PDF, JPG, JPEG, and PNG files are allowed for GST Certificate.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be under 10MB.');
      return;
    }
    setFileToUpload(file);
  };

  const handleUploadCertificate = async () => {
    if (!fileToUpload) {
      toast.error('Please select a file first.');
      return;
    }

    setUploadingDoc(true);
    const toastId = toast.loading('Uploading GST Certificate...');
    try {
      const res = await uploadB2BGstCertificate(fileToUpload);
      const data = res?.data ?? res;
      if (data?.fileUrl) {
        setAppData((prev) => ({
          ...prev,
          b2bSellingGstCertificate: data.fileUrl,
        }));
        setFileToUpload(null);
        toast.success('GST Certificate uploaded successfully!', { id: toastId });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed', { id: toastId });
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    if (!appData.b2bSellingLegalName.trim()) {
      toast.error('Please enter your Legal Business Name.');
      setSubmitting(false);
      return;
    }
    if (!appData.b2bSellingGstNumber.trim()) {
      toast.error('GST registration is mandatory for B2B selling. Please enter your GST Number.');
      setSubmitting(false);
      return;
    }
    if (!GST_REGEX.test(appData.b2bSellingGstNumber.trim())) {
      toast.error('Invalid GST Number format (15 characters expected, e.g., 22AAAAA0000A1Z5).');
      setSubmitting(false);
      return;
    }
    if (!appData.b2bSellingGstCertificate) {
      toast.error('Please upload your GST Certificate document before submitting.');
      setSubmitting(false);
      return;
    }
    if (!appData.b2bSellingPan.trim()) {
      toast.error('Please enter your PAN Number.');
      setSubmitting(false);
      return;
    }

    try {
      const payload = {
        gstStatus: 'gst_registered',
        gstNumber: appData.b2bSellingGstNumber,
        gstCertificate: appData.b2bSellingGstCertificate,
        legalName: appData.b2bSellingLegalName,
        tradeName: appData.b2bSellingTradeName,
        panNumber: appData.b2bSellingPan,
        address: appData.b2bSellingAddress,
        city: appData.b2bSellingCity,
        state: appData.b2bSellingState,
        pincode: appData.b2bSellingPincode,
        declaration: appData.b2bSellingDeclaration,
      };

      const res = await submitB2BApplication(payload);
      const data = res?.data ?? res;
      toast.success('B2B Seller Application submitted successfully!');
      
      setAppData((prev) => ({
        ...prev,
        b2bSellingStatus: data.b2bSellingStatus || 'pending',
        b2bSellingAppliedAt: data.b2bSellingAppliedAt || new Date().toISOString(),
      }));

      // Refresh vendor profile in store
      if (refreshProfile) {
        await refreshProfile();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const isGstValid = GST_REGEX.test(appData.b2bSellingGstNumber);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-primary-900 via-indigo-900 to-purple-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold uppercase tracking-wider mb-3 text-purple-200 border border-white/10">
            <FiShield className="text-sm" />
            Wholesale Seller Program
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            B2B Marketplace Seller Application
          </h1>
          <p className="mt-2 text-sm sm:text-base text-gray-200 leading-relaxed">
            Expand your business by selling bulk quantities directly to verified business buyers, corporate clients, and wholesalers across India.
          </p>
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 pointer-events-none flex items-center justify-center">
          <FiShield className="text-[200px]" />
        </div>
      </div>

      {/* Status Notice / Banner */}
      {isManagedVendor ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-4">
          <FiInfo className="text-2xl text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-base font-bold text-amber-900">Managed Vendor Account</h3>
            <p className="text-sm text-amber-800 mt-1">
              Your account is managed by the Shop Administrator. Products submitted by you are automatically routed for channel review and published to B2B or B2C directly by the Admin.
            </p>
          </div>
        </div>
      ) : (
        <>
          {appData.b2bSellingStatus === 'approved' && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-green-50 border-2 border-green-500 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-500 text-white flex items-center justify-center shrink-0 shadow-md">
                  <FiCheckCircle className="text-2xl" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 bg-green-200 text-green-800 rounded-md">
                      Verified & Active
                    </span>
                    <span className="text-xs text-gray-500">
                      Approved on: {appData.b2bSellingApprovedAt ? new Date(appData.b2bSellingApprovedAt).toLocaleDateString() : 'Active'}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-green-950 mt-1">
                    B2B Selling Authorization Approved!
                  </h3>
                  <p className="text-sm text-green-800 mt-0.5">
                    Your GST details have been verified. You can now publish wholesale products, create bulk tier discounts, and respond to buyer RFQs.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 shrink-0 w-full sm:w-auto">
                <Link
                  to="/vendor/products/add-product"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl text-sm shadow-md transition-all"
                >
                  <FiUnlock className="text-base" /> Add B2B Product
                </Link>
              </div>
            </motion.div>
          )}

          {appData.b2bSellingStatus === 'pending' && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
                  <FiClock className="text-2xl animate-spin" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 bg-amber-200 text-amber-900 rounded-md">
                      Pending Admin Review
                    </span>
                    <span className="text-xs text-gray-500">
                      Submitted: {appData.b2bSellingAppliedAt ? new Date(appData.b2bSellingAppliedAt).toLocaleString() : 'Recently'}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-amber-950 mt-1">
                    Application Under Verification
                  </h3>
                  <p className="text-sm text-amber-800 mt-0.5">
                    Your B2B Seller Application and GST certificate are being reviewed by the compliance admin. Verification usually takes 24-48 hours.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={fetchApplication}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold rounded-xl text-xs transition-colors shrink-0"
              >
                <FiRefreshCw className="text-xs" /> Refresh Status
              </button>
            </motion.div>
          )}

          {appData.b2bSellingStatus === 'rejected' && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border-2 border-red-400 rounded-2xl p-6 shadow-sm space-y-3"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-red-500 text-white flex items-center justify-center shrink-0 shadow-md">
                  <FiXCircle className="text-2xl" />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 bg-red-200 text-red-900 rounded-md">
                    Application Rejected
                  </span>
                  <h3 className="text-lg font-bold text-red-950 mt-1">
                    Verification Could Not Be Completed
                  </h3>
                  {appData.b2bSellingRejectionReason && (
                    <div className="mt-2 p-3 bg-white rounded-lg border border-red-200 text-sm text-red-800">
                      <strong>Admin Remark:</strong> {appData.b2bSellingRejectionReason}
                    </div>
                  )}
                  <p className="text-xs text-red-700 mt-2">
                    Please correct the required details or upload a valid GST Certificate document below and resubmit for review.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {appData.b2bSellingStatus === 'not_applied' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-start gap-4">
              <FiLock className="text-2xl text-blue-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-bold text-blue-900">B2B Selling is Currently Locked</h3>
                <p className="text-sm text-blue-800 mt-1 leading-relaxed">
                  Third-party vendor accounts require verified business details and GST registration to list products on the wholesale B2B marketplace. Fill out the application below to unlock B2B sales.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Application Form */}
      {!isManagedVendor && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8 space-y-8">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {appData.b2bSellingStatus === 'rejected' ? 'Update & Resubmit Application' : 'Business & GST Information'}
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Provide authentic tax and registration information for compliance verification.
            </p>
          </div>

          {/* GST requirement notice */}
          <div className="p-4 bg-primary-50/50 border border-primary-200 rounded-xl flex items-start gap-3">
            <FiShield className="text-xl text-primary-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm text-primary-950">GST registration is mandatory</h4>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                Only GST-registered sellers can apply for B2B wholesale selling. You need a valid GSTIN and your GST registration certificate. Sellers without GST can continue selling in B2C retail.
              </p>
            </div>
          </div>

          {/* Conditional Form Content */}
          <AnimatePresence mode="wait">
            {(
              <motion.div
                key="gst-form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 border-t border-gray-100 pt-6"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* GST Number */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      GST Identification Number (GSTIN) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        name="b2bSellingGstNumber"
                        maxLength={15}
                        placeholder="22AAAAA0000A1Z5"
                        value={appData.b2bSellingGstNumber}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-2.5 text-sm font-mono uppercase tracking-wider rounded-xl border focus:outline-none focus:ring-2 ${
                          appData.b2bSellingGstNumber
                            ? isGstValid
                              ? 'border-green-500 focus:ring-green-400 bg-green-50/20'
                              : 'border-amber-400 focus:ring-amber-400 bg-amber-50/20'
                            : 'border-gray-300 focus:ring-primary-500'
                        }`}
                        required
                      />
                      {appData.b2bSellingGstNumber && (
                        <div className="absolute right-3 top-2.5 text-xs font-bold">
                          {isGstValid ? (
                            <span className="text-green-600 flex items-center gap-1">
                              <FiCheckCircle /> Valid Format
                            </span>
                          ) : (
                            <span className="text-amber-600 flex items-center gap-1">
                              <FiAlertCircle /> 15 chars req.
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">15-digit alphanumeric Indian GST number</p>
                  </div>

                  {/* PAN Number */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      PAN Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="b2bSellingPan"
                      maxLength={10}
                      placeholder="AAAAA0000A"
                      value={appData.b2bSellingPan}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 text-sm font-mono uppercase tracking-wider rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                    <p className="text-[11px] text-gray-400 mt-1">Permanent Account Number associated with entity</p>
                  </div>

                  {/* Legal Business Name */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Legal Business Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="b2bSellingLegalName"
                      placeholder="e.g. Acme Enterprise Private Limited"
                      value={appData.b2bSellingLegalName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                    <p className="text-[11px] text-gray-400 mt-1">Must match legal name on GST certificate</p>
                  </div>

                  {/* Trade Name */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Trade / Brand Name
                    </label>
                    <input
                      type="text"
                      name="b2bSellingTradeName"
                      placeholder="e.g. Acme Stores"
                      value={appData.b2bSellingTradeName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">Operating name or storefront brand</p>
                  </div>
                </div>

                {/* GST Certificate Upload Section */}
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                        <FiFileText className="text-primary-600" />
                        GST Registration Certificate (Form REG-06) <span className="text-red-500">*</span>
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Upload official certificate issued by the GST department (PDF, JPG, or PNG under 10MB)
                      </p>
                    </div>
                  </div>

                  {/* Upload box */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                    <div>
                      <input
                        type="file"
                        id="gst-cert-input"
                        accept=".pdf,image/png,image/jpeg,image/jpg"
                        onChange={handleFileSelection}
                        className="hidden"
                      />
                      <label
                        htmlFor="gst-cert-input"
                        className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-gray-300 rounded-xl hover:border-primary-500 hover:bg-white cursor-pointer transition-all bg-white/50 text-center"
                      >
                        <FiUploadCloud className="text-3xl text-gray-400 mb-1.5" />
                        <span className="text-xs font-semibold text-gray-700">
                          {fileToUpload ? fileToUpload.name : 'Click to select GST document'}
                        </span>
                        <span className="text-[10px] text-gray-400 mt-0.5">PDF or Image up to 10MB</span>
                      </label>
                    </div>

                    <div className="space-y-3">
                      {fileToUpload && (
                        <button
                          type="button"
                          onClick={handleUploadCertificate}
                          disabled={uploadingDoc}
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                        >
                          {uploadingDoc ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              Uploading...
                            </>
                          ) : (
                            <>
                              <FiUploadCloud className="text-sm" /> Confirm Document Upload
                            </>
                          )}
                        </button>
                      )}

                      {appData.b2bSellingGstCertificate ? (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <FiCheckCircle className="text-green-600 text-base shrink-0" />
                            <span className="text-xs font-semibold text-green-900 truncate">
                              GST Certificate Uploaded
                            </span>
                          </div>
                          <a
                            href={appData.b2bSellingGstCertificate}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-primary-600 hover:text-primary-800 flex items-center gap-1 shrink-0 ml-2"
                          >
                            View <FiExternalLink className="text-[10px]" />
                          </a>
                        </div>
                      ) : (
                        <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200">
                          ⚠️ GST Certificate is mandatory for B2B wholesale selling authorization.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Registered Address */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Registered Business Address
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Street Address</label>
                      <input
                        type="text"
                        name="b2bSellingAddress"
                        placeholder="Plot No., Building, Industrial Area"
                        value={appData.b2bSellingAddress}
                        onChange={handleInputChange}
                        className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                      <input
                        type="text"
                        name="b2bSellingCity"
                        placeholder="e.g. Mumbai"
                        value={appData.b2bSellingCity}
                        onChange={handleInputChange}
                        className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
                      <input
                        type="text"
                        name="b2bSellingState"
                        placeholder="e.g. Maharashtra"
                        value={appData.b2bSellingState}
                        onChange={handleInputChange}
                        className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submission Button */}
          <div className="border-t border-gray-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-500">
              By submitting, you certify that all entered tax information and documents are authentic.
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-md hover:shadow-lg transition-all"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Submitting Application...
                </>
              ) : (
                <>
                  {appData.b2bSellingStatus === 'rejected' ? 'Resubmit Application' : 'Submit B2B Application'}
                  <FiArrowRight />
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default B2BSellerApplication;
