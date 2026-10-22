import { useState, useMemo, useEffect } from "react";
import api from "../../../../shared/utils/api";
import {
  FiSearch,
  FiEye,
  FiCheckCircle,
  FiXCircle,
  FiTrendingUp,
  FiClock,
  FiAlertOctagon,
  FiBriefcase,
  FiX,
  FiDownload,
  FiFileText,
  FiMapPin,
  FiCreditCard,
  FiUserCheck,
  FiCopy,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import DataTable from "../../components/DataTable";
import ExportButton from "../../components/ExportButton";
import Badge from "../../../../shared/components/Badge";
import AnimatedSelect from "../../components/AnimatedSelect";
import { formatPrice } from "../../../../shared/utils/helpers";
import toast from "react-hot-toast";


const BusinessUsers = () => {
  const [users, setUsers] = useState([]);
  const [backendStats, setBackendStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);

  const fetchB2BUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get("/admin/b2b-users");
      const fetchedData = response?.data?.data || response?.data || response;
      if (fetchedData?.b2bUsers) {
        // Map backend properties to table schema to maintain compatibility
        const mappedUsers = fetchedData.b2bUsers.map((u) => ({
          id: u._id,
          _id: u._id,
          businessName: u.companyName || u.name,
          gstin: u.gstNumber || '',
          pan: u.gstNumber ? u.gstNumber.substring(2, 12) : '',
          contactPerson: u.admin?.adminName || u.name || 'N/A',
          email: u.admin?.adminEmail || u.businessEmail || 'N/A',
          phone: u.businessPhone || u.phone || 'N/A',
          type: u.companyType || 'Retailer',
          status: u.verificationStatus === 'Approved' ? 'Verified' : u.verificationStatus === 'Rejected' ? 'Suspended' : 'Pending Verification',
          ordersCount: 0,
          totalSpent: 0,
          address: u.companyAddress || '',
          creditTerms: u.verificationStatus === 'Approved' ? 'Net 30' : 'Prepaid Only',
          creditLimit: u.verificationStatus === 'Approved' ? 100000 : 0,
          joinDate: u.createdAt ? u.createdAt.substring(0, 10) : new Date().toISOString().substring(0,10),
          gstCertificate: u.gstCertificate,
          bankDetails: u.bankDetails || null,
          cancelledCheque: u.cancelledCheque || null,
        }));
        
        setUsers(mappedUsers);
        
        const b2bStats = {
          total: mappedUsers.length,
          approved: mappedUsers.filter(u => u.status === 'Verified').length,
          pending: mappedUsers.filter(u => u.status === 'Pending Verification').length,
          rejected: mappedUsers.filter(u => u.status === 'Suspended').length
        };
        setBackendStats(b2bStats);
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error("Failed to fetch real B2B users", error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchB2BUsers();
  }, []);

  // Stats calculation
  const stats = useMemo(() => {
    return {
      total: backendStats.total || users.length,
      verified: backendStats.approved || users.filter((u) => u.status === "Verified").length,
      pending: backendStats.pending || users.filter((u) => u.status === "Pending Verification").length,
      suspended: backendStats.rejected || users.filter((u) => u.status === "Suspended").length,
    };
  }, [users, backendStats]);

  // Action Handlers
  const handleVerify = async (id, businessName) => {
    try {
      await api.patch(`/admin/b2b-users/${id}/status`, { status: "approved" });
      toast.success(`GSTIN for ${businessName} verified successfully!`);
      fetchB2BUsers();
      if (selectedUser && selectedUser.id === id) {
        setSelectedUser((prev) => ({ ...prev, status: "Verified", creditTerms: "Net 30", creditLimit: 100000 }));
      }
    } catch (error) {
      toast.error(error.message || "Verification failed.");
    }
  };

  const handleSuspend = async (id, businessName) => {
    try {
      await api.patch(`/admin/b2b-users/${id}/status`, { status: "rejected" });
      toast.error(`${businessName} has been suspended.`);
      fetchB2BUsers();
      if (selectedUser && selectedUser.id === id) {
        setSelectedUser((prev) => ({ ...prev, status: "Suspended", creditTerms: "None", creditLimit: 0 }));
      }
    } catch (error) {
      toast.error(error.message || "Failed to suspend.");
    }
  };

  const handleActivate = async (id, businessName) => {
    try {
      await api.patch(`/admin/b2b-users/${id}/status`, { status: "approved" });
      toast.success(`${businessName} activated successfully.`);
      fetchB2BUsers();
      if (selectedUser && selectedUser.id === id) {
        setSelectedUser((prev) => ({ ...prev, status: "Verified", creditTerms: "Net 15", creditLimit: 50000 }));
      }
    } catch (error) {
      toast.error(error.message || "Failed to activate.");
    }
  };

  // Filter logic
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.gstin.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        selectedStatus === "all" || user.status === selectedStatus;

      const matchesType =
        selectedType === "all" || user.type === selectedType;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [users, searchQuery, selectedStatus, selectedType]);

  const columns = [
    {
      key: "businessName",
      label: "Business Name / GSTIN",
      sortable: true,
      render: (value, row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-gray-800">{value}</span>
          <span className="text-xs text-gray-500 font-mono select-all">GSTIN: {row.gstin}</span>
        </div>
      ),
    },
    {
      key: "contactPerson",
      label: "Contact Person",
      sortable: true,
      render: (value, row) => (
        <div className="flex flex-col text-xs sm:text-sm">
          <span className="font-medium text-gray-700">{value}</span>
          <span className="text-xs text-gray-400">{row.email}</span>
        </div>
      ),
    },
    {
      key: "type",
      label: "Type",
      sortable: true,
      render: (value) => {
        let variant = "info";
        if (value === "Wholesaler") variant = "warning";
        if (value === "Distributor") variant = "success";
        return <Badge variant={variant}>{value}</Badge>;
      },
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (value) => {
        let variant = "warning";
        if (value === "Verified") variant = "success";
        if (value === "Suspended") variant = "error";
        return (
          <Badge variant={variant}>
            {value === "Verified" ? "Verified ✅" : value === "Suspended" ? "Suspended ❌" : "Pending ⏳"}
          </Badge>
        );
      },
    },
    {
      key: "ordersCount",
      label: "Orders",
      sortable: true,
      render: (value) => <span className="text-sm font-medium text-gray-800">{value}</span>,
    },
    {
      key: "totalSpent",
      label: "Total Spent",
      sortable: true,
      render: (value) => (
        <span className="text-sm font-semibold text-gray-900">
          {formatPrice(value)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setSelectedUser(row)}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="View Profile Details"
          >
            <FiEye className="w-4 h-4" />
          </button>
          {row.status === "Pending Verification" && (
            <button
              onClick={() => handleVerify(row.id, row.businessName)}
              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="Verify Business"
            >
              <FiCheckCircle className="w-4 h-4" />
            </button>
          )}
          {row.status === "Verified" && (
            <button
              onClick={() => handleSuspend(row.id, row.businessName)}
              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Suspend Business"
            >
              <FiXCircle className="w-4 h-4" />
            </button>
          )}
          {row.status === "Suspended" && (
            <button
              onClick={() => handleActivate(row.id, row.businessName)}
              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title="Reactivate Business"
            >
              <FiUserCheck className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1.5">
            Business Users
          </h1>
          <p className="text-sm text-gray-500">
            Verify and manage wholesalers, retailers, and distributors signed up for B2B procurement.
          </p>
        </div>
      </div>

      {/* Analytics Rows */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <FiBriefcase className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Businesses</p>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">{stats.total}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
            <FiCheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Verified Accounts</p>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">{stats.verified}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <FiClock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pending Verification</p>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">{stats.pending}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
            <FiAlertOctagon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Suspended Accounts</p>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">{stats.suspended}</h3>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200/80">
        {/* Filters */}
        <div className="mb-6 pb-6 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row flex-wrap items-center gap-4">
            <div className="relative flex-1 w-full sm:min-w-[260px]">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by company, owner, GSTIN..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
            </div>

            <div className="w-full sm:w-auto flex items-center gap-2">
              <span className="text-xs text-gray-400 font-medium hidden md:inline">Status:</span>
              <AnimatedSelect
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                options={[
                  { value: "all", label: "All Statuses" },
                  { value: "Verified", label: "Verified Only" },
                  { value: "Pending Verification", label: "Pending Verification" },
                  { value: "Suspended", label: "Suspended" },
                ]}
                className="w-full sm:w-auto min-w-[150px]"
              />
            </div>

            <div className="w-full sm:w-auto flex items-center gap-2">
              <span className="text-xs text-gray-400 font-medium hidden md:inline">Type:</span>
              <AnimatedSelect
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                options={[
                  { value: "all", label: "All Account Types" },
                  { value: "Wholesaler", label: "Wholesalers" },
                  { value: "Retailer", label: "Retailers" },
                  { value: "Distributor", label: "Distributors" },
                ]}
                className="w-full sm:w-auto min-w-[150px]"
              />
            </div>

            <div className="w-full sm:w-auto ml-auto">
              <ExportButton
                data={filteredUsers}
                headers={[
                  { label: "ID", accessor: (row) => row.id },
                  { label: "Business Name", accessor: (row) => row.businessName },
                  { label: "GSTIN", accessor: (row) => row.gstin },
                  { label: "PAN", accessor: (row) => row.pan },
                  { label: "Contact Person", accessor: (row) => row.contactPerson },
                  { label: "Email", accessor: (row) => row.email },
                  { label: "Phone", accessor: (row) => row.phone },
                  { label: "Type", accessor: (row) => row.type },
                  { label: "Status", accessor: (row) => row.status },
                  { label: "Orders Count", accessor: (row) => row.ordersCount },
                  { label: "Total Spent (₹)", accessor: (row) => row.totalSpent },
                  { label: "Credit Terms", accessor: (row) => row.creditTerms },
                  { label: "Credit Limit (₹)", accessor: (row) => row.creditLimit },
                  { label: "Join Date", accessor: (row) => row.joinDate },
                ]}
                filename="b2b_business_users"
              />
            </div>
          </div>
        </div>

        {/* DataTable */}
        <DataTable
          data={filteredUsers}
          columns={columns}
          pagination={true}
          itemsPerPage={10}
          onRowClick={(row) => setSelectedUser(row)}
        />
      </div>

      {/* Profile Detail Slide-out Drawer */}
      <AnimatePresence>
        {selectedUser && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedUser(null)}
              className="fixed inset-0 bg-black z-50"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 w-full sm:w-[500px] bg-white shadow-2xl z-50 flex flex-col h-full border-l border-gray-100"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full font-mono">
                      {selectedUser.id}
                    </span>
                    <Badge
                      variant={
                        selectedUser.status === "Verified"
                          ? "success"
                          : selectedUser.status === "Suspended"
                          ? "error"
                          : "warning"
                      }
                    >
                      {selectedUser.status}
                    </Badge>
                  </div>
                  <h2 className="text-lg font-bold text-gray-900 mt-1 truncate max-w-[320px]">
                    {selectedUser.businessName}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600"
                >
                  <FiX className="w-5 h-5" strokeWidth={2.5} />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Business Details Section */}
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <FiBriefcase className="w-4 h-4" /> Company Profile
                  </h3>
                  <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-2xl p-4 border border-gray-100 text-xs sm:text-sm">
                    <div>
                      <p className="text-gray-400 text-xs">GSTIN</p>
                      <p className="font-semibold text-gray-800 mt-0.5 font-mono select-all">{selectedUser.gstin}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">PAN Card</p>
                      <p className="font-semibold text-gray-800 mt-0.5 font-mono select-all">{selectedUser.pan}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Business Type</p>
                      <p className="font-semibold text-gray-800 mt-0.5">{selectedUser.type}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Join Date</p>
                      <p className="font-semibold text-gray-800 mt-0.5">
                        {new Date(selectedUser.joinDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Primary Contact Section */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <FiFileText className="w-4 h-4" /> Primary Contact
                  </h3>
                  <div className="border border-gray-100 rounded-2xl p-4 space-y-2.5 text-xs sm:text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Contact Person</span>
                      <span className="font-medium text-gray-800">{selectedUser.contactPerson}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Email Address</span>
                      <span className="font-medium text-gray-800 font-mono select-all">{selectedUser.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Phone Number</span>
                      <span className="font-medium text-gray-800 font-mono select-all">{selectedUser.phone}</span>
                    </div>
                  </div>
                </div>

                {/* Address Section */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <FiMapPin className="w-4 h-4" /> Registered Address
                  </h3>
                  <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50/50">
                    <p className="text-xs sm:text-sm text-gray-700 leading-relaxed font-medium">
                      {selectedUser.address}
                    </p>
                  </div>
                </div>

                {/* Credit & Terms Section */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <FiCreditCard className="w-4 h-4" /> Credit & Procurement Terms
                  </h3>
                  <div className="border border-gray-100 rounded-2xl p-4 space-y-2.5 text-xs sm:text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Default Credit Terms</span>
                      <span className="font-semibold text-gray-800">{selectedUser.creditTerms}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Approved Credit Limit</span>
                      <span className="font-bold text-gray-900">{formatPrice(selectedUser.creditLimit)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total B2B Spend</span>
                      <span className="font-bold text-gray-900">{formatPrice(selectedUser.totalSpent)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Orders Fulfilled</span>
                      <span className="font-semibold text-gray-800">{selectedUser.ordersCount}</span>
                    </div>
                  </div>
                </div>

                {/* Company Bank Account Details */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                      <FiCreditCard className="w-4 h-4 text-[#D71920]" /> Company Bank Details
                    </h3>
                    {selectedUser.bankDetails?.accountNumber ? (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Configured
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        Not Provided
                      </span>
                    )}
                  </div>
                  {selectedUser.bankDetails?.accountNumber ? (
                    <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50/50 space-y-2.5 text-xs sm:text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-xs">Account Holder</span>
                        <span className="font-semibold text-gray-800">{selectedUser.bankDetails.accountHolderName || selectedUser.businessName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-xs">Bank Name</span>
                        <span className="font-semibold text-gray-800">{selectedUser.bankDetails.bankName || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-xs">Account Number</span>
                        <div className="flex items-center gap-1.5 font-mono font-bold text-gray-900">
                          <span>{selectedUser.bankDetails.accountNumber}</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(selectedUser.bankDetails.accountNumber);
                              toast.success('Account Number copied!');
                            }}
                            className="text-gray-400 hover:text-gray-700 p-0.5"
                            title="Copy Account Number"
                          >
                            <FiCopy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-xs">IFSC Code</span>
                        <div className="flex items-center gap-1.5 font-mono font-bold text-gray-900 uppercase">
                          <span>{selectedUser.bankDetails.ifscCode}</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(selectedUser.bankDetails.ifscCode);
                              toast.success('IFSC Code copied!');
                            }}
                            className="text-gray-400 hover:text-gray-700 p-0.5"
                            title="Copy IFSC"
                          >
                            <FiCopy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-xs">Account Type</span>
                        <span className="font-medium text-gray-800">{selectedUser.bankDetails.accountType || 'Current'} Account</span>
                      </div>
                      {selectedUser.bankDetails.branchName && (
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-xs">Branch</span>
                          <span className="font-medium text-gray-800">{selectedUser.bankDetails.branchName}</span>
                        </div>
                      )}
                      {selectedUser.bankDetails.upiId && (
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-xs">Corporate UPI</span>
                          <span className="font-mono text-gray-800">{selectedUser.bankDetails.upiId}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 italic p-3 border border-dashed border-gray-200 rounded-xl">
                      No bank details have been added by the B2B company yet.
                    </div>
                  )}
                </div>

                {/* Verification Documents */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <FiDownload className="w-4 h-4" /> Documents Submitted
                  </h3>
                  <div className="grid grid-cols-1 gap-2">
                    {selectedUser.gstCertificate && (
                      <a
                        href={selectedUser.gstCertificate}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer bg-white"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FiFileText className="w-4 h-4 text-orange-500 flex-shrink-0" />
                          <span className="text-xs font-medium text-gray-700 truncate">GST_Certificate.pdf</span>
                        </div>
                        <FiDownload className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-1" />
                      </a>
                    )}
                    {selectedUser.cancelledCheque?.url && (
                      <a
                        href={selectedUser.cancelledCheque.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer bg-white"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FiFileText className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          <span className="text-xs font-medium text-gray-700 truncate">{selectedUser.cancelledCheque.fileName || 'Cancelled_Cheque.pdf'}</span>
                        </div>
                        <FiDownload className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-1" />
                      </a>
                    )}
                    {!selectedUser.gstCertificate && !selectedUser.cancelledCheque?.url && (
                      <div className="text-xs text-gray-500 italic p-3 border border-dashed border-gray-200 rounded-xl">
                        No certificate or cancelled cheque document uploaded.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-6 border-t border-gray-100 flex items-center gap-3">
                {selectedUser.status === "Pending Verification" && (
                  <button
                    onClick={() => handleVerify(selectedUser.id, selectedUser.businessName)}
                    className="flex-1 py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 text-sm transition-colors shadow-sm shadow-green-100"
                  >
                    <FiCheckCircle className="w-4 h-4" /> Verify GST & Approve
                  </button>
                )}
                {selectedUser.status === "Verified" && (
                  <button
                    onClick={() => handleSuspend(selectedUser.id, selectedUser.businessName)}
                    className="flex-1 py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl font-bold flex items-center justify-center gap-2 text-sm transition-colors"
                  >
                    <FiXCircle className="w-4 h-4" /> Suspend Account
                  </button>
                )}
                {selectedUser.status === "Suspended" && (
                  <button
                    onClick={() => handleActivate(selectedUser.id, selectedUser.businessName)}
                    className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 text-sm transition-colors"
                  >
                    <FiUserCheck className="w-4 h-4" /> Reactivate Account
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default BusinessUsers;
