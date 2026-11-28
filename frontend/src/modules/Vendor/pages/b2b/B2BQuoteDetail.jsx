import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  FiArrowLeft,
  FiFileText,
  FiCalendar,
  FiCreditCard,
  FiTruck,
  FiMessageSquare,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiExternalLink,
} from "react-icons/fi";
import { motion } from "framer-motion";
import { useVendorB2BStore } from "../../store/vendorB2BStore";
import { formatPrice } from "../../../../shared/utils/helpers";
import Badge from "../../../../shared/components/Badge";
import toast from "react-hot-toast";

const B2BQuoteDetail = () => {
  const { id, quoteId } = useParams();
  const { getEnquiryById, updateQuote, updateEnquiryStatus, enquiries } = useVendorB2BStore();

  const [enquiry, setEnquiry] = useState(null);
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !quoteId) return;
    const fetchData = () => {
      setLoading(true);
      const enq = getEnquiryById(id);
      if (enq) {
        setEnquiry(enq);
        const q = enq.quotes.find((item) => item.id === quoteId);
        setQuote(q || null);
      }
      setLoading(false);
    };

    fetchData();
  }, [id, quoteId, getEnquiryById, enquiries]);

  const handleSimulateBuyerAction = (action) => {
    if (!enquiry || !quote) return;

    if (action === "accept") {
      updateQuote(enquiry.id, quote.id, {
        status: "accepted",
        acceptedAt: new Date().toISOString(),
      });
      updateEnquiryStatus(enquiry.id, "accepted");
      toast.success("Simulated: Buyer has accepted this quotation!");
    } else if (action === "reject") {
      updateQuote(enquiry.id, quote.id, {
        status: "rejected",
        rejectedAt: new Date().toISOString(),
        rejectionReason: "Pricing exceeded corporate procurement budget.",
      });
      updateEnquiryStatus(enquiry.id, "rejected");
      toast.error("Simulated: Buyer has rejected this quotation.");
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Loading quotation details...</p>
      </div>
    );
  }

  if (!enquiry || !quote) {
    return (
      <div className="p-6 text-center space-y-3">
        <p className="text-gray-700 font-semibold">Quote not found</p>
        <Link
          to={`/vendor/b2b-enquiries/${id}`}
          className="inline-block text-amber-800 hover:underline text-sm font-medium"
        >
          ← Back to Enquiry
        </Link>
      </div>
    );
  }

  const getQuoteStatusVariant = (status) => {
    const map = {
      submitted: "warning",
      accepted: "success",
      rejected: "error",
    };
    return map[status] || "default";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-12"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to={`/vendor/b2b-enquiries/${enquiry.id}`}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FiArrowLeft className="text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-800">
                Quotation #{quote.id}
              </h1>
              <Badge variant={getQuoteStatusVariant(quote.status)}>
                {quote.status.toUpperCase()}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
              <span>Linked Enquiry:</span>
              <Link
                to={`/vendor/b2b-enquiries/${enquiry.id}`}
                className="text-amber-800 hover:underline font-semibold flex items-center gap-0.5"
              >
                #{enquiry.enquiryNumber} <FiExternalLink className="w-3 h-3" />
              </Link>
              <span>• Company: {enquiry.buyer.company}</span>
            </p>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-gray-400 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
          Created on: {new Date(quote.createdAt).toLocaleString()}
        </p>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Quote Items Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-55 font-semibold text-gray-800 flex items-center gap-2">
              <FiFileText className="text-amber-800" /> Quotation Pricing Details
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                    <th className="p-4">Product details</th>
                    <th className="p-4 text-center">Qty</th>
                    <th className="p-4 text-right">Offered Price (Unit)</th>
                    <th className="p-4 text-center">Est. Delivery</th>
                    <th className="p-4 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm">
                  {quote.items.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="p-4">
                        <div>
                          <p className="font-semibold text-gray-800">{item.name}</p>
                          <p className="text-xs text-gray-500 font-mono mt-0.5">{item.sku}</p>
                        </div>
                      </td>
                      <td className="p-4 text-center font-bold text-gray-800">
                        {item.qty} pcs
                      </td>
                      <td className="p-4 text-right text-gray-700 font-medium">
                        {formatPrice(item.offeredPrice)}
                      </td>
                      <td className="p-4 text-center text-gray-600 font-medium">
                        {item.deliveryDays} Days
                      </td>
                      <td className="p-4 text-right font-extrabold text-gray-900">
                        {formatPrice(item.offeredPrice * item.qty)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-amber-50/30 border-t border-gray-200 flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-600">
                Total Quotation Value:
              </span>
              <span className="text-lg font-black text-amber-900">
                {formatPrice(quote.totalValue)}
              </span>
            </div>
          </div>

          {/* Quote-level Terms & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Terms Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2 border-b border-gray-100 pb-2 text-base">
                <FiTruck className="text-amber-800" />
                Quotation Terms
              </h2>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Valid Until</p>
                  <p className="font-semibold text-gray-800 mt-0.5 flex items-center gap-1.5">
                    <FiCalendar className="text-gray-400" />
                    {new Date(quote.validUntil).toLocaleDateString()}
                    <span className="text-xs font-normal text-gray-400">
                      ({Math.max(0, Math.ceil((new Date(quote.validUntil) - new Date()) / (1000 * 60 * 60 * 24)))} days remaining)
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Payment Terms</p>
                  <p className="font-semibold text-gray-800 mt-0.5 flex items-center gap-1.5">
                    <FiCreditCard className="text-gray-400" />
                    {quote.paymentTerms}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Shipping & Delivery</p>
                  <p className="font-semibold text-gray-800 mt-0.5 flex items-center gap-1.5">
                    <FiTruck className="text-gray-400" />
                    {quote.shippingTerms}
                  </p>
                </div>
              </div>
            </div>

            {/* Notes / Remarks */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2 border-b border-gray-100 pb-2 text-base">
                <FiMessageSquare className="text-amber-800" />
                Remarks & Cover Letter
              </h2>
              <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line bg-gray-50 p-3 rounded-lg border border-gray-150 h-[100px] overflow-y-auto">
                {quote.notes || "No custom remarks attached to this quotation."}
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Simulation Tools */}
          {quote.status === "submitted" && !/^[a-fA-F0-9]{24}$/.test(enquiry.id) && (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl shadow-sm p-5 space-y-4">
              <h3 className="font-bold text-amber-900 flex items-center gap-1.5 text-base">
                <FiClock className="animate-spin text-amber-600" />
                Interactive Simulation
              </h3>
              <p className="text-xs text-amber-800 leading-relaxed">
                Since this is a backend-free frontend mockup environment, you can use these buttons to simulate how a B2B buyer would respond to your quotation.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => handleSimulateBuyerAction("accept")}
                  className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1"
                >
                  <FiCheckCircle /> Accept Quote
                </button>
                <button
                  onClick={() => handleSimulateBuyerAction("reject")}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1"
                >
                  <FiXCircle /> Reject Quote
                </button>
              </div>
            </div>
          )}

          {/* Status Feedback */}
          {quote.status !== "submitted" && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-3">
              <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wider text-center border-b border-gray-100 pb-2">
                Buyer Feedback
              </h3>
              {quote.status === "accepted" ? (
                <div className="text-center space-y-2 py-3">
                  <FiCheckCircle className="mx-auto text-4xl text-green-500" />
                  <p className="text-sm font-bold text-gray-800">Quotation Approved!</p>
                  <p className="text-xs text-gray-500">
                    Accepted on: {quote.acceptedAt ? new Date(quote.acceptedAt).toLocaleString() : new Date().toLocaleDateString()}
                  </p>
                  <div className="bg-green-50 p-2.5 rounded-lg border border-green-100 text-xs text-green-800 leading-normal">
                    System has automatically initiated B2B invoice generation and warehouse packing processes.
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-2 py-3">
                  <FiXCircle className="mx-auto text-4xl text-red-500" />
                  <p className="text-sm font-bold text-gray-800">Quotation Rejected</p>
                  <p className="text-xs text-gray-500">
                    Date: {quote.rejectedAt ? new Date(quote.rejectedAt).toLocaleString() : new Date().toLocaleDateString()}
                  </p>
                  <div className="bg-red-50 p-2.5 rounded-lg border border-red-100 text-xs text-red-800 leading-normal text-left">
                    <span className="font-bold block">Reason:</span>
                    {quote.rejectionReason || "Price not matching buyer target price requirements."}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Buyer Summary */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-3 text-base">Buyer Summary</h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-400 font-semibold">Buyer Name</p>
                <p className="font-semibold text-gray-800 mt-0.5">{enquiry.buyer.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-semibold">Company</p>
                <p className="font-semibold text-gray-800 mt-0.5">{enquiry.buyer.company}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-semibold">Business Type</p>
                <p className="font-semibold text-gray-800 mt-0.5">{enquiry.buyer.businessType || "Retailer"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-semibold">GSTIN</p>
                <p className="font-medium text-gray-700 mt-0.5 font-mono">{enquiry.buyer.gstNumber || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-semibold mb-1">Verification Status</p>
                <div>
                  {(enquiry.buyer.verificationStatus === "Approved" || enquiry.buyer.verified !== false) ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
                      Verified Business ✅
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-700 border border-amber-200 shadow-sm animate-pulse">
                      Verification Pending ⏳
                    </span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-semibold">Shipping Destination</p>
                <p className="text-xs text-gray-650 mt-0.5 leading-relaxed">{enquiry.buyer.address || "Not shared"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default B2BQuoteDetail;
