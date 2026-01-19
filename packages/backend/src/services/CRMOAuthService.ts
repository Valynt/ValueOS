/**
 * CRM OAuth Service
 *
 * Client-side service to manage CRM OAuth connections.
 * Interacts with the crm-oauth edge function.
 */

import { supabase } from "../lib/supabase";
import { logger } from "../lib/logger";
import { getEnvVar } from "../lib/env";

// ============================================================================
// Types
// ============================================================================

export type CRMProvider = "hubspot" | "salesforce";

export interface CRMConnectionStatus {
  connected: boolean;
  status: "active" | "expired" | "revoked" | "error" | "not_connected";
  connectedAt?: string;
  scopes?: string[];
  error?: string;
}

export interface CRMIntegrationsStatus {
  hubspot: CRMConnectionStatus;
  salesforce: CRMConnectionStatus;
}

// ============================================================================
// CRM OAuth Service
// ============================================================================

class CRMOAuthService {
  private functionUrl: string;

  constructor() {
    const supabaseUrl =
      getEnvVar("VITE_SUPABASE_URL") || getEnvVar("SUPABASE_URL") || "";
    this.functionUrl = `${supabaseUrl}/functions/v1/crm-oauth`;
  }

  /**
   * Initiate OAuth flow for a CRM provider
   * Opens a popup window for the OAuth flow
   */
  async connect(provider: CRMProvider, tenantId: string): Promise<void> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      // Generate cryptographically secure state parameter for CSRF protection
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      const state = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');

      // Get the auth URL from the edge function
      const response = await fetch(`${this.functionUrl}/initiate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider,
          tenant_id: tenantId,
          state, // Include state for CSRF protection
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to initiate OAuth");
      }

      const { auth_url } = await response.json();

      // Open OAuth in a popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        auth_url,
        `${provider}_oauth`,
        `width=${width},height=${height},left=${left},top=${top},popup=yes`
      );

      // Check for popup blocker
      if (!popup) {
        throw new Error(
          "Popup blocked by browser. Please allow popups for this site and try again."
        );
      }

      // Listen for the popup to close or redirect back with timeout
      return new Promise<void>((resolve, reject) => {
        let hasResolved = false;
        const maxWaitTime = 10 * 60 * 1000; // 10 minutes max
        const checkInterval = 500; // Check every 500ms
        let elapsedTime = 0;

        const checkClosed = setInterval(() => {
          elapsedTime += checkInterval;

          // Check if popup is closed
          if (popup.closed) {
            clearInterval(checkClosed);
            if (!hasResolved) {
              hasResolved = true;
              // Check if we have a successful connection
              this.checkOAuthResult(provider, tenantId)
                .then((success) => {
                  if (success) {
                    window.dispatchEvent(
                      new CustomEvent("crm-oauth-complete", {
                        detail: { provider },
                      })
                    );
                    resolve();
                  } else {
                    reject(new Error("OAuth flow was cancelled or failed"));
                  }
                })
                .catch(reject);
            }
            return;
          }

          // Timeout after max wait time
          if (elapsedTime >= maxWaitTime) {
            clearInterval(checkClosed);
            if (!hasResolved) {
              hasResolved = true;
              popup.close();
              reject(new Error("OAuth flow timed out. Please try again."));
            }
          }
        }, checkInterval);
      });
    } catch (error) {
      logger.error(
        "Failed to initiate CRM OAuth",
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  /**
   * Disconnect a CRM integration
   */
  async disconnect(provider: CRMProvider, tenantId: string): Promise<void> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(`${this.functionUrl}/disconnect`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider,
          tenant_id: tenantId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to disconnect");
      }

      logger.info(`Disconnected ${provider}`);
    } catch (error) {
      logger.error(
        "Failed to disconnect CRM",
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  /**
   * Get connection status for all CRM providers
   */
  async getStatus(tenantId: string): Promise<CRMIntegrationsStatus> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(
        `${this.functionUrl}/status?tenant_id=${encodeURIComponent(tenantId)}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to get status");
      }

      return response.json();
    } catch (error) {
      logger.error(
        "Failed to get CRM status",
        error instanceof Error ? error : undefined
      );
      // Return disconnected status on error
      return {
        hubspot: { connected: false, status: "not_connected" },
        salesforce: { connected: false, status: "not_connected" },
      };
    }
  }

  /**
   * Refresh tokens for a CRM provider
   */
  async refreshTokens(provider: CRMProvider, tenantId: string): Promise<void> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(`${this.functionUrl}/refresh`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider,
          tenant_id: tenantId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to refresh tokens");
      }

      logger.info(`Refreshed ${provider} tokens`);
    } catch (error) {
      logger.error(
        "Failed to refresh CRM tokens",
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  /**
   * Check if tokens are about to expire and refresh if needed
   */
  async ensureValidTokens(
    provider: CRMProvider,
    tenantId: string
  ): Promise<boolean> {
    try {
      const status = await this.getStatus(tenantId);
      const providerStatus = status[provider];

      if (!providerStatus.connected) {
        return false;
      }

      if (providerStatus.status === "expired") {
        await this.refreshTokens(provider, tenantId);
        return true;
      }

      return providerStatus.status === "active";
    } catch (error) {
      logger.error(
        "Failed to ensure valid CRM tokens",
        error instanceof Error ? error : undefined
      );
      return false;
    }
  }

  /**
   * Check if OAuth flow resulted in a successful connection
   */
  private async checkOAuthResult(provider: CRMProvider, tenantId: string): Promise<boolean> {
    try {
      const status = await this.getStatus(tenantId);
      return status[provider].connected && status[provider].status === 'active';
    } catch {
      return false;
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const crmOAuthService = new CRMOAuthService();
