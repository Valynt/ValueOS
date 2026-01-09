/**
 * React Hook for Customer Portal Analytics
 * 
 * Provides easy-to-use hooks for tracking analytics events in React components
 */

import { useCallback, useEffect, useRef } from 'react';
import {
  getPortalAnalytics,
  PortalEventProperties,
  trackBenchmarkView,
  trackEmailShare,
  trackError,
  trackExport,
  trackMetricView,
  trackPageView,
  trackTokenExpired,
  trackTokenValidation,
} from '../lib/analytics/customerPortalTracking';

/**
 * Hook to track page views and time on page
 */
export function usePageTracking(
  pageName: string,
  properties?: PortalEventProperties
): void {
  const startTimeRef = useRef<number>(Date.now());
  const hasTrackedRef = useRef<boolean>(false);

  useEffect(() => {
    // Track page view on mount
    if (!hasTrackedRef.current) {
      trackPageView(pageName, properties);
      hasTrackedRef.current = true;
      startTimeRef.current = Date.now();
    }

    // Track time on page on unmount
    return () => {
      const timeOnPage = Date.now() - startTimeRef.current;
      trackPageView(pageName, {
        ...properties,
        duration: timeOnPage,
      });
    };
  }, [pageName, properties]);
}

/**
 * Hook to track export actions
 */
export function useExportTracking() {
  return useCallback(
    (format: 'pdf' | 'excel', properties?: PortalEventProperties) => {
      trackExport(format, properties);
    },
    []
  );
}

/**
 * Hook to track email shares
 */
export function useEmailShareTracking() {
  return useCallback(
    (recipientCount: number, properties?: PortalEventProperties) => {
      trackEmailShare(recipientCount, properties);
    },
    []
  );
}

/**
 * Hook to track benchmark views
 */
export function useBenchmarkTracking() {
  return useCallback((kpiName: string, properties?: PortalEventProperties) => {
    trackBenchmarkView(kpiName, properties);
  }, []);
}

/**
 * Hook to track metric views
 */
export function useMetricTracking() {
  return useCallback((metricName: string, properties?: PortalEventProperties) => {
    trackMetricView(metricName, properties);
  }, []);
}

/**
 * Hook to track errors
 */
export function useErrorTracking() {
  return useCallback(
    (errorMessage: string, errorCode?: string, properties?: PortalEventProperties) => {
      trackError(errorMessage, errorCode, properties);
    },
    []
  );
}

/**
 * Hook to track token validation
 */
export function useTokenTracking() {
  const trackValidation = useCallback(
    (success: boolean, properties?: PortalEventProperties) => {
      trackTokenValidation(success, properties);
    },
    []
  );

  const trackExpired = useCallback((properties?: PortalEventProperties) => {
    trackTokenExpired(properties);
  }, []);

  return { trackValidation, trackExpired };
}

/**
 * Hook to get analytics instance
 */
export function useAnalytics() {
  return getPortalAnalytics();
}

/**
 * Hook to track component visibility (time in viewport)
 */
export function useVisibilityTracking(
  componentName: string,
  properties?: PortalEventProperties
) {
  const visibilityStartRef = useRef<number | null>(null);
  const totalVisibleTimeRef = useRef<number>(0);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page became hidden
        if (visibilityStartRef.current !== null) {
          const visibleDuration = Date.now() - visibilityStartRef.current;
          totalVisibleTimeRef.current += visibleDuration;
          visibilityStartRef.current = null;
        }
      } else {
        // Page became visible
        visibilityStartRef.current = Date.now();
      }
    };

    // Initial state
    if (!document.hidden) {
      visibilityStartRef.current = Date.now();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      // Track total visible time on unmount
      if (visibilityStartRef.current !== null) {
        const visibleDuration = Date.now() - visibilityStartRef.current;
        totalVisibleTimeRef.current += visibleDuration;
      }

      if (totalVisibleTimeRef.current > 0) {
        getPortalAnalytics().track('component_visibility' as any, {
          ...properties,
          componentName,
          visibleDuration: totalVisibleTimeRef.current,
        });
      }
    };
  }, [componentName, properties]);
}

/**
 * Hook to track user interactions (clicks, scrolls, etc.)
 */
export function useInteractionTracking(
  elementName: string,
  properties?: PortalEventProperties
) {
  const trackInteraction = useCallback(
    (interactionType: 'click' | 'scroll' | 'hover' | 'focus') => {
      getPortalAnalytics().track('user_interaction' as any, {
        ...properties,
        elementName,
        interactionType,
      });
    },
    [elementName, properties]
  );

  return trackInteraction;
}

/**
 * Hook to track form interactions
 */
export function useFormTracking(formName: string, properties?: PortalEventProperties) {
  const trackFormStart = useCallback(() => {
    getPortalAnalytics().track('form_start' as any, {
      ...properties,
      formName,
    });
  }, [formName, properties]);

  const trackFormSubmit = useCallback(
    (success: boolean, errorMessage?: string) => {
      getPortalAnalytics().track('form_submit' as any, {
        ...properties,
        formName,
        success,
        errorMessage,
      });
    },
    [formName, properties]
  );

  const trackFormAbandon = useCallback(() => {
    getPortalAnalytics().track('form_abandon' as any, {
      ...properties,
      formName,
    });
  }, [formName, properties]);

  return { trackFormStart, trackFormSubmit, trackFormAbandon };
}

/**
 * Hook to track performance metrics
 */
export function usePerformanceTracking(metricName: string) {
  const startTimeRef = useRef<number>(Date.now());

  const trackPerformance = useCallback(
    (additionalProperties?: PortalEventProperties) => {
      const duration = Date.now() - startTimeRef.current;
      getPortalAnalytics().track('performance_metric' as any, {
        ...additionalProperties,
        metricName,
        duration,
      });
    },
    [metricName]
  );

  const reset = useCallback(() => {
    startTimeRef.current = Date.now();
  }, []);

  return { trackPerformance, reset };
}
