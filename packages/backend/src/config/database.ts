/**
 * Database Configuration - Re-export from shared
 */

import { getDatabaseConfig } from "@shared/platform/server";

export { getDatabaseConfig };

export function getDatabaseUrl(): string {
  const config = getDatabaseConfig();
  return config.url;
}
