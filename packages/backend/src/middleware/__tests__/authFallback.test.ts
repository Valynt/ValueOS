import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { __setEnvSourceForTests } from '@shared/lib/env';

vi.mock('@shared/lib/supabase', () => ({
  getSupabaseClient: vi.fn(() => {
    throw new Error('supabase unavailable');
  }),
  createRequestSupabaseClient: vi.fn(),
  getRequestSupabaseClient: vi.fn(),
}));

const { verifyAccessToken } = await import('../auth');

describe('verifyAccessToken local fallback policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __setEnvSourceForTests({ SUPABASE_JWT_SECRET: 'test-secret' });
  });

  afterEach(() => {
    __setEnvSourceForTests({});
  });

  it('does not use local JWT verification unless explicitly enabled', async () => {
    const token = jwt.sign({ sub: 'user-123', email: 'user@example.com' }, 'test-secret', {
      expiresIn: '1h',
    });

    const verified = await verifyAccessToken(token);

    expect(verified).toBeNull();
  });

  it('allows local JWT verification in explicit break-glass mode', async () => {
    __setEnvSourceForTests({ SUPABASE_JWT_SECRET: 'test-secret', ALLOW_LOCAL_JWT_FALLBACK: 'true' });
    const token = jwt.sign({ sub: 'user-123', email: 'user@example.com' }, 'test-secret', {
      expiresIn: '1h',
    });

    const verified = await verifyAccessToken(token);

    expect(verified?.user.id).toBe('user-123');
    expect(verified?.session.access_token).toBe(token);
  });
});
