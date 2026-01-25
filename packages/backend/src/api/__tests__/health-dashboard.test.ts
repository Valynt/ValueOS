
import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'fs';
import path from 'path';

// Mock dependencies to isolate the router
vi.mock('@shared/lib/health/metrics', () => ({
  healthMetrics: {
    recordHealthSnapshot: vi.fn(),
    getServiceStats: vi.fn(),
    getHealthHistory: vi.fn(),
    getHealthTrends: vi.fn(),
  }
}));

vi.mock('@shared/lib/health/alerts', () => ({
  alertManager: {
    getActiveAlerts: vi.fn(),
    getAllAlerts: vi.fn(),
    acknowledgeAlert: vi.fn(),
  }
}));

vi.mock('../../middleware/securityHeaders', () => ({
  securityHeadersMiddleware: (req: any, res: any, next: any) => next(),
}));

vi.mock('../../middleware/serviceIdentityMiddleware', () => ({
  serviceIdentityMiddleware: (req: any, res: any, next: any) => next(),
}));

vi.mock('../../middleware/rateLimiter', () => ({
  rateLimiters: {
    loose: (req: any, res: any, next: any) => next(),
  }
}));

vi.mock('../../middleware/requestAuditMiddleware', () => ({
  requestAuditMiddleware: () => (req: any, res: any, next: any) => next(),
}));

// We need to import the router. Since it might not be exported yet in the source,
// this import might fail during the "verify" step if not fixed.
// For now we assume the fix will export it as default.
import healthRouter from '../health/index';

describe('Health Dashboard Endpoint', () => {
  const app = express();
  app.use(healthRouter);

  const publicDir = path.join(process.cwd(), 'public');
  const dashboardPath = path.join(publicDir, 'health-dashboard.html');
  const dummyContent = '<html><body>Test Dashboard</body></html>';
  let originalContent: string | null = null;

  beforeAll(() => {
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    if (fs.existsSync(dashboardPath)) {
        originalContent = fs.readFileSync(dashboardPath, 'utf8');
    }
    fs.writeFileSync(dashboardPath, dummyContent);
  });

  afterAll(() => {
    if (originalContent !== null) {
        fs.writeFileSync(dashboardPath, originalContent);
    } else {
        if (fs.existsSync(dashboardPath)) {
            fs.unlinkSync(dashboardPath);
        }
    }
  });

  it('GET /health/dashboard returns the dashboard html', async () => {
    const res = await request(app).get('/health/dashboard');
    expect(res.status).toBe(200);
    expect(res.text).toBe(dummyContent);
    expect(res.headers['content-type']).toMatch(/text\/html/);
  });
});
