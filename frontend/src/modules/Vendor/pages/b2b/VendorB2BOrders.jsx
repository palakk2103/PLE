import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiFileText, 
  FiSearch, 
  FiEye, 
  FiPrinter, 
  FiDownload, 
  FiX, 
  FiBriefcase, 
  FiUser, 
  FiTruck, 
  FiDollarSign, 
  FiFile,
  FiCalendar
} from 'react-icons/fi';
import DataTable from '../../../Admin/components/DataTable';
import ExportButton from '../../../Admin/components/ExportButton';
import Badge from '../../../../shared/components/Badge';
import { formatPrice } from '../../../../shared/utils/helpers';
import api from '../../../../shared/utils/api';
import toast from 'react-hot-toast';

const VendorB2BOrders = () => {
  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPo, setSelectedPo] = useState(null);

  const fetchPOs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/vendor/b2b/purchase-orders');
      if (res && res.data) {
        setPos(res.data);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load Purchase Orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPOs();
  }, []);

  const filteredPos = useMemo(() => {
    if (!searchQuery) return pos;
    const q = searchQuery.toLowerCase();
    return pos.filter(
      (po) =>
        po.poNumber.toLowerCase().includes(q) ||
        po.vendorDetails.storeName.toLowerCase().includes(q) ||
        po.productDetails.name.toLowerCase().includes(q) ||
        (po.rfqId?.rfqId || '').toLowerCase().includes(q)
    );
  }, [pos, searchQuery]);

  const handlePrint = () => {
    window.print();
  };

  const columns = [
    {
      key: 'poNumber',
      label: 'PO Number',
      sortable: true,
      render: (value) => <span className="font-mono font-bold text-gray-900">{value}</span>
    },
    {
      key: 'rfqId',
      label: 'RFQ Ref',
      sortable: true,
      render: (value) => <span className="font-mono text-xs font-semibold text-gray-550">{value?.rfqId || 'N/A'}</span>
    },
    {
      key: 'companyDetails',
      label: 'Sourcing Buyer',
      sortable: true,
      render: (value) => (
        <div>
          <span className="font-bold text-gray-800 text-xs bg-gray-100 px-2 py-0.5 rounded inline-block">
            {value.name}
          </span>
          <span className="text-[10px] text-gray-400 block mt-0.5">{value.email}</span>
        </div>
      )
    },
    {
      key: 'productDetails',
      label: 'Product Details',
      sortable: false,
      render: (value) => (
        <div>
          <p className="font-semibold text-gray-800 text-xs truncate max-w-[200px]" title={value.name}>
            {value.name}
          </p>
          <span className="text-[10px] text-gray-400 font-bold uppercase">{value.qty.toLocaleString()} units</span>
        </div>
      )
    },
    {
      key: 'pricing',
      label: 'Total Sourcing Value',
      sortable: true,
      render: (value) => <span className="font-extrabold text-[#C07A3D] text-sm">{formatPrice(value.total)}</span>
    },
    {
      key: 'createdAt',
      label: 'Issued Date',
      sortable: true,
      render: (value) => (
        <span className="text-xs text-gray-500 font-medium">
          {new Date(value).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          })}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => {
        let variant = 'success';
        if (value === 'Cancelled') variant = 'danger';
        return <Badge variant={variant}>{value}</Badge>;
      }
    },
    {
      key: 'paymentStatus',
      label: 'Payment',
      sortable: true,
      render: (value, row) => {
        const val = value || 'Unpaid';
        let variant = 'warning';
        if (val === 'Paid') variant = 'success';
        if (val === 'Pending') variant = 'info';
        return (
          <div className="flex flex-col items-start gap-0.5">
            <Badge variant={variant}>{val}</Badge>
            {val === 'Paid' && row.paymentMethod && (
              <span className="text-[9px] font-bold text-gray-450 uppercase tracking-wider font-mono">
                via {row.paymentMethod}
              </span>
            )}
          </div>
        );
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setSelectedPo(row)}
            className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold"
            title="View Purchase Order Sheet"
          >
            <FiEye className="w-3.5 h-3.5" /> View PO
          </button>
        </div>
      )
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-[1400px] mx-auto"
    >
      <div className="print:hidden space-y-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <FiFileText className="text-[#C07A3D]" /> Purchase Orders (PO)
          </h1>
          <p className="text-sm text-gray-500">
            Auto-generated wholesale procurement contracts with specific vendor agreements.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row flex-wrap items-center gap-4 mb-6 pb-6 border-b border-gray-100">
            <div className="relative flex-1 w-full sm:min-w-[240px]">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by PO Number, Vendor, Item..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C07A3D] text-sm transition-all"
              />
            </div>

            <div className="w-full sm:w-auto ml-auto">
              <ExportButton
                data={filteredPos}
                headers={[
                  { label: 'PO Number', accessor: (row) => row.poNumber },
                  { label: 'RFQ Ref', accessor: (row) => row.rfqId?.rfqId },
                  { label: 'Buyer Company', accessor: (row) => row.companyDetails.name },
                  { label: 'Buyer Contact', accessor: (row) => row.companyDetails.email },
                  { label: 'Product Name', accessor: (row) => row.productDetails.name },
                  { label: 'Quantity', accessor: (row) => row.productDetails.qty },
                  { label: 'Unit Rate', accessor: (row) => row.productDetails.unitPrice },
                  { label: 'Subtotal', accessor: (row) => row.pricing.subtotal },
                  { label: 'Tax', accessor: (row) => row.pricing.tax },
                  { label: 'Total Value', accessor: (row) => row.pricing.total },
                  { label: 'Issued Date', accessor: (row) => row.createdAt }
                ]}
                filename="b2b_purchase_orders"
              />
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-500 font-bold">Loading Purchase Orders...</p>
            </div>
          ) : filteredPos.length > 0 ? (
            <DataTable
              data={filteredPos}
              columns={columns}
              pagination={true}
              itemsPerPage={10}
              onRowClick={(row) => setSelectedPo(row)}
            />
          ) : (
            <div className="text-center py-16 text-gray-450 border border-dashed border-gray-200 rounded-2xl">
              <FiFile className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <h3 className="font-extrabold text-sm text-gray-800">No Purchase Orders Generated</h3>
              <p className="text-xs text-gray-450 mt-1 max-w-[280px] mx-auto">
                Confirming a vendor quotation inside the RFQ details page will automatically generate formal PO sheets here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* PO Viewer Modal */}
      <AnimatePresence>
        {selectedPo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm print:relative print:p-0 print:bg-white print:z-auto">
            {/* Backdrop */}
            <div className="fixed inset-0 print:hidden" onClick={() => setSelectedPo(null)} />
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl relative z-10 border border-gray-150 overflow-hidden print:shadow-none print:border-none print:h-auto print:w-auto"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 print:hidden">
                <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                  <FiFileText className="text-[#C07A3D]" /> Sourcing Purchase Agreement
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrint}
                    className="py-1.5 px-3 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    <FiPrinter /> Print / PDF
                  </button>
                  <button
                    onClick={() => setSelectedPo(null)}
                    className="p-2 hover:bg-gray-150 rounded-xl text-gray-400 hover:text-gray-650"
                  >
                    <FiX className="w-5 h-5" strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              {/* Print Document Content */}
              <div className="po-print-content flex-1 overflow-y-auto p-4 sm:p-8 md:p-12 space-y-6 sm:space-y-8 print:p-0 print:overflow-visible font-sans select-text">
                
                {/* PO Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <span className="text-[10px] font-black uppercase text-[#C07A3D] tracking-widest block">Wholesale Procurement PO</span>
                    <h1 className="text-xl sm:text-2xl font-black text-gray-950 tracking-tight truncate">{selectedPo.poNumber}</h1>
                    <p className="text-xs text-gray-400 font-bold font-mono">Linked RFQ ID: {selectedPo.rfqId?.rfqId}</p>
                  </div>
                  <div className="text-left sm:text-right text-xs">
                    <p className="font-bold text-gray-800">Date Issued:</p>
                    <p className="text-gray-500 font-medium mt-0.5">
                      {new Date(selectedPo.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'long', year: 'numeric'
                      })}
                    </p>
                    <div className="flex flex-wrap gap-1 items-start sm:items-end sm:flex-col pt-1">
                      <Badge variant="success">Document: {selectedPo.status}</Badge>
                      <Badge variant={selectedPo.paymentStatus === 'Paid' ? 'success' : 'warning'}>
                        Payment: {selectedPo.paymentStatus || 'Unpaid'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <hr className="border-gray-150" />

                {/* Company and Vendor Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 text-xs leading-relaxed">
                  {/* Buyer details */}
                  <div className="space-y-2.5 bg-gray-50 p-4 sm:p-5 rounded-2xl border border-gray-100 min-w-0">
                    <h3 className="font-extrabold text-gray-400 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                      <FiBriefcase className="text-[#C07A3D]" /> Sourcing Entity (Bill To)
                    </h3>
                    <div className="font-semibold text-gray-700 space-y-1">
                      <p className="font-black text-gray-900 text-sm truncate">{selectedPo.companyDetails.name}</p>
                      <p className="break-words">{selectedPo.companyDetails.address}</p>
                      <p>Phone: {selectedPo.companyDetails.phone}</p>
                      <p>Email: {selectedPo.companyDetails.email}</p>
                      {selectedPo.companyDetails.gstin && (
                        <p className="pt-1 text-[10px] font-mono font-bold text-[#C07A3D]">GSTIN: {selectedPo.companyDetails.gstin}</p>
                      )}
                    </div>
                  </div>

                  {/* Vendor details */}
                  <div className="space-y-2.5 bg-gray-50 p-4 sm:p-5 rounded-2xl border border-gray-100 min-w-0">
                    <h3 className="font-extrabold text-gray-400 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                      <FiUser className="text-[#C07A3D]" /> Sourced Vendor (Ship From)
                    </h3>
                    <div className="font-semibold text-gray-700 space-y-1">
                      <p className="font-black text-gray-900 text-sm truncate">{selectedPo.vendorDetails.storeName}</p>
                      <p>Representative: {selectedPo.vendorDetails.name}</p>
                      <p>Phone: {selectedPo.vendorDetails.phone}</p>
                      <p>Email: {selectedPo.vendorDetails.email}</p>
                    </div>
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Line items</h3>
                  <div className="border border-gray-150 rounded-2xl overflow-x-auto text-xs scrollbar-admin">
                    <table className="w-full text-left border-collapse min-w-[480px]">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 font-bold text-gray-650">
                          <th className="p-3 sm:p-4">Item Name / Reference</th>
                          <th className="p-3 sm:p-4 text-center">Quantity</th>
                          <th className="p-3 sm:p-4 text-right">Contract Rate</th>
                          <th className="p-3 sm:p-4 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="font-semibold text-gray-800 border-b border-gray-100 last:border-none">
                          <td className="p-3 sm:p-4">
                            <span className="font-bold text-gray-900 text-sm block">{selectedPo.productDetails.name}</span>
                            <span className="text-[10px] text-gray-400 mt-0.5">Ref ID: {selectedPo.productId || 'Custom Catalog Item'}</span>
                          </td>
                          <td className="p-3 sm:p-4 text-center text-sm sm:text-base font-black text-gray-800">{selectedPo.productDetails.qty.toLocaleString()}</td>
                          <td className="p-3 sm:p-4 text-right text-sm sm:text-base font-extrabold text-gray-900">{formatPrice(selectedPo.productDetails.unitPrice)}</td>
                          <td className="p-3 sm:p-4 text-right text-sm sm:text-base font-black text-gray-900">{formatPrice(selectedPo.pricing.subtotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Financial Summary & Delivery Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                  {/* Delivery specifications */}
                  <div className="space-y-3.5 text-xs font-semibold text-gray-650">
                    <div className="flex gap-2.5">
                      <FiTruck className="w-4 h-4 text-[#C07A3D] shrink-0 mt-0.5" />
                      <div>
                        <p className="font-extrabold text-[#C07A3D] uppercase text-[9px] tracking-wider">Shipment Destination Address</p>
                        <p className="mt-1 font-bold text-gray-800 leading-relaxed">{selectedPo.deliveryInformation.shippingAddress}</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2.5">
                      <FiCalendar className="w-4 h-4 text-[#C07A3D] shrink-0 mt-0.5" />
                      <div>
                        <p className="font-extrabold text-[#C07A3D] uppercase text-[9px] tracking-wider">Target Sourcing Timeline</p>
                        <p className="mt-1 font-bold text-gray-850">
                          {selectedPo.deliveryInformation.expectedDeliveryDate 
                            ? new Date(selectedPo.deliveryInformation.expectedDeliveryDate).toLocaleDateString('en-IN', {
                                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                              })
                            : 'Flexible / Per Sourcing Bid Terms'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Pricing recap */}
                  <div className="bg-gray-50 rounded-2xl p-6 border border-gray-150 space-y-3.5 text-xs text-gray-650">
                    <div className="flex justify-between">
                      <span className="font-bold">Items subtotal:</span>
                      <span className="font-bold text-gray-900">{formatPrice(selectedPo.pricing.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold">Estimated Sourcing Tax (GST):</span>
                      <span className="font-bold text-gray-900">{formatPrice(selectedPo.pricing.tax || 0)}</span>
                    </div>
                    <hr className="border-gray-200" />
                    <div className="flex justify-between text-base font-black text-gray-900">
                      <span>Total Contract Value:</span>
                      <span className="text-[#C07A3D]">{formatPrice(selectedPo.pricing.total)}</span>
                    </div>
                    {selectedPo.paymentStatus === 'Paid' && selectedPo.paymentDetails && (
                      <div className="mt-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-xs font-semibold text-emerald-900 space-y-1 text-left">
                        <p className="font-bold uppercase text-[9px] tracking-wide text-emerald-800">Simulated Payment Details</p>
                        <p>Status: <span className="font-bold">Success</span></p>
                        <p>Method: <span className="font-bold">{selectedPo.paymentMethod}</span></p>
                        <p>Txn ID: <span className="font-mono font-bold">{selectedPo.paymentDetails.transactionId}</span></p>
                        <p>Paid On: <span className="font-bold">{new Date(selectedPo.paymentDetails.paidAt).toLocaleString('en-IN')}</span></p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sourcing Contract Terms */}
                <div className="border-t border-gray-150 pt-6 space-y-4 text-[10px] text-gray-500 leading-relaxed font-semibold">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div>
                      <p className="font-bold text-gray-700 uppercase">Payment net terms</p>
                      <p className="mt-1">{selectedPo.terms?.paymentTerms || 'NET 30 Days'}</p>
                    </div>
                    <div>
                      <p className="font-bold text-gray-700 uppercase">Fulfillment Terms</p>
                      <p className="mt-1">{selectedPo.terms?.deliveryTerms || 'FOB Destination / Origin'}</p>
                    </div>
                    <div>
                      <p className="font-bold text-gray-700 uppercase">Vendor Warranty</p>
                      <p className="mt-1">{selectedPo.terms?.warranty || '1 Year Standard'}</p>
                    </div>
                  </div>

                  <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 mt-2 text-amber-900">
                    <p className="font-bold uppercase text-[9px] tracking-wide">Purchase Agreement Terms</p>
                    <p className="mt-1 font-medium">
                      {selectedPo.terms?.termsConditions || 'This Purchase Order represents a binding sourcing contract between the B2B Entity and the Vendor. Delivery timeline commitments, quality tolerances, and dispute resolution parameters default to terms agreed upon inside the RFQ selection sheet.'}
                    </p>
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            margin: 0.5in;
            size: A4;
          }
          
          body, html, #root {
            background: white !important;
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
          }
          
          table, tr, td {
            page-break-inside: avoid;
          }
          
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </motion.div>
  );
};

export default VendorB2BOrders;
