import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Laptop, 
  Database, 
  ArrowRight,
  Cpu,
  Monitor,
  Keyboard,
  Wifi,
  Printer,
  Smartphone,
  Gamepad2,
  Tv,
  ShieldAlert,
  Server,
  ShieldCheck,
  FileQuestion,
  Sparkles,
  Zap
} from 'lucide-react';
import { useCMS } from '../../hooks/useCMS';

const ICON_MAP = {
  Cpu,
  Laptop,
  Monitor,
  Database,
  Keyboard,
  Wifi,
  Printer,
  Zap,
  Smartphone,
  Gamepad2,
  Tv,
  ShieldAlert,
  Server,
  ShieldCheck,
  FileQuestion
};

const SOURCING_CATEGORIES = [
  {
    id: 'cat-1',
    title: "PC Components",
    subItems: ["Motherboards", "GPUs", "Cabinets", "SMPS", "Cooling", "RAM"],
    categoryGroup: "hardware",
    iconName: "Cpu",
    brands: ["ASUS ROG", "MSI", "Gigabyte", "Corsair", "Intel", "AMD", "NVIDIA", "G.Skill"],
    description: "Sourcing for high-performance processors, graphics accelerators, system memory, and chassis solutions."
  },
  {
    id: 'cat-2',
    title: "Laptops, Desktops & AIOs",
    subItems: ["Consumer Systems", "Commercial Systems", "Workstations"],
    categoryGroup: "hardware",
    iconName: "Laptop",
    brands: ["HP", "Dell", "Lenovo", "Apple", "Acer", "ASUS"],
    description: "Commercial and consumer computing solutions configured for enterprise scaling, office productivity, and remote setups."
  },
  {
    id: 'cat-3',
    title: "Monitors & Commercial Displays",
    subItems: ["Monitors", "Large-Format Displays", "Interactive Panels", "Video Walls"],
    categoryGroup: "av",
    iconName: "Monitor",
    brands: ["Samsung", "LG", "BenQ", "ViewSonic", "Dell"],
    description: "Pro-grade visual setups, high-resolution business monitors, collaborative touch panels, and signage systems."
  },
  {
    id: 'cat-4',
    title: "Commercial Printers & Consumables",
    subItems: ["Printers", "Copiers", "Toners", "Cartridges", "Accessories"],
    categoryGroup: "hardware",
    iconName: "Printer",
    brands: ["HP", "Canon", "Epson", "Brother", "Xerox"],
    description: "High-volume business copy systems, document scanners, and replacement toners or consumables."
  },
  {
    id: 'cat-5',
    title: "Enterprise Networking & Security",
    subItems: ["Routers", "Switches", "Access Points", "Firewalls"],
    categoryGroup: "network",
    iconName: "Wifi",
    brands: ["Cisco", "Ubiquiti", "Aruba", "Ruckus", "Sophos", "Fortinet"],
    description: "Corporate wired/wireless network hardware, high-throughput routers, firewalls, and active load balancers."
  },
  {
    id: 'cat-6',
    title: "Server & Data Center Infrastructure",
    subItems: ["Servers", "Enterprise Hardware", "NAS/SAN Storage"],
    categoryGroup: "network",
    iconName: "Server",
    brands: ["Dell Technologies", "HPE", "Cisco", "Lenovo Enterprise"],
    description: "Scalable rack/tower servers, hyper-converged hardware systems, and automated cloud infrastructure."
  },
  {
    id: 'cat-7',
    title: "Software & Volume Security Licenses",
    subItems: ["Antivirus", "Endpoint Security", "Operating Systems", "Volume Licensing"],
    categoryGroup: "software",
    iconName: "ShieldCheck",
    brands: ["Microsoft", "Adobe", "Quick Heal", "Kaspersky", "Norton", "Red Hat"],
    description: "Productivity suites, virtualization platforms, business security antivirus, and enterprise software volume licensing."
  },
  {
    id: 'cat-8',
    title: "Custom OEM Sourcing",
    subItems: ["Hard-to-Find Components", "Specialized Sourcing", "Listed Replacements"],
    categoryGroup: "custom",
    iconName: "FileQuestion",
    brands: ["Global OEM Sourcing"],
    description: "Tailored procurement channels for niche, customized, obsolete, or multi-brand hardware integrations."
  }
];

