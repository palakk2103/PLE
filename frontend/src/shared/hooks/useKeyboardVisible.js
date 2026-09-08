import { useState, useEffect } from 'react';

/**
 * Custom hook to detect if the mobile virtual keyboard is currently visible/open.
 * Combines window.visualViewport, window resize, screen height comparison, and active input focus
 * events for immediate, zero-lag, and reliable cross-browser/cross-platform detection on mobile & webviews.
 */
const checkIsInputFocused = () => {
  if (typeof document === 'undefined') return false;
  const activeEl = document.activeElement;
  if (!activeEl) return false;
  const tag = (activeEl.tagName || '').toUpperCase();
  const type = (activeEl.type || '').toLowerCase();
  const nonTextInputTypes = ['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'image', 'range', 'color'];

  return Boolean(
    (tag === 'INPUT' && !nonTextInputTypes.includes(type)) ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    activeEl.isContentEditable
  );
};

export const useKeyboardVisible = () => {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(() => checkIsInputFocused());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let maxViewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    let maxInnerHeight = window.innerHeight;

    const checkKeyboard = () => {
      const isTextInput = checkIsInputFocused();

      // Update baseline heights when no input is focused to handle dynamic address bars
      if (!isTextInput) {
        if (window.visualViewport) {
          maxViewportHeight = Math.max(maxViewportHeight, window.visualViewport.height);
        }
        maxInnerHeight = Math.max(maxInnerHeight, window.innerHeight);
      }

      // 1. Check visualViewport shrinkage (Supported on modern Android Chrome / iOS / WebView)
      let viewportShrunk = false;
      if (window.visualViewport) {
        const currentViewportHeight = window.visualViewport.height;
        const diffFromMax = maxViewportHeight - currentViewportHeight;
        const screenHeight = window.screen ? window.screen.height : window.innerHeight;
        const diffFromScreen = screenHeight - currentViewportHeight;

        if (diffFromMax > 120 || (diffFromScreen > 180 && isTextInput) || currentViewportHeight < maxViewportHeight * 0.82) {
          viewportShrunk = true;
        }
      }

      // 2. Check window.innerHeight shrinkage (For WebViews where resize modifies innerHeight)
      const currentInnerHeight = window.innerHeight;
      const windowShrunk = (maxInnerHeight - currentInnerHeight) > 120;

      const keyboardOpen = isTextInput || viewportShrunk || windowShrunk;

      setIsKeyboardVisible(keyboardOpen);

      // Toggle helper class on body
      if (keyboardOpen) {
        document.body.classList.add('keyboard-open');
      } else {
        document.body.classList.remove('keyboard-open');
      }
    };

    // Immediate check on mount
    checkKeyboard();

    const handleFocusIn = (e) => {
      const tag = (e.target?.tagName || '').toUpperCase();
      const type = (e.target?.type || '').toLowerCase();
      const nonTextInputTypes = ['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'image', 'range', 'color'];

      if ((tag === 'INPUT' && !nonTextInputTypes.includes(type)) || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) {
        setIsKeyboardVisible(true);
        document.body.classList.add('keyboard-open');
      } else {
        checkKeyboard();
      }
    };

    const handleFocusOut = () => {
      // Short delay to allow focus transition between inputs without flickering
      setTimeout(() => {
        checkKeyboard();
      }, 100);
    };

    const handleResize = () => {
      checkKeyboard();
    };

    // Event listeners with capture for instantaneous trigger
    window.addEventListener('focusin', handleFocusIn, { passive: true, capture: true });
    window.addEventListener('focusout', handleFocusOut, { passive: true, capture: true });
    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize, { passive: true });
      window.visualViewport.addEventListener('scroll', handleResize, { passive: true });
    }

    return () => {
      window.removeEventListener('focusin', handleFocusIn, { capture: true });
      window.removeEventListener('focusout', handleFocusOut, { capture: true });
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
        window.visualViewport.removeEventListener('scroll', handleResize);
      }
      document.body.classList.remove('keyboard-open');
    };
  }, []);

  return isKeyboardVisible;
};

export default useKeyboardVisible;
