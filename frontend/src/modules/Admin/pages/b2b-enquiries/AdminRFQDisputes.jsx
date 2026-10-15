import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiAlertCircle,
  FiSearch,
  FiEye,
  FiXCircle,
  FiCheckCircle,
  FiShield,
  FiTrendingUp,
  FiCalendar,
  FiX,
  FiMessageSquare,
  FiExternalLink
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import DataTable from "../../components/DataTable";
import ExportButton from "../../components/ExportButton";
import Badge from "../../../../shared/components/Badge";
import AnimatedSelect from "../../components/AnimatedSelect";
import { formatPrice } from "../../../../shared/utils/helpers";
import toast from "react-hot-toast";
import api from "../../../../shared/utils/api";

const mapRfqToDispute = (rfq) => {
  const lastMsg = rfq.negotiationMessages && rfq.negotiationMessages.length > 0
    ? rfq.negotiationMessages[rfq.negotiationMessages.length - 1]
    : null;
  const firstMsg = rfq.negotiationMessages && rfq.negotiationMessages.length > 0
    ? rfq.negotiationMessages[0]
    : null;
  
  // Determine status
  let mappedStatus = "Open";
  if (["Approved", "Vendor Selected", "Awaiting B2B Confirmation", "Purchase Order Generated", "Completed"].includes(rfq.status)) {
    mappedStatus = "Resolved";
  } else if (["Negotiation In Progress", "Under Super Admin Review", "Vendor Negotiation"].includes(rfq.status)) {
    mappedStatus = "Under Investigation";
  }
  
  // Seller store names
  let sellerStore = "No Vendor Assigned";
  if (rfq.assignedVendorIds && rfq.assignedVendorIds.length > 0) {
    sellerStore = rfq.assignedVendorIds.map(v => typeof v === 'object' ? (v.storeName || v.name) : 'Vendor').join(', ');
  }

  return {
    id: `DISP-${rfq.rfqId}`,
    raisedBy: firstMsg?.senderType === "SuperAdmin" ? "Admin" : "Buyer",
    type: rfq.quotations && rfq.quotations.length > 0 ? "Price Discrepancy" : "Negotiation & Terms",
    description: lastMsg?.message || rfq.requirementDetails || "Negotiation thread started.",
    status: mappedStatus,
    createdAt: lastMsg?.createdAt || rfq.updatedAt || rfq.createdAt,
    resolutionNotes: rfq.approvalHistory?.map(h => h.notes).filter(Boolean).join(" | ") || "",
    enquiryId: rfq._id,
    enquiryNumber: rfq.rfqId,
    buyerCompany: rfq.companyName || "B2B Company",
    sellerStore: sellerStore
  };
};

