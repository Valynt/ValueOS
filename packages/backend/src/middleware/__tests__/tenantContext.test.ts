import { getUserTenantId, verifyTenantExists, verifyTenantMembership } from '@shared/lib/tenantVerification';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getCurrentTenantContext, tenantContextMiddleware } from '../tenantContext.js';

const tenantVerificationMocks = vi.hoisted(() => ({
  getUserTenantId: vi.fn(),
  verifyTenantExists: vi.fn(),
  verifyTenantMembership: vi.fn(),
}));

vi.mock('@shared/lib/tenantVerification', () => tenantVerificationMocks);

// Silence logger output in tests
vi.mock('@shared/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const ORIGINAL_ENV = { ...process.env };

function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

function buildReq(overrides: Record<string, unknown>) {
  return {
    headers: {},
    header: vi.fn(() => undefined),
    params: {},
    baseUrl: '',
    path: '/test',
    ...overrides,
  } as any;
}

describe('tenantContextMiddleware', () => {
  beforeEach(() => {
    process.env.TCT_SECRET = 'test-tct-secret';
    tenantVerificationMocks.verifyTenantExists.mockResolvedValue(true);
    tenantVerificationMocks.verifyTenantMembership.mockResolvedValue(true);
    tenantVerificationMocks.getUserTenantId.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  // ── No tenant candidate ──────────────────────────────────────────────────

  it('allows requests with no user and no tenant candidate when enforce=false', async () => {
    const req = buildReq({});
    const res = mockRes();
    const next = vi.fn();

    await tenantContextMiddleware(false)(req, res as any, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.tenantId).toBeUndefined();
    expect(getUserTenantId).not.toHaveBeenCalled();
    expect(verifyTenantMembership).not.toHaveBeenCalled();
  });

  it('rejects with 403 when no tenant resolved and enforce=true', async () => {
    const req = buildReq({});
    const res = mockRes();
    const next = vi.fn();

    await tenantContextMiddleware(true)(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'tenant_required' }));
    expect(next).not.toHaveBeenCalled();
  });

  // ── Source 2: Service header ─────────────────────────────────────────────

  it('accepts service header when serviceIdentityVerified=true', async () => {
    const req = buildReq({
      header: vi.fn((name: string) => (name === 'x-tenant-id' ? 'tenant-123' : undefined)),
      serviceIdentityVerified: true,
      user: { id: 'user-123' },
    });
    const res = mockRes();
    const next = vi.fn();

    await tenantContextMiddleware()(req, res as any, next);

    expect(verifyTenantMembership).toHaveBeenCalledWith('user-123', 'tenant-123');
    expect(req.tenantId).toBe('tenant-123');
    expect(req.tenantSource).toBe('service-header');
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('blocks service header when serviceIdentityVerified=false', async () => {
    const req = buildReq({
      header: vi.fn((name: string) => (name === 'x-tenant-id' ? 'tenant-spoof' : undefined)),
      user: { id: 'user-999' },
    });
    const res = mockRes();
    const next = vi.fn();

    await tenantContextMiddleware()(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Forbidden',
      message: 'Tenant header is restricted to internal service requests.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  // ── Source 3: User JWT claim ─────────────────────────────────────────────

  it('resolves from user JWT claim (tenant_id)', async () => {
    const req = buildReq({
      user: { id: 'user-claim', tenant_id: 'tenant-from-claim' },
    });
    const res = mockRes();
    const next = vi.fn();

    await tenantContextMiddleware()(req, res as any, next);

    expect(req.tenantId).toBe('tenant-from-claim');
    expect(req.tenantSource).toBe('user-claim');
    expect(next).toHaveBeenCalled();
  });

  it('resolves from user JWT claim (organization_id fallback)', async () => {
    const req = buildReq({
      user: { id: 'user-org', organization_id: 'org-from-claim' },
    });
    const res = mockRes();
    const next = vi.fn();

    await tenantContextMiddleware()(req, res as any, next);

    expect(req.tenantId).toBe('org-from-claim');
    expect(req.tenantSource).toBe('user-claim');
    expect(next).toHaveBeenCalled();
  });

  // ── Source 4: User lookup ────────────────────────────────────────────────

  it('falls back to user lookup when no claim present', async () => {
    tenantVerificationMocks.getUserTenantId.mockResolvedValue('tenant-lookup');

    const req = buildReq({ user: { id: 'user-789' } });
    const res = mockRes();
    const next = vi.fn();

    await tenantContextMiddleware()(req, res as any, next);

    expect(getUserTenantId).toHaveBeenCalledWith('user-789');
    expect(req.tenantId).toBe('tenant-lookup');
    expect(req.tenantSource).toBe('user-lookup');
    expect(next).toHaveBeenCalled();
  });

  // ── Route-param source removed ───────────────────────────────────────────

  it('does NOT resolve tenant from route params (route-param source removed)', async () => {
    // Even if params.tenantId is present, it must not be used as a resolution source
    const req = buildReq({
      params: { tenantId: 'tenant-from-route-param' },
      // No user, no headers — if route-param were still a source, this would resolve
    });
    const res = mockRes();
    const next = vi.fn();

    await tenantContextMiddleware(true)(req, res as any, next);

    // Should fail with tenant_required, not resolve from route param
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'tenant_required' }));
    expect(next).not.toHaveBeenCalled();
  });

  // ── Conflict detection (all routes) ─────────────────────────────────────

  it('rejects with 403 when service-header tenant conflicts with user claim (non-agent path)', async () => {
    const req = buildReq({
      baseUrl: '/api/values',
      path: '/cases',
      header: vi.fn((name: string) => (name === 'x-tenant-id' ? 'tenant-B' : undefined)),
      serviceIdentityVerified: true,
      user: { id: 'user-123', tenant_id: 'tenant-A' },
    });
    const res = mockRes();
    const next = vi.fn();

    await tenantContextMiddleware()(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'tenant_mismatch',
      message: 'Tenant context must match authenticated tenant claim.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects with 403 when agent-path tenant conflicts with user claim', async () => {
    const req = buildReq({
      baseUrl: '/api/agents',
      path: '/execute',
      header: vi.fn((name: string) => (name === 'x-tenant-id' ? 'tenant-B' : undefined)),
      serviceIdentityVerified: true,
      user: { id: 'user-123', tenant_id: 'tenant-A' },
    });
    const res = mockRes();
    const next = vi.fn();

    await tenantContextMiddleware()(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'tenant_mismatch',
      message: 'Tenant context must match authenticated tenant claim.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows when service-header tenant matches user claim', async () => {
    const req = buildReq({
      header: vi.fn((name: string) => (name === 'x-tenant-id' ? 'tenant-same' : undefined)),
      serviceIdentityVerified: true,
      user: { id: 'user-123', tenant_id: 'tenant-same' },
    });
    const res = mockRes();
    const next = vi.fn();

    await tenantContextMiddleware()(req, res as any, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  // ── Tenant existence and membership ─────────────────────────────────────

  it('rejects with 404 when tenant does not exist', async () => {
    tenantVerificationMocks.verifyTenantExists.mockResolvedValue(false);

    const req = buildReq({ user: { id: 'user-222', tenant_id: 'tenant-unknown' } });
    const res = mockRes();
    const next = vi.fn();

    await tenantContextMiddleware()(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not Found', message: 'Tenant not found or inactive.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects with 404 when membership check fails', async () => {
    tenantVerificationMocks.verifyTenantMembership.mockResolvedValue(false);

    const req = buildReq({ user: { id: 'user-222', tenant_id: 'tenant-222' } });
    const res = mockRes();
    const next = vi.fn();

    await tenantContextMiddleware()(req, res as any, next);

    expect(verifyTenantMembership).toHaveBeenCalledWith('user-222', 'tenant-222');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  // ── Audit logging ────────────────────────────────────────────────────────

  it('sets tenantSource on req so callers can observe the resolution source', async () => {
    // The middleware attaches tenantSource to the request object on every
    // successful resolution. This is the observable contract for audit logging.
    const req = buildReq({ user: { id: 'user-log', tenant_id: 'tenant-log' } });
    const res = mockRes();
    const next = vi.fn();

    await tenantContextMiddleware()(req, res as any, next);

    expect(next).toHaveBeenCalled();
    expect(req.tenantSource).toBe('user-claim');
    expect(req.tenantId).toBe('tenant-log');
  });

  // ── Context binding ──────────────────────────────────────────────────────

  it('binds TCTPayload to AsyncLocalStorage for the request lifetime', async () => {
    const req = buildReq({
      user: { id: 'user-555', tenant_id: 'tenant-555', role: 'admin' },
      session: { expires_at: 1712345678 },
    });
    const res = mockRes();
    const next = vi.fn(() => {
      const context = getCurrentTenantContext();
      expect(context?.tid).toBe('tenant-555');
      expect(context?.sub).toBe('user-555');
      expect(context?.roles).toEqual(['admin']);
    });

    await tenantContextMiddleware()(req, res as any, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
