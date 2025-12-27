/**
 * Authentication Test Fixtures
 * Provides mock data factories for authentication testing
 */

import { Session, User } from "@supabase/supabase-js";

/**
 * Generate a mock user object
 */
export function createMockUser(overrides: Partial<User> = {}): User {
  const now = new Date().toISOString();
  return {
    id: "test-user-id-" + Math.random().toString(36).substring(7),
    aud: "authenticated",
    role: "authenticated",
    email: "test@example.com",
    email_confirmed_at: now,
    phone: "",
    confirmed_at: now,
    last_sign_in_at: now,
    app_metadata: {},
    user_metadata: {
      full_name: "Test User",
    },
    identities: [],
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

/**
 * Generate a mock session object
 */
export function createMockSession(overrides: Partial<Session> = {}): Session {
  const now = Math.floor(Date.now() / 1000);
  const user = overrides.user || createMockUser();

  return {
    access_token:
      "mock-access-token-" + Math.random().toString(36).substring(7),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token:
      "mock-refresh-token-" + Math.random().toString(36).substring(7),
    user,
    ...overrides,
  };
}

/**
 * Generate signup test data
 */
export function createSignupData(
  overrides: {
    email?: string;
    password?: string;
    fullName?: string;
  } = {}
) {
  return {
    email: overrides.email || "newuser@example.com",
    password: overrides.password || "SecurePass123!",
    fullName: overrides.fullName || "New User",
  };
}

/**
 * Generate login credentials
 */
export function createLoginCredentials(
  overrides: {
    email?: string;
    password?: string;
    otpCode?: string;
  } = {}
) {
  return {
    email: overrides.email || "test@example.com",
    password: overrides.password || "SecurePass123!",
    otpCode: overrides.otpCode,
  };
}

/**
 * Mock Supabase auth response for successful signup
 */
export function createSuccessfulSignupResponse() {
  const user = createMockUser();
  const session = createMockSession({ user });

  return {
    data: {
      user,
      session,
    },
    error: null,
  };
}

/**
 * Mock Supabase auth response for successful login
 */
export function createSuccessfulLoginResponse() {
  const user = createMockUser();
  const session = createMockSession({ user });

  return {
    data: {
      user,
      session,
    },
    error: null,
  };
}

/**
 * Mock Supabase auth error response
 */
export function createAuthErrorResponse(
  message: string = "Authentication failed"
) {
  return {
    data: {
      user: null,
      session: null,
    },
    error: {
      message,
      status: 400,
      name: "AuthApiError",
    },
  };
}

/**
 * Mock rate limit exceeded error
 */
export function createRateLimitError() {
  return {
    message: "Too many requests",
    retryAfter: 300000, // 5 minutes
  };
}

/**
 * Common test email addresses
 */
export const TEST_EMAILS = {
  valid: "test@example.com",
  invalid: "not-an-email",
  duplicate: "duplicate@example.com",
  malicious: '<script>alert("xss")</script>@example.com',
  sqlInjection: "admin'--@example.com",
  longEmail: "a".repeat(250) + "@example.com",
};

/**
 * Common test passwords
 */
export const TEST_PASSWORDS = {
  valid: "SecurePass123!",
  tooShort: "Short1!",
  noUppercase: "securepass123!",
  noLowercase: "SECUREPASS123!",
  noNumbers: "SecurePass!!!",
  noSymbols: "SecurePass123",
  breached: "Password123!",
  commonPattern: "Qwerty123!",
  repeating: "Aaaa1111!!!!",
  withUsername: "TestUser123!",
};

/**
 * Mock OAuth providers
 */
export const OAUTH_PROVIDERS = {
  google: "google" as const,
  apple: "apple" as const,
  github: "github" as const,
};
