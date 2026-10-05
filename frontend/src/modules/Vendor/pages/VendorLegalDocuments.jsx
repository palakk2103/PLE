import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiFile, 
  FiDownload, 
  FiUploadCloud, 
  FiAlertCircle, 
  FiCheckCircle, 
  FiClock, 
  FiXCircle, 
  FiEye, 
  FiX, 
  FiShield, 
  FiInfo,
  FiExternalLink
} from 'react-icons/fi';
import { useVendorAuthStore } from '../store/vendorAuthStore';
import {
  uploadGstCertificate,
  uploadMsmeCertificate,
  uploadIdentityProof,
  uploadRegistrationProof,
  uploadPartnershipAgreement,
  uploadBusinessLetter,
  getVendorProfile
} from '../services/vendorService';
import toast from 'react-hot-toast';
import api from '../../../shared/utils/api';

const VendorLegalDocuments = () => {
  const { vendor, setVendor } = useVendorAuthStore();
  const [uploadingField, setUploadingField] = useState(null);
  const [generalSettings, setGeneralSettings] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);

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

  const refreshProfile = async () => {
    try {
      const res = await getVendorProfile();
      const freshVendor = res?.data?.data || res?.data || res;
      if (freshVendor) {
        setVendor(freshVendor);
      }
    } catch (error) {
      console.error('Failed to fetch fresh vendor profile:', error);
    }
  };

  useEffect(() => {
    refreshProfile();
  }, []);

  const documentTypes = [
    {
      key: 'gstCertificate',
      name: 'GST Registration Certificate',
      description: 'Official GSTIN registration certificate showing Legal Name and GST Number',
      url: vendor?.gstCertificate || vendor?.documents?.gst,
      uploadFn: uploadGstCertificate,
      required: vendor?.gstRegistered,
      metaNumber: vendor?.gstNumber ? `GSTIN: ${vendor.gstNumber}` : null
    },
    {
      key: 'identityProof',
      name: 'Identity Proof of Owner / Director',
      description: 'Government issued official ID (Aadhaar Card, PAN Card, or Passport)',
      url: vendor?.identityProof || vendor?.documents?.pan || vendor?.documents?.aadhar,
      uploadFn: uploadIdentityProof,
      required: true,
      metaNumber: vendor?.panNumber ? `PAN: ${vendor.panNumber}` : null
    },
    {
      key: 'registrationProofUrl',
      name: 'Business Registration Proof',
      description: 'Certificate of Incorporation, Shop & Establishment Act license, or Trade License',
      url: vendor?.registrationProofUrl || vendor?.documents?.businessLicense,
      fileName: vendor?.registrationProofName,
      uploadedAt: vendor?.registrationProofUploadedAt,
      uploadFn: uploadRegistrationProof,
      required: true
    },
    {
      key: 'businessLetterUrl',
      name: 'Authority / Business Letter',
      description: 'Official company letterhead authorization for platform operations and transactions',
      url: vendor?.businessLetterUrl,
      fileName: vendor?.businessLetterName,
      uploadedAt: vendor?.businessLetterUploadedAt,
      uploadFn: uploadBusinessLetter,
      required: false
    },
    {
      key: 'msmeCertificate',
      name: 'MSME / Udyam Certificate',
      description: 'Micro, Small & Medium Enterprises registration certificate (if applicable)',
      url: vendor?.msmeCertificate,
      uploadFn: uploadMsmeCertificate,
      required: vendor?.businessType === 'MSME'
    },
    {
      key: 'partnershipAgreementUrl',
      name: 'Partnership Deed / Agreement',
      description: 'Signed, notarized and stamped partnership agreement document',
      url: vendor?.partnershipAgreementUrl,
      fileName: vendor?.partnershipAgreementName,
      uploadedAt: vendor?.partnershipAgreementUploadedAt,
      uploadFn: uploadPartnershipAgreement,
      required: generalSettings?.partnershipAgreementRequiredTypes?.includes(vendor?.businessType) || vendor?.businessType === 'Partnership'
    },
    ...(vendor?.b2bSellingGstCertificate ? [{
      key: 'b2bSellingGstCertificate',
      name: 'B2B Selling GST Certificate',
      description: 'Authorized wholesale/B2B selling GST verification certificate',
      url: vendor?.b2bSellingGstCertificate,
      fileName: 'B2B_Selling_GST.pdf',
      readOnly: true,
      required: false
    }] : [])
  ];

  const handleFileUpload = async (e, docType) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds the 10MB limit.');
      return;
    }

    setUploadingField(docType.key);
    const loadingToast = toast.loading(`Uploading ${docType.name}...`);

    try {
      const res = await docType.uploadFn(file);
      const data = res?.data?.data || res?.data || res;
      
      const updatedVendor = { ...vendor };
      if (docType.key === 'registrationProofUrl') {
        updatedVendor.registrationProofUrl = data.registrationProofUrl;
        updatedVendor.registrationProofName = data.registrationProofName;
        updatedVendor.registrationProofUploadedAt = new Date();
      } else if (docType.key === 'businessLetterUrl') {
        updatedVendor.businessLetterUrl = data.businessLetterUrl;
        updatedVendor.businessLetterName = data.businessLetterName;
        updatedVendor.businessLetterUploadedAt = new Date();
      } else if (docType.key === 'partnershipAgreementUrl') {
        updatedVendor.partnershipAgreementUrl = data.partnershipAgreementUrl;
        updatedVendor.partnershipAgreementName = data.partnershipAgreementName;
        updatedVendor.partnershipAgreementUploadedAt = new Date();
      } else {
        updatedVendor[docType.key] = data[docType.key];
      }
      if (data.verificationStatus) {
        updatedVendor.verificationStatus = data.verificationStatus;
      }
      
      setVendor(updatedVendor);
      toast.success(`${docType.name} updated successfully.`, { id: loadingToast });
      refreshProfile();
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.message || `Failed to upload ${docType.name}.`, { id: loadingToast });
    } finally {
      setUploadingField(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <FiCheckCircle className="text-emerald-500" /> Account Verified
          </span>
        );
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <FiClock className="text-amber-500" /> Under Verification
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            <FiXCircle className="text-rose-500" /> Verification Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700 border border-gray-200">
            <FiAlertCircle className="text-gray-500" /> Unsubmitted
          </span>
        );
    }
  };

  const isPdf = (url) => {
    return url && (url.toLowerCase().endsWith('.pdf') || url.includes('/raw/upload/') || url.includes('application/pdf'));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6 pb-12"
    >
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-gray-900 via-slate-900 to-gray-800 rounded-2xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden border border-gray-700/50">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-primary-600/10 to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="p-2 bg-primary-500/20 rounded-xl text-primary-400 border border-primary-500/30">
                <FiShield className="text-2xl" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Legal & Registration Documents
              </h1>
            </div>
            <p className="text-gray-300 text-sm max-w-2xl">
              All official compliance documents and certificates submitted during registration. You can view, download, or replace your documents here.
            </p>
          </div>
          <div className="flex flex-col items-start md:items-end gap-2 bg-white/10 backdrop-blur-md px-5 py-3 rounded-xl border border-white/15">
            <span className="text-xs text-gray-300 font-medium uppercase tracking-wider">Compliance Status</span>
            {getStatusBadge(vendor?.verificationStatus)}
          </div>
        </div>
      </div>

      {/* Rejection Alert if rejected */}
      {vendor?.verificationRemark && vendor?.verificationStatus === 'Rejected' && (
        <div className="bg-rose-50/90 border border-rose-200 rounded-xl p-4 flex gap-3 items-start text-rose-800 text-sm shadow-sm">
          <FiAlertCircle className="text-xl flex-shrink-0 mt-0.5 text-rose-600" />
          <div>
            <span className="font-bold">Verification Reject Remark:</span> {vendor.verificationRemark}
            <p className="text-xs text-rose-700 mt-1">Please replace the necessary documents below for re-verification by the administrator.</p>
          </div>
        </div>
      )}

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {documentTypes.map((doc) => {
          const isUploading = uploadingField === doc.key;

          // Skip if GST card and vendor not GST registered and no doc uploaded
          if (doc.key === 'gstCertificate' && !vendor?.gstRegistered && !doc.url) {
            return null;
          }

          // Skip partnership agreement if not applicable and no doc uploaded
          if (doc.key === 'partnershipAgreementUrl' && !doc.required && !doc.url) {
            return null;
          }

          // Skip MSME if not applicable and no doc uploaded
          if (doc.key === 'msmeCertificate' && !doc.required && !doc.url) {
            return null;
          }

          const hasUploaded = Boolean(doc.url);

          return (
            <div
              key={doc.key}
              className="bg-white rounded-2xl shadow-sm border border-gray-200/80 p-6 flex flex-col justify-between hover:shadow-md transition-all duration-200"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-bold text-gray-900 text-base sm:text-lg flex items-center gap-2 flex-wrap">
                    {doc.name}
                    {doc.required && (
                      <span className="text-[10px] text-red-600 font-bold bg-red-50 border border-red-100 px-2 py-0.5 rounded-md">
                        Required
                      </span>
                    )}
                  </h3>
                  {hasUploaded ? (
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 shrink-0">
                      <FiCheckCircle className="text-xs" /> Uploaded
                    </span>
                  ) : (
                    <span className="text-[10px] bg-gray-100 text-gray-500 border border-gray-200 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0">
                      Missing
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                  {doc.description}
                </p>

                {doc.metaNumber && (
                  <div className="mb-3 px-3 py-1.5 bg-gray-50 rounded-lg text-xs font-mono font-semibold text-gray-700 inline-block border border-gray-100">
                    {doc.metaNumber}
                  </div>
                )}

                {/* Uploaded File Box */}
                {hasUploaded ? (
                  <div className="border border-gray-200/90 rounded-xl p-4 bg-slate-50/70 mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 bg-primary-50 text-primary-600 rounded-xl shrink-0">
                        <FiFile className="text-2xl" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-800 truncate" title={doc.fileName || doc.name}>
                          {doc.fileName || `${doc.name.replace(/\s+/g, '_')}`}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {doc.uploadedAt ? `Submitted: ${new Date(doc.uploadedAt).toLocaleDateString()}` : 'Registered document'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* View / Preview */}
                      <button
                        type="button"
                        onClick={() => setPreviewDoc(doc)}
                        className="p-2 text-gray-600 hover:text-primary-600 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 transition-colors"
                        title="Quick Preview"
                      >
                        <FiEye className="text-lg" />
                      </button>

                      {/* Download */}
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg border border-transparent hover:border-primary-100 transition-colors"
                        title="Download Document"
                      >
                        <FiDownload className="text-lg" />
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="border border-dashed border-gray-300 rounded-xl p-6 text-center bg-gray-50/50 mb-4">
                    <FiAlertCircle className="mx-auto text-2xl text-gray-400 mb-1" />
                    <p className="text-xs text-gray-500">No document uploaded yet</p>
                  </div>
                )}
              </div>

              {/* Action Upload / Replace */}
              {!doc.readOnly && (
                <div className="relative mt-2">
                  <input
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/webp"
                    onChange={(e) => handleFileUpload(e, doc)}
                    disabled={isUploading}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full disabled:cursor-not-allowed z-10"
                  />
                  <button
                    type="button"
                    disabled={isUploading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-300 hover:border-gray-400 hover:bg-gray-50 text-gray-800 font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-sm disabled:opacity-50"
                  >
                    {isUploading ? (
                      <>
                        <span className="animate-spin w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full"></span>
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <FiUploadCloud className="text-base text-gray-600" />
                        <span>{hasUploaded ? 'Replace Document' : 'Upload Document'}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-2">
                  <FiFile className="text-primary-600 text-lg" />
                  <h3 className="font-bold text-gray-900 text-sm sm:text-base">
                    {previewDoc.name}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={previewDoc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    title="Open in new tab"
                  >
                    <FiExternalLink className="text-base" />
                  </a>
                  <button
                    onClick={() => setPreviewDoc(null)}
                    className="p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <FiX className="text-lg" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4 bg-gray-100 flex items-center justify-center min-h-[400px]">
                {isPdf(previewDoc.url) ? (
                  <iframe
                    src={previewDoc.url}
                    title={previewDoc.name}
                    className="w-full h-[550px] rounded-lg border bg-white"
                  />
                ) : (
                  <img
                    src={previewDoc.url}
                    alt={previewDoc.name}
                    className="max-h-[550px] w-auto object-contain rounded-lg shadow-sm"
                  />
                )}
              </div>

              <div className="p-4 border-t border-gray-200 bg-white flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {previewDoc.fileName || previewDoc.name}
                </span>
                <a
                  href={previewDoc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-colors"
                >
                  <FiDownload /> Download Original
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default VendorLegalDocuments;
