import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { webcrypto } from "node:crypto";

// Polyfill crypto for environments that don't have it (like JSDOM)
// We use a more aggressive approach to ensure it's available
if (typeof window !== "undefined") {
  if (!window.crypto) {
    (window as any).crypto = webcrypto;
  }
  if (!window.crypto.subtle && (webcrypto as any).subtle) {
    (window.crypto as any).subtle = (webcrypto as any).subtle;
  }
}

if (typeof global !== "undefined") {
  if (!(global as any).crypto) {
    (global as any).crypto = webcrypto;
  }
}

// Cleanup after each test (if cleanup is available)
afterEach(async () => {
  try {
    const { cleanup } = await import("@testing-library/react");
    cleanup();
  } catch (e) {
    // Ignore if not in React environment
  }
});

if (typeof window !== "undefined") {
  // Mock window.matchMedia
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock IntersectionObserver
  class MockIntersectionObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
  }

  Object.defineProperty(window, "IntersectionObserver", {
    writable: true,
    value: MockIntersectionObserver,
  });

  // Mock ResizeObserver
  class MockResizeObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
  }

  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    value: MockResizeObserver,
  });

  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  Object.defineProperty(window, "localStorage", { value: localStorageMock });

  // Mock sessionStorage
  const sessionStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  Object.defineProperty(window, "sessionStorage", { value: sessionStorageMock });
}
