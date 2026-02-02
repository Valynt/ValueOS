/**
 * Database connection utilities for ValueOS
 * Handles environment-specific database host and port detection
 */

/**
 * Get database host deterministically based on environment
 * - Local Supabase CLI: localhost
 * - Docker: db (internal service name)
 * - Production: environment variable
 */
export function get_db_host(): string {
  // Check if running in Docker environment
  if (process.env.DOCKER_CONTAINER === "true" || process.env.COMPOSE_PROJECT_NAME) {
    return process.env.DB_HOST || "db";
  }

  // Supabase CLI local development
  if (process.env.SUPABASE_LOCAL === "true") {
    return "localhost";
  }

  // Production or explicit host
  return process.env.DB_HOST || "localhost";
}

/**
 * Get database port deterministically
 */
export function get_db_port(): number {
  if (process.env.SUPABASE_LOCAL === "true") {
    return 54322; // From supabase/config.toml
  }

  return parseInt(process.env.DB_PORT || "5432", 10);
}

/**
 * Get full database URL for direct connections
 */
export function get_database_url(): string {
  const host = get_db_host();
  const port = get_db_port();
  const user = process.env.DB_USER || "postgres";
  const password = process.env.DB_PASSWORD || "postgres";
  const database = process.env.DB_NAME || "postgres";

  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}
