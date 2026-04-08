// Hook for tracking warmth transitions and triggering animations
// Phase 4: Hardening - 4.1 Animation & Micro-interactions

import { useEffect } from 'react';
import { injectWarmthAnimationStyles, warmthAnimationClasses } from '@/lib/animations';
import type { WarmthState } from '@/lib/warmth';

interface UseWarmthTransitionOptions {
  onTransition?: (previous: WarmthState, current: WarmthState) => void;
  announceToScreenReader?: boolean;
  context?: string;
}

export function useWarmthTransition(
  previousWarmth: WarmthState | null,
  currentWarmth: WarmthState,
  elementRef: React.RefObject<HTMLElement>,
  options: UseWarmthTransitionOptions = {}
): void {
  const {
    onTransition,
    announceToScreenReader = true,
    context = 'Case'
  } = options;

  // Inject animation styles on first use
  useEffect(() => {
    injectWarmthAnimationStyles();
  }, []);

  useEffect(() => {
    // Skip if no previous state (initial render) or no change
    if (!previousWarmth || previousWarmth === currentWarmth) return void 0;

    const element = elementRef.current;
    if (!element) return void 0;

    // Trigger solidify animation for forming -> firm transition
    if (previousWarmth === 'forming' && currentWarmth === 'firm') {
      element.classList.add(warmthAnimationClasses.solidify);

      // Remove class after animation completes
      const timer = setTimeout(() => {
        element.classList.remove(warmthAnimationClasses.solidify);
      }, 300);

      return () => clearTimeout(timer);
    }

    // Add glow for verified state
    if (currentWarmth === 'verified') {
      element.classList.add(warmthAnimationClasses.glow);
    } else {
      element.classList.remove(warmthAnimationClasses.glow);
    }

    // Call callback if provided
    onTransition?.(previousWarmth, currentWarmth);

    // Announce to screen reader
    if (announceToScreenReader && typeof window !== 'undefined' && context) {
      const messages: Record<WarmthState, string> = {
        forming: `${context} is forming`,
        firm: `${context} is now firm`,
        verified: `${context} is verified and ready`,
      };

      announceToScreenReaderUtil(messages[currentWarmth]);
    }
  }, [previousWarmth, currentWarmth, elementRef, onTransition, announceToScreenReader, context]);
}

// Utility to announce to screen reader
export function announceToScreenReaderUtil(message: string): void {
  if (typeof document === 'undefined') return;

  // Create or find announcer element
  let announcer = document.getElementById('warmth-announcer');
  if (!announcer) {
    announcer = document.createElement('div');
    announcer.id = 'warmth-announcer';
    announcer.setAttribute('role', 'status');
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    announcer.className = 'sr-only';
    document.body.appendChild(announcer);
  }

  // Set message
  announcer.textContent = message;

  // Clear after announcement (screen readers typically announce on content change)
  setTimeout(() => {
    if (announcer) announcer.textContent = '';
  }, 1000);
}