const AdminRFQDisputes = () => {
  const navigate = useNavigate();
  const [rfqs, setRfqs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [disputes, setDisputes] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [resolutionInput, setResolutionInput] = useState("");

  // Fetch real RFQs from backend
  useEffect(() => {
    const fetchRFQs = async () => {
      try {
        setLoading(true);
        const res = await api.get("/admin/rfq");
        if (res && res.data) {
          setRfqs(res.data);
          // Filter RFQs with negotiation messages
          const rfqDiscussions = res.data.filter(
            (rfq) => rfq.negotiationMessages && rfq.negotiationMessages.length > 0
          );
          setDisputes(rfqDiscussions.map(mapRfqToDispute));
        }
      } catch (error) {
        console.error(error);
        toast.error("Failed to load dispute center data");
      } finally {
        setLoading(false);
      }
    };
    fetchRFQs();
  }, []);

  // Update dispute details (status & notes)
  const handleUpdateDispute = (id, nextStatus, notes) => {
    setDisputes((prev) =>
      prev.map((disp) =>
        disp.id === id
          ? {
              ...disp,
              status: nextStatus,
              resolutionNotes: notes || disp.resolutionNotes
            }
          : disp
      )
    );
    toast.success(`Dispute ${id} status updated to ${nextStatus}`);

    if (selectedDispute && selectedDispute.id === id) {
      setSelectedDispute((prev) => ({
        ...prev,
        status: nextStatus,
        resolutionNotes: notes || prev.resolutionNotes
      }));
    }
  };

  // Stats derivation
  const stats = useMemo(() => {
    return {
      total: disputes.length,
      open: disputes.filter((d) => d.status === "Open").length,
      investigating: disputes.filter((d) => d.status === "Under Investigation").length,
      resolved: disputes.filter((d) => d.status === "Resolved").length,
      escalated: disputes.filter((d) => d.status === "Escalated").length
    };
  }, [disputes]);

  // Filters logic
  const filteredDisputes = useMemo(() => {
    return disputes.filter((disp) => {
      const matchesSearch =
        disp.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        disp.enquiryNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        disp.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        disp.buyerCompany.toLowerCase().includes(searchQuery.toLowerCase()) ||
        disp.sellerStore.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = selectedStatus === "all" || disp.status === selectedStatus;
      const matchesType = selectedType === "all" || disp.type === selectedType;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [disputes, searchQuery, selectedStatus, selectedType]);

  const columns = [
    {
      key: "id",
      label: "Dispute ID",
      sortable: true,
      render: (value) => (
        <span className="font-bold text-gray-800 font-mono select-all bg-gray-100 px-2 py-0.5 rounded">
          {value}
        </span>
      )
    },
    {
      key: "enquiryNumber",
      label: "RFQ Ref",
      sortable: true,
      render: (value, row) => (
        <span
          onClick={() => navigate(`/ple-ops-desk/b2b-enquiries/${row.enquiryId}`)}
          className="font-bold text-primary-600 font-mono select-all hover:underline cursor-pointer flex items-center gap-1 text-xs"
        >
          {value}
        </span>
      )
    },
    {
      key: "buyerCompany",
      label: "Disputing Parties",
      sortable: true,
      render: (_, row) => (
        <div className="flex flex-col text-xs">
          <span className="font-bold text-gray-800">B: {row.buyerCompany}</span>
          <span className="text-gray-400 font-medium mt-0.5">S: {row.sellerStore}</span>
        </div>
      )
    },
    {
      key: "raisedBy",
      label: "Raised By",
      sortable: true,
      render: (value) => (
        <Badge variant={value === "Buyer" ? "info" : "warning"}>{value}</Badge>
      )
    },
    {
      key: "type",
      label: "Complaint Category",
      sortable: true,
      render: (value) => (
        <span className="text-xs font-semibold text-gray-700 bg-red-50 text-red-700 px-2 py-0.5 rounded-full border border-red-100/50">
          {value}
        </span>
      )
    },
    {
      key: "description",
      label: "Dispute Description",
      sortable: false,
      render: (value) => (
        <span className="text-xs text-gray-600 truncate block max-w-[200px]" title={value}>
          {value}
        </span>
      )
    },
    {
      key: "status",
      label: "Case Status",
      sortable: true,
      render: (value) => {
        let variant = "warning";
        if (value === "Under Investigation") variant = "info";
        if (value === "Resolved") variant = "success";
        if (value === "Escalated") variant = "danger";
        return <Badge variant={variant}>{value}</Badge>;
      }
    },
    {
      key: "createdAt",
      label: "Raised On",
      sortable: true,
      render: (value) => (
        <span className="text-xs text-gray-500 font-medium">
          {new Date(value).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric"
          })}
        </span>
      )
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (_, row) => (
        <button
          onClick={() => {
            setSelectedDispute(row);
            setResolutionInput(row.resolutionNotes || "");
          }}
          className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
          title="Resolve Case"
        >
          <FiEye className="w-4 h-4" /> Mediate
        </button>
      )
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1.5 flex items-center gap-2.5">
          <FiAlertCircle className="text-primary-600" /> B2B Dispute & Complaint Center
        </h1>
        <p className="text-sm text-gray-500">
          Moderate, review, and arbitrate buyer-seller complaints, pricing disagreements, review harassments, or communication violations.
        </p>
      </div>

      {/* KPI Stats Panel */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600">
            <FiAlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Complaints</p>
            <h3 className="text-xl sm:text-2xl font-extrabold text-gray-800 mt-1">{stats.total}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <FiXCircle className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Open Disputes</p>
            <h3 className="text-xl sm:text-2xl font-extrabold text-gray-800 mt-1">{stats.open}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <FiShield className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Under Audit</p>
            <h3 className="text-xl sm:text-2xl font-extrabold text-gray-800 mt-1">{stats.investigating}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-650">
            <FiAlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">High Escalated</p>
            <h3 className="text-xl sm:text-2xl font-extrabold text-gray-800 mt-1">{stats.escalated}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4 col-span-2 lg:col-span-1">
          <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
            <FiCheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Resolved</p>
            <h3 className="text-xl sm:text-2xl font-extrabold text-gray-800 mt-1">{stats.resolved}</h3>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200/80">
        <div className="mb-6 pb-6 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row flex-wrap items-center gap-4">
            <div className="relative flex-1 w-full sm:min-w-[260px]">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Dispute ID, Enquiry #, Party, Details..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm transition-all"
              />
            </div>

            <div className="w-full sm:w-auto flex items-center gap-2">
              <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider hidden md:inline">Case Status:</span>
              <AnimatedSelect
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                options={[
                  { value: "all", label: "All Statuses" },
                  { value: "Open", label: "Open" },
                  { value: "Under Investigation", label: "Under Investigation" },
                  { value: "Resolved", label: "Resolved" },
                  { value: "Escalated", label: "Escalated" }
                ]}
                className="w-full sm:w-auto min-w-[150px]"
              />
            </div>

            <div className="w-full sm:w-auto flex items-center gap-2">
              <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider hidden md:inline">Type:</span>
              <AnimatedSelect
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                options={[
                  { value: "all", label: "All Types" },
                  { value: "Price Discrepancy", label: "Price Discrepancy" },
                  { value: "Negotiation & Terms", label: "Negotiation & Terms" },
                  { value: "Communication Breach", label: "Communication Breach" }
                ]}
                className="w-full sm:w-auto min-w-[170px]"
              />
            </div>

            <div className="w-full sm:w-auto ml-auto">
              <ExportButton
                data={filteredDisputes}
                headers={[
                  { label: "Dispute ID", accessor: (row) => row.id },
                  { label: "Enquiry #", accessor: (row) => row.enquiryNumber },
                  { label: "Raised By", accessor: (row) => row.raisedBy },
                  { label: "Type", accessor: (row) => row.type },
                  { label: "Buyer Company", accessor: (row) => row.buyerCompany },
                  { label: "Seller Store", accessor: (row) => row.sellerStore },
                  { label: "Status", accessor: (row) => row.status },
                  { label: "Description", accessor: (row) => row.description },
                  { label: "Resolution Notes", accessor: (row) => row.resolutionNotes || "" },
                  { label: "Created Date", accessor: (row) => row.createdAt }
                ]}
                filename="b2b_rfq_dispute_logs"
              />
            </div>
          </div>
        </div>

        {/* Disputes Table */}
        <DataTable
          data={filteredDisputes}
          columns={columns}
          pagination={true}
          itemsPerPage={10}
        />
      </div>

      {/* Slide Drawer for Dispute Resolution */}
      <AnimatePresence>
        {selectedDispute && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDispute(null)}
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
              {/* Header */}
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-red-650 bg-red-50 px-2.5 py-0.5 rounded-full font-mono">
                      {selectedDispute.id}
                    </span>
                    <Badge
                      variant={
                        selectedDispute.status === "Resolved"
                          ? "success"
                          : selectedDispute.status === "Escalated"
                          ? "danger"
                          : selectedDispute.status === "Open"
                          ? "warning"
                          : "info"
                      }
                    >
                      {selectedDispute.status}
                    </Badge>
                  </div>
                  <h2 className="text-base font-bold text-gray-900 mt-1 truncate max-w-[320px]">
                    Mediation Center
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedDispute(null)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600"
                >
                  <FiX className="w-5 h-5" strokeWidth={2.5} />
                </button>
              </div>

              {/* Scrollable details */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Associated RFQ */}
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex justify-between items-center text-xs">
                  <div>
                    <p className="text-gray-400 font-bold uppercase">Associated RFQ Enquiry</p>
                    <p className="font-extrabold text-gray-800 text-sm mt-0.5 font-mono">{selectedDispute.enquiryNumber}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedDispute(null);
                      navigate(`/ple-ops-desk/b2b-enquiries/${selectedDispute.enquiryId}`);
                    }}
                    className="py-1.5 px-3 bg-white hover:bg-gray-50 border border-gray-250 rounded-xl font-bold flex items-center gap-1.5 text-gray-700 transition-colors shadow-sm"
                  >
                    View RFQ <FiExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Dispute Overview info */}
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Complaint Overview</h3>
                  <div className="border border-gray-100 rounded-2xl p-4 space-y-3.5 bg-gray-50/50 text-xs text-gray-700">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase block">Complaint Raised By</span>
                        <span className="font-extrabold text-gray-850 text-xs sm:text-sm">{selectedDispute.raisedBy}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase block">Complaint Category</span>
                        <span className="font-extrabold text-red-750 text-xs sm:text-sm">{selectedDispute.type}</span>
                      </div>
                    </div>

                    <div className="border-t border-gray-200 pt-3">
                      <span className="text-[10px] text-gray-400 font-bold uppercase block">Disputing Buyer</span>
                      <span className="font-extrabold text-gray-850">{selectedDispute.buyerCompany}</span>
                    </div>

                    <div className="border-t border-gray-200 pt-3">
                      <span className="text-[10px] text-gray-400 font-bold uppercase block">Disputing Seller</span>
                      <span className="font-extrabold text-gray-850">{selectedDispute.sellerStore}</span>
                    </div>
                  </div>
                </div>

                {/* Full Description */}
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <FiMessageSquare className="w-4 h-4 text-red-500" /> Filed Complaint Details
                  </h3>
                  <div className="p-4 border border-gray-150 rounded-2xl bg-red-50/20 text-xs sm:text-sm leading-relaxed text-red-900/90 font-medium whitespace-pre-line border-l-4 border-l-red-500">
                    "{selectedDispute.description}"
                  </div>
                </div>

                {/* Resolution Notes form */}
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Administrative Arbitration Form
                  </h3>
                  <div className="space-y-3.5">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Audit & Action Status</label>
                      <div className="grid grid-cols-4 gap-2 mt-1">
                        {["Open", "Under Investigation", "Resolved", "Escalated"].map((status) => {
                          const isCurrent = selectedDispute.status === status;
                          return (
                            <button
                              key={status}
                              onClick={() => handleUpdateDispute(selectedDispute.id, status, resolutionInput)}
                              className={`py-2 px-1 text-[10px] font-bold rounded-xl border text-center transition-all ${
                                isCurrent
                                  ? "bg-primary-600 border-primary-600 text-white shadow-sm"
                                  : "bg-white border-gray-200 text-gray-650 hover:bg-gray-50"
                              }`}
                            >
                              {status}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Arbitration Case Notes</label>
                      <textarea
                        rows={5}
                        value={resolutionInput}
                        onChange={(e) => setResolutionInput(e.target.value)}
                        placeholder="Detail the dispute audit findings, warnings issued, price revisions mediated, or warning bans issued. These logs will be attached to both buyer and seller transaction statements..."
                        className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-3 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex gap-3">
                <button
                  onClick={() => {
                    handleUpdateDispute(selectedDispute.id, "Resolved", resolutionInput);
                    setSelectedDispute(null);
                  }}
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 text-xs sm:text-sm transition-colors shadow-sm shadow-emerald-50"
                >
                  <FiCheckCircle className="w-4.5 h-4.5" /> Resolve Dispute Case
                </button>
                <button
                  onClick={() => {
                    handleUpdateDispute(selectedDispute.id, selectedDispute.status, resolutionInput);
                    setSelectedDispute(null);
                  }}
                  className="flex-1 py-2.5 px-4 bg-gray-900 hover:bg-black text-white rounded-xl font-bold flex items-center justify-center gap-2 text-xs sm:text-sm transition-colors shadow-sm"
                >
                  Save Progress
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AdminRFQDisputes;
