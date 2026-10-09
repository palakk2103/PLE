import { useEffect } from 'react';
import { useSettingsStore } from '../store/settingsStore';

// Helper to calculate darker shade for hover states
export const darkenHex = (hex, percent = 15) => {
  if (!hex || typeof hex !== 'string') return hex;
  try {
    const cleanHex = hex.replace('#', '').trim();
    if (cleanHex.length !== 6 && cleanHex.length !== 3) return hex;
    const fullHex = cleanHex.length === 3
      ? cleanHex.split('').map((c) => c + c).join('')
      : cleanHex;
    const num = parseInt(fullHex, 16);
    if (isNaN(num)) return hex;
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00ff) - amt);
    const B = Math.max(0, (num & 0x0000ff) - amt);
    return `#${(0x1000000 + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
  } catch {
    return hex;
  }
};

export const applyThemeToDom = (theme = {}) => {
  if (typeof window === 'undefined' || !document?.documentElement) return;

  const primary = theme?.primaryColor || '#7B0A0A';
  const secondary = theme?.secondaryColor || '#3B82F6';
  const accent = theme?.accentColor || '#FFE11B';
  const font = theme?.fontFamily || 'Inter';
  const primaryHover = darkenHex(primary, 15);

  const root = document.documentElement;
  root.style.setProperty('--theme-primary', primary);
  root.style.setProperty('--theme-primary-hover', primaryHover);
  root.style.setProperty('--theme-secondary', secondary);
  root.style.setProperty('--theme-accent', accent);
  root.style.setProperty('--theme-font', `"${font}", sans-serif`);

  // Dynamically load Google Font if not standard system/inter font
  if (font && !['Inter', 'system-ui', 'sans-serif'].includes(font)) {
    const fontId = `google-font-${font.toLowerCase().replace(/\s+/g, '-')}`;
    if (!document.getElementById(fontId)) {
      const link = document.createElement('link');
      link.id = fontId;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@300;400;500;600;700;800&display=swap`;
      document.head.appendChild(link);
    }
  }

  if (document.body) {
    document.body.style.fontFamily = `"${font}", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  }
};

export const useDynamicTheme = () => {
  const theme = useSettingsStore((state) => state.settings?.theme);

  useEffect(() => {
    applyThemeToDom(theme);
  }, [theme]);
};

export default useDynamicTheme;
