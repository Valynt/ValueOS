import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EmailService, emailService } from '../EmailService';
import { logger } from '../../lib/logger';
import * as environmentConfig from '../../config/environment';

// Mock logger
vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock config
vi.mock('../../config/environment', () => ({
  getConfig: vi.fn(),
  default: {
    email: { enabled: true, from: 'test@example.com' },
    app: { url: 'http://localhost:3000' }
  }
}));

describe('EmailService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (environmentConfig.getConfig as any).mockReturnValue({
      email: { enabled: true, from: 'test@example.com' },
      app: { url: 'http://localhost:3000' }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should skip sending if email is disabled', async () => {
    (environmentConfig.getConfig as any).mockReturnValue({
      email: { enabled: false },
    });

    await emailService.send({
      to: 'test@example.com',
      subject: 'Test',
      text: 'Body'
    });

    expect(logger.info).toHaveBeenCalledWith(
      'Email disabled, skipping sending',
      expect.any(Object)
    );
  });

  it('should render welcome template correctly', async () => {
    const data = {
      organizationName: 'Test Org',
      tier: 'starter',
      features: ['feature_1', 'feature_2'],
      limits: { maxUsers: 10, maxProjects: 5 }
    };

    await emailService.send({
      to: 'owner@example.com',
      subject: 'Welcome',
      template: 'welcome',
      data
    });

    expect(logger.info).toHaveBeenCalledWith(
      'Sending email to owner@example.com',
      expect.objectContaining({
        subject: 'Welcome',
        template: 'welcome',
      })
    );

    // Get the log call arguments to inspect the content
    const logCall = (logger.info as any).mock.calls.find((call: any[]) =>
      call[0] === 'Sending email to owner@example.com'
    );
    const logData = logCall[1];

    // We only log a preview, but for this test we'd like to check if content was generated.
    expect(logData.contentPreview).toContain('<!DOCTYPE html>');
  });

  it('should handle missing template gracefully', async () => {
    await emailService.send({
      to: 'test@example.com',
      subject: 'Test',
      template: 'non_existent_template',
      data: {}
    });

    expect(logger.warn).toHaveBeenCalledWith(
      'Template non_existent_template not found, sending empty body'
    );
  });

  it('should handle direct HTML content', async () => {
    const html = '<p>Test content</p>';
    await emailService.send({
      to: 'test@example.com',
      subject: 'Direct HTML',
      html
    });

    expect(logger.info).toHaveBeenCalledWith(
      'Sending email to test@example.com',
      expect.objectContaining({
         subject: 'Direct HTML',
         contentPreview: expect.stringContaining('<p>Test content</p>')
      })
    );
  });
});
