import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiFileText,
  FiCalendar,
  FiCreditCard,
  FiTruck,
  FiMessageSquare,
  FiPaperclip,
  FiUpload,
  FiTrash2,
} from "react-icons/fi";
import { motion } from "framer-motion";
import { useVendorB2BStore } from "../../store/vendorB2BStore";
import { formatPrice } from "../../../../shared/utils/helpers";
import toast from "react-hot-toast";
import api from "../../../../shared/utils/api";

const B2BCreateQuote = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getEnquiryById, createQuote, settings, fetchEnquiries } = useVendorB2BStore();

  const [enquiry, setEnquiry] = useState(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [items, setItems] = useState([]);
  const [validityDays, setValidityDays] = useState(settings?.defaultQuoteValidity || 15);
  const [paymentTerms, setPaymentTerms] = useState(settings?.defaultPaymentTerms || "Net 30 days");
  const [shippingTerms, setShippingTerms] = useState(settings?.defaultShippingTerms || "FOB Origin");
  const [warranty, setWarranty] = useState("12 Months Manufacturer Warranty");
  const [taxDetails, setTaxDetails] = useState("18% GST extra");
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [generalNotes, setGeneralNotes] = useState("");

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      const uploadForm = new FormData();
      uploadForm.append('file', file);
      
      const res = await api.post('/vendor/rfq/upload', uploadForm, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const fileUrl = res?.data?.url || res?.url || '';
      if (fileUrl) {
        setAttachments(prev => [...prev, fileUrl]);
        toast.success("Document uploaded successfully!");
      } else {
        toast.error("Failed to retrieve uploaded file URL");
      }
    } catch (err) {
      console.error(err);
      // Fallback for mock if upload fails
      const mockUrl = URL.createObjectURL(file);
      setAttachments(prev => [...prev, mockUrl]);
      toast.success("Mock upload: file added locally!");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    const fetchEnquiry = async () => {
      setLoading(true);
      let data = getEnquiryById(id);
      if (!data) {
        await fetchEnquiries();
        data = getEnquiryById(id);
      }
      if (data) {
        setEnquiry(data);
        // Pre-populate items with enquiry products and target price
        setItems(
          (data.products || []).map((p) => ({
            name: p.name,
            sku: p.sku || "",
            qty: p.qty,
            unit: p.unit || "pcs",
            targetPrice: p.targetPrice,
            offeredPrice: p.targetPrice, // default to target price
            deliveryDays: 7, // default delivery estimate
          }))
        );
      }
      setLoading(false);
    };

    fetchEnquiry();
  }, [id, getEnquiryById, fetchEnquiries]);

  const handlePriceChange = (index, value) => {
    const updated = [...items];
    updated[index].offeredPrice = parseFloat(value) || 0;
    setItems(updated);
  };

  const handleDeliveryChange = (index, value) => {
    const updated = [...items];
    updated[index].deliveryDays = parseInt(value) || 0;
    setItems(updated);
  };

  // Calculate quote subtotal/total
  const quoteTotal = items.reduce((sum, item) => sum + item.offeredPrice * item.qty, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (items.some((item) => item.offeredPrice <= 0)) {
      toast.error("Offered price must be greater than zero for all items");
      return;
    }

    // Calculate validity expiration date
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + parseInt(validityDays));

    const quoteData = {
      items: items.map((item) => ({
        name: item.name,
        sku: item.sku,
        qty: item.qty,
        offeredPrice: item.offeredPrice,
        deliveryDays: item.deliveryDays,
      })),
      totalValue: quoteTotal,
      validUntil: expirationDate.toISOString(),
      paymentTerms,
      shippingTerms,
      warranty,
      taxDetails,
      attachments,
      notes: generalNotes,
    };

    try {
      const quoteId = await createQuote(enquiry.id, quoteData);
      toast.success("Quote submitted successfully!");
      navigate(`/vendor/b2b-enquiries/${enquiry.id}`);
    } catch (err) {
      toast.error(err?.message || "Failed to submit quotation");
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Loading details for quote creation...</p>
      </div>
    );
  }

  if (!enquiry) {
    return (
      <div className="p-6 text-center space-y-3">
        <p className="text-gray-700 font-semibold">Enquiry not found</p>
        <Link
          to="/vendor/b2b-enquiries"
          className="inline-block text-amber-800 hover:underline text-sm font-medium"
        >
          ← Back to B2B Enquiries
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-12"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to={`/vendor/b2b-enquiries/${enquiry.id}`}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <FiArrowLeft className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Create Quotation
          </h1>
          <p className="text-sm text-gray-500">
            Preparing quote for Enquiry #{enquiry.enquiryNumber} ({enquiry.buyer.company})
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Items Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <FiFileText className="text-amber-800" />
              Line Item Quotation Prices
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-55 text-xs font-semibold text-gray-600 uppercase">
                  <th className="p-4 w-[40%]">Product details</th>
                  <th className="p-4 text-center">Qty</th>
                  <th className="p-4 text-right">Target Price</th>
                  <th className="p-4 w-[20%] text-right">Offered Unit Price (INR)</th>
                  <th className="p-4 w-[15%] text-right">Est. Delivery (Days)</th>
                  <th className="p-4 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {items.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50 align-top">
                    <td className="p-4">
                      <div>
                        <p className="font-medium text-gray-800">{item.name}</p>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">{item.sku}</p>
                      </div>
                    </td>
                    <td className="p-4 text-center font-semibold text-gray-800">
                      {item.qty} {item.unit}
                    </td>
                    <td className="p-4 text-right text-gray-500">
                      {formatPrice(item.targetPrice)}
                    </td>
                    <td className="p-4 text-right">
                      <div className="relative inline-block w-full">
                        <span className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 font-medium">₹</span>
                        <input
                          type="number"
                          value={item.offeredPrice}
                          onChange={(e) => handlePriceChange(index, e.target.value)}
                          className="w-full pl-6 pr-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-right text-sm font-semibold"
                          required
                          min="1"
                          step="0.01"
                        />
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <input
                        type="number"
                        value={item.deliveryDays}
                        onChange={(e) => handleDeliveryChange(index, e.target.value)}
                        className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-center text-sm font-medium"
                        required
                        min="1"
                      />
                    </td>
                    <td className="p-4 text-right font-bold text-gray-800">
                      {formatPrice(item.offeredPrice * item.qty)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-amber-50/50 border-t border-gray-200 flex justify-between items-center">
            <span className="text-sm font-semibold text-amber-900">
              Total Quotation Value (INR):
            </span>
            <span className="text-xl font-black text-amber-900">
              {formatPrice(quoteTotal)}
            </span>
          </div>
        </div>

        {/* Quotation T&C and Notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left panel: Terms */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2 border-b border-gray-100 pb-2">
              <FiTruck className="text-amber-800" />
              Quotation Terms
            </h2>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1">
                <FiCalendar className="text-gray-400" /> Quote Validity (Days)
              </label>
              <input
                type="number"
                value={validityDays}
                onChange={(e) => setValidityDays(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-medium"
                required
                min="1"
              />
              <p className="text-xs text-gray-400 mt-1">
                Quote will automatically expire on {new Date(new Date().setDate(new Date().getDate() + parseInt(validityDays || 0))).toLocaleDateString()}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1">
                <FiCreditCard className="text-gray-400" /> Payment Terms
              </label>
              <input
                type="text"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-medium"
                placeholder="e.g. Net 30, 50% advance"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1">
                <FiTruck className="text-gray-400" /> Shipping & Delivery Terms
              </label>
              <input
                type="text"
                value={shippingTerms}
                onChange={(e) => setShippingTerms(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-medium"
                placeholder="e.g. FOB Origin, Free shipping"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1">
                <FiFileText className="text-gray-400" /> Warranty Details
              </label>
              <input
                type="text"
                value={warranty}
                onChange={(e) => setWarranty(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-medium"
                placeholder="e.g. 12 Months Manufacturer Warranty"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1">
                <FiFileText className="text-gray-400" /> Tax & GST Details
              </label>
              <input
                type="text"
                value={taxDetails}
                onChange={(e) => setTaxDetails(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-medium"
                placeholder="e.g. 18% GST extra / inclusive"
                required
              />
            </div>
          </div>

          {/* Right panel: General Notes */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2 border-b border-gray-100 pb-2">
              <FiMessageSquare className="text-amber-800" />
              Remarks & Cover Letter
            </h2>

            <div className="h-full pb-6">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Special instructions or notes for the buyer
              </label>
              <textarea
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                className="w-full h-[230px] p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm leading-relaxed"
                placeholder="Write clear, professional remarks about stock availability, warranties, certifications, packaging or discounts..."
              ></textarea>
            </div>
          </div>
        </div>

        {/* Full width attachments card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2 border-b border-gray-100 pb-2">
            <FiPaperclip className="text-amber-800" />
            Quotation Documents & Attachments
          </h2>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Upload Spec Sheet / Quotation PDF (Optional)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="file"
                id="doc-upload"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
              <button
                type="button"
                onClick={() => document.getElementById("doc-upload").click()}
                disabled={uploading}
                className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <FiUpload /> {uploading ? "Uploading..." : "Upload Document"}
              </button>
            </div>

            {attachments.length > 0 && (
              <div className="mt-3 space-y-2 max-w-md">
                {attachments.map((url, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-150 text-xs">
                    <span className="font-mono truncate max-w-[80%] text-gray-750">
                      {url.split('/').pop()}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAttachments(prev => prev.filter((_, i) => i !== index))}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <FiTrash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3">
          <Link
            to={`/vendor/b2b-enquiries/${enquiry.id}`}
            className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 rounded-lg text-sm font-semibold transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="px-6 py-2.5 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            Submit Quotation to Buyer
          </button>
        </div>
      </form>
    </motion.div>
  );
};

export default B2BCreateQuote;
