// packages/backend/src/api/config/database.ts
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

/**
 * Database env precedence:
 * 1) DATABASE_URL (canonical)
 * 2) Legacy DB_URL fallback only when DATABASE_URL is not provided.
 */
export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL
    || process.env.DB_URL
    || "postgresql://postgres:@localhost:5432/valuecanvas";
}

function parseDatabaseConfigFromUrl(url: string): DatabaseConfig | null {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: Number(parsed.port || '5432'),
      database: parsed.pathname.replace(/^\//, ''),
      user: decodeURIComponent(parsed.username || 'postgres'),
      password: decodeURIComponent(parsed.password || ''),
    };
  } catch {
    return null;
  }
}

const canonicalDatabaseUrl = process.env.DATABASE_URL || process.env.DB_URL;
const parsedFromUrl = canonicalDatabaseUrl ? parseDatabaseConfigFromUrl(canonicalDatabaseUrl) : null;

export const databaseConfig: DatabaseConfig = parsedFromUrl || {
  host: "localhost",
  port: 5432,
  database: "valuecanvas",
  user: "postgres",
  password: "",
};
