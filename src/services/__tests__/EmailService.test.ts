
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailService, EmailProvider, EmailOptions } from '../EmailService';
import { logger } from '../../lib/logger';
import { getConfig } from '../../config/environment';

// Mock logger
vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock config
vi.mock('../../config/environment', () => ({
  getConfig: vi.fn(),
}));

describe('EmailService', () => {
  let emailService: EmailService;
  let mockProvider: EmailProvider;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default config mock
    (getConfig as any).mockReturnValue({
      email: {
        enabled: true,
        from: 'test@example.com',
        // No keys by default
      }
    });
  });

  it('should initialize with LoggerEmailProvider by default', () => {
    emailService = new EmailService();
    expect(emailService.getProviderName()).toBe('logger');
  });

  it('should initialize with SendGridProvider if key is present', () => {
    (getConfig as any).mockReturnValue({
      email: {
        enabled: true,
        sendgridApiKey: 'sg_key',
      }
    });
    emailService = new EmailService();
    expect(emailService.getProviderName()).toBe('sendgrid');
  });

  it('should initialize with PostmarkProvider if token is present and sendgrid is missing', () => {
    (getConfig as any).mockReturnValue({
      email: {
        enabled: true,
        postmarkToken: 'pm_token',
      }
    });
    emailService = new EmailService();
    expect(emailService.getProviderName()).toBe('postmark');
  });

  it('should send email using the provider', async () => {
    emailService = new EmailService();

    // Create a mock provider
    mockProvider = {
      name: 'mock',
      send: vi.fn().mockResolvedValue(undefined)
    };

    // Inject the mock provider
    emailService.setProvider(mockProvider);

    const options: EmailOptions = {
      to: 'user@example.com',
      subject: 'Test Subject',
      text: 'Test Body'
    };

    await emailService.send(options);

    expect(mockProvider.send).toHaveBeenCalledWith(options);
  });

  it('should not send email if disabled in config', async () => {
    (getConfig as any).mockReturnValue({
      email: {
        enabled: false
      }
    });

    emailService = new EmailService();
    // Inject mock to spy
    mockProvider = { name: 'mock', send: vi.fn() };
    emailService.setProvider(mockProvider);

    const options: EmailOptions = {
      to: 'user@example.com',
      subject: 'Test Subject'
    };

    await emailService.send(options);

    expect(mockProvider.send).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('disabled'), expect.any(Object));
  });

  it('should throw error if "to" is missing', async () => {
    emailService = new EmailService();
    const options: EmailOptions = {
      to: '',
      subject: 'Test Subject'
    };

    await expect(emailService.send(options)).rejects.toThrow('Email recipient "to" is required');
  });

  it('should log error if provider fails', async () => {
    emailService = new EmailService();
    mockProvider = {
        name: 'mock',
        send: vi.fn().mockRejectedValue(new Error('Provider Error'))
    };
    emailService.setProvider(mockProvider);

    const options: EmailOptions = {
      to: 'user@example.com',
      subject: 'Test Subject'
    };

    await expect(emailService.send(options)).rejects.toThrow('Provider Error');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to send email'), expect.any(Error));
  });
});
