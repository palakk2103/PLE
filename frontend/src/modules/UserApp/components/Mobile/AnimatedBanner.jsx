import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { matchPath, useNavigate } from "react-router-dom";
import { FiArrowRight, FiZap, FiTag } from "react-icons/fi";

// Hero images for the parallax effect
import sneakersImg from "../../../../../data/products/sneakers.png";
import watchImg from "../../../../../data/products/stylish watch.png";
import sunglassImg from "../../../../../data/products/sunglass.png";

const defaultBanners = [
  {
    id: 1,
    title: "Flash Sale",
    subtitle: "Limited Time Offer",
    discount: "Up to 50% OFF",
    description: "Shop now before it ends!",
    gradient: "from-[#E35F47] via-[#EB7963] to-[#F1937D]",
    link: "/flash-sale",
    icon: FiZap,
    heroImage: sneakersImg,
  },
  {
    id: 2,
    title: "Daily Deals",
    subtitle: "New Deals Every Day",
    discount: "Save 30%",
    description: "Check out today's best deals",
    gradient: "from-[#DE523D] via-[#EB735E] to-[#F3917C]",
    link: "/daily-deals",
    icon: FiTag,
    heroImage: sunglassImg,
  },
  {
    id: 3,
    title: "Special Offers",
    subtitle: "Exclusive Discounts",
    discount: "Claim Now",
    description: "Don't miss out!",
    gradient: "from-[#E25C44] via-[#EA7A65] to-[#F0947E]",
    link: "/offers",
    icon: FiTag,
    heroImage: watchImg,
  },
];

const gradientPalette = [
  "from-[#E35F47] via-[#EB7963] to-[#F1937D]",
  "from-[#DE523D] via-[#EB735E] to-[#F3917C]",
  "from-[#E25C44] via-[#EA7A65] to-[#F0947E]",
];

const KNOWN_USER_ROUTE_PATTERNS = [
  "/",
  "/home",
  "/search",
  "/offers",
  "/daily-deals",
  "/flash-sale",
  "/new-arrivals",
  "/categories",
  "/category/:id",
  "/brand/:id",
  "/seller/:id",
  "/product/:id",
  "/sale/:slug",
  "/track-order/:orderId",
];

const getPathnameFromTarget = (target) =>
  String(target || "").trim().split("?")[0].split("#")[0];

const isKnownInternalRoute = (target) => {
  const pathname = getPathnameFromTarget(target);
  if (!pathname) return false;
  return KNOWN_USER_ROUTE_PATTERNS.some((pattern) =>
    !!matchPath({ path: pattern, end: true }, pathname)
  );
};

const resolveBannerLink = (banner) => {
  const candidate = String(
    banner?.linkUrl || banner?.link || banner?.url || ""
  ).trim();
  if (!candidate) return "";
  if (isExternalLink(candidate)) return candidate;
  if (isSafeInternalPath(candidate) && isKnownInternalRoute(candidate))
    return candidate;
  return "";
};

const isExternalLink = (target) => /^https?:\/\//i.test(String(target || "").trim());
const isSafeInternalPath = (target) => String(target || "").startsWith("/");

const getDarkGradient = (title) => {
  const t = String(title || "").toLowerCase();
  if (t.includes("flash") || t.includes("sale")) {
    return "dark:from-[#1A0808] dark:via-[#110505] dark:to-[#0D0D0D] dark:border-[#3D0A0A]";
  }
  if (t.includes("daily") || t.includes("deal")) {
    return "dark:from-[#1A0808] dark:via-[#110505] dark:to-[#0D0D0D] dark:border-[#3D0A0A]";
  }
  return "dark:from-[#0F1A0F] dark:via-[#0C150C] dark:to-[#0D0D0D] dark:border-[#143B2A]";
};

