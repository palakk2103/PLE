import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FiSend, FiClock, FiCheckCircle, FiXCircle, FiSlash } from "react-icons/fi";
import api from "../../../../shared/utils/api";

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const fmt = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");

const STATUS = {
  pending: { label: "Pending", cls: "bg-amber-50 text-amber-700 border-amber-200", Icon: FiClock },
  approved: { label: "Approved", cls: "bg-green-50 text-green-700 border-green-200", Icon: FiCheckCircle },
  rejected: { label: "Rejected", cls: "bg-red-50 text-red-700 border-red-200", Icon: FiXCircle },
  cancelled: { label: "Cancelled", cls: "bg-gray-50 text-gray-600 border-gray-200", Icon: FiSlash },
};

/**
 * B2B employee: ask the company admin for wallet funds and track the requests.
 * onBalance(balance) lets the wallet card show the live balance after an approval.
 */
const EmployeeWalletRequests = ({ onBalance }) => {
  const [data, setData] = useState(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/b2b-user/employee/wallet-requests");
      const d = res?.data ?? res;
      setData(d);
      if (typeof d?.walletBalance === "number") onBalance?.(d.walletBalance);
    } catch {
      setData({ requests: [] });
    }
  }, [onBalance]);

  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const n = Number(amount);
    if (!(n > 0)) return toast.error("Enter an amount.");
    if (reason.trim().length < 5) return toast.error("Tell your admin what the money is for (at least 5 characters).");
    setBusy(true);
    try {
      await api.post("/b2b-user/employee/wallet-requests", { amount: n, reason: reason.trim() });
      toast.success("Request sent to your company admin.");
      setAmount("");
      setReason("");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Could not send the request.");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id) => {
    try {
      await api.post(`/b2b-user/employee/wallet-requests/${id}/cancel`);
      toast.success("Request cancelled.");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not cancel.");
      load();
    }
  };

  const requests = data?.requests || [];
  const atLimit = (data?.pendingCount || 0) >= (data?.maxPending || 3);

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 space-y-4" data-testid="employee-wallet-requests">
      <div>
        <h3 className="font-semibold text-slate-800">Request funds</h3>
        <p className="text-xs text-slate-500">Your company admin will approve or reject this. You'll get a notification either way.</p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div className="flex gap-3">
          <div className="relative w-40 shrink-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
            <input
              type="number" min={1} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount" className="w-full pl-7 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
              data-testid="request-amount"
            />
          </div>
          <input
            type="text" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="What is it for? e.g. Printer toner for the Pune office"
            className="flex-1 min-w-0 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
            data-testid="request-reason"
          />
        </div>
        <button
          type="submit" disabled={busy || atLimit}
          className="w-full flex items-center justify-center gap-2 bg-[#7B0A0A] text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50"
          data-testid="request-submit"
        >
          <FiSend /> {busy ? "Sending…" : atLimit ? `You have ${data?.pendingCount} pending requests` : "Send request"}
        </button>
      </form>

      {requests.length > 0 && (
        <div className="divide-y divide-slate-100 border-t border-slate-100" data-testid="request-history">
          {requests.slice(0, 10).map((r) => {
            const s = STATUS[r.status] || STATUS.pending;
            return (
              <div key={r.id} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">
                    {inr(r.amount)}
                    {r.status === "approved" && r.approvedAmount !== r.amount && (
                      <span className="ml-1 text-xs font-medium text-green-700">· {inr(r.approvedAmount)} approved</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 break-words">{r.reason}</p>
                  {r.decisionNote && <p className="text-xs text-slate-600 mt-0.5">Admin: {r.decisionNote}</p>}
                  <p className="text-[11px] text-slate-400 mt-0.5">{r.requestNumber} · {fmt(r.createdAt)}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-semibold ${s.cls}`}>
                    <s.Icon className="w-3 h-3" /> {s.label}
                  </span>
                  {r.status === "pending" && (
                    <button onClick={() => cancel(r.id)} className="text-xs text-slate-500 hover:text-red-600 underline">Cancel</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EmployeeWalletRequests;
