import { motion } from "framer-motion";
import { FiHome, FiShoppingBag, FiPercent, FiTrendingUp, FiInfo } from "react-icons/fi";
import { formatPrice } from "../../../../shared/utils/helpers";

const RevenueBreakdownCards = ({ stats }) => {
  const totalRev = Number(stats.totalRevenue || 0);
  const inHouseRev = Number(stats.inHouseRevenue || 0);
  const vendorGrossRev = Number(stats.vendorGrossRevenue || 0);
  const adminCommission = Number(stats.adminCommission || 0);
  const vendorNet = Number(stats.vendorNetEarnings || 0);
  const totalAdminRev = Number(stats.totalAdminRevenue || (inHouseRev + adminCommission));

  const inHousePct = totalRev > 0 ? Math.round((inHouseRev / totalRev) * 100) : 0;
  const vendorPct = totalRev > 0 ? Math.round((vendorGrossRev / totalRev) * 100) : 0;

  const cards = [
    {
      title: "In-House Store Sales",
      subtitle: "Direct sales from PLE / Admin-managed shops",
      value: formatPrice(inHouseRev),
      subValue: `${inHousePct}% of total platform sales`,
      icon: FiHome,
      badge: "In-House",
      badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
      cardBg: "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-900/30 border-blue-100 dark:border-blue-800/40",
      iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600 text-white",
    },
    {
      title: "Vendor Marketplace Sales",
      subtitle: "Gross customer billing from 3rd-party sellers",
      value: formatPrice(vendorGrossRev),
      subValue: `${vendorPct}% of total platform sales`,
      extra: [
        { label: "Net Seller Payout", val: formatPrice(vendorNet) },
        { label: "Admin Cut", val: formatPrice(adminCommission) },
      ],
      icon: FiShoppingBag,
      badge: "Marketplace",
      badgeColor: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
      cardBg: "bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-purple-950/40 dark:to-fuchsia-900/30 border-purple-100 dark:border-purple-800/40",
      iconBg: "bg-gradient-to-br from-purple-500 to-fuchsia-600 text-white",
    },
    {
      title: "Platform Commission Earned",
      subtitle: "Platform fee collected from 3rd-party sellers",
      value: formatPrice(adminCommission),
      subValue: "Retained profit margin",
      icon: FiPercent,
      badge: "Commission",
      badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
      cardBg: "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-900/30 border-amber-100 dark:border-amber-800/40",
      iconBg: "bg-gradient-to-br from-amber-500 to-orange-600 text-white",
    },
    {
      title: "Total Admin Real Earnings",
      subtitle: "In-House Sales + Platform Commissions",
      value: formatPrice(totalAdminRev),
      subValue: "Actual income accruing to Admin",
      icon: FiTrendingUp,
      badge: "Net Admin",
      badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
      cardBg: "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-900/30 border-emerald-200 dark:border-emerald-700/50",
      iconBg: "bg-gradient-to-br from-emerald-500 to-teal-600 text-white",
      highlight: true,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
        <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span className="w-2.5 h-5 bg-emerald-600 rounded-full inline-block"></span>
          Revenue & Earnings Distribution (In-House vs. Vendors)
        </h2>
        {totalRev > 0 && (
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
              In-House: <strong className="text-gray-700 dark:text-gray-200">{inHousePct}%</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block"></span>
              Vendors: <strong className="text-gray-700 dark:text-gray-200">{vendorPct}%</strong>
            </span>
          </div>
        )}
      </div>

      {/* Distribution Ratio Bar */}
      {totalRev > 0 && (
        <div className="w-full bg-gray-200 dark:bg-gray-700/60 h-2 rounded-full overflow-hidden flex shadow-inner">
          <div
            style={{ width: `${inHousePct}%` }}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full transition-all duration-500"
            title={`In-House Store: ${inHousePct}%`}
          />
          <div
            style={{ width: `${vendorPct}%` }}
            className="bg-gradient-to-r from-purple-500 to-fuchsia-600 h-full transition-all duration-500"
            title={`Vendor Marketplace: ${vendorPct}%`}
          />
        </div>
      )}

      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              className={`${card.cardBg} rounded-xl p-4 sm:p-5 shadow-sm border hover:shadow-md transition-all duration-200 relative overflow-hidden flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className={`${card.iconBg} p-2.5 rounded-lg shadow-sm`}>
                    <Icon className="text-lg" />
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${card.badgeColor}`}>
                    {card.badge}
                  </span>
                </div>

                <h3 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-200 mb-0.5">
                  {card.title}
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2 line-clamp-1" title={card.subtitle}>
                  {card.subtitle}
                </p>

                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                  {card.value}
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-black/5 dark:border-white/5">
                {card.extra ? (
                  <div className="flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-300">
                    <span>
                      Seller: <strong className="text-gray-800 dark:text-gray-100">{card.extra[0].val}</strong>
                    </span>
                    <span>
                      Comm: <strong className="text-emerald-600 dark:text-emerald-400">{card.extra[1].val}</strong>
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                    {card.subValue}
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default RevenueBreakdownCards;
