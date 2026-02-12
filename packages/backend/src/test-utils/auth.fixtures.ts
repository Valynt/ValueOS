/**
 * Auth Test Fixtures
 * 
 * Reusable test data for authentication and authorization testing
 */

export const TEST_USERS = {
  admin: {
    id: 'user_admin_test',
    email: 'admin@test.valuecanvas.io',
    role: 'admin' as const,
    tenant_id: 'tenant_test_001',
    name: 'Test Admin',
  },
  member: {
    id: 'user_member_test',
    email: 'member@test.valuecanvas.io',
    role: 'member' as const,
    tenant_id: 'tenant_test_001',
    name: 'Test Member',
  },
  viewer: {
    id: 'user_viewer_test',
    email: 'viewer@test.valuecanvas.io',
    role: 'viewer' as const,
    tenant_id: 'tenant_test_001',
    name: 'Test Viewer',
  },
  guest: {
    id: 'user_guest_test',
    email: 'guest@test.valuecanvas.io',
    role: 'guest' as const,
    tenant_id: 'tenant_test_001',
    name: 'Test Guest',
  },
};

export const TEST_TENANTS = {
  primary: {
    id: 'tenant_test_001',
    name: 'Test Organization',
    plan: 'standard' as const,
    created_at: '2024-01-01T00:00:00Z',
  },
  secondary: {
    id: 'tenant_test_002',
    name: 'Secondary Test Org',
    plan: 'enterprise' as const,
    created_at: '2024-01-01T00:00:00Z',
  },
};

export const TEST_TOKENS = {
  valid: 'test_token_valid_12345',
  expired: 'test_token_expired_12345',
  invalid: 'test_token_invalid_12345',
  admin: 'test_token_admin_12345',
  member: 'test_token_member_12345',
  viewer: 'test_token_viewer_12345',
};

export const TEST_SESSIONS = {
  active: {
    id: 'session_test_active',
    user_id: TEST_USERS.admin.id,
    tenant_id: TEST_TENANTS.primary.id,
    token: TEST_TOKENS.admin,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
  },
  expired: {
    id: 'session_test_expired',
    user_id: TEST_USERS.member.id,
    tenant_id: TEST_TENANTS.primary.id,
    token: TEST_TOKENS.expired,
    expires_at: new Date(Date.now() - 1000).toISOString(),
    created_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
  },
};

export const TEST_PERMISSIONS = {
  admin: {
    can_read: true,
    can_write: true,
    can_delete: true,
    can_admin: true,
    can_share: true,
  },
  member: {
    can_read: true,
    can_write: true,
    can_delete: false,
    can_admin: false,
    can_share: true,
  },
  viewer: {
    can_read: true,
    can_write: false,
    can_delete: false,
    can_admin: false,
    can_share: false,
  },
  guest: {
    can_read: true,
    can_write: false,
    can_delete: false,
    can_admin: false,
    can_share: false,
  },
};

export const TEST_AUTH_HEADERS = {
  admin: {
    Authorization: `Bearer ${TEST_TOKENS.admin}`,
    'X-Tenant-ID': TEST_TENANTS.primary.id,
  },
  member: {
    Authorization: `Bearer ${TEST_TOKENS.member}`,
    'X-Tenant-ID': TEST_TENANTS.primary.id,
  },
  viewer: {
    Authorization: `Bearer ${TEST_TOKENS.viewer}`,
    'X-Tenant-ID': TEST_TENANTS.primary.id,
  },
  invalid: {
    Authorization: `Bearer ${TEST_TOKENS.invalid}`,
    'X-Tenant-ID': TEST_TENANTS.primary.id,
  },
};

export const TEST_EMAILS = {
  valid: 'test@example.com',
  admin: 'admin@example.com',
  member: 'member@example.com',
  invalid: 'not-an-email',
  disposable: 'test@tempmail.com',
};

export const TEST_PASSWORDS = {
  valid: 'SecureP@ssw0rd!',
  weak: '123',
  empty: '',
  long: 'A'.repeat(200),
};

export const OAUTH_PROVIDERS = {
  google: { name: 'google', clientId: 'test-google-client' },
  github: { name: 'github', clientId: 'test-github-client' },
};

export function createLoginCredentials(email = TEST_EMAILS.valid, password = TEST_PASSWORDS.valid) {
  return { email, password };
}

export function createSignupData(overrides: Record<string, unknown> = {}) {
  return {
    email: TEST_EMAILS.valid,
    password: TEST_PASSWORDS.valid,
    name: 'Test User',
    ...overrides,
  };
}

export function createSuccessfulLoginResponse(user = TEST_USERS.member) {
  return {
    data: { user, session: { access_token: TEST_TOKENS.member, expires_at: Date.now() + 3600000 } },
    error: null,
  };
}

export function createSuccessfulSignupResponse(user = TEST_USERS.member) {
  return {
    data: { user, session: { access_token: TEST_TOKENS.member } },
    error: null,
  };
}

export function createAuthErrorResponse(message = 'Auth error', status = 401) {
  return {
    data: { user: null, session: null },
    error: { message, status },
  };
}

export function createMockUser(overrides: Record<string, unknown> = {}) {
  return { ...TEST_USERS.member, ...overrides };
}

export function createMockSession(overrides: Record<string, unknown> = {}) {
  return {
    access_token: TEST_TOKENS.member,
    refresh_token: 'test-refresh-token',
    expires_at: Date.now() + 3600000,
    user: TEST_USERS.member,
    ...overrides,
  };
}
