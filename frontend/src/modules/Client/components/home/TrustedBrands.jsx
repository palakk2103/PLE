import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { ArrowRight, Award } from 'lucide-react';
import { API_BASE_URL } from '../../../../shared/utils/constants';

export default function TrustedBrands() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/brands/all`);
        if (res.data?.success) {
          setBrands(res.data.data || []);
        } else {
          setBrands(res.data || []);
        }
      } catch (err) {
        console.warn('Failed to fetch brands:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBrands();
  }, []);

  if (loading) {
    return (
      <div className="py-12 bg-app-bg text-center text-xs text-app-text-muted">
        Loading Trusted Brands...
      </div>
    );
  }

  if (!brands || brands.length === 0) return null;

  return (
    <section className="py-16 px-4 bg-app-bg relative overflow-hidden" id="brands">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/2 right-0 w-96 h-96 bg-client-primary/5 rounded-full filter blur-[130px] pointer-events-none" />
      <div className="absolute top-1/4 left-0 w-96 h-96 bg-client-primary/2 rounded-full filter blur-[130px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Header Block */}
        <div className="text-center space-y-4 mb-12 sm:mb-16 max-w-3xl mx-auto">
          <div className="flex items-center justify-center gap-3">
            <span className="w-8 h-[2px] bg-client-primary" />
            <span className="text-xs font-black text-client-primary uppercase tracking-[0.3em]">
              Authorized Portfolios
            </span>
            <span className="w-8 h-[2px] bg-client-primary" />
          </div>
          
          <h2 className="text-3xl sm:text-5xl font-black font-heading text-app-text leading-tight">
            Trusted <span className="text-client-primary">Electronics Brands</span>
          </h2>

          <p className="text-app-text-muted text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed">
            Direct partnerships with global manufacturers ensuring official warranty coverage, premium enterprise support, and bulk inventory access.
          </p>
        </div>

        {/* Brands Grid (Styled as ServiceCard) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {brands.slice(0, 6).map((brand, idx) => (
            <motion.div
              key={brand._id || idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ delay: idx * 0.05, duration: 0.5 }}
              className="group relative bg-app-card rounded-2xl border border-app-border hover:border-client-primary transition-all duration-300 shadow-md hover:shadow-xl flex flex-col h-full overflow-hidden text-left"
            >
              {/* Top Banner Image Section */}
              <div className="relative h-32 w-full overflow-hidden bg-white flex items-center justify-center border-b border-app-border/40">
                {brand.logo ? (
                  <img 
                    src={brand.logo} 
                    alt={brand.name} 
                    className="h-14 w-auto object-contain transition-transform duration-500 group-hover:scale-105 px-4"
                  />
                ) : (
                  <span className="text-xl font-black text-white/40 font-heading">{brand.name}</span>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />
              </div>

              {/* Content Section */}
              <div className="relative z-10 p-5 flex flex-col flex-grow">
                {/* Icon Overlay */}
                <div className="mb-4 w-12 h-12 rounded-xl bg-client-primary flex items-center justify-center text-black shadow-lg -mt-11 relative z-20 transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                  <Award className="w-6 h-6" />
                </div>
                
                {/* Title */}
                <h3 className="text-lg font-black font-heading text-app-text mb-2 group-hover:text-client-primary transition-colors duration-300">
                  {brand.name}
                </h3>

                {/* Description */}
                <p className="text-app-text-muted text-xs leading-relaxed mb-5 flex-grow line-clamp-2">
                  {brand.description || `Authorized products, certified distribution channels, and complete hardware support from ${brand.name}.`}
                </p>

                {/* CTA */}
                <a
                  href={brand.website || '#'}
                  target={brand.website ? '_blank' : '_self'}
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[11px] font-black text-client-primary uppercase tracking-wider group/link mt-auto"
                >
                  <span className="relative font-bold">
                    Explore Brand
                    <span className="absolute -bottom-0.5 left-0 w-0 h-0.5 bg-client-primary transition-all duration-300 group-hover/link:w-full" />
                  </span>
                  <ArrowRight className="w-3 h-3 group-hover/link:translate-x-1 transition-transform duration-300" />
                </a>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
