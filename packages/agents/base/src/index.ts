/**
 * @valueos/agent-base
 *
 * Shared base utilities and runtime for ValueOS agents
 */

// Logger
export { logger, type Logger, type LogContext } from "./logger.js";

// Metrics
export { metrics, createCustomMetric, getMetricsRegistry } from "./metrics.js";

// Health checks
export {
  HealthChecker,
  defaultHealthChecks,
  healthMiddleware,
  type HealthStatus,
  type HealthCheckResult,
  type HealthCheck,
} from "./health.js";

// Configuration
export { loadConfig, getConfig, isProduction, isDevelopment, type AgentConfig } from "./config.js";

// Server
export { createServer, startServer, type ServerOptions } from "./server.js";
