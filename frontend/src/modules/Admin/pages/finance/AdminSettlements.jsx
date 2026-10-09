import { useState, useEffect, useCallback } from "react";
import { FiCheckCircle, FiSearch, FiRefreshCw, FiDollarSign } from "react-icons/fi";
import { motion } from "framer-motion";
import Badge from "../../../../shared/components/Badge";
import ExportButton from "../../components/ExportButton";
import AnimatedSelect from "../../components/AnimatedSelect";
import { formatPrice } from "../../../../shared/utils/helpers";
import { getAdminSettlements } from "../../services/adminService";
import toast from "react-hot-toast";

const AdminSettlements = () => {
  const [settlements, setSettlements] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("all");

  const fetchSettlements = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getAdminSettlements({
        search: searchTerm.trim() || undefined,
        paymentMethod: paymentMethod !== "all" ? paymentMethod : undefined,
      });
      const data = res?.data ?? res;
      setSettlements(data?.settlements ?? []);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to fetch settlements");
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, paymentMethod]);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Settlement History
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Record of settled seller payouts, transaction reference numbers (UTR), and disbursement dates
          </p>
        </div>

        <button
          onClick={fetchSettlements}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <FiRefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by UTR or Reference..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-600/30"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <AnimatedSelect
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            options={[
              { value: "all", label: "All Methods" },
              { value: "neft", label: "NEFT" },
              { value: "imps", label: "IMPS" },
              { value: "rtgs", label: "RTGS" },
              { value: "upi", label: "UPI" },
              { value: "bank_transfer", label: "Bank Transfer" },
            ]}
            className="min-w-[130px]"
          />

          <ExportButton
            data={settlements}
            headers={[
              { label: "Settlement ID", accessor: (r) => r._id },
              { label: "Vendor", accessor: (r) => r.vendorId?.storeName || r.vendorId?.email },
              { label: "Amount", accessor: (r) => r.amount },
              { label: "UTR", accessor: (r) => r.utr || r.transactionId },
              { label: "Method", accessor: (r) => r.paymentMethod },
              { label: "Date Paid", accessor: (r) => new Date(r.paidAt || r.createdAt).toLocaleString() },
            ]}
            filename="settlement-history"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
        {isLoading && settlements.length === 0 ? (
          <div className="p-12 text-center text-xs text-gray-500">
            <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading settlements...
          </div>
        ) : settlements.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 font-semibold">
                <tr>
                  <th className="p-3.5">Settlement ID</th>
                  <th className="p-3.5">Vendor / Store</th>
                  <th className="p-3.5">Net Paid Amount</th>
                  <th className="p-3.5">Payment Method</th>
                  <th className="p-3.5">Bank UTR / Reference</th>
                  <th className="p-3.5">Disbursed Date</th>
                  <th className="p-3.5">Processed By</th>
                  <th className="p-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-gray-800 dark:text-gray-200">
                {settlements.map((s) => (
                  <tr key={s._id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                    <td className="p-3.5 font-mono text-purple-600 dark:text-purple-400 font-bold">
                      {String(s._id).slice(-8)}
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {s.vendorId?.storeName || "Vendor"}
                      </div>
                      <div className="text-[11px] text-gray-400">{s.vendorId?.email}</div>
                    </td>
                    <td className="p-3.5 font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      {formatPrice(s.amount)}
                    </td>
                    <td className="p-3.5 uppercase font-medium text-gray-700 dark:text-gray-300">
                      {s.paymentMethod?.replace(/_/g, " ")}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-gray-900 dark:text-white">
                      {s.utr || s.transactionId || "—"}
                    </td>
                    <td className="p-3.5 text-gray-500 whitespace-nowrap">
                      {new Date(s.paidAt || s.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3.5 text-gray-500">
                      {s.adminId?.name || s.adminId?.email || "Admin"}
                    </td>
                    <td className="p-3.5">
                      <Badge variant={s.status === "failed" ? "error" : "success"}>
                        {String(s.status || "completed").toUpperCase()}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-gray-500">
            <FiCheckCircle className="text-3xl text-gray-400 mx-auto mb-2" />
            <p className="font-semibold text-gray-700 dark:text-gray-300">No settlement records found</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default AdminSettlements;
