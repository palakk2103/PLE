import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiBell, FiCheck, FiTrash2, FiInbox, FiRefreshCw } from 'react-icons/fi';
import { useB2BAdminStore } from '../store/b2bAdminStore';

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  
  // Calculate relative time
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleString();
};

const Notifications = () => {
  const {
    notifications,
    unreadNotificationsCount,
    isLoading,
    notificationsPage,
    notificationsHasMore,
    fetchNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
  } = useB2BAdminStore();

  useEffect(() => {
    fetchNotifications(1);
  }, [fetchNotifications]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Notifications</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
            {unreadNotificationsCount} unread notification{unreadNotificationsCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchNotifications(1)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 rounded-lg transition-colors font-medium text-sm disabled:opacity-50"
            type="button"
          >
            <FiRefreshCw className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={markAllNotificationsAsRead}
            disabled={!notifications.length || unreadNotificationsCount === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#D71920] hover:bg-[#B51218] text-white rounded-lg transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            type="button"
          >
            <FiCheck />
            Mark All Read
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#121212] rounded-xl shadow-sm border border-gray-100 dark:border-white/10 p-6 space-y-4">
        {isLoading && notifications.length === 0 ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D71920]"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-950/40 text-[#D71920] dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiInbox className="text-3xl" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">All caught up!</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 max-w-sm mx-auto">
              You don't have any notifications right now. System updates, RFQ actions, and order milestones will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-white/10">
            {notifications.map((notification, index) => (
              <motion.div
                key={notification?._id || `${index}-${notification?.createdAt}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className={`py-4 flex gap-4 items-start transition-colors ${
                  notification?.isRead
                    ? 'bg-transparent'
                    : 'bg-red-50/50 dark:bg-red-950/25 px-3 rounded-lg -mx-3 border border-transparent dark:border-red-900/30'
                }`}
              >
                <div className="mt-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    notification?.isRead
                      ? 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400'
                      : 'bg-red-100 dark:bg-red-900/40 text-[#D71920] dark:text-red-400'
                  }`}>
                    <FiBell className="text-sm" />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className={`text-sm truncate ${
                      notification?.isRead
                        ? 'text-gray-700 dark:text-gray-300 font-medium'
                        : 'text-gray-900 dark:text-white font-semibold'
                    }`}>
                      {notification?.title || 'System Notification'}
                    </h4>
                    {!notification?.isRead && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#D71920] shrink-0"></span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-relaxed break-words">
                    {notification?.message}
                  </p>
                  <span className="text-xs text-gray-400 dark:text-gray-500 mt-1 block">
                    {formatDateTime(notification?.createdAt)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {!notification?.isRead && (
                    <button
                      onClick={() => markNotificationAsRead(notification?._id)}
                      className="p-1.5 text-gray-400 hover:text-[#D71920] dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors"
                      title="Mark as read"
                      type="button"
                    >
                      <FiCheck className="text-lg" />
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotification(notification?._id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors"
                    title="Delete notification"
                    type="button"
                  >
                    <FiTrash2 className="text-lg" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {notificationsHasMore && notifications.length > 0 && (
          <div className="pt-4 border-t border-gray-100 dark:border-white/10 flex justify-center">
            <button
              onClick={() => fetchNotifications(notificationsPage + 1)}
              disabled={isLoading}
              className="px-6 py-2 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 rounded-lg transition-colors font-medium text-sm disabled:opacity-50"
              type="button"
            >
              {isLoading ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default Notifications;
