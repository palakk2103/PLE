import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiClock,
  FiSearch,
  FiEye,
  FiAlertTriangle,
  FiCheckCircle,
  FiBriefcase,
  FiTrendingUp,
  FiCalendar,
  FiUser
} from "react-icons/fi";
import { motion } from "framer-motion";
import DataTable from "../../components/DataTable";
import ExportButton from "../../components/ExportButton";
import Badge from "../../../../shared/components/Badge";
import AnimatedSelect from "../../components/AnimatedSelect";
import { formatPrice } from "../../../../shared/utils/helpers";
import api from "../../../../shared/utils/api";
import toast from "react-hot-toast";

const AdminSellerResponses = () => {
  const navigate = useNavigate();
  const [rfqs, setRfqs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResponseStatus, setSelectedResponseStatus] = useState("all");

  // Fetch real RFQs from backend
  useEffect(() => {
    const fetchRFQs = async () => {
      try {
        setLoading(true);
        const res = await api.get("/admin/rfq");
        if (res && res.data) {
          setRfqs(res.data);
        }
      } catch (error) {
        console.error(error);
        toast.error("Failed to load seller response data");
      } finally {
        setLoading(false);
      }
    };
    fetchRFQs();
  }, []);

  // Derive per-vendor SLA rows from real RFQ data
  // For each RFQ that has assignedVendorIds, create one row per vendor showing their response status
  const sellerResponseRows = useMemo(() => {
    const rows = [];
    rfqs.forEach((rfq) => {
      if (!rfq.assignedVendorIds || rfq.assignedVendorIds.length === 0) return;

      // Find the approximate assignment date: use updatedAt (when vendors were assigned) or createdAt
      const assignedDate = new Date(rfq.updatedAt || rfq.createdAt);
      const SLA_HOURS = 48;
      const deadlineDate = new Date(assignedDate.getTime() + SLA_HOURS * 60 * 60 * 1000);

      rfq.assignedVendorIds.forEach((vendor) => {
        const vendorId = typeof vendor === "object" ? vendor._id : vendor;
        const storeName = typeof vendor === "object" ? (vendor.storeName || vendor.name || "Vendor Store") : "Vendor Store";
        const vendorName = typeof vendor === "object" ? (vendor.name || "Vendor Rep") : "Vendor Rep";
        const vendorEmail = typeof vendor === "object" ? (vendor.email || "N/A") : "N/A";

        // Find if this vendor has submitted a quotation
        const quote = (rfq.quotations || []).find(
          (q) => String(q.vendorId) === String(vendorId)
        );

        const hasResponded = !!quote;
        let responseTimeHours = "-";
        let daysElapsed = 0;
        let status = "Pending Response";

        if (hasResponded) {
          status = "Responded";
          const quoteDate = new Date(quote.createdAt || assignedDate);
          const diffMs = quoteDate.getTime() - assignedDate.getTime();
          responseTimeHours = Math.max(0, diffMs / (1000 * 60 * 60)).toFixed(1) + "h";
          daysElapsed = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        } else {
          const now = new Date();
          const diffMs = now.getTime() - assignedDate.getTime();
          daysElapsed = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          if (now > deadlineDate) {
            status = "Overdue";
          }
        }

        rows.push({
          id: `${rfq._id}-${vendorId}`,
          rfqId: rfq._id,
          enquiryNumber: rfq.rfqId,
          buyer: {
            name: rfq.companyName || "B2B Company",
            company: rfq.companyName || "B2B Company",
            email: "N/A"
          },
          seller: {
            id: vendorId,
            storeName,
            name: vendorName,
            email: vendorEmail
          },
          assignedDate: assignedDate.toISOString(),
          deadlineDate: deadlineDate.toISOString(),
          daysElapsed,
          responseTimeHours,
          responseStatus: status,
          quotedAmount: quote ? quote.totalPrice : null,
          rfqStatus: rfq.status
        });
      });
    });
    return rows;
  }, [rfqs]);

  // Compute overall stats
  const stats = useMemo(() => {
    const total = sellerResponseRows.length;
    const responded = sellerResponseRows.filter((r) => r.responseStatus === "Responded").length;
    const pending = sellerResponseRows.filter((r) => r.responseStatus === "Pending Response").length;
    const overdue = sellerResponseRows.filter((r) => r.responseStatus === "Overdue").length;

    const respondedEntries = sellerResponseRows.filter(
      (r) => r.responseStatus === "Responded" && r.responseTimeHours !== "-"
    );
    const avgResponseTimeVal =
      respondedEntries.length > 0
        ? (
            respondedEntries.reduce((acc, curr) => acc + parseFloat(curr.responseTimeHours), 0) /
            respondedEntries.length
          ).toFixed(1)
        : "—";

    return {
      total,
      responded,
      pending,
      overdue,
      avgResponseTime: avgResponseTimeVal !== "—" ? `${avgResponseTimeVal} hrs` : "—",
      slaPerformance: total > 0 ? Math.round(((responded + pending) / total) * 100) : 100
    };
  }, [sellerResponseRows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return sellerResponseRows.filter((row) => {
      const matchesSearch =
        row.enquiryNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.seller.storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.seller.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.buyer.company.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        selectedResponseStatus === "all" || row.responseStatus === selectedResponseStatus;

      return matchesSearch && matchesStatus;
    });
  }, [sellerResponseRows, searchQuery, selectedResponseStatus]);

  const columns = [
    {
      key: "enquiryNumber",
      label: "Enquiry #",
      sortable: true,
      render: (value, row) => (
        <span
          onClick={() => navigate(`/ple-ops-desk/b2b-enquiries/${row.rfqId}`)}
          className="font-bold text-primary-600 font-mono select-all hover:underline cursor-pointer flex items-center gap-1.5"
        >
          {value}
        </span>
      )
    },
    {
      key: "seller",
      label: "Assigned Seller",
      sortable: true,
      render: (value) => (
        <div className="flex flex-col">
          <span className="font-semibold text-gray-800 text-sm">{value.storeName}</span>
          <span className="text-[10px] text-gray-400 font-medium">Rep: {value.name}</span>
        </div>
      )
    },
    {
      key: "buyer",
      label: "Buyer Company",
      sortable: true,
      render: (value) => (
        <span className="text-xs font-semibold text-gray-700">{value.company}</span>
      )
    },
    {
      key: "assignedDate",
      label: "Assigned On",
      sortable: true,
      render: (value) => (
        <div className="flex flex-col text-xs">
          <span className="font-semibold text-gray-700">
            {new Date(value).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric"
            })}
          </span>
          <span className="text-[10px] text-gray-400">
            {new Date(value).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit"
            })}
          </span>
        </div>
      )
    },
    {
      key: "deadlineDate",
      label: "Response SLA Deadline",
      sortable: true,
      render: (value, row) => {
        const isOverdue = row.responseStatus === "Overdue";
        return (
          <div className={`flex flex-col text-xs ${isOverdue ? "text-red-650" : "text-gray-600"}`}>
            <span className="font-bold">
              {new Date(value).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric"
              })}
            </span>
            <span className="text-[10px] opacity-80">
              {new Date(value).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit"
              })}
            </span>
          </div>
        );
      }
    },
    {
      key: "responseStatus",
      label: "SLA Status",
      sortable: true,
      render: (value) => {
        let variant = "warning";
        if (value === "Responded") variant = "success";
        if (value === "Overdue") variant = "danger";
        return <Badge variant={variant}>{value}</Badge>;
      }
    },
    {
      key: "responseTimeHours",
      label: "Turnaround Time",
      sortable: true,
      render: (value, row) => {
        if (row.responseStatus === "Overdue") {
          return (
            <span className="text-xs font-bold text-red-650 flex items-center gap-1">
              <FiAlertTriangle className="w-3.5 h-3.5" /> Lapsed
            </span>
          );
        }
        return (
          <span className="text-xs text-gray-700 font-semibold">
            {value === "-" ? "Running SLA" : value}
          </span>
        );
      }
    },
    {
      key: "quotedAmount",
      label: "Bid Value",
      sortable: true,
      render: (value) => (
        <span className="text-xs font-extrabold text-gray-900">
          {value ? formatPrice(value) : <span className="text-gray-400 font-medium font-sans">No Bid Yet</span>}
        </span>
      )
    },
    {
      key: "actions",
      label: "Action",
      sortable: false,
      render: (_, row) => (
        <button
          onClick={() => navigate(`/ple-ops-desk/b2b-enquiries/${row.rfqId}`)}
          className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
          title="Inspect Details"
        >
          <FiEye className="w-4 h-4" /> Inspect
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
          <FiBriefcase className="text-primary-600" /> Seller SLA &amp; Response Monitor
        </h1>
        <p className="text-sm text-gray-500">
          Supervise seller quotation response times. Manage bottlenecks, identify delay frequencies, and optimize overall RFQ turnaround efficiency.
        </p>
      </div>

      {/* SLA Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600">
            <FiBriefcase className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Assigned RFQs</p>
            <h3 className="text-xl sm:text-2xl font-extrabold text-gray-800 mt-1">{stats.total}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
            <FiCheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bids Received</p>
            <h3 className="text-xl sm:text-2xl font-extrabold text-gray-800 mt-1">{stats.responded}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <FiClock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">In Response SLA</p>
            <h3 className="text-xl sm:text-2xl font-extrabold text-gray-800 mt-1">{stats.pending}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-650">
            <FiAlertTriangle className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Overdue SLAs</p>
            <h3 className="text-xl sm:text-2xl font-extrabold text-gray-800 mt-1">{stats.overdue}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4 col-span-2 lg:col-span-1">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <FiTrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Avg Turnaround</p>
            <h3 className="text-lg sm:text-xl font-extrabold text-gray-800 mt-1">{stats.avgResponseTime}</h3>
          </div>
        </div>
      </div>

      {/* Main SLA Table */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200/80">
        <div className="mb-6 pb-6 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row flex-wrap items-center gap-4">
            <div className="relative flex-1 w-full sm:min-w-[260px]">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Enquiry #, Seller Store, Buyer Company..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm transition-all"
              />
            </div>

            <div className="w-full sm:w-auto flex items-center gap-2">
              <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider hidden md:inline">Filter SLA Status:</span>
              <AnimatedSelect
                value={selectedResponseStatus}
                onChange={(e) => setSelectedResponseStatus(e.target.value)}
                options={[
                  { value: "all", label: "All SLA Statuses" },
                  { value: "Responded", label: "Responded (Bids Submitted)" },
                  { value: "Pending Response", label: "Pending (Within SLA)" },
                  { value: "Overdue", label: "Overdue (SLA Violated)" }
                ]}
                className="w-full sm:w-auto min-w-[200px]"
              />
            </div>

            <div className="w-full sm:w-auto ml-auto">
              <ExportButton
                data={filteredRows}
                headers={[
                  { label: "Enquiry #", accessor: (row) => row.enquiryNumber },
                  { label: "Seller Store", accessor: (row) => row.seller.storeName },
                  { label: "Representative", accessor: (row) => row.seller.name },
                  { label: "Buyer Company", accessor: (row) => row.buyer.company },
                  { label: "Assigned Date", accessor: (row) => row.assignedDate },
                  { label: "SLA Deadline", accessor: (row) => row.deadlineDate },
                  { label: "Days Elapsed", accessor: (row) => row.daysElapsed },
                  { label: "Response Status", accessor: (row) => row.responseStatus },
                  { label: "Turnaround Hours", accessor: (row) => row.responseTimeHours },
                  { label: "Quoted Bid Amount (₹)", accessor: (row) => row.quotedAmount || "0" }
                ]}
                filename="seller_sla_response_reports"
              />
            </div>
          </div>
        </div>

        {/* SLA DataTable */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500 font-bold">Loading seller response data...</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="text-center py-16 text-gray-400 border border-dashed border-gray-200 rounded-2xl">
            <FiBriefcase className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="font-extrabold text-sm text-gray-600">No Vendor Assignments Found</p>
            <p className="text-xs text-gray-400 mt-1">Once RFQs are approved and vendors are assigned, their SLA tracking will appear here.</p>
          </div>
        ) : (
          <DataTable
            data={filteredRows}
            columns={columns}
            pagination={true}
            itemsPerPage={10}
          />
        )}
      </div>
    </motion.div>
  );
};

export default AdminSellerResponses;
