import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

const originalEnv = process.env;

describe('createWorkerServiceSupabaseClient', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    };
  });

  it('throws when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const { createWorkerServiceSupabaseClient } = await import('./createWorkerServiceSupabaseClient');

    expect(() =>
      createWorkerServiceSupabaseClient({
        justification: 'service-role:justified worker test missing key',
      }),
    ).toThrow('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('creates a service-role client when SUPABASE_SERVICE_ROLE_KEY is present', async () => {
    const fakeClient = { from: vi.fn() };
    createClientMock.mockReturnValue(fakeClient);

    const { createWorkerServiceSupabaseClient } = await import('./createWorkerServiceSupabaseClient');

    const client = createWorkerServiceSupabaseClient({
      justification: 'service-role:justified worker test valid config',
    });

    expect(client).toBe(fakeClient);
    expect(createClientMock).toHaveBeenCalledWith('https://example.supabase.co', 'service-role-key', {
      auth: {
        persistSession: false,
      },
    });
  });
});
