/**
 * Environment Validation
 */

export function validateEnv(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!process.env.DATABASE_URL) errors.push("Missing DATABASE_URL");
  if (!process.env.SUPABASE_URL) errors.push("Missing SUPABASE_URL");

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateEnvOrThrow(): void {
  const { valid, errors } = validateEnv();
  if (!valid) {
    throw new Error(`Environment validation failed: ${errors.join(", ")}`);
  }
}
