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
