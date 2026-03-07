// packages/backend/src/api/config/validateEnv.ts
export function validateEnv(): void {
  // DATABASE_URL is canonical.
  // Legacy compatibility is limited to DB_URL, which should mirror DATABASE_URL.
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
  const hasLegacyDbFallback = Boolean(process.env.DB_URL);

  if (!process.env.NODE_ENV) {
    throw new Error('Missing required environment variable: NODE_ENV');
  }

  if (!hasDatabaseUrl && !hasLegacyDbFallback) {
    throw new Error('Missing DATABASE_URL. Legacy fallback requires DB_URL.');
  }
}
