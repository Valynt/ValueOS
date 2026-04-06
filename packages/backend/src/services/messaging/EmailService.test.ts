import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loggerMock } = vi.hoisted(() => ({
  loggerMock: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../config/environment.js', () => ({
  getConfig: () => ({
    email: { enabled: true },
    app: { url: 'https://app.valueos.com' },
  }),
}));

vi.mock('../../lib/logger.js', () => ({
  logger: loggerMock,
  createLogger: () => loggerMock,
}));

import { EmailService } from './EmailService.js';

type EmailServiceInternals = {
  renderTemplate: (templateName: string, data: Record<string, unknown>) => string;
};

describe('EmailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('escapes HTML-sensitive values in rendered templates', () => {
    const service = new EmailService();
    const internals = service as unknown as EmailServiceInternals;

    const html = internals.renderTemplate('welcome', {
      organizationName: '<script>alert(1)</script>',
      tier: 'enterprise',
      features: ['safe_mode', '<img src=x onerror=alert(1)>'],
      limits: { users: 100 },
    });

    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('Welcome to ValueOS!');
  });

  it('returns an empty body and warns for unknown templates', () => {
    const service = new EmailService();
    const internals = service as unknown as EmailServiceInternals;

    const html = internals.renderTemplate('not-a-template', {});

    expect(html).toBe('');
    expect(loggerMock.warn).toHaveBeenCalledWith('Template not-a-template not found, sending empty body');
  });
});
