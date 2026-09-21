import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiSearch,
  FiEye,
  FiShoppingBag,
} from 'react-icons/fi';
import { motion } from 'framer-motion';
import DataTable from "../../../Admin/components/DataTable";
import ExportButton from "../../../Admin/components/ExportButton";
import Badge from "../../../../shared/components/Badge";
import AnimatedSelect from "../../../Admin/components/AnimatedSelect";
import { formatPrice } from '../../../../shared/utils/helpers';
import { useVendorAuthStore } from '../../store/vendorAuthStore';
import { getAllVendorOrders, updateVendorOrderStatus } from '../../services/vendorService';
import toast from 'react-hot-toast';

const AllOrders = () => {
  const navigate = useNavigate();
  const { vendor } = useVendorAuthStore();
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedOrderType, setSelectedOrderType] = useState('all');

  const vendorId = vendor?.id || vendor?._id;

  useEffect(() => {
    if (!vendorId) return;

    const fetchOrders = async () => {
      setIsLoading(true);
      try {
        const data = await getAllVendorOrders({ limit: 100 });
        setOrders(data?.orders ?? []);
      } catch {
        // errors handled by api.js toast
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, [vendorId]);

  const vendorIdsToMatch = useMemo(() => {
    return [
      vendor?.id?.toString(),
      vendor?._id?.toString(),
      vendor?.shopId?.toString(),
      vendor?.shopId?._id?.toString(),
    ].filter(Boolean);
  }, [vendor]);

  const getMatchingVendorItem = (order) => {
    if (!order?.vendorItems || !Array.isArray(order.vendorItems)) return null;
    return (
      order.vendorItems.find((vi) => {
        const itemVid = (vi.vendorId?._id || vi.vendorId)?.toString();
        return vendorIdsToMatch.includes(itemVid);
      }) || (order.vendorItems.length === 1 ? order.vendorItems[0] : null)
    );
  };

  const filteredOrders = useMemo(() => {
    let filtered = orders;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((order) =>
        order.orderId?.toLowerCase().includes(q) ||
        order._id?.toLowerCase().includes(q)
      );
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter((order) => {
        const vendorItem = getMatchingVendorItem(order);
        const status = (vendorItem?.status ?? order.status ?? '').toLowerCase();
        return status === selectedStatus.toLowerCase();
      });
    }

    if (selectedOrderType !== 'all') {
      filtered = filtered.filter((order) => {
        const type = order.orderType || (order.requestProductId ? 'product_request' : (order.rfqId ? 'rfq' : (order.isB2b ? 'b2b' : 'b2c')));
        return type === selectedOrderType;
      });
    }

    return filtered;
  }, [orders, searchQuery, selectedStatus, selectedOrderType, vendorIdsToMatch]);

  // Get per-vendor subtotal from vendorItems
  const getVendorSubtotal = (order) => {
    const vendorItem = getMatchingVendorItem(order);
    return vendorItem?.subtotal ?? order.total ?? order.totalAmount ?? 0;
  };

  const getOrderStatus = (order) => {
    const vendorItem = getMatchingVendorItem(order);
    return vendorItem?.status ?? order.status ?? 'pending';
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await updateVendorOrderStatus(orderId, newStatus);
      setOrders((prev) =>
        prev.map((o) => {
          if ((o.orderId ?? o._id) !== orderId) return o;
          return {
            ...o,
            vendorItems: o.vendorItems?.map((vi) => {
              const itemVid = (vi.vendorId?._id || vi.vendorId)?.toString();
              return vendorIdsToMatch.includes(itemVid)
                ? { ...vi, status: newStatus }
                : vi;
            }),
            status: newStatus,
          };
        })
      );
      toast.success('Order status updated');
    } catch {
      // errors handled by api.js toast
    }
  };

  const columns = [
    {
      key: 'orderId',
      label: 'Order ID',
      sortable: true,
      render: (value, row) => (
        <span className="font-semibold text-gray-800">
          {value ?? row._id}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      render: (value) => (
        <span className="text-sm text-gray-600">
          {value ? new Date(value).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      key: 'items',
      label: 'Items',
      sortable: false,
      render: (_, row) => {
        const vendorItem = getMatchingVendorItem(row);
        const count = vendorItem?.items?.length ?? row.items?.length ?? row.vendorItems?.length ?? 0;
        return (
          <span className="text-sm text-gray-700">{count} item(s)</span>
        );
      },
    },
    {
      key: 'totalAmount',
      label: 'Amount',
      sortable: true,
      render: (_, row) => (
        <span className="font-semibold text-gray-800">
          {formatPrice(getVendorSubtotal(row))}
        </span>
      ),
    },
    {
      key: 'orderType',
      label: 'Type',
      sortable: true,
      render: (_, row) => {
        const type = row.orderType || (row.requestProductId ? 'product_request' : (row.rfqId ? 'rfq' : (row.isB2b ? 'b2b' : 'b2c')));
        const badges = {
          b2c: { label: 'B2C', variant: 'success' },
          b2b: { label: 'B2B', variant: 'warning' },
          product_request: { label: 'PRODUCT REQ', variant: 'info' },
          rfq: { label: 'RFQ', variant: 'purple' },
        };
        const b = badges[type] || badges.b2c;
        return (
          <Badge variant={b.variant}>
            {b.label}
          </Badge>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_, row) => {
        const status = getOrderStatus(row);
        return (
          <Badge
            variant={
              status === 'delivered'
                ? 'success'
                : status === 'pending'
                  ? 'warning'
                  : status === 'cancelled' || status === 'canceled'
                    ? 'error'
                    : 'info'
            }>
            {status?.toUpperCase() || 'N/A'}
          </Badge>
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_, row) => (
        <button
          onClick={() => navigate(`/vendor/orders/${row.orderId ?? row._id}`)}
          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
          <FiEye />
        </button>
      ),
    },
  ];

  if (!vendorId) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Please log in to view orders</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 dark:text-white mb-1">
            All Orders
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
            View and manage all your orders
          </p>
        </div>
        <button
          onClick={() => navigate('/vendor/orders/bulk-orders')}
          className="flex items-center justify-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition flex-shrink-0"
        >
          <FiShoppingBag className="w-4 h-4" />
          <span>+ Bulk Orders</span>
        </button>
      </div>

      <div className="bg-white dark:bg-[#1A1A1A] rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-white/5 min-w-0">
        {/* Filters */}
        <div className="mb-6 pb-6 border-b border-gray-200 dark:border-white/5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative col-span-1 sm:col-span-2">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Order ID..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-[#222] border border-gray-200 dark:border-white/10 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs sm:text-sm"
              />
            </div>

            <div>
              <AnimatedSelect
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'processing', label: 'Processing' },
                  { value: 'shipped', label: 'Shipped' },
                  { value: 'delivered', label: 'Delivered' },
                  { value: 'cancelled', label: 'Cancelled' },
                ]}
                className="w-full"
              />
            </div>

            <div>
              <AnimatedSelect
                value={selectedOrderType}
                onChange={(e) => setSelectedOrderType(e.target.value)}
                options={[
                  { value: 'all', label: 'All Types' },
                  { value: 'b2c', label: 'B2C Orders' },
                  { value: 'b2b', label: 'B2B Wholesale' },
                  { value: 'product_request', label: 'Product Request' },
                  { value: 'rfq', label: 'RFQ Orders' },
                ]}
                className="w-full"
              />
            </div>

            <div>
              <ExportButton
                data={filteredOrders}
                headers={[
                  { label: 'Order ID', accessor: (row) => row.orderId ?? row._id },
                  { label: 'Date', accessor: (row) => row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—' },
                  { label: 'Amount', accessor: (row) => formatPrice(getVendorSubtotal(row)) },
                  { label: 'Status', accessor: (row) => getOrderStatus(row) },
                ]}
                filename="vendor-orders"
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <p className="text-center py-12 text-gray-400">Loading orders...</p>
        ) : filteredOrders.length > 0 ? (
          <DataTable
            data={filteredOrders}
            columns={columns}
            pagination={true}
            itemsPerPage={10}
            onRowClick={(row) => navigate(`/vendor/orders/${row.orderId ?? row._id}`)}
          />
        ) : (
          <div className="text-center py-12">
            <FiShoppingBag className="text-4xl text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-2">No orders found</p>
            <p className="text-sm text-gray-400">
              {searchQuery || selectedStatus !== 'all'
                ? 'Try adjusting your filters'
                : 'Orders containing your products will appear here'}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default AllOrders;
