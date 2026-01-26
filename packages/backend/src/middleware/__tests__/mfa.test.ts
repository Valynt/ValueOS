import { vi, describe, it, expect, beforeEach } from 'vitest';
import { requireMFA } from '../mfa.js'
import { mfaService } from '../../services/MFAService.js'

// Mock logger
vi.mock('@shared/lib/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock mfaService
vi.mock('../../services/MFAService', () => ({
  mfaService: {
    hasMFAEnabled: vi.fn(),
    verifyChallenge: vi.fn(),
  },
}));

describe('requireMFA Middleware', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = {
      user: { id: 'user123' },
      headers: {},
      path: '/test',
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  it('should call next() if user does not have MFA enabled', async () => {
    vi.mocked(mfaService.hasMFAEnabled).mockResolvedValue(false);

    await requireMFA(req, res, next);

    expect(mfaService.hasMFAEnabled).toHaveBeenCalledWith('user123');
    expect(next).toHaveBeenCalled();
  });

  it('should return 403 if MFA enabled but no code provided', async () => {
    vi.mocked(mfaService.hasMFAEnabled).mockResolvedValue(true);

    await requireMFA(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'MFA_REQUIRED' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 if MFA enabled and invalid code provided', async () => {
    vi.mocked(mfaService.hasMFAEnabled).mockResolvedValue(true);
    req.headers['x-mfa-code'] = '123456';
    vi.mocked(mfaService.verifyChallenge).mockResolvedValue(false);

    await requireMFA(req, res, next);

    expect(mfaService.verifyChallenge).toHaveBeenCalledWith('user123', '123456');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_MFA_CODE' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next() if MFA enabled and valid code provided', async () => {
    vi.mocked(mfaService.hasMFAEnabled).mockResolvedValue(true);
    req.headers['x-mfa-code'] = '123456';
    vi.mocked(mfaService.verifyChallenge).mockResolvedValue(true);

    await requireMFA(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
