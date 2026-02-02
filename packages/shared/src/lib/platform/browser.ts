/**
 * Browser Platform Utilities
 *
 * Browser-specific utilities that require DOM APIs.
 * This module should only be imported in browser contexts.
 *
 * @module @valueos/shared/platform/browser
 */

/**
 * Check if code is running in a browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

/**
 * Get a value from localStorage with JSON parsing
 */
export function getLocalStorage<T>(key: string, defaultValue: T): T {
  if (!isBrowser()) {
    return defaultValue;
  }

  try {
    const item = window.localStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Set a value in localStorage with JSON serialization
 */
export function setLocalStorage<T>(key: string, value: T): void {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage might be full or disabled
  }
}

/**
 * Remove a value from localStorage
 */
export function removeLocalStorage(key: string): void {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore errors
  }
}

/**
 * Get a value from sessionStorage with JSON parsing
 */
export function getSessionStorage<T>(key: string, defaultValue: T): T {
  if (!isBrowser()) {
    return defaultValue;
  }

  try {
    const item = window.sessionStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Set a value in sessionStorage with JSON serialization
 */
export function setSessionStorage<T>(key: string, value: T): void {
  if (!isBrowser()) {
    return;
  }

  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sessionStorage might be full or disabled
  }
}

/**
 * Get the current URL's query parameters
 */
export function getQueryParams(): URLSearchParams {
  if (!isBrowser()) {
    return new URLSearchParams();
  }
  return new URLSearchParams(window.location.search);
}

/**
 * Get the current URL's hash
 */
export function getHash(): string {
  if (!isBrowser()) {
    return "";
  }
  return window.location.hash.slice(1);
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!isBrowser()) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.select();
      const result = document.execCommand("copy");
      document.body.removeChild(textArea);
      return result;
    } catch {
      return false;
    }
  }
}

/**
 * Scroll to an element by ID
 */
export function scrollToElement(elementId: string, behavior: ScrollBehavior = "smooth"): void {
  if (!isBrowser()) {
    return;
  }

  const element = document.getElementById(elementId);
  if (element) {
    element.scrollIntoView({ behavior, block: "start" });
  }
}

/**
 * Get the current viewport dimensions
 */
export function getViewportSize(): { width: number; height: number } {
  if (!isBrowser()) {
    return { width: 0, height: 0 };
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

/**
 * Check if the user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (!isBrowser()) {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Check if the user prefers dark mode
 */
export function prefersDarkMode(): boolean {
  if (!isBrowser()) {
    return false;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
