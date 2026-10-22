import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiX,
  FiDollarSign,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiSend,
  FiLock,
  FiAlertCircle,
  FiInfo,
} from "react-icons/fi";
import toast from "react-hot-toast";
import api from "../../../shared/utils/api";
import Badge from "../../../shared/components/Badge";
import { formatPrice } from "../../../shared/utils/helpers";

const VendorNegotiationModal = ({ isOpen, onClose, productId, productName, onNegotiationUpdated }) => {
  const [negotiation, setNegotiation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [counterPrice, setCounterPrice] = useState("");
  const [counterNotes, setCounterNotes] = useState("");
  const [showCounterForm, setShowCounterForm] = useState(false);

  useEffect(() => {
    if (isOpen && productId) {
      fetchNegotiation();
    } else {
      setNegotiation(null);
      setShowCounterForm(false);
      setCounterPrice("");
      setCounterNotes("");
    }
  }, [isOpen, productId]);

  const fetchNegotiation = async () => {
    try {
      setIsLoading(true);
      const res = await api.get(`/vendor/products/${productId}/negotiation`);
      setNegotiation(res.data?.data || res.data || null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load negotiation details");
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!window.confirm(`Are you sure you want to accept the Admin supply price of ${formatPrice(negotiation?.currentOffer?.price)}? This will lock the commercial supply price.`)) {
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.post(`/vendor/products/${productId}/negotiation/accept`);
      toast.success("Offer accepted! Commercial supply price is now locked.");
      setNegotiation(res.data?.data || res.data || null);
      if (onNegotiationUpdated) onNegotiationUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to accept offer");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    const reason = window.prompt("Reason for rejecting this offer (optional):");
    if (reason === null) return; // User cancelled prompt

    try {
      setIsSubmitting(true);
      const res = await api.post(`/vendor/products/${productId}/negotiation/reject`, {
        notes: reason,
      });
      toast.success("Offer rejected.");
      setNegotiation(res.data?.data || res.data || null);
      if (onNegotiationUpdated) onNegotiationUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reject offer");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCounterOffer = async (e) => {
    e.preventDefault();
    const numPrice = Number(counterPrice);
    if (!numPrice || numPrice <= 0) {
      toast.error("Please enter a valid supply price greater than 0");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.post(`/vendor/products/${productId}/negotiation/counter-offer`, {
        price: numPrice,
        notes: counterNotes,
      });
      toast.success("Counter-offer submitted to Admin.");
      setNegotiation(res.data?.data || res.data || null);
      setShowCounterForm(false);
      setCounterPrice("");
      setCounterNotes("");
      if (onNegotiationUpdated) onNegotiationUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit counter-offer");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const currentOffer = negotiation?.currentOffer;
  const isLocked = negotiation?.isLocked;
  const canRespondToAdmin =
    !isLocked &&
    currentOffer &&
    currentOffer.status === "pending" &&
    currentOffer.offeredByRole === "admin";
  const isAwaitingAdmin =
    !isLocked &&
    currentOffer &&
    currentOffer.status === "pending" &&
    currentOffer.offeredByRole === "managed_vendor";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#C07A3D]/10 text-[#C07A3D] flex items-center justify-center font-bold">
                <FiDollarSign className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 leading-tight">
                  Commercial Price Negotiation
                </h2>
                <p className="text-xs text-gray-500 truncate max-w-sm sm:max-w-md">
                  {productName || "Product"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center transition-colors"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {isLoading ? (
              <div className="py-16 text-center text-gray-400">
                <div className="w-8 h-8 border-2 border-[#C07A3D] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm">Loading negotiation terms...</p>
              </div>
            ) : (
              <>
                {/* Agreement Status Banner */}
                {isLocked ? (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                    <FiLock className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-bold text-emerald-900">
                        Commercial Supply Price Locked
                      </h4>
                      <p className="text-xs text-emerald-700 mt-0.5">
                        Agreed Contract Supply Price:{" "}
                        <strong className="text-emerald-900 text-sm">
                          {formatPrice(negotiation?.finalAgreedPrice)}
                        </strong>{" "}
                        (Agreed on {new Date(negotiation?.lockedAt).toLocaleDateString()})
                      </p>
                      <p className="text-[11px] text-emerald-600 mt-1">
                        This agreed price is contractually locked and will be used for all order fulfillment payouts.
                      </p>
                    </div>
                  </div>
                ) : negotiation?.status === "rejected" ? (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
                    <FiAlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-bold text-red-900">
                        Negotiation Rejected / Closed
                      </h4>
                      <p className="text-xs text-red-700 mt-0.5">
                        Commercial terms for this submission were not agreed upon.
                      </p>
                    </div>
                  </div>
                ) : canRespondToAdmin ? (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <FiClock className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="text-sm font-bold text-amber-900">
                          Admin Counter-Offer: {formatPrice(currentOffer?.price)}
                        </h4>
                        <p className="text-xs text-amber-800 mt-0.5">
                          Admin offered a supply price of {formatPrice(currentOffer?.price)}. You can accept this price, reject it, or submit a counter-offer.
                        </p>
                        {currentOffer?.notes && (
                          <p className="text-xs italic text-amber-700 mt-1">
                            Admin Note: &ldquo;{currentOffer.notes}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : isAwaitingAdmin ? (
                  <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-3">
                    <FiClock className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-bold text-blue-900">
                        Awaiting Admin Response
                      </h4>
                      <p className="text-xs text-blue-700 mt-0.5">
                        Your latest supply offer of{" "}
                        <strong>{formatPrice(currentOffer?.price)}</strong> is currently under review by Admin.
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* Offer Details Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider block">
                      Initial Requested Price
                    </span>
                    <span className="text-base font-bold text-gray-900 mt-0.5 block">
                      {formatPrice(negotiation?.initialSupplyPrice)}
                    </span>
                  </div>
                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider block">
                      Current Agreement State
                    </span>
                    <span className="mt-1 block">
                      <Badge
                        variant={
                          isLocked
                            ? "success"
                            : negotiation?.status === "rejected"
                            ? "error"
                            : "warning"
                        }
                      >
                        {isLocked
                          ? "AGREED & LOCKED"
                          : (negotiation?.status || "PENDING").replace("_", " ").toUpperCase()}
                      </Badge>
                    </span>
                  </div>
                </div>

                {/* Offer Timeline */}
                <div>
                  <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">
                    Negotiation History ({negotiation?.offers?.length || 0} Rounds)
                  </h4>
                  <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-gray-100">
                    {negotiation?.offers?.map((offer, idx) => {
                      const isVendor = offer.offeredByRole === "managed_vendor";
                      return (
                        <div key={offer._id || idx} className="relative flex items-start gap-3 pl-1">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold z-10 ${
                              offer.status === "accepted"
                                ? "bg-emerald-500 text-white"
                                : offer.status === "rejected"
                                ? "bg-red-500 text-white"
                                : isVendor
                                ? "bg-[#C07A3D] text-white"
                                : "bg-blue-600 text-white"
                            }`}
                          >
                            {offer.round}
                          </div>
                          <div className="flex-1 bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-xs">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-gray-800">
                                {isVendor ? "You (Vendor)" : "Admin"}
                              </span>
                              <span className="text-gray-400 text-[10px]">
                                {new Date(offer.offeredAt).toLocaleString()}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-bold text-gray-900">
                                Supply Price: {formatPrice(offer.price)}
                              </div>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  offer.status === "accepted"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : offer.status === "rejected"
                                    ? "bg-red-100 text-red-800"
                                    : offer.status === "superseded"
                                    ? "bg-gray-100 text-gray-600"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {offer.status.toUpperCase()}
                              </span>
                            </div>
                            {offer.notes && (
                              <p className="text-gray-500 mt-1 text-[11px] bg-gray-50 p-1.5 rounded">
                                &ldquo;{offer.notes}&rdquo;
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Counter-Offer Form (if toggled) */}
                {showCounterForm && !isLocked && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleCounterOffer}
                    className="p-4 bg-orange-50/60 rounded-xl border border-orange-200/80 space-y-3"
                  >
                    <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                      <FiSend className="text-[#C07A3D]" /> Submit Counter-Offer
                    </h4>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Proposed Supply Price (₹) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        required
                        value={counterPrice}
                        onChange={(e) => setCounterPrice(e.target.value)}
                        placeholder="e.g. 850"
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#C07A3D] focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Commercial Note / Justification (Optional)
                      </label>
                      <textarea
                        rows={2}
                        value={counterNotes}
                        onChange={(e) => setCounterNotes(e.target.value)}
                        placeholder="e.g. Raw material cost breakdown, bulk discount terms..."
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#C07A3D] focus:border-transparent outline-none resize-none"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowCounterForm(false)}
                        className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-4 py-1.5 text-xs font-semibold text-white bg-[#C07A3D] hover:bg-[#a9662e] rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {isSubmitting ? "Submitting..." : "Send Counter-Offer"}
                      </button>
                    </div>
                  </motion.form>
                )}
              </>
            )}
          </div>

          {/* Footer Action Buttons */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <div className="text-[11px] text-gray-400 flex items-center gap-1">
              <FiInfo className="w-3.5 h-3.5" />
              <span>Agreed supply price becomes your contracted fulfillment payout.</span>
            </div>

            <div className="flex items-center gap-2">
              {canRespondToAdmin && !showCounterForm && (
                <>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleReject}
                    className="px-3.5 py-2 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <FiXCircle /> Reject Offer
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      setCounterPrice(currentOffer?.price ? String(currentOffer.price) : "");
                      setShowCounterForm(true);
                    }}
                    className="px-3.5 py-2 text-xs font-medium text-gray-700 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <FiSend /> Counter-Offer
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleAccept}
                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <FiCheckCircle /> Accept Price ({formatPrice(currentOffer?.price)})
                  </button>
                </>
              )}
              {(!canRespondToAdmin || showCounterForm) && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default VendorNegotiationModal;
