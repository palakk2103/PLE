import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Star, ShoppingBag, ShoppingCart, Filter, ArrowUpDown, 
  Heart, X, Check, Flame, Percent, RefreshCw, Eye, Sparkles,
  Smartphone, Shirt, Home as HomeIcon, Sparkles as BeautyIcon, Trophy 
} from 'lucide-react';
import { EncryptedText } from '@/components/ui/encrypted-text';
import { handleImageError, NO_IMAGE_PLACEHOLDER } from "../../../shared/utils/helpers";

// High-quality mock e-commerce products
const MOCK_PRODUCTS = [
  // Electronics
  {
    id: 'elec-1',
    name: 'Quantum Buds Pro',
    category: 'Electronics',
    price: 4999,
    originalPrice: 6999,
    rating: 4.8,
    reviews: 124,
    badge: 'Bestseller',
    badgeType: 'bestseller',
    image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?q=80&w=600&auto=format&fit=crop',
    description: 'Active Noise Cancelling Wireless Earbuds with 40-hour playtime, ultra-low latency gaming mode, and cinematic sound stage.',
    inStock: true,
    specs: ['40dB Active Noise Cancellation', 'Bluetooth 5.3', 'IPX5 Water Resistant', '40H Battery Life']
  },
  {
    id: 'elec-2',
    name: 'Apex SmartWatch Series 5',
    category: 'Electronics',
    price: 8499,
    originalPrice: 11999,
    rating: 4.9,
    reviews: 88,
    badge: 'New Release',
    badgeType: 'new',
    image: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?q=80&w=600&auto=format&fit=crop',
    description: 'Stunning AMOLED Display smart watch featuring advanced heart rate monitoring, built-in GPS, blood oxygen tracking, and 7-day battery life.',
    inStock: true,
    specs: ['1.43" AMOLED Always-on Display', 'Built-in GPS & GLONASS', 'SpO2 & Sleep Tracker', '7-Day Battery Life']
  },
  {
    id: 'elec-3',
    name: 'Horizon SoundBar X-200',
    category: 'Electronics',
    price: 14999,
    originalPrice: 19999,
    rating: 4.7,
    reviews: 56,
    badge: '25% OFF',
    badgeType: 'discount',
    image: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?q=80&w=600&auto=format&fit=crop',
    description: '120W Dolby Atmos Cinematic Soundbar with wireless subwoofer, Bluetooth connectivity, and multiple HDMI eARC ports.',
    inStock: true,
    specs: ['120W RMS Output', 'Dolby Atmos & DTS Virtual:X', 'Wireless Active Subwoofer', 'HDMI eARC & Optical Input']
  },
  // Fashion & Apparel
  {
    id: 'fash-1',
    name: 'AeroGrid Tech Parka',
    category: 'Fashion & Apparel',
    price: 3299,
    originalPrice: 4999,
    rating: 4.6,
    reviews: 92,
    badge: 'Trending',
    badgeType: 'trending',
    image: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=600&auto=format&fit=crop',
    description: 'Premium waterproof windbreaker jacket designed with AeroGrid tech fabric for maximum breathability and weather protection.',
    inStock: true,
    specs: ['Waterproof & Windproof', 'AeroGrid Breathable Mesh', 'Hidden Utility Pockets', 'Adjustable Hood & Cuffs']
  },
  {
    id: 'fash-2',
    name: 'Veloce Urban Sneakers',
    category: 'Fashion & Apparel',
    price: 2799,
    originalPrice: 3999,
    rating: 4.8,
    reviews: 142,
    badge: 'Bestseller',
    badgeType: 'bestseller',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=600&auto=format&fit=crop',
    description: 'Ultra-breathable running and street sneakers with high-rebound cushioning soles and knit-weave upper structure.',
    inStock: true,
    specs: ['High-Rebound Foam Sole', 'Breathable FlyKnit Upper', 'Anti-Slip Grip Pattern', 'Orthotic Cushioning Insole']
  },
  {
    id: 'fash-3',
    name: 'LuxKnit Merino Sweater',
    category: 'Fashion & Apparel',
    price: 4199,
    originalPrice: 5999,
    rating: 4.9,
    reviews: 34,
    badge: 'Premium Wool',
    badgeType: 'new',
    image: 'https://images.unsplash.com/photo-1614975058789-41316d0e2e9c?q=80&w=600&auto=format&fit=crop',
    description: 'Finely spun 100% Australian Merino Wool sweater offering premium softness, warmth retention, and elegant drape.',
    inStock: true,
    specs: ['100% Merino Wool', 'Temperature Regulating', 'Naturally Odor Resistant', 'Tailored Modern Fit']
  },
  // Home & Living
  {
    id: 'home-1',
    name: 'Luna Glow Smart Lamp',
    category: 'Home & Living',
    price: 1899,
    originalPrice: 2999,
    rating: 4.7,
    reviews: 72,
    badge: 'Popular',
    badgeType: 'trending',
    image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?q=80&w=600&auto=format&fit=crop',
    description: 'RGB Ambient Bedside Lamp controllable via smart app, offering 16 million colors, automated schedules, and sunrise alarms.',
    inStock: true,
    specs: ['16 Million RGB Colors', 'App & Voice Control', 'Sunrise/Sunset Simulation', 'Dimmable Warm to Cool White']
  },
  {
    id: 'home-2',
    name: 'AeroBreeze Air Purifier',
    category: 'Home & Living',
    price: 9999,
    originalPrice: 14999,
    rating: 4.8,
    reviews: 48,
    badge: '33% OFF',
    badgeType: 'discount',
    image: 'https://images.unsplash.com/photo-1585338107529-13afc5f02586?q=80&w=600&auto=format&fit=crop',
    description: 'High-efficiency HEPA Filter Silent Room Purifier that filters 99.97% of airborne dust, pollen, smoke, and odors.',
    inStock: true,
    specs: ['3-Stage True HEPA Filtration', 'CADR of 250 m³/h', 'Whisper-Quiet Sleep Mode', 'Air Quality Indicator LED']
  },
  {
    id: 'home-3',
    name: 'ThermaFlask Premium',
    category: 'Home & Living',
    price: 1299,
    originalPrice: 1799,
    rating: 4.9,
    reviews: 196,
    badge: 'Hot Seller',
    badgeType: 'bestseller',
    image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?q=80&w=600&auto=format&fit=crop',
    description: 'Double-wall vacuum insulated stainless steel water bottle keeping drinks ice cold for 24 hours or piping hot for 12 hours.',
    inStock: true,
    specs: ['Vacuum Insulated 18/8 Steel', '24H Cold / 12H Hot Retention', 'Leak-proof Straw Lid included', 'Sweat-Free Powder Finish']
  },
  // Beauty & Wellness
  {
    id: 'beau-1',
    name: 'GlowEssence Retinol Serum',
    category: 'Beauty & Wellness',
    price: 1499,
    originalPrice: 1999,
    rating: 4.8,
    reviews: 110,
    badge: 'Dermatologist Approved',
    badgeType: 'trending',
    image: 'https://images.unsplash.com/photo-1608248597481-496100c8c836?q=80&w=600&auto=format&fit=crop',
    description: 'Anti-aging skin repair serum with 2.5% active retinol, hyaluronic acid, and vitamin E to boost collagen production and restore brightness.',
    inStock: true,
    specs: ['2.5% Active Retinol Concentration', 'Infused with Hyaluronic Acid', 'Cruelty-Free & Vegan', 'Paraben-Free Formulation']
  },
  {
    id: 'beau-2',
    name: 'Rejuvenate Facial Massager',
    category: 'Beauty & Wellness',
    price: 3499,
    originalPrice: 4999,
    rating: 4.7,
    reviews: 65,
    badge: 'New Tech',
    badgeType: 'new',
    image: 'https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?q=80&w=600&auto=format&fit=crop',
    description: 'Sonic micro-current skincare device designed to lift, tone, and reduce fine lines through gentle warm micro-vibrations.',
    inStock: true,
    specs: ['Sonic Micro-current Technology', 'Sleek Ergonomic T-Bar Shape', 'Rechargeable Waterproof Design', 'Warm Massage Setting']
  },
  {
    id: 'beau-3',
    name: 'PureMist Aroma Diffuser',
    category: 'Beauty & Wellness',
    price: 1799,
    originalPrice: 2499,
    rating: 4.6,
    reviews: 83,
    badge: 'Relaxation Pack',
    badgeType: 'trending',
    image: 'https://images.unsplash.com/photo-1602928321679-560bb453f190?q=80&w=600&auto=format&fit=crop',
    description: 'Ultrasonic essential oil diffuser and cool mist humidifier with 7-color ambient lights and automatic auto-shutoff mechanism.',
    inStock: true,
    specs: ['500ml Water Capacity', '7 LED Color Settings', 'Ultrasonic Whisper Mist', 'Acoustic Timer Safety Stop']
  },
  // Sports & Outdoors
  {
    id: 'spor-1',
    name: 'AeroFlex Resistance Bands',
    category: 'Sports & Outdoors',
    price: 899,
    originalPrice: 1499,
    rating: 4.8,
    reviews: 250,
    badge: 'Mega Offer',
    badgeType: 'discount',
    image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=600&auto=format&fit=crop',
    description: 'Heavy-duty natural latex resistance workout bands (set of 5) with ankle straps, soft foam handles, and travel pouch.',
    inStock: true,
    specs: ['100% Premium Natural Latex', 'Up to 150 lbs stackable weight', 'Set of 5 Color-Coded Bands', 'Heavy-duty steel carabiners']
  },
  {
    id: 'spor-2',
    name: 'Pathfinder Trekking Backpack',
    category: 'Sports & Outdoors',
    price: 4499,
    originalPrice: 5999,
    rating: 4.9,
    reviews: 39,
    badge: 'Premium Grade',
    badgeType: 'new',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=600&auto=format&fit=crop',
    description: '50L Heavy-duty trekking backpack made of water-resistant nylon, featuring ergonomic spinal support frameworks and integrated rain cover.',
    inStock: true,
    specs: ['50 Liters Storage Capacity', 'Water-resistant Tearproof Nylon', 'Anti-Gravity Back Panel', 'Rain Cover included']
  },
  {
    id: 'spor-3',
    name: 'HydraGym Stainless Shaker',
    category: 'Sports & Outdoors',
    price: 999,
    originalPrice: 1499,
    rating: 4.7,
    reviews: 115,
    badge: 'Popular',
    badgeType: 'trending',
    image: 'https://images.unsplash.com/photo-1593079831268-3381b0db4a77?q=80&w=600&auto=format&fit=crop',
    description: 'Double-walled insulated shaker cup made of 18/8 food-grade stainless steel with leak-proof lid and metal mixer spring.',
    inStock: true,
    specs: ['Insulated Double-wall Steel', 'Leak-proof Locking Seal Cap', 'Odour & Stain Resistant', 'Engraved Measurement Lines']
  }
];

