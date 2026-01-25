import { useEffect } from "react";
import { getCLS, getFID, getFCP, getLCP, getTTFB } from "web-vitals";

/**
 * Hook to track Core Web Vitals and send to analytics
 */
export const useWebVitals = () => {
  useEffect(() => {
    // Track Core Web Vitals
    getCLS((metric) => {
      console.log("CLS:", metric);
      // Send to analytics
      sendToAnalytics("CLS", metric);
    });

    getFID((metric) => {
      console.log("FID:", metric);
      sendToAnalytics("FID", metric);
    });

    getFCP((metric) => {
      console.log("FCP:", metric);
      sendToAnalytics("FCP", metric);
    });

    getLCP((metric) => {
      console.log("LCP:", metric);
      sendToAnalytics("LCP", metric);
    });

    getTTFB((metric) => {
      console.log("TTFB:", metric);
      sendToAnalytics("TTFB", metric);
    });
  }, []);
};

/**
 * Send metrics to analytics service
 */
function sendToAnalytics(name: string, metric: any) {
  // Send to custom analytics endpoint
  fetch("/api/analytics/web-vitals", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      entries: metric.entries,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    }),
  }).catch((error) => {
    console.warn("Failed to send web vitals to analytics:", error);
  });

  // Also send to Google Analytics 4 if available
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", name, {
      event_category: "Web Vitals",
      event_label: metric.name,
      value: Math.round(metric.value),
      custom_map: { metric_rating: metric.rating },
    });
  }

  // Log to console for debugging
  console.log(`Web Vital ${name}:`, {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    entries: metric.entries,
  });
}
