/**
 * API Key Rotation Service (VOS-SEC-005)
 *
 * Automated rotation for LLM provider API keys and AWS credentials.
 *
 * SOC 2 Compliance: CC6.7 (Key Management)
 *
 * Provider support matrix:
 * - together_ai  — manual (no public key-management API); admin notification sent
 * - openai       — manual (OpenAI key-management API is not publicly available); admin notification sent
 * - anthropic    — manual (Anthropic key-management API is not publicly available); admin notification sent
 * - supabase     — manual (Supabase does not support programmatic service-role key rotation)
 * - aws-iam      — automated via @aws-sdk/client-iam when AWS_ROTATION_ENABLED=true;
 *                  falls back to admin notification otherwise
 *
 * For providers that require manual rotation, this service:
 *   1. Sends an admin notification with step-by-step instructions
 *   2. Throws ManualRotationRequiredError so callers can surface the requirement
 *   3. Logs an audit event
 */

import { createLogger } from "../../lib/logger.js";

import { auditLogService } from "./AuditLogService.js";

const logger = createLogger({ component: "APIKeyRotationService" });

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/**
 * Thrown when a provider requires manual key rotation.
 * Callers should surface this to operators via the configured alert channel.
 */
export class ManualRotationRequiredError extends Error {
  public readonly provider: string;
  public readonly instructions: string[];
  public readonly dueDate: Date;

  constructor(provider: string, instructions: string[], dueDate: Date) {
    super(`Manual rotation required for provider: ${provider}`);
    this.name = "ManualRotationRequiredError";
    this.provider = provider;
    this.instructions = instructions;
    this.dueDate = dueDate;
  }
}

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface APIKeyRotationConfig {
  provider: "openai" | "anthropic" | "supabase" | "aws-iam" | "together_ai";
  currentKey: string;
  rotationIntervalDays: number;
  lastRotated?: Date;
  autoRotate?: boolean;
}

export interface RotationResult {
  provider: string;
  /** Masked new key (first 4 + last 4 chars). Never the full key. */
  newKey: string;
  oldKeyRetired: boolean;
  rotatedAt: Date;
  nextRotation: Date;
}

