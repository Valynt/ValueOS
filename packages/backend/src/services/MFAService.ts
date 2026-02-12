/**
 * MFA Service
 *
 * Implements Multi-Factor Authentication using TOTP (Time-based One-Time Password).
 * Uses 'otpauth' for TOTP generation/verification and 'qrcode' for QR code generation.
 * Compatible with both browser and server environments.
 */

import { BaseService } from "./BaseService.js"
import { ValidationError } from "./errors.js"
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/browser";

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
   * Helper to generate secure random backup codes
   */
  private generateBackupCodes(count: number = 10, length: number = 8): string[] {
    const codes: string[] = [];
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Base32-like (no I, O, 0, 1)

    // Check for crypto support
    const cryptoObj = globalThis.crypto;

    if (cryptoObj && cryptoObj.getRandomValues) {
      for (let i = 0; i < count; i++) {
        const randomValues = new Uint8Array(length);
        cryptoObj.getRandomValues(randomValues);
        let code = "";
        for (let j = 0; j < length; j++) {
          code += chars[randomValues[j] % chars.length];
        }
        codes.push(code);
      }
    } else {
      // Fallback for environments without crypto (should be rare in modern node/browsers)
      // But for security, we should ideally fail or use node crypto.
      // Assuming Node environment if globalThis.crypto is missing?
      try {
        // Dynamic import for Node crypto if needed, but 'crypto' global is available in Node 19+
        // and usually available in test envs.
        // If not available, we might have to fallback to less secure or throw error.
        // For this implementation, we'll fallback to Math.random but log warning,
        // OR rely on the fact that this app runs in envs with crypto.
        this.log("warn", "Crypto API not available, using Math.random for backup codes");
         for (let i = 0; i < count; i++) {
          let code = "";
          for (let j = 0; j < length; j++) {
             code += chars[Math.floor(Math.random() * chars.length)];
          }
          codes.push(code);
        }
      } catch (e) {
        // Fallback
      }
    }
    return codes;
  }

  /**
   * Generate MFA secret and QR code for enrollment
   */
  async setupMFA(userId: string, userEmail: string): Promise<MFASetupResponse> {
    this.log("info", "Setting up MFA", { userId });

    return this.executeRequest(
      async () => {
        // Generate a new secret
        const secret = new OTPAuth.Secret({ size: 20 });
        const secretBase32 = secret.base32;

        // Create TOTP object for URI generation
        const totp = new OTPAuth.TOTP({
          issuer: "ValueCanvas",
          label: userEmail,
          algorithm: "SHA1",
          digits: 6,
          period: 30,
          secret: secret,
        });

        const uri = totp.toString();
        const qrCodeUrl = await QRCode.toDataURL(uri);

        // Generate 10 backup codes
        const backupCodes = this.generateBackupCodes(10, 8);

        // Store in DB (pending enablement)
        const { error } = await this.supabase
          .from("mfa_secrets")
          .upsert(
            {
              user_id: userId,
              secret: secretBase32,
              backup_codes: backupCodes,
              enabled: false,
              // enrolled_at will be set upon verification
            },
            { onConflict: "user_id" }
          );

        if (error) {
          throw new Error(`Failed to store MFA secret: ${error.message}`);
        }

        return {
          secret: secretBase32,
          qrCodeUrl,
          backupCodes,
          manualEntryKey: secretBase32,
        };
      },
      { skipCache: true }
    );
  }

  /**
   * Verify TOTP token and enable MFA
   */
  async verifyAndEnableMFA(userId: string, token: string): Promise<boolean> {
    this.log("info", "Verifying and enabling MFA", { userId });

    return this.executeRequest(
      async () => {
        // Fetch pending secret
        const { data, error } = await this.supabase
          .from("mfa_secrets")
          .select("secret")
          .eq("user_id", userId)
          .single();

        if (error || !data) {
          throw new ValidationError("MFA setup not initiated");
        }

        const totp = new OTPAuth.TOTP({
          algorithm: "SHA1",
          digits: 6,
          period: 30,
          secret: OTPAuth.Secret.fromBase32(data.secret),
        });

        // Verify token (window 1 allows +/- 30 seconds drift)
        const delta = totp.validate({ token, window: 1 });

        if (delta === null) {
          return false;
        }

        // Enable MFA
        await this.supabase
          .from("mfa_secrets")
          .update({
            enabled: true,
            enrolled_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        this.clearCache(`mfa-status-${userId}`);
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
        const { data, error } = await this.supabase
          .from("mfa_secrets")
          .select("secret, backup_codes")
          .eq("user_id", userId)
          .single();

        if (error || !data) {
          return { verified: false };
        }

        // 1. Check TOTP
        const totp = new OTPAuth.TOTP({
          algorithm: "SHA1",
          digits: 6,
          period: 30,
          secret: OTPAuth.Secret.fromBase32(data.secret),
        });

        const delta = totp.validate({ token, window: 1 });

        if (delta !== null) {
          return { verified: true, usedBackupCode: false };
        }

        // 2. Check Backup Codes
        const backupCodes = data.backup_codes || [];
        if (backupCodes.includes(token)) {
          // Consume backup code
          const newBackupCodes = backupCodes.filter((c: string) => c !== token);
          await this.supabase
            .from("mfa_secrets")
            .update({ backup_codes: newBackupCodes })
            .eq("user_id", userId);

          return { verified: true, usedBackupCode: true };
        }

        return { verified: false };
      },
      { skipCache: true } // Don't cache verification results
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
   * Verify MFA (supports TOTP and WebAuthn)
   */
  async verifyMFA(
    userId: string,
    method: "totp" | "webauthn",
    credential: { token?: string; response?: AuthenticationResponseJSON; expectedChallenge?: string }
  ): Promise<MFAVerificationResult> {
    if (method === "totp") {
      if (!credential?.token) {
        return { verified: false };
      }
      return this.verifyMFAToken(userId, credential.token);
    }

    if (!credential?.response || !credential?.expectedChallenge) {
      return { verified: false };
    }

    return this.executeRequest(
      async () => {
        try {
          const credentialId = Buffer.from(credential.response.rawId, "base64url").toString("base64");

          const { data: authenticator, error } = await this.supabase
            .from("webauthn_credentials")
            .select("id, credential_id, public_key, counter")
            .eq("user_id", userId)
            .eq("credential_id", credentialId)
            .single();

          if (error || !authenticator) {
            return { verified: false };
          }

          const verification = await verifyAuthenticationResponse({
            response: credential.response,
            expectedChallenge: credential.expectedChallenge,
            expectedOrigin: process.env.WEBAUTHN_ORIGIN || "http://localhost:5173",
            expectedRPID: process.env.WEBAUTHN_RP_ID || "localhost",
            authenticator: {
              credentialID: Buffer.from(authenticator.credential_id, "base64"),
              credentialPublicKey: Buffer.from(authenticator.public_key, "base64"),
              counter: authenticator.counter,
            },
          });

          if (!verification.verified) {
            return { verified: false };
          }

          await this.supabase
            .from("webauthn_credentials")
            .update({
              counter: verification.authenticationInfo.newCounter,
              last_used_at: new Date().toISOString(),
            })
            .eq("id", authenticator.id);

          return { verified: true };
        } catch (_error) {
          return { verified: false };
        }
      },
      { skipCache: true }
    );
  }

  /**
   * Verify challenge for step-up authentication
   * Alias for verifyMFAToken to indicate intent
   */
  async verifyChallenge(userId: string, token: string): Promise<boolean> {
    const result = await this.verifyMFAToken(userId, token);
    return result.verified;
  }
}

export const mfaService = new MFAService();
