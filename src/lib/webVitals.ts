/**
 * Web Vitals Integration
 *
 * Tracks Core Web Vitals (LCP, FID, CLS) and sends to analytics backend.
 * Includes performance budget alerts.
 */

import { analyticsClient } from "./analyticsClient";

export interface WebVitalsMetric {
  name: "LCP" | "FID" | "CLS" | "FCP" | "TTFB" | "INP";
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  delta: number;
  id: string;
  navigationType: string;
}

export interface PerformanceBudget {
  LCP: number; // Largest Contentful Paint (ms)
  FID: number; // First Input Delay (ms)
  CLS: number; // Cumulative Layout Shift (score)
  FCP: number; // First Contentful Paint (ms)
  TTFB: number; // Time to First Byte (ms)
  INP: number; // Interaction to Next Paint (ms)
}

// Default performance budgets based on Google's recommendations
const DEFAULT_BUDGETS: PerformanceBudget = {
  LCP: 2500, // Good: ≤2.5s
  FID: 100, // Good: ≤100ms
  CLS: 0.1, // Good: ≤0.1
  FCP: 1800, // Good: ≤1.8s
  TTFB: 800, // Good: ≤800ms
  INP: 200, // Good: ≤200ms
};

// Rating thresholds
const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
  INP: { good: 200, poor: 500 },
};

type MetricName = keyof typeof THRESHOLDS;

function getRating(name: MetricName, value: number): "good" | "needs-improvement" | "poor" {
  const threshold = THRESHOLDS[name];
  if (value <= threshold.good) return "good";
  if (value <= threshold.poor) return "needs-improvement";
  return "poor";
}

// Callbacks for budget alerts
type BudgetAlertCallback = (metric: WebVitalsMetric, budget: number) => void;
const budgetAlertCallbacks: BudgetAlertCallback[] = [];

/**
 * Register a callback for budget alerts
 */
export function onBudgetAlert(callback: BudgetAlertCallback): () => void {
  budgetAlertCallbacks.push(callback);
  return () => {
    const index = budgetAlertCallbacks.indexOf(callback);
    if (index > -1) budgetAlertCallbacks.splice(index, 1);
  };
}

/**
 * Check if metric exceeds budget and trigger alerts
 */
function checkBudget(metric: WebVitalsMetric, budgets: PerformanceBudget): void {
  const budget = budgets[metric.name as keyof PerformanceBudget];
  if (budget && metric.value > budget) {
    budgetAlertCallbacks.forEach((cb) => cb(metric, budget));
  }
}

/**
 * Send metric to analytics backend
 */
function sendToAnalytics(metric: WebVitalsMetric): void {
  try {
    analyticsClient.track("web_vital", {
      metric_name: metric.name,
      metric_value: metric.value,
      metric_rating: metric.rating,
      metric_delta: metric.delta,
      metric_id: metric.id,
      navigation_type: metric.navigationType,
      page_url: window.location.href,
      page_path: window.location.pathname,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[WebVitals] Failed to send metric:", error);
  }
}

/**
 * Initialize web vitals tracking
 */
export async function initWebVitals(
  options: {
    budgets?: Partial<PerformanceBudget>;
    onMetric?: (metric: WebVitalsMetric) => void;
    sendToAnalytics?: boolean;
  } = {}
): Promise<void> {
  const { budgets = {}, onMetric, sendToAnalytics: shouldSend = true } = options;
  const mergedBudgets = { ...DEFAULT_BUDGETS, ...budgets };

  // Dynamic import web-vitals library
  try {
    const { onLCP, onFID, onCLS, onFCP, onTTFB, onINP } = await import("web-vitals");

    const handleMetric = (metric: {
      name: string;
      value: number;
      delta: number;
      id: string;
      navigationType: string;
    }) => {
      const name = metric.name as MetricName;
      const webVitalMetric: WebVitalsMetric = {
        name: name as WebVitalsMetric["name"],
        value: metric.value,
        rating: getRating(name, metric.value),
        delta: metric.delta,
        id: metric.id,
        navigationType: metric.navigationType,
      };

      // Call user callback
      onMetric?.(webVitalMetric);

      // Send to analytics
      if (shouldSend) {
        sendToAnalytics(webVitalMetric);
      }

      // Check budget
      checkBudget(webVitalMetric, mergedBudgets);
    };

    // Register handlers for each metric
    onLCP(handleMetric);
    onFID(handleMetric);
    onCLS(handleMetric);
    onFCP(handleMetric);
    onTTFB(handleMetric);
    onINP(handleMetric);
  } catch (error) {
    console.warn("[WebVitals] web-vitals library not available:", error);
  }
}

/**
 * Get current performance metrics snapshot
 */
export function getPerformanceSnapshot(): Record<string, number> {
  const metrics: Record<string, number> = {};

  if (typeof window === "undefined" || !window.performance) {
    return metrics;
  }

  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
  if (navigation) {
    metrics.ttfb = navigation.responseStart - navigation.requestStart;
    metrics.domContentLoaded = navigation.domContentLoadedEventEnd - navigation.startTime;
    metrics.load = navigation.loadEventEnd - navigation.startTime;
    metrics.domInteractive = navigation.domInteractive - navigation.startTime;
  }

  // Get paint timings
  const paintEntries = performance.getEntriesByType("paint");
  paintEntries.forEach((entry) => {
    if (entry.name === "first-paint") {
      metrics.fp = entry.startTime;
    }
    if (entry.name === "first-contentful-paint") {
      metrics.fcp = entry.startTime;
    }
  });

  // Memory info (Chrome only)
  const memory = (performance as any).memory;
  if (memory) {
    metrics.jsHeapSize = memory.usedJSHeapSize;
    metrics.jsHeapLimit = memory.jsHeapSizeLimit;
  }

  return metrics;
}

/**
 * Create a performance mark
 */
export function mark(name: string): void {
  if (typeof window !== "undefined" && window.performance) {
    performance.mark(name);
  }
}

/**
 * Measure between two marks
 */
export function measure(name: string, startMark: string, endMark?: string): number | null {
  if (typeof window === "undefined" || !window.performance) {
    return null;
  }

  try {
    const measureOptions: PerformanceMeasureOptions = { start: startMark };
    if (endMark) {
      measureOptions.end = endMark;
    }

    const entry = performance.measure(name, measureOptions);
    return entry.duration;
  } catch {
    return null;
  }
}

/**
 * Track a custom timing metric
 */
export function trackTiming(
  category: string,
  variable: string,
  duration: number,
  label?: string
): void {
  analyticsClient.track("custom_timing", {
    category,
    variable,
    duration,
    label,
    page_url: window.location.href,
    timestamp: new Date().toISOString(),
  });
}

/**
 * React hook for tracking component render time
 */
export function useRenderTiming(componentName: string): void {
  if (typeof window === "undefined") return;

  const startMark = `${componentName}-render-start`;
  const endMark = `${componentName}-render-end`;

  // Mark start on mount
  mark(startMark);

  // Use requestAnimationFrame to mark end after paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      mark(endMark);
      const duration = measure(`${componentName}-render`, startMark, endMark);
      if (duration !== null) {
        trackTiming("component", "render", duration, componentName);
      }
    });
  });
}

export default {
  initWebVitals,
  getPerformanceSnapshot,
  mark,
  measure,
  trackTiming,
  onBudgetAlert,
};
