import React, { useEffect, useState } from "react";
import EmployeeWalletRequests from "../components/B2B/EmployeeWalletRequests";
import {
  FiDollarSign,
  FiTrendingUp,
  FiTrendingDown,
  FiPlusCircle,
  FiDownload,
  FiFilter,
  FiCheckCircle,
  FiXCircle,
  FiInfo,
  FiArrowLeft,
  FiActivity,
  FiBriefcase
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useWalletStore } from "../../../shared/store/walletStore";
import { useAuthStore } from "../../../shared/store/authStore";
import MobileLayout from "../components/Layout/MobileLayout";
import PageTransition from "../../../shared/components/PageTransition";

const Wallet = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    balance,
    totalCredit,
    totalDebit,
    isFrozen,
    transactions,
    settings,
    pagination,
    isLoading,
    fetchWallet,
    fetchTransactions,
    fetchWalletSettings,
    rechargeWallet,
    verifyRechargePayment
  } = useWalletStore();

  const [rechargeAmount, setRechargeAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const isB2B = user?.role === 'b2bAdmin' || user?.role === 'b2bEmployee';
  const isEmployee = user?.role === 'b2bEmployee';
  const [liveEmployeeBalance, setLiveEmployeeBalance] = useState(null);

  useEffect(() => {
    fetchWallet();
    fetchWalletSettings();
    fetchTransactions(1, 10, "all");
  }, []);

  const handleCategoryChange = (e) => {
    const cat = e.target.value;
    setSelectedCategory(cat);
    setCurrentPage(1);
    fetchTransactions(1, 10, cat);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    fetchTransactions(page, 10, selectedCategory);
  };

  const handleRecharge = async (e) => {
    e.preventDefault();
    const amount = parseFloat(rechargeAmount);

    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid positive amount");
      return;
    }

    if (amount < settings.minRecharge) {
      toast.error(`Minimum recharge amount is ₹${settings.minRecharge}`);
      return;
    }
    if (amount > settings.maxRecharge) {
      toast.error(`Maximum recharge amount is ₹${settings.maxRecharge}`);
      return;
    }

    setIsProcessingPayment(true);

    const res = await rechargeWallet(amount);
    if (!res.success) {
      toast.error(res.error?.message || "Failed to create recharge order.");
      setIsProcessingPayment(false);
      return;
    }

    const { id: orderId, amount: rzpAmount, key } = res.data;

    // Load Razorpay Script
    const loadRazorpayScript = () => {
      return new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
      });
    };

    const isLoaded = await loadRazorpayScript();
    if (!isLoaded) {
      toast.error("Failed to load payment gateway SDK.");
      setIsProcessingPayment(false);
      return;
    }

    const options = {
      key: key || (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_RAZORPAY_KEY_ID : null) || process.env.REACT_APP_RAZORPAY_KEY_ID,
      amount: rzpAmount,
      currency: "INR",
      name: "Peoples League Of Electronics",
      description: "B2B Wallet Recharge",
      order_id: orderId,
      handler: async (response) => {
        toast.loading("Verifying transaction...");
        const verifyRes = await verifyRechargePayment({
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature,
          amount
        });
        toast.dismiss();

        if (verifyRes.success) {
          toast.success("Wallet recharged successfully!");
          setShowRechargeModal(false);
          setRechargeAmount("");
          fetchTransactions(1, 10, selectedCategory);
        } else {
          toast.error(verifyRes.error || "Payment verification failed.");
        }
        setIsProcessingPayment(false);
      },
      prefill: {
        name: user?.name || "",
        email: user?.email || "",
        contact: user?.phone || ""
      },
      theme: {
        color: "#7B0A0A"
      },
      modal: {
        ondismiss: () => {
          setIsProcessingPayment(false);
          toast.error("Recharge payment cancelled.");
        }
      }
    };

    const paymentObject = new window.Razorpay(options);
    paymentObject.open();
  };

  const handleDownloadStatement = () => {
    if (!transactions || transactions.length === 0) {
      toast.error("No transactions to export.");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Transaction ID,Date,Type,Category,Amount,Balance After,Description\n";

    transactions.forEach((tx) => {
      const date = new Date(tx.createdAt).toLocaleDateString();
      csvContent += `"${tx._id}","${date}","${tx.type}","${tx.transactionCategory}",${tx.amount},${tx.balanceAfterTransaction},"${tx.description}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `wallet_statement_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Statement downloaded successfully!");
  };

  return (
    <PageTransition>
      <MobileLayout>
        <div className="min-h-screen bg-slate-50 pb-20">
          {/* Header */}
          <div className="bg-white border-b border-slate-100 sticky top-0 z-30 px-4 py-4 flex items-center gap-3">
            <button
              onClick={() => {
                if (window.history.state && window.history.state.idx > 0) {
                  navigate(-1);
                } else {
                  navigate("/profile");
                }
              }}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            >
              <FiArrowLeft className="w-5 h-5 text-slate-700" />
            </button>
            <h1 className="font-semibold text-lg text-slate-800">Business Wallet</h1>
          </div>

          <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
            {/* Wallet Info Card */}
            <div className="relative overflow-hidden bg-gradient-to-tr from-[#7B0A0A] to-[#4A0404] rounded-3xl p-6 text-white shadow-xl shadow-[#7B0A0A]/10">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-red-100 font-medium tracking-wider uppercase mb-1">
                    {isEmployee ? "Employee Allotted Balance" : "Company Wallet Balance"}
                  </p>
                  <h2 className="text-4xl font-extrabold tracking-tight">
                    ₹{(isEmployee ? (liveEmployeeBalance ?? user?.b2bWalletBalance ?? 0) : balance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </h2>
                </div>
                <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md">
                  <FiBriefcase className="w-6 h-6" />
                </div>
              </div>

              {isFrozen && (
                <div className="mt-4 flex items-center gap-2 bg-red-500/30 text-red-100 border border-red-500/20 px-3 py-2 rounded-xl text-xs backdrop-blur-sm">
                  <FiInfo className="w-4 h-4 shrink-0" />
                  <span>Wallet is frozen. Recharge and deductions are disabled.</span>
                </div>
              )}

              {/* Action buttons */}
              {!isEmployee && !isFrozen && (
                <div className="mt-6">
                  <button
                    onClick={() => setShowRechargeModal(true)}
                    className="w-full flex items-center justify-center gap-2 bg-white text-[#7B0A0A] font-semibold py-3.5 px-4 rounded-2xl hover:bg-red-50 transition-colors shadow-lg shadow-black/5"
                  >
                    <FiPlusCircle className="w-5 h-5" />
                    <span>Add Money</span>
                  </button>
                </div>
              )}

              {isEmployee && (
                <div className="mt-4 text-red-100/90 border-t border-white/10 pt-3 flex justify-between">
                  <span>Monthly Limit: {Number(user?.b2bSpendingLimit) > 0 ? `₹${Number(user.b2bSpendingLimit).toLocaleString("en-IN")}` : "Unlimited"}</span>
                  <span>Need more? Request funds below.</span>
                </div>
              )}
            </div>

            {isEmployee && <EmployeeWalletRequests onBalance={setLiveEmployeeBalance} />}

            {/* Quick stats row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center gap-3">
                <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl">
                  <FiTrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-slate-400 text-xs font-medium">Total Received</p>
                  <p className="font-semibold text-slate-800 text-sm">₹{totalCredit.toLocaleString("en-IN")}</p>
                </div>
              </div>

              <div className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center gap-3">
                <div className="bg-rose-50 text-rose-600 p-2.5 rounded-xl">
                  <FiTrendingDown className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-slate-400 text-xs font-medium">Total Spent</p>
                  <p className="font-semibold text-slate-800 text-sm">₹{totalDebit.toLocaleString("en-IN")}</p>
                </div>
              </div>
            </div>

            {/* Transactions Header */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <FiActivity className="text-slate-400" />
                  <span>Transactions</span>
                </h3>
                <button
                  onClick={handleDownloadStatement}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#7B0A0A] hover:text-[#9E1212] bg-red-50/50 hover:bg-red-50 px-3 py-2 rounded-xl transition-colors"
                >
                  <FiDownload className="w-3.5 h-3.5" />
                  <span>Statement</span>
                </button>
              </div>

              {/* Filters */}
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <select
                    value={selectedCategory}
                    onChange={handleCategoryChange}
                    className="w-full bg-white border border-slate-100 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#7B0A0A] appearance-none"
                  >
                    <option value="all">All Transactions</option>
                    <option value="recharge">Recharges</option>
                    <option value="order_payment">Order Payments</option>
                    <option value="refund">Refunds</option>
                    <option value="cashback">Cashback</option>
                    <option value="admin_credit">Admin Adjustment Credits</option>
                    <option value="admin_debit">Admin Adjustment Debits</option>
                  </select>
                </div>
              </div>

              {/* Transaction List */}
              <div className="space-y-3">
                {isLoading && (
                  <div className="space-y-3">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="bg-white border border-slate-100 rounded-2xl p-4 animate-pulse flex justify-between">
                        <div className="flex gap-3">
                          <div className="w-10 h-10 bg-slate-200 rounded-xl" />
                          <div className="space-y-2">
                            <div className="h-4 bg-slate-200 rounded w-28" />
                            <div className="h-3 bg-slate-200 rounded w-16" />
                          </div>
                        </div>
                        <div className="h-5 bg-slate-200 rounded w-12 self-center" />
                      </div>
                    ))}
                  </div>
                )}

                {!isLoading && (!transactions || transactions.length === 0) && (
                  <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center space-y-2">
                    <p className="text-slate-400 text-sm">No transaction records found.</p>
                  </div>
                )}

                {!isLoading && transactions && transactions.length > 0 && (
                  <div className="space-y-3">
                    {transactions.map((tx) => {
                      const isCredit = tx.type === "credit";
                      return (
                        <div key={tx._id} className="bg-white border border-slate-100 rounded-2xl p-4 flex justify-between items-center hover:border-slate-200 transition-all">
                          <div className="flex gap-3 items-center">
                            <div className={`p-2.5 rounded-xl ${isCredit ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-600"}`}>
                              {isCredit ? <FiTrendingUp className="w-5 h-5" /> : <FiTrendingDown className="w-5 h-5" />}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800 text-sm">{tx.description || "Wallet Transaction"}</p>
                              <p className="text-slate-400 text-xs">
                                {new Date(tx.createdAt).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric"
                                })}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold text-sm ${isCredit ? "text-emerald-600" : "text-slate-800"}`}>
                              {isCredit ? "+" : "-"} ₹{tx.amount.toFixed(2)}
                            </p>
                            <p className="text-slate-400 text-[10px]">Bal: ₹{tx.balanceAfterTransaction.toFixed(2)}</p>
                          </div>
                        </div>
                      );
                    })}

                    {/* Pagination */}
                    {pagination && pagination.pages > 1 && (
                      <div className="flex justify-between items-center pt-2">
                        <button
                          disabled={currentPage === 1}
                          onClick={() => handlePageChange(currentPage - 1)}
                          className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-100 rounded-xl hover:bg-slate-50 disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <span className="text-xs text-slate-400">
                          Page {currentPage} of {pagination.pages}
                        </span>
                        <button
                          disabled={currentPage === pagination.pages}
                          onClick={() => handlePageChange(currentPage + 1)}
                          className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-100 rounded-xl hover:bg-slate-50 disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Recharge Modal */}
        <AnimatePresence>
          {showRechargeModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-md bg-white rounded-3xl p-6 space-y-6 shadow-xl"
              >
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-lg text-slate-800">Add Money to Wallet</h3>
                  <button onClick={() => setShowRechargeModal(false)} className="p-1 hover:bg-slate-100 rounded-full">
                    <FiXCircle className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <form onSubmit={handleRecharge} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Amount (₹)</label>
                    <input
                      type="number"
                      placeholder={`Enter amount (Min ₹${settings.minRecharge})`}
                      value={rechargeAmount}
                      onChange={(e) => setRechargeAmount(e.target.value)}
                      disabled={isProcessingPayment}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-[#7B0A0A]"
                    />
                  </div>

                  {/* Predefined packs */}
                  <div className="grid grid-cols-3 gap-2">
                    {[500, 1000, 5000, 10000, 25000, 50000].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setRechargeAmount(String(val))}
                        disabled={isProcessingPayment}
                        className="border border-slate-100 bg-white hover:bg-red-50 hover:border-red-200 text-slate-600 hover:text-[#7B0A0A] font-semibold py-2 rounded-xl text-xs transition-colors"
                      >
                        + ₹{val.toLocaleString()}
                      </button>
                    ))}
                  </div>

                  {settings.cashbackPercent > 0 && (
                    <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-2.5 rounded-xl text-xs font-medium">
                      <FiInfo className="w-4 h-4 shrink-0" />
                      <span>Enjoy {settings.cashbackPercent}% instant cashback credited on all recharges!</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isProcessingPayment}
                    className="w-full flex items-center justify-center gap-2 bg-[#7B0A0A] hover:bg-[#9E1212] text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-[#7B0A0A]/20 disabled:opacity-50 transition-colors"
                  >
                    {isProcessingPayment ? "Processing..." : "Proceed to Payment"}
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </MobileLayout>
    </PageTransition>
  );
};

export default Wallet;
