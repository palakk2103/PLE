import { useState, useEffect } from "react";
import { FiArrowLeft, FiAward, FiCalendar, FiShoppingBag } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import MobileLayout from "../components/Layout/MobileLayout";
import PageTransition from "../../../shared/components/PageTransition";
import { useLoyaltyStore } from "../../../shared/store/loyaltyStore";
import { formatPrice } from "../../../shared/utils/helpers";

const LoyaltyHistory = () => {
  const navigate = useNavigate();
  const { history, fetchHistory, rules, fetchConfig, isLoading } = useLoyaltyStore();
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchConfig();
    fetchHistory(page, 20).then((data) => {
      if (data) {
        setTotalPages(data.pages || 1);
      }
    });
  }, [page]);

  return (
    <PageTransition>
      <MobileLayout showBottomNav={true} showCartBar={false}>
        <div className="w-full pb-24">
          {/* Header */}
          <div className="px-4 py-4 bg-white border-b border-gray-200 relative flex items-center gap-3">
            <button
              onClick={() => {
                if (window.history.state && window.history.state.idx > 0) {
                  navigate(-1);
                } else {
                  navigate("/profile?tab=loyalty");
                }
              }}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <FiArrowLeft className="text-xl text-gray-700" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-800">Points History</h1>
              <p className="text-xs text-gray-500">Track all your reward logs</p>
            </div>
          </div>

          <div className="px-4 py-4 space-y-4">
            {isLoading && history.length === 0 ? (
              <div className="text-center py-12 text-gray-500">Loading history logs...</div>
            ) : history.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 p-6">
                <FiAward className="text-5xl text-gray-300 mx-auto mb-2" />
                <h3 className="text-base font-bold text-gray-700">No logs found</h3>
                <p className="text-xs text-gray-500 mt-1">Start shopping to earn reward points!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((item) => (
                  <div key={item._id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-gray-800">{item.description}</span>
                      </div>
                      {item.orderId && (
                        <p className="text-[10px] font-mono font-bold text-[#7B0A0A]">
                          Order: #{item.orderId}
                        </p>
                      )}
                      <p className="text-[10px] text-gray-400 font-semibold flex items-center gap-1">
                        <FiCalendar />
                        {new Date(item.date).toLocaleDateString("en-IN", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>

                    <div className="text-right space-y-1">
                      {item.earnedPoints > 0 ? (
                        <span className="inline-flex items-center text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                          +{item.earnedPoints}
                        </span>
                      ) : item.redeemedPoints > 0 ? (
                        <span className="inline-flex items-center text-xs font-black text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full">
                          -{item.redeemedPoints}
                        </span>
                      ) : null}
                      <p className="text-[10px] text-gray-400 font-bold">
                        Bal: {item.balance} Pts
                      </p>
                    </div>
                  </div>
                ))}

                {totalPages > 1 && (
                  <div className="flex justify-between items-center pt-4">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      className="px-4 py-2 border rounded-xl font-semibold text-xs disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <span className="text-xs text-gray-500 font-bold">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      className="px-4 py-2 border rounded-xl font-semibold text-xs disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </MobileLayout>
    </PageTransition>
  );
};

export default LoyaltyHistory;
