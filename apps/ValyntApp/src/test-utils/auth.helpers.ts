/**
 * Authentication Test Helpers
 * Provides utility functions for authentication testing
 */

import { vi } from "vitest";

import { createMockSession, createMockUser } from "./auth.fixtures";

/**
 * Create a mock Supabase auth client
 */
export function createMockSupabaseAuth() {
  return {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
    getSession: vi.fn(),
    getUser: vi.fn(),
    refreshSession: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
  };
}

/**
 * Setup common mocks for authentication tests
 */
export function setupAuthMocks() {
  const mockSupabaseAuth = createMockSupabaseAuth();

  // Mock security functions
  const mockCheckPasswordBreach = vi.fn().mockResolvedValue(false);
  const mockConsumeAuthRateLimit = vi.fn();
  const mockResetRateLimit = vi.fn();

  // Mock config
  const mockGetConfig = vi.fn(() => ({
    auth: { mfaEnabled: false },
  }));

  // Mock client rate limit
  const mockClientRateLimit = {
    checkLimit: vi.fn().mockResolvedValue(true),
    recordAttempt: vi.fn(),
    reset: vi.fn(),
  };

  return {
    mockSupabaseAuth,
    mockCheckPasswordBreach,
    mockConsumeAuthRateLimit,
    mockResetRateLimit,
    mockGetConfig,
    mockClientRateLimit,
  };
}

/**
 * Assert that a function throws an error with specific properties
 */
export async function expectToThrowError(
  fn: () => Promise<any>,
  expectedError: {
    name?: string;
    message?: string | RegExp;
    code?: string;
  }
) {
  let error: any;

  try {
    await fn();
  } catch (e) {
    error = e;
  }

  if (!error) {
    throw new Error("Expected function to throw an error but it did not");
  }

  if (expectedError.name && error.name !== expectedError.name) {
    throw new Error(
      `Expected error name "${expectedError.name}" but got "${error.name}"`
    );
  }

  if (expectedError.message) {
    if (typeof expectedError.message === "string") {
      if (!error.message.includes(expectedError.message)) {
        throw new Error(
          `Expected error message to include "${expectedError.message}" but got "${error.message}"`
        );
      }
    } else {
      if (!expectedError.message.test(error.message)) {
        throw new Error(
          `Expected error message to match ${expectedError.message} but got "${error.message}"`
        );
      }
    }
  }

  if (expectedError.code && error.code !== expectedError.code) {
    throw new Error(
      `Expected error code "${expectedError.code}" but got "${error.code}"`
    );
  }

  return error;
}

/**
 * Wait for a specific amount of time (useful for rate limit tests)
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mock localStorage for session storage tests
 */
export function mockLocalStorage() {
  const storage: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => storage[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      storage[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete storage[key];
    }),
    clear: vi.fn(() => {
      Object.keys(storage).forEach((key) => delete storage[key]);
    }),
    get length() {
      return Object.keys(storage).length;
    },
    key: vi.fn((index: number) => Object.keys(storage)[index] || null),
  };
}

/**
 * Mock sessionStorage for session storage tests
 */
export function mockSessionStorage() {
  return mockLocalStorage(); // Same implementation
}

/**
 * Setup global mocks for browser environment
 */
export function setupBrowserMocks() {
  const mockLocalStorageInstance = mockLocalStorage();
  const mockSessionStorageInstance = mockSessionStorage();

  Object.defineProperty(global, "localStorage", {
    value: mockLocalStorageInstance,
    writable: true,
  });

  Object.defineProperty(global, "sessionStorage", {
    value: mockSessionStorageInstance,
    writable: true,
  });

  Object.defineProperty(global, "window", {
    value: {
      location: {
        origin: "http://localhost:5173",
        pathname: "/",
        search: "",
        hash: "",
      },
    },
    writable: true,
  });

  return {
    localStorage: mockLocalStorageInstance,
    sessionStorage: mockSessionStorageInstance,
  };
}

/**
 * Reset all auth-related mocks
 */
export function resetAuthMocks(mocks: ReturnType<typeof setupAuthMocks>) {
  Object.values(mocks).forEach((mock) => {
    if (mock && typeof mock === "object" && "mockClear" in mock) {
      (mock as any).mockClear();
    } else if (mock && typeof mock === "object") {
      Object.values(mock).forEach((fn) => {
        if (fn && typeof fn === "function" && "mockClear" in fn) {
          (fn as any).mockClear();
        }
      });
    }
  });
}

/**
 * Create a matcher for Supabase auth calls
 */
export function matchSupabaseAuthCall(expectedData: any) {
  return expect.objectContaining(expectedData);
}

/**
 * Simulate successful authentication flow
 */
export async function simulateSuccessfulAuth(
  mockSupabaseAuth: ReturnType<typeof createMockSupabaseAuth>
) {
  const user = createMockUser();
  const session = createMockSession({ user });

  mockSupabaseAuth.signInWithPassword.mockResolvedValue({
    data: { user, session },
    error: null,
  });

  mockSupabaseAuth.getSession.mockResolvedValue({
    data: { session },
    error: null,
  });

  mockSupabaseAuth.getUser.mockResolvedValue({
    data: { user },
    error: null,
  });

  return { user, session };
}

/**
 * Simulate failed authentication
 */
export async function simulateFailedAuth(
  mockSupabaseAuth: ReturnType<typeof createMockSupabaseAuth>,
  errorMessage: string = "Invalid credentials"
) {
  mockSupabaseAuth.signInWithPassword.mockResolvedValue({
    data: { user: null, session: null },
    error: { message: errorMessage, status: 401, name: "AuthApiError" },
  });
}
