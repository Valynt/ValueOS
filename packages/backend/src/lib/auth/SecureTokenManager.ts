/**
 * Secure Token Manager
 */

import { randomUUID } from "node:crypto";

import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";

import { createLogger } from "../logger.js";

interface SecureTokenClaims extends JwtPayload {
  [key: string]: unknown;
}

export interface RefreshTokenRecord {
  token_id: string;
  family_id: string;
  parent_token_id: string | null;
  user_id: string;
  tenant_id: string;
  device_id?: string;
  expires_at: string;
  revoked_at: string | null;
  rotated_at: string | null;
}

export interface RefreshTokenStore {
  save(record: RefreshTokenRecord): Promise<void>;
  getByTokenId(tokenId: string, tenantId: string): Promise<RefreshTokenRecord | null>;
  revokeToken(tokenId: string, tenantId: string, revokedAt: string): Promise<void>;
  markRotated(tokenId: string, tenantId: string, rotatedAt: string): Promise<void>;
  revokeFamily(familyId: string, tenantId: string, revokedAt: string): Promise<number>;
  revokeUserSessions(userId: string, tenantId: string, deviceId?: string): Promise<number>;
}

class InMemoryRefreshTokenStore implements RefreshTokenStore {
  private readonly records = new Map<string, RefreshTokenRecord>();

  private key(tokenId: string, tenantId: string): string {
    return `${tenantId}:${tokenId}`;
  }

  async save(record: RefreshTokenRecord): Promise<void> {
    this.records.set(this.key(record.token_id, record.tenant_id), { ...record });
  }

  async getByTokenId(tokenId: string, tenantId: string): Promise<RefreshTokenRecord | null> {
    return this.records.get(this.key(tokenId, tenantId)) ?? null;
  }

  async revokeToken(tokenId: string, tenantId: string, revokedAt: string): Promise<void> {
    const key = this.key(tokenId, tenantId);
    const record = this.records.get(key);
    if (!record) {
      return;
    }
    this.records.set(key, {
      ...record,
      revoked_at: record.revoked_at ?? revokedAt,
    });
  }

  async markRotated(tokenId: string, tenantId: string, rotatedAt: string): Promise<void> {
    const key = this.key(tokenId, tenantId);
    const record = this.records.get(key);
    if (!record) {
      return;
    }
    this.records.set(key, {
      ...record,
      rotated_at: rotatedAt,
      revoked_at: record.revoked_at ?? rotatedAt,
    });
  }

  async revokeFamily(familyId: string, tenantId: string, revokedAt: string): Promise<number> {
    let count = 0;
    for (const [key, record] of this.records.entries()) {
      if (record.tenant_id === tenantId && record.family_id === familyId && !record.revoked_at) {
        this.records.set(key, {
          ...record,
          revoked_at: revokedAt,
        });
        count += 1;
      }
    }
    return count;
  }

  async revokeUserSessions(userId: string, tenantId: string, deviceId?: string): Promise<number> {
    let count = 0;
    for (const [key, record] of this.records.entries()) {
      if (record.user_id !== userId || record.tenant_id !== tenantId) {
        continue;
      }
      if (deviceId && record.device_id !== deviceId) {
        continue;
      }
      if (record.revoked_at) {
        continue;
      }
      this.records.set(key, {
        ...record,
        revoked_at: new Date().toISOString(),
      });
      count += 1;
    }
    return count;
  }
}

interface SecureTokenManagerConfig {
  secret?: string;
  issuer?: string;
  audience?: string;
  expiresIn?: SignOptions["expiresIn"];
  refreshExpiresIn?: SignOptions["expiresIn"];
  refreshTokenStore?: RefreshTokenStore;
}

interface VerifyTokenOptions {
  rejectReplay?: boolean;
}

interface RefreshTokenClaims extends JwtPayload {
  sub: string;
  jti: string;
  family_id: string;
  tenant_id: string;
  token_type: "refresh";
  device_id?: string;
}

export interface IssueRefreshTokenInput {
  userId: string;
  tenantId: string;
  deviceId?: string;
  familyId?: string;
  parentTokenId?: string;
}

export interface RotateRefreshTokenResult {
  refreshToken: string;
  claims: RefreshTokenClaims;
  replayDetected: boolean;
}

const logger = createLogger({ component: "SecureTokenManager" });

export class SecureTokenManager {
  private readonly secret: string | undefined;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly expiresIn: SignOptions["expiresIn"];
  private readonly refreshExpiresIn: SignOptions["expiresIn"];
  private readonly refreshTokenStore: RefreshTokenStore;

  constructor(config: SecureTokenManagerConfig = {}) {
    this.secret = config.secret ?? process.env.SECURE_TOKEN_SECRET ?? process.env.JWT_SECRET;
    this.issuer = config.issuer ?? process.env.SECURE_TOKEN_ISSUER ?? "valueos.backend";
    this.audience = config.audience ?? process.env.SECURE_TOKEN_AUDIENCE ?? "valueos.clients";
    this.expiresIn = config.expiresIn ?? "1h";
    this.refreshExpiresIn = config.refreshExpiresIn ?? "30d";
    this.refreshTokenStore = config.refreshTokenStore ?? new InMemoryRefreshTokenStore();
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
        logger.warn("rejectReplay is deprecated; use refresh token rotation for replay protection", {
          tokenId: claims.jti,
        });
      }

