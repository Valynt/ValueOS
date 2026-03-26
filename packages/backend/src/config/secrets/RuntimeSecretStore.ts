import { getEnvVar } from "../../lib/env";
import { logger } from "../../lib/logger.js";

import type { SecretValue } from "./ISecretProvider.js";
import { defaultProvider } from "./ProviderFactory.js";

const SECRET_KEY_MAPPING: Record<string, string> = {
  TOGETHER_API_KEY: getEnvVar("TOGETHER_API_KEY_SECRET_NAME") || "together-api-key",
  OPENAI_API_KEY: getEnvVar("OPENAI_API_KEY_SECRET_NAME") || "openai-api-key",
  SUPABASE_SERVICE_ROLE_KEY:
    getEnvVar("SUPABASE_SERVICE_ROLE_KEY_SECRET_NAME") || "supabase-service-key",
};

const SENSITIVE_ENV_KEYS = Object.keys(SECRET_KEY_MAPPING);
const REDACTED = "[REDACTED]";

function normalizeSecret(secret: SecretValue, envKey: string): string | undefined {
  const preferredOrder = ["value", "secret", envKey.toLowerCase()];
  for (const candidate of preferredOrder) {
    const value = secret[candidate];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}

class RuntimeSecretStore {
  private readonly secrets = new Map<string, string>();

  seedFromEnvironment(): void {
    for (const key of SENSITIVE_ENV_KEYS) {
      const value = process.env[key];
      if (typeof value === "string" && value.trim().length > 0) {
        this.secrets.set(key, value);
      }
    }
  }

  enforceProductionNoSecretEnvPolicy(): void {
    if ((process.env.NODE_ENV ?? "development") !== "production") {
      return;
    }

    const rawAllowlist = process.env.SECRET_ENV_ALLOWLIST ?? "";
    const allowlisted = new Set(
      rawAllowlist
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    );

    for (const key of SENSITIVE_ENV_KEYS) {
      if (!process.env[key]) {
        continue;
      }
      if (allowlisted.has(key)) {
        continue;
      }

      logger.warn("Blocked sensitive process.env secret in production", {
        key,
        value: REDACTED,
      });
      delete process.env[key];
    }
  }

  setSecret(key: string, value: string): void {
    this.secrets.set(key, value);
  }

  async getSecret(key: string, tenantId?: string): Promise<string | undefined> {
    const cached = this.secrets.get(key);
    if (cached) {
      return cached;
    }

    if (getEnvVar("SECRETS_MANAGER_ENABLED") !== "true") {
      return undefined;
    }

    const secretKey = SECRET_KEY_MAPPING[key];
    if (!secretKey) {
      return undefined;
    }

    try {
      const resolvedTenantId = tenantId || getEnvVar("SECRETS_TENANT_ID") || "platform";
      const secretValue = await defaultProvider.getSecret(
        resolvedTenantId,
        secretKey,
        undefined,
        "runtime-secret-store"
      );
      const normalized = normalizeSecret(secretValue, key);
      if (!normalized) {
        return undefined;
      }

      this.secrets.set(key, normalized);
      return normalized;
    } catch (error) {
      logger.error("Failed to load secret from provider", error, { key });
      return undefined;
    }
  }

  async requireSecret(key: string, tenantId?: string): Promise<string> {
    const value = await this.getSecret(key, tenantId);
    if (!value) {
      throw new Error(`Missing required secret: ${key}`);
    }
    return value;
  }
}

export const runtimeSecretStore = new RuntimeSecretStore();

export function getSensitiveEnvKeys(): string[] {
  return [...SENSITIVE_ENV_KEYS];
}
