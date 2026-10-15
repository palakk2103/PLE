export const applyThemeToDom = () => {
  if (typeof window !== 'undefined' && document?.documentElement) {
    const root = document.documentElement;
    root.style.removeProperty('--theme-primary');
    root.style.removeProperty('--theme-primary-hover');
    root.style.removeProperty('--theme-secondary');
    root.style.removeProperty('--theme-accent');
    root.style.removeProperty('--theme-font');
  }
};

export const useDynamicTheme = () => {
  // Theme override disabled
};

export default useDynamicTheme;
