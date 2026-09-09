import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiMail,
  FiPhone,
  FiMapPin,
  FiShoppingBag,
  FiDollarSign,
  FiClock,
  FiEdit,
  FiPackage,
  FiCheckCircle,
  FiXCircle,
  FiTrendingUp,
  FiUser,
  FiFileText,
  FiShield,
} from "react-icons/fi";
import { motion } from "framer-motion";
import { useVendorStore } from "../../store/vendorStore";
import { getAllOrders, getVendorCommissions, getVendorDocuments, updateVendorDocumentStatus, verifyVendorBusiness, rejectVendorBusiness } from "../../services/adminService";
import Badge from "../../../../shared/components/Badge";
import DataTable from "../../components/DataTable";
import { formatPrice } from "../../../../shared/utils/helpers";
// import { formatDateTime } from '../../../utils/adminHelpers';
import toast from "react-hot-toast";
import api from "../../../../shared/utils/api";

const VendorDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getVendor, updateVendorStatus, updateCommissionRate } =
    useVendorStore();

  const [vendor, setVendor] = useState(null);
  const [vendorOrders, setVendorOrders] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [earningsSummary, setEarningsSummary] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditingCommission, setIsEditingCommission] = useState(false);
  const [commissionRate, setCommissionRate] = useState("");
  const [isRefurbishedEnabled, setIsRefurbishedEnabled] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectRemark, setRejectRemark] = useState("");
  const [showB2BRejectModal, setShowB2BRejectModal] = useState(false);
  const [b2bRejectRemark, setB2bRejectRemark] = useState("");
  const isSameVendorId = (a, b) => String(a) === String(b);

  const handleVerifyBusiness = async () => {
    try {
      await verifyVendorBusiness(id);
      setVendor(prev => ({
        ...prev,
        verificationStatus: 'Approved',
        status: 'approved'
      }));
      toast.success("Business verified and vendor approved!");
    } catch {
      toast.error("Failed to verify business.");
    }
  };

  const handleRejectBusinessSubmit = async () => {
    if (!rejectRemark.trim()) {
      toast.error("Please enter a remark.");
      return;
    }
    try {
      await rejectVendorBusiness(id, rejectRemark);
      setVendor(prev => ({
        ...prev,
        verificationStatus: 'Rejected',
        status: 'rejected',
        verificationRemark: rejectRemark
      }));
      setShowRejectModal(false);
      setRejectRemark("");
      toast.success("Business verification rejected.");
    } catch {
      toast.error("Failed to reject business.");
    }
  };

  const handleApproveB2B = async () => {
    try {
      await api.patch(`/admin/vendors/b2b-applications/${id}/approve`);
      setVendor(prev => ({
        ...prev,
        b2bSellingStatus: 'approved',
        b2bSellingApprovedAt: new Date().toISOString()
      }));
      toast.success("B2B wholesale selling authorization approved!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to approve B2B selling.");
    }
  };

  const handleRejectB2BSubmit = async () => {
    if (!b2bRejectRemark.trim()) {
      toast.error("Please enter a rejection remark.");
      return;
    }
    try {
      await api.patch(`/admin/vendors/b2b-applications/${id}/reject`, { remark: b2bRejectRemark.trim() });
      setVendor(prev => ({
        ...prev,
        b2bSellingStatus: 'rejected',
        b2bSellingRejectionReason: b2bRejectRemark.trim()
      }));
      setShowB2BRejectModal(false);
      setB2bRejectRemark("");
      toast.success("B2B application rejected.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reject B2B application.");
    }
  };

  const handleToggleRefurbished = async () => {
    try {
      const newVal = !isRefurbishedEnabled;
      
      // Update via backend API instead of local storage
      await api.patch(`/admin/vendors/${id}/status`, { isRefurbishedSeller: newVal });
      
      setIsRefurbishedEnabled(newVal);
      if (newVal) {
        toast.success("Refurbished selling permission enabled for this seller.");
      } else {
        toast.error("Refurbished selling permission disabled.");
      }
    } catch {
      toast.error("Failed to update refurbished selling status.");
    }
  };

  useEffect(() => {
    const fetchVendorData = async () => {
      // 1. Fetch Vendor Details
      const data = await getVendor(id);
      if (data) {
        setVendor(data);
        setCommissionRate(((data.commissionRate || 0) * 100).toFixed(1));
        setIsRefurbishedEnabled(!!data.isRefurbishedSeller);

        // 2. Fetch Vendor Orders (all pages)
        try {
          const fetchedOrders = [];
          let page = 1;
          let pages = 1;
          do {
            const ordersResponse = await getAllOrders({
              vendorId: id,
              page,
              limit: 200,
            });
            const payload = ordersResponse?.data ?? ordersResponse;
            const orderPage = Array.isArray(payload?.orders) ? payload.orders : [];
            fetchedOrders.push(...orderPage);
            pages = Math.max(Number(payload?.pages) || 1, 1);
            page += 1;
          } while (page <= pages);

          const normalizedOrders = fetchedOrders.map((order) => ({
            ...order,
            id: order.orderId || order._id,
            date: order.date || order.createdAt,
          }));
          setVendorOrders(normalizedOrders);
        } catch (error) {
          console.error("Failed to fetch vendor orders:", error);
          toast.error("Failed to load vendor orders");
        }

        // 3. Fetch vendor commissions for commissions tab + earnings summary
        try {
          const fetchedCommissions = [];
          let page = 1;
          let pages = 1;
          do {
            const response = await getVendorCommissions(id, { page, limit: 200 });
            const payload = response?.data ?? response;
            const pageCommissions = Array.isArray(payload?.commissions)
              ? payload.commissions
              : [];
            fetchedCommissions.push(...pageCommissions);
            pages = Math.max(Number(payload?.pages) || 1, 1);
            page += 1;
          } while (page <= pages);
          setCommissions(fetchedCommissions);
        } catch {
          setCommissions([]);
        }

        // 4. Fetch vendor documents
        try {
          const docsResponse = await getVendorDocuments(id);
          const docsData = docsResponse?.data ?? docsResponse;
          setDocuments(Array.isArray(docsData) ? docsData : []);
        } catch {
          setDocuments([]);
        }
      } else {
        toast.error("Vendor not found");
        navigate("/admin/vendors");
      }
    };
    fetchVendorData();
  }, [id, getVendor, navigate]);

  useEffect(() => {
    if (!vendor) return;

    const summary = commissions.reduce(
      (acc, row) => {
        const earnings = Number(row.vendorEarnings || 0);
        acc.totalEarnings += earnings;
        if (row.status === "pending") acc.pendingEarnings += earnings;
        return acc;
      },
      { totalEarnings: 0, pendingEarnings: 0 }
    );

    setEarningsSummary(summary);
  }, [vendor, commissions]);

  const handleStatusUpdate = async (newStatus) => {
    const success = await updateVendorStatus(vendor.id, newStatus);
    if (success) {
      setVendor({ ...vendor, status: newStatus });
      toast.success(`Vendor status updated to ${newStatus}`);
    } else {
      toast.error("Failed to update vendor status");
    }
  };

  const handleDocumentStatusUpdate = async (docId, status) => {
    try {
      await updateVendorDocumentStatus(docId, status);
      setDocuments((prevDocs) =>
        prevDocs.map((doc) =>
          doc._id === docId ? { ...doc, status } : doc
        )
      );
      toast.success(`Document marked as ${status}`);
    } catch {
      toast.error("Failed to update document status");
    }
  };

  const handleCommissionUpdate = async () => {
    const rate = parseFloat(commissionRate) / 100;
    if (isNaN(rate) || rate < 0 || rate > 1) {
      toast.error("Please enter a valid commission rate (0-100%)");
      return;
    }
    const success = await updateCommissionRate(vendor.id, rate);
    if (success) {
      setVendor({ ...vendor, commissionRate: rate });
      setIsEditingCommission(false);
      toast.success("Commission rate updated successfully");
    } else {
      toast.error("Failed to update commission rate");
    }
  };

  if (!vendor) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const orderColumns = [
    {
      key: "id",
      label: "Order ID",
      sortable: true,
    },
    {
      key: "date",
      label: "Date",
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (value) => (
        <Badge
          variant={
            value === "delivered"
              ? "success"
              : value === "pending"
                ? "warning"
                : value === "cancelled" || value === "canceled"
                  ? "error"
                  : "info"
          }>
          {value?.toUpperCase() || "N/A"}
        </Badge>
      ),
    },
    {
      key: "total",
      label: "Amount",
      sortable: true,
      render: (_, row) => {
        const vendorItem = row.vendorItems?.find(
          (vi) => isSameVendorId(vi.vendorId, vendor.id)
        );
        return formatPrice(vendorItem?.subtotal || 0);
      },
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (_, row) => (
        <button
          onClick={() => navigate(`/admin/orders/${row.id}`)}
          className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
          View
        </button>
      ),
    },
  ];

  const commissionColumns = [
    {
      key: "orderId",
      label: "Order ID",
      sortable: true,
    },
    {
      key: "createdAt",
      label: "Date",
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      key: "subtotal",
      label: "Subtotal",
      sortable: true,
      render: (value) => formatPrice(value),
    },
    {
      key: "commission",
      label: "Commission",
      sortable: true,
      render: (value) => (
        <span className="text-red-600">-{formatPrice(value)}</span>
      ),
    },
    {
      key: "vendorEarnings",
      label: "Vendor Earnings",
      sortable: true,
      render: (value) => (
        <span className="text-green-600">{formatPrice(value)}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (value) => (
        <Badge
          variant={
            value === "paid"
              ? "success"
              : value === "pending"
                ? "warning"
                : "error"
          }>
          {value?.toUpperCase()}
        </Badge>
      ),
    },
  ];

  const documentColumns = [
    {
      key: "name",
      label: "Document Name",
      sortable: true,
    },
    {
      key: "category",
      label: "Category",
      sortable: true,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (value) => (
        <Badge
          variant={
            value === "approved"
              ? "success"
              : value === "pending"
                ? "warning"
                : "error"
          }>
          {value?.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: "expiryDate",
      label: "Expiry Date",
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString() : 'N/A',
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <a
            href={row.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors">
            View
          </a>
          {row.status === "pending" && (
            <>
              <button
                onClick={() => handleDocumentStatusUpdate(row._id, "approved")}
                className="px-3 py-1 text-sm bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors">
                Approve
              </button>
              <button
                onClick={() => handleDocumentStatusUpdate(row._id, "rejected")}
                className="px-3 py-1 text-sm bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors">
                Reject
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-lg p-4 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <FiArrowLeft className="text-lg text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
              {vendor.storeName || vendor.name}
            </h1>
            <p className="text-xs text-gray-500">Vendor ID: {vendor.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 font-bold">
          {isRefurbishedEnabled && (
            <Badge variant="warning">REFURBISHED SELLER</Badge>
          )}
          <Badge
            variant={
              vendor.status === "approved"
                ? "success"
                : vendor.status === "pending"
                  ? "warning"
                  : "error"
            }>
            {vendor.status?.toUpperCase()}
          </Badge>
          {vendor.status === "pending" && (
            <button
              onClick={() => handleStatusUpdate("approved")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm">
              <FiCheckCircle />
              Approve
            </button>
          )}
          {vendor.status === "approved" && (
            <button
              onClick={() => handleStatusUpdate("suspended")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm">
              <FiXCircle />
              Suspend
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex overflow-x-auto border-b border-gray-200">
          {["overview", "orders", "commissions", "settings", "documents"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-semibold text-sm transition-colors ${activeTab === tab
                ? "text-primary-600 border-b-2 border-primary-600"
                : "text-gray-600 hover:text-gray-800"
                }`}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Vendor Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-800 mb-4">
                    Vendor Information
                  </h2>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <FiUser className="text-gray-400 mt-1" />
                      <div>
                        <p className="text-xs text-gray-600">Name</p>
                        <p className="font-semibold text-gray-800">
                          {vendor.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <FiMail className="text-gray-400 mt-1" />
                      <div>
                        <p className="text-xs text-gray-600">Email</p>
                        <p className="font-semibold text-gray-800">
                          {vendor.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <FiPhone className="text-gray-400 mt-1" />
                      <div>
                        <p className="text-xs text-gray-600">Phone</p>
                        <p className="font-semibold text-gray-800">
                          {vendor.phone || "N/A"}
                        </p>
                      </div>
                    </div>
                    {vendor.address && (
                      <div className="flex items-start gap-3">
                        <FiMapPin className="text-gray-400 mt-1" />
                        <div>
                          <p className="text-xs text-gray-600">Address</p>
                          <p className="font-semibold text-gray-800">
                            {vendor.address.street || ""}
                            {vendor.address.city && `, ${vendor.address.city}`}
                            {vendor.address.state &&
                              `, ${vendor.address.state}`}
                            {vendor.address.zipCode &&
                              ` ${vendor.address.zipCode}`}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <FiClock className="text-gray-400 mt-1" />
                      <div>
                        <p className="text-xs text-gray-600">Join Date</p>
                        <p className="font-semibold text-gray-800">
                          {new Date(vendor.joinDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Performance Stats */}
                <div>
                  <h2 className="text-lg font-bold text-gray-800 mb-4">
                    Performance
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-xs text-blue-600 mb-1">Total Orders</p>
                      <p className="text-2xl font-bold text-blue-800">
                        {vendorOrders.length}
                      </p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-xs text-green-600 mb-1">
                        Total Earnings
                      </p>
                      <p className="text-2xl font-bold text-green-800">
                        {earningsSummary
                          ? formatPrice(earningsSummary.totalEarnings)
                          : formatPrice(0)}
                      </p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4">
                      <p className="text-xs text-yellow-600 mb-1">
                        Pending Earnings
                      </p>
                      <p className="text-2xl font-bold text-yellow-800">
                        {earningsSummary
                          ? formatPrice(earningsSummary.pendingEarnings)
                          : formatPrice(0)}
                      </p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <p className="text-xs text-purple-600 mb-1">
                        Commission Rate
                      </p>
                      <p className="text-2xl font-bold text-purple-800">
                        {((vendor.commissionRate || 0) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Business Verification Profile */}
              <div className="border-t border-gray-200 pt-6 mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-800">
                    Business Verification Profile
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 mr-1">Verification:</span>
                    <Badge
                      variant={
                        vendor.verificationStatus === "Approved"
                          ? "success"
                          : vendor.verificationStatus === "Pending"
                            ? "warning"
                            : vendor.verificationStatus === "Rejected"
                              ? "error"
                              : "neutral"
                      }>
                      {vendor.verificationStatus || "Unsubmitted"}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-6 rounded-xl border">
                  <div className="space-y-3">
                    <p className="text-sm"><strong className="text-gray-600">Business Type:</strong> <span className="font-semibold text-gray-800">{vendor.businessType || 'Other'}</span></p>
                    <p className="text-sm"><strong className="text-gray-600">GST Registered:</strong> <span className="font-semibold text-gray-800">{vendor.gstRegistered ? 'Yes' : 'No'}</span></p>
                    {vendor.gstRegistered ? (
                      <>
                        <p className="text-sm"><strong className="text-gray-600">Business Legal Name:</strong> <span className="font-semibold text-gray-800">{vendor.businessName || 'N/A'}</span></p>
                        <p className="text-sm"><strong className="text-gray-600">Trade Name:</strong> <span className="font-semibold text-gray-800">{vendor.tradeName || 'N/A'}</span></p>
                        <p className="text-sm"><strong className="text-gray-600">GST Number:</strong> <span className="font-semibold text-gray-800 font-mono">{vendor.gstNumber || 'N/A'}</span></p>
                        <p className="text-sm"><strong className="text-gray-600">PAN Number:</strong> <span className="font-semibold text-gray-800 font-mono">{vendor.panNumber || 'N/A'}</span></p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm"><strong className="text-gray-600">Business Name:</strong> <span className="font-semibold text-gray-800">{vendor.businessName || 'N/A'}</span></p>
                        <p className="text-sm"><strong className="text-gray-600">Owner Name:</strong> <span className="font-semibold text-gray-800">{vendor.ownerName || 'N/A'}</span></p>
                      </>
                    )}
                    <p className="text-sm">
                      <strong className="text-gray-600">Address:</strong>{' '}
                      <span className="font-semibold text-gray-800">
                        {vendor.businessAddress || 'N/A'}
                        {vendor.city && `, ${vendor.city}`}
                        {vendor.state && `, ${vendor.state}`}
                        {vendor.pincode && ` - ${vendor.pincode}`}
                      </span>
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-bold text-gray-800 text-sm">Uploaded Verification Documents</h4>
                    <div className="space-y-2">
                      {vendor.gstRegistered ? (
                        <>
                          <div className="flex items-center justify-between bg-white p-3 rounded-lg border">
                            <span className="text-xs font-semibold text-gray-700">GST Certificate (Mandatory)</span>
                            {vendor.gstCertificate ? (
                              <a href={vendor.gstCertificate} target="_blank" rel="noreferrer" className="text-xs text-purple-600 hover:underline font-semibold">View File</a>
                            ) : (
                              <span className="text-xs text-red-500 font-semibold">Not Uploaded</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between bg-white p-3 rounded-lg border">
                            <span className="text-xs font-semibold text-gray-700">MSME Certificate (Optional)</span>
                            {vendor.msmeCertificate ? (
                              <a href={vendor.msmeCertificate} target="_blank" rel="noreferrer" className="text-xs text-purple-600 hover:underline font-semibold">View File</a>
                            ) : (
                              <span className="text-xs text-gray-400">Not Uploaded</span>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-between bg-white p-3 rounded-lg border">
                          <span className="text-xs font-semibold text-gray-700">Identity Proof (Mandatory)</span>
                          {vendor.identityProof ? (
                            <a href={vendor.identityProof} target="_blank" rel="noreferrer" className="text-xs text-purple-600 hover:underline font-semibold">View File</a>
                          ) : (
                            <span className="text-xs text-red-500 font-semibold">Not Uploaded</span>
                          )}
                        </div>
                      )}

                      {vendor.registrationProofUrl && (
                        <div className="flex items-center justify-between bg-white p-3 rounded-lg border">
                          <div className="flex flex-col min-w-0 mr-4">
                            <span className="text-xs font-semibold text-gray-700 truncate">
                              {vendor.registrationProofName || 'Registration Proof'}
                            </span>
                            {vendor.registrationProofUploadedAt && (
                              <span className="text-[10px] text-gray-400">
                                Uploaded: {new Date(vendor.registrationProofUploadedAt).toLocaleString()}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <a 
                              href={vendor.registrationProofUrl} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-xs text-purple-600 hover:underline font-semibold"
                            >
                              Preview
                            </a>
                            <span className="text-gray-300 text-xs">|</span>
                            <a 
                              href={vendor.registrationProofUrl} 
                              download
                              onClick={(e) => {
                                e.preventDefault();
                                fetch(vendor.registrationProofUrl)
                                  .then(response => response.blob())
                                  .then(blob => {
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    const filename = vendor.registrationProofUrl.split('/').pop() || 'document';
                                    a.download = filename;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    window.URL.revokeObjectURL(url);
                                  })
                                  .catch(() => {
                                    window.open(vendor.registrationProofUrl, '_blank');
                                  });
                              }}
                              className="text-xs text-purple-600 hover:underline font-semibold"
                            >
                              Download
                            </a>
                          </div>
                        </div>
                      )}

                      {vendor.businessLetterUrl && (
                        <div className="flex items-center justify-between bg-white p-3 rounded-lg border">
                          <div className="flex flex-col min-w-0 mr-4">
                            <span className="text-xs font-semibold text-gray-700 truncate">
                              {vendor.businessLetterName || 'Signed Declaration Letter'}
                            </span>
                            {vendor.businessLetterUploadedAt && (
                              <span className="text-[10px] text-gray-400">
                                Uploaded: {new Date(vendor.businessLetterUploadedAt).toLocaleString()}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <a 
                              href={vendor.businessLetterUrl} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-xs text-purple-600 hover:underline font-semibold"
                            >
                              Preview
                            </a>
                            <span className="text-gray-300 text-xs">|</span>
                            <a 
                              href={vendor.businessLetterUrl} 
                              download
                              onClick={(e) => {
                                e.preventDefault();
                                fetch(vendor.businessLetterUrl)
                                  .then(response => response.blob())
                                  .then(blob => {
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    const filename = vendor.businessLetterUrl.split('/').pop() || 'business_letter';
                                    a.download = filename;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    window.URL.revokeObjectURL(url);
                                  })
                                  .catch(() => {
                                    window.open(vendor.businessLetterUrl, '_blank');
                                  });
                              }}
                              className="text-xs text-purple-600 hover:underline font-semibold"
                            >
                              Download
                            </a>
                          </div>
                        </div>
                      )}

                      {vendor.partnershipAgreementUrl && (
                        <div className="flex items-center justify-between bg-white p-3 rounded-lg border">
                          <div className="flex flex-col min-w-0 mr-4">
                            <span className="text-xs font-semibold text-gray-700 truncate">
                              {vendor.partnershipAgreementName || 'Signed Partnership Agreement'}
                            </span>
                            {vendor.partnershipAgreementUploadedAt && (
                              <span className="text-[10px] text-gray-400">
                                Uploaded: {new Date(vendor.partnershipAgreementUploadedAt).toLocaleString()}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <a 
                              href={vendor.partnershipAgreementUrl} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-xs text-purple-600 hover:underline font-semibold"
                            >
                              Preview
                            </a>
                            <span className="text-gray-300 text-xs">|</span>
                            <a 
                              href={vendor.partnershipAgreementUrl} 
                              download
                              onClick={(e) => {
                                e.preventDefault();
                                fetch(vendor.partnershipAgreementUrl)
                                  .then(response => response.blob())
                                  .then(blob => {
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    const filename = vendor.partnershipAgreementUrl.split('/').pop() || 'partnership_agreement';
                                    a.download = filename;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    window.URL.revokeObjectURL(url);
                                  })
                                  .catch(() => {
                                    window.open(vendor.partnershipAgreementUrl, '_blank');
                                  });
                              }}
                              className="text-xs text-purple-600 hover:underline font-semibold"
                            >
                              Download
                            </a>
                          </div>
                        </div>
                      )}
                    </div>

                    {vendor.verificationStatus === 'Pending' && (
                      <div className="pt-4 border-t flex gap-2">
                        <button
                          onClick={() => handleVerifyBusiness()}
                          className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-semibold text-xs"
                        >
                          <FiCheckCircle />
                          Verify Business
                        </button>
                        <button
                          onClick={() => setShowRejectModal(true)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-semibold text-xs"
                        >
                          <FiXCircle />
                          Reject Business
                        </button>
                      </div>
                    )}

                    {vendor.verificationStatus === 'Rejected' && vendor.verificationRemark && (
                      <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700">
                        <strong>Rejection Reason:</strong> {vendor.verificationRemark}
                      </div>
                    )}
                  </div>
                </div>

                {/* B2B Selling Authorization Section */}
                <div className="mt-8 border-t border-gray-200 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                        <FiShield className="text-primary-600" /> B2B Wholesale Selling Authorization
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Controls whether this vendor is authorized to list products and sell in B2B Wholesale channels.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          vendor.b2bSellingStatus === "approved"
                            ? "success"
                            : vendor.b2bSellingStatus === "pending"
                              ? "warning"
                              : vendor.b2bSellingStatus === "rejected"
                                ? "error"
                                : "neutral"
                        }
                      >
                        {vendor.b2bSellingStatus === "approved" 
                          ? "B2B Approved" 
                          : vendor.b2bSellingStatus === "pending" 
                            ? "Pending Review" 
                            : vendor.b2bSellingStatus === "rejected" 
                              ? "B2B Rejected" 
                              : "Not Applied"}
                      </Badge>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-gray-500 block">GST Status:</span>
                        <span className="font-bold text-gray-800">
                          {vendor.b2bSellingGstStatus === 'gst_registered' || vendor.gstRegistered ? 'GST Registered' : 'Non-GST Seller'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">GST Number:</span>
                        <span className="font-bold font-mono text-gray-800">
                          {vendor.b2bSellingGstNumber || vendor.gstNumber || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">GST Certificate:</span>
                        {(vendor.b2bSellingGstCertificate || vendor.gstCertificate) ? (
                          <a
                            href={vendor.b2bSellingGstCertificate || vendor.gstCertificate}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-primary-600 hover:text-primary-800 inline-flex items-center gap-1"
                          >
                            <FiFileText /> View Certificate &rarr;
                          </a>
                        ) : (
                          <span className="text-gray-400">Not Uploaded</span>
                        )}
                      </div>
                    </div>

                    {vendor.b2bSellingRejectionReason && (
                      <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700">
                        <strong>B2B Rejection Reason:</strong> {vendor.b2bSellingRejectionReason}
                      </div>
                    )}

                    <div className="pt-3 border-t flex flex-wrap items-center gap-3">
                      {vendor.b2bSellingStatus !== 'approved' ? (
                        <button
                          onClick={handleApproveB2B}
                          disabled={!vendor.b2bSellingGstNumber && !vendor.gstNumber}
                          className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-semibold text-xs shadow-sm"
                        >
                          <FiCheckCircle />
                          Approve B2B Selling
                        </button>
                      ) : (
                        <span className="text-xs text-green-700 font-bold flex items-center gap-1">
                          <FiCheckCircle /> B2B Selling is active for this seller
                        </span>
                      )}

                      <button
                        onClick={() => { setB2bRejectRemark(""); setShowB2BRejectModal(true); }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg transition-colors font-semibold text-xs"
                      >
                        <FiXCircle />
                        Reject / Revoke B2B Access
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Orders Tab */}
          {activeTab === "orders" && (
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-4">
                Vendor Orders
              </h2>
              {vendorOrders.length > 0 ? (
                <DataTable
                  data={vendorOrders}
                  columns={orderColumns}
                  pagination={true}
                  itemsPerPage={10}
                />
              ) : (
                <p className="text-gray-500 text-center py-8">
                  No orders found
                </p>
              )}
            </div>
          )}

          {/* Commissions Tab */}
          {activeTab === "commissions" && (
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-4">
                Commission History
              </h2>
              {commissions.length > 0 ? (
                <DataTable
                  data={commissions}
                  columns={commissionColumns}
                  pagination={true}
                  itemsPerPage={10}
                />
              ) : (
                <p className="text-gray-500 text-center py-8">
                  No commission records found
                </p>
              )}
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === "settings" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-gray-800 mb-4">
                  Commission Rate
                </h2>
                <div className="flex items-center gap-4">
                  {isEditingCommission ? (
                    <>
                      <input
                        type="number"
                        value={commissionRate}
                        onChange={(e) => setCommissionRate(e.target.value)}
                        min="0"
                        max="100"
                        step="0.1"
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 w-32"
                        placeholder="10.0"
                      />
                      <button
                        onClick={handleCommissionUpdate}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-bold">
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingCommission(false);
                          setCommissionRate(
                            ((vendor.commissionRate || 0) * 100).toFixed(1)
                          );
                        }}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-bold">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-gray-800">
                        {((vendor.commissionRate || 0) * 100).toFixed(1)}%
                      </p>
                      <button
                        onClick={() => setIsEditingCommission(true)}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2 font-bold">
                        <FiEdit />
                        Edit
                      </button>
                    </>
                  )}
                </div>
              </div>

              <hr className="border-gray-200" />
              
              <div>
                <h2 className="text-lg font-bold text-gray-800 mb-2">
                  Refurbished Selling Control
                </h2>
                <p className="text-xs text-gray-500 mb-4">
                  Authorize this vendor to submit Refurbished, Renewed, and Open-Box product listings for approval.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleToggleRefurbished}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isRefurbishedEnabled ? "bg-[#C07A3D]" : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isRefurbishedEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                  <span className="text-sm font-semibold text-gray-700">
                    {isRefurbishedEnabled ? "Refurbished Selling Enabled" : "Refurbished Selling Disabled"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === "documents" && (
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-4">
                Vendor Documents
              </h2>
              {documents.length > 0 ? (
                <DataTable
                  data={documents}
                  columns={documentColumns}
                  pagination={true}
                  itemsPerPage={10}
                />
              ) : (
                <p className="text-gray-500 text-center py-8">
                  No documents found for this vendor.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reject Business Verification Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Reject Business Verification</h3>
            <p className="text-sm text-gray-600">Please provide a reason for rejecting the verification request. This remark will be sent to the vendor.</p>
            <textarea
              value={rejectRemark}
              onChange={(e) => setRejectRemark(e.target.value)}
              rows={4}
              placeholder="Enter rejection remark..."
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-800 text-sm"
              required
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowRejectModal(false); setRejectRemark(""); }}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectBusinessSubmit}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 font-semibold"
              >
                Reject Verification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject B2B Application Modal */}
      {showB2BRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-red-600">Reject / Revoke B2B Selling Access</h3>
            <p className="text-sm text-gray-600">Please provide a reason for rejecting the B2B wholesale application. This remark will be visible to the vendor.</p>
            <textarea
              value={b2bRejectRemark}
              onChange={(e) => setB2bRejectRemark(e.target.value)}
              rows={4}
              placeholder="Enter B2B rejection remark (e.g. Invalid GST certificate, Non-GST seller)..."
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-800 text-sm"
              required
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowB2BRejectModal(false); setB2bRejectRemark(""); }}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectB2BSubmit}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 font-semibold"
              >
                Confirm B2B Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default VendorDetail;
