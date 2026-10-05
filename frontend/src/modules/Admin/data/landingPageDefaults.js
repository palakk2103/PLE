export const LANDING_PAGE_DEFAULTS = {
  sections: [
    { id: 'hero', name: 'Hero Section', visible: true, order: 0 },
    { id: 'catalogue', name: 'Explore Our Catalogue', visible: true, order: 1 },
    { id: 'trustedBrands', name: 'Trusted Brands', visible: true, order: 2 },
    { id: 'productCategories', name: 'Product Categories', visible: true, order: 3 },
    { id: 'portfolioHighlights', name: 'Portfolio Highlights', visible: true, order: 4 },
    { id: 'cpoSection', name: 'CPO Section', visible: true, order: 5 },
    { id: 'gpoSection', name: 'GPO Section', visible: true, order: 6 },
    { id: 'smartDeals', name: 'Smart Deals', visible: true, order: 7 },
    { id: 'loyaltyRewards', name: 'Loyalty Rewards', visible: true, order: 8 },
    { id: 'zeroMaintenance', name: 'Zero Maintenance', visible: true, order: 9 },
    { id: 'services', name: 'Services / Categories (Legacy)', visible: false, order: 10 },
    { id: 'whyChooseUs', name: 'Features (Why Choose Us)', visible: true, order: 11 },
    { id: 'comparison', name: 'Comparison Table', visible: true, order: 12 },
    { id: 'stats', name: 'Stats Counter', visible: true, order: 13 },
    { id: 'testimonials', name: 'Testimonials', visible: true, order: 14 },
    { id: 'portfolio', name: 'Product Showcase', visible: true, order: 15 },
    { id: 'pricing', name: 'Deals & Rewards (Legacy)', visible: false, order: 16 },
    { id: 'gallery', name: 'Gallery', visible: true, order: 17 },
    { id: 'presenceMap', name: 'Presence Map', visible: true, order: 18 },
    { id: 'ctaBanner', name: 'CTA Banner', visible: true, order: 19 },
  ],
  hero: {
    tagline: 'REAL DEALS. FAST DELIVERY. HAPPY SHOPPING',
    heading: 'Shop. Save. Smile. Enjoy.',
    subheading: 'Get the best values on top brands. Curated marketplace with lightning-fast delivery and verified sellers.',
    description: 'Explore thousands of products across electronics, fashion, home essentials, and more. Experience shopping redefined.',
    primaryBtnText: 'Explore Deals',
    primaryBtnLink: '#pricing',
    secondaryBtnText: 'Our Services',
    secondaryBtnLink: '#services',
    rotatingPhrases: ['Electronics', 'Fashion', 'Home & Living', 'Groceries', 'Daily Deals', 'Verified Sellers'],
    videoBackground: '/hero-video.mp4',
    imageFallback: '/hero_modern.png',
  },
  catalogue: {
    badge: 'Catalogue Portfolio',
    title: 'Explore Our Digital Catalogue',
    subtitle: 'Flip through our verified selection of commercial components, IT infrastructure assets, corporate categories, and service capabilities.',
    pdfUrl: '/catalogue/PLE-Catalogue.pdf',
    videoUrl: '/PLE_2026_Catalogue_Book_Slow_Pages.mp4',
    status: true
  },
  trustedBrands: {
    badge: 'Authorized Portfolios',
    title: 'Trusted Electronics Brands',
    subtitle: 'Direct partnerships with global manufacturers ensuring official warranty coverage, premium enterprise support, and bulk inventory access.',
    status: true,
  },
  portfolioHighlightsHeader: {
    badge: 'Capability Showcase',
    title: 'Enterprise Procurement Highlights',
    subtitle: 'Strategic purchasing support options designed to maximize value, reduce IT administrative costs, and secure business operations.'
  },
  productCategories: {
    title: 'Product Categories',
    subtitle: 'Explore dynamic electronics categories and bulk catalogs',
    status: true,
  },
  productCategoriesShowcase: {
    badge: 'Product Sourcing',
    title: 'Dynamic Categories',
    subtitle: 'Procure authentic hardware, custom configurations, and volume software licensing built for business scalability.',
    categories: [
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
    ]
  },
  portfolioHighlights: [
    { id: 'hl-cpo', title: 'CPO', subtitle: 'Certified Pre-Owned', description: 'Rigorous 40+ point quality inspection with warranty.', icon: 'Shield', image: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=300&h=200&fit=crop', buttonText: 'Learn More', buttonLink: '#cpo', status: true, order: 0 },
    { id: 'hl-gpo', title: 'GPO', subtitle: 'Group Purchase Organization', description: 'Aggregated B2B buying power for lowest industry rates.', icon: 'Users', image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=300&h=200&fit=crop', buttonText: 'Explore GPO', buttonLink: '#gpo', status: true, order: 1 },
    { id: 'hl-smart', title: 'Smart Deals', subtitle: 'Priority Value Bargains', description: 'Limited time priority bulk stock offers on top electronics.', icon: 'TrendingUp', image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=300&h=200&fit=crop', buttonText: 'View Deals', buttonLink: '#smart-deals', status: true, order: 2 },
    { id: 'hl-loyalty', title: 'Loyalty Rewards', subtitle: 'B2B Purchaser Benefits', description: 'Earn loyalty points on every volume purchase. Redeemable anytime.', icon: 'Award', image: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=300&h=200&fit=crop', buttonText: 'Claim Rewards', buttonLink: '#loyalty', status: true, order: 3 },
    { id: 'hl-zero', title: 'Zero Maintenance', subtitle: 'Complete peace of mind', description: 'Complimentary maintenance packages for all enterprise equipment.', icon: 'Settings', image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?q=80&w=300&h=200&fit=crop', buttonText: 'Read Policy', buttonLink: '#zero-maintenance', status: true, order: 4 },
  ],
  cpoSection: {
    title: 'Certified Pre-Owned (CPO) Electronics',
    subtitle: 'Tested. Certified. Warranted.',
    description: 'We offer fully certified pre-owned IT assets and office electronics. Every device undergoes a meticulous inspection process by qualified hardware engineers and comes with a 1-year replacement warranty.',
    image: 'https://images.unsplash.com/photo-1588508065123-287b28e013da?q=80&w=600&h=400&fit=crop',
    features: [
      '40-Point Rigorous Testing Protocol',
      'Original Manufacturer Components Only',
      '12 Months Full Warranty Protection',
      'Authorized Refurbished Certificate Issued'
    ],
    ctaText: 'Browse Certified Stock',
    ctaLink: '/search?condition=refurbished',
    status: true
  },
  gpoSection: {
    title: 'Group Purchase Organization (GPO) Buying',
    subtitle: 'Consolidated Purchasing Power',
    description: 'Unlock enterprise-level pricing by buying collectively. Our GPO gathers bulk requirements from hundreds of small-to-medium business buyers to negotiate direct manufacturer discounts.',
    image: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=600&h=400&fit=crop',
    features: [
      'Up to 35% Lower than Standard Retail',
      'Direct Manufacturer Shipping & Logistics',
      'Flexible Credit terms for B2B Members',
      'Consolidated Order Management Dashboard'
    ],
    ctaText: 'Join Buying Group',
    ctaLink: '/get-quote',
    status: true
  },
  smartDeals: {
    title: 'Smart Deals & Clearance Bargains',
    description: 'Priority bulk clearance lots and excess stock deals directly from certified manufacturers.',
    banner: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=800&h=300&fit=crop',
    image: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?q=80&w=600&h=400&fit=crop',
    offerText: 'Save up to 60% on Bulk Enterprise Laptops & Office Equipment',
    buttonText: 'View Clearance Deals',
    buttonLink: '/daily-deals',
    priority: 1,
    status: true,
    expiry: '2026-12-31'
  },
  loyaltyRewards: {
    title: 'Loyalty Rewards Program for B2B Buyers',
    description: 'Every rupee spent brings your business closer to massive redemption benefits and cashbacks.',
    illustration: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=600&h=400&fit=crop',
    benefits: [
      'Earn 1 point for every Rs. 100 spent',
      'Accelerated points multipliers on bulk orders',
      'Exclusive early-access clearance deals',
      'Zero point expiration for active accounts'
    ],
    ctaText: 'Register Free & Start Earning',
    ctaLink: '/register',
    status: true,
    displayOrder: 0
  },
  zeroMaintenance: {
    title: 'Zero Maintenance Hardware Guarantee',
    subtitle: 'Free Maintenance Support Program',
    description: 'Minimize downtime. All enterprise client orders exceeding qualified limits automatically include our complete site support package, covering maintenance, backup replacements, and round-the-clock emergency support.',
    image: 'https://images.unsplash.com/photo-1597491853412-e82a28dc8d2b?q=80&w=600&h=400&fit=crop',
    features: [
      'Free On-Site Diagnostic Reviews',
      'Immediate Backup Unit Provisioning',
      '24/7 Priority Emergency Helpdesk',
      'Annual Free Hardware Optimization Services'
    ],
    ctaText: 'Request Bulk Quote',
    ctaLink: '/get-quote',
    status: true
  },
  services: [
    {
      id: 'web-dev',
      slug: 'website-development',
      title: 'Website Development',
      subtitle: 'High Performance & Stunning Layouts',
      shortDescription: 'We build fast, mobile-friendly websites — from landing pages to full web portals.',
      description: 'Our development team specializes in crafting high-converting, blazing-fast web solutions that represent your brand with prestige.',
      subServices: 'Static sites, CMS, E-commerce, Web Apps',
      icon: 'Globe',
      features: ['Custom Responsive UI/UX Design', 'Modern Single Page Applications', 'High-Speed Performance', 'SEO-Friendly Structure'],
      cta: 'Get Started'
    }
  ],
  whyChooseUsHeader: {
    tagline: 'Why Shop With Us',
    heading: 'A Smarter Way to',
    highlightText: 'Shop Online'
  },
  whyChooseUs: [
    { title: 'Bulk Purchase Discounts', description: 'Volume-negotiated rates that fit scale and maximize margins.', icon: 'Briefcase', image: '', status: true, order: 0 },
    { title: 'Trusted Electronics Brands', description: 'Curated lineup from Apple, Dell, HP, Samsung, LG, Sony and more.', icon: 'Award', image: '', status: true, order: 1 },
    { title: 'Certified Pre-Owned (CPO)', description: 'Meticulously inspected IT hardware with replacement warranties.', icon: 'Shield', image: '', status: true, order: 2 },
    { title: 'Group Purchasing (GPO)', description: 'Aggregate B2B purchasing demands to unlock rock-bottom prices.', icon: 'Users', image: '', status: true, order: 3 },
    { title: 'Priority Smart Deals', description: 'Immediate clearances and flash sales on high-intent electronics.', icon: 'Zap', image: '', status: true, order: 4 },
    { title: 'Loyalty Rewards Program', description: 'Redeem points for massive cashbacks and future inventory credit.', icon: 'Gift', image: '', status: true, order: 5 },
    { title: 'Zero Maintenance Guarantee', description: 'On-site upkeep support packages to reduce operational downtime.', icon: 'Settings', image: '', status: true, order: 6 },
    { title: 'Lightning-Fast B2B Delivery', description: 'Tracked logistics network across major enterprise hubs.', icon: 'Truck', image: '', status: true, order: 7 },
    { title: 'Wholesale Business Pricing', description: 'Get direct tax invoices and transparent pricing with no hidden fees.', icon: 'DollarSign', image: '', status: true, order: 8 }
  ],
  comparison: {
    header: {
      heading: 'The B2B Marketplace Advantage',
      description: 'Consolidate your procurement pipeline with complete trust, better margins, and automated logistics.',
      vedhuntColumnHeader: 'Our B2B Hub',
      typicalColumnHeader: 'Typical Retailer',
      bottomNote: 'Procurement Benchmarks 2026'
    },
    rows: [
      { feature: 'Volume Discounts', vedhunt: 'Aggregated GPO/Bulk rates', typical: 'Standard retail rates' },
      { feature: 'Quality Assurance', vedhunt: 'CPO with 40-point checks & warranty', typical: 'As-is state with no warranty' },
      { feature: 'Tax Invoicing', vedhunt: 'Complete GST input invoices', typical: 'Standard invoice with no benefits' },
      { feature: 'Logistics', vedhunt: 'Integrated B2B bulk cargo network', typical: 'Standard parcel delivery' },
      { feature: 'Support Service', vedhunt: 'Zero maintenance site coverage', typical: 'Ad-hoc ticket support' }
    ]
  },
  stats: [
    { value: '₹50Cr+', label: 'Business Purchasing Volume' },
    { value: '500+', label: 'Enterprise B2B Members' },
    { value: '15,000+', label: 'Commercial IT Assets Listed' },
    { value: '99.9%', label: 'Uptime & Service Level Agreement' }
  ],
  testimonialsHeader: {
    title: 'CLIENT SAYS:'
  },
  testimonials: [
    { quote: 'Consolidating our office IT requirements through PLE saved us nearly 30% on laptop acquisitions. The zero maintenance warranty is a game-changer.', author: 'Vikram Mehta', role: 'Head of IT, TechCorp India', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&h=150&fit=crop', country: 'India', countryFlag: '🇮🇳' },
    { quote: 'Direct B2B quotes and transparent GPO buying terms allowed us to scale our regional operations with ease. Very professional support team.', author: 'Priya R.', role: 'Operations Lead, GrowFast Solutions', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150&h=150&fit=crop', country: 'India', countryFlag: '🇮🇳' }
  ],
  productsHeader: {
    badge: 'Featured Picks',
    title: 'Curated Collections'
  },
  products: [
    { id: 1, name: 'Enterprise Laptop - 16GB RAM / 512GB SSD', price: '₹42,500', image: 'https://images.unsplash.com/photo-1496181130204-7552cc14ac1a?q=80&w=300&h=300&fit=crop', link: '#', featured: true },
    { id: 2, name: 'Ultra-Wide LED Commercial Monitor 34"', price: '₹28,999', image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?q=80&w=300&h=300&fit=crop', link: '#', featured: true },
    { id: 3, name: 'Ergonomic Premium Office Seat Lot', price: '₹7,499', image: 'https://images.unsplash.com/photo-1505797149-43b0069ec26b?q=80&w=300&h=300&fit=crop', link: '#', featured: true }
  ],
  pricing: [
    {
      id: 'pricing-1',
      title: 'Starter',
      description: 'Ideal for small offices.',
      price: '₹24,999',
      period: '/lot',
      features: ['Up to 5 Devices', 'Standard Inspection Certificate', 'Standard Shipping'],
      ctaText: 'Get Quote',
      highlight: false
    }
  ],
  galleryHeader: {
    title: 'Our Gallery',
    subtitle: 'Take a look at our creative projects, events, and modern working spaces.'
  },
  gallery: [
    { id: 'gal-1', url: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=400&h=300&fit=crop', title: 'Modern Workspace' },
    { id: 'gal-2', url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=400&h=300&fit=crop', title: 'Data Analytics Chart' }
  ],
  presenceMap: {
    heading: 'Our Presence',
    description: '',
    locations: [
      { name: 'Karnataka', top: '70%', left: '29%', delay: 0.1 },
      { name: 'Indore', top: '50%', left: '48%', delay: 0.3 }
    ]
  },
  ctaBanner: {
    heading: 'Ready to elevate your business operations?',
    description: 'Open a business account today to receive wholesale rates, custom GPO deals, and direct tax invoicing.',
    primaryBtnText: 'Become a Business Buyer',
    primaryBtnLink: '/b2b/register',
    secondaryBtnText: 'Request Bulk Quote',
    secondaryBtnLink: '/get-quote'
  },
  faq: [
    { question: 'Who can register as a B2B buyer?', answer: 'Any registered business entity with a valid GSTIN or Business registration certificate can sign up.' },
    { question: 'What is the Zero Maintenance Guarantee?', answer: 'For qualifying enterprise purchases, we provide comprehensive site maintenance support, round-the-clock emergency help, and free replacement backups in case of downtime.' }
  ],
  contact: {
    phone: '+91 9071149100',
    phoneDisplay: '+91 9071149100',
    email: 'support@plebusiness.com',
    hours: 'Mon – Fri: 8:00am – 7:00pm',
    cin: 'CIN - U62099MH2025PTC447275',
    registration: 'Company Registration: CIN - U62099MH2025PTC447275',
    copyright: '© 2026 PLE (Peoples League of Electronics). All Rights Reserved.'
  },
  social: {
    facebook: 'https://www.facebook.com/share/1EaNrat2yr/',
    instagram: 'https://www.instagram.com/peoplesleagueofelectronics?igsh=MWdtbTNzajdqMGV4cQ==',
    linkedin: 'https://www.linkedin.com/company/ple-electronics',
    twitter: 'https://x.com/PeoplesE9405',
    youtube: 'https://youtube.com',
  },
  footer: {
    text: 'People’s League of Electronics (PLE) is a unified service B2B electronics marketplace delivering next-generation digital products, commercial hardware leasing, and corporate IT asset optimization.',
    copyright: '© 2026 PLE. All Rights Reserved.'
  },
  seo: {
    metaTitle: 'PLE - Peoples League of Electronics B2B Marketplace',
    metaDescription: 'Aggregated volume purchase discounts, Certified Pre-Owned electronics with warranties, and zero maintenance agreements for corporate buyers.',
    keywords: 'B2B electronics, commercial laptops, CPO electronics, bulk purchasing, GPO buying group, zero maintenance guarantee'
  },
  blogs: [],
  adLandingPages: {}
};
