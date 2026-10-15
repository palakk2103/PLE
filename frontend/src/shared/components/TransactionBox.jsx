import React, { useState } from "react";
import {
  FiFileText,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiShoppingBag,
  FiDollarSign,
  FiShield,
  FiPlus,
  FiChevronRight,
  FiAlertCircle,
  FiX,
  FiExternalLink,
  FiLock,
  FiTag,
  FiTruck,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

export const TransactionBox = ({
  proposal,
  isVendor = false,
  onPropose,
  onCancel,
  onAccept,
  onDecline,
  onCheckout,
  isSubmitting = false,
  onCloseMobile,
  className = "",
}) => {
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  // Proposal creation form state (for seller)
  const [formName, setFormName] = useState("");
  const [formVariant, setFormVariant] = useState("");
  const [formQty, setFormQty] = useState(1);
  const [formUnitPrice, setFormUnitPrice] = useState("");
  const [formDiscount, setFormDiscount] = useState("");
  const [formTax, setFormTax] = useState("");
  const [formDelivery, setFormDelivery] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const handleOpenPropose = () => {
    if (proposal) {
      setFormName(proposal.productName || "");
      setFormVariant(proposal.productVariant || "");
      setFormQty(proposal.quantity || 1);
      setFormUnitPrice(proposal.unitPrice || "");
      setFormDiscount(proposal.discount || "");
      setFormTax(proposal.tax || "");
      setFormDelivery(proposal.deliveryCharge || "");
      setFormNotes(proposal.notes || "");
    } else {
      setFormName("");
      setFormVariant("");
      setFormQty(1);
      setFormUnitPrice("");
      setFormDiscount("");
      setFormTax("");
      setFormDelivery("");
      setFormNotes("");
    }
    setShowProposeModal(true);
  };

  const handleProposeSubmit = (e) => {
    e.preventDefault();
    if (!formName.trim() || !formUnitPrice || Number(formUnitPrice) <= 0) return;

    if (onPropose) {
      onPropose({
        productName: formName.trim(),
        productVariant: formVariant.trim(),
        quantity: Math.max(1, parseInt(formQty, 10) || 1),
        unitPrice: Math.max(0, parseFloat(formUnitPrice) || 0),
        discount: Math.max(0, parseFloat(formDiscount) || 0),
        tax: Math.max(0, parseFloat(formTax) || 0),
        deliveryCharge: Math.max(0, parseFloat(formDelivery) || 0),
        notes: formNotes.trim(),
      });
    }
    setShowProposeModal(false);
  };

  const handleConfirmDecline = (e) => {
    e.preventDefault();
    if (onDecline) {
      onDecline(declineReason.trim() || "Declined by customer");
    }
    setShowDeclineModal(false);
    setDeclineReason("");
  };

  // Status mapping badge helper
  const getStatusBadge = (status) => {
    switch (status) {
      case "pending_customer_confirmation":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <FiClock className="text-xs" /> Awaiting Confirmation
          </span>
        );
      case "accepted":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <FiCheckCircle className="text-xs" /> Confirmed & Agreed
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <FiXCircle className="text-xs" /> Declined
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-500/15 text-zinc-400 border border-zinc-500/30">
            <FiXCircle className="text-xs" /> Cancelled
          </span>
        );
      case "superseded":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30">
            <FiTag className="text-xs" /> Revised (Superseded)
          </span>
        );
      case "converted_to_order":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <FiShoppingBag className="text-xs" /> Order Placed
          </span>
        );
      default:
        return null;
    }
  };

  const calculatedSubtotal = Math.round((Number(formQty || 1) * Number(formUnitPrice || 0)) * 100) / 100;
  const calculatedTotal =
    Math.round(
      (calculatedSubtotal - Number(formDiscount || 0) + Number(formTax || 0) + Number(formDelivery || 0)) * 100
    ) / 100;

  return (
    <div
      className={`flex flex-col bg-[#14161F] text-zinc-100 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden ${className}`}
    >
      {/* Transaction Box Header */}
      <div className="px-4 py-3 bg-[#1C1F2B] border-b border-zinc-800 flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-950/60 border border-red-800/40 flex items-center justify-center text-red-400">
            <FiShield className="text-sm" />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
              Transaction Box
            </h2>
            <p className="text-[10px] text-zinc-400">Official In-Chat Order Agreement</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
              title="Close Panel"
            >
              <FiX className="text-sm" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {proposal ? (
          <>
            {/* Proposal ID & Status */}
            <div className="bg-[#181B26] p-3 rounded-xl border border-zinc-800/80 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono text-zinc-400">
                  Ref: <strong className="text-zinc-200">{proposal.proposalReference}</strong>
                </span>
                {proposal.version > 1 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-semibold">
                    v{proposal.version}
                  </span>
                )}
              </div>
              <div className="pt-0.5">{getStatusBadge(proposal.status)}</div>
            </div>

            {/* Product Card */}
            <div className="bg-[#181B26] p-3 rounded-xl border border-zinc-800/80 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">
                    {proposal.productName}
                  </h3>
                  {proposal.productVariant && (
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Variant: <span className="text-zinc-300">{proposal.productVariant}</span>
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-xs font-bold text-white">
                    ₹{proposal.unitPrice.toLocaleString("en-IN")}
                  </span>
                  <span className="text-[10px] text-zinc-400 block">per unit</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-800/60 text-zinc-400">
                <span>Quantity:</span>
                <span className="font-semibold text-zinc-200">{proposal.quantity} unit(s)</span>
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="bg-[#181B26] p-3 rounded-xl border border-zinc-800/80 space-y-1.5 text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Agreed Subtotal:</span>
                <span className="font-medium text-zinc-200">
                  ₹{proposal.agreedAmount.toLocaleString("en-IN")}
                </span>
              </div>

              {proposal.discount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Special Discount:</span>
                  <span>-₹{proposal.discount.toLocaleString("en-IN")}</span>
                </div>
              )}

              {proposal.tax > 0 && (
                <div className="flex justify-between text-zinc-400">
                  <span>GST / Taxes:</span>
                  <span className="text-zinc-300">
                    +₹{proposal.tax.toLocaleString("en-IN")}
                  </span>
                </div>
              )}

              {proposal.deliveryCharge > 0 && (
                <div className="flex justify-between text-zinc-400">
                  <span>Delivery Charges:</span>
                  <span className="text-zinc-300">
                    +₹{proposal.deliveryCharge.toLocaleString("en-IN")}
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-zinc-800 flex justify-between items-center text-sm">
                <span className="font-bold text-white">Agreed Total:</span>
                <span className="text-base font-extrabold text-amber-400">
                  ₹{proposal.finalAmount.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* Notes / Terms if available */}
            {proposal.notes && (
              <div className="bg-[#181B26]/60 p-2.5 rounded-xl border border-zinc-800/50 text-[11px] text-zinc-400">
                <span className="font-semibold text-zinc-300 block mb-0.5">Agreement Note:</span>
                <p className="italic leading-relaxed">{proposal.notes}</p>
              </div>
            )}

            {/* Rejection notice if declined */}
            {proposal.status === "rejected" && proposal.rejectionReason && (
              <div className="p-2.5 bg-rose-950/30 border border-rose-800/40 rounded-xl text-xs text-rose-300">
                <span className="font-bold block text-[10px] uppercase tracking-wider text-rose-400">
                  Declined Reason:
                </span>
                <p className="mt-0.5">{proposal.rejectionReason}</p>
              </div>
            )}

            {/* Audit Timestamps */}
            <div className="text-[10px] text-zinc-400 space-y-0.5 px-1">
              <div>
                Proposed: {new Date(proposal.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
              {proposal.status === "accepted" && (
                <div className="text-emerald-400/90 font-medium">
                  Confirmed by buyer at {new Date(proposal.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="py-8 px-4 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-zinc-800/70 border border-zinc-700/50 mx-auto flex items-center justify-center text-zinc-400">
              <FiShoppingBag className="text-xl" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                No Active Proposal
              </h3>
              <p className="text-[11px] text-zinc-400 max-w-xs mx-auto leading-relaxed">
                {isVendor
                  ? "Agree on custom pricing with the buyer and register an official proposal here."
                  : "Discuss product requirements with the store. The seller will register an agreed proposal here."}
              </p>
            </div>
            {isVendor && (
              <button
                type="button"
                onClick={handleOpenPropose}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#7B0A0A] hover:bg-[#AE020B] text-white text-xs font-bold rounded-xl shadow-md transition-colors"
              >
                <FiPlus /> Propose Agreed Price
              </button>
            )}
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="p-3 bg-[#181B26] border-t border-zinc-800 flex-shrink-0 space-y-2">
        {/* Vendor Actions */}
        {isVendor && (
          <div className="flex gap-2">
            {proposal?.status === "pending_customer_confirmation" ? (
              <>
                <button
                  type="button"
                  onClick={() => onCancel && onCancel(proposal._id)}
                  disabled={isSubmitting}
                  className="flex-1 py-2 px-3 rounded-xl border border-zinc-700 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  Cancel Proposal
                </button>
                <button
                  type="button"
                  onClick={handleOpenPropose}
                  disabled={isSubmitting}
                  className="flex-1 py-2 px-3 rounded-xl bg-primary-700 hover:bg-primary-600 text-xs font-semibold text-white transition-colors disabled:opacity-50"
                >
                  Edit / Revise
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleOpenPropose}
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-[#7B0A0A] hover:bg-[#AE020B] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-md transition-colors disabled:opacity-50"
              >
                <FiPlus /> {proposal ? "Propose New Revision" : "Propose Price & Amount"}
              </button>
            )}
          </div>
        )}

        {/* Customer Actions */}
        {!isVendor && proposal && (
          <div>
            {proposal.status === "pending_customer_confirmation" && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeclineModal(true)}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 px-3 rounded-xl border border-rose-800/80 text-rose-400 hover:bg-rose-950/40 text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  <FiXCircle /> Decline
                </button>
                <button
                  type="button"
                  onClick={() => onAccept && onAccept(proposal._id)}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1 shadow-lg shadow-emerald-950/50"
                >
                  <FiCheckCircle /> Accept Amount
                </button>
              </div>
            )}

            {proposal.status === "accepted" && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => onCheckout && onCheckout(proposal)}
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5"
                >
                  <FiExternalLink /> Proceed to Official Checkout
                </button>
                <p className="text-[10px] text-zinc-400 text-center flex items-center justify-center gap-1">
                  <FiLock className="text-emerald-400" /> Platform Protected Payment Gateway
                </p>
              </div>
            )}
          </div>
        )}

        {/* Platform Compliance Shield Note */}
        <div className="text-[10px] text-zinc-400 pt-1 flex items-center justify-center gap-1 border-t border-zinc-800/50">
          <FiShield className="text-zinc-400 flex-shrink-0" />
          <span>Official transaction recorded for buyer & seller safety.</span>
        </div>
      </div>

      {/* Modal: Seller Proposes Amount */}
      <AnimatePresence>
        {showProposeModal && (
          <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#181B26] border border-zinc-700 rounded-2xl max-w-md w-full p-5 shadow-2xl text-zinc-100 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <FiFileText className="text-red-500" />
                  <h3 className="text-sm font-bold">Propose Transaction Amount</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProposeModal(false)}
                  className="text-zinc-400 hover:text-white"
                >
                  <FiX />
                </button>
              </div>

              <form onSubmit={handleProposeSubmit} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    Product / Item Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Cotton Formal Shirt"
                    className="w-full bg-[#12141C] border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                      Variant / SKU (Optional)
                    </label>
                    <input
                      type="text"
                      value={formVariant}
                      onChange={(e) => setFormVariant(e.target.value)}
                      placeholder="e.g. Size M, Navy"
                      className="w-full bg-[#12141C] border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                      Quantity *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={formQty}
                      onChange={(e) => setFormQty(e.target.value)}
                      className="w-full bg-[#12141C] border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                      Unit Price (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      step="any"
                      value={formUnitPrice}
                      onChange={(e) => setFormUnitPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[#12141C] border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                      Discount (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={formDiscount}
                      onChange={(e) => setFormDiscount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[#12141C] border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                      Tax / GST (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={formTax}
                      onChange={(e) => setFormTax(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[#12141C] border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                      Delivery Charge (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={formDelivery}
                      onChange={(e) => setFormDelivery(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[#12141C] border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    Special Notes / Inclusions (Optional)
                  </label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="e.g. Includes premium gift packaging"
                    className="w-full bg-[#12141C] border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                {/* Calculation summary */}
                <div className="p-3 bg-[#12141C] rounded-xl border border-zinc-800 text-xs flex justify-between items-center">
                  <span className="text-zinc-400">Calculated Final Amount:</span>
                  <span className="text-base font-extrabold text-amber-400">
                    ₹{calculatedTotal > 0 ? calculatedTotal.toLocaleString("en-IN") : "0.00"}
                  </span>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowProposeModal(false)}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || calculatedTotal <= 0}
                    className="flex-1 py-2 rounded-xl text-xs font-bold bg-[#7B0A0A] hover:bg-[#AE020B] text-white shadow-md disabled:opacity-50"
                  >
                    Send Proposal
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Customer Declines Proposal */}
      <AnimatePresence>
        {showDeclineModal && (
          <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#181B26] border border-zinc-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl text-zinc-100 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <FiAlertCircle className="text-rose-500" />
                  <h3 className="text-sm font-bold">Decline Proposed Amount</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDeclineModal(false)}
                  className="text-zinc-400 hover:text-white"
                >
                  <FiX />
                </button>
              </div>

              <form onSubmit={handleConfirmDecline} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Reason for declining (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    placeholder="e.g. Price is higher than expected, requested ₹1200 instead..."
                    className="w-full bg-[#12141C] border border-zinc-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDeclineModal(false)}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md disabled:opacity-50"
                  >
                    Confirm Decline
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TransactionBox;
