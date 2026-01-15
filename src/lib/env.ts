import { validateEnvOrThrow } from "../config/validateEnv";

/**
 * Environment Variable Validation
 * Ensures all required environment variables are present before starting the application.
 * Now uses the central validation system in src/config/validateEnv.ts
 */

export const REQUIRED_ENV_VARS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
] as const;

export function validateRequiredEnv() {
  validateEnvOrThrow();
}

// Legacy alias for backward compatibility - use validateRequiredEnv for new code
export function validateEnv() {
  validateRequiredEnv();
}
