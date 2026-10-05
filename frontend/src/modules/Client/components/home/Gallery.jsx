import React from 'react';
import { motion } from 'framer-motion';
import { useCMS } from '../../hooks/useCMS';

export default function Gallery() {
  const { gallery, galleryHeader } = useCMS();

  if (!gallery || gallery.length === 0) return null;

  const title = galleryHeader?.title || 'Our Gallery';
  const subtitle = galleryHeader?.subtitle || 'Take a look at our creative projects, events, and modern working spaces.';

  return (
    <section className="py-20 relative overflow-hidden bg-app-bg text-app-text">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-client-primary/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-12">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-4xl md:text-5xl font-black mb-4 tracking-tight"
          >
            {title.includes('Gallery') ? (
              <>
                {title.replace('Gallery', '')} <span className="text-gradient-orange text-client-primary">Gallery</span>
              </>
            ) : (
              title
            )}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-app-text-muted text-lg max-w-xl mx-auto"
          >
            {subtitle}
          </motion.p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {gallery.map((img, idx) => (
            <motion.div
              key={img.id || idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
              className="group relative rounded-2xl overflow-hidden shadow-lg border border-slate-200 dark:border-app-border aspect-[4/3] cursor-pointer"
            >
              <img
                src={img.url}
                alt={img.title || 'Gallery image'}
                className="w-full h-full object-cover transition duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition duration-300 flex items-end p-6">
                <div>
                  <h3 className="text-white text-base font-bold translate-y-4 group-hover:translate-y-0 transition duration-300">
                    {img.title || 'Workspace'}
                  </h3>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