const AnimatedBanner = ({ banners = null }) => {
  const navigate = useNavigate();
  const [currentBanner, setCurrentBanner] = useState(0);

  const resolvedBanners =
    Array.isArray(banners) && banners.length > 0
      ? banners.map((banner, index) => ({
          id: banner.id || `banner-${index}`,
          title: banner.title || "Special Offer",
          subtitle: banner.subtitle || "Limited Time",
          discount: banner.discount || "Shop Now",
          description: banner.description || "",
          gradient:
            banner.gradient || gradientPalette[index % gradientPalette.length],
          link: resolveBannerLink(banner),
          icon: banner.icon || FiTag,
          heroImage: banner.image || banner.heroImage || watchImg,
        }))
      : defaultBanners;

  const handleBannerClick = (target) => {
    const normalizedTarget = String(target || "").trim();
    if (!normalizedTarget) return;
    if (isExternalLink(normalizedTarget)) {
      window.open(normalizedTarget, "_blank", "noopener,noreferrer");
      return;
    }
    if (isSafeInternalPath(normalizedTarget) && isKnownInternalRoute(normalizedTarget)) {
      navigate(normalizedTarget);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % resolvedBanners.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [resolvedBanners.length]);

  return (
    <div className="px-2.5 sm:px-4 md:px-0 py-2 sm:py-3 select-none" onDragStart={(e) => e.preventDefault()}>
      <div className="relative w-full h-32 sm:h-36 md:h-40 rounded-2xl overflow-hidden shadow-xl dark:shadow-[0_4px_25px_rgba(0,0,0,0.4)] select-none banner-container" onDragStart={(e) => e.preventDefault()}>
        <AnimatePresence mode="wait">
          {resolvedBanners.map((banner, index) => {
            if (index !== currentBanner) return null;
            const Icon = banner.icon;

            return (
              <motion.div
                key={banner.id}
                onDragStart={(e) => e.preventDefault()}
                initial={{ opacity: 0, scale: 1.1, x: "100%" }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95, x: "-100%" }}
                transition={{
                  duration: 0.5,
                  ease: [0.25, 0.1, 0.25, 1],
                }}
                style={{ willChange: "transform, opacity" }}
                className={`absolute inset-0 bg-gradient-to-br ${banner.gradient} ${getDarkGradient(banner.title)} p-3 sm:p-4 relative dark:border dark:border-white/5 select-none`}>
                {/* 3D Depth Parallax Background */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 select-none">
                  {/* Layer 1: Background (Blurred Product) */}
                  <motion.div
                    initial={{ opacity: 0, scale: 1.5, rotate: -5, x: 50 }}
                    animate={{ opacity: 0.2, scale: 1.8, rotate: 0, x: 0 }}
                    transition={{ duration: 10, repeat: Infinity, repeatType: "reverse" }}
                    className="absolute right-[-10%] top-[-10%] w-[120%] h-[120%] select-none pointer-events-none"
                  >
                    <img
                      src={banner.heroImage}
                      draggable={false}
                      onDragStart={(e) => e.preventDefault()}
                      className="w-full h-full object-contain blur-2xl opacity-40 brightness-150 dark:brightness-75 select-none pointer-events-none"
                      alt=""
                    />
                  </motion.div>

                  {/* Layer 2: Midground (Bokeh Particles) */}
                  {[...Array(6)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{
                        opacity: 0,
                        x: Math.random() * 200,
                        y: Math.random() * 100
                      }}
                      animate={{
                        opacity: [0, 0.4, 0],
                        x: [null, Math.random() * -100],
                        y: [null, Math.random() * -50],
                      }}
                      transition={{
                        duration: 3 + Math.random() * 4,
                        repeat: Infinity,
                        delay: i * 0.5
                      }}
                      className="absolute w-1 h-1 bg-white dark:bg-dark-accent rounded-full blur-[1px] select-none pointer-events-none"
                      style={{
                        right: `${10 + (i * 15)}%`,
                        top: `${20 + (i * 10)}%`,
                      }}
                    />
                  ))}

                  {/* Layer 3: Foreground (Sharp Hero Product) */}
                  <div className={`absolute right-[2%] sm:right-[5%] top-1/2 -translate-y-1/2 w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 flex items-center justify-center pointer-events-none select-none ${banner.id === 2 ? 'pb-4 sm:pb-6' : ''}`}>
                    <motion.div
                      initial={{ opacity: 0, x: 100, scale: 0.5, rotate: 10 }}
                      animate={{ opacity: 1, x: 0, scale: 1.1, rotate: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 80,
                        damping: 12,
                        delay: 0.2
                      }}
                      className="select-none pointer-events-none"
                    >
                      <motion.img
                        src={banner.heroImage}
                        alt="Hero Product"
                        draggable={false}
                        onDragStart={(e) => e.preventDefault()}
                        className="w-full h-full object-contain drop-shadow-[0_20px_30px_rgba(0,0,0,0.5)] dark:drop-shadow-[0_15px_20px_rgba(192,122,61,0.25)] select-none pointer-events-none"
                        animate={{
                          y: [0, -5, 0],
                          rotate: [0, 2, -2, 0]
                        }}
                        transition={{
                          duration: 4,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      />
                    </motion.div>
                  </div>
                </div>

                {/* Content */}
                <button
                  type="button"
                  onClick={() => handleBannerClick(banner.link)}
                  disabled={!banner.link}
                  className="relative z-10 h-full flex pt-2 justify-between group select-none cursor-pointer">
                  <div className="flex-1 select-none">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="flex items-center gap-2 mb-0 select-none">
                      <motion.div
                        animate={{
                          scale: [1, 1.2, 1],
                          rotate: [0, 10, -10, 0],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}>
                        <Icon className="text-white dark:text-dark-accent text-lg drop-shadow-lg" />
                      </motion.div>
                      <motion.span
                        className="text-white/90 dark:text-[#DDDDDD] text-xs font-medium select-none"
                        animate={{
                          opacity: [0.9, 1, 0.9],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}>
                        {banner.subtitle}
                      </motion.span>
                    </motion.div>

                    <motion.h3
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="text-white dark:text-[#FFFFFF] text-xl font-extrabold mb-0 drop-shadow-lg relative inline-block select-none">
                      {banner.title}
                    </motion.h3>

                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="text-white/90 dark:text-[#AAAAAA] text-xs mb-1 select-none">
                      {banner.description}
                    </motion.p>

                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5, type: "spring" }}
                      style={{
                        willChange: "transform",
                        transform: "translateZ(0)",
                      }}
                      className="inline-flex items-center gap-2 bg-[#7B0A0A] hover:bg-[#AE020B] px-4 py-1.5 rounded-full relative overflow-hidden shadow-md dark:border dark:border-[#7B0A0A]/50 transition-colors duration-200 select-none"
                      whileTap={{ scale: 0.95 }}>
                      <span className="text-white dark:text-[#FFFFFF] font-bold text-sm relative z-10 select-none">
                        {banner.discount}
                      </span>
                      <FiArrowRight className="text-white dark:text-[#FFFFFF] text-sm relative z-10" />
                    </motion.div>
                  </div>
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Indicator Dots */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
          {resolvedBanners.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentBanner(index)}
              className="focus:outline-none">
              <motion.div
                animate={{
                  width: index === currentBanner ? 24 : 6,
                  opacity: index === currentBanner ? 1 : 0.5,
                }}
                transition={{ duration: 0.3 }}
                className={`h-1.5 rounded-full bg-white ${
                  index === currentBanner
                    ? "w-6 dark:bg-dark-accent"
                    : "w-1.5 dark:bg-white/40"
                }`}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnimatedBanner;
