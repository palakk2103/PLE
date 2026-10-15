import React, { useEffect, useState } from 'react';
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
  FiExternalLink,
  FiFileText,
  FiBriefcase
} from 'react-icons/fi';
import { useB2BAdminStore } from '../store/b2bAdminStore';
import api from '../../../shared/utils/api';
import toast from 'react-hot-toast';

const LegalDocuments = () => {
  const { companyProfile, fetchCompanyProfile, uploadCompanyLegalDocument, submitDocumentResubmission, isLoading } = useB2BAdminStore();
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [uploadingDocType, setUploadingDocType] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [submittingResubmit, setSubmittingResubmit] = useState(false);

  useEffect(() => {
    fetchCompanyProfile();
  }, [fetchCompanyProfile]);

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

  const handleSubmitResubmission = async () => {
    setSubmittingResubmit(true);
    try {
      const success = await submitDocumentResubmission();
      if (success) {
        await fetchCompanyProfile();
      }
    } finally {
      setSubmittingResubmit(false);
    }
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const handleFileUpload = async (e, docType) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds the 10MB limit.');
      return;
    }

    setUploadingDocType(docType.key);
    try {
      await uploadCompanyLegalDocument(file, docType.key);
      await fetchCompanyProfile();
    } finally {
      setUploadingDocType(null);
    }
  };

  const isPdf = (url) => {
    return url && (url.toLowerCase().endsWith('.pdf') || url.includes('/raw/upload/') || url.includes('application/pdf'));
  };

  const documents = [
    {
      key: 'acceptanceExecutionDocument',
      name: 'Signed Acceptance & Execution Agreement',
      description: 'Official signed and company-sealed B2B Platform Agreement submitted during registration.',
      doc: companyProfile?.acceptanceExecutionDocument,
      required: true,
      tag: 'Mandatory Agreement'
    },
    {
      key: 'gstCertificate',
      name: 'GST Registration Certificate',
      description: `Official GSTIN certificate for registered business (${companyProfile?.gstNumber || 'GST Details'}).`,
      doc: companyProfile?.gstCertificate,
      required: true,
      tag: companyProfile?.gstNumber ? `GSTIN: ${companyProfile.gstNumber}` : 'Tax Document'
    },
    {
      key: 'companyRegistrationProof',
      name: 'Company Incorporation / Registration Proof',
      description: `Shop & Establishment, Certificate of Incorporation (COI), or Partnership Deed for ${companyProfile?.companyType || 'Company'}.`,
      doc: companyProfile?.companyRegistrationProof,
      required: false,
      tag: companyProfile?.companyType || 'Corporate Document'
    }
  ];

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <FiCheckCircle className="text-emerald-500" /> Account Approved
          </span>
        );
      case 'Resubmission Required':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-800 border border-amber-300">
            <FiRefreshCw className="text-amber-600 animate-spin" style={{ animationDuration: '4s' }} /> Action Required: Re-upload
          </span>
        );
      case 'Pending Verification':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <FiClock className="text-amber-500" /> Pending Review
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
            <FiAlertCircle className="text-gray-500" /> {status || 'Active'}
          </span>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6 max-w-5xl pb-12"
    >
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-950 to-neutral-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-white/[0.08]">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-[#D71920]/20 to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="p-2.5 bg-[#D71920]/20 rounded-xl text-[#D71920] border border-[#D71920]/30 shadow-md">
                <FiBriefcase className="text-2xl" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  Legal & Registration Documents
                </h1>
                <p className="text-xs text-red-400 font-semibold tracking-wider uppercase mt-0.5">
                  {companyProfile?.companyName || 'B2B Client Company'}
                </p>
              </div>
            </div>
            <p className="text-neutral-300 text-sm max-w-2xl mt-1">
              View, download, and manage your company's registered legal contracts and official verification certificates.
            </p>
          </div>
          <div className="flex flex-col items-start md:items-end gap-1.5 bg-white/5 backdrop-blur-md px-5 py-3 rounded-xl border border-white/10">
            <span className="text-xs text-neutral-400 font-medium uppercase tracking-wider">Verification Status</span>
            {getStatusBadge(companyProfile?.verificationStatus)}
          </div>
        </div>
      </div>

      {/* Resubmission Required Alert Banner */}
      {companyProfile?.verificationStatus === 'Resubmission Required' && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-5 sm:p-6 shadow-md">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-amber-500/20 text-amber-700 rounded-xl shrink-0 mt-0.5 border border-amber-400/30">
                <FiAlertCircle className="text-2xl text-amber-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-amber-900 text-base sm:text-lg flex items-center gap-2">
                  Action Required: Document Re-upload Requested
                </h3>
                <div className="mt-1 bg-white/70 border border-amber-200 rounded-lg p-2.5 text-xs sm:text-sm text-amber-900 font-medium">
                  <span className="font-bold text-amber-950 uppercase tracking-wider text-[10px] block mb-0.5">Admin Review Notes:</span>
                  {companyProfile.documentResubmitNotes || 'Please review and re-upload the requested documents below.'}
                </div>
                {companyProfile.documentResubmitRequestedAt && (
                  <p className="text-[11px] text-amber-700 font-medium mt-1.5">
                    Requested on {new Date(companyProfile.documentResubmitRequestedAt).toLocaleDateString()} at {new Date(companyProfile.documentResubmitRequestedAt).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              disabled={submittingResubmit}
              onClick={handleSubmitResubmission}
              className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
            >
              {submittingResubmit ? (
                <>
                  <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <FiCheckCircle className="text-base" />
                  <span>Submit for Verification</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Official Platform Agreement Template Download Section */}
      {activeTemplate && (
        <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-600 rounded-xl shrink-0 mt-0.5">
              <FiFileText className="text-xl" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm sm:text-base">
                Official Platform Agreement Template (v{activeTemplate.version || 1})
              </h3>
              <p className="text-xs text-gray-600 mt-0.5">
                Download the official blank agreement template for your company legal records or re-signing.
              </p>
            </div>
          </div>
          <a
            href={activeTemplate.url}
            download={activeTemplate.fileName || 'Acceptance_Agreement_Template.pdf'}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-colors shrink-0"
          >
            <FiDownload /> Download Blank Template
          </a>
        </div>
      )}

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {documents.map((docItem) => {
          const isUploading = uploadingDocType === docItem.key;
          const docData = docItem.doc;
          const hasUploaded = Boolean(docData?.url);
          const isRequested = companyProfile?.verificationStatus === 'Resubmission Required' && (
            !companyProfile?.resubmitRequestedDocs?.length ||
            companyProfile?.resubmitRequestedDocs?.includes(docItem.key)
          );

          return (
            <div
              key={docItem.key}
              className={`bg-white rounded-2xl shadow-sm border p-6 flex flex-col justify-between hover:shadow-md transition-all duration-200 ${
                isRequested ? 'ring-2 ring-amber-400 border-amber-400 bg-amber-50/10' : 'border-gray-200/80'
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-bold text-gray-900 text-base flex items-center gap-2 flex-wrap">
                    {docItem.name}
                    {docItem.required && (
                      <span className="text-[10px] text-red-600 font-bold bg-red-50 border border-red-100 px-2 py-0.5 rounded-md">
                        Required
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    {isRequested && (
                      <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider flex items-center gap-1">
                        ⚠️ Re-upload Required
                      </span>
                    )}
                    {hasUploaded ? (
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 shrink-0">
                        <FiCheckCircle className="text-xs" /> Uploaded
                      </span>
                    ) : (
                      <span className="text-[10px] bg-gray-100 text-gray-500 border border-gray-200 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0">
                        Pending Upload
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                  {docItem.description}
                </p>

                {docItem.tag && (
                  <div className="mb-4">
                    <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-[11px] font-semibold border border-gray-200/60 inline-block font-mono">
                      {docItem.tag}
                    </span>
                  </div>
                )}

                {/* Uploaded File Box */}
                {hasUploaded ? (
                  <div className="border border-gray-200/90 rounded-xl p-4 bg-slate-50/70 mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 bg-red-50 text-[#D71920] rounded-xl shrink-0">
                        <FiFile className="text-2xl" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-800 truncate" title={docData.fileName}>
                          {docData.fileName || `${docItem.name.replace(/\s+/g, '_')}.pdf`}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {docData.size ? formatBytes(docData.size) : 'PDF Document'} • {docData.uploadedAt ? new Date(docData.uploadedAt).toLocaleDateString() : 'Active'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* View / Preview */}
                      <button
                        type="button"
                        onClick={() => setPreviewDoc({ ...docData, title: docItem.name })}
                        className="p-2 text-gray-600 hover:text-[#D71920] hover:bg-white rounded-lg border border-transparent hover:border-gray-200 transition-colors"
                        title="Preview Document"
                      >
                        <FiEye className="text-lg" />
                      </button>

                      {/* Download */}
                      <a
                        href={docData.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={docData.fileName || 'document.pdf'}
                        className="p-2 text-[#D71920] hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition-colors"
                        title="Download Document"
                      >
                        <FiDownload className="text-lg" />
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="border border-dashed border-gray-300 rounded-xl p-6 text-center bg-gray-50/50 mb-4">
                    <FiAlertCircle className="mx-auto text-2xl text-gray-400 mb-1" />
                    <p className="text-xs text-gray-500 font-medium">No document uploaded yet</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Click below to upload this legal document</p>
                  </div>
                )}
              </div>

              {/* Action Upload / Replace */}
              <div className="relative mt-2">
                <input
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  onChange={(e) => handleFileUpload(e, docItem)}
                  disabled={isUploading || isLoading}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full disabled:cursor-not-allowed z-10"
                />
                <button
                  type="button"
                  disabled={isUploading || isLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-300 hover:border-[#D71920] hover:text-[#D71920] hover:bg-red-50/30 text-gray-800 font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-sm disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <span className="animate-spin w-4 h-4 border-2 border-[#D71920] border-t-transparent rounded-full"></span>
                      <span>Uploading document...</span>
                    </>
                  ) : (
                    <>
                      <FiUploadCloud className="text-base text-gray-600" />
                      <span>{hasUploaded ? 'Replace Document' : 'Upload Document'}</span>
                    </>
                  )}
                </button>
              </div>
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
                  <FiFile className="text-[#D71920] text-lg" />
                  <h3 className="font-bold text-gray-900 text-sm sm:text-base">
                    {previewDoc.title || previewDoc.fileName || 'Legal Document Preview'}
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
                    title={previewDoc.fileName || 'Document Preview'}
                    className="w-full h-[550px] rounded-lg border bg-white"
                  />
                ) : (
                  <img
                    src={previewDoc.url}
                    alt={previewDoc.fileName || 'Document'}
                    className="max-h-[550px] w-auto object-contain rounded-lg shadow-sm"
                  />
                )}
              </div>

              <div className="p-4 border-t border-gray-200 bg-white flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {previewDoc.fileName || 'Original Document'}
                </span>
                <a
                  href={previewDoc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={previewDoc.fileName || 'document.pdf'}
                  className="px-4 py-2 bg-[#D71920] hover:bg-[#B51218] text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-colors"
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

export default LegalDocuments;
