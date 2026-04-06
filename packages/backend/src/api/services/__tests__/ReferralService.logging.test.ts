import { beforeEach, describe, expect, it, vi } from 'vitest';

const loggerInfoMock = vi.fn();
const loggerErrorMock = vi.fn();
const rpcMock = vi.fn();
const sanitizeForLoggingMock = vi.fn((value: unknown) => {
  if (typeof value === 'string') {
    return value.includes('@') ? '[REDACTED_EMAIL]' : `[sanitized:${value}]`;
  }

  return '[sanitized]';
});

vi.mock('@shared/lib/logger', () => ({
  createLogger: () => ({
    info: loggerInfoMock,
    error: loggerErrorMock,
    warn: vi.fn()
  })
}));

vi.mock('@shared/lib/piiFilter', () => ({
  sanitizeForLogging: sanitizeForLoggingMock
}));

vi.mock('../../../lib/supabase.js', () => ({
  assertNotTestEnv: vi.fn(),
  supabase: {},
  createServiceRoleSupabaseClient: () => ({
    rpc: rpcMock
  })
}));

const { ReferralService } = await import('../ReferralService.js');

describe('ReferralService logging privacy', () => {
  const request = {
    referral_code: 'ABC12345',
    referee_email: 'person@example.com',
    ip_address: '127.0.0.1',
    user_agent: 'vitest-agent'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs sanitized referee email on successful claim', async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        success: true,
        referral_id: 'ref-1',
        referrer_id: 'referrer-1'
      },
      error: null
    });

    const service = new ReferralService();
    await service.claimReferral(request);

    expect(loggerInfoMock).toHaveBeenCalledWith('Referral claimed successfully', {
      referral_id: 'ref-1',
      referrer_id: 'referrer-1',
      referee_email: '[REDACTED_EMAIL]'
    });
    expect(JSON.stringify(loggerInfoMock.mock.calls)).not.toContain('person@example.com');
  });

  it('does not log raw referee email when rpc returns an error', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'claim failed' }
    });

    const service = new ReferralService();
    await service.claimReferral(request);

    expect(loggerErrorMock).toHaveBeenCalledWith('Failed to claim referral', { message: 'claim failed' }, {
      referral_code: '[sanitized:ABC12345]',
      referee_email: '[REDACTED_EMAIL]'
    });
    expect(JSON.stringify(loggerErrorMock.mock.calls)).not.toContain('person@example.com');
  });

  it('does not log full request object on unexpected failures', async () => {
    rpcMock.mockRejectedValueOnce(new Error('db unavailable'));

    const service = new ReferralService();
    await service.claimReferral(request);

    const thirdArg = loggerErrorMock.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(thirdArg).not.toHaveProperty('request');
    expect(thirdArg).toEqual({
      referral_code: '[sanitized:ABC12345]',
      referee_email: '[REDACTED_EMAIL]'
    });
    expect(JSON.stringify(loggerErrorMock.mock.calls)).not.toContain('person@example.com');
  });
});
