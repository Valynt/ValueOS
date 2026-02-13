// packages/backend/src/api/config/validateEnv.ts
export function validateEnv(): void {
  // DATABASE_URL is canonical; DB_* variables remain legacy fallback only.
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
  const hasLegacyDbFallback = Boolean(process.env.DB_HOST && process.env.DB_NAME);

  if (!process.env.NODE_ENV) {
    throw new Error('Missing required environment variable: NODE_ENV');
  }

  if (!hasDatabaseUrl && !hasLegacyDbFallback) {
    throw new Error('Missing DATABASE_URL. Legacy fallback requires DB_HOST and DB_NAME.');
  }
}
