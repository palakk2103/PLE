import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FiPackage, FiMapPin, FiClock, FiCheckCircle, FiXCircle, FiNavigation, FiSearch } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import PageTransition from '../../../shared/components/PageTransition';
import { formatPrice } from '../../../shared/utils/helpers';
import toast from 'react-hot-toast';
import { useReturnStore } from '../../../shared/store/returnStore';

const ReturnPickups = () => {
  const navigate = useNavigate();
  const { returnRequests, fetchReturnRequests, updateReturnStatus, isLoading } = useReturnStore();
  const [filter, setFilter] = useState('all'); // all, requested, assigned, picked_up
  const [searchQuery, setSearchQuery] = useState('');

  // The backend has no rider-scoped return-pickup API yet (returns are handled by vendor/admin),
  // and the shared return store would call the *customer* endpoint with a rider token (always 403).
  // So we don't fetch here; the page shows its normal "no pickup assignments" state.

  const handleAssignPickup = async (reqId) => {
    try {
      const success = await updateReturnStatus(reqId, {
        status: 'Pickup Scheduled',
        adminNote: 'Pickup scheduled by delivery agent.'
      });
      if (success) {
        toast.success('Pickup assigned to you');
        fetchReturnRequests();
      }
    } catch (e) {
      toast.error('Failed to assign pickup');
    }
  };

  const handleConfirmPickedUp = async (reqId) => {
    try {
      const success = await updateReturnStatus(reqId, {
        status: 'Picked Up',
        adminNote: 'Package picked up by delivery agent.'
      });
      if (success) {
        toast.success('Package marked as picked up');
        // Instantly transition to Refund Initiated for rich UX representation
        setTimeout(() => {
          updateReturnStatus(reqId, {
            status: 'Refund Initiated',
            refundStatus: 'Processing',
            adminNote: 'Refund has been initiated.'
          });
        }, 1500);
        fetchReturnRequests();
      }
    } catch (e) {
      toast.error('Failed to update pickup status');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Request Submitted':
      case 'Under Review':
      case 'Approved':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Pickup Scheduled':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Picked Up':
      case 'Refund Initiated':
      case 'Refund Completed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'Rejected':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  // Filter requests that are relevant for pickups (must be Approved, Pickup Scheduled, or Picked Up)
  const pickupRequests = useMemo(() => {
    return returnRequests.filter(req => {
      const status = req.status;
      // Allow delivery agents to view Approved requests (which are ready for pickup request) or active pickups
      return ['Approved', 'Pickup Scheduled', 'Picked Up'].includes(status);
    });
  }, [returnRequests]);

  const filteredPickups = useMemo(() => {
    return pickupRequests.filter(req => {
      // 1. Tab Filter
      if (filter !== 'all') {
        if (filter === 'requested' && req.status !== 'Approved') return false;
        if (filter === 'assigned' && req.status !== 'Pickup Scheduled') return false;
        if (filter === 'picked_up' && req.status !== 'Picked Up') return false;
      }

      // 2. Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const idMatch = String(req.id || '').toLowerCase().includes(q);
        const orderMatch = String(req.orderId || '').toLowerCase().includes(q);
        const custMatch = String(req.customer?.name || '').toLowerCase().includes(q);
        return idMatch || orderMatch || custMatch;
      }

      return true;
    });
  }, [pickupRequests, filter, searchQuery]);

  return (
    <PageTransition>
      <div className="px-4 py-6 space-y-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Return Pickups</h1>
            <p className="text-xs text-gray-500">Manage customer return packages & collections</p>
          </div>
          <span className="text-xs bg-primary-50 text-primary-700 px-3 py-1.5 rounded-full font-bold border border-primary-100">
            {filteredPickups.length} Pickups Listed
          </span>
        </motion.div>

        {/* Filter Status Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex gap-2 overflow-x-auto pb-2 border-b border-gray-100"
        >
          {[
            { id: 'all', label: 'All Pickups' },
            { id: 'requested', label: 'Requested Collection' },
            { id: 'assigned', label: 'Scheduled/Assigned' },
            { id: 'picked_up', label: 'Picked Up' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                filter === tab.id
                  ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
        >
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiSearch className="text-gray-400" />
            </span>
            <input
              type="text"
              placeholder="Search by Return ID, order ID, customer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2.5 w-full bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all text-gray-800"
            />
          </div>
        </motion.div>

        {/* Pickups List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12 text-gray-600 text-sm">
              Loading pickups queue...
            </div>
          ) : filteredPickups.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <FiPackage className="text-gray-400 text-5xl mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No pickup assignments found.</p>
              <p className="text-xs text-gray-400 mt-1">Check back later for new return pickup requests</p>
            </div>
          ) : (
            filteredPickups.map((pickup, index) => (
              <motion.div
                key={pickup.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 hover:shadow-md hover:border-primary-200 transition-all space-y-3"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <FiPackage className="text-amber-500" />
                      <p className="font-bold text-gray-800 text-xs">Return ID: {pickup.id}</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-700 mt-1">Customer: {pickup.customer?.name}</p>
                    <p className="text-xs text-gray-500">Phone: {pickup.customer?.phone || 'N/A'}</p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(pickup.status)}`}>
                    {pickup.status}
                  </span>
                </div>

                {/* Reason */}
                <div className="p-2.5 bg-red-50/50 rounded-xl border border-red-100 text-xs">
                  <span className="font-bold text-red-800">Reason: </span>
                  <span className="text-gray-700">{pickup.reason}</span>
                </div>

                {/* Info details */}
                <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                  <div className="flex gap-4">
                    <span>Order: <strong>{pickup.orderId}</strong></span>
                    <span>Items: <strong>{pickup.items?.length || 0}</strong></span>
                  </div>
                  <span className="font-bold text-primary-600 text-sm">Value: {formatPrice(pickup.refundAmount || 0)}</span>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  {pickup.status === 'Approved' && (
                    <button
                      onClick={() => handleAssignPickup(pickup.id)}
                      className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 text-white py-2.5 rounded-xl font-semibold text-xs shadow-sm hover:from-emerald-700 hover:to-green-700 transition-all"
                    >
                      Assign to Me (Scheduled)
                    </button>
                  )}
                  {pickup.status === 'Pickup Scheduled' && (
                    <button
                      onClick={() => handleConfirmPickedUp(pickup.id)}
                      className="flex-1 bg-gradient-to-r from-primary-600 to-primary-700 text-white py-2.5 rounded-xl font-semibold text-xs shadow-sm hover:from-primary-700 hover:to-primary-800 transition-all"
                    >
                      Confirm Package Picked Up
                    </button>
                  )}
                  {pickup.status === 'Picked Up' && (
                    <div className="flex-1 text-center py-2.5 bg-green-50 text-green-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1">
                      <FiCheckCircle />
                      Package Picked Up
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </PageTransition>
  );
};

export default ReturnPickups;
