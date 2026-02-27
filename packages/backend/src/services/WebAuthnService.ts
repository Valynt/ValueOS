/**
 * WebAuthn Service
 *
 * Implements passwordless authentication using WebAuthn (FIDO2)
 *
 * Supports:
 * - Hardware security keys (YubiKey, Titan Key)
 * - Platform authenticators (TouchID, FaceID, Windows Hello)
 *
 * WebAuthn provides phishing-resistant authentication
 */

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  type VerifiedAuthenticationResponse,
  type VerifiedRegistrationResponse,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/browser";
import { logger } from "../lib/logger.js"
import { BaseService } from "./BaseService.js"
import { AuthenticationError } from "./errors.js"

export interface WebAuthnCredential {
  id: string;
  userId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  deviceType: "platform" | "cross-platform";
  aaguid?: string;
  transports?: ("usb" | "nfc" | "ble" | "internal")[];
  name: string;
  createdAt: string;
  lastUsedAt?: string;
}

export interface WebAuthnRegistrationOptions {
  challenge: string;
  rp: { name: string; id: string };
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: any[];
  timeout: number;
  attestation: string;
  authenticatorSelection: any;
}

// WebAuthn configuration
const RP_NAME = "ValueOS";
const RP_ID = process.env.WEBAUTHN_RP_ID || "localhost"; // Set to your domain in production
const ORIGIN = process.env.WEBAUTHN_ORIGIN || "http://localhost:5173";

export class WebAuthnService extends BaseService {
  constructor() {
    super("WebAuthnService");
  }

  /**
   * Generate registration options for new credential
   */
  async generateRegistrationOptions(
    userId: string,
    userEmail: string,
    userName: string
  ): Promise<any> {
    this.log("info", "Generating WebAuthn registration options", { userId });

    return this.executeRequest(
      async () => {
        // Get existing credentials to exclude
        const { data: existingCredentials } = await this.supabase
          .from("webauthn_credentials")
          .select("credential_id")
          .eq("user_id", userId);

        const excludeCredentials = (existingCredentials || []).map((cred) => ({
          id: cred.credential_id,
          type: "public-key" as const,
        }));

        // Generate options
        const options = await generateRegistrationOptions({
          rpName: RP_NAME,
          rpID: RP_ID,
          userID: userId,
          userName: userEmail,
          userDisplayName: userName || userEmail,
          attestationType: "none", // 'none', 'indirect', or 'direct'
          excludeCredentials,
          authenticatorSelection: {
            residentKey: "preferred",
            userVerification: "preferred",
          },
          supportedAlgorithmIDs: [-7, -257], // ES256, RS256
        });

        // Store challenge for verification
        await this.storeChallenge(userId, options.challenge, "registration");

        return options;
      },
      { skipCache: true }
    );
  }

  /**
   * Verify registration response and store credential
   */
  async verifyAndStoreCredential(
    userId: string,
    response: RegistrationResponseJSON,
    credentialName: string
  ): Promise<WebAuthnCredential> {
    this.log("info", "Verifying WebAuthn registration", { userId });

    return this.executeRequest(
      async () => {
        // Get stored challenge
        const challenge = await this.getChallenge(userId, "registration");
        if (!challenge) {
          throw new AuthenticationError("No pending registration challenge");
        }

        // Verify registration response
        const verification: VerifiedRegistrationResponse =
          await verifyRegistrationResponse({
            response,
            expectedChallenge: challenge,
            expectedOrigin: ORIGIN,
            expectedRPID: RP_ID,
          });

        if (!verification.verified || !verification.registrationInfo) {
          throw new AuthenticationError(
            "WebAuthn registration verification failed"
          );
        }

        const { credentialPublicKey, credentialID, counter, aaguid } =
          verification.registrationInfo;

        // Store credential
        const { data, error } = await this.supabase
          .from("webauthn_credentials")
          .insert({
            user_id: userId,
            credential_id: Buffer.from(credentialID).toString("base64"),
            public_key: Buffer.from(credentialPublicKey).toString("base64"),
            counter,
            device_type:
              response.response.authenticatorAttachment || "cross-platform",
            aaguid: Buffer.from(aaguid).toString("hex"),
            transports: response.response.transports,
            name: credentialName,
          })
          .select()
          .single();

        if (error) throw error;

        // Clear challenge
        await this.clearChallenge(userId, "registration");

        logger.info("WebAuthn credential registered", {
          userId,
          credentialName,
          deviceType: data.device_type,
        });

        return data;
      },
      { skipCache: true }
    );
  }

