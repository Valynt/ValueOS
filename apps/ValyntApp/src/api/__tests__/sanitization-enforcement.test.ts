import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

const {
  loginMock,
  auditLogMock,
  logRequestEventMock,
  getJobStatusMock,
  getUsageMock,
} = vi.hoisted(() => ({
  loginMock: vi.fn(),
  auditLogMock: vi.fn().mockResolvedValue(undefined),
  logRequestEventMock: vi.fn().mockResolvedValue(undefined),
  getJobStatusMock: vi.fn().mockResolvedValue({ status: 'queued' }),
  getUsageMock: vi.fn().mockResolvedValue(5),
}));

vi.mock('../../services/AuthService', () => ({
  authService: {
    login: loginMock,
  },
}));

vi.mock('../../services/AuditLogService', () => ({
  auditLogService: {
    logAudit: auditLogMock,
  },
}));

vi.mock('../../services/SecurityAuditService', () => ({
  securityAuditService: {
    logRequestEvent: logRequestEventMock,
  },
}));

vi.mock('../../middleware/rateLimiter', () => ({
  rateLimiters: {
    strict: (_req: any, _res: any, next: any) => next(),
    standard: (_req: any, _res: any, next: any) => next(),
    loose: (_req: any, _res: any, next: any) => next(),
    agentExecution: (_req: any, _res: any, next: any) => next(),
    agentQuery: (_req: any, _res: any, next: any) => next(),
  },
}));

vi.mock('../../services/MessageQueue', () => ({
  llmQueue: {
    getJobStatus: getJobStatusMock,
  },
}));

vi.mock('../../services/metering/UsageCache', () => ({
  default: {
    getCurrentUsage: getUsageMock,
    getQuota: vi.fn().mockResolvedValue(10),
    getUsagePercentage: vi.fn().mockResolvedValue(50),
  },
}));

import authRouter from '../auth';
import queueRouter from '../queue';
import usageRouter from '../billing/usage';

const csrfToken = 'test-token';
const csrfHeaders = {
  'x-csrf-token': csrfToken,
  Cookie: `csrf_token=${csrfToken}`,
};

describe('request sanitization enforcement', () => {
  it('sanitizes auth login payloads before login service', async () => {
    loginMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', user_metadata: {} },
      session: { access_token: 'token', refresh_token: 'refresh', expires_at: 123 },
    });

    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);

    await request(app)
      .post('/api/auth/login')
      .set(csrfHeaders)
      .send({ email: 'user@example.com', password: '<b>pass</b>' })
      .expect(200);

    expect(loginMock).toHaveBeenCalledTimes(1);
    const loginArgs = loginMock.mock.calls[0][0];
    expect(loginArgs.password).not.toContain('<');
    expect(loginArgs.password).toMatch(/&(?:amp;)*lt;/);
  });

  it('sanitizes queue jobId params before responding', async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).tenantId = 'tenant-123';
      next();
    });
    app.use('/api/queue', queueRouter);

    const response = await request(app)
      .get('/api/queue/llm/%3Cb%3Ejob%3C%2Fb%3E')
      .set(csrfHeaders)
      .expect(200);

    expect(response.body.data.jobId).toBe('&lt;b&gt;job&lt;/b&gt;');
  });

  it('sanitizes billing usage metric params before responding', async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).tenantId = 'tenant-456';
      next();
    });
    app.use('/api/billing/usage', usageRouter);

    const response = await request(app)
      .get('/api/billing/usage/%3Cb%3Eapi_calls%3C%2Fb%3E')
      .expect(200);

    expect(response.body.metric).toBe('&lt;b&gt;api_calls&lt;/b&gt;');
  });
});
