import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthService } from '../AuthService';
import { ValidationError, RateLimitError } from '../errors';

const mockSupabaseAuth = {
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
  getUser: vi.fn(),
};

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: mockSupabaseAuth },
}));

const mockConsumeAuthRateLimit = vi.fn();
const mockResetRateLimit = vi.fn();
vi.mock('../../security', async () => {
  const actual = await vi.importActual<typeof import('../../security')>('../../security');
  return {
    ...actual,
    consumeAuthRateLimit: mockConsumeAuthRateLimit,
    resetRateLimit: mockResetRateLimit,
    checkPasswordBreach: vi.fn().mockResolvedValue(false),
  };
});

const mockGetConfig = vi.fn(() => ({
  auth: { mfaEnabled: false },
}));

vi.mock('../../config/environment', async () => {
  const actual = await vi.importActual<typeof import('../../config/environment')>('../../config/environment');
  return {
    ...actual,
    getConfig: mockGetConfig,
  };
});

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
    vi.clearAllMocks();
    mockGetConfig.mockReturnValue({ auth: { mfaEnabled: false } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
