import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FiFileText,
  FiUploadCloud,
  FiTrash2,
  FiDownload,
  FiEye,
  FiAlertCircle,
  FiCheckCircle,
  FiToggleLeft,
  FiToggleRight,
  FiInfo,
} from "react-icons/fi";
import toast from "react-hot-toast";
import {
  getAgreementTemplates,
  getAgreementTemplateConfigs,
  uploadAgreementTemplateGeneric,
  updateAgreementTemplateStatus,
  deleteAgreementTemplateGeneric,
} from "../../services/adminService";
import { getDownloadUrl } from '../../../../shared/utils/documentUrl';

const AgreementTemplateManagement = () => {
  const [configs, setConfigs] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedConfigKey, setSelectedConfigKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showPreviewUrl, setShowPreviewUrl] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [configsRes, templatesRes] = await Promise.all([
        getAgreementTemplateConfigs(),
        getAgreementTemplates(),
      ]);

      const rawConfigs = configsRes?.data || configsRes || [];
      const configList = Array.isArray(rawConfigs) ? rawConfigs : (rawConfigs.data || []);
      setConfigs(configList);

      const rawTemplates = templatesRes?.data || templatesRes || [];
      const templateList = Array.isArray(rawTemplates) ? rawTemplates : (rawTemplates.data || []);
      setTemplates(templateList);

      if (configList.length > 0 && !selectedConfigKey) {
        setSelectedConfigKey(configList[0].key || configList[0].templateKey);
      }
    } catch (error) {
      console.warn("Failed to fetch templates/configs:", error);
      toast.error("Failed to load templates.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      validateAndSetFile(files[0]);
    }
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      validateAndSetFile(files[0]);
    }
  };

  const validateAndSetFile = (file) => {
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      toast.error("Only PDF files are allowed.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Maximum file size limit is 10 MB.");
      return;
    }
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedConfigKey) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("templateKey", selectedConfigKey);

    try {
      const response = await uploadAgreementTemplateGeneric(formData);
      if (
        response?.statusCode === 201 ||
        response?.success ||
        response?.data?.success ||
        response?.data?.data ||
        response?.data
      ) {
        toast.success("Agreement Template uploaded successfully!");
        setSelectedFile(null);
        await fetchData();
      } else {
        toast.error("Failed to upload template.");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error?.message || "Failed to upload template.");
    } finally {
      setUploading(false);
    }
  };

  const handleToggleStatus = async (templateId, currentStatus) => {
    const nextStatus = currentStatus === "Active" ? "Inactive" : "Active";
    try {
      await updateAgreementTemplateStatus(templateId, nextStatus);
      toast.success(`Template status set to ${nextStatus}.`);
      fetchData();
    } catch (error) {
      toast.error("Failed to update status.");
    }
  };

  const handleDelete = async (templateId) => {
    if (!window.confirm("Are you sure you want to delete this template version?")) {
      return;
    }
    try {
      await deleteAgreementTemplateGeneric(templateId);
      toast.success("Template version deleted successfully.");
      if (showPreviewUrl) {
        const deletedTemplate = templates.find(t => t._id === templateId);
        if (deletedTemplate && showPreviewUrl === deletedTemplate.url) {
          setShowPreviewUrl(null);
        }
      }
      fetchData();
    } catch (error) {
      toast.error("Failed to delete template.");
    }
  };

  const activeConfig = Array.isArray(configs) ? configs.find((c) => c.key === selectedConfigKey) : null;
  const filteredTemplates = Array.isArray(templates) ? templates.filter((t) => t.templateKey === selectedConfigKey) : [];
  const activeTemplate = filteredTemplates.find((t) => t.status === "Active");

  const [zoomLevel, setZoomLevel] = useState(100);
  const [iframeLoading, setIframeLoading] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  const isImageFile = (url) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    return (
      lower.includes("unsplash.com") ||
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".png") ||
      lower.endsWith(".webp") ||
      lower.endsWith(".gif")
    );
  };

  // PDFs are stored as Cloudinary raw files (/raw/upload/...); do not rewrite the URL.
  const getCleanPdfUrl = (url) => url || "";

  return (
    <div className="p-6 space-y-6 text-sm bg-gray-50 dark:bg-zinc-950 min-h-screen">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-50 flex items-center gap-2">
          <FiFileText className="text-[#AE020B]" /> Agreement Template Management
        </h1>
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          Upload and manage agreement templates for different modules. These mappings are configuration-driven.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-zinc-800 overflow-x-auto gap-2">
        {configs.map((config) => (
          <button
            key={config.key}
            onClick={() => {
              setSelectedConfigKey(config.key);
              setSelectedFile(null);
            }}
            className={`px-4 py-2.5 font-semibold text-sm border-b-2 whitespace-nowrap transition-colors ${
              selectedConfigKey === config.key
                ? "border-[#AE020B] text-[#AE020B]"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {config.name}
          </button>
        ))}
      </div>

      {activeConfig && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Side: Upload / Replace */}
          <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-5">
            <div>
              <h2 className="text-base font-bold text-gray-800 dark:text-zinc-100">
                {activeTemplate ? "Replace PDF Template" : "Upload PDF Template"}
              </h2>
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1 flex items-center gap-1">
                <FiInfo /> Predefined Module: <span className="font-bold text-gray-650 dark:text-zinc-350">{activeConfig.moduleType}</span>
              </p>
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center cursor-pointer transition-colors duration-300 ${
                dragOver
                  ? "border-[#AE020B] bg-red-50/20"
                  : "border-gray-200 dark:border-zinc-800 hover:border-[#AE020B] dark:hover:border-red-800"
              }`}
              onClick={() => document.getElementById("template-file-input").click()}
            >
              <input
                type="file"
                id="template-file-input"
                accept=".pdf"
                className="hidden"
                onChange={handleFileSelect}
              />
              <FiUploadCloud className="text-4xl text-gray-400 dark:text-zinc-650 mb-3" />
              <p className="font-bold text-gray-700 dark:text-zinc-300">
                Drag & Drop PDF or Click to Browse
              </p>
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
                Supports: PDF only (Max 10 MB)
              </p>
            </div>

            {selectedFile && (
              <div className="bg-gray-50 dark:bg-zinc-950 p-4 rounded-xl border dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FiFileText className="text-2xl text-[#AE020B]" />
                  <div className="overflow-hidden max-w-[180px] sm:max-w-xs">
                    <p className="font-bold text-gray-850 dark:text-zinc-150 truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-zinc-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                  }}
                  className="p-1.5 hover:bg-gray-200 dark:hover:bg-zinc-880 rounded-lg text-red-500 transition-colors"
                  title="Remove Selected File"
                >
                  <FiTrash2 />
                </button>
              </div>
            )}

            {selectedFile && (
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full bg-[#AE020B] hover:bg-[#8d0208] text-white py-3 rounded-xl font-bold transition-all disabled:opacity-50"
              >
                {uploading ? "Uploading Template..." : "Confirm Upload"}
              </button>
            )}
          </div>

          {/* Right Side: Active template status & history */}
          <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-5">
            <h2 className="text-base font-bold text-gray-800 dark:text-zinc-100">
              Active Agreement File
            </h2>

            {loading ? (
              <div className="py-12 text-center text-gray-500">Loading active template...</div>
            ) : activeTemplate ? (
              <div className="space-y-4">
                <div className="flex items-start gap-4 bg-emerald-50/20 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 p-4 rounded-xl">
                  <FiCheckCircle className="text-2xl text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-emerald-800 dark:text-emerald-400">
                      Active (Version {activeTemplate.version})
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 truncate max-w-xs">
                      {activeTemplate.fileName}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIframeLoading(true);
                      setIframeError(false);
                      setShowPreviewUrl(showPreviewUrl === activeTemplate.url ? null : activeTemplate.url);
                    }}
                    className={`flex-1 border border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-850 text-gray-700 dark:text-zinc-300 py-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-colors ${
                      showPreviewUrl === activeTemplate.url ? "bg-red-50 text-[#AE020B] border-red-250 dark:bg-red-950/20" : ""
                    }`}
                  >
                    <FiEye /> {showPreviewUrl === activeTemplate.url ? "Hide Preview" : "Preview"}
                  </button>
                  <a
                    href={getDownloadUrl(activeTemplate.url)}
                    download={activeTemplate.fileName}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-gray-800 hover:bg-gray-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <FiDownload /> Download
                  </a>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 border border-dashed border-gray-250 dark:border-zinc-850 rounded-xl space-y-3">
                <FiAlertCircle className="text-4xl text-[#AE020B] mx-auto" />
                <p className="font-bold text-gray-700 dark:text-zinc-300">
                  No Active PDF Uploaded
                </p>
                <p className="text-xs text-gray-550 dark:text-zinc-450 max-w-xs mx-auto">
                  Please upload a PDF template for this module so users can download it.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* History table for selected key */}
      {selectedConfigKey && filteredTemplates.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-gray-800 dark:text-zinc-150">Version Upload History</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b dark:border-zinc-800 text-gray-400 dark:text-zinc-500">
                  <th className="py-3 font-semibold">Version</th>
                  <th className="py-3 font-semibold">File Name</th>
                  <th className="py-3 font-semibold">Status</th>
                  <th className="py-3 font-semibold">Uploaded On</th>
                  <th className="py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 dark:divide-zinc-850 text-gray-700 dark:text-zinc-300">
                {filteredTemplates.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-850/50">
                    <td className="py-3 font-bold">V{item.version}</td>
                    <td className="py-3 max-w-[200px] truncate">{item.fileName}</td>
                    <td className="py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                          item.status === "Active"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400"
                            : "bg-gray-100 text-gray-650 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3">{new Date(item.createdAt).toLocaleString()}</td>
                    <td className="py-3 text-right space-x-2">
                      <button
                        onClick={() => {
                          setIframeLoading(true);
                          setIframeError(false);
                          setShowPreviewUrl(showPreviewUrl === item.url ? null : item.url);
                        }}
                        className={`p-1.5 border rounded-lg hover:bg-gray-150 dark:hover:bg-zinc-800 ${
                          showPreviewUrl === item.url ? "text-[#AE020B] border-red-250 bg-red-50/10" : ""
                        }`}
                        title="Preview Version"
                      >
                        <FiEye />
                      </button>
                      <a
                        href={getDownloadUrl(item.url)}
                        download={item.fileName}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 border rounded-lg inline-flex hover:bg-gray-150 dark:hover:bg-zinc-800"
                        title="Download Version"
                      >
                        <FiDownload />
                      </a>
                      <button
                        onClick={() => handleToggleStatus(item._id, item.status)}
                        className="p-1.5 border rounded-lg hover:bg-gray-150 dark:hover:bg-zinc-800"
                        title={item.status === "Active" ? "Deactivate" : "Activate"}
                      >
                        {item.status === "Active" ? <FiToggleRight className="text-[#AE020B]" /> : <FiToggleLeft />}
                      </button>
                      <button
                        onClick={() => handleDelete(item._id)}
                        className="p-1.5 border border-red-100 hover:bg-red-50 rounded-lg text-red-650 dark:border-zinc-800"
                        title="Delete Version"
                      >
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inline Preview Container */}
      {showPreviewUrl && (
        <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-3 pb-3 border-b dark:border-zinc-800">
            <h3 className="font-bold text-gray-800 dark:text-zinc-100 flex items-center gap-2">
              <FiFileText className="text-[#AE020B]" /> Agreement Document Previewer
            </h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setZoomLevel(Math.max(50, zoomLevel - 25))}
                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded text-xs font-bold"
                title="Zoom Out"
              >
                Zoom -
              </button>
              <span className="text-xs font-bold">{zoomLevel}%</span>
              <button
                onClick={() => setZoomLevel(Math.min(200, zoomLevel + 25))}
                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded text-xs font-bold"
                title="Zoom In"
              >
                Zoom +
              </button>
              <a
                href={showPreviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline font-bold"
              >
                Open in New Tab
              </a>
              <button
                onClick={() => setShowPreviewUrl(null)}
                className="text-xs font-bold text-[#AE020B] hover:underline"
              >
                Close Preview
              </button>
            </div>
          </div>

          <div 
            className="w-full border dark:border-zinc-850 rounded-xl overflow-hidden bg-gray-100 dark:bg-zinc-950 relative flex justify-center items-start"
            style={{ height: "650px" }}
          >
            {isImageFile(showPreviewUrl) ? (
              <div className="w-full h-full flex items-center justify-center p-4 overflow-auto bg-gray-900/5">
                <img
                  src={showPreviewUrl}
                  alt="Template Document"
                  className="max-h-full max-w-full object-contain rounded-lg shadow-sm"
                  style={{ width: `${zoomLevel}%` }}
                />
              </div>
            ) : (
              <object
                key={showPreviewUrl}
                data={getCleanPdfUrl(showPreviewUrl)}
                type="application/pdf"
                className="w-full h-full bg-white transition-all duration-300"
                style={{ 
                  width: `${zoomLevel}%`, 
                  height: "100%",
                  minWidth: "100%"
                }}
              >
                {/* Fallback if browser does not support inline PDF object */}
                <div className="flex flex-col items-center justify-center p-12 text-center space-y-4 bg-gray-50 dark:bg-zinc-900 w-full h-full">
                  <FiFileText className="text-5xl text-[#AE020B]" />
                  <div>
                    <h4 className="font-bold text-gray-800 dark:text-zinc-200 text-base">
                      Agreement Document
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 max-w-sm">
                      Your browser does not support inline PDF rendering. You can open or download the PDF document directly.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center pt-2">
                    <a
                      href={showPreviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 bg-[#AE020B] hover:bg-[#8d0208] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                    >
                      <FiEye /> Open Document in New Tab
                    </a>
                    <a
                      href={getDownloadUrl(showPreviewUrl)}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 bg-gray-800 hover:bg-gray-900 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                    >
                      <FiDownload /> Download PDF
                    </a>
                  </div>
                </div>
              </object>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AgreementTemplateManagement;
