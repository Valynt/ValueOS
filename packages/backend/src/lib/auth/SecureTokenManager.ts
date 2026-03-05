/**
 * Secure Token Manager
 */

import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";

interface SecureTokenClaims extends JwtPayload {
  [key: string]: unknown;
}

interface SecureTokenManagerConfig {
  secret?: string;
  issuer?: string;
  audience?: string;
  expiresIn?: SignOptions["expiresIn"];
}

interface VerifyTokenOptions {
  rejectReplay?: boolean;
}

export class SecureTokenManager {
  private readonly secret: string | undefined;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly expiresIn: SignOptions["expiresIn"];
  private readonly seenJtis = new Set<string>();

  constructor(config: SecureTokenManagerConfig = {}) {
    this.secret = config.secret ?? process.env.SECURE_TOKEN_SECRET ?? process.env.JWT_SECRET;
    this.issuer = config.issuer ?? process.env.SECURE_TOKEN_ISSUER ?? "valueos.backend";
    this.audience = config.audience ?? process.env.SECURE_TOKEN_AUDIENCE ?? "valueos.clients";
    this.expiresIn = config.expiresIn ?? "1h";
  }

  generateToken(payload: Record<string, unknown>): string {
    if (!this.secret) {
      throw new Error("Secure token secret is not configured");
    }

    return jwt.sign(payload, this.secret, {
      algorithm: "HS256",
      issuer: this.issuer,
      audience: this.audience,
      expiresIn: this.expiresIn,
    });
  }

  verifyToken(token: string, options: VerifyTokenOptions = {}): SecureTokenClaims | null {
    if (!this.secret) {
      return null;
    }

    try {
      const claims = jwt.verify(token, this.secret, {
        algorithms: ["HS256"],
        issuer: this.issuer,
        audience: this.audience,
      }) as SecureTokenClaims;

      if (options.rejectReplay && typeof claims.jti === "string") {
        if (this.seenJtis.has(claims.jti)) {
          return null;
        }
        this.seenJtis.add(claims.jti);
      }

      return claims;
    } catch {
      return null;
    }
  }
}

export const secureTokenManager = new SecureTokenManager();
