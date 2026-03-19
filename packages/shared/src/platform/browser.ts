/**
 * Browser-safe shared platform entrypoint.
 *
 * Use this entrypoint from browser bundles instead of importing mixed-runtime
 * shared config helpers directly.
 */

export type { ClientConfig } from "../config/client-config.js";
export {
  clientConfig,
  getClientApiConfig,
  getClientConfig,
  getClientSupabaseConfig,
  isClientProduction,
} from "../config/client-config.js";
export {
  getEnvironment,
  isDevelopment,
  isProduction,
  isTest,
} from "../config/environment.js";
export { getTraceContextForLogging } from "../config/telemetry.js";
