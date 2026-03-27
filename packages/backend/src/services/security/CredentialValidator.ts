import crypto from "crypto";

import type {
  AuthCredentials,
  AuthType,
  CertificateInfo,
  CredentialValidationResult,
  JWTClaims,
  SecurityConfig,
  TrustLevel,
} from "./AgentSecurityTypes.js";

export interface TrustContext {
  ipAddress: string;
}

export class CredentialValidator {
  constructor(private readonly config: Pick<SecurityConfig, "mfaRequiredForPrivileged">) {}

  async validateCredentials(
    credentials: AuthCredentials,
    authType: AuthType
  ): Promise<CredentialValidationResult> {
    switch (authType) {
      case "api_key":
        return this.validateApiKey(credentials.apiKey ?? "", credentials.keyId);
      case "jwt":
        return this.validateJWT(credentials.jwt ?? "", credentials.claims);
      case "certificate":
        return this.validateCertificate(credentials.certificate ?? "", credentials.privateKey);
      case "oauth":
        return this.validateOAuth(credentials.accessToken ?? "", credentials.refreshToken);
      default:
        return { valid: false, reason: "Unsupported authentication type" };
    }
  }

  async validateApiKey(
    apiKey: string,
    keyId?: string
  ): Promise<CredentialValidationResult> {
    if (apiKey.startsWith("ak_") && apiKey.length === 32) {
      return {
        valid: true,
        subject: keyId ? `agent_${keyId}` : "unknown",
        permissions: ["read", "write"],
        roles: ["agent"],
      };
    }

    return { valid: false, reason: "Invalid API key" };
  }

  async validateJWT(
    token: string,
    claims?: JWTClaims
  ): Promise<CredentialValidationResult> {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        return { valid: false, reason: "Invalid JWT format" };
      }

      const payload = JSON.parse(Buffer.from(parts[1] ?? "", "base64").toString()) as Record<string, unknown>;

      if (typeof payload.exp === "number" && payload.exp < Date.now() / 1000) {
        return { valid: false, reason: "JWT expired" };
      }

      return {
        valid: true,
        subject: typeof payload.sub === "string" ? payload.sub : "unknown",
        permissions:
          typeof payload.scope === "string" ? payload.scope.split(" ").filter(Boolean) : [],
        roles: Array.isArray(payload.roles)
          ? payload.roles.filter((role): role is string => typeof role === "string")
          : [],
      };
    } catch {
      return { valid: false, reason: "JWT parsing error" };
    }
  }

  async validateCertificate(
    certificate: string,
    _privateKey?: string
  ): Promise<CredentialValidationResult> {
    try {
      const certInfo = this.parseCertificate(certificate);

      if (certInfo.notAfter < new Date()) {
        return { valid: false, reason: "Certificate expired" };
      }

      return {
        valid: true,
        subject: certInfo.subject,
        permissions: ["certificate_authenticated"],
        roles: ["certified_agent"],
        certificateInfo: certInfo,
      };
    } catch {
      return { valid: false, reason: "Certificate validation error" };
    }
  }

  async validateOAuth(
    accessToken: string,
    _refreshToken?: string
  ): Promise<CredentialValidationResult> {
    if (accessToken.startsWith("oauth_")) {
      return {
        valid: true,
        subject: "oauth_user",
        permissions: ["oauth_authenticated"],
        roles: ["oauth_agent"],
      };
    }

    return { valid: false, reason: "Invalid OAuth token" };
  }

  parseCertificate(certificate: string): CertificateInfo {
    return {
      subject: "CN=agent,O=ValueOS",
      issuer: "CN=ValueOS CA",
      serialNumber: "123456",
      notBefore: new Date("2024-01-01"),
      notAfter: new Date("2025-01-01"),
      fingerprint: certificate ? crypto.createHash("sha256").update(certificate).digest("hex") : "",
      keyUsage: ["digitalSignature", "keyEncipherment"],
    };
  }

  calculateTrustLevel(
    validation: CredentialValidationResult,
    context: TrustContext
  ): TrustLevel {
    let trustLevel: TrustLevel = "low";

    if (validation.certificateInfo) {
      trustLevel = "high";
    } else if (validation.roles?.includes("admin")) {
      trustLevel = "privileged";
    } else if (validation.roles?.includes("agent")) {
      trustLevel = "medium";
    }

    if (context.ipAddress.startsWith("192.168.") || context.ipAddress.startsWith("10.")) {
      if (trustLevel === "low") {
        trustLevel = "medium";
      } else if (trustLevel === "medium") {
        trustLevel = "high";
      }
    }

    return trustLevel;
  }

  isMFARequired(roles: string[]): boolean {
    // MFA is required for admin roles and certificate-based agent roles
    const mfaRoles = ["admin", "certified_agent"];
    return roles.some((r) => mfaRoles.includes(r));
  }
}
