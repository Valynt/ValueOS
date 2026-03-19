import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// nonceStore is only reached after identity is verified — not needed for strict-mode tests.
vi.mock('../nonceStore.js', () => ({
  nonceStore: { consumeOnce: vi.fn().mockResolvedValue(true) },
  NonceStoreUnavailableError: class NonceStoreUnavailableError extends Error {},
}));

const { serviceIdentityMiddleware, validateServiceIdentityConfig } = await import('../serviceIdentityMiddleware.js');

function buildApp(middleware: (req: Request, res: Response, next: NextFunction) => void) {
  const app = express();
  app.use(express.json());
  app.use(middleware);
  app.get('/probe', (_req, res) => res.status(200).json({ ok: true }));
  return app;
}

describe('serviceIdentityMiddleware — strict mode (SERVICE_IDENTITY_REQUIRED=true)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure no assertions are configured so the fail-closed branch is reachable.
    delete process.env.SERVICE_IDENTITY_CONFIG_JSON;
    delete process.env.SERVICE_IDENTITY_ALLOWED_SPIFFE_IDS;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns 503 when SERVICE_IDENTITY_REQUIRED=true and no assertions are configured', async () => {
    process.env.SERVICE_IDENTITY_REQUIRED = 'true';

    const app = buildApp(serviceIdentityMiddleware);
    const res = await request(app).get('/probe');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ error: 'Service identity cryptographic assertions not configured' });
  });

  it('calls next() when SERVICE_IDENTITY_REQUIRED is unset and no assertions are configured', async () => {
    delete process.env.SERVICE_IDENTITY_REQUIRED;

    const app = buildApp(serviceIdentityMiddleware);
    // Without strict mode the middleware passes through when nothing is configured.
    // The request will fail at timestamp validation (no x-request-timestamp), but
    // the important assertion is that it does NOT return 503.
    const res = await request(app).get('/probe');

    expect(res.status).not.toBe(503);
  });

  it('returns 503 when SERVICE_IDENTITY_REQUIRED=true even if x-request-timestamp is present', async () => {
    process.env.SERVICE_IDENTITY_REQUIRED = 'true';

    const app = buildApp(serviceIdentityMiddleware);
    const res = await request(app)
      .get('/probe')
      .set('x-request-timestamp', String(Date.now()))
      .set('x-request-nonce', 'some-nonce');

    // Strict-mode check fires before timestamp/nonce validation.
    expect(res.status).toBe(503);
  });

  it('does not return 503 when cryptographic assertions are configured, regardless of SERVICE_IDENTITY_REQUIRED', async () => {
    process.env.SERVICE_IDENTITY_REQUIRED = 'true';
    process.env.SERVICE_IDENTITY_CONFIG_JSON = JSON.stringify({
      expectedAudience: 'valueos-backend',
      hmacKeys: [{ serviceId: 'agent-api', keyId: 'k1', secret: 'super-secret', audience: 'valueos-backend' }],
    });

    const app = buildApp(serviceIdentityMiddleware);
    // Assertions are present — strict-mode bypass is skipped.
    // Request will fail at timestamp validation, but not with 503.
    const res = await request(app).get('/probe');

    expect(res.status).not.toBe(503);
  });

  it('startup validation fails in strict mode when only non-cryptographic assertions are configured', () => {
    process.env.NODE_ENV = 'production';
    process.env.SERVICE_IDENTITY_REQUIRED = 'true';
    process.env.SERVICE_IDENTITY_ALLOWED_SPIFFE_IDS = 'spiffe://cluster.local/ns/valueos/sa/backend';

    expect(() => validateServiceIdentityConfig()).toThrow(/cryptographic assertions/i);
  });
});
