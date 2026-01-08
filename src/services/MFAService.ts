/**
 * MFA Service
 *
 * Handles Multi-Factor Authentication (MFA) using TOTP
 *
 * AUTH-001: Enforces MFA for privileged roles (super_admin, admin, manager)
 *
 * Features:
 * - TOTP secret generation
 * - QR code generation for authenticator apps
 * - Token verification
 * - Backup code generation and validation
 * - Role-based MFA enforcement
 */

import { generateSecret, totp } from "speakeasy";
import { toDataURL } from "qrcode";
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
    this.log("info", "Setting up MFA", { userId });

    return this.executeRequest(
      async () => {
        // Check if user already has MFA
        const { data: existing } = await this.supabase
          .from("mfa_secrets")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        if (existing && existing.enabled) {
          throw new ValidationError("MFA is already enabled for this user");
        }

        // Generate new secret
        const secret = generateSecret({
          name: `ValueOS (${userEmail})`,
          issuer: "ValueOS",
          length: 32,
        });

        // Generate backup codes (10 codes, 8 characters each)
        const backupCodes = Array.from({ length: 10 }, () => this.generateBackupCode());

        // Generate QR code
        const qrCodeUrl = await toDataURL(secret.otpauth_url!);

        // Store secret (disabled until user verifies)
        if (existing) {
          await this.supabase
            .from("mfa_secrets")
            .update({
              secret: secret.base32,
              backup_codes: backupCodes,
              enabled: false,
              enrolled_at: null,
            })
            .eq("user_id", userId);
        } else {
          await this.supabase.from("mfa_secrets").insert({
            user_id: userId,
            secret: secret.base32,
            backup_codes: backupCodes,
            enabled: false,
          });
        }

        return {
          secret: secret.base32,
          qrCodeUrl,
          backupCodes,
          manualEntryKey: secret.base32,
        };
      },
      { skipCache: true }
    );
  }

  /**
   * Verify TOTP token and enable MFA
   */
  async verifyAndEnableMFA(userId: string, token: string): Promise<boolean> {
    this.log("info", "Verifying MFA token", { userId });

    return this.executeRequest(
      async () => {
        // Get user's secret
        const { data: mfaSecret, error } = await this.supabase
          .from("mfa_secrets")
          .select("*")
          .eq("user_id", userId)
          .single();

        if (error || !mfaSecret) {
          throw new AuthenticationError("MFA not set up for this user");
        }

        // Verify token
        const verified = totp.verify({
          secret: mfaSecret.secret,
          encoding: "base32",
          token: token,
          window: 2, // Allow 2 time steps before/after (60 seconds)
        });

        if (!verified) {
          throw new AuthenticationError("Invalid MFA token");
        }

        // Enable MFA
        await this.supabase
          .from("mfa_secrets")
          .update({
            enabled: true,
            enrolled_at: new Date().toISOString(),
            last_used_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        this.log("info", "MFA enabled successfully", { userId });
        return true;
      },
      { skipCache: true }
    );
  }

  /**
   * Verify MFA token during login
   */
  async verifyMFAToken(userId: string, token: string): Promise<MFAVerificationResult> {
    return this.executeRequest(
      async () => {
        const { data: mfaSecret, error } = await this.supabase
          .from("mfa_secrets")
          .select("*")
          .eq("user_id", userId)
          .eq("enabled", true)
          .single();

        if (error || !mfaSecret) {
          throw new AuthenticationError("MFA not enabled for this user");
        }

        // Try TOTP verification first
        const verified = totp.verify({
          secret: mfaSecret.secret,
          encoding: "base32",
          token: token,
          window: 2,
        });

        if (verified) {
          // Update last used
          await this.supabase
            .from("mfa_secrets")
            .update({ last_used_at: new Date().toISOString() })
            .eq("user_id", userId);

          return { verified: true, usedBackupCode: false };
        }

        // Try backup codes
        if (mfaSecret.backup_codes && mfaSecret.backup_codes.includes(token)) {
          // Remove used backup code
          const updatedCodes = mfaSecret.backup_codes.filter((code) => code !== token);

          await this.supabase
            .from("mfa_secrets")
            .update({
              backup_codes: updatedCodes,
              last_used_at: new Date().toISOString(),
            })
            .eq("user_id", userId);

          logger.warn("Backup code used for MFA", {
            userId,
            remainingCodes: updatedCodes.length,
          });

          return { verified: true, usedBackupCode: true };
        }

        throw new AuthenticationError("Invalid MFA token or backup code");
      },
      { skipCache: true }
    );
  }

  /**
   * Check if user has MFA enabled
   */
  async hasMFAEnabled(userId: string): Promise<boolean> {
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
   * Generate backup code (8 alphanumeric characters)
   */
  private generateBackupCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude ambiguous chars
    let code = "";
    const array = new Uint8Array(8);
    crypto.getRandomValues(array);

    for (let i = 0; i < 8; i++) {
      code += chars[array[i] % chars.length];
    }

    return code;
  }

  /**
   * Verify MFA (supports TOTP and WebAuthn)
   */
  async verifyMFA(
    userId: string,
    method: "totp" | "webauthn",
    // @ts-ignore
    credential: { token?: string; assertion?: AuthenticationResponseJSON }
  ): Promise<MFAVerificationResult> {
    if (method === "totp") {
      if (!credential.token) {
        throw new ValidationError("TOTP token required");
      }
      return this.verifyMFAToken(userId, credential.token);
    } else if (method === "webauthn") {
      if (!credential.assertion) {
        throw new ValidationError("WebAuthn assertion required");
      }
      // @ts-ignore
      const result = await webAuthnService.verifyAuthentication(userId, credential.assertion);
      return {
        verified: result.verified,
        usedBackupCode: false,
      };
    }

    throw new ValidationError("Invalid MFA method");
  }
}

export const mfaService = new MFAService();
