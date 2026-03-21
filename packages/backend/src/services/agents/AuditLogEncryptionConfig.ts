import { generateEncryptionKey } from "../../lib/crypto/CryptoUtils.js";

const TRUE_VALUE = "true";

export const AUDIT_LOG_ENCRYPTION_TEST_FALLBACK_ENV =
  "AUDIT_LOG_ENCRYPTION_ALLOW_TEST_FALLBACK";

export function isAuditLogEncryptionEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.AUDIT_LOG_ENCRYPTION_ENABLED === TRUE_VALUE;
}

export function isAuditLogEncryptionTestEnvironment(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.NODE_ENV === "test" || env.LOCAL_TEST_MODE === TRUE_VALUE;
}

export function isAuditLogEncryptionTestFallbackEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env[AUDIT_LOG_ENCRYPTION_TEST_FALLBACK_ENV] === TRUE_VALUE;
}

export function validateAuditLogEncryptionConfig(
  env: Record<string, string | undefined> = process.env,
): string[] {
  const errors: string[] = [];

  if (isAuditLogEncryptionTestFallbackEnabled(env) && !isAuditLogEncryptionTestEnvironment(env)) {
    errors.push(
      `${AUDIT_LOG_ENCRYPTION_TEST_FALLBACK_ENV}=true is only allowed when NODE_ENV=test or LOCAL_TEST_MODE=true.`,
    );
  }

  if (!isAuditLogEncryptionEnabled(env)) {
    return errors;
  }

  const configuredKey = env.AUDIT_LOG_ENCRYPTION_KEY?.trim();
  if (configuredKey) {
    return errors;
  }

  if (isAuditLogEncryptionTestEnvironment(env) && isAuditLogEncryptionTestFallbackEnabled(env)) {
    return errors;
  }

  errors.push(
    "AUDIT_LOG_ENCRYPTION_ENABLED=true requires AUDIT_LOG_ENCRYPTION_KEY to be configured via managed secrets or environment before startup. Automatic key generation is disabled outside explicit test fallback.",
  );

  return errors;
}

export function resolveAuditLogEncryptionKey(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const configuredKey = env.AUDIT_LOG_ENCRYPTION_KEY?.trim();
  if (configuredKey) {
    return configuredKey;
  }

  if (isAuditLogEncryptionEnabled(env) && isAuditLogEncryptionTestEnvironment(env) && isAuditLogEncryptionTestFallbackEnabled(env)) {
    return generateEncryptionKey();
  }

  return null;
}
