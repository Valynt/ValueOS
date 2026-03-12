/**
 * MFA Service
 *
 * Implements Multi-Factor Authentication using TOTP (Time-based One-Time Password).
 * Uses 'otpauth' for TOTP generation/verification and 'qrcode' for QR code generation.
 * Compatible with both browser and server environments.
 */

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import type { AuthenticationResponseJSON } from "@simplewebauthn/browser";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";

const scryptAsync = promisify(scrypt);

// Backup code hashing parameters.
// scrypt N=16384 is the OWASP minimum for interactive logins; backup codes
// are low-frequency so this is acceptable. keylen=32 gives 256-bit output.
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 32;
const SALT_BYTES = 16;

/**
 * Hash a single backup code using scrypt with a random salt.
 * Returns a string in the format `<hex-salt>:<hex-hash>` for storage.
 */
async function hashBackupCode(code: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await scryptAsync(code, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P,
  }) as Buffer;
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

/**
 * Verify a candidate backup code against a stored hash.
 * Uses timing-safe comparison to prevent timing attacks.
 */
async function verifyBackupCode(candidate: string, stored: string): Promise<boolean> {
  const colonIdx = stored.indexOf(':');
  if (colonIdx === -1) {
    // Legacy plaintext code — accept for migration but do not store again in plaintext.
    // Use timingSafeEqual to prevent timing attacks even on the plaintext path.
    const a = Buffer.from(candidate);
    const b = Buffer.from(stored);
    return a.length === b.length && timingSafeEqual(a, b);
  }
  const salt = Buffer.from(stored.slice(0, colonIdx), 'hex');
  const expectedHash = Buffer.from(stored.slice(colonIdx + 1), 'hex');
  try {
    const candidateHash = await scryptAsync(candidate, salt, SCRYPT_KEYLEN, {
      N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P,
    }) as Buffer;
    return timingSafeEqual(candidateHash, expectedHash);
  } catch {
    return false;
  }
}

import { BaseService } from "../BaseService.js"
import { ValidationError } from "./errors.js"
import { userProfileDirectoryService } from "./UserProfileDirectoryService.js"

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
   * Generate cryptographically secure backup codes using node:crypto.
   * Each code is `length` characters from a Base32-like alphabet (no I, O, 0, 1).
   */
  private generateBackupCodes(count: number = 10, length: number = 8): string[] {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const randomValues = randomBytes(length);
      let code = "";
      for (let j = 0; j < length; j++) {
        code += chars[randomValues[j] % chars.length];
      }
      codes.push(code);
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

        // Generate 10 backup codes and hash each before storage.
        // The plaintext codes are returned to the user once and never stored.
        const backupCodes = this.generateBackupCodes(10, 8);
        const hashedBackupCodes = await Promise.all(backupCodes.map(hashBackupCode));

        // Store in DB (pending enablement)
        const { error } = await this.supabase
          .from("mfa_secrets")
          .upsert(
            {
              user_id: userId,
              secret: secretBase32,
              backup_codes: hashedBackupCodes,
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
          backupCodes, // plaintext — shown to user once, never stored again
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
        await userProfileDirectoryService.syncProfile(userId);
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

        // 2. Check Backup Codes — stored as scrypt hashes (salt:hash format).
        //    Legacy plaintext codes are accepted once and re-hashed on consumption.
        const backupCodes: string[] = data.backup_codes || [];
        let matchedIndex = -1;
        for (let i = 0; i < backupCodes.length; i++) {
          if (await verifyBackupCode(token, backupCodes[i])) {
            matchedIndex = i;
            break;
          }
        }
        if (matchedIndex !== -1) {
          // Consume the matched code. If it was a legacy plaintext entry, the
          // remaining codes are left as-is; they will be re-hashed on next match.
          const newBackupCodes = backupCodes.filter((_, i) => i !== matchedIndex);
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
        await userProfileDirectoryService.syncProfile(userId);
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
