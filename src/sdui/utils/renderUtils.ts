/**
 * Utility functions for SDUI rendering
 */

import { SDUIComponentSection, SDUIPageDefinition } from '../schema';
import { ComponentMetadata, RenderPerformanceMetrics } from '../types';

/**
 * Generate a unique key for a component section
 */
export function generateSectionKey(
  section: SDUIComponentSection,
  index: number
): string {
  return `${section.component}-${section.version}-${index}`;
}

/**
 * Check if a section requires hydration
 */
export function requiresHydration(section: SDUIComponentSection): boolean {
  return !!(section.hydrateWith && section.hydrateWith.length > 0);
}

/**
 * Count components that require hydration in a page
 */
export function countHydratableComponents(page: SDUIPageDefinition): number {
  return page.sections.filter(requiresHydration).length;
}

/**
 * Extract all unique endpoints from a page definition
 */
export function extractEndpoints(page: SDUIPageDefinition): string[] {
  const endpoints = new Set<string>();

  page.sections.forEach((section) => {
    if (section.hydrateWith) {
      section.hydrateWith.forEach((endpoint) => endpoints.add(endpoint));
    }
  });

  return Array.from(endpoints);
}

/**
 * Calculate performance metrics from component metadata
 */
export function calculatePerformanceMetrics(
  components: ComponentMetadata[],
  validationTime: number
): RenderPerformanceMetrics {
  const totalTime = components.reduce((sum, comp) => {
    if (comp.endTime) {
      return sum + (comp.endTime - comp.startTime);
    }
    return sum;
  }, 0);

  const hydrationTime = components.reduce((sum, comp) => {
    if (comp.hydration?.duration) {
      return sum + comp.hydration.duration;
    }
    return sum;
  }, 0);

  const renderTime = totalTime - hydrationTime;

  const errorCount = components.filter((comp) => comp.status === 'error').length;

  const hydratedComponentCount = components.filter(
    (comp) => comp.hydration?.success
  ).length;

  return {
    totalTime,
    validationTime,
    hydrationTime,
    renderTime,
    componentCount: components.length,
    hydratedComponentCount,
    errorCount,
    componentMetrics: components,
  };
}

/**
 * Merge multiple data objects, with later objects taking precedence
 */
export function mergeData(...sources: Array<Record<string, any> | null>): Record<string, any> {
  return sources.reduce((acc, source) => {
    if (source && typeof source === 'object') {
      return { ...acc, ...source };
    }
    return acc;
  }, {});
}

/**
 * Deep clone an object (for immutability)
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as any;
  }

  if (obj instanceof Array) {
    return obj.map((item) => deepClone(item)) as any;
  }

  if (obj instanceof Object) {
    const cloned = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }

  return obj;
}

/**
 * Sanitize props to remove internal/private properties
 */
export function sanitizeProps(props: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const key in props) {
    // Skip internal properties (starting with _)
    if (!key.startsWith('_')) {
      sanitized[key] = props[key];
    }
  }

  return sanitized;
}

/**
 * Validate that required props are present
 */
export function validateRequiredProps(
  props: Record<string, any>,
  requiredProps: string[]
): { valid: boolean; missing: string[] } {
  const missing = requiredProps.filter((prop) => !(prop in props));

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Format error message for display
 */
export function formatErrorMessage(error: Error, context?: string): string {
  const prefix = context ? `[${context}] ` : '';
  return `${prefix}${error.message}`;
}

/**
 * Check if a value is a valid endpoint URL
 */
export function isValidEndpoint(endpoint: string): boolean {
  try {
    // Check if it's a relative path
    if (endpoint.startsWith('/')) {
      return true;
    }

    // Check if it's a valid URL
    new URL(endpoint);
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalize endpoint to ensure it's a valid URL or path
 */
export function normalizeEndpoint(endpoint: string, baseUrl?: string): string {
  // If it's already a full URL, return as-is
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }

  // If it's a relative path and we have a base URL, combine them
  if (baseUrl) {
    return new URL(endpoint, baseUrl).toString();
  }

  // Return as-is (assume it's a valid relative path)
  return endpoint;
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function for performance optimization
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't wait after the last attempt
      if (attempt < maxAttempts - 1) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Create a timeout promise
 */
export function createTimeout(ms: number, message?: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(message || `Operation timed out after ${ms}ms`));
    }, ms);
  });
}

/**
 * Race a promise against a timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message?: string
): Promise<T> {
  return Promise.race([promise, createTimeout(ms, message)]);
}

/**
 * Batch multiple promises with concurrency limit
 */
export async function batchPromises<T>(
  promises: Array<() => Promise<T>>,
  concurrency: number = 5
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const promiseFn of promises) {
    const promise = promiseFn().then((result) => {
      results.push(result);
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex((p) => p === promise),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Check if code is running in browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Check if code is running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Log message only in development mode
 */
export function devLog(message: string, ...args: any[]): void {
  if (isDevelopment()) {
    console.log(`[SDUI] ${message}`, ...args);
  }
}

/**
 * Log warning only in development mode
 */
export function devWarn(message: string, ...args: any[]): void {
  if (isDevelopment()) {
    console.warn(`[SDUI] ${message}`, ...args);
  }
}

/**
 * Log error (always logged)
 */
export function logError(message: string, error?: Error, ...args: any[]): void {
  console.error(`[SDUI] ${message}`, error, ...args);
}
