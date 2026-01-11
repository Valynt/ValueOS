/**
 * Email Service
 *
 * Handles sending transactional emails using configured providers.
 * Supports multiple providers (SendGrid, Postmark) via adapter pattern.
 * Defaults to logging provider for development/testing.
 */

import { logger } from '../lib/logger';
import { getConfig } from '../config/environment';
import { BaseService } from './BaseService';

export interface EmailOptions {
  to: string | string[];
  subject?: string;
  template?: string;
  data?: Record<string, any>;
  text?: string;
  html?: string;
  from?: string;
}

export interface EmailProvider {
  name: string;
  send(options: EmailOptions): Promise<void>;
}

/**
 * Logger Provider - Simulates email sending by logging to console/system logs
 */
class LoggerEmailProvider implements EmailProvider {
  name = 'logger';

  async send(options: EmailOptions): Promise<void> {
    logger.info('📧 Email sent (simulated)', {
      to: options.to,
      subject: options.subject,
      template: options.template,
      context: options.data,
      provider: this.name
    });
  }
}

/**
 * SendGrid Provider implementation
 */
class SendGridProvider implements EmailProvider {
  name = 'sendgrid';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async send(options: EmailOptions): Promise<void> {
    if (!this.apiKey) {
      throw new Error('SendGrid API key not configured');
    }

    const config = getConfig();

    // Construct request body
    const body = {
      personalizations: [{
        to: Array.isArray(options.to)
          ? options.to.map(email => ({ email }))
          : [{ email: options.to }],
        dynamic_template_data: options.data,
      }],
      from: { email: options.from || config.email.from || 'noreply@valuecanvas.com' },
      subject: options.subject,
      content: options.text || options.html ? [
        options.text ? { type: 'text/plain', value: options.text } : undefined,
        options.html ? { type: 'text/html', value: options.html } : undefined,
      ].filter(Boolean) : undefined,
      template_id: options.template, // Assumes template maps to SendGrid Template ID
    };

    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`SendGrid API error: ${response.status} ${JSON.stringify(errorData)}`);
      }
    } catch (error) {
      logger.error('Failed to send email via SendGrid', error as Error);
      throw error;
    }
  }
}

/**
 * Postmark Provider implementation
 */
class PostmarkProvider implements EmailProvider {
  name = 'postmark';
  private serverToken: string;

  constructor(serverToken: string) {
    this.serverToken = serverToken;
  }

  async send(options: EmailOptions): Promise<void> {
    if (!this.serverToken) {
      throw new Error('Postmark Server Token not configured');
    }

    const config = getConfig();
    const endpoint = options.template
      ? 'https://api.postmarkapp.com/email/withTemplate'
      : 'https://api.postmarkapp.com/email';

    const body: any = {
      From: options.from || config.email.from || 'noreply@valuecanvas.com',
      To: Array.isArray(options.to) ? options.to.join(',') : options.to,
      TemplateAlias: options.template,
      TemplateModel: options.data,
      Subject: options.subject,
      HtmlBody: options.html,
      TextBody: options.text,
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'X-Postmark-Server-Token': this.serverToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Postmark API error: ${response.status} ${JSON.stringify(errorData)}`);
      }
    } catch (error) {
      logger.error('Failed to send email via Postmark', error as Error);
      throw error;
    }
  }
}

export class EmailService extends BaseService {
  private provider: EmailProvider;

  constructor() {
    super('EmailService');
    this.provider = this.initializeProvider();
  }

  private initializeProvider(): EmailProvider {
    const config = getConfig();

    if (config?.email?.sendgridApiKey) {
      logger.info('Initializing SendGrid email provider');
      return new SendGridProvider(config.email.sendgridApiKey);
    }

    if (config?.email?.postmarkToken) {
      logger.info('Initializing Postmark email provider');
      return new PostmarkProvider(config.email.postmarkToken);
    }

    return new LoggerEmailProvider();
  }

  /**
   * Set a specific provider (useful for testing or runtime configuration)
   */
  setProvider(provider: EmailProvider) {
    this.provider = provider;
  }

  /**
   * Get current provider name
   */
  getProviderName(): string {
    return this.provider.name;
  }

  /**
   * Send an email using the configured provider
   */
  async send(options: EmailOptions): Promise<void> {
    const config = getConfig();

    // Check global email switch
    if (!config?.email?.enabled) {
      logger.debug('Email sending disabled in configuration', {
        to: options.to,
        subject: options.subject
      });
      return;
    }

    // Validation
    if (!options.to) {
      throw new Error('Email recipient "to" is required');
    }

    try {
      await this.provider.send(options);
    } catch (error) {
      // Log error but don't necessarily crash the calling service
      // depending on criticality. For now we rethrow.
      logger.error(`Failed to send email using ${this.provider.name}`, error as Error);
      throw error;
    }
  }
}

export const emailService = new EmailService();
