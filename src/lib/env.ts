/**
 * Environment Variable Validation
 * Ensures all required environment variables are present before starting the application.
 */

export const REQUIRED_ENV_VARS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
] as const;

export function validateEnv() {
  const missingVars = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);

  if (missingVars.length > 0) {
    console.error("❌ Missing required environment variables:");
    missingVars.forEach((v) => console.error(`   - ${v}`));
    console.error("\nRun: npm run env:dev");
    process.exit(1);
  }
}
