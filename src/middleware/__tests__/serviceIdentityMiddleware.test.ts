import { describe, it, expect, vi } from 'vitest';
import { addServiceIdentityHeader, serviceIdentityMiddleware } from '../serviceIdentityMiddleware';
import { getAutonomyConfig } from '../../config/autonomy';

vi.mock('../../config/autonomy', () => ({
  getAutonomyConfig: vi.fn(() => ({
    serviceIdentityToken: 'secret-token',
  })),
}));

function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe('serviceIdentityMiddleware', () => {
  it('rejects missing headers', () => {
    const req = { header: vi.fn(() => undefined) } as any;
    const res = mockRes();
    const next = vi.fn();

    serviceIdentityMiddleware(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts valid identity + timestamp + nonce', async () => {
    const now = Date.now();
    const req = {
      header: vi.fn((name: string) => {
        switch (name.toLowerCase()) {
          case 'x-service-identity':
            return 'secret-token';
          case 'x-request-timestamp':
            return now.toString();
          case 'x-request-nonce':
            return 'nonce';
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
    });

    expect(next).toHaveBeenCalled();
  });
});

describe('addServiceIdentityHeader', () => {
  it('adds signing headers when token present', () => {
    const headers: Record<string, string> = {};
    const result = addServiceIdentityHeader(headers);
    expect(result['X-Service-Identity']).toBe('secret-token');
    expect(result['X-Request-Timestamp']).toBeDefined();
    expect(result['X-Request-Nonce']).toBeDefined();
  });

  it('is no-op when no token configured', () => {
    (getAutonomyConfig as any).mockReturnValueOnce({ serviceIdentityToken: '' });
    const headers: Record<string, string> = {};
    const result = addServiceIdentityHeader(headers);
    expect(result['X-Service-Identity']).toBeUndefined();
  });
});
