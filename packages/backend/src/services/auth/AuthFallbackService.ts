import crypto from "crypto";
import { createLogger } from "@shared/lib/logger";

const logger = createLogger({ component: "AuthFallbackService" });

export interface AuthFallbackSession {
  sessionId: string;
  operatorId: string;
  organizationId: string;
  expiresAt: Date;
  claims: string[];
}

export class AuthFallbackService {
  private readonly FALLBACK_SECRET: string;
  private readonly MAX_SESSION_DURATION_MS = 1000 * 60 * 60 * 4; // 4 hours hard cap

  constructor(secret?: string) {
    this.FALLBACK_SECRET = secret || process.env.AUTH_FALLBACK_SECRET || "";
    if (!this.FALLBACK_SECRET) {
      logger.warn("AUTH_FALLBACK_SECRET is not set. Emergency token validation will fail.");
    }
  }

  /**
   * Validates a cryptographic operator approval token.
   * Format: operatorId:orgId:expiry:claims:signature
   */
  public validateApprovalToken(token: string): AuthFallbackSession | null {
    try {
      if (!this.FALLBACK_SECRET) {
        throw new Error("Missing secret key for fallback token validation");
      }

      const [operatorId, organizationId, expiryStr, claimsStr, signature] = token.split(":");
      
      if (!operatorId || !organizationId || !expiryStr || !claimsStr || !signature) {
        logger.error("Malformed emergency approval token structure");
        return null;
      }

      const expiry = parseInt(expiryStr, 10);
      const now = Date.now();

      // Check temporal validity
      if (expiry < now) {
        logger.warn("Emergency approval token has expired", { operatorId });
        return null;
      }

      // Enforce server-side hard cap on duration
      if (expiry > now + this.MAX_SESSION_DURATION_MS) {
        logger.error("Emergency token duration exceeds server-side hard cap", { operatorId });
        return null;
      }

      // Re-calculate signature for verification
      const payload = `${operatorId}:${organizationId}:${expiryStr}:${claimsStr}`;
      const expectedSignature = crypto
        .createHmac("sha256", this.FALLBACK_SECRET)
        .update(payload)
        .digest("hex");

      if (signature !== expectedSignature) {
        logger.error("Invalid signature on emergency approval token", { operatorId });
        return null;
      }

      const claims = claimsStr.split(",").filter(Boolean);

      logger.info("Emergency approval token successfully validated", { 
        operatorId, 
        organizationId,
        claims 
      });

      return {
        sessionId: crypto.randomBytes(16).toString("hex"),
        operatorId,
        organizationId,
        expiresAt: new Date(expiry),
        claims
      };
    } catch (error) {
      logger.error("Failed to validate emergency approval token", { error });
      return null;
    }
  }

  /**
   * Helper to generate a token (for administrative/testing use only)
   */
  public generateToken(
    operatorId: string, 
    organizationId: string, 
    durationMs: number, 
    claims: string[]
  ): string {
    const expiry = Date.now() + Math.min(durationMs, this.MAX_SESSION_DURATION_MS);
    const claimsStr = claims.join(",");
    const payload = `${operatorId}:${organizationId}:${expiry}:${claimsStr}`;
    const signature = crypto
      .createHmac("sha256", this.FALLBACK_SECRET)
      .update(payload)
      .digest("hex");

    return `${payload}:${signature}`;
  }
}
