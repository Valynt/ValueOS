/**
 * Focus Trap Hook
 * 
 * Traps keyboard focus within a container element (modal, dialog, dropdown).
 * Implements WCAG 2.1 Level A requirement 2.1.2 (No Keyboard Trap with escape).
 * 
 * @example
 * const modalRef = useFocusTrap<HTMLDivElement>(isOpen);
 */

import { RefObject, useEffect, useRef } from 'react';

interface UseFocusTrapOptions {
  /** Allow Escape key to release focus trap */
  escapeDeactivates?: boolean;
  /** Callback when escape key is pressed */
  onEscape?: () => void;
  /** Return focus to this element on deactivation */
  returnFocusOnDeactivate?: boolean;
  /** Initial focus element selector */
  initialFocus?: string;
}

const FOCUSABLE_ELEMENTS = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useFocusTrap<T extends HTMLElement>(
  isActive: boolean,
  options: UseFocusTrapOptions = {}
): RefObject<T> {
  const {
    escapeDeactivates = true,
    onEscape,
    returnFocusOnDeactivate = true,
    initialFocus,
  } = options;

  const containerRef = useRef<T>(null);
  const previousActiveElement = useRef<Element | null>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;

    // Store previously focused element
    previousActiveElement.current = document.activeElement;

    // Get all focusable elements
    const getFocusableElements = (): HTMLElement[] => {
      return Array.from(container.querySelectorAll(FOCUSABLE_ELEMENTS));
    };

    // Set initial focus
    const setInitialFocus = () => {
      const focusableElements = getFocusableElements();
      
      if (initialFocus) {
        const initialElement = container.querySelector(initialFocus) as HTMLElement;
        if (initialElement) {
          initialElement.focus();
          return;
        }
      }

      // Focus first focusable element
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    };

    // Handle Tab key
    const handleKeyDown = (e: KeyboardEvent) => {
      const focusableElements = getFocusableElements();
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // Escape key
      if (e.key === 'Escape' && escapeDeactivates) {
        e.preventDefault();
        onEscape?.();
        return;
      }

      // Tab key
      if (e.key === 'Tab') {
        // No focusable elements
        if (focusableElements.length === 0) {
          e.preventDefault();
          return;
        }

        // Shift + Tab (backward)
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        }
        // Tab (forward)
        else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    // Set initial focus after a brief delay to ensure DOM is ready
    const timeoutId = setTimeout(setInitialFocus, 10);

    // Add event listener
    container.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      clearTimeout(timeoutId);
      container.removeEventListener('keydown', handleKeyDown);

      // Return focus to previous element
      if (returnFocusOnDeactivate && previousActiveElement.current) {
        (previousActiveElement.current as HTMLElement).focus?.();
      }
    };
  }, [isActive, escapeDeactivates, onEscape, returnFocusOnDeactivate, initialFocus]);

  return containerRef;
}
