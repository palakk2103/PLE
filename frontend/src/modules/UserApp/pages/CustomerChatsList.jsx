import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FiArrowLeft, FiMessageSquare, FiInbox, FiCheckCircle } from "react-icons/fi";
import MobileLayout from "../components/Layout/MobileLayout";
import PageTransition from "../../../shared/components/PageTransition";
import api from "../../../shared/utils/api";
import { getPlaceholderImage } from "../../../shared/utils/helpers";
import LazyImage from "../../../shared/components/LazyImage";
import { useAuthStore } from "../../../shared/store/authStore";
import { useB2bStore } from "../../../shared/store/b2bStore";

const CustomerChatsList = () => {
  const navigate = useNavigate();
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();
  const b2bUserRole = useB2bStore((state) => state.userRole);
  const isB2BUser =
    user?.role === 'b2bAdmin' ||
    user?.role === 'b2bEmployee' ||
    user?.isEmployee ||
    b2bUserRole === 'business_buyer';

  // Fetch threads for B2B users; redirect B2C users
  useEffect(() => {
    if (user && !isB2BUser) {
      navigate('/home', { replace: true });
      return;
    }
    fetchThreads();
  }, [user, isB2BUser]);

  const fetchThreads = async () => {
    try {
      setLoading(true);
      const res = await api.get("/user/chat/vendor/threads");
      const payload = res?.data || res;
      setThreads(Array.isArray(payload) ? payload : []);
    } catch (error) {
      console.error("Failed to load chat list:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <MobileLayout showBottomNav={true} showCartBar={false} noPadding={true}>
        <div className="w-full min-h-screen bg-gray-50 flex flex-col pb-20">
          {/* Header */}
          <div className="px-4 py-4 bg-white border-b border-gray-200 sticky top-0 z-30 flex items-center gap-3">
            <button
              onClick={() => navigate("/profile")}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-700"
              type="button"
              title="Back to Profile"
            >
              <FiArrowLeft className="text-xl" />
            </button>
            <div>
              <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">My Inbox</h1>
              <p className="text-xs text-gray-500 font-semibold">Store Conversations</p>
            </div>
          </div>

          {/* List Content */}
          <div className="flex-1 p-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <div className="w-10 h-10 border-4 border-[#7B0A0A] border-t-transparent rounded-full animate-spin mb-4" />
                <p className="font-semibold text-sm">Loading conversations...</p>
              </div>
            ) : threads.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 text-center shadow-xs border border-gray-100 flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4 text-[#7B0A0A]">
                  <FiInbox className="text-3xl" />
                </div>
                <h3 className="font-bold text-gray-800 text-lg mb-1">No chats yet</h3>
                <p className="text-xs text-gray-500 max-w-xs leading-relaxed mb-6">
                  When you ask questions on store profile pages, your conversations will show up here.
                </p>
                <button
                  onClick={() => navigate("/")}
                  className="px-6 py-2.5 bg-[#7B0A0A] hover:bg-[#AE020B] text-white font-extrabold rounded-xl text-xs transition-colors shadow-xs"
                  type="button"
                >
                  Explore Stores
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-xs border border-gray-100 divide-y divide-gray-100 overflow-hidden">
                {threads.map((thread, index) => {
                  const vendor = thread.vendorId || {};
                  const storeName = vendor.storeName || vendor.name || "Unknown Store";
                  const lastMessage = thread.lastMessage || "No messages yet";
                  const lastActivity = thread.lastActivity
                    ? new Date(thread.lastActivity).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "";

                  return (
                    <motion.div
                      key={thread._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => navigate(`/chat/vendor/${thread._id}`)}
                      className="p-4 flex items-center gap-3.5 hover:bg-gray-50 cursor-pointer transition-colors active:bg-gray-100"
                    >
                      {/* Store Logo */}
                      <div className="w-12 h-12 rounded-full border border-gray-150 overflow-hidden flex-shrink-0 bg-gray-50">
                        {vendor.storeLogo ? (
                          <LazyImage
                            src={vendor.storeLogo}
                            alt={storeName}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.src = getPlaceholderImage(60, 60, storeName.charAt(0));
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-red-50 text-[#7B0A0A] font-black text-base">
                            {storeName.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* Info & Last Msg */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <h2 className="font-extrabold text-gray-800 text-sm truncate max-w-[150px] sm:max-w-xs">
                              {storeName}
                            </h2>
                            {vendor.isVerified && (
                              <FiCheckCircle className="text-blue-500 text-xs flex-shrink-0" />
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400 font-semibold">
                            {lastActivity}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 truncate font-medium">
                          {lastMessage}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </MobileLayout>
    </PageTransition>
  );
};

export default CustomerChatsList;
