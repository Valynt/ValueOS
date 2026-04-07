/**
 * FocusTrap — Traps focus within a modal or panel
 *
 * Implements focus management for accessibility compliance.
 * Returns focus to trigger element when closed.
 *
 * Phase 4: Hardening - 4.2.6 Focus management
 */

import { useEffect, useRef, useCallback } from 'react';

interface FocusTrapProps {
  /** Whether the trap is active */
  active: boolean;
  /** Elements to include in focus trap */
  children: React.ReactNode;
  /** Callback when escape key is pressed */
  onEscape?: () => void;
  /** Ref to return focus to when trap is deactivated */
  returnFocusTo?: React.RefObject<HTMLElement>;
  /** Disable focus trap (for debugging) */
  disabled?: boolean;
}

// Selectors for focusable elements
const FOCUSABLE_SELECTORS = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function FocusTrap({
  active,
  children,
  onEscape,
  returnFocusTo,
  disabled = false,
}: FocusTrapProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Store previously focused element when trap activates
  useEffect(() => {
    if (active && !disabled) {
      previousActiveElement.current = document.activeElement as HTMLElement;
    }
  }, [active, disabled]);

  // Return focus when trap deactivates
  useEffect(() => {
    return () => {
      if (!active || disabled) return;

      const returnTo = returnFocusTo?.current || previousActiveElement.current;
      if (returnTo && document.contains(returnTo)) {
        returnTo.focus();
      }
    };
  }, [active, disabled, returnFocusTo]);

  // Get all focusable elements within container
  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];

    const elements = Array.from(
      containerRef.current.querySelectorAll(FOCUSABLE_SELECTORS)
    ) as HTMLElement[];

    return elements.filter((el) => {
      // Check visibility
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
  }, []);

  // Handle tab navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!active || disabled) return;

      // Handle escape key
      if (e.key === 'Escape' && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }

      // Handle tab key
      if (e.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        e.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement as HTMLElement;

      // Guard against empty focusable elements
      if (!firstElement || !lastElement) return;

      // Shift + Tab: move backwards
      if (e.shiftKey) {
        if (activeElement === firstElement || !containerRef.current?.contains(activeElement)) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: move forwards
        if (activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    },
    [active, disabled, getFocusableElements, onEscape]
  );

  // Auto-focus first element when trap activates
  useEffect(() => {
    if (!active || disabled) return;

    const timer = setTimeout(() => {
      const focusableElements = getFocusableElements();
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [active, disabled, getFocusableElements]);

  // Add keyboard listener
  useEffect(() => {
    if (!active || disabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [active, disabled, handleKeyDown]);

  return (
    <div ref={containerRef} data-focus-trap={active ? 'active' : 'inactive'}>
      {children}
    </div>
  );
}

// Hook for managing focus within a component
interface UseFocusManagerOptions {
  /** Initial focus target */
  initialFocus?: string;
  /** Restore focus on unmount */
  restoreFocus?: boolean;
}

export function useFocusManager(options: UseFocusManagerOptions = {}): {
  /** Set focus to an element by selector */
  focus: (selector: string) => void;
  /** Focus the next focusable element */
  focusNext: () => void;
  /** Focus the previous focusable element */
  focusPrevious: () => void;
} {
  const { initialFocus, restoreFocus = true } = options;
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Store current focus
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Set initial focus
    if (initialFocus) {
      const element = document.querySelector(initialFocus) as HTMLElement;
      if (element) {
        element.focus();
      }
    }

    return () => {
      if (restoreFocus && previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [initialFocus, restoreFocus]);

  const focus = useCallback((selector: string) => {
    const element = document.querySelector(selector) as HTMLElement;
    if (element) {
      element.focus();
    }
  }, []);

  const focusNext = useCallback(() => {
    const focusable = Array.from(
      document.querySelectorAll(FOCUSABLE_SELECTORS)
    ) as HTMLElement[];
    const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
    const nextElement = focusable[currentIndex + 1] || focusable[0];
    if (nextElement) {
      nextElement.focus();
    }
  }, []);

  const focusPrevious = useCallback(() => {
    const focusable = Array.from(
      document.querySelectorAll(FOCUSABLE_SELECTORS)
    ) as HTMLElement[];
    const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
    const prevElement = focusable[currentIndex - 1] || focusable[focusable.length - 1];
    if (prevElement) {
      prevElement.focus();
    }
  }, []);

  return { focus, focusNext, focusPrevious };
}

// Skip link for keyboard navigation
interface SkipLinkProps {
  /** Target element ID to skip to */
  targetId: string;
  /** Link text */
  text?: string;
}

export function SkipLink({
  targetId,
  text = 'Skip to main content',
}: SkipLinkProps): JSX.Element {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.tabIndex = -1;
      target.focus();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-white focus:outline-none"
    >
      {text}
    </a>
  );
}
