"use strict";
/**
 * MCP Common Module
 *
 * Exports unified error handling, response types, and utilities
 * for all MCP servers (Financial, CRM, Integrated)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionPool = exports.ParallelInitializer = exports.mcpRateLimiter = exports.MCPRateLimiter = exports.ConfigurationValidator = exports.ConfigurationManager = exports.getResponseError = exports.getResponseData = exports.isErrorResponse = exports.isSuccessResponse = exports.createErrorResponseFromError = exports.createSuccessResponse = exports.createResponseBuilder = exports.MCPResponseBuilder = exports.createErrorResponse = exports.getErrorMessage = exports.getErrorCode = exports.isMCPError = exports.MCPErrorCodes = exports.MCPErrorFactory = exports.MCPGeneralError = exports.MCPConfigError = exports.MCPCRMError = exports.MCPFinancialError = exports.MCPBaseError = void 0;
// Error handling
var MCPBaseError_1 = require("./errors/MCPBaseError");
Object.defineProperty(exports, "MCPBaseError", { enumerable: true, get: function () { return MCPBaseError_1.MCPBaseError; } });
Object.defineProperty(exports, "MCPFinancialError", { enumerable: true, get: function () { return MCPBaseError_1.MCPFinancialError; } });
Object.defineProperty(exports, "MCPCRMError", { enumerable: true, get: function () { return MCPBaseError_1.MCPCRMError; } });
Object.defineProperty(exports, "MCPConfigError", { enumerable: true, get: function () { return MCPBaseError_1.MCPConfigError; } });
Object.defineProperty(exports, "MCPGeneralError", { enumerable: true, get: function () { return MCPBaseError_1.MCPGeneralError; } });
Object.defineProperty(exports, "MCPErrorFactory", { enumerable: true, get: function () { return MCPBaseError_1.MCPErrorFactory; } });
Object.defineProperty(exports, "MCPErrorCodes", { enumerable: true, get: function () { return MCPBaseError_1.MCPErrorCodes; } });
Object.defineProperty(exports, "isMCPError", { enumerable: true, get: function () { return MCPBaseError_1.isMCPError; } });
Object.defineProperty(exports, "getErrorCode", { enumerable: true, get: function () { return MCPBaseError_1.getErrorCode; } });
Object.defineProperty(exports, "getErrorMessage", { enumerable: true, get: function () { return MCPBaseError_1.getErrorMessage; } });
Object.defineProperty(exports, "createErrorResponse", { enumerable: true, get: function () { return MCPBaseError_1.createErrorResponse; } });
// Response types
var Response_1 = require("./types/Response");
Object.defineProperty(exports, "MCPResponseBuilder", { enumerable: true, get: function () { return Response_1.MCPResponseBuilder; } });
Object.defineProperty(exports, "createResponseBuilder", { enumerable: true, get: function () { return Response_1.createResponseBuilder; } });
Object.defineProperty(exports, "createSuccessResponse", { enumerable: true, get: function () { return Response_1.createSuccessResponse; } });
Object.defineProperty(exports, "createErrorResponseFromError", { enumerable: true, get: function () { return Response_1.createErrorResponseFromError; } });
Object.defineProperty(exports, "isSuccessResponse", { enumerable: true, get: function () { return Response_1.isSuccessResponse; } });
Object.defineProperty(exports, "isErrorResponse", { enumerable: true, get: function () { return Response_1.isErrorResponse; } });
Object.defineProperty(exports, "getResponseData", { enumerable: true, get: function () { return Response_1.getResponseData; } });
Object.defineProperty(exports, "getResponseError", { enumerable: true, get: function () { return Response_1.getResponseError; } });
// Configuration management
var ConfigurationManager_1 = require("./config/ConfigurationManager");
Object.defineProperty(exports, "ConfigurationManager", { enumerable: true, get: function () { return ConfigurationManager_1.ConfigurationManager; } });
Object.defineProperty(exports, "ConfigurationValidator", { enumerable: true, get: function () { return ConfigurationManager_1.ConfigurationValidator; } });
// Rate limiting
var MCPRateLimiter_1 = require("./rate-limiting/MCPRateLimiter");
Object.defineProperty(exports, "MCPRateLimiter", { enumerable: true, get: function () { return MCPRateLimiter_1.MCPRateLimiter; } });
Object.defineProperty(exports, "mcpRateLimiter", { enumerable: true, get: function () { return MCPRateLimiter_1.mcpRateLimiter; } });
// Performance optimization
var ParallelInitializer_1 = require("./performance/ParallelInitializer");
Object.defineProperty(exports, "ParallelInitializer", { enumerable: true, get: function () { return ParallelInitializer_1.ParallelInitializer; } });
// Connection Pool (separate export)
var ParallelInitializer_2 = require("./performance/ParallelInitializer");
Object.defineProperty(exports, "ConnectionPool", { enumerable: true, get: function () { return ParallelInitializer_2.ConnectionPool; } });
//# sourceMappingURL=index.js.map