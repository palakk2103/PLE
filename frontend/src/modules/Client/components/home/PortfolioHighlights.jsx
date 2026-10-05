import React from 'react';
import { motion } from 'framer-motion';
import * as LucideIcons from 'lucide-react';
import { useCMS } from '../../hooks/useCMS';

export default function PortfolioHighlights() {
  const { portfolioHighlights, portfolioHighlightsHeader } = useCMS();

  if (!portfolioHighlights || portfolioHighlights.length === 0) return null;

  // Filter only active highlights
  const activeHighlights = portfolioHighlights
    .filter(hl => hl.status)
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

  if (activeHighlights.length === 0) return null;

  const badgeText = portfolioHighlightsHeader?.badge || 'Capability Showcase';
  const titleText = portfolioHighlightsHeader?.title || 'Enterprise Procurement Highlights';
  const subtitleText = portfolioHighlightsHeader?.subtitle || 'Strategic purchasing support options designed to maximize value, reduce IT administrative costs, and secure business operations.';

  return (
    <section className="py-20 px-4 bg-app-bg relative overflow-hidden" id="portfolio-highlights">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-client-primary/2 blur-[120px] pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Section Header */}
        <div className="text-center mb-16 space-y-3">
          <div className="flex items-center justify-center gap-3">
            <span className="w-6 h-[2px] bg-client-primary" />
            <span className="text-[10px] font-black text-client-primary uppercase tracking-[0.3em]">
              {badgeText}
            </span>
            <span className="w-6 h-[2px] bg-client-primary" />
          </div>
          <h2 className="text-3xl md:text-5xl font-black font-heading text-app-text">
            {titleText.includes('Procurement Highlights') ? (
              <>
                {titleText.replace('Procurement Highlights', '')}
                <span className="text-client-primary">Procurement Highlights</span>
              </>
            ) : (
              titleText
            )}
          </h2>
          <p className="text-sm text-app-text-muted max-w-xl mx-auto">
            {subtitleText}
          </p>
        </div>

        {/* Highlights Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {activeHighlights.map((hl, idx) => {
            const Icon = LucideIcons[hl.icon] || LucideIcons.HelpCircle;
            
            return (
              <motion.div
                key={hl.id || idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1, duration: 0.6 }}
                className="group flex flex-col justify-between bg-white dark:bg-app-card rounded-3xl border border-app-border/40 hover:border-client-primary/50 hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-500 overflow-hidden"
              >
                <div>
                  {/* Card Visual / Image */}
                  {hl.image && (
                    <div className="relative w-full h-[200px] overflow-hidden bg-slate-100 dark:bg-slate-900">
                      <img 
                        src={hl.image} 
                        alt={hl.title} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                    </div>
                  )}

                  {/* Info Wrapper */}
                  <div className="p-6 text-left">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-client-primary/10 text-client-primary flex items-center justify-center group-hover:bg-client-primary group-hover:text-black transition-colors duration-300">
                        <Icon size={20} />
                      </div>
                      <div>
                        <h4 className="text-xs text-client-primary font-black uppercase tracking-wider">{hl.subtitle}</h4>
                        <h3 className="text-lg font-black text-app-text font-heading leading-tight">{hl.title}</h3>
                      </div>
                    </div>
                    <p className="text-sm text-app-text-muted leading-relaxed font-medium mt-3">
                      {hl.description}
                    </p>
                  </div>
                </div>

                {/* Bottom CTA Button */}
                {hl.buttonText && (
                  <div className="p-6 pt-0">
                    <a
                      href={hl.buttonLink || '#'}
                      onClick={(e) => {
                        if (hl.buttonLink?.startsWith('#')) {
                          e.preventDefault();
                          document.getElementById(hl.buttonLink.substring(1))?.scrollIntoView({ behavior: 'smooth' });
                        }
                      }}
                      className="w-full py-3 bg-slate-100 hover:bg-client-primary hover:text-black text-app-text text-center text-xs font-black uppercase tracking-widest rounded-xl transition-all duration-300 block"
                    >
                      {hl.buttonText}
                    </a>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
