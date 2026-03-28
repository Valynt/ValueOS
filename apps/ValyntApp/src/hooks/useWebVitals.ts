import { useEffect } from "react";
import { Metric, onCLS, onFCP, onFID, onLCP, onTTFB } from "web-vitals";

import { apiClient } from "../api/client/unified-api-client";
import { logger } from "../lib/logger";

/**
 * Hook to track Core Web Vitals and send to analytics
 */
export const useWebVitals = () => {
  useEffect(() => {
    // Track Core Web Vitals
    onCLS((metric: Metric) => {
      logger.info("CLS:", metric);
      // Send to analytics
      sendToAnalytics("CLS", metric);
    });

    onFID((metric: Metric) => {
      logger.info("FID:", metric);
      sendToAnalytics("FID", metric);
    });

    onFCP((metric: Metric) => {
      logger.info("FCP:", metric);
      sendToAnalytics("FCP", metric);
    });

    onLCP((metric: Metric) => {
      logger.info("LCP:", metric);
      sendToAnalytics("LCP", metric);
    });

    onTTFB((metric: Metric) => {
      logger.info("TTFB:", metric);
      sendToAnalytics("TTFB", metric);
    });
  }, []);
};

/**
 * Send metrics to analytics service
 */
function sendToAnalytics(name: string, metric: Metric) {
  apiClient.post("/api/analytics/web-vitals", {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
  }).catch((error: unknown) => {
    logger.warn("Failed to send web vitals to analytics:", { error });
  });

  // Also send to Google Analytics 4 if available
  type WindowWithGtag = Window & { gtag?: (event: string, name: string, params: Record<string, unknown>) => void };
  if (typeof window !== "undefined" && (window as WindowWithGtag).gtag) {
    (window as WindowWithGtag).gtag!("event", name, {
      event_category: "Web Vitals",
      event_label: metric.name,
      value: Math.round(metric.value),
      custom_map: { metric_rating: metric.rating },
    });
  }

  // Log to console for debugging
  logger.info(`Web Vital ${name}:`, {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
  });
}
