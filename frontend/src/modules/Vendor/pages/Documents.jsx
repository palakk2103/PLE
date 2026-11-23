import { useState, useEffect, useCallback, useRef } from "react";
import { FiFile, FiUpload, FiDownload, FiTrash2, FiRefreshCw, FiEye } from "react-icons/fi";
import { motion } from "framer-motion";
import DataTable from "../../Admin/components/DataTable";
import ConfirmModal from "../../Admin/components/ConfirmModal";
import Badge from "../../../shared/components/Badge";
import { useVendorAuthStore } from "../store/vendorAuthStore";
import {
  getVendorDocuments,
  uploadVendorDocument,
  deleteVendorDocument,
  replaceVendorDocument,
} from "../services/vendorService";
import toast from "react-hot-toast";

const Documents = () => {
  const { vendor } = useVendorAuthStore();
  const [documents, setDocuments] = useState([]);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null });
  const [showUpload, setShowUpload] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const vendorId = vendor?.id || vendor?._id;
  const replaceInput = useRef(null);
  const replaceTarget = useRef(null);
  const loa = documents.find((d) => d.category === "LOA");

  const startReplace = (doc) => {
    replaceTarget.current = doc;
    if (replaceInput.current) {
      replaceInput.current.value = "";
      replaceInput.current.accept = doc.category === "LOA" ? ".pdf,.jpg,.jpeg,.png" : ".pdf,image/*";
      replaceInput.current.click();
    }
  };

  const handleReplaceFile = async (e) => {
    const file = e.target.files?.[0];
    const doc = replaceTarget.current;
    if (!file || !doc) return;
    setIsSaving(true);
    try {
      await replaceVendorDocument(doc._id, file);
      toast.success("Document replaced. It will be reviewed again.");
      fetchDocuments();
    } finally {
      setIsSaving(false);
      replaceTarget.current = null;
    }
  };

  const fetchDocuments = useCallback(async () => {
    if (!vendorId) return;
    setIsLoading(true);
    try {
      const res = await getVendorDocuments();
      const data = res?.data ?? res;
      setDocuments(Array.isArray(data) ? data : []);
    } finally {
      setIsLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleUpload = async (docData, file) => {
    setIsSaving(true);
    try {
      await uploadVendorDocument(docData, file);
      setShowUpload(false);
      toast.success("Document uploaded");
      fetchDocuments();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.id) return;
    setIsSaving(true);
    try {
      await deleteVendorDocument(deleteModal.id);
      setDeleteModal({ isOpen: false, id: null });
      toast.success("Document deleted");
      fetchDocuments();
    } finally {
      setIsSaving(false);
    }
  };

  const columns = [
    {
      key: "name",
      label: "Document Name",
      sortable: true,
      render: (value, row) => (
        <span data-testid={row.category === "LOA" ? "loa-row" : undefined}>
          {value}
          {row.version > 1 && <span className="ml-2 text-xs text-gray-400">v{row.version}</span>}
        </span>
      ),
    },
    {
      key: "category",
      label: "Category",
      sortable: true,
      render: (value) => value === "LOA"
        ? <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700">LOA</span>
        : value,
    },
    {
      key: "status",
      label: "Status",
      render: (value) => (
        <Badge
          variant={
            value === "approved"
              ? "success"
              : value === "rejected"
                ? "error"
                : "warning"
          }
        >
          {value}
        </Badge>
      ),
    },
    {
      key: "expiryDate",
      label: "Expiry Date",
      render: (value) => (value ? new Date(value).toLocaleDateString() : "N/A"),
    },
    {
      key: "actions",
      label: "Actions",
      render: (_, row) => (
        <div className="flex gap-2">
          <button
            onClick={() => window.open(row.fileUrl, "_blank", "noopener")}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
            title="View"
            data-testid="doc-view"
          >
            <FiEye />
          </button>
          <a
            href={row.fileUrl}
            download={row.fileName || true}
            target="_blank"
            rel="noreferrer"
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
            title="Download"
          >
            <FiDownload />
          </a>
          <button
            onClick={() => startReplace(row)}
            disabled={isSaving}
            className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg disabled:opacity-50"
            title="Replace file"
            data-testid="doc-replace"
          >
            <FiRefreshCw />
          </button>
          <button
            onClick={() => setDeleteModal({ isOpen: true, id: row._id })}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
            title="Delete"
          >
            <FiTrash2 />
          </button>
        </div>
      ),
    },
  ];

  if (!vendorId) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Please log in to view documents</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="lg:hidden">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2 flex items-center gap-2">
            <FiFile className="text-primary-600" />
            Documents
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            Manage business documents and certificates
          </p>
        </div>
        <input ref={replaceInput} type="file" className="hidden" data-testid="replace-input" onChange={handleReplaceFile} />
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-semibold"
        >
          <FiUpload />
          <span>Upload Document</span>
        </button>
      </div>

      <div className={`rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 ${loa ? "bg-white border-gray-200" : "bg-amber-50 border-amber-200"}`} data-testid="loa-card">
        <div>
          <p className="font-bold text-gray-800 text-sm">Letter of Authorization (LOA)</p>
          {loa ? (
            <p className="text-xs text-gray-500 mt-0.5">
              {loa.fileName || loa.name} · status <b data-testid="loa-status">{loa.status}</b>
              {loa.replacedAt ? ` · replaced ${new Date(loa.replacedAt).toLocaleDateString()}` : ""}
            </p>
          ) : (
            <p className="text-xs text-amber-800 mt-0.5">No LOA uploaded yet. Upload a signed PDF, JPG or PNG.</p>
          )}
        </div>
        <div className="flex gap-2">
          {loa ? (
            <>
              <button onClick={() => window.open(loa.fileUrl, "_blank", "noopener")} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50" data-testid="loa-view">View</button>
              <button onClick={() => startReplace(loa)} disabled={isSaving} className="px-3 py-1.5 text-sm rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-50" data-testid="loa-replace">Replace</button>
              <button onClick={() => setDeleteModal({ isOpen: true, id: loa._id })} className="px-3 py-1.5 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50" data-testid="loa-delete">Delete</button>
            </>
          ) : (
            <button onClick={() => setShowUpload("LOA")} className="px-3 py-1.5 text-sm rounded-lg bg-primary-600 text-white" data-testid="loa-upload">Upload LOA</button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-200 text-center">
          <p className="text-gray-500">Loading documents...</p>
        </div>
      ) : (
        <DataTable data={documents} columns={columns} pagination={true} />
      )}

      {showUpload && (
        <DocumentUploadForm
          onSave={handleUpload}
          onClose={() => setShowUpload(false)}
          isSaving={isSaving}
          initialCategory={showUpload === "LOA" ? "LOA" : "License"}
          hasLoa={!!loa}
        />
      )}

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, id: null })}
        onConfirm={handleDelete}
        title="Delete Document"
        message="Are you sure you want to delete this document?"
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </motion.div>
  );
};

const DocumentUploadForm = ({ onSave, onClose, isSaving, initialCategory = "License", hasLoa = false }) => {
  const [formData, setFormData] = useState({
    name: "",
    category: initialCategory,
    expiryDate: "",
  });
  const [file, setFile] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please select a file");
      return;
    }
    onSave(formData, file);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-6 max-w-md w-full">
        <h3 className="text-lg font-bold mb-4">Upload Document</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2">Document Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required={formData.category !== "LOA"}
              placeholder={formData.category === "LOA" ? "Letter of Authorization (LOA)" : ""}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg"
            >
              <option>License</option>
              <option>Certificate</option>
              <option>Tax Document</option>
              <option value="LOA" disabled={hasLoa}>LOA (Letter of Authorization){hasLoa ? " - already uploaded, use Replace" : ""}</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2">
              Expiry Date (optional)
            </label>
            <input
              type="date"
              value={formData.expiryDate}
              onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2">Upload File</label>
            <input
              type="file"
              accept={formData.category === "LOA" ? ".pdf,.jpg,.jpeg,.png" : ".pdf,image/*"}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg disabled:opacity-60"
            >
              {isSaving ? "Uploading..." : "Upload"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Documents;
