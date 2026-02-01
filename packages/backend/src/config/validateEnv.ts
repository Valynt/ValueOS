/**
 * Environment Validation
 *
 * Validates required environment variables at startup with actionable error messages.
 * Fail-fast pattern: detect misconfiguration before the application crashes unexpectedly.
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const REQUIRED_VARS = [
  { name: "DATABASE_URL", fix: "Run: pnpm run dx:env --mode local --force" },
  { name: "SUPABASE_URL", fix: "Run: pnpm run dx:env --mode local --force" },
];

const RECOMMENDED_VARS = [
  { name: "SUPABASE_ANON_KEY", fix: "Set to local Supabase demo key" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", fix: "Only needed for admin operations" },
  { name: "REDIS_URL", fix: "Run: pnpm run dx to start Redis" },
];

export function validateEnv(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

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
