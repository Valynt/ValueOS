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