interface AWSAccessKey {
  AccessKeyId: string;
  SecretAccessKey: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class APIKeyRotationService {
  private rotationSchedule: Map<string, ReturnType<typeof setInterval>> = new Map();

  // ── Public rotation methods ──────────────────────────────────────────────

  /**
   * OpenAI does not expose a public key-management API.
   * Sends an admin notification and throws ManualRotationRequiredError.
   */
  async rotateOpenAIKey(): Promise<RotationResult> {
    logger.info("OpenAI API key rotation initiated");
    return this.requireManualRotation("openai", [
      "1. Go to https://platform.openai.com/api-keys",
      "2. Click 'Create new secret key'",
      `3. Name: valueos-production-${Date.now()}`,
      "4. Copy the key immediately (shown only once)",
      "5. Update the OPENAI_API_KEY secret in your vault / environment",
      "6. Verify: curl https://api.openai.com/v1/models -H 'Authorization: Bearer <new-key>'",
      "7. Delete the old key from the OpenAI dashboard",
      "8. Confirm completion in Slack #security",
    ]);
  }

  /**
   * Anthropic does not expose a public key-management API.
   * Sends an admin notification and throws ManualRotationRequiredError.
   */
  async rotateAnthropicKey(): Promise<RotationResult> {
    logger.info("Anthropic API key rotation initiated");
    return this.requireManualRotation("anthropic", [
      "1. Go to https://console.anthropic.com/settings/keys",
      "2. Click 'Create Key'",
      `3. Name: valueos-production-${Date.now()}`,
      "4. Copy the key immediately (shown only once)",
      "5. Update the ANTHROPIC_API_KEY secret in your vault / environment",
      "6. Verify the new key works with a test request",
      "7. Revoke the old key from the Anthropic console",
      "8. Confirm completion in Slack #security",
    ]);
  }

  /**
   * Together.ai does not expose a public key-management API.
   * Sends an admin notification and throws ManualRotationRequiredError.
   */
  async rotateTogetherAIKey(): Promise<RotationResult> {
    logger.info("Together.ai API key rotation initiated");
    return this.requireManualRotation("together_ai", [
      "1. Go to https://api.together.ai/settings/api-keys",
      "2. Click 'Create API Key'",
      `3. Name: valueos-production-${Date.now()}`,
      "4. Copy the key immediately (shown only once)",
      "5. Update the TOGETHER_API_KEY secret in your vault / environment",
      "6. Verify: curl https://api.together.ai/v1/models -H 'Authorization: Bearer <new-key>'",
      "7. Delete the old key from the Together.ai dashboard",
      "8. Confirm completion in Slack #security",
    ]);
  }

  /**
   * Supabase does not support programmatic service-role key rotation.
   * Sends an admin notification and throws ManualRotationRequiredError.
   */
  async rotateSupabaseKey(): Promise<RotationResult> {
    logger.info("Supabase service role key rotation initiated");
    return this.requireManualRotation("supabase", [
      "1. Go to Supabase Dashboard > Project Settings > API",
      "2. Generate a new service_role key",
      "3. Update SUPABASE_SERVICE_ROLE_KEY in your vault / environment",
      "4. Restart all backend services to pick up the new key",
      "5. Verify connectivity: run pnpm run dx:doctor",
      "6. Revoke the old key in the Supabase dashboard",
      "7. Confirm completion in Slack #security",
    ]);
  }

  /**
   * AWS IAM key rotation.
   *
   * When AWS_ROTATION_ENABLED=true and AWS credentials are configured,
   * creates a new IAM access key, stores it in the vault, validates it,
   * and schedules deletion of the old key after a 2-hour grace period.
   *
   * When AWS_ROTATION_ENABLED is not set, falls back to admin notification.
   */
  async rotateAWSKeys(): Promise<RotationResult> {
    logger.info("AWS IAM access key rotation initiated");

    if (process.env.AWS_ROTATION_ENABLED !== "true") {
      return this.requireManualRotation("aws-iam", [
        "1. Go to AWS IAM Console > Users > valueos-service",
        "2. Security credentials > Create access key",
        "3. Copy AccessKeyId and SecretAccessKey (shown only once)",
        "4. Update AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in your vault / environment",
        "5. Restart backend services",
        "6. Verify AWS connectivity",
        "7. Delete the old access key from IAM",
        "8. Confirm completion in Slack #security",
        "",
        "To enable automated rotation, set AWS_ROTATION_ENABLED=true and ensure",
        "the service role has iam:CreateAccessKey and iam:DeleteAccessKey permissions.",
      ]);
    }

    try {
      const { newKey, oldKeyId } = await this.rotateAWSAccessKeyAutomated();

      // Write both values as a single atomic secret so the vault never holds
      // a new access key ID paired with the old secret (or vice versa).
      await this.updateSecretInVault("aws_credentials", {
        aws_access_key_id: newKey.AccessKeyId,
        aws_secret_access_key: newKey.SecretAccessKey,
      });

      await this.validateAWSCredentials(newKey.AccessKeyId, newKey.SecretAccessKey);

      // Schedule old key deletion after 2-hour grace period to allow in-flight
      // requests using the old key to complete.
      if (oldKeyId) {
        const gracePeriodMs = 2 * 60 * 60 * 1000;
        const timer = setTimeout(async () => {
          try {
            await this.deleteAWSAccessKey(oldKeyId);
            logger.info("Old AWS access key deleted after grace period", {
              oldKeyId: this.maskKey(oldKeyId),
            });
          } catch (err) {
            logger.error("Failed to delete old AWS access key — manual deletion required", {
              oldKeyId: this.maskKey(oldKeyId),
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }, gracePeriodMs);
        if (timer.unref) timer.unref();
      }

      await this.logRotationEvent("aws-iam", newKey.AccessKeyId);

      const now = new Date();
      const nextRotation = new Date(now);
      nextRotation.setDate(now.getDate() + 90);

      return {
        provider: "aws-iam",
        newKey: this.maskKey(newKey.AccessKeyId),
        oldKeyRetired: false,
        rotatedAt: now,
        nextRotation,
      };
    } catch (err) {
      if (err instanceof ManualRotationRequiredError) throw err;
      logger.error("Automated AWS key rotation failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  // ── Scheduling ───────────────────────────────────────────────────────────

  scheduleRotation(config: APIKeyRotationConfig): void {
    if (!config.autoRotate) {
      logger.info(`Auto-rotation disabled for ${config.provider}`);
      return;
    }

    const intervalMs = config.rotationIntervalDays * 24 * 60 * 60 * 1000;

    const timer = setInterval(async () => {
      logger.info(`Scheduled rotation triggered for ${config.provider}`);
      try {
        switch (config.provider) {
          case "openai":      await this.rotateOpenAIKey();     break;
          case "anthropic":   await this.rotateAnthropicKey();  break;
          case "together_ai": await this.rotateTogetherAIKey(); break;
          case "supabase":    await this.rotateSupabaseKey();   break;
          case "aws-iam":     await this.rotateAWSKeys();       break;
        }
      } catch (err) {
        if (err instanceof ManualRotationRequiredError) {
          logger.warn(`Scheduled rotation for ${config.provider} requires manual action`, {
            provider: err.provider,
            dueDate: err.dueDate.toISOString(),
          });
        } else {
          logger.error(`Scheduled rotation failed for ${config.provider}`, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }, intervalMs);

    this.rotationSchedule.set(config.provider, timer);
    logger.info(`Rotation scheduled for ${config.provider} every ${config.rotationIntervalDays} days`);
  }

  cancelRotation(provider: string): void {
    const timer = this.rotationSchedule.get(provider);
    if (timer) {
      clearInterval(timer);
      this.rotationSchedule.delete(provider);
      logger.info(`Rotation cancelled for ${provider}`);
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Notify admins and throw ManualRotationRequiredError.
   * Used for all providers that lack a programmatic key-management API.
   */
  private async requireManualRotation(
    provider: string,
    instructions: string[],
  ): Promise<never> {
    const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.notifyAdmins({ provider, instructions, dueDate });
    await this.logRotationEvent(provider, "MANUAL_ROTATION_REQUIRED").catch((err) => {
      logger.warn("Failed to log rotation audit event", {
        provider,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    throw new ManualRotationRequiredError(provider, instructions, dueDate);
  }

  /**
   * Create a new AWS IAM access key.
   * Requires @aws-sdk/client-iam and iam:CreateAccessKey + iam:ListAccessKeys permissions.
   */
  private async rotateAWSAccessKeyAutomated(): Promise<{
    newKey: AWSAccessKey;
    oldKeyId: string | null;
  }> {
    let iamModule: typeof import("@aws-sdk/client-iam");
    try {
      iamModule = await import("@aws-sdk/client-iam");
    } catch {
      throw new Error(
        "@aws-sdk/client-iam is not installed. " +
          "Run: pnpm add @aws-sdk/client-iam --filter @valueos/backend"
      );
    }

    const { IAMClient, CreateAccessKeyCommand, ListAccessKeysCommand } = iamModule;

    const region = process.env.AWS_REGION;
    if (!region) {
      throw new Error("AWS_REGION environment variable is required for automated IAM key rotation");
    }

    const iamClient = new IAMClient({ region });

    const listResult = await iamClient.send(new ListAccessKeysCommand({}));
    const currentKeys = listResult.AccessKeyMetadata ?? [];
    const oldKeyId = currentKeys.find((k) => k.Status === "Active")?.AccessKeyId ?? null;

    const createResult = await iamClient.send(new CreateAccessKeyCommand({}));
    const newKey = createResult.AccessKey;

    if (!newKey?.AccessKeyId || !newKey.SecretAccessKey) {
      throw new Error("AWS IAM CreateAccessKey returned an incomplete key object");
    }

    return {
      newKey: { AccessKeyId: newKey.AccessKeyId, SecretAccessKey: newKey.SecretAccessKey },
      oldKeyId,
    };
  }

  private async deleteAWSAccessKey(accessKeyId: string): Promise<void> {
    const { IAMClient, DeleteAccessKeyCommand } = await import("@aws-sdk/client-iam");
    const region = process.env.AWS_REGION;
    if (!region) throw new Error("AWS_REGION is required");
    const iamClient = new IAMClient({ region });
    await iamClient.send(new DeleteAccessKeyCommand({ AccessKeyId: accessKeyId }));
  }

  private async validateAWSCredentials(accessKeyId: string, secretAccessKey: string): Promise<void> {
    try {
      const { STSClient, GetCallerIdentityCommand } = await import("@aws-sdk/client-sts");
      const region = process.env.AWS_REGION ?? "us-east-1";
      const stsClient = new STSClient({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
      await stsClient.send(new GetCallerIdentityCommand({}));
      logger.info("New AWS credentials validated via STS GetCallerIdentity");
    } catch (err) {
      // @aws-sdk/client-sts is an optional peer dependency; treat its absence as
      // a non-fatal skip.  Any other error (network, auth) is re-thrown so the
      // caller can decide whether to roll back.
      const isModuleNotFound =
        err instanceof Error &&
        ("code" in err
          ? (err as NodeJS.ErrnoException).code === "ERR_MODULE_NOT_FOUND"
          : err.message.includes("Cannot find module"));

      if (isModuleNotFound) {
        logger.warn("Could not validate new AWS credentials: @aws-sdk/client-sts not available", {
          accessKeyId: this.maskKey(accessKeyId),
        });
        return;
      }

      throw err;
    }
  }

  /**
   * Write one or more key-value pairs as a single secret in the configured vault.
   *
   * Accepts a `Record<string, string>` so callers can write multiple related
   * values (e.g. AWS access key ID + secret) atomically — the vault never
   * holds a new access key ID paired with the old secret.
   *
   * Uses AWSSecretProvider when AWS_SECRETS_MANAGER_ENABLED=true.
   */
  private async updateSecretInVault(
    key: string,
    value: string | Record<string, string>,
  ): Promise<void> {
    if (process.env.AWS_SECRETS_MANAGER_ENABLED !== "true") {
      logger.warn("Vault write skipped — AWS_SECRETS_MANAGER_ENABLED is not set", {
        secretKey: key,
        action: "manual_update_required",
      });
      return;
    }

    try {
      const { ProviderFactory } = await import("../../config/secrets/ProviderFactory.js");
      const factory = ProviderFactory.getInstance();
      const provider = factory.createProvider({
        type: "aws",
        region: process.env.AWS_REGION ?? "us-east-1",
        environment: process.env.NODE_ENV ?? "production",
      });

      const tenantId = "system";
      const now = new Date().toISOString();
      const secretValue: Record<string, string> =
        typeof value === "string" ? { value } : value;

      await provider.setSecret(
        tenantId,
        key,
        secretValue,
        {
          tenantId,
          secretPath: key,
          version: now,
          createdAt: now,
          lastAccessed: now,
          sensitivityLevel: "critical",
        },
        "system-rotation",
      );

      logger.info("Secret updated in vault", { secretKey: key });
    } catch (err) {
      logger.error("Failed to update secret in vault", {
        secretKey: key,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  private maskKey(key: string): string {
    if (key.length < 12) return "***";
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  }

  private async logRotationEvent(provider: string, newKey: string): Promise<void> {
    await auditLogService.createEntry({
      userId: "system-rotation",
      userEmail: "system@valueos.com",
      userName: "API Key Rotation Service",
      action: "api_key.rotate",
      resourceType: "api-key",
      resourceId: provider,
      status: "success",
      details: {
        provider,
        new_key_prefix: this.maskKey(newKey),
        rotated_at: new Date().toISOString(),
      },
      ipAddress: "0.0.0.0",
      userAgent: "api-key-rotation-service",
    });
  }

  private async notifyAdmins(notification: {
    provider: string;
    instructions: string[];
    dueDate: Date;
  }): Promise<void> {
    logger.warn("Manual key rotation required — admin notification", {
      provider: notification.provider,
      dueDate: notification.dueDate.toISOString(),
      instructions: notification.instructions,
    });

    const slackWebhook = process.env.SECURITY_SLACK_WEBHOOK_URL;
    if (slackWebhook) {
      const body = {
        text: `:key: *API Key Rotation Required* — \`${notification.provider}\``,
        attachments: [
          {
            color: "warning",
            fields: [
              { title: "Provider", value: notification.provider, short: true },
              { title: "Due by", value: notification.dueDate.toISOString(), short: true },
              { title: "Steps", value: notification.instructions.join("\n"), short: false },
            ],
          },
        ],
      };
      // eslint-disable-next-line no-restricted-globals -- legitimate direct fetch usage
      await fetch(slackWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch((err: unknown) => {
        logger.error("Failed to send Slack rotation notification", {
          provider: notification.provider,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }
  }
}

export const apiKeyRotationService = new APIKeyRotationService();

export function initializeAPIKeyRotation(): void {
  logger.info("Initializing API key rotation schedules");

  apiKeyRotationService.scheduleRotation({
    provider: "together_ai",
    currentKey: process.env.TOGETHER_API_KEY ?? "",
    rotationIntervalDays: 90,
    autoRotate: true,
  });

  apiKeyRotationService.scheduleRotation({
    provider: "openai",
    currentKey: process.env.OPENAI_API_KEY ?? "",
    rotationIntervalDays: 90,
    autoRotate: true,
  });

  apiKeyRotationService.scheduleRotation({
    provider: "anthropic",
    currentKey: process.env.ANTHROPIC_API_KEY ?? "",
    rotationIntervalDays: 90,
    autoRotate: true,
  });

  apiKeyRotationService.scheduleRotation({
    provider: "aws-iam",
    currentKey: process.env.AWS_ACCESS_KEY_ID ?? "",
    rotationIntervalDays: 90,
    autoRotate: true,
  });

  apiKeyRotationService.scheduleRotation({
    provider: "supabase",
    currentKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    rotationIntervalDays: 180,
    autoRotate: true,
  });

  logger.info("API key rotation schedules initialized");
}
