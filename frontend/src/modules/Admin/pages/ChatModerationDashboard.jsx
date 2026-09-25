import { useState, useEffect, useCallback } from "react";
import {
  FiShield,
  FiAlertTriangle,
  FiFilter,
  FiRefreshCw,
  FiChevronLeft,
  FiChevronRight,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiUserX,
  FiMessageSquare,
  FiFlag,
  FiX,
} from "react-icons/fi";
import api from "../../../shared/utils/api";
import toast from "react-hot-toast";

// ── Category display config ──────────────────────────────────
const CATEGORY_LABELS = {
  PHONE_NUMBER:        { label: "Phone Number",          color: "bg-red-100 text-red-700" },
  UPI_ID:              { label: "UPI ID",                 color: "bg-orange-100 text-orange-700" },
  BANK_DETAILS:        { label: "Bank Details",           color: "bg-orange-100 text-orange-700" },
  IFSC:                { label: "IFSC Code",               color: "bg-orange-100 text-orange-700" },
  PAYMENT_LINK:        { label: "Payment Link",           color: "bg-yellow-100 text-yellow-700" },
  EXTERNAL_PAYMENT:    { label: "External Payment",       color: "bg-pink-100 text-pink-700" },
  EMAIL:               { label: "Email Address",          color: "bg-purple-100 text-purple-700" },
  EXTERNAL_CONTACT:    { label: "External Contact",       color: "bg-blue-100 text-blue-700" },
  EXTERNAL_URL:        { label: "External Link",          color: "bg-cyan-100 text-cyan-700" },
  CARD_DETAILS:        { label: "Card / CVV Details",     color: "bg-rose-100 text-rose-700" },
  CREDENTIAL_PHISHING: { label: "OTP / Password Scam",    color: "bg-red-200 text-red-900 font-bold" },
  PAYMENT_QR:          { label: "Payment QR Code",         color: "bg-amber-100 text-amber-800" },
  SUSPICIOUS:          { label: "Suspicious Evasion",     color: "bg-gray-100 text-gray-700" },
  OTHER:               { label: "Other",                  color: "bg-gray-100 text-gray-700" },
};

const ACTION_LABELS = {
  BLOCK: { label: "Blocked", color: "bg-red-100 text-red-700" },
  FLAG:  { label: "Flagged", color: "bg-yellow-100 text-yellow-700" },
};

const DIRECTION_LABELS = {
  USER_TO_VENDOR: "User → Vendor",
  VENDOR_TO_USER: "Vendor → User",
};

const REPORT_REASON_LABELS = {
  OFF_PLATFORM_SOLICITATION: "Off-platform Solicitation",
  HARASSMENT: "Harassment / Abusive",
  FRAUD: "Suspected Fraud / Scam",
  SPAM: "Spam",
  OTHER: "Other Violation",
};

const EMPTY_STATS = { totalViolations: 0, last24Hours: 0, byCategory: [], byAction: [] };

