/**
 * MCP Common Module
 *
 * Exports unified error handling, response types, and utilities
 * for all MCP servers (Financial, CRM, Integrated)
 */

// Error handling
export {
  MCPBaseError,
  MCPFinancialError,
  MCPCRMError,
  MCPConfigError,
  MCPGeneralError,
  MCPErrorFactory,
  MCPErrorCodes,
  type MCPErrorCode,
  type MCPErrorMetadata,
  type MCPErrorDetails,
  isMCPError,
  getErrorCode,
  getErrorMessage,
  createErrorResponse,
} from "./errors/MCPBaseError";

// Response types
export {
  MCPResponseBuilder,
  createResponseBuilder,
  createSuccessResponse,
  createErrorResponseFromError,
  isSuccessResponse,
  isErrorResponse,
  getResponseData,
  getResponseError,
  type MCPBaseResponse,
  type MCPSuccessResponse,
  type MCPErrorResponse,
  type MCPToolResponse,
  type MCPFinancialToolResponse,
  type MCPCRMToolResponse,
  type MCPResponseMetadata,
} from "./types/Response";

// Configuration management
export {
  ConfigurationManager,
  ConfigurationValidator,
  type MCPBaseConfig,
  type MCPCRMServerConfig,
  type MCPFinancialServerConfig,
  type MCPIntegratedServerConfig,
  type CRMProviderConfig,
  type FinancialModuleConfig,
  type MCPServerConfig,
} from "./config/ConfigurationManager";

// Rate limiting
export {
  MCPRateLimiter,
  mcpRateLimiter,
  type MCPRateLimitConfig,
  type MCPRateLimitResult,
  type MCPRateLimitState,
} from "./rate-limiting/MCPRateLimiter";

// Performance optimization
export {
  ParallelInitializer,
  type InitializationTask,
  type InitializationResult,
  type ParallelInitConfig,
} from "./performance/ParallelInitializer";

// Connection Pool (separate export)
export { ConnectionPool } from "./performance/ParallelInitializer";
