import React, { createContext, useContext, useEffect } from 'react';

interface A11yContextType {
  announceToScreenReader: (message: string) => void;
  focusTrap: (element: HTMLElement) => () => void;
}

const A11yContext = createContext<A11yContextType | null>(null);

export function useA11y() {
  const context = useContext(A11yContext);
  if (!context) {
    // Fallback implementation for when context is not available
    return {
      announceToScreenReader: (message: string) => {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.style.position = 'absolute';
        announcement.style.left = '-10000px';
        announcement.style.width = '1px';
        announcement.style.height = '1px';
        announcement.style.overflow = 'hidden';
        document.body.appendChild(announcement);
        announcement.textContent = message;
        setTimeout(() => document.body.removeChild(announcement), 1000);
      },
      focusTrap: () => () => {} // No-op fallback
    };
  }
  return context;
}

export function A11yProvider({ children }: { children: React.ReactNode }) {
  const announceToScreenReader = (message: string) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.style.width = '1px';
    announcement.style.height = '1px';
    announcement.style.overflow = 'hidden';
    document.body.appendChild(announcement);
    announcement.textContent = message;
    setTimeout(() => document.body.removeChild(announcement), 1000);
  };

  const focusTrap = (element: HTMLElement) => {
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }

      if (e.key === 'Escape') {
        // Could emit an event to close modal/drawer
      }
    };

    element.addEventListener('keydown', handleKeyDown);

    // Focus first element
    if (firstElement) {
      firstElement.focus();
    }

    return () => {
      element.removeEventListener('keydown', handleKeyDown);
    };
  };

  return (
    <A11yContext.Provider value={{ announceToScreenReader, focusTrap }}>
      {children}
    </A11yContext.Provider>
  );
}

// Utility functions for common accessibility patterns
export const a11y = {
  // Skip link for keyboard navigation
  skipLink: (href: string, text: string = 'Skip to main content') => (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary text-primary-foreground px-4 py-2 rounded-md z-50"
    >
      {text}
    </a>
  ),

  // Live region for dynamic content announcements
  liveRegion: (children: React.ReactNode, priority: 'polite' | 'assertive' = 'polite') => (
    <div aria-live={priority} aria-atomic="true" className="sr-only">
      {children}
    </div>
  ),

  // Focus management utilities
  manageFocus: {
    // Move focus to element after render
    focusOnRender: (ref: React.RefObject<HTMLElement>) => {
      useEffect(() => {
        if (ref.current) {
          ref.current.focus();
        }
      }, []);
    },

    // Return focus to previous element when component unmounts
    returnFocus: (shouldReturn: boolean = true) => {
      const previousFocus = document.activeElement as HTMLElement;

      useEffect(() => {
        return () => {
          if (shouldReturn && previousFocus && 'focus' in previousFocus) {
            previousFocus.focus();
          }
        };
      }, [shouldReturn]);
    }
  },

  // Keyboard navigation helpers
  keyboard: {
    // Handle Enter/Space key presses like button clicks
    handleActionKey: (handler: () => void) => (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handler();
      }
    },

    // Handle arrow key navigation for custom components
    handleArrowNavigation: (
      items: unknown[],
      currentIndex: number,
      setCurrentIndex: (index: number) => void
    ) => (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCurrentIndex(currentIndex < items.length - 1 ? currentIndex + 1 : 0);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCurrentIndex(currentIndex > 0 ? currentIndex - 1 : items.length - 1);
      }
    }
  }
};
