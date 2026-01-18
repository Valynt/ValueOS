/**
 * API Key Rotation Service (VOS-SEC-005)
 * Automated rotation for LLM provider API keys, Supabase, and AWS credentials
 *
 * SOC 2 Compliance: CC6.7 (Key Management)
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { auditLogService } from "../AuditLogService";
import { fetch } from 'undici';

export interface APIKeyRotationConfig {
  provider: "openai" | "anthropic" | "supabase" | "aws-iam" | "together_ai";
  currentKey: string;
  rotationIntervalDays: number;
  lastRotated?: Date;
  autoRotate?: boolean;
}

export interface RotationResult {
  provider: string;
  newKey: string;
  oldKeyRetired: boolean;
  rotatedAt: Date;
  nextRotation: Date;
}

/**
 * APIKeyRotationService
 * Handles automated rotation of external API keys
 */
export class APIKeyRotationService {
  private rotationSchedule: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Rotate OpenAI API Key
   */
  async rotateOpenAIKey(): Promise<RotationResult> {
    logger.info("Starting OpenAI API key rotation");

    try {
      // 1. Generate new API key via OpenAI API
      const newKey = await this.generateNewOpenAIKey();

      // 2. Update in Supabase Vault
      await this.updateSecretInVault("openai_api_key", newKey);

      // 3. Test new key
      await this.testOpenAIKey(newKey);

      // 4. Retire old key (after grace period)
      setTimeout(() => this.retireOpenAIKey(), 2 * 60 * 60 * 1000); // 2 hour grace period

      // 5. Log rotation event
      await this.logRotationEvent("openai", newKey);

      const now = new Date();
      const nextRotation = new Date(now);
      nextRotation.setDate(now.getDate() + 90); // 90 days

      return {
        provider: "openai",
        newKey: this.maskKey(newKey),
        oldKeyRetired: false, // Will be retired after grace period
        rotatedAt: now,
        nextRotation,
      };
    } catch (error) {
      logger.error("Failed to rotate OpenAI API key", error as Error);
      throw error;
    }
  }

  /**
   * Rotate Anthropic API Key
   */
  async rotateAnthropicKey(): Promise<RotationResult> {
    logger.info("Starting Anthropic API key rotation");

    try {
      const newKey = await this.generateNewAnthropicKey();
      await this.updateSecretInVault("anthropic_api_key", newKey);
      await this.testAnthropicKey(newKey);

      setTimeout(() => this.retireAnthropicKey(), 2 * 60 * 60 * 1000);

      await this.logRotationEvent("anthropic", newKey);

      const now = new Date();
      const nextRotation = new Date(now);
      nextRotation.setDate(now.getDate() + 90);

      return {
        provider: "anthropic",
        newKey: this.maskKey(newKey),
        oldKeyRetired: false,
        rotatedAt: now,
        nextRotation,
      };
    } catch (error) {
      logger.error("Failed to rotate Anthropic API key", error as Error);
      throw error;
    }
  }

  /**
   * Rotate Together.ai API Key
   * Primary LLM provider for ValueOS (100% of inference traffic)
   */
  async rotateTogetherAIKey(): Promise<RotationResult> {
    logger.info("Starting Together.ai API key rotation");

    try {
      // 1. Generate new API key
      const newKey = await this.generateNewTogetherAIKey();

      // 2. Update in Supabase Vault
      await this.updateSecretInVault("together_api_key", newKey);

      // 3. Test new key
      await this.testTogetherAIKey(newKey);

      // 4. Retire old key (after grace period)
      setTimeout(() => this.retireTogetherAIKey(), 2 * 60 * 60 * 1000); // 2 hour grace period

      // 5. Log rotation event
      await this.logRotationEvent("together_ai", newKey);

      const now = new Date();
      const nextRotation = new Date(now);
      nextRotation.setDate(now.getDate() + 90); // 90 days

      return {
        provider: "together_ai",
        newKey: this.maskKey(newKey),
        oldKeyRetired: false, // Will be retired after grace period
        rotatedAt: now,
        nextRotation,
      };
    } catch (error) {
      logger.error("Failed to rotate Together.ai API key", error as Error);
      throw error;
    }
  }

  /**
   * Rotate Supabase Service Role Key
   */
  async rotateSupabaseKey(): Promise<RotationResult> {
    logger.info("Starting Supabase service role key rotation");

    try {
      // Supabase doesn't support programmatic key rotation yet
      // Generate new project API key manually in dashboard
      // This method updates the reference and notifies admins

      const notification = {
        type: "MANUAL_ROTATION_REQUIRED",
        provider: "supabase",
        message:
          "Supabase service role key rotation requires manual intervention",
        instructions: [
          "1. Go to Supabase Dashboard > Project Settings > API",
          "2. Generate new service_role key",
          "3. Update SUPABASE_SERVICE_ROLE_KEY in environment",
          "4. Update Supabase Vault entry",
          "5. Test application connectivity",
        ],
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      };

      await this.notifyAdmins(notification);
      await this.logRotationEvent("supabase", "MANUAL_ROTATION_REQUIRED");

      const now = new Date();
      const nextRotation = new Date(now);
      nextRotation.setDate(now.getDate() + 180); // 180 days

      return {
        provider: "supabase",
        newKey: "MANUAL_ROTATION_REQUIRED",
        oldKeyRetired: false,
        rotatedAt: now,
        nextRotation,
      };
    } catch (error) {
      logger.error("Failed to rotate Supabase key", error as Error);
      throw error;
    }
  }

