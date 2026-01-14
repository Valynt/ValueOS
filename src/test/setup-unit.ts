/**
 * Unit Test Setup
 *
 * Pure unit test setup with zero external dependencies.
 * No database connections, no Docker containers, no network calls.
 */

import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { setupServer } from "msw/node";

// Re-use existing global setup for env vars and polyfills
import "../../tests/setup";

// Mock feature flags for consistent unit testing
vi.mock("../config/featureFlags", () => ({
  featureFlags: {
    ENABLE_UNIFIED_ORCHESTRATION: true,
    ENABLE_STATELESS_ORCHESTRATION: false,
    ENABLE_SAFE_JSON_PARSER: false,
    ENABLE_INPUT_SANITIZATION: true,
    ENABLE_TRACE_LOGGING: true,
    ENABLE_CIRCUIT_BREAKER: true,
    ENABLE_RATE_LIMITING: true,
    ENABLE_AUDIT_LOGGING: true,
  },
  isFeatureEnabled: () => false,
  getEnabledFeatures: () => [],
  getDisabledFeatures: () => [],
}));

// Mock external services that unit tests should never need
vi.mock("../config/database", () => ({
  getDatabaseUrl: () => "mock://database",
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        in: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: null, error: null })),
              })),
            })),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
    auth: {
      signIn: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    },
  })),
}));

// Mock Stripe for unit tests
vi.mock("@stripe/stripe-js", () => ({
  loadStripe: vi.fn(() => Promise.resolve(null)),
}));

// Mock Redis
vi.mock("../lib/redis", () => ({
  redisClient: {
    get: vi.fn(() => Promise.resolve(null)),
    set: vi.fn(() => Promise.resolve("OK")),
    del: vi.fn(() => Promise.resolve(1)),
    exists: vi.fn(() => Promise.resolve(0)),
    expire: vi.fn(() => Promise.resolve(1)),
  },
}));

export const server = setupServer();

beforeAll(() => {
  vi.setSystemTime(new Date("2025-01-01T12:00:00-05:00"));
  server.listen({ onUnhandledRequest: "warn" });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

afterAll(() => {
  server.close();
});

// Export utilities for unit tests
export const createMockSupabaseClient = () => ({
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
  })),
  auth: {
    signIn: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
  },
});

export const createMockStripeService = () => ({
  createCustomer: vi.fn(() => Promise.resolve({ id: "cus_test", email: "test@example.com" })),
  createSubscription: vi.fn(() => Promise.resolve({ id: "sub_test", status: "active" })),
  cancelSubscription: vi.fn(() => Promise.resolve({ id: "sub_test", status: "canceled" })),
});

console.log("🧪 Unit Test Environment Initialized (Zero Dependencies)");