export default function ProductCategories() {
  const { productCategoriesShowcase } = useCMS();
  const allCategories = (productCategoriesShowcase?.categories && productCategoriesShowcase.categories.length > 0)
    ? productCategoriesShowcase.categories
    : SOURCING_CATEGORIES;

  const badgeText = productCategoriesShowcase?.badge || 'Product Sourcing';
  const titleText = productCategoriesShowcase?.title || 'Dynamic Categories';
  const subtitleText = productCategoriesShowcase?.subtitle || 'Procure authentic hardware, custom configurations, and volume software licensing built for business scalability.';

  const [activeFilter, setActiveFilter] = useState('all');
  const [filteredCategories, setFilteredCategories] = useState(allCategories);

  useEffect(() => {
    if (activeFilter === 'all') {
      setFilteredCategories(allCategories);
    } else {
      setFilteredCategories(allCategories.filter(cat => cat.categoryGroup === activeFilter));
    }
  }, [activeFilter, allCategories]);

  const staggerContainer = {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.08 }
    }
  };

  return (
    <section className="py-20 px-4 bg-app-bg relative overflow-hidden" id="categories">
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[250px] bg-client-primary/2 blur-[100px] pointer-events-none rounded-full" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[250px] bg-client-primary/1 blur-[120px] pointer-events-none rounded-full" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        
        {/* Section Header */}
        <div className="text-center mb-10 space-y-3">
          <div className="flex items-center justify-center gap-3">
            <span className="w-8 h-[2px] bg-client-primary" />
            <span className="text-xs font-black text-client-primary uppercase tracking-[0.3em]">
              {badgeText}
            </span>
            <span className="w-8 h-[2px] bg-client-primary" />
          </div>
          <h2 className="text-3xl md:text-5xl font-black font-heading text-app-text">
            {titleText.includes('Categories') ? (
              <>
                {titleText.replace('Categories', '')} <span className="text-client-primary">Categories</span>
              </>
            ) : (
              titleText
            )}
          </h2>
          <p className="text-sm text-app-text-muted max-w-xl mx-auto">
            {subtitleText}
          </p>
        </div>

        {/* Categories Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mb-12">
          {[
            { id: 'all', label: 'All Categories' },
            { id: 'hardware', label: 'Computing & Hardware' },
            { id: 'network', label: 'Network & Security' },
            { id: 'av', label: 'Displays & AV' },
            { id: 'software', label: 'Software & Licenses' },
            { id: 'custom', label: 'Custom Sourcing' }
          ].map(btn => (
            <button
              key={btn.id}
              onClick={() => setActiveFilter(btn.id)}
              className={`relative px-4 py-2 rounded-xl text-xs font-semibold tracking-wide uppercase cursor-pointer transition-all duration-300 border ${
                activeFilter === btn.id
                  ? 'text-client-primary border-client-primary/30 z-10'
                  : 'text-app-text hover:text-client-primary bg-app-card/25 border-app-border/40 hover:border-app-border/80'
              }`}
            >
              {activeFilter === btn.id && (
                <motion.div
                  layoutId="activeCategoryFilterBg"
                  className="absolute inset-0 bg-client-primary/10 rounded-xl -z-10"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              {btn.label}
            </button>
          ))}
        </div>

        {/* Categories Grid */}
        <motion.div 
          layout
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={staggerContainer}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto gap-6"
        >
          <AnimatePresence mode="popLayout">
            {filteredCategories.map((cat) => {
              const IconComponent = ICON_MAP[cat.iconName] || Cpu;
              
              return (
                <motion.div
                  key={cat.id}
                  initial={{ opacity: 0, scale: 0.96, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 15 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="w-full relative group text-left"
                >
                  <div className="h-full border border-app-border/60 bg-white dark:bg-app-card/50 flex flex-col justify-between overflow-hidden shadow-md transition-all duration-300 hover:border-client-primary/35 rounded-2xl p-5">
                    
                    <div className="space-y-4 flex-grow flex flex-col justify-between">
                      <div>
                        {/* Header Details */}
                        <div className="flex items-center justify-between mb-3.5">
                          <div className="w-10 h-10 rounded-xl bg-client-primary/10 border border-client-primary/20 flex items-center justify-center text-client-primary group-hover:bg-client-primary group-hover:text-black transition-all duration-300">
                            <IconComponent className="w-5 h-5" />
                          </div>
                          <span className="text-[9px] font-extrabold text-client-primary uppercase tracking-widest bg-client-primary/10 px-2 py-0.5 rounded border border-client-primary/20">
                            {cat.categoryGroup}
                          </span>
                        </div>
                        
                        <h3 className="text-lg font-black font-heading text-app-text tracking-tight">
                          {cat.title}
                        </h3>
                        
                        <p className="text-xs text-app-text-muted leading-relaxed mt-2 line-clamp-2">
                          {cat.description}
                        </p>
                      </div>

                      {/* Sub-items Grid */}
                      <div className="mt-4 pt-4 border-t border-app-border/20">
                        <span className="text-[9px] font-semibold uppercase tracking-widest text-app-text-muted/60 block mb-2">Scope / Sub-items</span>
                        <div className="flex flex-wrap gap-1.5">
                          {cat.subItems.map((sub, sIdx) => (
                            <span 
                              key={sIdx} 
                              className="text-[10px] font-bold text-app-text bg-slate-100 dark:bg-[#151515] border border-app-border/40 px-2.5 py-0.5 rounded-lg"
                            >
                              {sub}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Brand Tagging */}
                      <div className="mt-4 pt-4 border-t border-app-border/20">
                        <span className="text-[9px] font-semibold uppercase tracking-widest text-app-text-muted/60 block mb-2">Key Brands</span>
                        <div className="flex flex-wrap gap-1">
                          {cat.brands.map((b, bIdx) => (
                            <span 
                              key={bIdx}
                              className="text-[9px] font-semibold text-client-primary bg-client-primary/5 border border-client-primary/15 px-2 py-0.5 rounded"
                            >
                              {b}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Launch website CTA link & arrow */}
                    <div className="border-t border-app-border/30 pt-4 mt-5 flex items-center justify-between relative z-10">
                      <Link
                        to="/get-quote"
                        className="relative inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-client-primary hover:text-client-primary-hover group/link cursor-pointer"
                      >
                        <span>Inquire Sourcing</span>
                        <ArrowRight className="w-3.5 h-3.5 text-client-primary transition-transform duration-300 group-hover/link:translate-x-1" />
                      </Link>
                    </div>

                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>

      </div>
    </section>
  );
}