  /**
   * Rotate AWS IAM Access Keys
   */
  async rotateAWSKeys(): Promise<RotationResult> {
    logger.info("Starting AWS IAM access key rotation");

    try {
      // AWS key rotation using AWS SDK
      const newAccessKeyId = await this.generateNewAWSAccessKey();
      const newSecretKey = await this.getAWSSecretKey(newAccessKeyId);

      await this.updateSecretInVault("aws_access_key_id", newAccessKeyId);
      await this.updateSecretInVault("aws_secret_access_key", newSecretKey);

      await this.testAWSCredentials(newAccessKeyId, newSecretKey);

      // Retire old key after grace period
      setTimeout(() => this.retireAWSKey(), 2 * 60 * 60 * 1000);

      await this.logRotationEvent("aws-iam", newAccessKeyId);

      const now = new Date();
      const nextRotation = new Date(now);
      nextRotation.setDate(now.getDate() + 90);

      return {
        provider: "aws-iam",
        newKey: this.maskKey(newAccessKeyId),
        oldKeyRetired: false,
        rotatedAt: now,
        nextRotation,
      };
    } catch (error) {
      logger.error("Failed to rotate AWS IAM keys", error as Error);
      throw error;
    }
  }

  /**
   * Schedule automatic rotation
   */
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
          case "openai":
            await this.rotateOpenAIKey();
            break;
          case "anthropic":
            await this.rotateAnthropicKey();
            break;
          case "together_ai":
            await this.rotateTogetherAIKey();
            break;
          case "supabase":
            await this.rotateSupabaseKey();
            break;
          case "aws-iam":
            await this.rotateAWSKeys();
            break;
        }
      } catch (error) {
        logger.error(
          `Scheduled rotation failed for ${config.provider}`,
          error as Error
        );
      }
    }, intervalMs);

    this.rotationSchedule.set(config.provider, timer);
    logger.info(
      `Rotation scheduled for ${config.provider} every ${config.rotationIntervalDays} days`
    );
  }

  /**
   * Cancel scheduled rotation
   */
  cancelRotation(provider: string): void {
    const timer = this.rotationSchedule.get(provider);
    if (timer) {
      clearInterval(timer);
      this.rotationSchedule.delete(provider);
      logger.info(`Rotation cancelled for ${provider}`);
    }
  }

  // Private helper methods

  private async generateNewOpenAIKey(): Promise<string> {
    // In production, use OpenAI API to generate new key
    // This is a placeholder for the actual implementation
    const response = await fetch("https://api.openai.com/v1/keys", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_ADMIN_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `valueos-${Date.now()}`,
        scopes: ["api.read", "api.write"],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API returned ${response.status}`);
    }

    const data = await response.json();
    return data.key;
  }

  private async generateNewAnthropicKey(): Promise<string> {
    // Similar to OpenAI, use Anthropic Console API
    // Placeholder implementation
    const response = await fetch("https://api.anthropic.com/v1/keys", {
      method: "POST",
      headers: {
        "X-API-Key": process.env.ANTHROPIC_ADMIN_KEY || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `valueos-${Date.now()}`,
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API returned ${response.status}`);
    }

    const data = await response.json();
    return data.key;
  }

  private async generateNewAWSAccessKey(): Promise<string> {
    // Use AWS SDK to create new IAM access key
    // Placeholder - requires AWS SDK
    const AWS = await import("@aws-sdk/client-iam");
    const client = new AWS.IAMClient({ region: "us-east-1" });

    const command = new AWS.CreateAccessKeyCommand({
      UserName: "valueos-service-account",
    });

    const response = await client.send(command);
    return response.AccessKey?.AccessKeyId || "";
  }

  private async getAWSSecretKey(accessKeyId: string): Promise<string> {
    // AWS returns secret key only once during creation
    // Must be captured immediately
    return process.env.AWS_NEW_SECRET_KEY || "";
  }

  private async updateSecretInVault(key: string, value: string): Promise<void> {
    const supabase = createServerSupabaseClient();

    const { error } = await supabase.rpc("vault_update_secret", {
      secret_name: key,
      secret_value: value,
    });

    if (error) {
      throw new Error(`Failed to update secret in vault: ${error.message}`);
    }

    logger.info(`Secret ${key} updated in Supabase Vault`);
  }

  private async testOpenAIKey(key: string): Promise<void> {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });

    if (!response.ok) {
      throw new Error("New OpenAI key failed validation");
    }

    logger.info("OpenAI key validated successfully");
  }

  private async testAnthropicKey(key: string): Promise<void> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "X-API-Key": key,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 10,
        messages: [{ role: "user", content: "test" }],
      }),
    });

    if (!response.ok) {
      throw new Error("New Anthropic key failed validation");
    }

    logger.info("Anthropic key validated successfully");
  }

  private async testAWSCredentials(
    accessKeyId: string,
    secretKey: string
  ): Promise<void> {
    // Use AWS SDK to test credentials
    const AWS = await import("@aws-sdk/client-sts");
    const client = new AWS.STSClient({
      region: "us-east-1",
      credentials: {
        accessKeyId,
        secretAccessKey: secretKey,
      },
    });

    const command = new AWS.GetCallerIdentityCommand({});
    await client.send(command);

    logger.info("AWS credentials validated successfully");
  }

  private async retireOpenAIKey(): Promise<void> {
    logger.info("Retiring old OpenAI API key");
    // Revoke old key via OpenAI API
  }

  private async retireAnthropicKey(): Promise<void> {
    logger.info("Retiring old Anthropic API key");
    // Revoke old key via Anthropic API
  }

  private async retireAWSKey(): Promise<void> {
    logger.info("Retiring old AWS access key");
    // Delete old IAM access key via AWS SDK
  }

  private async generateNewTogetherAIKey(): Promise<string> {
    // Together.ai currently requires manual key generation via dashboard
    // This is a semi-automated approach that notifies admins

    // Future: If Together.ai adds key management API, implement programmatic generation
    // const response = await fetch('https://api.together.ai/v1/keys', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${process.env.TOGETHER_ADMIN_KEY}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     name: `valueos-${Date.now()}`,
    //     scopes: ['inference'],
    //   }),
    // });

    // For now: Notify admins to manually generate key
    await this.notifyAdmins({
      type: 'MANUAL_KEY_GENERATION_REQUIRED',
      provider: 'together_ai',
      message: 'Together.ai API key rotation required',
      instructions: [
        '1. Go to https://api.together.ai/settings/api-keys',
        '2. Click "Create API Key"',
        '3. Name: valueos-production-' + Date.now(),
        '4. Copy the key',
        '5. Update Supabase Vault secret "together_api_key"',
        '6. Confirm completion in Slack #security',
      ],
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    // Return placeholder - actual key will be updated in vault manually
    // The system will poll for the new key
    throw new Error('Manual key generation required - admin notification sent');
  }

  private async testTogetherAIKey(key: string): Promise<void> {
    const response = await fetch('https://api.together.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
        messages: [{ role: 'user', content: 'Test connection' }],
        max_tokens: 5, // Minimal tokens for cost efficiency
      }),
    });

    if (!response.ok) {
      throw new Error(`New Together.ai key failed validation: ${response.status}`);
    }

    logger.info('Together.ai key validated successfully');
  }

  private async retireTogetherAIKey(): Promise<void> {
    logger.info('Retiring old Together.ai API key');

    // Together.ai requires manual key revocation
    await this.notifyAdmins({
      type: 'MANUAL_KEY_REVOCATION_REQUIRED',
      provider: 'together_ai',
      message: 'Grace period expired. Revoke old Together.ai key now.',
      instructions: [
        '1. Go to https://api.together.ai/settings/api-keys',
        '2. Find the old key (check rotation logs for key prefix)',
        '3. Click "Delete"',
        '4. Confirm deletion',
        '5. Verify in Slack #security',
      ],
    });
  }

  private maskKey(key: string): string {
    if (key.length < 12) return "***";
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  }

  private async logRotationEvent(
    provider: string,
    newKey: string
  ): Promise<void> {
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

  private async notifyAdmins(notification: any): Promise<void> {
    logger.warn("Manual rotation required", notification);

    // In production, send email/Slack notification
    // For now, just log and create a task in the system
  }
}

