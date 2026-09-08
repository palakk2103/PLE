import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { FiArrowLeft, FiCalendar, FiCheckCircle, FiInfo, FiTag, FiShoppingBag, FiTruck } from "react-icons/fi";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import MobileLayout from "../components/Layout/MobileLayout";
import PageTransition from "../../../shared/components/PageTransition";
import api from "../../../shared/utils/api";

const ProductRequestDetail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [request, setRequest] = useState(null);
  const isB2B = location.pathname.startsWith("/b2b-dashboard");

  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate(isB2B ? "/b2b-dashboard/product-requests" : "/product-requests", { replace: true });
    }
  };

  useEffect(() => {
    fetchRequestDetail();
  }, [id]);

  const fetchRequestDetail = async () => {
    try {
      const response = await api.get(`/user/product-requests/${id}`);
      if (response.success || response.statusCode === 200) {
        const reqData = response.data;
        setRequest({
          ...reqData,
          id: reqData.requestId,
          date: reqData.createdAt
        });
      }
    } catch (error) {
      console.error("Failed to fetch request detail:", error);
      // Let it remain null to show "Request not found"
    }
  };

  if (!request) {
    return (
      <MobileLayout showBottomNav={true} showCartBar={true}>
        <div className="w-full max-w-2xl mx-auto min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-800">Request not found</h2>
            <button
              onClick={handleBack}
              className="mt-4 px-6 py-2 bg-[#7B0A0A] hover:bg-[#AE020B] text-white rounded-xl font-bold text-sm transition-colors"
            >
              Back to Requests
            </button>
          </div>
        </div>
      </MobileLayout>
    );
  }

  // Predefined timeline steps to show on the stepper
  const timelineSteps = [
    { status: "Submitted", label: "Request Submitted" },
    { status: "Under Review", label: "Under Review" },
    { status: "Vendor Sourcing", label: "Vendor Sourcing" },
    { status: "Final Proposal", label: "Proposal Received" },
    { status: "Confirmed", label: "Confirmed" }
  ];

  // Helper to determine step status
  const getStepState = (stepName) => {
    const statusOrder = ["Submitted", "Under Review", "Vendor Sourcing", "Final Proposal", "Confirmed"];
    
    // If request status is Rejected, handle it specially
    if (request.status === "Rejected") {
      if (stepName === "Final Proposal") return "rejected";
      if (stepName === "Confirmed") return "future";
      return "completed";
    }

    const currentIndex = statusOrder.indexOf(request.status);
    const stepIndex = statusOrder.indexOf(stepName);

    if (currentIndex >= stepIndex) return "completed";
    return "future";
  };

  const getStatusStyle = (status) => {
    const map = {
      Submitted: "bg-blue-50 text-blue-700 border-blue-200",
      "Under Review": "bg-yellow-50 text-yellow-750 border-yellow-200",
      "Vendor Sourcing": "bg-purple-50 text-purple-700 border-purple-250",
      "Final Proposal": "bg-indigo-50 text-indigo-700 border-indigo-200 animate-pulse",
      Confirmed: "bg-emerald-50 text-emerald-700 border-emerald-250 font-black",
      Accepted: "bg-green-50 text-green-700 border-green-200",
      Rejected: "bg-red-50 text-red-700 border-red-200",
    };
    return map[status] || "bg-gray-50 text-gray-700 border-gray-200";
  };

  const handleConfirmProposal = async () => {
    try {
      const response = await api.post(`/user/product-requests/${request.requestId}/confirm`);
      if (response.success || response.statusCode === 200) {
        toast.success("Proposal accepted! Order created successfully.");
        fetchRequestDetail();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to confirm proposal.");
    }
  };

  const content = (
    <div className={`w-full pb-24 max-w-4xl mx-auto min-h-screen px-4 py-6 ${isB2B ? 'bg-white rounded-3xl border border-gray-150 p-6 shadow-sm mt-4' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={handleBack}
          className="p-2 hover:bg-gray-200 rounded-full transition-colors bg-white shadow-sm border border-gray-200"
        >
          <FiArrowLeft className="text-xl text-gray-700" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-mono">{request.id}</span>
            <span className={`text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full border ${getStatusStyle(request.status)}`}>
              {request.status}
            </span>
          </div>
          <h1 className="text-xl font-extrabold text-gray-800 truncate">{request.productName}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Details Panel */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Live Final Proposal Card */}
          {request.status === "Final Proposal" && request.selectedFulfillment && (
            <div className="bg-gradient-to-br from-indigo-900 to-indigo-800 text-white rounded-3xl p-6 border border-indigo-950 shadow-md space-y-4">
              <h3 className="text-lg font-black tracking-wide">Procurement Proposal Ready</h3>
              <div className="grid grid-cols-2 gap-4 text-sm bg-black/20 p-4 rounded-2xl">
                <div>
                  <span className="text-indigo-200 block text-xs">Proposed Price</span>
                  <span className="font-extrabold text-lg text-white">₹{request.selectedFulfillment.finalPrice}</span>
                </div>
                <div>
                  <span className="text-indigo-200 block text-xs">Estimated Delivery</span>
                  <span className="font-extrabold text-lg text-white">
                    {request.selectedFulfillment.estimatedDelivery 
                      ? new Date(request.selectedFulfillment.estimatedDelivery).toLocaleDateString()
                      : "3-5 Sourcing Days"}
                  </span>
                </div>
              </div>
              {request.selectedFulfillment.notes && (
                <p className="text-xs text-indigo-150 bg-indigo-950/40 p-3 rounded-xl border border-indigo-850">
                  <strong>Notes:</strong> {request.selectedFulfillment.notes}
                </p>
              )}
              <button
                onClick={handleConfirmProposal}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-750 text-white font-extrabold rounded-2xl text-sm transition-all shadow animate-pulse"
              >
                Accept Proposal & Checkout Order
              </button>
            </div>
          )}

          {/* Already Confirmed Order Card */}
          {request.status === "Confirmed" && (
            <div className="bg-emerald-50 text-emerald-800 rounded-3xl p-6 border border-emerald-150 shadow-sm space-y-2">
              <h3 className="font-extrabold text-sm flex items-center gap-2">
                ✅ Procurement Proposal Confirmed
              </h3>
              <p className="text-xs text-emerald-600">
                You accepted the sourcing proposal. A B2B procurement order has been generated.
              </p>
              {request.associatedOrderId && (
                <div className="pt-1 text-xs">
                  Associated Order ID: <span className="font-mono font-bold text-gray-700">{request.associatedOrderId}</span>
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-gray-800">Product Request Details</h3>
            
            {request.image && (
              <div className="rounded-2xl overflow-hidden border border-gray-200 aspect-video bg-gray-50 flex items-center justify-center p-2 mb-4">
                <img src={request.image} alt={request.productName} className="max-h-full max-w-full object-contain" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-gray-400 block font-medium">Category</span>
                <span className="font-bold text-gray-700">{request.category}</span>
              </div>
              <div>
                <span className="text-gray-400 block font-medium">Quantity Requested</span>
                <span className="font-bold text-gray-700">{request.quantity} units</span>
              </div>
              <div>
                <span className="text-gray-400 block font-medium">Expected Budget</span>
                <span className="font-bold text-gray-700">₹{request.expectedBudget}</span>
              </div>
              <div>
                <span className="text-gray-400 block font-medium">Requested On</span>
                <span className="font-bold text-gray-700">{new Date(request.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <span className="text-gray-400 block font-medium text-xs mb-1">Description</span>
              <p className="text-gray-650 text-sm whitespace-pre-wrap">
                {request.description || "No description provided."}
              </p>
            </div>
          </div>
        </div>

        {/* Stepper / Timeline Tracker */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm h-fit">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Request Status Tracker</h3>
          <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100">
            {timelineSteps.map((step) => {
              const state = getStepState(step.status);
              return (
                <div key={step.status} className="relative flex gap-3 text-sm">
                  <span className={`absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full border-2 transition-all ${
                    state === "completed" ? "bg-emerald-500 border-emerald-600 scale-110" :
                    state === "active" ? "bg-indigo-600 border-indigo-700 scale-110 animate-ping" :
                    state === "rejected" ? "bg-red-500 border-red-600 scale-110" :
                    "bg-white border-gray-200"
                  }`} />
                  <div>
                    <h4 className={`font-bold transition-colors ${
                      state === "completed" ? "text-emerald-700" :
                      state === "active" ? "text-indigo-650" :
                      state === "rejected" ? "text-red-700" :
                      "text-gray-400"
                    }`}>
                      {step.status === "Final Proposal" && request.status === "Rejected" ? "Request Rejected" : step.label}
                    </h4>
                    {state === "completed" && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {request.timeline?.find((t) => t.status === step.status)?.comment || "Updated successfully."}
                      </p>
                    )}
                    {state === "rejected" && (
                      <p className="text-xs text-red-500 mt-0.5">
                        We are sorry, your request has been declined.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  if (isB2B) {
    return <PageTransition>{content}</PageTransition>;
  }

  return (
    <PageTransition>
      <MobileLayout showBottomNav={true} showCartBar={true}>
        {content}
      </MobileLayout>
    </PageTransition>
  );
};

export default ProductRequestDetail;
