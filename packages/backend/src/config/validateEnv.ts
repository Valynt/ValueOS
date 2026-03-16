/**
 * Environment Validation
 *
 * Validates required environment variables at startup with actionable error messages.
 * Fail-fast pattern: detect misconfiguration before the application crashes unexpectedly.
 */

export interface ValidationResult {
  valid: boolean;
  /** Alias for valid */
  isValid?: boolean;
  errors: string[];
  warnings: string[];
}

// Database env precedence: prefer DATABASE_URL everywhere.
// Legacy DB_* atomics are deprecated and should only be used in explicit fallback paths.
const REQUIRED_VARS = [
  { name: "DATABASE_URL", fix: "Run: pnpm run dx:env --mode local --force" },
  { name: "SUPABASE_URL", fix: "Run: pnpm run dx:env --mode local --force" },
];

const RECOMMENDED_VARS = [
  { name: "SUPABASE_ANON_KEY", fix: "Set to local Supabase demo key" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", fix: "Only needed for admin operations" },
  { name: "REDIS_URL", fix: "Run: pnpm run dx to start Redis" },
];

const SECURE_NODE_ENVS = new Set(["staging", "production"]);
const STRICT_POSTGRES_SSL_MODES = new Set(["require", "verify-ca", "verify-full"]);

const DEPRECATED_ALIASES = [
  { deprecated: "SUPABASE_SERVICE_KEY", canonical: "SUPABASE_SERVICE_ROLE_KEY" },
];


function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function validateCacheEncryptionRules(nodeEnv: string, errors: string[]): void {
  if (!SECURE_NODE_ENVS.has(nodeEnv)) {
    return;
  }

  if (process.env.CACHE_ENCRYPTION_ENABLED === "false") {
    errors.push(`In ${nodeEnv}, CACHE_ENCRYPTION_ENABLED must not be false.`);
  }

  const cacheEncryptionKey = process.env.CACHE_ENCRYPTION_KEY;
  if (!cacheEncryptionKey) {
    errors.push(`In ${nodeEnv}, CACHE_ENCRYPTION_KEY is required.`);
  }
}

function validateSecureTransportRules(errors: string[]): void {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  if (!SECURE_NODE_ENVS.has(nodeEnv)) {
    return;
  }

  const dbUrlRaw = process.env.DATABASE_URL;
  if (dbUrlRaw) {
    const dbUrl = parseUrl(dbUrlRaw);
    if (!dbUrl) {
      errors.push("Invalid DATABASE_URL format. Must be a valid postgres URL.");
    } else {
      const sslMode = (dbUrl.searchParams.get("sslmode") ?? "").toLowerCase();
      if (!STRICT_POSTGRES_SSL_MODES.has(sslMode)) {
        errors.push(
          `In ${nodeEnv}, DATABASE_URL must enable TLS with sslmode=require, verify-ca, or verify-full.`
        );
      }
    }
  }

  const redisUrlRaw = process.env.REDIS_URL;
  if (redisUrlRaw) {
    const redisUrl = parseUrl(redisUrlRaw);
    if (!redisUrl) {
      errors.push("Invalid REDIS_URL format. Must be a valid redis URL.");
    } else if (redisUrl.protocol !== "rediss:") {
      errors.push(`In ${nodeEnv}, REDIS_URL must use TLS (rediss://...).`);
    }
  }

  const rejectUnauthorized = (process.env.REDIS_TLS_REJECT_UNAUTHORIZED ?? "true").toLowerCase();
  if (rejectUnauthorized !== "true") {
    errors.push(
      `In ${nodeEnv}, REDIS_TLS_REJECT_UNAUTHORIZED must be true to enforce certificate validation.`
    );
  }

  if (!process.env.REDIS_TLS_CA_CERT_PATH && !process.env.REDIS_TLS_CA_CERT) {
    errors.push(
      `In ${nodeEnv}, set REDIS_TLS_CA_CERT_PATH (preferred) or REDIS_TLS_CA_CERT to validate Redis certificates.`
    );
  }

  if (!process.env.REDIS_TLS_SERVERNAME) {
    errors.push(`In ${nodeEnv}, REDIS_TLS_SERVERNAME is required for Redis certificate hostname validation.`);
  }
}

export function validateEnv(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const { deprecated, canonical } of DEPRECATED_ALIASES) {
    if (process.env[deprecated]) {
      errors.push(`Deprecated ${deprecated} is set. Use ${canonical} instead.`);
    }
  }

  // Check required variables
  for (const { name, fix } of REQUIRED_VARS) {
    if (!process.env[name]) {
      errors.push(`Missing ${name}. Fix: ${fix}`);
    }
  }

  // Check recommended variables (warnings only)
  for (const { name, fix } of RECOMMENDED_VARS) {
    if (!process.env[name]) {
      warnings.push(`Missing ${name}. ${fix}`);
    }
  }

  // Production: require Together API key to prevent misconfiguration
  const nodeEnv = process.env.NODE_ENV ?? "development";
  if (nodeEnv === "production" && !process.env.TOGETHER_API_KEY) {
    errors.push("TOGETHER_API_KEY is required in production");
  }

  // Production: MFA must be enabled. A disabled MFA flag in production is a
  // security misconfiguration — warn loudly so it surfaces in logs and health checks.
  if (nodeEnv === "production" && process.env.MFA_ENABLED !== "true") {
    warnings.push(
      "MFA_ENABLED is not set to 'true' in production. Set MFA_ENABLED=true to enforce multi-factor authentication for all users."
    );
  }

  // Production: an encryption key must be present and in a format that encryption.ts
  // can parse: hex (64 chars), base64 (44 chars), or pbkdf2:<iterations>:<salt>:<passphrase>.
  // encryption.ts reads APP_ENCRYPTION_KEY first, falling back to ENCRYPTION_KEY, so mirror
  // that precedence here to avoid false-positive startup failures when only APP_ENCRYPTION_KEY
  // is set.
  if (nodeEnv === "production") {
    const encryptionKey = process.env.APP_ENCRYPTION_KEY ?? process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      errors.push("APP_ENCRYPTION_KEY (or ENCRYPTION_KEY) is required in production");
    } else if (
      !encryptionKey.startsWith("pbkdf2:") &&
      !encryptionKey.startsWith("hex:") &&
      !encryptionKey.startsWith("base64:") &&
      encryptionKey.length < 44 // minimum for a raw base64-encoded 32-byte key
    ) {
      errors.push(
        "APP_ENCRYPTION_KEY is too short. Use one of: hex (64 chars, generate with: openssl rand -hex 32), " +
        "base64 (44 chars, generate with: openssl rand -base64 32), " +
        "or pbkdf2:<iterations>:<salt>:<passphrase>"
      );
    }
  }


  // Canonical DB precedence: DATABASE_URL first, with explicit DB_URL fallback only for legacy compatibility.
  if (process.env.DB_URL && !process.env.DATABASE_URL) {
    warnings.push("Using legacy DB_URL fallback. Prefer DATABASE_URL.");
  }

  if (process.env.DB_URL && process.env.DATABASE_URL && process.env.DB_URL !== process.env.DATABASE_URL) {
    warnings.push("DATABASE_URL and DB_URL differ; DATABASE_URL takes precedence.");
  }

  // Validate DATABASE_URL format if present
  if (process.env.DATABASE_URL) {
    const url = process.env.DATABASE_URL;
    if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) {
      errors.push(`Invalid DATABASE_URL format. Must start with postgresql:// or postgres://`);
    }
  }

  // Validate SUPABASE_URL format if present
  if (process.env.SUPABASE_URL) {
    const url = process.env.SUPABASE_URL;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      errors.push(`Invalid SUPABASE_URL format. Must start with http:// or https://`);
    }
  }

  validateSecureTransportRules(errors);
  validateCacheEncryptionRules(nodeEnv, errors);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateEnvOrThrow(): void {
  const { valid, errors, warnings } = validateEnv();

  // Log warnings but don't fail
  if (warnings.length > 0) {
    console.warn("[validateEnv] Warnings:");
    warnings.forEach((w) => console.warn(`  ⚠️  ${w}`));
  }

  if (!valid) {
    console.error("[validateEnv] Environment validation failed:");
    errors.forEach((e) => console.error(`  ❌ ${e}`));
    console.error("\nRun 'pnpm run dx:validate' for a full diagnostic.");
    throw new Error(`Environment validation failed: ${errors.join(", ")}`);
  }
}

export function validateLLMConfig(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!process.env.LLM_API_KEY && !process.env.OPENAI_API_KEY) {
    warnings.push("No LLM API key configured");
  }
  return { valid: errors.length === 0, errors, warnings };
}
