import { logger } from '../lib/logger';
import { getConfig } from '../config/environment';

export interface EmailOptions {
  to: string;
  subject: string;
  template?: string;
  data?: Record<string, any>;
  html?: string;
  text?: string;
}

export class EmailService {
  /**
   * Send an email
   */
  async send(options: EmailOptions): Promise<void> {
    const config = getConfig();
    if (!config.email.enabled) {
      logger.info('Email disabled, skipping sending', { to: options.to, subject: options.subject });
      return;
    }

    let content = options.html || options.text || '';

    if (options.template) {
       content = this.renderTemplate(options.template, options.data || {});
    }

    // In a real implementation, we would use a provider here (e.g., SendGrid, AWS SES).
    // For now, we use a logger to simulate sending and provide visibility.
    // This allows verification in development environments without external dependencies.
    logger.info(`Sending email to ${options.to}`, {
      subject: options.subject,
      template: options.template,
      contentPreview: content.substring(0, 200) + '...',
      // In a real app, we might want to mask PII in logs, but for dev debug purposes we keep it simple
    });
  }

  private renderTemplate(templateName: string, data: Record<string, any>): string {
    if (templateName === 'welcome') {
        return this.renderWelcomeTemplate(data);
    }
    // Fallback for unknown templates
    logger.warn(`Template ${templateName} not found, sending empty body`);
    return '';
  }

  private renderWelcomeTemplate(data: Record<string, any>): string {
    const { organizationName, tier, features, limits } = data;

    const featureList = Array.isArray(features)
        ? features.map(f => `<li>${f.replace(/_/g, ' ')}</li>`).join('')
        : '';

    const limitList = limits
        ? Object.entries(limits).map(([key, value]) => `<li><strong>${key}:</strong> ${value === -1 ? 'Unlimited' : value}</li>`).join('')
        : '';

    const appUrl = getConfig().app.url;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px; }
          .header { background-color: #f8f9fa; padding: 20px; text-align: center; border-bottom: 1px solid #eee; }
          .content { padding: 20px; }
          .footer { font-size: 12px; color: #6c757d; text-align: center; margin-top: 20px; border-top: 1px solid #eee; padding-top: 20px; }
          ul { list-style-type: disc; padding-left: 20px; }
          .btn { background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ValueCanvas!</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>Your organization <strong>${organizationName}</strong> has been successfully provisioned.</p>

            <h3>Plan Details</h3>
            <p><strong>Tier:</strong> ${tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : 'Unknown'}</p>

            ${featureList ? `
            <h3>Features Included:</h3>
            <ul>
              ${featureList}
            </ul>
            ` : ''}

            ${limitList ? `
            <h3>Usage Limits:</h3>
            <ul>
              ${limitList}
            </ul>
            ` : ''}

            <p>You can now log in and start using ValueCanvas.</p>
            <p style="text-align: center;">
              <a href="${appUrl}" class="btn">Go to Dashboard</a>
            </p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ValueCanvas. All rights reserved.</p>
            <p>If you have any questions, please contact support.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export const emailService = new EmailService();
