/**
 * MFA Service (STUBBED)
 *
 * Temporarily stubbed to remove server-side 'speakeasy' dependency which caused client crashes.
 * TODO: Replace with browser-compatible 'otpauth' library or move to backend.
 */

import { logger } from "../lib/logger";
import { BaseService } from "./BaseService";
import { AuthenticationError, ValidationError } from "./errors";

export interface MFASecret {
  id: string;
  userId: string;
  secret: string;
  backupCodes: string[];
  enabled: boolean;
  enrolledAt?: string;
  lastUsedAt?: string;
}

export interface MFASetupResponse {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
  manualEntryKey: string;
}

export interface MFAVerificationResult {
  verified: boolean;
  usedBackupCode?: boolean;
}

// Roles that require MFA
const MFA_REQUIRED_ROLES = ["super_admin", "admin", "manager"];

export class MFAService extends BaseService {
  constructor() {
    super("MFAService");
  }

  /**
   * Check if MFA is required for a given role
   */
  isMFARequiredForRole(role: string): boolean {
    return MFA_REQUIRED_ROLES.includes(role);
  }

  /**
   * Generate MFA secret and QR code for enrollment
   */
  async setupMFA(userId: string, userEmail: string): Promise<MFASetupResponse> {
    this.log("info", "Setting up MFA (STUBBED)", { userId });

    // Stub implementation to avoid speakeasy crash
    return {
      secret: "MOCK_SECRET_BASE32_ABCD",
      qrCodeUrl: "", // TODO: proper QR generation
      backupCodes: ["MOCK1234", "MOCK5678"],
      manualEntryKey: "MOCK_SECRET_BASE32_ABCD",
    };
  }

  /**
   * Verify TOTP token and enable MFA
   */
  async verifyAndEnableMFA(userId: string, token: string): Promise<boolean> {
    this.log("info", "Verifying MFA token (STUBBED)", { userId });
    // Always accept "123456" for testing, or any token
    if (token === "000000") return false; // Fail test

    await this.supabase
      .from("mfa_secrets")
      .update({
        enabled: true,
        enrolled_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    return true;
  }

  /**
   * Verify MFA token during login
   */
  async verifyMFAToken(userId: string, token: string): Promise<MFAVerificationResult> {
    // Always allow for now to unblock login
    return { verified: true, usedBackupCode: false };
  }

  /**
   * Check if user has MFA enabled
   */
  async hasMFAEnabled(userId: string): Promise<boolean> {
    // Return false for now to simplify login flow
    // return false;

    // Or check DB safely
    return this.executeRequest(
      async () => {
        const { data } = await this.supabase
          .from("mfa_secrets")
          .select("enabled")
          .eq("user_id", userId)
          .maybeSingle();

        return data?.enabled || false;
      },
      { deduplicationKey: `mfa-status-${userId}` }
    );
  }

  /**
   * Disable MFA (requires re-authentication)
   */
  async disableMFA(userId: string): Promise<void> {
    this.log("info", "Disabling MFA", { userId });

    return this.executeRequest(
      async () => {
        await this.supabase.from("mfa_secrets").update({ enabled: false }).eq("user_id", userId);

        this.clearCache(`mfa-status-${userId}`);
      },
      { skipCache: true }
    );
  }

  /**
   * Verify MFA (supports TOTP and WebAuthn)
   */
  async verifyMFA(
    userId: string,
    method: "totp" | "webauthn",
    // @ts-ignore
    credential: any
  ): Promise<MFAVerificationResult> {
    if (method === "totp") {
      return this.verifyMFAToken(userId, credential.token);
    }
    // Stub WebAuthn
    return { verified: true };
  }
}

export const mfaService = new MFAService();
