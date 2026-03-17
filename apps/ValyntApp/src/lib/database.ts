/**
 * Database connection utilities.
 * Stub module — actual implementation depends on deployment environment.
 */

export interface DatabaseConnectionResult {
  connected: boolean;
  latency: number;
  error?: string;
}

export async function checkDatabaseConnection(
  _retries = 3,
  _retryDelayMs = 500
): Promise<DatabaseConnectionResult> {
  return { connected: false, latency: 0, error: "No database configured in this environment" };
}

export async function isDatabaseHealthy(): Promise<boolean> {
  return false;
}
