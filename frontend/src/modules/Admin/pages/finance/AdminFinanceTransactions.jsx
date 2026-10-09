import { useState, useEffect, useCallback } from "react";
import { FiFileText, FiRefreshCw, FiDollarSign } from "react-icons/fi";
import { motion } from "framer-motion";
import Badge from "../../../../shared/components/Badge";
import ExportButton from "../../components/ExportButton";
import AnimatedSelect from "../../components/AnimatedSelect";
import { formatPrice } from "../../../../shared/utils/helpers";
import { getAdminFinanceTransactions } from "../../services/adminService";
import toast from "react-hot-toast";

const AdminFinanceTransactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getAdminFinanceTransactions({
        type: typeFilter !== "all" ? typeFilter : undefined,
        limit: 50,
      });
      const data = res?.data ?? res;
      setTransactions(data?.transactions ?? []);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to fetch transactions");
    } finally {
      setIsLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Financial Ledger Transactions
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Audit trail of all seller wallet balance movements (Credits, Deductions, Clearances, Payouts)
          </p>
        </div>

        <button
          onClick={fetchTransactions}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <FiRefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AnimatedSelect
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={[
              { value: "all", label: "All Ledger Event Types" },
              { value: "EARNING_ON_HOLD", label: "Earning Placed On Hold" },
              { value: "EARNING_CLEARED", label: "Earning Cleared (Available)" },
              { value: "WITHDRAWAL_REQUEST", label: "Withdrawal Reserved" },
              { value: "WITHDRAWAL_PAID", label: "Withdrawal Paid Out" },
              { value: "WITHDRAWAL_REJECTED", label: "Withdrawal Rejected" },
              { value: "RETURN_DEDUCTION", label: "Return / Refund Deduction" },
            ]}
            className="min-w-[200px]"
          />
        </div>

        <ExportButton
          data={transactions}
          headers={[
            { label: "Date", accessor: (r) => new Date(r.createdAt).toLocaleString() },
            { label: "Vendor", accessor: (r) => r.vendorId?.storeName || r.vendorId?.email },
            { label: "Type", accessor: (r) => r.type },
            { label: "Amount", accessor: (r) => r.amount },
            { label: "Description", accessor: (r) => r.description },
          ]}
          filename="finance-ledger-transactions"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
        {isLoading && transactions.length === 0 ? (
          <div className="p-12 text-center text-xs text-gray-500">
            <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading ledger transactions...
          </div>
        ) : transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 font-semibold">
                <tr>
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5">Vendor / Store</th>
                  <th className="p-3.5">Event Type</th>
                  <th className="p-3.5">Amount</th>
                  <th className="p-3.5">Description</th>
                  <th className="p-3.5">Reference</th>
                  <th className="p-3.5">Balance Snapshot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-gray-800 dark:text-gray-200">
                {transactions.map((tx) => {
                  const isCredit =
                    tx.type === "EARNING_CLEARED" || tx.type === "WITHDRAWAL_REJECTED";
                  const isHold = tx.type === "EARNING_ON_HOLD";
                  return (
                    <tr key={tx._id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                      <td className="p-3.5 text-gray-500 whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleString()}
                      </td>
                      <td className="p-3.5">
                        <span className="font-semibold text-gray-900 dark:text-white block">
                          {tx.vendorId?.storeName || "Vendor"}
                        </span>
                        <span className="text-[11px] text-gray-400">{tx.vendorId?.email}</span>
                      </td>
                      <td className="p-3.5">
                        <Badge
                          variant={
                            tx.type.includes("PAID")
                              ? "success"
                              : tx.type.includes("CLEARED")
                              ? "info"
                              : tx.type.includes("REJECTED") || tx.type.includes("DEDUCTION")
                              ? "error"
                              : "warning"
                          }
                        >
                          {tx.type.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="p-3.5 font-bold whitespace-nowrap">
                        <span
                          className={
                            isCredit
                              ? "text-emerald-600 dark:text-emerald-400"
                              : isHold
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-gray-900 dark:text-white"
                          }
                        >
                          {isCredit ? "+" : isHold ? "•" : "-"}{formatPrice(tx.amount)}
                        </span>
                      </td>
                      <td className="p-3.5 max-w-[280px] text-gray-700 dark:text-gray-300">
                        {tx.description}
                      </td>
                      <td className="p-3.5 font-mono text-[11px] text-purple-600 dark:text-purple-400">
                        {tx.referenceNumber || (tx.referenceId ? String(tx.referenceId).slice(-6) : "—")}
                      </td>
                      <td className="p-3.5 text-[11px] text-gray-500 whitespace-nowrap">
                        Avail: {formatPrice(tx.balanceSnapshot?.available || 0)} | Hold: {formatPrice(tx.balanceSnapshot?.onHold || 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-gray-500">
            <FiFileText className="text-3xl text-gray-400 mx-auto mb-2" />
            <p className="font-semibold text-gray-700 dark:text-gray-300">No ledger transactions found</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default AdminFinanceTransactions;
