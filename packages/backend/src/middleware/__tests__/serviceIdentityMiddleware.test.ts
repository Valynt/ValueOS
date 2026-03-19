import { createHash, createHmac } from 'crypto';

import { describe, expect, it, vi } from 'vitest';

import { addServiceIdentityHeader, serviceIdentityMiddleware } from '../serviceIdentityMiddleware.js'

vi.mock('../nonceStore.js', () => ({
  nonceStore: { consumeOnce: vi.fn().mockResolvedValue(true) },
  NonceStoreUnavailableError: class NonceStoreUnavailableError extends Error {},
}));

function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe('serviceIdentityMiddleware', () => {
  it('rejects missing signed assertion headers', () => {
    process.env.SERVICE_IDENTITY_CONFIG_JSON = JSON.stringify({
      expectedAudience: 'valueos-backend',
      hmacKeys: [{ serviceId: 'agent-api', keyId: 'k1', secret: 'super-secret', audience: 'valueos-backend' }],
    });
    const req = { method: 'POST', url: '/internal', originalUrl: '/internal', body: {}, header: vi.fn(() => undefined) } as any;
    const res = mockRes();
    const next = vi.fn();

    serviceIdentityMiddleware(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    delete process.env.SERVICE_IDENTITY_CONFIG_JSON;
  });

  it('accepts valid hmac signed assertion', async () => {
    process.env.SERVICE_IDENTITY_CONFIG_JSON = JSON.stringify({
      expectedAudience: 'valueos-backend',
      hmacKeys: [{ serviceId: 'agent-api', keyId: 'k1', secret: 'super-secret', audience: 'valueos-backend' }],
    });

    const now = Date.now();
    const nonce = 'nonce';
    const body = { ping: true };
    const bodyHash = createHash('sha256').update(JSON.stringify(body)).digest('hex');
    const payload = ['POST', '/internal', bodyHash, String(now), nonce].join('\n');
    const signature = createHmac('sha256', 'super-secret').update(payload).digest('hex');

    const req = {
      method: 'POST',
      url: '/internal',
      originalUrl: '/internal',
      body,
      header: vi.fn((name: string) => {
        switch (name.toLowerCase()) {
          case 'x-service-id':
            return 'agent-api';
          case 'x-key-id':
            return 'k1';
          case 'x-service-audience':
            return 'valueos-backend';
          case 'x-request-signature':
            return signature;
          case 'x-request-timestamp':
            return now.toString();
          case 'x-request-nonce':
            return nonce;
          case 'x-body-sha256':
            return bodyHash;
          default:
            return undefined;
        }
      }),
    } as any;

    const res = mockRes();
    const next = vi.fn();

    await new Promise<void>((resolve) => {
      serviceIdentityMiddleware(req, res as any, () => {
        next();
        resolve();
      });
      setTimeout(resolve, 25);
    });

    expect(next).toHaveBeenCalled();
    delete process.env.SERVICE_IDENTITY_CONFIG_JSON;
  });

  it('rejects forged x-spiffe-id without signed ingress attestation', () => {
    process.env.SERVICE_IDENTITY_CONFIG_JSON = JSON.stringify({
      expectedAudience: 'valueos-backend',
      allowedSpiffeIds: ['spiffe://cluster.local/ns/valynt/sa/backend'],
      hmacKeys: [{ serviceId: 'agent-api', keyId: 'k1', secret: 'super-secret', audience: 'valueos-backend' }],
    });

    const req = {
      method: 'POST',
      url: '/internal',
      originalUrl: '/internal',
      body: {},
      header: vi.fn((name: string) => {
        switch (name.toLowerCase()) {
          case 'x-spiffe-id':
            return 'spiffe://cluster.local/ns/valynt/sa/backend';
          case 'x-request-timestamp':
            return String(Date.now());
          case 'x-request-nonce':
            return 'forged-nonce';
          default:
            return undefined;
        }
      }),
    } as any;

    const res = mockRes();
    const next = vi.fn();

    serviceIdentityMiddleware(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    delete process.env.SERVICE_IDENTITY_CONFIG_JSON;
  });

  it('rejects forged x-service-principal without jwt/hmac assertion', () => {
    process.env.SERVICE_IDENTITY_CONFIG_JSON = JSON.stringify({
      expectedAudience: 'valueos-backend',
      allowedSpiffeIds: ['internal-agent'],
      hmacKeys: [{ serviceId: 'agent-api', keyId: 'k1', secret: 'super-secret', audience: 'valueos-backend' }],
    });

    const req = {
      method: 'POST',
      url: '/internal',
      originalUrl: '/internal',
      body: {},
      header: vi.fn((name: string) => {
        switch (name.toLowerCase()) {
          case 'x-service-principal':
            return 'internal-agent';
          case 'x-request-timestamp':
            return String(Date.now());
          case 'x-request-nonce':
            return 'forged-principal-nonce';
          default:
            return undefined;
        }
      }),
    } as any;

    const res = mockRes();
    const next = vi.fn();

    serviceIdentityMiddleware(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    delete process.env.SERVICE_IDENTITY_CONFIG_JSON;
  });

  it('rejects legacy x-service-identity header without signed assertion', () => {
    process.env.NODE_ENV = 'production';
    process.env.SERVICE_IDENTITY_REQUIRED = 'true';
    process.env.SERVICE_IDENTITY_CONFIG_JSON = JSON.stringify({
      expectedAudience: 'valueos-backend',
      hmacKeys: [{ serviceId: 'agent-api', keyId: 'k1', secret: 'super-secret', audience: 'valueos-backend' }],
    });

    const req = {
      method: 'POST',
      url: '/internal',
      originalUrl: '/internal',
      body: {},
      header: vi.fn((name: string) => {
        switch (name.toLowerCase()) {
          case 'x-service-identity':
            return 'legacy-shared-secret';
          case 'x-request-timestamp':
            return String(Date.now());
          case 'x-request-nonce':
            return 'legacy-nonce';
          default:
            return undefined;
        }
      }),
    } as any;

    const res = mockRes();
    const next = vi.fn();

    serviceIdentityMiddleware(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    delete process.env.NODE_ENV;
    delete process.env.SERVICE_IDENTITY_REQUIRED;
    delete process.env.SERVICE_IDENTITY_CONFIG_JSON;
  });
});

describe('addServiceIdentityHeader', () => {
  it('adds hmac signing headers when outbound key present', () => {
    process.env.SERVICE_IDENTITY_CONFIG_JSON = JSON.stringify({
      expectedAudience: 'valueos-backend',
      hmacKeys: [{ serviceId: 'agent-api', keyId: 'k1', secret: 'super-secret', audience: 'valueos-backend' }],
    });
    process.env.SERVICE_IDENTITY_CALLER_ID = 'agent-api';

    const headers: Record<string, string> = {};
    const result = addServiceIdentityHeader(headers, { method: 'POST', path: '/agents', body: { hello: 'world' } });
    expect(result['X-Service-Id']).toBe('agent-api');
    expect(result['X-Key-Id']).toBe('k1');
    expect(result['X-Request-Signature']).toBeDefined();
    expect(result['X-Body-SHA256']).toBe(createHash('sha256').update(JSON.stringify({ hello: 'world' })).digest('hex'));

    delete process.env.SERVICE_IDENTITY_CONFIG_JSON;
    delete process.env.SERVICE_IDENTITY_CALLER_ID;
  });
});
