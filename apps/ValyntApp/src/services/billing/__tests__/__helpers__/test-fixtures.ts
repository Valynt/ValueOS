/**
 * Test Fixtures and Shared Setup
 * Common test configuration and reusable fixtures
 */

import { vi } from "vitest";

import type { PlanTier } from "../../config/billing";
// Import StripeService for spyOn
import StripeService from "../../StripeService";

import { createCompleteBillingSetup } from "./billing-factories";
import { createMockStripeClient } from "./stripe-mocks";

/**
 * Setup mock Stripe for tests
 */
export function setupMockStripe() {
  const mockClient = createMockStripeClient();

  // Mock the StripeService using spyOn instead of vi.mock to avoid hoisting issues
  vi.spyOn(StripeService, 'getInstance').mockReturnValue({
    getClient: () => mockClient,
    handleError: (error: unknown, context: string) => {
      throw error;
    },
    generateIdempotencyKey: (prefix: string, uniqueId: string) =>
      `${prefix}_${uniqueId}_${Date.now()}`,
  } as any);

  return mockClient;
}

/**
 * Setup complete test environment with billing data
 */
export function setupTestEnvironment(planTier: PlanTier = "standard") {
  const mockStripe = setupMockStripe();
  const billingSetup = createCompleteBillingSetup(planTier);

  return {
    mockStripe,
    ...billingSetup,
  };
}

/**
 * Mock environment variables for testing
 */
export function setupTestEnv(overrides?: Record<string, string>) {
  const defaultEnv = {
    STRIPE_SECRET_KEY: "sk_test_mock_key",
    VITE_STRIPE_PUBLISHABLE_KEY: "pk_test_mock_key",
    STRIPE_WEBHOOK_SECRET: "whsec_test_mock_secret",
    VITE_SUPABASE_URL:
      process.env.VITE_SUPABASE_URL || "https://your-project.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY:
      process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-role-key",
    ...overrides,
  };

  Object.entries(defaultEnv).forEach(([key, value]) => {
    process.env[key] = value;
  });

  return defaultEnv;
}

/**
 * Create webhook signature for testing
 */
export function createWebhookSignature(
  payload: string | object,
  secret: string = "whsec_test_mock_secret"
): string {
  // In real Stripe, this would be: t=timestamp,v1=signature
  // For testing, we'll use a simplified version
  const timestamp = Math.floor(Date.now() / 1000);
  const payloadString =
    typeof payload === "string" ? payload : JSON.stringify(payload);

  // Simple mock signature (in real tests with actual Stripe SDK, use stripe.webhooks.generateTestHeaderString)
  return `t=${timestamp},v1=mock_signature_${Buffer.from(payloadString).toString("base64").substring(0, 20)}`;
}

/**
 * Delay helper for testing async operations
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate test tenant ID
 */
export function generateTestTenantId(): string {
  return `tenant_test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Generate test request ID
 */
export function generateTestRequestId(): string {
  return `req_test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Assertion helpers
 */
export const assertions = {
  /**
   * Assert object has required fields
   */
  hasRequiredFields<T extends Record<string, unknown>>(
    obj: T,
    requiredFields: (keyof T)[]
  ): void {
    requiredFields.forEach((field) => {
      if (!(field in obj) || obj[field] === undefined) {
        throw new Error(`Missing required field: ${String(field)}`);
      }
    });
  },

  /**
   * Assert timestamp is recent
   */
  isRecentTimestamp(timestamp: string | Date, maxAgeMs: number = 5000): void {
    const date =
      typeof timestamp === "string" ? new Date(timestamp) : timestamp;
    const age = Date.now() - date.getTime();

    if (age < 0 || age > maxAgeMs) {
      throw new Error(`Timestamp is not recent: ${timestamp} (age: ${age}ms)`);
    }
  },

  /**
   * Assert value is within range
   */
  inRange(
    value: number,
    min: number,
    max: number,
    label: string = "value"
  ): void {
    if (value < min || value > max) {
      throw new Error(`${label} ${value} is not within range [${min}, ${max}]`);
    }
  },

  /**
   * Assert percentage is valid
   */
  isValidPercentage(value: number): void {
    this.inRange(value, 0, 100, "percentage");
  },
};

/**
 * Performance testing helpers
 */
export const performance = {
  /**
   * Measure execution time
   */
  async measure<T>(
    fn: () => Promise<T>
  ): Promise<{ result: T; durationMs: number }> {
    const start = Date.now();
    const result = await fn();
    const durationMs = Date.now() - start;

    return { result, durationMs };
  },

  /**
   * Assert operation completes within time limit
   */
  async assertWithinTime<T>(
    fn: () => Promise<T>,
    maxDurationMs: number,
    label: string = "operation"
  ): Promise<T> {
    const { result, durationMs } = await this.measure(fn);

    if (durationMs > maxDurationMs) {
      throw new Error(
        `${label} took ${durationMs}ms, exceeded limit of ${maxDurationMs}ms`
      );
    }

    return result;
  },
};

/**
 * Retry helper for flaky operations
 */
export async function retryOperation<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 100
): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await delay(delayMs * (i + 1)); // Exponential backoff
      }
    }
  }

  throw lastError;
}