const CATEGORIES = [
  { name: 'All', icon: ShoppingBag },
  { name: 'Electronics', icon: Smartphone },
  { name: 'Fashion & Apparel', icon: Shirt },
  { name: 'Home & Living', icon: HomeIcon },
  { name: 'Beauty & Wellness', icon: BeautyIcon },
  { name: 'Sports & Outdoors', icon: Trophy }
];

export default function Products() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('popular'); // popular, price-low, price-high, rating
  const [wishlist, setWishlist] = useState(() => {
    const saved = localStorage.getItem('ple_wishlist');
    return saved ? JSON.parse(saved) : [];
  });
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('ple_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null); // For Quick View Modal
  const [toasts, setToasts] = useState([]);

  // Local Storage persistence
  useEffect(() => {
    localStorage.setItem('ple_wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  useEffect(() => {
    localStorage.setItem('ple_cart', JSON.stringify(cart));
    // Trigger custom event to notify MainLayout navbar about cart updates
    window.dispatchEvent(new Event('cartUpdate'));
  }, [cart]);

  // Toast notifier helper
  const addToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  // Toggle Wishlist
  const toggleWishlist = (prodId) => {
    const product = MOCK_PRODUCTS.find(p => p.id === prodId);
    if (wishlist.includes(prodId)) {
      setWishlist(prev => prev.filter(id => id !== prodId));
      addToast(`Removed ${product?.name} from Wishlist!`, 'info');
    } else {
      setWishlist(prev => [...prev, prodId]);
      addToast(`Added ${product?.name} to Wishlist!`, 'success');
    }
  };

  // Add to Cart
  const addToCart = (product, quantity = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
    addToast(`Added ${product.name} to Cart!`, 'success');
  };

  // Update Cart Quantity
  const updateCartQuantity = (prodId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === prodId) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  // Remove from Cart
  const removeFromCart = (prodId) => {
    const item = cart.find(i => i.product.id === prodId);
    setCart(prev => prev.filter(i => i.product.id !== prodId));
    if (item) {
      addToast(`Removed ${item.product.name} from Cart`, 'info');
    }
  };

  // Cart total items
  const cartItemCount = useMemo(() => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  }, [cart]);

  // Cart total price
  const cartTotalPrice = useMemo(() => {
    return cart.reduce((total, item) => total + (item.product.price * item.quantity), 0);
  }, [cart]);

  // Filter and Sort Products
  const filteredProducts = useMemo(() => {
    let result = [...MOCK_PRODUCTS];

    // Category Filter
    if (selectedCategory !== 'All') {
      result = result.filter(p => p.category === selectedCategory);
    }

    // Search Query Filter
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.category.toLowerCase().includes(q) || 
        p.description.toLowerCase().includes(q)
      );
    }

    // Sorting
    if (sortBy === 'price-low') {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-high') {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'rating') {
      result.sort((a, b) => b.rating - a.rating);
    } // 'popular' is default array index ordering

    return result;
  }, [selectedCategory, searchQuery, sortBy]);

  return (
    <div className="bg-app-bg text-app-text-muted min-h-screen pt-24 pb-16 sm:pb-24 px-4 sm:px-6 lg:px-8 mesh-grid relative overflow-hidden text-left">
      
      {/* Background glow animations */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-client-primary/6 rounded-full filter blur-[150px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-client-primary/4 rounded-full filter blur-[150px] pointer-events-none" />

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2.5 max-w-sm w-full">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border shadow-2xl backdrop-blur-xl ${
                toast.type === 'success' 
                  ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-300' 
                  : toast.type === 'info'
                    ? 'bg-[#1a1a1a]/80 border-client-primary/20 text-client-primary'
                    : 'bg-red-950/80 border-red-500/30 text-red-300'
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              <p className="text-xs font-semibold">{toast.message}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Products Page Header banner */}
        <div className="max-w-3xl mb-12 space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-[2px] bg-client-primary" />
            <span className="text-[10px] font-extrabold text-client-primary uppercase tracking-widest bg-client-primary/10 border border-client-primary/20 px-2.5 py-1 rounded-md">
              Marketplace
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black font-heading text-app-text tracking-tight flex flex-col gap-1">
            <EncryptedText 
              text="Premium Products" 
              revealedClassName="text-app-text"
              encryptedClassName="text-client-primary/60 font-mono"
              revealDelayMs={25}
            />
            <EncryptedText 
              text="With Fast & Reliable Delivery" 
              revealedClassName="text-client-primary text-gradient-orange"
              encryptedClassName="text-client-primary/60 font-mono"
              revealDelayMs={15}
            />
          </h1>
          <p className="text-xs sm:text-sm text-app-text-muted leading-relaxed">
            Shop smart, check out securely, and enjoy everyday low pricing on electronics, apparel, home essentials, wellness, and gym equipment.
          </p>
        </div>

        {/* Filter Bar & Controls Panel */}
        <div className="glass-panel bg-app-card border border-app-border rounded-2xl p-4 sm:p-5 mb-8 shadow-xl flex flex-col md:flex-row gap-4 justify-between items-center">
          
          {/* Search Box */}
          <div className="relative w-full md:max-w-md group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted group-hover:text-client-primary transition-colors" />
            <input
              type="text"
              placeholder="Search products, brands, categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-[#111] hover:bg-[#151515] focus:bg-[#181818] border border-app-border focus:border-client-primary/50 text-xs text-app-text rounded-xl outline-none transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Controls right side */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            
            {/* Sorting Dropdown */}
            <div className="flex items-center gap-2 bg-[#111] border border-app-border rounded-xl px-3 py-2 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-client-primary shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent border-none text-app-text outline-none cursor-pointer pr-4 font-bold"
              >
                <option value="popular">Popularity</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="rating">Top Rated</option>
              </select>
            </div>

            {/* Float cart indicator */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative px-5 py-2.5 bg-client-primary hover:bg-client-primary-hover text-black rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg hover:shadow-[0_0_20px_rgba(215,25,32,0.35)] transition-all cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Cart</span>
              {cartItemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-white text-black font-black text-[9px] w-5 h-5 rounded-full flex items-center justify-center border border-black shadow-md">
                  {cartItemCount}
                </span>
              )}
            </button>

          </div>
        </div>

        {/* Categories Carousel / Pill list */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-4 mb-8 no-scrollbar">
          {CATEGORIES.map(cat => {
            const CatIcon = cat.icon;
            const isActive = selectedCategory === cat.name;
            return (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(cat.name)}
                className={`flex items-center gap-2 px-5 py-3 rounded-full text-xs font-bold shrink-0 transition-all border cursor-pointer ${
                  isActive 
                    ? 'bg-client-primary border-client-primary text-black font-black shadow-[0_0_15px_rgba(215,25,32,0.25)] hover:scale-105' 
                    : 'bg-app-card border-app-border text-app-text-muted hover:border-client-primary/30 hover:text-white'
                }`}
              >
                <CatIcon className={`w-3.5 h-3.5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8">
          <AnimatePresence mode="popLayout">
            {filteredProducts.length > 0 ? (
              filteredProducts.map(product => {
                const isWishlisted = wishlist.includes(product.id);
                return (
                  <motion.div
                    key={product.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3 }}
                    className="glass-panel bg-app-card border border-app-border rounded-2xl overflow-hidden shadow-md hover:shadow-2xl hover:border-client-primary/30 hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between group relative"
                  >
                    
                    {/* Badge Overlay */}
                    {product.badge && (
                      <span className={`absolute top-4 left-4 z-20 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                        product.badgeType === 'bestseller' 
                          ? 'bg-amber-500 text-black shadow-md' 
                          : product.badgeType === 'new'
                            ? 'bg-blue-600 text-white'
                            : 'bg-client-primary text-black font-black'
                      }`}>
                        {product.badge}
                      </span>
                    )}

                    {/* Heart button */}
                    <button
                      onClick={() => toggleWishlist(product.id)}
                      className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md border border-white/5 flex items-center justify-center hover:scale-110 hover:bg-black/80 transition-all cursor-pointer"
                    >
                      <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-red-500 stroke-red-500' : 'text-white'}`} />
                    </button>

                    {/* Image top container */}
                    <div className="relative aspect-square w-full bg-[#151515] overflow-hidden select-none">
                      <img
                        src={product.image || NO_IMAGE_PLACEHOLDER} onError={handleImageError}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        loading="lazy"
                      />
                      
                      {/* Dark overlay with hover quick-view */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 z-10 pointer-events-none group-hover:pointer-events-auto">
                        <button
                          onClick={() => setSelectedProduct(product)}
                          className="px-4 py-2 bg-white text-black font-extrabold text-[10px] uppercase tracking-wider rounded-lg flex items-center gap-1.5 hover:scale-105 transition-all cursor-pointer shadow-lg"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Quick View</span>
                        </button>
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="p-5 flex flex-col flex-grow text-left relative">
                      
                      {/* Category Label */}
                      <span className="text-[9px] font-extrabold text-client-primary uppercase tracking-widest block mb-1">
                        {product.category}
                      </span>

                      {/* Title */}
                      <h3 className="text-sm font-extrabold text-app-text font-heading group-hover:text-client-primary transition-colors line-clamp-1 mb-2">
                        {product.name}
                      </h3>

                      {/* Ratings stars */}
                      <div className="flex items-center gap-1.5 mb-3">
                        <div className="flex items-center text-amber-500">
                          <Star className="w-3 h-3 fill-current" />
                          <span className="text-[10px] font-extrabold text-white ml-1">{product.rating}</span>
                        </div>
                        <span className="text-[10px] text-app-text-muted">({product.reviews} reviews)</span>
                      </div>

                      {/* Specs tags */}
                      <div className="flex flex-wrap gap-1.5 mb-4 flex-grow select-none">
                        {product.specs.slice(0, 2).map((sp, sIdx) => (
                          <span key={sIdx} className="px-2 py-0.5 bg-white/5 border border-white/5 rounded text-[9px] text-app-text-muted font-medium">
                            {sp}
                          </span>
                        ))}
                      </div>

                      {/* Price & Buy panel */}
                      <div className="flex items-center justify-between pt-4 border-t border-app-border/40">
                        <div className="flex flex-col text-left">
                          <span className="text-xs text-app-text-muted line-through font-medium">
                            ₹{product.originalPrice.toLocaleString('en-IN')}
                          </span>
                          <span className="text-base font-black text-app-text">
                            ₹{product.price.toLocaleString('en-IN')}
                          </span>
                        </div>

                        {/* Add to Cart CTA */}
                        <button
                          onClick={() => addToCart(product)}
                          className="px-3.5 py-2.5 bg-client-primary/10 hover:bg-client-primary border border-client-primary/20 hover:border-client-primary text-client-primary hover:text-black font-extrabold text-[10px] uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>Buy</span>
                        </button>
                      </div>

                    </div>
                  </motion.div>
                );
              })
            ) : (
              <motion.div 
                layout
                className="col-span-full py-16 text-center space-y-4"
              >
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto text-client-primary">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                </div>
                <h3 className="text-lg font-bold text-white">No Products Found</h3>
                <p className="text-xs text-app-text-muted max-w-sm mx-auto">
                  We couldn't find any products matching your current category selection or search query. Try clearing filters.
                </p>
                <button
                  onClick={() => { setSelectedCategory('All'); setSearchQuery(''); }}
                  className="px-4 py-2 bg-client-primary/10 border border-client-primary/25 hover:bg-client-primary hover:text-black text-client-primary font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                >
                  Clear Filters
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>

      {/* Cart Sliding Drawer Overlay */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-black z-50 cursor-pointer"
            />

            {/* Sliding Drawer panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-[#0a0a0a] border-l border-app-border/40 p-6 sm:p-8 shadow-2xl z-55 flex flex-col justify-between"
            >
              
              {/* Drawer Top */}
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-app-border/40 pb-4">
                  <div className="flex items-center gap-2 text-white">
                    <ShoppingBag className="w-5 h-5 text-client-primary" />
                    <h3 className="text-base font-black font-heading tracking-tight">Your Cart</h3>
                    <span className="bg-client-primary/20 text-client-primary border border-client-primary/25 text-[10px] font-black px-2 py-0.5 rounded-full">
                      {cartItemCount}
                    </span>
                  </div>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="w-8 h-8 rounded-full bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Cart list items */}
                <div className="space-y-4 overflow-y-auto max-h-[50vh] pr-2 no-scrollbar">
                  {cart.length > 0 ? (
                    cart.map(item => (
                      <div 
                        key={item.product.id}
                        className="flex items-center gap-4 bg-[#111] border border-app-border rounded-xl p-3 relative group"
                      >
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-white/5 shrink-0 select-none">
                          <img 
                            src={item.product.image} 
                            alt={item.product.name} 
                            className="w-full h-full object-cover"
                          />
                        </div>
                        
                        <div className="flex-grow space-y-1">
                          <h4 className="text-xs font-black text-white font-heading truncate max-w-[180px]">
                            {item.product.name}
                          </h4>
                          <span className="text-[10px] text-client-primary font-bold">
                            {item.product.category}
                          </span>
                          
                          {/* Qty panel */}
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => updateCartQuantity(item.product.id, -1)}
                              className="w-5 h-5 rounded bg-white/5 text-white hover:bg-white/10 flex items-center justify-center font-bold text-xs"
                            >
                              -
                            </button>
                            <span className="text-xs font-bold text-white w-4 text-center">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateCartQuantity(item.product.id, 1)}
                              className="w-5 h-5 rounded bg-white/5 text-white hover:bg-white/10 flex items-center justify-center font-bold text-xs"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Price side & Remove btn */}
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <span className="text-xs font-black text-white">
                            ₹{(item.product.price * item.quantity).toLocaleString('en-IN')}
                          </span>
                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            className="text-app-text-muted hover:text-red-400 text-[10px] font-bold"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-16 text-center space-y-4">
                      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto text-client-primary">
                        <ShoppingCart className="w-5 h-5" />
                      </div>
                      <h4 className="text-sm font-bold text-white">Your Cart is Empty</h4>
                      <p className="text-[11px] text-app-text-muted max-w-[200px] mx-auto leading-relaxed">
                        Add top e-commerce products from our premium catalog.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Drawer Bottom controls */}
              <div className="border-t border-app-border/40 pt-4 space-y-4 bg-[#0a0a0a]">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-app-text-muted font-semibold">Subtotal:</span>
                  <span className="text-lg font-black text-white">
                    ₹{cartTotalPrice.toLocaleString('en-IN')}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { setCart([]); addToast('Cleared Cart', 'info'); }}
                    disabled={cart.length === 0}
                    className="py-3 bg-white/5 hover:bg-red-950/20 hover:text-red-400 border border-white/5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Clear Cart
                  </button>
                  <button
                    onClick={() => { addToast('Order Placed Successfully! (Simulation)', 'success'); setCart([]); setIsCartOpen(false); }}
                    disabled={cart.length === 0}
                    className="py-3 bg-client-primary hover:bg-client-primary-hover text-black rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg hover:shadow-[0_0_20px_rgba(215,25,32,0.3)] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Checkout
                  </button>
                </div>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Quick View Product Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="fixed inset-0 bg-black z-50 cursor-pointer"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl bg-[#0a0a0a] border border-app-border/40 rounded-3xl p-6 sm:p-8 shadow-2xl z-55 max-h-[85vh] overflow-y-auto no-scrollbar flex flex-col md:grid md:grid-cols-12 gap-8 text-left"
            >
              
              {/* Close button */}
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-6 right-6 z-20 w-8 h-8 rounded-full bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 hover:text-white transition-colors cursor-pointer animate-pulse"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Product Image Left col */}
              <div className="md:col-span-5 relative aspect-square rounded-2xl overflow-hidden bg-white/5 border border-app-border/40 select-none self-center w-full">
                <img 
                  src={selectedProduct.image} 
                  alt={selectedProduct.name} 
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Product Info Right col */}
              <div className="md:col-span-7 space-y-5 flex flex-col justify-between">
                <div className="space-y-3">
                  <span className="text-[10px] font-black text-client-primary uppercase tracking-widest bg-client-primary/10 border border-client-primary/20 px-2.5 py-1 rounded-md inline-block">
                    {selectedProduct.category}
                  </span>
                  
                  <h3 className="text-xl sm:text-2xl font-black font-heading text-white leading-tight">
                    {selectedProduct.name}
                  </h3>

                  {/* Rating block */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center text-amber-500">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span className="text-xs font-black text-white ml-1">{selectedProduct.rating}</span>
                    </div>
                    <span className="text-xs text-app-text-muted">|</span>
                    <span className="text-xs text-app-text-muted">{selectedProduct.reviews} Verified Customer Reviews</span>
                  </div>

                  {/* Price Block */}
                  <div className="flex items-end gap-3 pt-2">
                    <span className="text-xl sm:text-2xl font-black text-white">
                      ₹{selectedProduct.price.toLocaleString('en-IN')}
                    </span>
                    <span className="text-sm text-app-text-muted line-through font-medium mb-1">
                      ₹{selectedProduct.originalPrice.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] font-black text-client-primary bg-client-primary/10 border border-client-primary/20 px-2 py-0.5 rounded mb-1">
                      SAVE {Math.round(((selectedProduct.originalPrice - selectedProduct.price) / selectedProduct.originalPrice) * 100)}%
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-app-text-muted leading-relaxed">
                    {selectedProduct.description}
                  </p>

                  {/* Technical Specs checklist */}
                  <div className="space-y-2 pt-2">
                    <h5 className="text-[11px] font-black text-white uppercase tracking-wider">Product Highlights</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedProduct.specs.map((sp, spIdx) => (
                        <div key={spIdx} className="flex items-center gap-2 text-xs text-app-text font-medium">
                          <div className="w-4 h-4 rounded-full bg-client-primary/15 flex items-center justify-center text-client-primary shrink-0">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                          <span>{sp}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Action panel */}
                <div className="flex items-center gap-3 pt-6 border-t border-app-border/40 mt-6 md:mt-0">
                  <button
                    onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }}
                    className="flex-grow py-3.5 bg-client-primary hover:bg-client-primary-hover text-black font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-lg hover:shadow-[0_0_20px_rgba(215,25,32,0.35)] transition-all cursor-pointer"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>Add to Cart</span>
                  </button>
                  <button
                    onClick={() => toggleWishlist(selectedProduct.id)}
                    className="px-4 py-3.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-white transition-colors cursor-pointer"
                  >
                    <Heart className={`w-4 h-4 ${wishlist.includes(selectedProduct.id) ? 'fill-red-500 stroke-red-500' : ''}`} />
                  </button>
                </div>

              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}

