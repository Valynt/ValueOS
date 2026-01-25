import { vi, describe, it, expect, beforeEach } from 'vitest';
import { requirePolicy } from '../rbac';

// Mock logger
vi.mock('@shared/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock permissions
vi.mock('@shared/lib/permissions', () => ({
  hasPermission: vi.fn().mockReturnValue(true),
  USER_ROLE_PERMISSIONS: {},
  USER_ROLES: {},
}));

describe('requirePolicy Middleware', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = {
      user: { id: 'user123', role: 'member', department: 'engineering' },
      path: '/test',
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
  });

  it('should allow access if policy returns true', async () => {
    const policy = vi.fn().mockReturnValue(true);
    const middleware = requirePolicy(policy);

    await middleware(req, res, next);

    expect(policy).toHaveBeenCalledWith(req.user, undefined);
    expect(next).toHaveBeenCalled();
  });

  it('should deny access if policy returns false', async () => {
    const policy = vi.fn().mockReturnValue(false);
    const middleware = requirePolicy(policy);

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should extract resource and pass to policy', async () => {
    const policy = vi.fn().mockReturnValue(true);
    const extractor = vi.fn().mockResolvedValue({ id: 'res1', department: 'engineering' });
    const middleware = requirePolicy(policy, extractor);

    await middleware(req, res, next);

    expect(extractor).toHaveBeenCalledWith(req);
    expect(policy).toHaveBeenCalledWith(req.user, { id: 'res1', department: 'engineering' });
    expect(next).toHaveBeenCalled();
  });
});
