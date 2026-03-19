/**
 * Accessibility Utilities
 * Helper functions and hooks for accessibility improvements
 */
import React from 'react';
import { useEffect, useRef } from 'react';

/**
 * Hook to manage focus trap in modals
 */
export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    // Focus first element on mount
    firstElement?.focus();

    container.addEventListener('keydown', handleTabKey);

    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  }, [isActive]);

  return containerRef;
}

/**
 * Hook to announce content changes to screen readers
 */
export function useAnnouncer() {
  const announcerRef = useRef<HTMLDivElement>(null);

  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!announcerRef.current) return;

    announcerRef.current.setAttribute('aria-live', priority);
    announcerRef.current.textContent = message;

    // Clear after announcement
    setTimeout(() => {
      if (announcerRef.current) {
        announcerRef.current.textContent = '';
      }
    }, 1000);
  };

  return { announcerRef, announce };
}

/**
 * Generate unique ID for aria-describedby relationships
 */
let idCounter = 0;
export function generateId(prefix: string = 'a11y'): string {
  return `${prefix}-${++idCounter}`;
}

/**
 * Check if color contrast meets WCAG 2.2 AA standards
 */
export function checkColorContrast(foreground: string, background: string): {
  ratio: number;
  passes: boolean;
  level: 'AAA' | 'AA' | 'Fail';
} {
  // This is a simplified version - in production, use a library like 'color-contrast-checker'
  const getLuminance = (rgb: number[]) => {
    const [r, g, b] = rgb.map(val => {
      val = val / 255;
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  // Parse hex colors
  const parseHex = (hex: string): number[] => {
    const cleaned = hex.replace('#', '');
    return [
      parseInt(cleaned.substr(0, 2), 16),
      parseInt(cleaned.substr(2, 2), 16),
      parseInt(cleaned.substr(4, 2), 16),
    ];
  };

  const fgLuminance = getLuminance(parseHex(foreground));
  const bgLuminance = getLuminance(parseHex(background));

  const lighter = Math.max(fgLuminance, bgLuminance);
  const darker = Math.min(fgLuminance, bgLuminance);

  const ratio = (lighter + 0.05) / (darker + 0.05);

  return {
    ratio,
    passes: ratio >= 4.5,
    level: ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : 'Fail',
  };
}

/**
 * Keyboard navigation utilities
 */
export const KeyboardKeys = {
  TAB: 'Tab',
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
} as const;

/**
 * Handle keyboard navigation for lists
 */
export function handleListNavigation(
  event: React.KeyboardEvent,
  items: HTMLElement[],
  currentIndex: number,
  onSelect?: (index: number) => void
): number {
  switch (event.key) {
    case KeyboardKeys.ARROW_DOWN:
      event.preventDefault();
      return Math.min(currentIndex + 1, items.length - 1);

    case KeyboardKeys.ARROW_UP:
      event.preventDefault();
      return Math.max(currentIndex - 1, 0);

    case KeyboardKeys.HOME:
      event.preventDefault();
      return 0;

    case KeyboardKeys.END:
      event.preventDefault();
      return items.length - 1;

    case KeyboardKeys.ENTER:
    case KeyboardKeys.SPACE:
      event.preventDefault();
      onSelect?.(currentIndex);
      return currentIndex;

    default:
      return currentIndex;
  }
}

/**
 * Skip link component for keyboard users
 */
export function SkipLink({ targetId, label = 'Skip to main content' }: { targetId: string; label?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded"
    >
      {label}
    </a>
  );
}

/**
 * Screen reader only text component
 */
export function ScreenReaderOnly({ children }: { children: React.ReactNode }) {
  return (
    <span className="sr-only">
      {children}
    </span>
  );
}

/**
 * Visually hidden but accessible label
 */
export function VisuallyHidden({ as: Component = 'span', children, ...props }: { as?: React.ElementType; children?: React.ReactNode;[key: string]: unknown }) {
  return (
    <Component
      className="absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0"
      style={{ clip: 'rect(0, 0, 0, 0)' }}
      {...props}
    >
      {children}
    </Component>
  );
}