  /**
   * Generate authentication options for login
   */
  async generateAuthenticationOptions(userId?: string): Promise<any> {
    this.log("info", "Generating WebAuthn authentication options", { userId });

    return this.executeRequest(
      async () => {
        let allowCredentials: any[] = [];

        // If userId provided, get their credentials
        if (userId) {
          const { data: credentials } = await this.supabase
            .from("webauthn_credentials")
            .select("credential_id, transports")
            .eq("user_id", userId);

          allowCredentials = (credentials || []).map((cred) => ({
            id: Buffer.from(cred.credential_id, "base64"),
            type: "public-key" as const,
            transports: cred.transports,
          }));
        }

        const options = await generateAuthenticationOptions({
          rpID: RP_ID,
          allowCredentials:
            allowCredentials.length > 0 ? allowCredentials : undefined,
          userVerification: "preferred",
        });

        // Store challenge
        const challengeUserId = userId || "anonymous";
        await this.storeChallenge(
          challengeUserId,
          options.challenge,
          "authentication"
        );

        return options;
      },
      { skipCache: true }
    );
  }

  /**
   * Verify authentication response
   */
  async verifyAuthentication(
    userId: string,
    response: AuthenticationResponseJSON
  ): Promise<{ verified: boolean; credentialId: string }> {
    this.log("info", "Verifying WebAuthn authentication", { userId });

    return this.executeRequest(
      async () => {
        // Get stored challenge
        const challenge = await this.getChallenge(userId, "authentication");
        if (!challenge) {
          throw new AuthenticationError("No pending authentication challenge");
        }

        // Get credential
        const credentialIdBase64 = Buffer.from(
          response.rawId,
          "base64"
        ).toString("base64");
        const { data: credential, error } = await this.supabase
          .from("webauthn_credentials")
          .select("*")
          .eq("user_id", userId)
          .eq("credential_id", credentialIdBase64)
          .single();

        if (error || !credential) {
          throw new AuthenticationError("Credential not found");
        }

        // Verify authentication
        const verification: VerifiedAuthenticationResponse =
          await verifyAuthenticationResponse({
            response,
            expectedChallenge: challenge,
            expectedOrigin: ORIGIN,
            expectedRPID: RP_ID,
            authenticator: {
              credentialID: Buffer.from(credential.credential_id, "base64"),
              credentialPublicKey: Buffer.from(credential.public_key, "base64"),
              counter: credential.counter,
            },
          });

        if (!verification.verified) {
          throw new AuthenticationError(
            "WebAuthn authentication verification failed"
          );
        }

        // Update counter and last used
        await this.supabase
          .from("webauthn_credentials")
          .update({
            counter: verification.authenticationInfo.newCounter,
            last_used_at: new Date().toISOString(),
          })
          .eq("id", credential.id);

        // Clear challenge
        await this.clearChallenge(userId, "authentication");

        logger.info("WebAuthn authentication successful", {
          userId,
          credentialName: credential.name,
        });

        return {
          verified: true,
          credentialId: credential.id,
        };
      },
      { skipCache: true }
    );
  }

  /**
   * Get user's registered credentials
   */
  async getCredentials(userId: string): Promise<WebAuthnCredential[]> {
    return this.executeRequest(
      async () => {
        const { data, error } = await this.supabase
          .from("webauthn_credentials")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return data || [];
      },
      { deduplicationKey: `webauthn-credentials-${userId}` }
    );
  }

  /**
   * Delete credential
   */
  async deleteCredential(userId: string, credentialId: string): Promise<void> {
    this.log("info", "Deleting WebAuthn credential", { userId, credentialId });

    return this.executeRequest(
      async () => {
        const { error } = await this.supabase
          .from("webauthn_credentials")
          .delete()
          .eq("user_id", userId)
          .eq("id", credentialId);

        if (error) throw error;

        this.clearCache(`webauthn-credentials-${userId}`);
      },
      { skipCache: true }
    );
  }

  /**
   * Store challenge in session/cache (simplified - use Redis in production)
   */
  private async storeChallenge(
    userId: string,
    challenge: string,
    type: "registration" | "authentication"
  ): Promise<void> {
    // In production, store in Redis with TTL
    // For now, store in a temporary table or sessionStorage
    const key = `webauthn_challenge_${type}_${userId}`;
    sessionStorage.setItem(key, challenge);
  }

  private async getChallenge(
    userId: string,
    type: "registration" | "authentication"
  ): Promise<string | null> {
    const key = `webauthn_challenge_${type}_${userId}`;
    return sessionStorage.getItem(key);
  }

  private async clearChallenge(
    userId: string,
    type: "registration" | "authentication"
  ): Promise<void> {
    const key = `webauthn_challenge_${type}_${userId}`;
    sessionStorage.removeItem(key);
  }
}

export const webAuthnService = new WebAuthnService();
