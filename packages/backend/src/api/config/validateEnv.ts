// packages/backend/src/api/config/validateEnv.ts
export function validateEnv(): void {
  const required = ['NODE_ENV', 'DB_HOST', 'DB_NAME'];
  for (const env of required) {
    if (!process.env[env]) {
      throw new Error(`Missing required environment variable: ${env}`);
    }
  }
}