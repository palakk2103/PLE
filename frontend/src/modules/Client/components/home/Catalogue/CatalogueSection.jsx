import React, { useState, useEffect } from 'react';
import { BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import * as pdfjsLib from 'pdfjs-dist';

import CatalogueBook from './CatalogueBook';
import CatalogueControls from './CatalogueControls';
import CatalogueFullscreen from './CatalogueFullscreen';
import CatalogueThumbnails from './CatalogueThumbnails';
import './catalogue.css';
import { useCMS } from '../../../hooks/useCMS';

// Set matching version of the PDF.js web worker via CDN to avoid bundler payload issues
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/build/pdf.worker.min.mjs';

// Configurable Constants
const PAGE_DURATION = 5000; // 5 seconds display duration
const PAGE_TURN_DURATION = 1200; // 1.2 seconds animation transition duration

// Error Boundary Component to catch downstream rendering exceptions and trigger fallback
class CatalogueErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Interactive Catalogue rendering error:', error, errorInfo);
    if (this.props.onFallback) {
      this.props.onFallback();
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export default function CatalogueSection() {
  const { catalogue } = useCMS();
  const pdfUrl = catalogue?.pdfUrl || '/catalogue/PLE-Catalogue.pdf';
  const videoUrl = catalogue?.videoUrl || '/PLE_2026_Catalogue_Book_Slow_Pages.mp4';
  const badge = catalogue?.badge || 'Catalogue Portfolio';
  const title = catalogue?.title || 'Explore Our Digital Catalogue';
  const subtitle = catalogue?.subtitle || 'Flip through our verified selection of commercial components, IT infrastructure assets, corporate categories, and service capabilities.';

  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Responsive device width checker
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // PDF Loading
  useEffect(() => {
    let active = true;
    
    async function loadPDF() {
      try {
        setLoading(true);
        setError(false);
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        if (active) {
          setDoc(pdf);
          setTotalPages(pdf.numPages);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load catalogue PDF:', err);
        if (active) {
          setError(true);
          setLoading(false);
        }
      }
    }

    loadPDF();
    return () => {
      active = false;
    };
  }, [pdfUrl]);

  // Navigation Logic
  const handleNext = () => {
    if (isMobile) {
      if (currentPage < totalPages) {
        setCurrentPage((prev) => prev + 1);
      } else {
        setCurrentPage(1); // loop
      }
    } else {
      if (currentPage === 1) {
        setCurrentPage(2);
      } else if (currentPage + 2 <= totalPages) {
        setCurrentPage((prev) => prev + 2);
      } else {
        setCurrentPage(1); // loop
      }
    }
  };

  const handlePrev = () => {
    if (isMobile) {
      if (currentPage > 1) {
        setCurrentPage((prev) => prev - 1);
      }
    } else {
      if (currentPage === 2) {
        setCurrentPage(1);
      } else if (currentPage > 2) {
        setCurrentPage((prev) => prev - 2);
      }
    }
  };

  const userNext = () => {
    setIsPlaying(false);
    handleNext();
  };

  const userPrev = () => {
    setIsPlaying(false);
    handlePrev();
  };

  const handleThumbnailNavigate = (pageNum) => {
    setIsPlaying(false);
    setCurrentPage(pageNum);
  };

  // Autoplay Effect
  useEffect(() => {
    if (!isPlaying || !doc || totalPages === 0) return;

    const timer = setTimeout(() => {
      handleNext();
    }, PAGE_DURATION);

    return () => clearTimeout(timer);
  }, [isPlaying, currentPage, totalPages, doc, isMobile]);

  // Fullscreen Keyboard Navigation support
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isFullscreen) {
        if (e.key === 'ArrowRight') {
          userNext();
        } else if (e.key === 'ArrowLeft') {
          userPrev();
        } else if (e.key === ' ') {
          e.preventDefault();
          setIsPlaying((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, currentPage, totalPages, isMobile]);

  // Renders the original working video player
  const renderOriginalVideo = () => {
    return (
      <div className="w-full rounded-2xl overflow-hidden border border-app-border bg-white shadow-2xl">
        <video 
          className="w-full h-auto aspect-video object-cover" 
          controls 
          autoPlay 
          muted 
          loop 
          playsInline
          src={videoUrl}
        >
          Your browser does not support the video tag.
        </video>
      </div>
    );
  };

  // Main interactive catalogue components rendering
  const renderCatalogue = () => {
    return (
      <CatalogueErrorBoundary 
        fallback={renderOriginalVideo()} 
        onFallback={() => setError(true)}
      >
        <CatalogueBook
          doc={doc}
          totalPages={totalPages}
          currentPage={currentPage}
          zoom={zoom}
          isMobile={isMobile}
          onNavigate={handleThumbnailNavigate}
        />
        
        <CatalogueControls
          currentPage={currentPage}
          totalPages={totalPages}
          zoom={zoom}
          isFullscreen={isFullscreen}
          isMobile={isMobile}
          onPrev={userPrev}
          onNext={userNext}
          onZoomIn={() => setZoom((z) => Math.min(z + 0.2, 2.0))}
          onZoomOut={() => setZoom((z) => Math.max(z - 0.2, 0.8))}
          onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
          pdfUrl={pdfUrl}
        />

        {/* Thumbnail Preview Strip */}
        <CatalogueThumbnails
          doc={doc}
          totalPages={totalPages}
          currentPage={currentPage}
          onNavigate={handleThumbnailNavigate}
        />
      </CatalogueErrorBoundary>
    );
  };

  return (
    <section className="py-20 px-4 bg-app-bg relative overflow-hidden" id="catalogue">
      {/* Background Ambience */}
      <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-client-primary/3 rounded-full filter blur-[130px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-client-primary/5 rounded-full filter blur-[130px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Section Header */}
        <div className="text-center space-y-4 mb-12 max-w-3xl mx-auto">
          <div className="flex items-center justify-center gap-3">
            <span className="w-8 h-[2px] bg-client-primary" />
            <span className="text-xs font-black text-client-primary uppercase tracking-[0.3em] flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              {badge}
            </span>
            <span className="w-8 h-[2px] bg-client-primary" />
          </div>
          
          <h2 className="text-3xl sm:text-5xl font-black font-heading text-app-text leading-tight">
            {title.includes('Digital Catalogue') ? (
              <>
                {title.replace('Digital Catalogue', '')} <span className="text-client-primary">Digital Catalogue</span>
              </>
            ) : (
              title
            )}
          </h2>

          <p className="text-app-text-muted text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed">
            {subtitle}
          </p>
        </div>

        {/* Premium Entrance Motion Wrapper */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-5xl mx-auto"
        >
          {loading && !error && (
            <div className="w-full h-[60vh] flex flex-col items-center justify-center bg-app-card rounded-2xl border border-app-border shadow-2xl p-6">
              <div className="w-12 h-12 border-4 border-client-primary border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm font-bold text-app-text">Initializing Premium Flipbook...</p>
              <p className="text-xs text-app-text-muted mt-1">Preparing catalog pages & assets</p>
            </div>
          )}

          {error && renderOriginalVideo()}

          {!loading && !error && renderCatalogue()}
        </motion.div>
      </div>

      {/* Fullscreen Reading Mode Portal overlay */}
      <CatalogueFullscreen
        isOpen={isFullscreen}
        onClose={() => setIsFullscreen(false)}
      >
        <div className="flex-grow flex flex-col justify-center items-center">
          <CatalogueErrorBoundary 
            fallback={renderOriginalVideo()} 
            onFallback={() => setError(true)}
          >
            <CatalogueBook
              doc={doc}
              totalPages={totalPages}
              currentPage={currentPage}
              zoom={zoom}
              isMobile={isMobile}
              onNavigate={handleThumbnailNavigate}
            />
            <CatalogueControls
              currentPage={currentPage}
              totalPages={totalPages}
              zoom={zoom}
              isFullscreen={isFullscreen}
              isMobile={isMobile}
              onPrev={userPrev}
              onNext={userNext}
              onZoomIn={() => setZoom((z) => Math.min(z + 0.2, 2.0))}
              onZoomOut={() => setZoom((z) => Math.max(z - 0.2, 0.8))}
              onToggleFullscreen={() => setIsFullscreen(false)}
              pdfUrl="/catalogue/PLE-Catalogue.pdf"
            />
          </CatalogueErrorBoundary>
        </div>
      </CatalogueFullscreen>
    </section>
  );
}
