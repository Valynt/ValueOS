/**
 * WarmthAnnouncer — Screen reader announcement component
 *
 * Announces warmth state changes to assistive technologies via aria-live region.
 * Visually hidden but announced by screen readers.
 *
 * Phase 4: Hardening - 4.2 Accessibility (WCAG 2.1 AA)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { WarmthState } from '@shared/domain/Warmth';

// Global event bus for warmth changes
const listeners = new Set<(message: string) => void>();

export function announceWarmthChange(
  previous: WarmthState | null,
  current: WarmthState,
  context: string = 'Case'
): void {
  const messages: Record<WarmthState, string> = {
    forming: `${context} is forming`,
    firm: `${context} is now firm`,
    verified: `${context} is verified and ready`,
  };

  const message = messages[current];

  // Notify all listeners
  listeners.forEach((listener) => listener(message));
}

interface WarmthAnnouncerProps {
  /** Optional custom prefix for announcements */
  prefix?: string;
}

export function WarmthAnnouncer({ prefix = '' }: WarmthAnnouncerProps): JSX.Element {
  const [announcement, setAnnouncement] = useState('');
  const queueRef = useRef<string[]>([]);
  const processingRef = useRef(false);

  // Process the next announcement from the queue
  const processQueue = useCallback(() => {
    if (processingRef.current || queueRef.current.length === 0) return;

    const nextMessage = queueRef.current.shift();
    if (nextMessage) {
      processingRef.current = true;
      setAnnouncement(nextMessage);
    }
  }, []);

  // Clear announcement and process next item in queue
  useEffect(() => {
    if (!announcement) {
      // If no announcement currently showing, try to process queue
      processingRef.current = false;
      processQueue();
      return;
    }

    // Clear after display duration and then process queue
    const timer = setTimeout(() => {
      setAnnouncement('');
    }, 1000);

    return () => clearTimeout(timer);
  }, [announcement, processQueue]);

  // Register listener for warmth change events (stable across renders)
  useEffect(() => {
    const listener = (message: string) => {
      const fullMessage = prefix ? `${prefix}: ${message}` : message;
      queueRef.current.push(fullMessage);
      processQueue();
    };

    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [prefix, processQueue]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      data-testid="warmth-announcer"
    >
      {announcement}
    </div>
  );
}

// Hook for announcing warmth changes
export function useWarmthAnnouncement(context: string = 'Case') {
  return useCallback(
    (previous: WarmthState | null, current: WarmthState) => {
      announceWarmthChange(previous, current, context);
    },
    [context]
  );
}
