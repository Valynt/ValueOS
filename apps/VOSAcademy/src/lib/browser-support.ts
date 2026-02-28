/**
 * Cross-browser compatibility utilities
 * Ensures consistent behavior across different browsers
 */

import { logger } from './logger';

export const browserSupport = {
  // Check for modern browser features
  supportsIntersectionObserver: () => 'IntersectionObserver' in window,
  supportsResizeObserver: () => 'ResizeObserver' in window,
  supportsCSSGrid: () => CSS.supports('display', 'grid'),
  supportsFlexbox: () => CSS.supports('display', 'flex'),
  supportsCustomProperties: () => CSS.supports('--custom-property', 'value'),

  // Polyfills and fallbacks
  initPolyfills: () => {
    // Intersection Observer polyfill
    if (!browserSupport.supportsIntersectionObserver()) {
      import('intersection-observer').then(() => {
        logger.debug("Intersection Observer polyfill loaded");
      }).catch(() => {
        logger.warn("Failed to load Intersection Observer polyfill");
      });
    }

    // Resize Observer polyfill
    if (!browserSupport.supportsResizeObserver()) {
      import('resize-observer-polyfill').then(() => {
        logger.debug("Resize Observer polyfill loaded");
      }).catch(() => {
        logger.warn("Failed to load Resize Observer polyfill");
      });
    }
  },

  // Browser detection (for targeted fixes)
  isSafari: () => /^((?!chrome|android).)*safari/i.test(navigator.userAgent),
  isFirefox: () => navigator.userAgent.toLowerCase().includes('firefox'),
  isChrome: () => navigator.userAgent.toLowerCase().includes('chrome'),
  isEdge: () => navigator.userAgent.toLowerCase().includes('edg'),
  isIE: () => navigator.userAgent.toLowerCase().includes('trident'),

  // Mobile detection
  isMobile: () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
  isIOS: () => /iPad|iPhone|iPod/.test(navigator.userAgent),
  isAndroid: () => /Android/i.test(navigator.userAgent),

  // Feature detection for CSS
  supportsCSS: (property: string, value: string) => {
    return CSS.supports(property, value);
  },

  // Get browser info for debugging
  getBrowserInfo: () => ({
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    supportsIntersectionObserver: browserSupport.supportsIntersectionObserver(),
    supportsResizeObserver: browserSupport.supportsResizeObserver(),
    supportsCSSGrid: browserSupport.supportsCSSGrid(),
    supportsFlexbox: browserSupport.supportsFlexbox(),
    supportsCustomProperties: browserSupport.supportsCustomProperties(),
    isMobile: browserSupport.isMobile(),
    isIOS: browserSupport.isIOS(),
    isAndroid: browserSupport.isAndroid(),
  })
};

// Initialize polyfills on module load
if (typeof window !== 'undefined') {
  browserSupport.initPolyfills();
}

// Export for use in components
export default browserSupport;
