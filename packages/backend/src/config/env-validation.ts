/**
 * @deprecated Canonical env validation lives in `validateEnv.ts`.
 *
 * This compatibility shim remains for legacy imports.
 */

import { validateEnv, validateEnvOrThrow, type ValidationResult } from "./validateEnv.js";

export interface EnvValidationResult {
  success: boolean;
  data: null;
  errors: string[];
  warnings: string[];
  maintenanceMode: boolean;
  safeDefaults: Record<string, unknown>;
}

/**
 * @deprecated Use `validateEnv()` from `validateEnv.ts` directly.
 */
export function validateEnvironment(
  env: Record<string, string> = process.env as Record<string, string>
): EnvValidationResult {
  const originalEnv = process.env;
  process.env = { ...originalEnv, ...env };

  try {
    const result: ValidationResult = validateEnv();
    return {
      success: result.valid,
      data: null,
      errors: result.errors,
      warnings: result.warnings,
      maintenanceMode: false,
      safeDefaults: {},
    };
  } finally {
    process.env = originalEnv;
  }
}

/**
 * @deprecated Use `validateEnvOrThrow()` from `validateEnv.ts` directly.
 */
export function validateEnvironmentOrThrow(env: Record<string, string> = process.env as Record<string, string>): void {
  const result = validateEnvironment(env);
  if (!result.success) {
    throw new Error(`Environment validation failed: ${result.errors.join(", ")}`);
  }
}

export { validateEnv, validateEnvOrThrow };
export default validateEnvironment;
