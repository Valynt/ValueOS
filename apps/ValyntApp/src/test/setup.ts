import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// react-router-dom: mock useLocation/useNavigate/useParams so components that
// call these hooks render without a Router wrapper in unit tests.
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useLocation: vi.fn(() => ({ pathname: "/", search: "", hash: "", state: null, key: "default" })),
    useNavigate: vi.fn(() => vi.fn()),
    useParams: vi.fn(() => ({})),
  };
});



// Fallback env vars so modules that eagerly validate config don't throw at import time
process.env.VITE_SUPABASE_URL ??= "http://localhost:54321";
process.env.VITE_SUPABASE_ANON_KEY ??= "test-anon-key";



// Radix Tooltip requires TooltipProvider in the tree. Mock the ValyntApp
// wrapper so all tooltip sub-components render as passthroughs in tests.
vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: unknown }) => children,
  Tooltip: ({ children }: { children: unknown }) => children,
  TooltipTrigger: ({ children }: { children: unknown }) => children,
  TooltipContent: ({ children }: { children: unknown }) => children,
}));

// Mock DrawerContext globally — tests that render components using useDrawer
// without a DrawerProvider would otherwise throw. Tests that need real drawer
// behaviour should render inside DrawerProvider explicitly.
vi.mock("@/contexts/DrawerContext", () => ({
  DrawerProvider: ({ children }: { children: unknown }) => children,
  useDrawer: () => ({
    isOpen: false,
    content: null,
    title: "",
    openDrawer: vi.fn(),
    closeDrawer: vi.fn(),
  }),
}));



// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock browser APIs if window is defined
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
  Object.defineProperty(window, "sessionStorage", {
    value: sessionStorageMock,
  });
}
