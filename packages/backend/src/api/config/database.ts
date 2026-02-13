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
 * 2) Legacy DB_* atomics fallback only when DATABASE_URL is not provided.
 */
export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL
    || `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || ''}@${process.env.DB_HOST || 'localhost'}:${parseInt(process.env.DB_PORT || '5432')}/${process.env.DB_NAME || 'valuecanvas'}`;
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

const parsedFromUrl = process.env.DATABASE_URL ? parseDatabaseConfigFromUrl(process.env.DATABASE_URL) : null;

export const databaseConfig: DatabaseConfig = parsedFromUrl || {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'valuecanvas',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
};
