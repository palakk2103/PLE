import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiX,
  FiDownload,
  FiPrinter,
  FiCheckCircle,
  FiClock,
  FiAlertCircle,
  FiFileText,
  FiBriefcase,
  FiTruck,
  FiShield,
  FiLayers,
  FiTag,
  FiShoppingBag,
  FiMail,
} from 'react-icons/fi';
import api from '../utils/api';
import { formatPrice } from '../utils/helpers';
import toast from 'react-hot-toast';

const InvoiceModal = ({ isOpen, onClose, orderId, role = 'customer' }) => {
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [resending, setResending] = useState(false);

  // Determine endpoints based on role
  const getEndpoint = () => {
    const cleanId = orderId?.orderId || orderId?.id || orderId;
    if (role === 'admin') return `/admin/orders/${cleanId}/invoice`;
    if (role === 'vendor') return `/vendor/orders/${cleanId}/invoice`;
    return `/user/orders/${cleanId}/invoice`;
  };

  const getPdfEndpoint = () => {
    const cleanId = orderId?.orderId || orderId?.id || orderId;
    if (role === 'admin') return `/admin/orders/${cleanId}/invoice/pdf`;
    if (role === 'vendor') return `/vendor/orders/${cleanId}/invoice/pdf`;
    return `/user/orders/${cleanId}/invoice/pdf`;
  };

  useEffect(() => {
    if (!isOpen || !orderId) return;

    const fetchInvoice = async () => {
      setLoading(true);
      try {
        const res = await api.get(getEndpoint());
        const data = res?.data?.data || res?.data;
        setInvoice(data);
      } catch (err) {
        console.error('Invoice fetch error:', err);
        toast.error(err.response?.data?.message || 'Failed to load invoice details.');
        setInvoice(null);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [isOpen, orderId, role]);

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    setDownloading(true);
    const toastId = toast.loading('Generating invoice PDF...');
    try {
      const res = await api.get(getPdfEndpoint(), { responseType: 'blob' });
      const blob = res instanceof Blob ? res : new Blob([res?.data || res], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = url;
      link.setAttribute('download', `Invoice-${invoice.invoiceNumber || 'Document'}.pdf`);
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        link.remove();
        window.URL.revokeObjectURL(url);
      }, 1500);
      toast.success('Invoice PDF downloaded successfully!', { id: toastId });
    } catch (err) {
      console.error('PDF download error:', err);
      toast.error('Failed to download invoice PDF.', { id: toastId });
    } finally {
      setDownloading(false);
    }
  };

  const handleResendEmail = async () => {
    if (!orderId) return;
    const cleanId = orderId?.orderId || orderId?.id || orderId;
    setResending(true);
    const toastId = toast.loading('Resending invoice to customer email...');
    try {
      const res = await api.post(`/admin/orders/${cleanId}/invoice/resend-email`);
      toast.success(res?.data?.message || 'Invoice emailed to customer successfully!', { id: toastId });
      // Refresh invoice to show updated delivery status
      const refreshed = await api.get(getEndpoint());
      const data = refreshed?.data?.data || refreshed?.data;
      if (data) setInvoice(data);
    } catch (err) {
      console.error('Invoice resend error:', err);
      toast.error(err.response?.data?.message || 'Failed to resend invoice email.', { id: toastId });
    } finally {
      setResending(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getOrderTypeInfo = (type) => {
    switch (type) {
      case 'b2b':
        return {
          title: 'B2B / Bulk Order',
          badgeText: 'B2B / Bulk Order',
          badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300 dark:border-purple-800',
          label: 'Invoice Type: B2B / Bulk Order',
        };
      case 'product_request':
        return {
          title: 'Product Request Order',
          badgeText: 'Product Request Order',
          badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800',
          label: 'Invoice Type: Product Request Order',
        };
      case 'rfq':
        return {
          title: 'RFQ Order',
          badgeText: 'RFQ Order',
          badgeClass: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-300 dark:border-teal-800',
          label: 'Invoice Type: RFQ Order',
        };
      case 'b2c':
      default:
        return {
          title: 'B2C Order',
          badgeText: 'B2C Order',
          badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 dark:border-blue-800',
          label: 'Invoice Type: B2C Order',
        };
    }
  };

  const orderTypeInfo = getOrderTypeInfo(invoice?.orderType);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-sm print:p-0 print:bg-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-4xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800 my-auto flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:m-0"
        >
          {/* Header Action Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/50 print:hidden">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-primary-50 dark:bg-primary-950/40 rounded-xl text-primary-600 dark:text-primary-400">
                <FiFileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-none">
                  Tax Invoice
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {invoice?.invoiceNumber ? `Invoice #${invoice.invoiceNumber}` : 'Loading...'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {role === 'admin' && (
                <button
                  onClick={handleResendEmail}
                  disabled={resending || loading || !invoice}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-950/50 hover:bg-primary-100 dark:hover:bg-primary-900/50 border border-primary-200 dark:border-primary-800 rounded-xl transition-all disabled:opacity-50"
                  title="Resend Invoice PDF to Customer Email"
                >
                  <FiMail className="w-4 h-4" />
                  <span>{resending ? 'Sending...' : 'Resend Email'}</span>
                </button>
              )}

              <button
                onClick={handlePrint}
                disabled={loading || !invoice}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-xl transition-all disabled:opacity-50"
                title="Print Invoice"
              >
                <FiPrinter className="w-4 h-4" />
                <span>Print</span>
              </button>

              <button
                onClick={handleDownloadPdf}
                disabled={downloading || loading || !invoice}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 dark:bg-primary-600 dark:hover:bg-primary-700 rounded-xl shadow-sm transition-all disabled:opacity-50"
              >
                <FiDownload className="w-4 h-4" />
                <span>{downloading ? 'Downloading...' : 'Download PDF'}</span>
              </button>

              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Close"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Content / Printable Area */}
          <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-gray-800 dark:text-gray-200 print:p-0 print:overflow-visible">
            {loading ? (
              <div className="py-20 text-center space-y-3">
                <div className="inline-block animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading invoice details...</p>
              </div>
            ) : !invoice ? (
              <div className="py-16 text-center space-y-2">
                <FiAlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
                <p className="text-base font-semibold text-gray-800 dark:text-gray-200">
                  Invoice unavailable
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  The requested invoice could not be located or generated for this order.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Email Delivery Notice Banner */}
                {invoice.emailDelivery?.sent && (
                  <div className="flex items-center gap-2.5 px-4 py-3 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 print:hidden">
                    <FiMail className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>
                      Official Tax Invoice PDF was emailed to{' '}
                      <strong>{invoice.emailDelivery.recipientEmail || invoice.customer?.email}</strong>
                      {invoice.emailDelivery.sentAt && ` on ${new Date(invoice.emailDelivery.sentAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`}.
                      {invoice.emailDelivery.resendCount > 0 && ` (Resent ${invoice.emailDelivery.resendCount} time${invoice.emailDelivery.resendCount > 1 ? 's' : ''})`}
                    </span>
                  </div>
                )}

                <div id="invoice-printable-content" className="space-y-6">
                {/* Invoice Top Branding & Status Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-200 dark:border-gray-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black tracking-tight text-primary-600 dark:text-primary-400">
                        PLE
                      </span>
                      <span className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 border-l border-gray-300 dark:border-gray-700 pl-2">
                        Marketplace
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Multi-Vendor Commercial Platform
                    </p>
                    <div className="mt-2.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${orderTypeInfo.badgeClass}`}
                      >
                        <span className="w-2 h-2 rounded-full bg-current" />
                        {orderTypeInfo.label}
                      </span>
                    </div>
                  </div>

                  <div className="text-left sm:text-right space-y-1">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase ${
                        invoice.status === 'paid'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                          : invoice.status === 'cancelled'
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                      }`}
                    >
                      {invoice.status === 'paid' ? (
                        <FiCheckCircle className="w-3.5 h-3.5" />
                      ) : invoice.status === 'cancelled' ? (
                        <FiAlertCircle className="w-3.5 h-3.5" />
                      ) : (
                        <FiClock className="w-3.5 h-3.5" />
                      )}
                      {invoice.status?.toUpperCase() || 'ISSUED'}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Date: {new Date(invoice.invoiceDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Bill To / Ship To & Invoice Meta Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Customer / Billing Details */}
                  <div className="p-4 rounded-xl bg-gray-50/80 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      <FiTruck className="w-3.5 h-3.5 text-primary-500" />
                      <span>Billed & Shipped To</span>
                    </div>
                    <p className="font-bold text-sm text-gray-900 dark:text-white">
                      {invoice.customer?.name || invoice.shippingAddress?.name || 'Customer'}
                    </p>

                    {(invoice.b2bDetails?.companyName || invoice.b2bBulkDetails?.companyName) && (
                      <div className="p-2 rounded bg-purple-50/80 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50 text-purple-900 dark:text-purple-300">
                        <div className="flex items-center gap-1 font-semibold">
                          <FiBriefcase className="w-3 h-3 text-purple-600" />
                          <span>{invoice.b2bBulkDetails?.companyName || invoice.b2bDetails?.companyName}</span>
                        </div>
                        {(invoice.b2bBulkDetails?.gstNumber || invoice.b2bDetails?.gstNumber) && (
                          <p className="text-[11px] mt-0.5">
                            <span className="font-semibold">GSTIN:</span> {invoice.b2bBulkDetails?.gstNumber || invoice.b2bDetails?.gstNumber}
                          </p>
                        )}
                      </div>
                    )}

                    <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                      {invoice.shippingAddress?.address && `${invoice.shippingAddress.address}, `}
                      {invoice.shippingAddress?.city} {invoice.shippingAddress?.state}{' '}
                      {invoice.shippingAddress?.zipCode}
                    </p>
                    {invoice.customer?.phone && (
                      <p className="text-gray-600 dark:text-gray-400">
                        Phone: <span className="text-gray-800 dark:text-gray-200">{invoice.customer.phone}</span>
                      </p>
                    )}
                    {invoice.customer?.email && (
                      <p className="text-gray-600 dark:text-gray-400">
                        Email: <span className="text-gray-800 dark:text-gray-200">{invoice.customer.email}</span>
                      </p>
                    )}
                  </div>

                  {/* Invoice / Order Meta */}
                  <div className="p-4 rounded-xl bg-gray-50/80 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 space-y-2">
                    <div className="font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Invoice Reference
                    </div>
                    <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                      <span className="text-gray-500 dark:text-gray-400">Invoice Number:</span>
                      <span className="font-mono font-bold text-gray-900 dark:text-white">
                        {invoice.invoiceNumber}
                      </span>

                      <span className="text-gray-500 dark:text-gray-400">Order ID:</span>
                      <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">
                        {invoice.orderNumber}
                      </span>

                      <span className="text-gray-500 dark:text-gray-400">Order Type:</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {orderTypeInfo.title}
                      </span>

                      <span className="text-gray-500 dark:text-gray-400">Payment Method:</span>
                      <span className="font-semibold uppercase text-gray-800 dark:text-gray-200">
                        {invoice.payment?.method || 'N/A'}
                      </span>

                      <span className="text-gray-500 dark:text-gray-400">Payment Status:</span>
                      <span
                        className={`font-semibold uppercase ${
                          ['paid', 'captured', 'success'].includes(invoice.payment?.status)
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {invoice.payment?.status || 'PENDING'}
                      </span>

                      {invoice.payment?.transactionId && (
                        <>
                          <span className="text-gray-500 dark:text-gray-400">Transaction ID:</span>
                          <span className="font-mono text-[11px] truncate text-gray-700 dark:text-gray-300">
                            {invoice.payment.transactionId}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contextual Order Type Banner */}
                {invoice.orderType === 'product_request' && (
                  <div className="p-4 rounded-xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 space-y-2">
                    <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                      <FiLayers className="w-4 h-4 text-amber-600" />
                      <span>Origin: Product Request Order</span>
                    </div>
                    <p className="text-[11px] text-amber-700 dark:text-amber-300">
                      This purchase originated from a custom Product Request workflow.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-amber-200/60 dark:border-amber-800/40 text-[11px]">
                      <div>
                        <span className="text-amber-600 dark:text-amber-400 block font-medium">Request Ref ID:</span>
                        <span className="font-mono font-bold">{invoice.productRequestDetails?.requestId || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-amber-600 dark:text-amber-400 block font-medium">Category:</span>
                        <span className="font-semibold">{invoice.productRequestDetails?.category || 'General'}</span>
                      </div>
                      <div>
                        <span className="text-amber-600 dark:text-amber-400 block font-medium">Requested Qty:</span>
                        <span className="font-semibold">{invoice.productRequestDetails?.requestedQuantity || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-amber-600 dark:text-amber-400 block font-medium">Agreed Final Qty:</span>
                        <span className="font-semibold">{invoice.productRequestDetails?.agreedQuantity || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {invoice.orderType === 'rfq' && (
                  <div className="p-4 rounded-xl bg-teal-50/90 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/60 text-xs text-teal-900 dark:text-teal-200 space-y-2">
                    <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300">
                      <FiTag className="w-4 h-4 text-teal-600" />
                      <span>Origin: RFQ Order</span>
                    </div>
                    <p className="text-[11px] text-teal-700 dark:text-teal-300">
                      This purchase originated from a custom Request For Quotation (RFQ) negotiation.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-teal-200/60 dark:border-teal-800/40 text-[11px]">
                      <div>
                        <span className="text-teal-600 dark:text-teal-400 block font-medium">RFQ Ref ID:</span>
                        <span className="font-mono font-bold">{invoice.rfqDetails?.rfqId || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-teal-600 dark:text-teal-400 block font-medium">Quoted Price:</span>
                        <span className="font-mono font-semibold">{invoice.rfqDetails?.quotedPrice ? formatPrice(invoice.rfqDetails.quotedPrice) : 'Negotiated'}</span>
                      </div>
                      <div>
                        <span className="text-teal-600 dark:text-teal-400 block font-medium">Agreed Qty:</span>
                        <span className="font-semibold">{invoice.rfqDetails?.agreedQuantity || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-teal-600 dark:text-teal-400 block font-medium">Terms:</span>
                        <span className="truncate block">{invoice.rfqDetails?.terms || 'Standard RFQ Terms'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {invoice.orderType === 'b2b' && (
                  <div className="p-4 rounded-xl bg-purple-50/90 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 text-xs text-purple-900 dark:text-purple-200 space-y-2">
                    <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-purple-800 dark:text-purple-300">
                      <FiBriefcase className="w-4 h-4 text-purple-600" />
                      <span>Origin: B2B / Bulk Order</span>
                    </div>
                    <p className="text-[11px] text-purple-700 dark:text-purple-300">
                      Commercial wholesale purchase with enterprise billing and GST input tax credit.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-purple-200/60 dark:border-purple-800/40 text-[11px]">
                      <div>
                        <span className="text-purple-600 dark:text-purple-400 block font-medium">Company Name:</span>
                        <span className="font-semibold truncate block">{invoice.b2bBulkDetails?.companyName || invoice.b2bDetails?.companyName || 'Corporate Client'}</span>
                      </div>
                      <div>
                        <span className="text-purple-600 dark:text-purple-400 block font-medium">GSTIN:</span>
                        <span className="font-mono font-bold">{invoice.b2bBulkDetails?.gstNumber || invoice.b2bDetails?.gstNumber || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-purple-600 dark:text-purple-400 block font-medium">Total Bulk Units:</span>
                        <span className="font-bold">{invoice.b2bBulkDetails?.totalBulkQuantity || 'Bulk'} units</span>
                      </div>
                      <div>
                        <span className="text-purple-600 dark:text-purple-400 block font-medium">Pricing Tier:</span>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">Wholesale / Bulk Slab</span>
                      </div>
                    </div>
                  </div>
                )}

                {(!invoice.orderType || invoice.orderType === 'b2c') && (
                  <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-300 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FiShoppingBag className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="font-semibold">B2C Retail Purchase</span>
                      <span className="text-gray-400">•</span>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400">Standard direct-to-consumer fulfillment</span>
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 font-semibold text-blue-800 dark:text-blue-200">
                      Standard B2C
                    </span>
                  </div>
                )}

                {/* Line Items Table */}
                <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-100/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 font-bold uppercase tracking-wider border-b border-gray-200 dark:border-gray-800">
                        <tr>
                          <th className="py-3 px-4">#</th>
                          <th className="py-3 px-4">Item Details</th>
                          <th className="py-3 px-3 text-center">GST %</th>
                          <th className="py-3 px-3 text-center">Qty</th>
                          <th className="py-3 px-4 text-right">Unit Price</th>
                          <th className="py-3 px-4 text-right">Tax (GST)</th>
                          <th className="py-3 px-4 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                        {(invoice.items || []).map((item, idx) => {
                          const itemTotal = item.totalAmount || item.price * item.quantity;
                          return (
                            <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                              <td className="py-3 px-4 font-mono text-gray-400">{idx + 1}</td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-gray-900 dark:text-white">
                                  {item.name}
                                </div>
                                {item.variantKey && (
                                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                    Variant: {item.variantKey}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center font-mono">
                                {item.gstRate !== undefined ? `${item.gstRate}%` : '18%'}
                              </td>
                              <td className="py-3 px-3 text-center font-semibold">
                                {item.quantity || 1}
                              </td>
                              <td className="py-3 px-4 text-right font-mono">
                                {formatPrice(item.price)}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-gray-500 dark:text-gray-400">
                                {formatPrice(item.gstAmount || 0)}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-gray-900 dark:text-white">
                                {formatPrice(itemTotal)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Bottom Section: Role Financials & Totals */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                  {/* Left Column: Role-specific financial card */}
                  <div>
                    {role === 'admin' && invoice.roleScope === 'admin' && (
                      <div className="p-4 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 space-y-2 text-xs">
                        <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300">
                          <FiShield className="w-3.5 h-3.5 text-blue-600" />
                          <span>Admin Financial Audit</span>
                        </div>
                        <div className="space-y-1 text-gray-700 dark:text-gray-300">
                          <div className="flex justify-between">
                            <span>Total Platform Commission:</span>
                            <span className="font-bold text-blue-700 dark:text-blue-400 font-mono">
                              {formatPrice(invoice.financialSummary?.totalPlatformCommission || 0)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Total Vendor Payout:</span>
                            <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                              {formatPrice(invoice.financialSummary?.totalSellerEarnings || 0)}
                            </span>
                          </div>
                          <div className="flex justify-between text-[11px] text-gray-500">
                            <span>Payment Gateway:</span>
                            <span>{invoice.payment?.gateway || 'Razorpay'}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {role === 'vendor' && invoice.sellerInfo && (
                      <div className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 space-y-2 text-xs">
                        <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
                          <FiBriefcase className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Seller Settlement Summary</span>
                        </div>
                        <div className="space-y-1 text-gray-700 dark:text-gray-300">
                          <div className="flex justify-between">
                            <span>Store:</span>
                            <span className="font-semibold">{invoice.sellerInfo.storeName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Fulfillable Value:</span>
                            <span className="font-mono font-semibold">
                              {formatPrice(invoice.sellerInfo.total)}
                            </span>
                          </div>
                          <div className="flex justify-between text-rose-600 dark:text-rose-400">
                            <span>Platform Fee ({invoice.sellerInfo.commissionRate}%):</span>
                            <span className="font-mono">
                              -{formatPrice(invoice.sellerInfo.commissionAmount)}
                            </span>
                          </div>
                          <div className="flex justify-between border-t border-emerald-200 dark:border-emerald-800/60 pt-1 font-bold text-emerald-800 dark:text-emerald-300">
                            <span>Net Payable to You:</span>
                            <span className="font-mono text-sm">
                              {formatPrice(invoice.sellerInfo.sellerPayableAmount)}
                            </span>
                          </div>
                          <div className="flex justify-between text-[11px] text-gray-500 mt-1">
                            <span>Settlement Status:</span>
                            <span className="uppercase font-semibold text-gray-700 dark:text-gray-300">
                              {invoice.sellerInfo.settlementStatus || 'PENDING'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {role === 'customer' && (
                      <div className="p-4 rounded-xl bg-gray-50/60 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                        <p className="font-semibold text-gray-700 dark:text-gray-300">Terms & Information:</p>
                        <p>• All prices include applicable Goods and Services Tax (GST).</p>
                        <p>• This is a computer-generated tax invoice that requires no physical signature.</p>
                        <p>• For return or warranty queries, visit your Orders page or contact support.</p>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Financial Summary Table */}
                  <div className="p-4 rounded-xl bg-gray-50/90 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 space-y-2 text-xs">
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>Subtotal:</span>
                      <span className="font-mono text-gray-900 dark:text-white">
                        {formatPrice(invoice.financialSummary?.subtotal || 0)}
                      </span>
                    </div>

                    {(invoice.financialSummary?.discount > 0 || invoice.financialSummary?.couponDiscount > 0) && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                        <span>Discount / Coupons:</span>
                        <span className="font-mono">
                          -{formatPrice(
                            (invoice.financialSummary.discount || 0) +
                              (invoice.financialSummary.couponDiscount || 0)
                          )}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>Total Tax (GST):</span>
                      <span className="font-mono text-gray-900 dark:text-white">
                        {formatPrice(invoice.financialSummary?.tax || 0)}
                      </span>
                    </div>

                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>Shipping & Handling:</span>
                      <span className="font-mono text-gray-900 dark:text-white">
                        {formatPrice(invoice.financialSummary?.shipping || 0)}
                      </span>
                    </div>

                    <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex justify-between text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                      <span>Grand Total:</span>
                      <span className="font-mono text-primary-600 dark:text-primary-400">
                        {formatPrice(invoice.financialSummary?.grandTotal || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Note */}
                <div className="text-center pt-4 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-400">
                  Thank you for your business! PLE Marketplace • Official Tax Invoice
                </div>
              </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default InvoiceModal;
