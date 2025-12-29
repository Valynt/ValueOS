/**
 * Auth Module Index
 * 
 * Exports all authentication and authorization components
 * including the Agent Identity System (VOS-SEC-001)
 */

// Agent Identity System (VOS-SEC-001)
export {
  AgentRole,
  Permission,
  RiskLevel,
  AgentIdentity,
  AgentTokenClaims,
  CreateAgentIdentityOptions,
  AGENT_PERMISSION_MATRIX,
  HITL_ACTION_REGISTRY,
  createAgentIdentity,
  toTokenClaims,
  fromTokenClaims,
  hasPermission,
  requirePermission,
  requiresHITL,
  validateIdentity,
  PermissionDeniedError,
} from './AgentIdentity';

// Agent Token Service
export {
  AgentTokenService,
  TokenValidationResult,
  TokenRefreshResult,
  agentTokenService,
  createAgentForRole,
  createCoordinatorAgent,
  createTargetAgent,
  createIntegrityAgent,
} from './AgentTokenService';

// Permission Middleware (VOS-SEC-002)
export {
  PermissionMiddleware,
  ActionContext,
  PermissionCheckResult,
  PermissionEvaluationOptions,
  MiddlewareContext,
  PermissionMiddlewareHandler,
  ACTION_PERMISSION_MAP,
  permissionMiddleware,
  requiresPermissions,
  withPermissionScope,
} from './PermissionMiddleware';

// Secure Token Manager (existing)
export {
  SecureTokenManager,
  TokenValidationResult as HumanTokenValidationResult,
  secureTokenManager,
} from './SecureTokenManager';

