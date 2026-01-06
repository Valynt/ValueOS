/**
 * Scalekit Service
 * Handles interaction with the Scalekit API for authentication and user management
 */

import { getScalekitConfig } from "../lib/env";
import { createLogger } from "../lib/logger";

const logger = createLogger({ component: "ScalekitService" });

export interface ScalekitUser {
  id: string;
  email: string;
  name?: string;
  external_id?: string;
}

export class ScalekitService {
  private config = getScalekitConfig();

  /**
   * Get the Authorization URL to redirect users to Scalekit's hosted login
   */
  async getAuthorizationUrl(options: {
    organizationId?: string;
    loginHint?: string;
    state?: string;
    idpInitiatedLogin?: string;
  }): Promise<string> {
    const params = new URLSearchParams({
      client_id: this.config.clientId!,
      redirect_uri: this.config.redirectUri!,
      response_type: "code",
      scope: "openid profile email",
    });

    if (options.organizationId) {
      params.append("organization_id", options.organizationId);
    }
    if (options.loginHint) {
      params.append("login_hint", options.loginHint);
    }
    if (options.state) {
      params.append("state", options.state);
    }
    if (options.idpInitiatedLogin) {
      params.append("idp_initiated_login", options.idpInitiatedLogin);
    }

    // This URL points to Scalekit's hosted login page for your env
    return `${this.config.envUrl}/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange an authorization code for user tokens
   */
  async authenticateWithCode(code: string): Promise<{
    user: ScalekitUser;
    idToken: string;
    accessToken: string;
    refreshToken?: string;
  }> {
    logger.info("Exchanging code for tokens");

    const response = await fetch(`${this.config.envUrl}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: this.config.clientId!,
        client_secret: this.config.clientSecret!,
        redirect_uri: this.config.redirectUri!,
        code,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      logger.error("Failed to exchange code for tokens", { error });
      throw new Error(error.error_description || "Failed to authenticate");
    }

    const data = await response.json();

    // The token response includes user info in the ID token or as a separate object
    // depending on the provider and scopes. Scalekit typically includes a 'user' object.
    return {
      user: data.user,
      idToken: data.id_token,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  }

  /**
   * Send a passwordless email (Magic Link)
   * This is used for both login and as a password reset mechanism
   */
  async sendMagicLink(email: string): Promise<string> {
    if (
      !this.config.envUrl ||
      !this.config.clientId ||
      !this.config.clientSecret
    ) {
      throw new Error("Scalekit is not fully configured");
    }

    logger.info("Sending Scalekit magic link", { email });

    const response = await fetch(
      `${this.config.envUrl}/api/v1/passwordless/email/send`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await this.getApiToken()}`,
        },
        body: JSON.stringify({
          email,
          redirect_uri: this.config.redirectUri,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      logger.error("Failed to send Scalekit magic link", { error });
      throw new Error(error.message || "Failed to send magic link");
    }

    const data = await response.json();
    return data.auth_request_id;
  }

  /**
   * Exchange Client Credentials for an API Token
   */
  private async getApiToken(): Promise<string> {
    // Note: In a real implementation, you should cache this token
    const response = await fetch(`${this.config.envUrl}/api/v1/auth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to authenticate with Scalekit API");
    }

    const data = await response.json();
    return data.access_token;
  }
}

export const scalekitService = new ScalekitService();