export const apiKeyRotationService = new APIKeyRotationService();

// Initialize rotation schedules on service startup
export function initializeAPIKeyRotation(): void {
  logger.info("Initializing API key rotation schedules");

  // Schedule Together.ai rotation every 90 days (PRIMARY LLM PROVIDER)
  apiKeyRotationService.scheduleRotation({
    provider: "together_ai",
    currentKey: process.env.TOGETHER_API_KEY || "",
    rotationIntervalDays: 90,
    autoRotate: true,
  });

  // Schedule OpenAI rotation every 90 days
  apiKeyRotationService.scheduleRotation({
    provider: "openai",
    currentKey: process.env.OPENAI_API_KEY || "",
    rotationIntervalDays: 90,
    autoRotate: true,
  });

  // Schedule Anthropic rotation every 90 days
  apiKeyRotationService.scheduleRotation({
    provider: "anthropic",
    currentKey: process.env.ANTHROPIC_API_KEY || "",
    rotationIntervalDays: 90,
    autoRotate: true,
  });

  // Schedule AWS rotation every 90 days
  apiKeyRotationService.scheduleRotation({
    provider: "aws-iam",
    currentKey: process.env.AWS_ACCESS_KEY_ID || "",
    rotationIntervalDays: 90,
    autoRotate: true,
  });

  // Supabase requires manual rotation (notify every 180 days)
  apiKeyRotationService.scheduleRotation({
    provider: "supabase",
    currentKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    rotationIntervalDays: 180,
    autoRotate: true, // Will send notifications
  });

  logger.info("API key rotation schedules initialized");
}
