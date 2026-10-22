import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  FiCreditCard, 
  FiCheckCircle, 
  FiUploadCloud, 
  FiEye, 
  FiDownload, 
  FiAlertCircle, 
  FiFileText,
  FiLock
} from 'react-icons/fi';
import { useB2BAdminStore } from '../store/b2bAdminStore';
import toast from 'react-hot-toast';

const COMPANY_TYPES = [
  'Proprietorship',
  'Partnership Firm',
  'LLP (Limited Liability Partnership)',
  'Private Limited Company',
  'Public Limited Company',
  'One Person Company (OPC)',
  'Other'
];

const ACCOUNT_TYPES = [
  'Current',
  'Savings',
  'Other'
];

const CompanyProfile = () => {
  const { 
    companyProfile, 
    fetchCompanyProfile, 
    updateCompanyProfile, 
    uploadCompanyLegalDocument, 
    isLoading 
  } = useB2BAdminStore();

  const [formData, setFormData] = useState({
    companyName: '',
    businessEmail: '',
    businessPhone: '',
    companyAddress: '',
    website: '',
    gstNumber: '',
    companyType: '',
    adminName: '',
    adminEmail: '',
    adminPhone: '',
  });

  const [bankData, setBankData] = useState({
    accountHolderName: '',
    bankName: '',
    accountNumber: '',
    confirmAccountNumber: '',
    ifscCode: '',
    accountType: 'Current',
    branchName: '',
    upiId: '',
  });

  const [isSavingBank, setIsSavingBank] = useState(false);
  const [uploadingCheque, setUploadingCheque] = useState(false);

  useEffect(() => {
    fetchCompanyProfile();
  }, [fetchCompanyProfile]);

  useEffect(() => {
    if (companyProfile) {
      setFormData({
        companyName: companyProfile.companyName || '',
        businessEmail: companyProfile.businessEmail || '',
        businessPhone: companyProfile.businessPhone || '',
        companyAddress: companyProfile.companyAddress || '',
        website: companyProfile.website || '',
        gstNumber: companyProfile.gstNumber || '',
        companyType: companyProfile.companyType || '',
        adminName: companyProfile.admin?.name || '',
        adminEmail: companyProfile.admin?.email || '',
        adminPhone: companyProfile.admin?.phone || '',
      });

      const b = companyProfile.bankDetails || {};
      setBankData({
        accountHolderName: b.accountHolderName || companyProfile.companyName || '',
        bankName: b.bankName || '',
        accountNumber: b.accountNumber || '',
        confirmAccountNumber: b.accountNumber || '',
        ifscCode: b.ifscCode || '',
        accountType: b.accountType || 'Current',
        branchName: b.branchName || '',
        upiId: b.upiId || '',
      });
    }
  }, [companyProfile]);

  const handleGeneralSubmit = async (e) => {
    e.preventDefault();
    await updateCompanyProfile({
      businessPhone: formData.businessPhone,
      companyAddress: formData.companyAddress,
      website: formData.website,
      companyType: formData.companyType
    });
  };

  const handleBankSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!bankData.accountHolderName.trim()) {
      toast.error('Account Holder Name is required.');
      return;
    }
    if (!bankData.bankName.trim()) {
      toast.error('Bank Name is required.');
      return;
    }
    if (!bankData.accountNumber.trim()) {
      toast.error('Bank Account Number is required.');
      return;
    }
    if (bankData.accountNumber !== bankData.confirmAccountNumber) {
      toast.error('Bank Account Numbers do not match.');
      return;
    }
    if (!bankData.ifscCode.trim()) {
      toast.error('Bank IFSC Code is required.');
      return;
    }
    const cleanIfsc = bankData.ifscCode.trim().toUpperCase();
    if (cleanIfsc.length !== 11) {
      toast.error('IFSC code must be exactly 11 characters (e.g. HDFC0001234).');
      return;
    }

    setIsSavingBank(true);
    try {
      const success = await updateCompanyProfile({
        bankDetails: {
          accountHolderName: bankData.accountHolderName.trim(),
          bankName: bankData.bankName.trim(),
          accountNumber: bankData.accountNumber.trim(),
          ifscCode: cleanIfsc,
          accountType: bankData.accountType,
          branchName: bankData.branchName.trim(),
          upiId: bankData.upiId.trim(),
        }
      });
      if (success) {
        toast.success('Company Bank Details saved successfully!');
      }
    } finally {
      setIsSavingBank(false);
    }
  };

  const handleChequeUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds the 10MB limit.');
      return;
    }

    setUploadingCheque(true);
    try {
      const success = await uploadCompanyLegalDocument(file, 'cancelledCheque');
      if (success) {
        toast.success('Cancelled Cheque uploaded successfully!');
        await fetchCompanyProfile();
      }
    } finally {
      setUploadingCheque(false);
      e.target.value = '';
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Approved':
        return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Approved</span>;
      case 'Pending Verification':
        return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">Pending Verification</span>;
      case 'Rejected':
        return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Rejected</span>;
      case 'Suspended':
        return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">Suspended</span>;
      default:
        return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">{status || 'N/A'}</span>;
    }
  };

  if (isLoading && !companyProfile) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 max-w-4xl pb-12"
    >
      {/* Top Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Company Profile & Banking</h1>
          <p className="text-gray-600 text-sm mt-1">Manage corporate information, bank accounts, and settlement details.</p>
        </div>
        {companyProfile && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 font-medium">Status:</span>
            {getStatusBadge(companyProfile.verificationStatus)}
          </div>
        )}
      </div>

      {/* 1. General Company Profile */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <form onSubmit={handleGeneralSubmit} className="space-y-6">
          <div className="border-b border-gray-100 pb-4 mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Company General Details</h2>
            <p className="text-xs text-gray-500 mt-0.5">Primary legal identity and registered communication details.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
              <input type="text" disabled value={formData.companyName} className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed" />
              <p className="text-xs text-gray-500 mt-1">Contact Super Admin to change company name.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GST Number</label>
              <input type="text" disabled value={formData.gstNumber} className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed uppercase font-mono" />
              <p className="text-xs text-gray-500 mt-1">GST number cannot be edited after registration.</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Company Type</label>
                <Link to="/b2b-dashboard/legal-documents" className="text-xs font-semibold text-[#D71920] hover:underline flex items-center gap-1">
                  Manage Legal Document &rarr;
                </Link>
              </div>
              <select 
                value={formData.companyType} 
                onChange={(e) => setFormData({...formData, companyType: e.target.value})} 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D71920] outline-none bg-white text-sm"
              >
                <option value="">Select Company Type</option>
                {COMPANY_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              {companyProfile?.companyRegistrationProof?.url ? (
                <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1 font-medium">
                  ✓ Document Attached: <span className="font-semibold underline cursor-pointer" onClick={() => window.open(companyProfile.companyRegistrationProof.url, '_blank')}>{companyProfile.companyRegistrationProof.fileName || 'Registration Proof'}</span>
                </p>
              ) : (
                <p className="text-xs text-amber-600 mt-1">
                  ⚠️ No registration document uploaded. You can upload in Legal Documents.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input type="text" value={formData.website} onChange={(e) => setFormData({...formData, website: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D71920] outline-none text-sm" placeholder="https://" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Email</label>
              <input type="email" disabled value={formData.businessEmail} className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed text-sm" />
              <p className="text-xs text-gray-500 mt-1">Business email cannot be changed.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Phone</label>
              <input type="text" value={formData.businessPhone} onChange={(e) => setFormData({...formData, businessPhone: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D71920] outline-none text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Address</label>
            <textarea rows="3" value={formData.companyAddress} onChange={(e) => setFormData({...formData, companyAddress: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D71920] outline-none text-sm"></textarea>
          </div>

          {/* Company Admin Details */}
          <div className="border-t border-gray-100 pt-6 mt-6">
            <div className="pb-4 mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Company Admin Details</h2>
              <p className="text-xs text-gray-500 mt-1">Super administrator registered for this corporate account.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Name</label>
                <input type="text" disabled value={formData.adminName} className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed text-sm" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email</label>
                <input type="email" disabled value={formData.adminEmail} className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed text-sm" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Phone</label>
                <input type="text" disabled value={formData.adminPhone} className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed text-sm" />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button type="submit" disabled={isLoading} className="px-6 py-2 bg-[#D71920] text-white rounded-lg hover:bg-[#B51218] font-medium disabled:opacity-50 flex items-center text-sm shadow-xs transition-colors">
              {isLoading && <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>}
              Save General Details
            </button>
          </div>
        </form>
      </div>

      {/* 2. Company Bank Details Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <form onSubmit={handleBankSubmit} className="space-y-6">
          <div className="border-b border-gray-100 pb-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <FiCreditCard className="text-[#D71920]" /> Company Bank Account Details
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Official company bank account for verification, wire transfers (NEFT/RTGS), and direct corporate refunds.
              </p>
            </div>
            {companyProfile?.bankDetails?.accountNumber ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <FiCheckCircle /> Bank Details Configured
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <FiAlertCircle /> Bank Details Pending
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Holder Name <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                value={bankData.accountHolderName} 
                onChange={(e) => setBankData({ ...bankData, accountHolderName: e.target.value })} 
                placeholder="e.g. Acme Industries Pvt Ltd" 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D71920] outline-none text-sm"
                required
              />
              <p className="text-[11px] text-gray-500 mt-1">Must match company name on official bank records.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bank Name <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                value={bankData.bankName} 
                onChange={(e) => setBankData({ ...bankData, bankName: e.target.value })} 
                placeholder="e.g. HDFC Bank, ICICI Bank, SBI" 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D71920] outline-none text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Number <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                value={bankData.accountNumber} 
                onChange={(e) => setBankData({ ...bankData, accountNumber: e.target.value.replace(/\s+/g, '') })} 
                placeholder="Enter bank account number" 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D71920] outline-none text-sm font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Account Number <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                value={bankData.confirmAccountNumber} 
                onChange={(e) => setBankData({ ...bankData, confirmAccountNumber: e.target.value.replace(/\s+/g, '') })} 
                placeholder="Re-enter bank account number" 
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#D71920] outline-none text-sm font-mono ${
                  bankData.confirmAccountNumber && bankData.accountNumber !== bankData.confirmAccountNumber
                    ? 'border-red-400 bg-red-50/30'
                    : 'border-gray-300'
                }`}
                required
              />
              {bankData.confirmAccountNumber && bankData.accountNumber !== bankData.confirmAccountNumber && (
                <p className="text-[11px] text-red-500 mt-1">Account numbers do not match.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                IFSC Code <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                value={bankData.ifscCode} 
                onChange={(e) => setBankData({ ...bankData, ifscCode: e.target.value.toUpperCase().replace(/\s+/g, '') })} 
                placeholder="e.g. HDFC0001234" 
                maxLength={11}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D71920] outline-none text-sm uppercase font-mono tracking-wider"
                required
              />
              <p className="text-[11px] text-gray-500 mt-1">11-character alphanumeric code.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
              <select 
                value={bankData.accountType} 
                onChange={(e) => setBankData({ ...bankData, accountType: e.target.value })} 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D71920] outline-none bg-white text-sm"
              >
                {ACCOUNT_TYPES.map((type) => (
                  <option key={type} value={type}>{type} Account</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Branch Name (Optional)</label>
              <input 
                type="text" 
                value={bankData.branchName} 
                onChange={(e) => setBankData({ ...bankData, branchName: e.target.value })} 
                placeholder="e.g. Nariman Point, Mumbai" 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D71920] outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Corporate UPI ID (Optional)</label>
              <input 
                type="text" 
                value={bankData.upiId} 
                onChange={(e) => setBankData({ ...bankData, upiId: e.target.value.trim() })} 
                placeholder="company@bank" 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D71920] outline-none text-sm font-mono"
              />
            </div>
          </div>

          {/* Cancelled Cheque / Passbook Proof Section */}
          <div className="border-t border-gray-100 pt-6 mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                  <FiFileText className="text-gray-600" /> Cancelled Cheque / Passbook Copy
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Upload a scanned copy of a cancelled cheque or bank statement header for account verification. (Max 10MB, PDF/JPG/PNG)
                </p>
              </div>

              <div>
                <label className={`cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  uploadingCheque 
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    : 'bg-red-50 text-[#D71920] border-red-200 hover:bg-red-100'
                }`}>
                  <FiUploadCloud className={uploadingCheque ? 'animate-spin' : ''} />
                  <span>{uploadingCheque ? 'Uploading...' : companyProfile?.cancelledCheque?.url ? 'Replace Cheque' : 'Upload Cheque'}</span>
                  <input 
                    type="file" 
                    accept="image/*,application/pdf" 
                    disabled={uploadingCheque} 
                    onChange={handleChequeUpload} 
                    className="hidden" 
                  />
                </label>
              </div>
            </div>

            {companyProfile?.cancelledCheque?.url ? (
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <FiCheckCircle className="text-emerald-600 text-base" />
                  <div>
                    <p className="font-semibold text-gray-800">{companyProfile.cancelledCheque.fileName || 'Cancelled_Cheque.pdf'}</p>
                    <p className="text-[10px] text-gray-500">
                      Uploaded on {companyProfile.cancelledCheque.uploadedAt ? new Date(companyProfile.cancelledCheque.uploadedAt).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a 
                    href={companyProfile.cancelledCheque.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
                  >
                    <FiEye /> View
                  </a>
                  <a 
                    href={companyProfile.cancelledCheque.url} 
                    download={companyProfile.cancelledCheque.fileName || 'Cancelled_Cheque.pdf'} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-gray-700 bg-white hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
                  >
                    <FiDownload /> Download
                  </a>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-center gap-2">
                <FiAlertCircle className="text-amber-600 text-sm flex-shrink-0" />
                <span>No cancelled cheque uploaded yet. Uploading a cheque speeds up business compliance verification.</span>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button 
              type="submit" 
              disabled={isSavingBank || uploadingCheque} 
              className="px-6 py-2 bg-[#D71920] text-white rounded-lg hover:bg-[#B51218] font-medium disabled:opacity-50 flex items-center text-sm shadow-xs transition-colors"
            >
              {isSavingBank && <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>}
              Save Bank Details
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
};

export default CompanyProfile;

