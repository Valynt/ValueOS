import { getConfig } from "../config/environment";
import { logger } from "../lib/logger";

export interface EmailOptions {
  to: string;
  subject: string;
  template?: string;
  data?: Record<string, unknown>;
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
      logger.info("Email disabled, skipping sending", { to: options.to, subject: options.subject });
      return;
    }

    let content = options.html || options.text || "";

    if (options.template) {
      content = this.renderTemplate(options.template, options.data || {});
    }

    // In a real implementation, we would use a provider here (e.g., SendGrid, AWS SES).
    // For now, we use a logger to simulate sending and provide visibility.
    // This allows verification in development environments without external dependencies.
    logger.info(`Sending email to ${options.to}`, {
      subject: options.subject,
      template: options.template,
      contentPreview: content.substring(0, 200) + "...",
      // In a real app, we might want to mask PII in logs, but for dev debug purposes we keep it simple
    });
  }

  private renderTemplate(templateName: string, data: Record<string, unknown>): string {
    if (templateName === "welcome") {
      return this.renderWelcomeTemplate(data);
    }
    if (templateName === "customer-portal-access") {
      return this.renderCustomerPortalAccessTemplate(data);
    }
    if (templateName === "deactivation") {
      return this.renderDeactivationTemplate(data);
    }
    if (templateName === "invite") {
      return this.renderInviteTemplate(data);
    }
    // Fallback for unknown templates
    logger.warn(`Template ${templateName} not found, sending empty body`);
    return "";
  }

  private renderDeactivationTemplate(data: Record<string, unknown>): string {
    const { organizationName, reason } = data;

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
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Account Deactivation</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>Your organization <strong>${organizationName}</strong> has been deactivated.</p>

            ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}

            <p>If you believe this is an error, please contact support immediately.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ValueCanvas. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private renderCustomerPortalAccessTemplate(data: Record<string, unknown>): string {
    const { companyName, portalUrl } = data;

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
          .btn { background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Value Realization Portal Access</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>We are excited to share your <strong>${companyName}</strong> Value Realization Portal.</p>
            <p>This portal allows you to track value realization, view reports, and collaborate on success metrics.</p>

            <p style="text-align: center;">
              <a href="${portalUrl}" class="btn">Access Portal</a>
            </p>

            <p>If the button above doesn't work, you can copy and paste this link into your browser:</p>
            <p><a href="${portalUrl}">${portalUrl}</a></p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ValueCanvas. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private renderWelcomeTemplate(data: Record<string, unknown>): string {
    const { organizationName, tier, features, limits } = data;

    const featureList = Array.isArray(features)
      ? features.map((f) => `<li>${f.replace(/_/g, " ")}</li>`).join("")
      : "";

    const limitList = limits
      ? Object.entries(limits)
          .map(
            ([key, value]) =>
              `<li><strong>${key}:</strong> ${value === -1 ? "Unlimited" : value}</li>`
          )
          .join("")
      : "";

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
            <p><strong>Tier:</strong> ${tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : "Unknown"}</p>

            ${
              featureList
                ? `
            <h3>Features Included:</h3>
            <ul>
              ${featureList}
            </ul>
            `
                : ""
            }

            ${
              limitList
                ? `
            <h3>Usage Limits:</h3>
            <ul>
              ${limitList}
            </ul>
            `
                : ""
            }

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

  private renderInviteTemplate(data: Record<string, unknown>): string {
    const { inviterName, organizationName, inviteLink, role } = data;
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
          .btn { background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>You're Invited to Join ${organizationName}</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p><strong>${inviterName}</strong> has invited you to join the <strong>${organizationName}</strong> team on ValueCanvas.</p>
            <p>Your role will be: <strong>${role.charAt(0).toUpperCase() + role.slice(1)}</strong></p>
            <p>Click the button below to accept the invitation and get started:</p>
            <p style="text-align: center;">
              <a href="${inviteLink}" class="btn">Accept Invitation</a>
            </p>
            <p>If the button above doesn't work, you can copy and paste this link into your browser:</p>
            <p><a href="${inviteLink}">${inviteLink}</a></p>
            <p>This invitation will expire in 7 days.</p>
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
