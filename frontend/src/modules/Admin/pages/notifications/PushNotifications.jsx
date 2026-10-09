import { useState, useEffect, useCallback } from 'react';
import { 
  FiSend, 
  FiBell, 
  FiUsers, 
  FiTarget, 
  FiLink, 
  FiImage, 
  FiCheckCircle, 
  FiAlertCircle, 
  FiClock, 
  FiRefreshCw, 
  FiSmartphone, 
  FiTag, 
  FiLayers 
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import AnimatedSelect from '../../components/AnimatedSelect';
import toast from 'react-hot-toast';
import api from '../../../../shared/utils/api';

const QUICK_TEMPLATES = [
  {
    label: '🔥 Flat 40% Off',
    title: '🔥 Flash Sale: Flat 40% OFF Today!',
    message: 'Limited time flash sale on all top categories! Grab your favorite products before stocks run out.',
    actionUrl: '/offers',
    target: 'customers',
  },
  {
    label: '🚚 Free Delivery',
    title: '🎉 Free Delivery on All Orders!',
    message: 'Enjoy free delivery across all products today. No minimum order value required!',
    actionUrl: '/offers',
    target: 'customers',
  },
  {
    label: '🎁 Festival Dhamaka',
    title: '✨ Festive Mega Offer is Live!',
    message: 'Celebrate with mega discounts & exclusive cashback. Check out today’s festive specials!',
    actionUrl: '/offers',
    target: 'all',
  },
  {
    label: '📦 Vendor Notice',
    title: '📢 Important Update for Sellers',
    message: 'Please review your active inventory & dispatch orders promptly for the upcoming sale festival.',
    actionUrl: '/vendor/dashboard',
    target: 'vendors',
  },
];

const PushNotifications = () => {
  const [activeTab, setActiveTab] = useState('compose'); // 'compose' | 'history'
  const [isSending, setIsSending] = useState(false);
  const [deliveryResult, setDeliveryResult] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    message: '',
    target: 'all',
    type: 'promotion',
    actionUrl: '/offers',
    imageUrl: '',
  });

  // History state
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);

  const fetchHistory = useCallback(async (page = 1) => {
    setHistoryLoading(true);
    try {
      const res = await api.get(`/admin/notifications/broadcast-history?page=${page}&limit=10`);
      const isSuccess = res?.success || res?.data?.success;
      const payload = res?.data?.history ? res.data : (res?.data || res);
      if (isSuccess) {
        setHistory(payload?.history || []);
        setHistoryTotal(payload?.total || 0);
        setHistoryPage(payload?.page || 1);
      }
    } catch (err) {
      console.warn('Failed to fetch broadcast history:', err?.message);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory(1);
    }
  }, [activeTab, fetchHistory]);

  const applyTemplate = (tpl) => {
    setFormData((prev) => ({
      ...prev,
      title: tpl.title,
      message: tpl.message,
      actionUrl: tpl.actionUrl,
      target: tpl.target,
    }));
    toast.success(`Applied "${tpl.label}" template`);
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!formData.title?.trim() || !formData.message?.trim()) {
      toast.error('Title and Message are required.');
      return;
    }

    setIsSending(true);
    setDeliveryResult(null);

    try {
      const res = await api.post('/admin/notifications/broadcast', {
        title: formData.title.trim(),
        message: formData.message.trim(),
        target: formData.target,
        type: formData.type,
        actionUrl: formData.actionUrl.trim(),
        imageUrl: formData.imageUrl.trim(),
      });

      const isSuccess = res?.success || res?.data?.success;
      if (isSuccess) {
        const stats = res?.data || res;
        setDeliveryResult(stats);
        toast.success(res?.message || 'Notification broadcast dispatched successfully!');
        setFormData({
          title: '',
          message: '',
          target: 'all',
          type: 'promotion',
          actionUrl: '/offers',
          imageUrl: '',
        });
        fetchHistory(1);
      } else {
        toast.error(res?.message || res?.data?.message || 'Failed to dispatch notification');
      }
    } catch (err) {
      console.error('Error sending broadcast:', err);
      toast.error(err?.response?.data?.message || err?.message || 'Failed to send notification broadcast.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <FiBell className="text-emerald-600" />
            Offer & Push Notifications
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Broadcast promotional deals, festival offers & updates to mobile and web users.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('compose')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'compose'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FiSend />
            <span>Send Broadcast</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'history'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FiClock />
            <span>History ({historyTotal})</span>
          </button>
        </div>
      </div>

      {/* Tab: Compose Notification */}
      {activeTab === 'compose' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Form (8 Cols) */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            {/* Quick Templates */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1 mb-3">
                <FiTag className="text-emerald-600" /> Quick Offer Templates
              </span>
              <div className="flex flex-wrap gap-2">
                {QUICK_TEMPLATES.map((tpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    className="px-3 py-1.5 bg-emerald-50 text-emerald-800 text-xs font-medium rounded-lg hover:bg-emerald-100 border border-emerald-200 transition-colors"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Broadcast Form */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <form onSubmit={handleSend} className="space-y-5">
                {/* Notification Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <FiBell className="text-emerald-600" />
                      Notification Title <span className="text-red-500">*</span>
                    </span>
                    <span className="text-xs text-gray-400">{formData.title.length}/65</span>
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. 🔥 Weekend Mega Offer: Flat 50% OFF!"
                    required
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm transition-all"
                  />
                </div>

                {/* Message Body */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center justify-between">
                    <span>
                      Message Body <span className="text-red-500">*</span>
                    </span>
                    <span className="text-xs text-gray-400">{formData.message.length}/200</span>
                  </label>
                  <textarea
                    rows={4}
                    maxLength={240}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Enter the offer details, coupon code, or announcement..."
                    required
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm transition-all resize-none"
                  />
                </div>

                {/* Target Audience & Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                      <FiTarget className="text-emerald-600" /> Target Audience
                    </label>
                    <AnimatedSelect
                      value={formData.target}
                      onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                      options={[
                        { value: 'all', label: 'All Users (Customers, Vendors, Delivery)' },
                        { value: 'customers', label: 'Customers Only' },
                        { value: 'vendors', label: 'Registered Vendors Only' },
                        { value: 'delivery', label: 'Delivery Personnel Only' },
                      ]}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                      <FiLayers className="text-emerald-600" /> Notification Category
                    </label>
                    <AnimatedSelect
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      options={[
                        { value: 'promotion', label: 'Promotion / Offer' },
                        { value: 'system', label: 'System Announcement' },
                      ]}
                    />
                  </div>
                </div>

                {/* Action URL / Deep Link */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                    <FiLink className="text-emerald-600" /> Redirect / Offer Link
                  </label>
                  <input
                    type="text"
                    value={formData.actionUrl}
                    onChange={(e) => setFormData({ ...formData, actionUrl: e.target.value })}
                    placeholder="/offers or /product/123 or https://..."
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm transition-all"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    When clicked on phone or browser, users will be taken directly to this page.
                  </p>
                </div>

                {/* Image / Banner URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                    <FiImage className="text-emerald-600" /> Banner Image URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    placeholder="https://example.com/banner.jpg"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm transition-all"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSending}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl shadow-md hover:shadow-lg disabled:opacity-50 transition-all font-semibold text-sm cursor-pointer"
                >
                  {isSending ? (
                    <>
                      <FiRefreshCw className="animate-spin text-lg" />
                      <span>Sending Broadcast to Devices...</span>
                    </>
                  ) : (
                    <>
                      <FiSend className="text-lg" />
                      <span>Dispatch Broadcast Notification</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Right Live Phone Preview (4-5 Cols) */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <FiSmartphone className="text-emerald-600" /> Device Live Preview
                </span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                  Realtime
                </span>
              </div>

              {/* Mockup Mobile Notification Card */}
              <div className="bg-gradient-to-b from-slate-900 to-slate-800 p-4 rounded-3xl shadow-xl text-white">
                {/* Phone Status Header */}
                <div className="flex items-center justify-between text-[11px] text-gray-400 pb-3 border-b border-gray-700/60 mb-3">
                  <span className="font-semibold text-gray-300">9:41 AM</span>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                    <span>5G • 100%</span>
                  </div>
                </div>

                {/* The Push Notification Banner */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/15 space-y-2 shadow-inner">
                  {/* App Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-lg bg-emerald-500 flex items-center justify-center font-black text-[11px] text-white shadow-sm">
                        PLE
                      </div>
                      <span className="text-xs font-semibold text-gray-100 tracking-wide">
                        PLE Marketplace
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400">now</span>
                  </div>

                  {/* Title & Body */}
                  <div>
                    <h4 className="text-sm font-bold text-white line-clamp-1">
                      {formData.title || 'Special Offer Title Here'}
                    </h4>
                    <p className="text-xs text-gray-200 mt-0.5 line-clamp-3 leading-relaxed">
                      {formData.message || 'Notification description and offer details will display here...'}
                    </p>
                  </div>

                  {/* Optional Image */}
                  {formData.imageUrl && (
                    <div className="rounded-lg overflow-hidden border border-white/10 mt-2 max-h-32 bg-black/40">
                      <img
                        src={formData.imageUrl}
                        alt="Offer banner"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                  )}

                  {/* Action Link Tag */}
                  {formData.actionUrl && (
                    <div className="pt-1 flex items-center gap-1 text-[10px] text-emerald-300 font-medium">
                      <FiLink className="text-[10px]" />
                      <span>Opens: {formData.actionUrl}</span>
                    </div>
                  )}
                </div>

                {/* Footer notes */}
                <p className="text-[11px] text-gray-400 text-center mt-4">
                  Delivered as Lockscreen Push & In-App Bell Notification
                </p>
              </div>

              {/* Delivery info box */}
              {deliveryResult && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1.5"
                >
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                    <FiCheckCircle className="text-base text-emerald-600" />
                    Last Broadcast Dispatched!
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-gray-700">
                    <div>
                      Recipients In-App: <span className="font-bold">{deliveryResult.recipientsTargeted}</span>
                    </div>
                    <div>
                      Devices Reached: <span className="font-bold">{deliveryResult.pushSuccessCount}</span>
                    </div>
                  </div>
                  {deliveryResult.pushWarning && (
                    <div className="text-[11px] text-amber-700 flex items-center gap-1 mt-1">
                      <FiAlertCircle /> {deliveryResult.pushWarning}
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Broadcast History */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900 text-base">Broadcast Dispatch History</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Audit record of past promotional and push notifications sent by Admins.
              </p>
            </div>
            <button
              onClick={() => fetchHistory(historyPage)}
              disabled={historyLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold border border-gray-200 transition-colors cursor-pointer"
            >
              <FiRefreshCw className={historyLoading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>

          {historyLoading ? (
            <div className="p-12 text-center text-gray-400">
              <FiRefreshCw className="animate-spin text-2xl mx-auto mb-2 text-emerald-600" />
              <span>Loading broadcast history...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <FiBell className="text-3xl mx-auto mb-2 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">No broadcast notifications sent yet.</p>
              <p className="text-xs text-gray-400 mt-1">
                Compose and send your first offer notification above!
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50/75 text-gray-600 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-3.5">Notification</th>
                    <th className="px-6 py-3.5">Target</th>
                    <th className="px-6 py-3.5">Recipients</th>
                    <th className="px-6 py-3.5">Link</th>
                    <th className="px-6 py-3.5">Date & Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {history.map((item) => {
                    const data = item.data || {};
                    return (
                      <tr key={item._id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-gray-900 line-clamp-1">{item.title}</p>
                          <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{item.message}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium capitalize">
                            {data.target || 'All'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-600">
                          <div>
                            Users: <span className="font-bold text-gray-900">{data.recipientsCount || '-'}</span>
                          </div>
                          <div>
                            Devices: <span className="font-bold text-gray-900">{data.tokensCount || '0'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-emerald-600">
                          {data.actionUrl ? (
                            <span className="font-mono bg-gray-50 px-2 py-1 rounded border border-gray-100">
                              {data.actionUrl}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                          {new Date(item.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default PushNotifications;


