import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const infoMock = vi.fn();
const errorMock = vi.fn();
const sanitizeForLoggingMock = vi.fn((value: unknown) => {
  if (typeof value === 'string' && value.includes('@')) {
    return '[REDACTED_EMAIL]';
  }

  return value;
});

const claimReferralMock = vi.fn();

vi.mock('@shared/lib/logger', () => ({
  createLogger: () => ({
    info: infoMock,
    error: errorMock,
    warn: vi.fn()
  })
}));

vi.mock('@shared/lib/piiFilter', () => ({
  sanitizeForLogging: sanitizeForLoggingMock
}));

vi.mock('../services/ReferralService.js', () => ({
  referralService: {
    generateReferralCode: vi.fn(),
    claimReferral: claimReferralMock,
    completeReferral: vi.fn(),
    getReferralDashboard: vi.fn(),
    validateReferralCode: vi.fn(),
    getReferralStats: vi.fn(),
    getUserReferralCode: vi.fn(),
    getUserReferrals: vi.fn(),
    getUserRewards: vi.fn(),
    deactivateReferralCode: vi.fn()
  }
}));

vi.mock('../services/security/AuditLogService.js', () => ({
  auditLogService: {
    logAudit: vi.fn()
  }
}));

vi.mock('../../middleware/secureRouter.js', async () => {
  const expressModule = await import('express');
  return {
    createSecureRouter: () => expressModule.Router()
  };
});

vi.mock('../../middleware/inputValidation.js', () => ({
  validateRequest: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) =>
    next()
}));

vi.mock('../../middleware/rateLimiter.js', () => ({
  createRateLimiter: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) =>
    next()
}));

vi.mock('../../middleware/auth.js', () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    const typedReq = req as express.Request & { user: { id: string } };
    typedReq.user = { id: 'user-1' };
    next();
  }
}));

describe('referral audit/privacy logging paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sanitizes referral claim email in logger context', async () => {
    claimReferralMock.mockResolvedValueOnce({
      success: true,
      referral_id: 'ref-1',
      referrer_id: 'referrer-1',
      reward: 'discount'
    });

    const { default: router } = await import('../referrals.js');
    const app = express();
    app.use(express.json());
    app.use('/api/referrals', router);

    const response = await request(app).post('/api/referrals/claim').send({
      referral_code: 'abc12345',
      referee_email: 'person@example.com'
    });

    expect(response.status).toBe(200);
    expect(sanitizeForLoggingMock).toHaveBeenCalledWith('person@example.com');
    expect(infoMock).toHaveBeenCalledWith('Referral claimed', expect.objectContaining({
      referee_email: '[REDACTED_EMAIL]'
    }));
    expect(JSON.stringify(infoMock.mock.calls)).not.toContain('person@example.com');
  });
});
