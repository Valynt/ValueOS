/**
 * Auth Test Helpers
 *
 * Helper functions for authentication testing including mocks,
 * setup, and teardown utilities.
 */

import { assertCapability, assertTenantMember, deny } from "../services/auth/AuthPolicy.js";
import { SessionClaimsSchema, TctClaimsSchema, UserMetaSchema } from "../types/auth.js";

import { TEST_SESSIONS, TEST_TENANTS, TEST_TOKENS, TEST_USERS } from './auth.fixtures.js';

export interface MockAuthContext {
  user_id: string;
  tenant_id: string;
  role: string;
  permissions: Record<string, boolean>;
}

export function createMockAuthContext(userType: keyof typeof TEST_USERS = 'member'): MockAuthContext {
  const user = TEST_USERS[userType];
  return {
    user_id: user.id,
    tenant_id: user.tenant_id,
    role: user.role,
    permissions: {
      can_read: true,
      can_write: userType !== 'viewer' && userType !== 'guest',
      can_delete: userType === 'admin',
      can_admin: userType === 'admin',
      can_share: userType !== 'viewer' && userType !== 'guest',
    },
  };
}

export function mockAuthMiddleware(userType: keyof typeof TEST_USERS = 'member') {
  return (req: any, res: any, next: any) => {
    req.user = TEST_USERS[userType];
    req.tenant = TEST_TENANTS.primary;
    req.auth = createMockAuthContext(userType);
    next();
  };
}

/**
 * Fixes the 'guest' property error by mapping it to a known valid token.
 */
export const createMockToken = (role: 'admin' | 'member' | 'viewer' | 'guest') => {
  if (role === 'guest') {
    // Fallback to 'viewer' or standard valid token since 'guest' isn't in TEST_TOKENS
    return TEST_TOKENS.viewer || TEST_TOKENS.valid;
  }
  return TEST_TOKENS[role];
};

export function createMockSession(userType: keyof typeof TEST_USERS = 'admin') {
  const user = TEST_USERS[userType];
  return {
    id: `session_test_${Date.now()}`,
    user_id: user.id,
    tenant_id: user.tenant_id,
    token: createMockToken(userType),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
  };
}

export async function setupAuthTest() {
  // Setup test authentication state
  return {
    cleanup: async () => {
      // Cleanup test state
    },
  };
}

export async function teardownAuthTest() {
  // Clean up any auth test state
}

export function assertUserHasPermission(
  user: { role: string },
  permission: string
): void {
  const allowedRoles: Record<string, string[]> = {
    can_read: ['admin', 'member', 'viewer', 'guest'],
    can_write: ['admin', 'member'],
    can_delete: ['admin'],
    can_admin: ['admin'],
    can_share: ['admin', 'member'],
  };

  const allowed = allowedRoles[permission] || [];
  if (!allowed.includes(user.role)) {
    throw new Error(`User with role ${user.role} does not have permission: ${permission}`);
  }
}

export function createAuthHeaders(userType: keyof typeof TEST_USERS = 'member') {
  const token = createMockToken(userType);
  const user = TEST_USERS[userType];

  return {
    Authorization: `Bearer ${token}`,
    'X-Tenant-ID': user.tenant_id,
    'X-User-ID': user.id,
  };
}

export function mockSupabaseAuth(userType: keyof typeof TEST_USERS = 'member') {
  const user = TEST_USERS[userType];
  const session = createMockSession(userType);

  return {
    auth: {
      getSession: async () => ({
        data: { session },
        error: null,
      }),
      getUser: async () => ({
        data: { user },
        error: null,
      }),
    },
  };
}

export function mockFailedAuth(errorMessage = 'Unauthorized') {
  return {
    auth: {
      getSession: async () => ({
        data: { session: null },
        error: { message: errorMessage },
      }),
      getUser: async () => ({
        data: { user: null },
        error: { message: errorMessage },
      }),
    },
  };
}

export async function waitForAuth(timeoutMs = 1000): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, timeoutMs));
}

export function expectAuthError(error: any, expectedCode: string) {
  if (!error || error.code !== expectedCode) {
    throw new Error(`Expected auth error with code ${expectedCode}, got: ${error?.code}`);
  }
}

// Example test for policy gate:
export function testPolicyGates() {
  const user = { id: "u1", tenant_id: "t1", role: "admin", capabilities: ["manage"] };
  assertTenantMember({ user }, "t1");
  assertCapability({ user }, "manage");
  try {
    assertCapability({ user }, "delete");
  } catch (err) {
    deny("capability_denied", "delete not allowed");
  }
}

// Example test for claim parsing:
export function testClaimParsing() {
  const session = { user_id: "u1", tenant_id: "t1", roles: ["admin"], exp: Date.now() / 1000 };
  SessionClaimsSchema.parse(session);
  const tct = { iss: "issuer", sub: "u1", tid: "t1", roles: ["admin"], tier: "pro", exp: Date.now() / 1000 };
  TctClaimsSchema.parse(tct);
}

interface AuthMocks {
  mockSupabaseAuth: Record<string, (...args: unknown[]) => unknown>;
  mockGetConfig: { mockReturnValue: (val: unknown) => void };
  mockClientRateLimit: { checkLimit: { mockResolvedValue: (val: unknown) => void } };
  [key: string]: unknown;
}

export function setupAuthMocks(): AuthMocks {
  return {
    mockSupabaseAuth: {
      signInWithPassword: async () => ({ data: { user: TEST_USERS.member, session: {} }, error: null }),
      signUp: async () => ({ data: { user: TEST_USERS.member, session: {} }, error: null }),
      signOut: async () => ({ error: null }),
    },
    mockGetConfig: { mockReturnValue: () => {} },
    mockClientRateLimit: { checkLimit: { mockResolvedValue: () => {} } },
  };
}

export function resetAuthMocks(mocks: AuthMocks): void {
  // Reset mock state for next test
  Object.keys(mocks).forEach((key) => {
    const mock = mocks[key];
    if (mock && typeof mock === 'object' && 'mockReset' in mock) {
      (mock as { mockReset: () => void }).mockReset();
    }
  });
}
