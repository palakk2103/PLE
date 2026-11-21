import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiCreditCard, FiMapPin, FiLock } from "react-icons/fi";
import toast from "react-hot-toast";
import api from "../../../shared/utils/api";

const loadRazorpayScript = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/**
 * Accept a Source Now "Final Proposal" and pay online (Razorpay).
 * The order is created (stock reserved, GST added) when the buyer clicks Accept & Pay;
 * the request is confirmed only after the payment is verified.
 * If an order already exists but is unpaid, offers "Complete Payment" for it.
 */
const SourceNowPayment = ({ request, onChanged }) => {
  const [addresses, setAddresses] = useState([]);
  const [addressId, setAddressId] = useState("");
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pendingOrder, setPendingOrder] = useState(null);

  const existingOrder = pendingOrder || request?.associatedOrder || null;
  const awaitingPayment = !!existingOrder && existingOrder.paymentStatus !== "paid";

  const itemsValue = useMemo(() => {
    const f = request?.selectedFulfillment || {};
    const ple = Number(f.pleQuantity || 0) * Number(f.finalPrice || 0);
    const vend = (f.vendors || []).reduce((s, v) => s + Number(v.quantity || 0) * Number(v.price || f.finalPrice || 0), 0);
    return Math.round((ple + vend) * 100) / 100;
  }, [request]);

  useEffect(() => {
    if (awaitingPayment) {
      setLoadingAddresses(false);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = await api.get("/user/addresses");
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        if (!alive) return;
        setAddresses(list);
        const def = list.find((a) => a.isDefault) || list[0];
        if (def) setAddressId(String(def._id || def.id));
      } catch {
        if (alive) setAddresses([]);
      } finally {
        if (alive) setLoadingAddresses(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [awaitingPayment]);

  const openCheckout = async ({ order, razorpayOrder }) => {
    const ok = await loadRazorpayScript();
    if (!ok) {
      toast.error("Could not load the payment window. Check your internet connection and try again.");
      onChanged?.();
      return;
    }
    const rzp = new window.Razorpay({
      key: razorpayOrder.key,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency || "INR",
      order_id: razorpayOrder.id,
      name: "PLE Marketplace",
      description: `Source Now ${request.requestId} · Order ${order.orderId}`,
      prefill: {
        name: order.shippingAddress?.name,
        email: order.shippingAddress?.email,
        contact: order.shippingAddress?.phone,
      },
      theme: { color: "#7B0A0A" },
      handler: async (resp) => {
        const t = toast.loading("Verifying payment...");
        try {
          await api.post("/user/payments/verify", {
            razorpay_payment_id: resp.razorpay_payment_id,
            razorpay_order_id: resp.razorpay_order_id,
            razorpay_signature: resp.razorpay_signature,
            orderId: order.orderId,
          });
          toast.success("Payment successful! Your order is confirmed.", { id: t });
        } catch (err) {
          toast.error(err?.response?.data?.message || err?.message || "Payment verification failed. If money was deducted, contact support.", { id: t });
        } finally {
          onChanged?.();
        }
      },
      modal: {
        ondismiss: () => {
          toast("Payment not completed. You can complete it from this page anytime.");
          onChanged?.();
        },
      },
    });
    rzp.open();
  };

  const startPayment = async () => {
    if (busy) return;
    if (!awaitingPayment && !addressId) {
      toast.error("Please choose a delivery address.");
      return;
    }
    setBusy(true);
    try {
      const res = await api.post(
        `/user/product-requests/${request.requestId}/confirm`,
        awaitingPayment ? {} : { addressId }
      );
      const payload = res?.data || res;
      if (!payload?.razorpayOrder?.id) throw new Error("Could not start payment.");
      setPendingOrder({ ...payload.order, paymentStatus: "pending" });
      await openCheckout(payload);
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Could not start payment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3" data-testid="source-now-payment">
      {awaitingPayment ? (
        <div className="bg-black/20 rounded-2xl p-4 text-sm space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-200">Payment pending · Order {existingOrder.orderId}</p>
          <div className="flex justify-between"><span className="text-indigo-200">Items</span><span>{inr(existingOrder.subtotal)}</span></div>
          {existingOrder.taxBreakdown && (existingOrder.taxBreakdown.cgst > 0 || existingOrder.taxBreakdown.sgst > 0) && (
            <div className="flex justify-between text-xs"><span className="text-indigo-200">CGST + SGST</span><span>{inr(existingOrder.taxBreakdown.cgst)} + {inr(existingOrder.taxBreakdown.sgst)}</span></div>
          )}
          {existingOrder.taxBreakdown?.igst > 0 && (
            <div className="flex justify-between text-xs"><span className="text-indigo-200">IGST</span><span>{inr(existingOrder.taxBreakdown.igst)}</span></div>
          )}
          <div className="flex justify-between"><span className="text-indigo-200">GST</span><span>{inr(existingOrder.tax)}</span></div>
          <div className="flex justify-between font-extrabold text-base border-t border-white/10 pt-1.5"><span>Total</span><span data-testid="source-now-total">{inr(existingOrder.total)}</span></div>
        </div>
      ) : (
        <>
          <div className="bg-black/20 rounded-2xl p-4 text-sm flex justify-between">
            <span className="text-indigo-200">Items value</span>
            <span className="font-bold">{inr(itemsValue)} <span className="text-xs font-normal text-indigo-200">+ GST</span></span>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-indigo-100 flex items-center gap-1.5"><FiMapPin /> Deliver to</label>
            {loadingAddresses ? (
              <p className="text-xs text-indigo-200">Loading addresses…</p>
            ) : addresses.length ? (
              <select
                value={addressId}
                onChange={(e) => setAddressId(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-white"
                data-testid="source-now-address"
              >
                {addresses.map((a) => (
                  <option key={a._id || a.id} value={a._id || a.id}>
                    {(a.name || a.fullName || "Address")} — {a.address}, {a.city}, {a.state} {a.zipCode}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-amber-200">
                No saved address.{" "}
                <Link to="/addresses" className="underline font-bold text-white">Add a delivery address</Link> to continue.
              </p>
            )}
            <p className="text-[11px] text-indigo-200">GST (CGST+SGST or IGST) is added based on this address. The exact total is shown before you pay.</p>
          </div>
        </>
      )}
      <button
        onClick={startPayment}
        disabled={busy || (!awaitingPayment && !addressId)}
        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-extrabold rounded-2xl text-sm transition-all shadow flex items-center justify-center gap-2"
        data-testid="source-now-pay"
      >
        <FiCreditCard />
        {busy ? "Starting secure payment…" : awaitingPayment ? `Complete Payment · ${inr(existingOrder.total)}` : "Accept Proposal & Pay Online"}
      </button>
      <p className="text-[11px] text-indigo-200 flex items-center justify-center gap-1"><FiLock /> Secured by Razorpay · Order is confirmed after payment</p>
    </div>
  );
};

export default SourceNowPayment;
