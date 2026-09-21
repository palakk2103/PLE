import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiArrowLeft, FiDownload, FiPrinter } from "react-icons/fi";
import { motion } from "framer-motion";
import { formatPrice } from "../../../../shared/utils/helpers";
import { useSettingsStore } from "../../../../shared/store/settingsStore";
import { getOrderById } from "../../services/adminService";
import api from "../../../../shared/utils/api";
import toast from "react-hot-toast";
import logoImage from "../../../../assets/PLELOGOBLACK.jpg";

const Invoice = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const { settings } = useSettingsStore();
  const storeLogo = settings?.general?.storeLogo || logoImage;
  const storeName = settings?.general?.storeName || "PLE";

  useEffect(() => {
    const fetchInvoiceOrOrder = async () => {
      setIsLoading(true);
      try {
        let invData = null;
        try {
          const invRes = await api.get(`/admin/orders/${id}/invoice`);
          invData = invRes?.data?.data || invRes?.data;
        } catch (e) {
          console.warn("Direct admin invoice endpoint fetch note:", e.message);
        }

        if (invData) {
          setInvoice(invData);
          setOrder({
            ...invData,
            id: invData.orderNumber || id,
            orderType: invData.orderType || 'b2c',
            b2bBulkDetails: invData.b2bBulkDetails,
            productRequestDetails: invData.productRequestDetails,
            rfqDetails: invData.rfqDetails,
            invoiceNumber: invData.invoiceNumber,
            date: invData.invoiceDate,
            customer: invData.customer,
            b2bDetails: invData.b2bDetails,
            shippingAddress: invData.shippingAddress,
            billingAddress: invData.billingAddress,
            items: invData.items,
            subtotal: invData.financialSummary?.subtotal,
            tax: invData.financialSummary?.tax,
            discount: invData.financialSummary?.discount,
            shipping: invData.financialSummary?.shipping,
            finalTotal: invData.financialSummary?.grandTotal,
            total: invData.financialSummary?.grandTotal,
            paymentMethod: invData.payment?.method,
            paymentStatus: invData.payment?.status,
            status: invData.status,
            financialSummary: invData.financialSummary,
            sellerBreakdown: invData.sellerBreakdown,
          });
        } else {
          const response = await getOrderById(id);
          const o = response.data;
          const normalizedOrder = {
            ...o,
            id: o.orderId || o._id,
            orderType: o.orderType || (o.requestProductId ? 'product_request' : o.rfqId ? 'rfq' : 'b2c'),
            customer: {
              name: o.userId?.name || 'Unknown',
              email: o.userId?.email || '',
              phone: o.userId?.phone || ''
            },
            date: o.createdAt,
            finalTotal: o.total
          };
          setOrder(normalizedOrder);
        }
      } catch (error) {
        toast.error("Order or invoice not found");
        console.error("Order fetch error:", error);
        navigate("/admin/orders/all-orders");
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvoiceOrOrder();
  }, [id, navigate]);

  if (isLoading || !order) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  // Get order items - handle both array and number formats
  const items = Array.isArray(order.items)
    ? order.items
    : Array.from({ length: order.items || 1 }, (_, i) => ({
      id: i + 1,
      name: `Item ${i + 1}`,
      quantity: 1,
      price: (order.total || 0) / (order.items || 1),
    }));

  // Calculate totals
  const subtotal = order.subtotal ?? order.total ?? 0;
  const tax = order.tax ?? 0;
  const discount = order.discount ?? 0;
  const shipping = order.shipping ?? 0;
  const finalTotal =
    order.finalTotal !== undefined
      ? order.finalTotal
      : subtotal + tax + shipping - discount;

  // Format payment method
  const formatPaymentMethod = (method) => {
    if (!method) return "N/A";
    const methodMap = {
      card: "Credit Card",
      cod: "Cash on Delivery",
      wallet: "Wallet",
      creditCard: "Credit Card",
      cash: "Cash on Delivery",
    };
    return (
      methodMap[method.toLowerCase()] ||
      method.charAt(0).toUpperCase() + method.slice(1)
    );
  };

  const getOrderTypeBadge = (type) => {
    switch (type) {
      case 'b2b':
        return {
          title: 'B2B / Bulk Order',
          badgeClass: 'bg-purple-100 text-purple-800 border border-purple-300',
        };
      case 'product_request':
        return {
          title: 'Product Request Order',
          badgeClass: 'bg-amber-100 text-amber-800 border border-amber-300',
        };
      case 'rfq':
        return {
          title: 'RFQ Order',
          badgeClass: 'bg-teal-100 text-teal-800 border border-teal-300',
        };
      case 'b2c':
      default:
        return {
          title: 'B2C Order',
          badgeClass: 'bg-blue-100 text-blue-800 border border-blue-300',
        };
    }
  };

  const handleDownload = async () => {
    const cleanId = order?.orderNumber || order?.id || id;
    setDownloading(true);
    const toastId = toast.loading("Downloading official invoice PDF...");
    try {
      const res = await api.get(`/admin/orders/${cleanId}/invoice/pdf`, { responseType: 'blob' });
      const blob = res instanceof Blob ? res : new Blob([res?.data || res], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.setAttribute("download", `Admin-Invoice-${order?.invoiceNumber || cleanId}.pdf`);
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 1500);
      toast.success("Invoice PDF downloaded successfully!", { id: toastId });
    } catch (err) {
      console.error("PDF download error:", err);
      toast.error("Failed to download invoice PDF.", { id: toastId });
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      {/* Header - Hidden in print */}
      <div className="no-print">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6">
          <div className="flex items-center justify-between bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <FiArrowLeft className="text-lg text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
                  Invoice
                </h1>
                <p className="text-xs text-gray-500">Order #{order.id}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-semibold">
                <FiDownload />
                Download
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold">
                <FiPrinter />
                Print
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Invoice Content - Only this prints */}
      <div className="invoice-content bg-white rounded-lg p-6 sm:p-8 shadow-sm border border-gray-200">
        {/* Logo and Invoice Header */}
        <div className="mb-8 pb-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 mb-6">
            {/* Logo */}
            <div className="flex items-center justify-start sm:justify-start">
              <img
                src={storeLogo}
                alt={storeName}
                className="h-24 sm:h-32 md:h-40 w-auto object-contain"
                onError={(e) => {
                  e.target.src = logoImage;
                }}
              />
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-700 mb-1">Status</p>
              <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold capitalize">
                {order.status}
              </span>
              <div className="mt-2">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${getOrderTypeBadge(order.orderType).badgeClass}`}>
                  Invoice Type: {getOrderTypeBadge(order.orderType).title}
                </span>
              </div>
            </div>
          </div>

          {/* Invoice Title */}
          <div className="mt-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
              TAX INVOICE — {getOrderTypeBadge(order.orderType).title.toUpperCase()}
            </h2>
            <p className="text-gray-600">
              Order #<span className="font-semibold">{order.id}</span>
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Date: {new Date(order.date).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Customer & Shipping Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <h3 className="text-sm font-bold text-gray-800 mb-3 uppercase">
              Bill To
            </h3>
            <div className="text-sm text-gray-700 space-y-1">
              <p className="font-semibold">{order.customer?.name || "N/A"}</p>
              <p>{order.customer?.email || "N/A"}</p>
              {order.customer?.phone && <p>{order.customer.phone}</p>}
            </div>
          </div>
          {order.shippingAddress && (
            <div>
              <h3 className="text-sm font-bold text-gray-800 mb-3 uppercase">
                Ship To
              </h3>
              <div className="text-sm text-gray-700 space-y-1">
                <p className="font-semibold">
                  {order.shippingAddress.name || order.customer?.name || "N/A"}
                </p>
                {order.shippingAddress.address && (
                  <p>{order.shippingAddress.address}</p>
                )}
                {(order.shippingAddress.city ||
                  order.shippingAddress.state ||
                  order.shippingAddress.zipCode) && (
                    <p>
                      {[
                        order.shippingAddress.city,
                        order.shippingAddress.state,
                        order.shippingAddress.zipCode,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  )}
                {order.shippingAddress.country && (
                  <p>{order.shippingAddress.country}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Contextual Order Type Banner */}
        {order.orderType === 'product_request' && (
          <div className="mb-8 p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
            <div className="font-bold uppercase tracking-wider text-amber-800">
              Origin: Product Request Order
            </div>
            <p className="text-amber-700">This purchase originated from a custom Product Request workflow.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-amber-200 text-[11px]">
              <div>
                <span className="text-amber-600 block font-medium">Request Ref ID:</span>
                <span className="font-mono font-bold">{order.productRequestDetails?.requestId || 'N/A'}</span>
              </div>
              <div>
                <span className="text-amber-600 block font-medium">Category:</span>
                <span className="font-semibold">{order.productRequestDetails?.category || 'General'}</span>
              </div>
              <div>
                <span className="text-amber-600 block font-medium">Requested Quantity:</span>
                <span className="font-semibold">{order.productRequestDetails?.requestedQuantity || 'N/A'}</span>
              </div>
              <div>
                <span className="text-amber-600 block font-medium">Agreed Final Quantity:</span>
                <span className="font-semibold">{order.productRequestDetails?.agreedQuantity || 'N/A'}</span>
              </div>
            </div>
          </div>
        )}

        {order.orderType === 'rfq' && (
          <div className="mb-8 p-4 rounded-xl bg-teal-50 border border-teal-200 text-xs text-teal-900 space-y-1.5">
            <div className="font-bold uppercase tracking-wider text-teal-800">
              Origin: RFQ Order
            </div>
            <p className="text-teal-700">This purchase originated from a custom Request For Quotation (RFQ) negotiation.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-teal-200 text-[11px]">
              <div>
                <span className="text-teal-600 block font-medium">RFQ Ref ID:</span>
                <span className="font-mono font-bold">{order.rfqDetails?.rfqId || 'N/A'}</span>
              </div>
              <div>
                <span className="text-teal-600 block font-medium">Quoted Unit Price:</span>
                <span className="font-mono font-semibold">{order.rfqDetails?.quotedPrice ? formatPrice(order.rfqDetails.quotedPrice) : 'Negotiated'}</span>
              </div>
              <div>
                <span className="text-teal-600 block font-medium">Agreed Quantity:</span>
                <span className="font-semibold">{order.rfqDetails?.agreedQuantity || 'N/A'}</span>
              </div>
              <div>
                <span className="text-teal-600 block font-medium">Terms:</span>
                <span className="truncate block">{order.rfqDetails?.terms || 'Standard RFQ Terms'}</span>
              </div>
            </div>
          </div>
        )}

        {order.orderType === 'b2b' && (
          <div className="mb-8 p-4 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-900 space-y-1.5">
            <div className="font-bold uppercase tracking-wider text-purple-800">
              Origin: B2B / Bulk Order
            </div>
            <p className="text-purple-700">Commercial wholesale purchase with enterprise billing and GST input tax credit.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-purple-200 text-[11px]">
              <div>
                <span className="text-purple-600 block font-medium">Company Name:</span>
                <span className="font-semibold truncate block">{order.b2bBulkDetails?.companyName || order.b2bDetails?.companyName || 'Corporate Client'}</span>
              </div>
              <div>
                <span className="text-purple-600 block font-medium">GSTIN:</span>
                <span className="font-mono font-bold">{order.b2bBulkDetails?.gstNumber || order.b2bDetails?.gstNumber || 'N/A'}</span>
              </div>
              <div>
                <span className="text-purple-600 block font-medium">Total Bulk Units:</span>
                <span className="font-bold">{order.b2bBulkDetails?.totalBulkQuantity || 'Bulk'} units</span>
              </div>
              <div>
                <span className="text-purple-600 block font-medium">Pricing Tier:</span>
                <span className="font-semibold text-emerald-700">Wholesale / Bulk Slab</span>
              </div>
            </div>
          </div>
        )}

        {(!order.orderType || order.orderType === 'b2c') && (
          <div className="mb-8 p-3 rounded-xl bg-blue-50/60 border border-blue-100 text-xs text-blue-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold">B2C Retail Purchase</span>
              <span className="text-gray-400">•</span>
              <span className="text-[11px] text-gray-500">Standard direct-to-consumer fulfillment</span>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-100 font-semibold text-blue-800">
              Standard B2C
            </span>
          </div>
        )}

        {/* Items Table */}
        <div className="mb-8">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Item
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                  Quantity
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                  Unit Price
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                  GST Rate
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item, index) => {
                const itemTotal = (item.price || 0) * (item.quantity || 1);
                const itemGstRate = item.gstRate !== undefined ? item.gstRate : 18;
                return (
                  <tr key={item.id || index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-800">
                      {item.name || `Item ${index + 1}`}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-center">
                      {item.quantity || 1}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right">
                      {formatPrice(item.price || 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-center font-mono text-xs font-bold">
                      {itemGstRate}%
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800 text-right">
                      {formatPrice(itemTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full sm:w-80 space-y-2">
            <div className="flex justify-between text-sm text-gray-700">
              <span>Subtotal:</span>
              <span className="font-semibold">{formatPrice(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount:</span>
                <span className="font-semibold">-{formatPrice(discount)}</span>
              </div>
            )}
            {tax > 0 && (
              <div className="flex justify-between text-sm text-gray-700">
                <span>Tax:</span>
                <span className="font-semibold">{formatPrice(tax)}</span>
              </div>
            )}
            {shipping > 0 && (
              <div className="flex justify-between text-sm text-gray-700">
                <span>Shipping:</span>
                <span className="font-semibold">{formatPrice(shipping)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-gray-800 pt-3 border-t border-gray-200">
              <span>Total:</span>
              <span>{formatPrice(finalTotal)}</span>
            </div>
          </div>
        </div>

        {/* Payment & Tracking Info */}
        <div className="mt-8 pt-6 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-semibold text-gray-800 mb-1">Payment Method:</p>
            <p className="text-gray-600">
              {formatPaymentMethod(order.paymentMethod)}
            </p>
          </div>
          {order.trackingNumber && (
            <div>
              <p className="font-semibold text-gray-800 mb-1">
                Tracking Number:
              </p>
              <p className="text-gray-600 font-mono">{order.trackingNumber}</p>
            </div>
          )}
        </div>

        {/* Admin Platform Financials */}
        {order.financialSummary && (
          <div className="mt-6 p-4 rounded-xl bg-blue-50/80 border border-blue-200 text-xs text-gray-800">
            <h4 className="font-bold text-blue-900 uppercase tracking-wider mb-2">Admin Financial Ledger & Settlements</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-gray-500">Platform Commission:</span>
                <p className="font-bold text-blue-700 text-sm">{formatPrice(order.financialSummary.totalPlatformCommission || 0)}</p>
              </div>
              <div>
                <span className="text-gray-500">Vendor Settlements:</span>
                <p className="font-bold text-emerald-700 text-sm">{formatPrice(order.financialSummary.totalSellerEarnings || 0)}</p>
              </div>
              <div>
                <span className="text-gray-500">Settlement Status:</span>
                <p className="font-semibold text-gray-800 text-sm">Audited / Tracked</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            margin: 0.5in;
            size: A4;
          }
          
          body * {
            visibility: hidden;
          }
          
          .invoice-content,
          .invoice-content * {
            visibility: visible;
          }
          
          .invoice-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0 !important;
            padding: 1.5rem !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
          }
          
          .no-print,
          .no-print * {
            display: none !important;
            visibility: hidden !important;
          }
          
          button {
            display: none !important;
          }
          
          .invoice-content table {
            page-break-inside: avoid;
          }
          
          .invoice-content tr {
            page-break-inside: avoid;
          }
          
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
        
        @media screen {
          .invoice-content {
            margin-top: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
};

export default Invoice;