export default function ChatModerationDashboard() {
  const [activeTab, setActiveTab] = useState("violations"); // "violations" | "reports"

  // Violations State
  const [violations, setViolations] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [stats, setStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState(null);

  // User Abuse Reports State
  const [reports, setReports] = useState([]);
  const [reportsPagination, setReportsPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [reportsLoading, setReportsLoading] = useState(false);

  // Filters for violations
  const [filters, setFilters] = useState({
    category: "",
    action: "",
    senderType: "",
    direction: "",
    from: "",
    to: "",
  });
  const [page, setPage] = useState(1);

  // Modal State for Violation Action
  const [selectedViolation, setSelectedViolation] = useState(null);
  const [violationActionType, setViolationActionType] = useState("WARN");
  const [violationDurationHours, setViolationDurationHours] = useState(24);
  const [violationNotes, setViolationNotes] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  // Modal State for Report Action
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportStatusAction, setReportStatusAction] = useState("ACTION_TAKEN");
  const [reportResolutionNotes, setReportResolutionNotes] = useState("");

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await api.get("/admin/chat-moderation/stats");
      setStats(res?.data?.data || EMPTY_STATS);
    } catch {
      setStats(EMPTY_STATS);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchViolations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (filters.category)   params.append("category",   filters.category);
      if (filters.action)     params.append("action",     filters.action);
      if (filters.senderType) params.append("senderType", filters.senderType);
      if (filters.direction)  params.append("direction",  filters.direction);
      if (filters.from)       params.append("from",       filters.from);
      if (filters.to)         params.append("to",         filters.to);

      const res = await api.get(`/admin/chat-moderation/violations?${params.toString()}`);
      const data = res?.data?.data || {};
      setViolations(data.violations || []);
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, pages: 1 });
    } catch {
      setError("Failed to load violations. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  const fetchReports = useCallback(async (targetPage = 1) => {
    setReportsLoading(true);
    try {
      const res = await api.get(`/admin/chat-moderation/reports?page=${targetPage}&limit=20`);
      const data = res?.data?.data || {};
      setReports(data.reports || []);
      setReportsPagination(data.pagination || { page: 1, limit: 20, total: 0, pages: 1 });
    } catch {
      toast.error("Failed to load user reports.");
    } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => {
    if (activeTab === "violations") {
      fetchViolations();
    } else {
      fetchReports();
    }
  }, [activeTab, fetchViolations, fetchReports]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({ category: "", action: "", senderType: "", direction: "", from: "", to: "" });
    setPage(1);
  };

  const hasActiveFilters = Object.values(filters).some(Boolean);

  // Submit action on violation
  const handleSubmitViolationAction = async (e) => {
    e.preventDefault();
    if (!selectedViolation) return;
    try {
      setSubmittingAction(true);
      await api.post(`/admin/chat-moderation/violations/${selectedViolation._id}/action`, {
        actionType: violationActionType,
        durationHours: Number(violationDurationHours),
        notes: violationNotes.trim(),
      });
      toast.success(`Action '${violationActionType}' recorded.`);
      setSelectedViolation(null);
      setViolationNotes("");
      fetchViolations();
      fetchStats();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to take violation action.");
    } finally {
      setSubmittingAction(false);
    }
  };

  // Submit action on report
  const handleSubmitReportAction = async (e) => {
    e.preventDefault();
    if (!selectedReport) return;
    try {
      setSubmittingAction(true);
      await api.post(`/admin/chat-moderation/reports/${selectedReport._id}/action`, {
        status: reportStatusAction,
        resolutionNotes: reportResolutionNotes.trim(),
      });
      toast.success(`Report marked as ${reportStatusAction}.`);
      setSelectedReport(null);
      setReportResolutionNotes("");
      fetchReports(reportsPagination.page);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update report.");
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-50 rounded-lg">
            <FiShield className="text-red-600 text-xl" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Chat Moderation & Compliance</h1>
            <p className="text-sm text-gray-500">Live inspection of policy violations, muting controls, and user abuse reports</p>
          </div>
        </div>
        <button
          onClick={() => {
            fetchStats();
            if (activeTab === "violations") fetchViolations();
            else fetchReports();
          }}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors"
          id="refresh-violations-btn"
        >
          <FiRefreshCw className="text-sm" />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Violations"
          value={statsLoading ? "—" : stats.totalViolations}
          color="text-red-600"
          bg="bg-red-50"
        />
        <StatCard
          label="Last 24 Hours"
          value={statsLoading ? "—" : stats.last24Hours}
          color="text-orange-600"
          bg="bg-orange-50"
        />
        <StatCard
          label="Total Blocked"
          value={statsLoading ? "—" : (stats.byAction?.find(a => a._id === "BLOCK")?.count ?? 0)}
          color="text-red-600"
          bg="bg-red-50"
        />
        <StatCard
          label="Active Reports"
          value={reportsPagination.total || 0}
          color="text-purple-600"
          bg="bg-purple-50"
        />
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab("violations")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === "violations"
              ? "bg-red-600 text-white shadow-sm"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Automated Policy Violations ({pagination.total || 0})
        </button>
        <button
          onClick={() => setActiveTab("reports")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === "reports"
              ? "bg-red-600 text-white shadow-sm"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          User Abuse Reports ({reportsPagination.total || 0})
        </button>
      </div>

      {activeTab === "violations" ? (
        <>
          {/* Category Breakdown */}
          {!statsLoading && stats.byCategory?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Violations by Category</h2>
              <div className="flex flex-wrap gap-2">
                {stats.byCategory.map(item => (
                  <button
                    key={item._id}
                    onClick={() => handleFilterChange("category", filters.category === item._id ? "" : item._id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      filters.category === item._id
                        ? "border-gray-400 ring-2 ring-gray-400 ring-offset-1"
                        : "border-transparent"
                    } ${CATEGORY_LABELS[item._id]?.color || "bg-gray-100 text-gray-700"}`}
                  >
                    <span>{CATEGORY_LABELS[item._id]?.label || item._id}</span>
                    <span className="bg-white bg-opacity-60 rounded-full px-1">{item.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <FiFilter className="text-gray-500 text-sm" />
              <span className="text-sm font-semibold text-gray-700">Filters</span>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="ml-auto text-xs text-red-600 hover:underline">
                  Clear all
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <FilterSelect
                id="filter-category"
                label="Category"
                value={filters.category}
                onChange={v => handleFilterChange("category", v)}
                options={Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ value: k, label: v.label }))}
              />
              <FilterSelect
                id="filter-action"
                label="Action"
                value={filters.action}
                onChange={v => handleFilterChange("action", v)}
                options={[{ value: "BLOCK", label: "Blocked" }, { value: "FLAG", label: "Flagged" }]}
              />
              <FilterSelect
                id="filter-sender"
                label="Sender"
                value={filters.senderType}
                onChange={v => handleFilterChange("senderType", v)}
                options={[{ value: "customer", label: "Customer" }, { value: "vendor", label: "Vendor" }]}
              />
              <FilterSelect
                id="filter-direction"
                label="Direction"
                value={filters.direction}
                onChange={v => handleFilterChange("direction", v)}
                options={[
                  { value: "USER_TO_VENDOR", label: "User → Vendor" },
                  { value: "VENDOR_TO_USER", label: "Vendor → User" },
                ]}
              />
              <div>
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <input
                  id="filter-from"
                  type="date"
                  value={filters.from}
                  onChange={e => handleFilterChange("from", e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">To</label>
                <input
                  id="filter-to"
                  type="date"
                  value={filters.to}
                  onChange={e => handleFilterChange("to", e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>
            </div>
          </div>

          {/* Violations Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">
                Logged Violations
                {!loading && (
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    ({pagination.total} total)
                  </span>
                )}
              </span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-gray-400 text-sm animate-pulse">
                Loading violations...
              </div>
            ) : error ? (
              <div className="p-8 text-center text-red-500 text-sm">{error}</div>
            ) : violations.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                <FiShield className="text-3xl mx-auto mb-2 text-gray-300" />
                No violations found.
                {hasActiveFilters && " Try clearing your filters."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date & Time</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Engine Action</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Direction</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendor</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Admin Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {violations.map(v => (
                      <tr key={v._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {new Date(v.createdAt).toLocaleString("en-IN", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_LABELS[v.category]?.color || "bg-gray-100 text-gray-700"}`}>
                            {CATEGORY_LABELS[v.category]?.label || v.category}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_LABELS[v.action]?.color || "bg-gray-100 text-gray-700"}`}>
                            {ACTION_LABELS[v.action]?.label || v.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {DIRECTION_LABELS[v.direction] || v.direction}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 max-w-[150px] truncate">
                          {v.vendorId?.storeName || v.vendorId?.name || String(v.vendorId?._id || v.vendorId || "—").slice(-6)}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {v.reviewStatus === "ACTION_TAKEN" ? (
                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                              {v.actionTaken || "Action Taken"}
                            </span>
                          ) : v.reviewStatus === "DISMISSED" ? (
                            <span className="text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                              Dismissed
                            </span>
                          ) : (
                            <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-semibold">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setSelectedViolation(v);
                              setViolationActionType("WARN");
                              setViolationDurationHours(24);
                              setViolationNotes("");
                            }}
                            className="text-xs bg-gray-100 hover:bg-red-50 hover:text-red-700 text-gray-700 px-2.5 py-1 rounded-lg border border-gray-200 transition-colors font-semibold"
                          >
                            Review / Action
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {!loading && pagination.pages > 1 && (
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    id="violations-prev-btn"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={pagination.page <= 1}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <FiChevronLeft className="text-sm" />
                  </button>
                  <button
                    id="violations-next-btn"
                    onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                    disabled={pagination.page >= pagination.pages}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <FiChevronRight className="text-sm" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* User Abuse Reports Table */
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">
              User Submitted Abuse Reports
              {!reportsLoading && (
                <span className="ml-2 text-xs font-normal text-gray-400">
                  ({reportsPagination.total} total)
                </span>
              )}
            </span>
          </div>

          {reportsLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm animate-pulse">
              Loading reports...
            </div>
          ) : reports.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              <FiCheckCircle className="text-3xl mx-auto mb-2 text-emerald-400" />
              No user reports pending review.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date & Time</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reported By</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Accused Role</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Details</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {reports.map(r => (
                    <tr key={r._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(r.createdAt).toLocaleString("en-IN", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-800 font-medium">
                        {r.reporterModel === "User" ? (
                          <span>👤 Customer: {r.reporterId?.name || "Customer"}</span>
                        ) : (
                          <span>🏪 Vendor: {r.reporterId?.storeName || r.reporterId?.name || "Vendor"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {r.accusedModel === "Vendor" ? (
                          <span className="font-semibold text-purple-700">Vendor</span>
                        ) : (
                          <span className="font-semibold text-indigo-700">Customer</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
                          {REPORT_REASON_LABELS[r.reason] || r.reason}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate" title={r.details}>
                        {r.details || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {r.status === "ACTION_TAKEN" ? (
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                            Action Taken
                          </span>
                        ) : r.status === "DISMISSED" ? (
                          <span className="text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                            Dismissed
                          </span>
                        ) : (
                          <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-semibold">
                            Pending Review
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedReport(r);
                            setReportStatusAction("ACTION_TAKEN");
                            setReportResolutionNotes("");
                          }}
                          className="text-xs bg-gray-100 hover:bg-purple-50 hover:text-purple-700 text-gray-700 px-2.5 py-1 rounded-lg border border-gray-200 transition-colors font-semibold"
                        >
                          Resolve
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination for Reports */}
          {!reportsLoading && reportsPagination.pages > 1 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                Page {reportsPagination.page} of {reportsPagination.pages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => fetchReports(Math.max(1, reportsPagination.page - 1))}
                  disabled={reportsPagination.page <= 1}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <FiChevronLeft className="text-sm" />
                </button>
                <button
                  onClick={() => fetchReports(Math.min(reportsPagination.pages, reportsPagination.page + 1))}
                  disabled={reportsPagination.page >= reportsPagination.pages}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <FiChevronRight className="text-sm" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Violation Action Modal */}
      {selectedViolation && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 text-gray-900 font-bold text-sm">
                <FiShield className="text-red-600" />
                <span>Take Moderation Action</span>
              </div>
              <button
                onClick={() => setSelectedViolation(null)}
                className="text-gray-400 hover:text-gray-700"
              >
                <FiX />
              </button>
            </div>

            <div className="text-xs bg-gray-50 p-3 rounded-xl space-y-1">
              <p><strong>Category:</strong> {CATEGORY_LABELS[selectedViolation.category]?.label || selectedViolation.category}</p>
              <p><strong>Sender:</strong> {selectedViolation.senderType}</p>
              <p><strong>Direction:</strong> {DIRECTION_LABELS[selectedViolation.direction] || selectedViolation.direction}</p>
            </div>

            <form onSubmit={handleSubmitViolationAction} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Enforcement Action
                </label>
                <select
                  value={violationActionType}
                  onChange={e => setViolationActionType(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="WARN">Formal Warning (Logged)</option>
                  <option value="MUTE">Temporary Account Chat Mute</option>
                  <option value="DISMISS">Dismiss as False Positive</option>
                  <option value="RESOLVE">Mark Resolved without penalty</option>
                </select>
              </div>

              {violationActionType === "MUTE" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Mute Duration
                  </label>
                  <select
                    value={violationDurationHours}
                    onChange={e => setViolationDurationHours(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value={24}>24 Hours</option>
                    <option value={72}>3 Days (72 Hours)</option>
                    <option value={168}>7 Days (168 Hours)</option>
                    <option value={720}>30 Days (720 Hours)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Admin Resolution Notes
                </label>
                <textarea
                  rows={3}
                  value={violationNotes}
                  onChange={e => setViolationNotes(e.target.value)}
                  placeholder="Reason for decision, internal context..."
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedViolation(null)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-sm disabled:opacity-50"
                >
                  {submittingAction ? "Applying..." : "Apply Action"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report Action Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 text-gray-900 font-bold text-sm">
                <FiFlag className="text-red-600" />
                <span>Resolve Abuse Report</span>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="text-gray-400 hover:text-gray-700"
              >
                <FiX />
              </button>
            </div>

            <div className="text-xs bg-gray-50 p-3 rounded-xl space-y-1">
              <p><strong>Reason:</strong> {REPORT_REASON_LABELS[selectedReport.reason] || selectedReport.reason}</p>
              <p><strong>Reported Details:</strong> {selectedReport.details || "None provided"}</p>
            </div>

            <form onSubmit={handleSubmitReportAction} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Resolution Decision
                </label>
                <select
                  value={reportStatusAction}
                  onChange={e => setReportStatusAction(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="ACTION_TAKEN">Action Taken (Violator Penalized / Warned)</option>
                  <option value="DISMISSED">Dismissed (No Violation Found)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Resolution Notes
                </label>
                <textarea
                  rows={3}
                  value={reportResolutionNotes}
                  onChange={e => setReportResolutionNotes(e.target.value)}
                  placeholder="Describe resolution taken or reason for dismissal..."
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-50"
                >
                  {submittingAction ? "Saving..." : "Save Resolution"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Privacy Note */}
      <p className="text-xs text-gray-400 text-center">
        <FiAlertTriangle className="inline mr-1" />
        Actual message content is not stored in plaintext logs. Only violation and report metadata is retained for compliance audits.
      </p>
    </div>
  );
}

// ── Helper Components ─────────────────────────────────────────

function StatCard({ label, value, color, bg }) {
  return (
    <div className={`${bg} rounded-xl p-4`}>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function FilterSelect({ id, label, value, onChange, options }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-gray-500 mb-1">{label}</label>
      <select
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
      >
        <option value="">All</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
