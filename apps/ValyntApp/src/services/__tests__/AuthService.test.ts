import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../AuthService';
import {
  RateLimitError,
  SessionTimeoutAuthenticationError,
  TokenAuthenticationError,
  ValidationError,
} from '../errors';

const mockSupabaseAuth = {
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
  getUser: vi.fn(),
  setSession: vi.fn(),
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
  app: { apiBaseUrl: '/api' },
}));

vi.mock('../../config/environment', async () => {
  const actual = await vi.importActual<typeof import('../../config/environment')>('../../config/environment');
  return {
    ...actual,
    getConfig: mockGetConfig,
  };
});

const mockFetchWithCSRF = vi.fn();
vi.mock('../../security/CSRFProtection', () => ({
  fetchWithCSRF: mockFetchWithCSRF,
}));

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
    vi.clearAllMocks();
    mockGetConfig.mockReturnValue({ auth: { mfaEnabled: false }, app: { apiBaseUrl: '/api' } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requires MFA code when MFA is enabled', async () => {
    mockGetConfig.mockReturnValue({ auth: { mfaEnabled: true }, app: { apiBaseUrl: '/api' } });

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
    mockGetConfig.mockReturnValue({ auth: { mfaEnabled: true }, app: { apiBaseUrl: '/api' } });
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

  describe('browser auth error mapping', () => {
    const originalWindow = global.window;

    beforeEach(() => {
      Object.defineProperty(global, 'window', {
        value: {} as Window,
        configurable: true,
      });
      mockSupabaseAuth.getSession.mockResolvedValue({ data: { session: null } });
    });

    afterEach(() => {
      Object.defineProperty(global, 'window', {
        value: originalWindow,
        configurable: true,
      });
    });

    it('maps idle timeout failures to SessionTimeoutAuthenticationError', async () => {
      mockFetchWithCSRF.mockResolvedValue({
        ok: false,
        status: 440,
        json: vi.fn().mockResolvedValue({
          error: 'Session expired due to inactivity (30 minutes idle)',
          code: 'SESSION_IDLE_TIMEOUT',
          idleTime: 1900,
        }),
      });

      const request = service.refreshSession();
      await expect(request).rejects.toBeInstanceOf(SessionTimeoutAuthenticationError);
      await expect(request).rejects.toMatchObject({
        authCode: 'SESSION_IDLE_TIMEOUT',
        details: expect.objectContaining({ idleTime: 1900 }),
      });
    });

    it('maps token expiry failures to TokenAuthenticationError', async () => {
      mockFetchWithCSRF.mockResolvedValue({
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({
          error: 'Token expired',
          code: 'TOKEN_EXPIRED',
          expiresAt: 1700000000,
        }),
      });

      await expect(
        service.login({ email: 'user@example.com', password: 'Secret123!' })
      ).rejects.toBeInstanceOf(TokenAuthenticationError);
    });

    it('maps MFA enrollment-required responses to AuthenticationError metadata', async () => {
      mockFetchWithCSRF.mockResolvedValue({
        ok: false,
        status: 403,
        json: vi.fn().mockResolvedValue({
          error: 'MFA setup required',
          code: 'MFA_ENROLLMENT_REQUIRED',
          userId: 'user-1',
          role: 'manager',
        }),
      });

      await expect(
        service.login({ email: 'user@example.com', password: 'Secret123!' })
      ).rejects.toMatchObject({
        authCode: 'MFA_ENROLLMENT_REQUIRED',
        details: expect.objectContaining({ userId: 'user-1', role: 'manager' }),
      });
    });
  });
});
