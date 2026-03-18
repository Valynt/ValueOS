/**
 * Database Configuration - Re-export from shared
 */

 
import { getDatabaseConfig } from "../../../shared/src/config/server-config";

export { getDatabaseConfig };

export function getDatabaseUrl(): string {
  const config = getDatabaseConfig();
  return config.url;
}
