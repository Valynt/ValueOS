import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../AuthService.js'
import { RateLimitError, ValidationError } from '../errors.js'

const { mockSupabaseAuth, mockConsumeAuthRateLimit, mockResetRateLimit, mockGetConfig } = vi.hoisted(() => ({
  mockSupabaseAuth: {
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    signOut: vi.fn(),
    getSession: vi.fn(),
    getUser: vi.fn(),
  },
  mockConsumeAuthRateLimit: vi.fn(),
  mockResetRateLimit: vi.fn(),
  mockGetConfig: vi.fn(() => ({ auth: { mfaEnabled: false } })),
}));

vi.mock('../../lib/supabase', () => ({
  assertNotTestEnv: vi.fn(),
  supabase: { auth: mockSupabaseAuth },
}));

vi.mock('../../security', async () => {
  const actual = await vi.importActual<typeof import('../../security')>('../../security');
  return {
    ...actual,
    consumeAuthRateLimit: mockConsumeAuthRateLimit,
    resetRateLimit: mockResetRateLimit,
    checkPasswordBreach: vi.fn().mockResolvedValue(false),
  };
});

vi.mock('../../config/environment', async () => {
  const actual = await vi.importActual<typeof import('../../config/environment')>('../../config/environment');
  return {
    ...actual,
    getConfig: mockGetConfig,
  };
});

describe('AuthService', () => {
  let service: AuthService;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv, TCT_SECRET: 'test-tct-secret', NODE_ENV: 'test' };
    service = new AuthService();
    vi.clearAllMocks();
    mockGetConfig.mockReturnValue({ auth: { mfaEnabled: false } });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('throws on missing TCT_SECRET outside sanctioned local test mode', () => {
    process.env.TCT_SECRET = '';
    process.env.NODE_ENV = 'development';
    process.env.TCT_ALLOW_EPHEMERAL_SECRET = 'false';
    process.env.LOCAL_TEST_MODE = 'false';

    expect(() => new AuthService()).toThrow(/TCT_SECRET must be set/);
  });

  it('allows ephemeral secret only in sanctioned local test mode', () => {
    process.env.TCT_SECRET = '';
    process.env.NODE_ENV = 'test';
    process.env.TCT_ALLOW_EPHEMERAL_SECRET = 'true';

    expect(() => new AuthService()).not.toThrow();
  });

  it('requires MFA code when MFA is enabled', async () => {
    mockGetConfig.mockReturnValue({ auth: { mfaEnabled: true } });

    await expect(
      service.login({ email: 'user@example.com', password: 'Secret123!' })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects signup when password is breached', async () => {
    const { checkPasswordBreach } = await import('../../security');
    (checkPasswordBreach as vi.Mock).mockResolvedValueOnce(true);

    await expect(
      service.signup({ email: 'user@example.com', password: 'Secret123!', fullName: 'User' })
    ).rejects.toThrow(/breach/);
    expect(mockSupabaseAuth.signUp).not.toHaveBeenCalled();
  });

  it('rejects password update when password is breached', async () => {
    const { checkPasswordBreach } = await import('../../security');
    (checkPasswordBreach as vi.Mock).mockResolvedValueOnce(true);

    await expect(service.updatePassword('Secret123!')).rejects.toThrow(/breach/);
    expect(mockSupabaseAuth.updateUser).not.toHaveBeenCalled();
  });

  it('throws RateLimitError when rate limit exceeded on login', async () => {
    const { RateLimitExceededError } = await import('../../security');
    mockConsumeAuthRateLimit.mockImplementation(() => {
      throw new RateLimitExceededError(1000, 5, 300000);
    });

    await expect(
      service.login({ email: 'user@example.com', password: 'Secret123!', otpCode: '123456' })
    ).rejects.toBeInstanceOf(RateLimitError);
    expect(mockSupabaseAuth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('logs in successfully when MFA provided and backend returns session', async () => {
    mockGetConfig.mockReturnValue({ auth: { mfaEnabled: true } });
    mockSupabaseAuth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'u1' }, session: { access_token: 't' } },
      error: null,
    });

    const result = await service.login({
      email: 'user@example.com',
      password: 'Secret123!',
      otpCode: '654321',
    });

    expect(result.user?.id).toBe('u1');
    expect(result.session?.access_token).toBe('t');
    expect(mockSupabaseAuth.signInWithPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        password: 'Secret123!',
        options: expect.objectContaining({ captchaToken: '654321' }),
      })
    );
  });
});
