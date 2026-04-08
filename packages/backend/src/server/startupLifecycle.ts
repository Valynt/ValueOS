import { getConfig } from "../config/environment.js";
import { validateAuditLogEncryptionConfig } from "../services/agents/AuditLogEncryptionConfig.js";

export async function validateInfrastructureConnectivity(
  logger: { info: (msg: string, payload?: unknown) => void },
): Promise<void> {
  logger.info("[Startup] Validating infrastructure connectivity");

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error(
      "Production startup failed: REDIS_URL is not set. " +
        "Redis is required for rate limiting, caching, and job queues."
    );
  }

  try {
    const { getRedisClient } = await import("../lib/redisClient.js");
    const redis = getRedisClient();
    const pong = await Promise.race([
      redis.ping(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Redis ping timeout after 5s")), 5000)
      ),
    ]);
    if (pong !== "PONG") {
      throw new Error(`Unexpected Redis ping response: ${String(pong)}`);
    }
    logger.info("[Startup] Redis connectivity verified");
  } catch (err) {
    throw new Error(
      `Production startup failed: Redis is unreachable. ${(err as Error).message}`
    );
  }

  const natsUrl = process.env.NATS_URL;
  if (natsUrl) {
    try {
      const nats = await import("nats");
      const nc = await Promise.race([
        nats.connect({ servers: natsUrl, timeout: 5000 }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("NATS connection timeout after 5s")), 5000)
        ),
      ]);
      await nc.close();
      logger.info("[Startup] NATS connectivity verified", { natsUrl });
    } catch (err) {
      throw new Error(
        `Production startup failed: NATS is unreachable at ${natsUrl}. ${(err as Error).message}`
      );
    }
  } else {
    logger.info("[Startup] NATS_URL not set — skipping NATS connectivity check");
  }

  logger.info("[Startup] Infrastructure connectivity validated");
}

export function validateAuditLogStartupConfig(): void {
  const auditLogEncryptionErrors = validateAuditLogEncryptionConfig(process.env);

  if (auditLogEncryptionErrors.length > 0) {
    throw new Error(auditLogEncryptionErrors.join(" "));
  }
}

export function validateProductionMfaStartup(settings: { NODE_ENV: string }, logger: { warn: (msg: string) => void }): void {
  if (settings.NODE_ENV !== "production") {
    return;
  }

  const mfaOverrideEnabled = process.env.MFA_PRODUCTION_OVERRIDE === "true";
  const { auth } = getConfig();

  if (!auth.mfaEnabled && !mfaOverrideEnabled) {
    throw new Error(
      "Refusing production startup: MFA is not enabled. Set MFA_ENABLED=true or set MFA_PRODUCTION_OVERRIDE=true only for emergency recovery."
    );
  }

  if (!auth.mfaEnabled && mfaOverrideEnabled) {
    logger.warn(
      "Production startup override in use: MFA is disabled because MFA_PRODUCTION_OVERRIDE=true. This should only be used for emergency recovery."
    );
  }
}
