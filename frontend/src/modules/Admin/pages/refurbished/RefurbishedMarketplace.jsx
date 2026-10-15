import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FiCheckCircle,
  FiSliders,
  FiAlertTriangle,
  FiRotateCcw,
  FiGrid,
  FiTrendingUp,
} from "react-icons/fi";

const RefurbishedMarketplace = () => {
  const navigate = useNavigate();

  const menuItems = [
    {
      path: "/ple-ops-desk/refurbished/dashboard",
      label: "QC & Analytics Dashboard",
      icon: FiTrendingUp,
      gradient: "from-amber-600 via-amber-700 to-amber-800",
      lightGradient: "from-amber-50 via-amber-100/60 to-amber-50",
      shadowColor: "shadow-amber-500/10",
      hoverShadow: "hover:shadow-amber-500/25",
      description: "Monitor quality checked ratios, sales, revenues, and return rates",
      badge: "Live Metrics",
    },
    {
      path: "/ple-ops-desk/refurbished/approvals",
      label: "Product Approvals",
      icon: FiCheckCircle,
      gradient: "from-orange-500 via-orange-600 to-orange-700",
      lightGradient: "from-orange-50 via-orange-100/60 to-orange-50",
      shadowColor: "shadow-orange-500/10",
      hoverShadow: "hover:shadow-orange-500/25",
      description: "Moderate condition grades, device health reports, and replacement histories",
      badge: "8 Pending",
    },
    {
      path: "/ple-ops-desk/refurbished/moderation",
      label: "Fraud & Listing Audit",
      icon: FiAlertTriangle,
      gradient: "from-red-500 via-red-600 to-red-700",
      lightGradient: "from-red-50 via-red-100/60 to-red-50",
      shadowColor: "shadow-red-500/10",
      hoverShadow: "hover:shadow-red-500/25",
      description: "Detect fake grading configurations, misleading conditions, and flag listings",
      badge: "2 Alerts",
    },
    {
      path: "/ple-ops-desk/refurbished/complaints",
      label: "Complaints & Returns",
      icon: FiRotateCcw,
      gradient: "from-emerald-500 via-emerald-600 to-emerald-700",
      lightGradient: "from-emerald-50 via-emerald-100/60 to-emerald-50",
      shadowColor: "shadow-emerald-500/10",
      hoverShadow: "hover:shadow-emerald-500/25",
      description: "Track return inspections, damage claims, and verify physical requests",
      badge: "Active Log",
    },
    {
      path: "/ple-ops-desk/refurbished/categories",
      label: "Refurbished Categories",
      icon: FiGrid,
      gradient: "from-amber-700 via-amber-800 to-amber-900",
      lightGradient: "from-amber-50/80 via-amber-100/50 to-amber-50/80",
      shadowColor: "shadow-amber-800/10",
      hoverShadow: "hover:shadow-amber-800/25",
      description: "Map open-box, renewed, and refurbished sections to existing categories",
      badge: "Configured",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="px-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1.5 flex items-center gap-3">
          <FiSliders className="text-[#C07A3D]" />
          Refurbished Marketplace
        </h1>
        <p className="text-sm sm:text-base text-gray-500">
          Supervise condition assurance, device diagnostic criteria, and seller refurbished sales operations.
        </p>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {menuItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={item.path}
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{
                delay: index * 0.04,
                type: "spring",
                stiffness: 180,
                damping: 18,
              }}
              onClick={() => navigate(item.path)}
              className="group relative overflow-hidden text-left w-full h-full"
            >
              <div
                className={`
                  relative h-full
                  flex flex-col items-start
                  p-6
                  bg-white
                  rounded-2xl
                  border border-gray-200/60
                  bg-gradient-to-br ${item.lightGradient}
                  ${item.shadowColor} ${item.hoverShadow}
                  shadow-sm hover:shadow-xl
                  transition-all duration-300 ease-out
                  active:scale-[0.98]
                  overflow-hidden
                `}
              >
                {/* Accent Background Glow */}
                <div
                  className={`
                    absolute inset-0
                    bg-gradient-to-br ${item.gradient}
                    opacity-0 group-hover:opacity-[0.03]
                    transition-opacity duration-300
                  `}
                />

                {/* Badge */}
                <div className="absolute top-4 right-4 bg-white/90 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-gray-700 shadow-sm border border-gray-100">
                  {item.badge}
                </div>

                {/* Icon Container */}
                <div
                  className={`
                    w-12 h-12
                    rounded-xl
                    bg-gradient-to-br ${item.gradient}
                    flex items-center justify-center
                    mb-5
                    ${item.shadowColor}
                    shadow-md group-hover:shadow-lg
                    group-hover:scale-105 group-hover:rotate-1
                    transition-all duration-300 ease-out
                  `}
                >
                  <Icon className="text-white text-xl" />
                </div>

                {/* Text Content */}
                <div className="space-y-1.5 flex-1">
                  <h3 className="text-base font-bold text-gray-900 group-hover:text-[#C07A3D] transition-colors duration-300">
                    {item.label}
                  </h3>
                  <p className="text-xs text-gray-500 leading-relaxed group-hover:text-gray-600 transition-colors duration-300">
                    {item.description}
                  </p>
                </div>

                {/* Bottom Border Accent */}
                <div
                  className={`
                    absolute bottom-0 left-0 right-0
                    h-1
                    bg-gradient-to-r ${item.gradient}
                    transform scale-x-0 group-hover:scale-x-100
                    transition-transform duration-300 ease-out
                    origin-left
                  `}
                />
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
};

export default RefurbishedMarketplace;
