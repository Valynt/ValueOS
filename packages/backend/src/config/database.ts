/**
 * Database Configuration - Re-export from shared
 */

// eslint-disable-next-line no-restricted-imports -- required for this module
import { getDatabaseConfig } from "../../../shared/src/config/server-config";

export { getDatabaseConfig };

export function getDatabaseUrl(): string {
  const config = getDatabaseConfig();
  return config.url;
}