      return claims;
    } catch {
      return null;
    }
  }

  async issueRefreshToken(input: IssueRefreshTokenInput): Promise<string> {
    if (!this.secret) {
      throw new Error("Secure token secret is not configured");
    }

    const tokenId = randomUUID();
    const familyId = input.familyId ?? randomUUID();
    const expiresAt = this.computeFutureDate(this.refreshExpiresIn);

    const refreshToken = jwt.sign(
      {
        sub: input.userId,
        jti: tokenId,
        family_id: familyId,
        tenant_id: input.tenantId,
        token_type: "refresh",
        device_id: input.deviceId,
      },
      this.secret,
      {
        algorithm: "HS256",
        issuer: this.issuer,
        audience: this.audience,
        expiresIn: this.refreshExpiresIn,
      }
    );

    await this.refreshTokenStore.save({
      token_id: tokenId,
      family_id: familyId,
      parent_token_id: input.parentTokenId ?? null,
      user_id: input.userId,
      tenant_id: input.tenantId,
      device_id: input.deviceId,
      expires_at: expiresAt.toISOString(),
      revoked_at: null,
      rotated_at: null,
    });

    this.audit("refresh_token_issued", {
      tokenId,
      familyId,
      userId: input.userId,
      tenantId: input.tenantId,
      parentTokenId: input.parentTokenId,
      deviceId: input.deviceId,
    });

    return refreshToken;
  }

  async rotateRefreshToken(refreshToken: string): Promise<RotateRefreshTokenResult | null> {
    const claims = this.verifyRefreshToken(refreshToken);
    if (!claims) {
      return null;
    }

    const storedToken = await this.refreshTokenStore.getByTokenId(claims.jti, claims.tenant_id);
    if (!storedToken) {
      this.audit("refresh_token_missing", {
        tokenId: claims.jti,
        familyId: claims.family_id,
        userId: claims.sub,
        tenantId: claims.tenant_id,
      });
      return null;
    }

    if (storedToken.revoked_at || storedToken.rotated_at || new Date(storedToken.expires_at) <= new Date()) {
      const revoked = await this.refreshTokenStore.revokeFamily(
        storedToken.family_id,
        storedToken.tenant_id,
        new Date().toISOString()
      );

      this.audit("refresh_token_reuse_detected", {
        tokenId: storedToken.token_id,
        familyId: storedToken.family_id,
        userId: storedToken.user_id,
        tenantId: storedToken.tenant_id,
        revokedCount: revoked,
      });

      return {
        refreshToken,
        claims,
        replayDetected: true,
      };
    }

    const rotatedAt = new Date().toISOString();
    await this.refreshTokenStore.markRotated(storedToken.token_id, storedToken.tenant_id, rotatedAt);

    const nextToken = await this.issueRefreshToken({
      userId: storedToken.user_id,
      tenantId: storedToken.tenant_id,
      deviceId: storedToken.device_id,
      familyId: storedToken.family_id,
      parentTokenId: storedToken.token_id,
    });

    const nextClaims = this.verifyRefreshToken(nextToken);
    if (!nextClaims) {
      return null;
    }

    this.audit("refresh_token_rotated", {
      previousTokenId: storedToken.token_id,
      nextTokenId: nextClaims.jti,
      familyId: storedToken.family_id,
      userId: storedToken.user_id,
      tenantId: storedToken.tenant_id,
    });

    return {
      refreshToken: nextToken,
      claims: nextClaims,
      replayDetected: false,
    };
  }

  async signOutCurrentSession(refreshToken: string): Promise<boolean> {
    const claims = this.verifyRefreshToken(refreshToken);
    if (!claims) {
      return false;
    }

    await this.refreshTokenStore.revokeToken(claims.jti, claims.tenant_id, new Date().toISOString());
    this.audit("refresh_token_session_revoked", {
      tokenId: claims.jti,
      familyId: claims.family_id,
      userId: claims.sub,
      tenantId: claims.tenant_id,
      deviceId: claims.device_id,
    });

    return true;
  }

  async signOutAllSessionsForUser(userId: string, tenantId: string, deviceId?: string): Promise<number> {
    const revokedCount = await this.refreshTokenStore.revokeUserSessions(userId, tenantId, deviceId);

    this.audit("refresh_token_user_sessions_revoked", {
      userId,
      tenantId,
      deviceId,
      revokedCount,
    });

    return revokedCount;
  }

  private verifyRefreshToken(token: string): RefreshTokenClaims | null {
    if (!this.secret) {
      return null;
    }

    try {
      const claims = jwt.verify(token, this.secret, {
        algorithms: ["HS256"],
        issuer: this.issuer,
        audience: this.audience,
      }) as RefreshTokenClaims;

      if (claims.token_type !== "refresh") {
        return null;
      }

      if (!claims.jti || !claims.family_id || !claims.tenant_id || !claims.sub) {
        return null;
      }

      return claims;
    } catch {
      return null;
    }
  }

  private computeFutureDate(expiresIn: SignOptions["expiresIn"]): Date {
    const now = Date.now();
    if (typeof expiresIn === "number") {
      return new Date(now + expiresIn * 1000);
    }

    if (typeof expiresIn === "string") {
      const match = expiresIn.match(/^(\d+)([smhd])$/i);
      if (!match) {
        return new Date(now + 30 * 24 * 60 * 60 * 1000);
      }
      const value = Number(match[1]);
      const unit = match[2].toLowerCase();
      const multiplier: Record<string, number> = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
      };
      return new Date(now + value * multiplier[unit]);
    }

    return new Date(now + 30 * 24 * 60 * 60 * 1000);
  }

  private audit(action: string, metadata: Record<string, unknown>): void {
    logger.info("SecureTokenManager audit", {
      action,
      ...metadata,
    });
  }
}

export const secureTokenManager = new SecureTokenManager();
export { InMemoryRefreshTokenStore };
