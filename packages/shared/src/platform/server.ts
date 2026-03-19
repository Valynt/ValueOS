/**
 * Server-only shared platform entrypoint.
 *
 * Import backend/runtime config and telemetry helpers here so the dependency
 * boundary policy can block accidental browser usage.
 */

export type { ServerConfig } from "../config/server-config.js";
export {
  getDatabaseConfig,
  getServerBillingConfig,
  getServerConfig,
  getServerSupabaseConfig,
  getServerWebhookConfig,
  serverConfig,
} from "../config/server-config.js";
export { getTraceContextForLogging } from "../config/telemetry.js";
