/**
 * Agent Identity System (VOS-SEC-001)
 *
 * OIDC-compatible identity system for non-human actors (agents)
 * Enables proper RBAC and SOC 2 compliant audit trailing.
 *
 * @see /docs/PHASE4_PLUS_ENTERPRISE_TICKETS.md - VOS-SEC-001
 * @author Enterprise Agentic Architect
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../logger';

const logger = createLogger({ component: 'AgentIdentity' });

// ============================================================================
// Core Types
// ============================================================================

/**
 * Enumeration of all agent roles in the ValueOS 7-Agent Taxonomy
 * Maps to the Agent Fabric architecture
 */
export enum AgentRole {
  COORDINATOR = 'CoordinatorAgent',
  OPPORTUNITY = 'OpportunityAgent',
  TARGET = 'TargetAgent',
  REALIZATION = 'RealizationAgent',
  EXPANSION = 'ExpansionAgent',
  INTEGRITY = 'IntegrityAgent',
  COMMUNICATOR = 'CommunicatorAgent',
  // Extended agents
  BENCHMARK = 'BenchmarkAgent',
  NARRATIVE = 'NarrativeAgent',
  ADVERSARIAL = 'AdversarialReasoningAgent',
  FINANCIAL_MODELING = 'FinancialModelingAgent',
  COMPANY_INTELLIGENCE = 'CompanyIntelligenceAgent',
  VALUE_MAPPING = 'ValueMappingAgent',
  RESEARCH = 'ResearchAgent',
  // System agents
  SYSTEM = 'SystemAgent',
}

/**
 * Permission scopes for agent actions
 * Follows deny-by-default principle
 */
export type Permission =
  // Read permissions
  | 'read:customers'
  | 'read:benchmarks'
  | 'read:vmrt'
  | 'read:workflows'
  | 'read:audit'
  // Write permissions
  | 'write:vmrt'
  | 'write:crm'
  | 'write:workflows'
  | 'write:audit'
  // Execute permissions
  | 'execute:workflow'
  | 'execute:external_api'
  | 'execute:llm'
  // Admin permissions
  | 'admin:system'
  | 'admin:agents'
  | 'admin:security';

/**
 * Risk levels for agent actions requiring HITL
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Agent Identity - OIDC-compatible structure for non-human actors
 */
export interface AgentIdentity {
  /** Unique agent identifier, format: agent:{role}:{instance_id} */
  id: string;
  /** Actor type - always 'agent' for non-human actors */
  type: 'agent';
  /** Agent role from the 7-Agent Taxonomy */
  role: AgentRole;
  /** Human-readable agent name */
  name: string;
  /** Version of the agent */
  version: string;
  /** Lifecycle stage the agent operates in */
  lifecycleStage: string;
  /** Granted permission scopes */
  permissions: Permission[];
  /** Organization ID (tenant) the agent belongs to */
  organizationId: string;
  /** Human session that spawned this agent (if applicable) */
  parentSessionId?: string;
  /** Human user that initiated the agent (if applicable) */
  initiatingUserId?: string;
  /** JWT-style timestamps */
  issuedAt: string;
  expiresAt: string;
  /** Immutable trace ID for audit correlation */
  auditToken: string;
  /** Additional metadata */
  metadata: Record<string, unknown>;
  /** Cryptographic keys for secure messaging */
  keys?: {
    /** Public key for signature verification (base64 encoded) */
    publicKey?: string;
    /** Private key for signing (base64 encoded) - should be kept secure */
    privateKey?: string;
    /** Encryption key for AES-256-GCM (base64 encoded) */
    encryptionKey?: string;
  };
}

/**
 * JWT Claims structure for agent tokens
 * Compatible with OIDC standards
 */
export interface AgentTokenClaims {
  /** Subject - agent ID */
  sub: string;
  /** Issuer */
  iss: string;
  /** Audience */
  aud: string;
  /** Permission scopes */
  scope: Permission[];
  /** Organization ID */
  org_id: string;
  /** Agent role */
  agent_role: AgentRole;
  /** Agent type qualifier */
  agent_type: string;
  /** Trace ID for audit */
  trace_id: string;
  /** Parent session */
  parent_session?: string;
  /** Initiating user */
  initiating_user?: string;
  /** Issued at timestamp */
  iat: number;
  /** Expiration timestamp */
  exp: number;
  /** Not before timestamp */
  nbf?: number;
  /** JWT ID */
  jti: string;
}

/**
 * Agent Identity creation options
 */
export interface CreateAgentIdentityOptions {
  role: AgentRole;
  name?: string;
  version?: string;
  lifecycleStage?: string;
  organizationId: string;
  parentSessionId?: string;
  initiatingUserId?: string;
  permissions?: Permission[];
  expirationSeconds?: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Permission Matrix
// ============================================================================

/**
 * Default permission matrix for the 7-Agent Taxonomy
 * Implements deny-by-default with explicit grants
 *
 * @see VOS-SEC-002 for full matrix specification
 */
export const AGENT_PERMISSION_MATRIX: Record<AgentRole, Permission[]> = {
  [AgentRole.COORDINATOR]: [
    'read:customers',
    'read:benchmarks',
    'read:workflows',
    'execute:workflow',
    'execute:llm',
  ],
  [AgentRole.OPPORTUNITY]: [
    'read:customers',
    'read:benchmarks',
    'execute:llm',
  ],
  [AgentRole.TARGET]: [
    'read:customers',
    'read:benchmarks',
    'write:vmrt',
    'execute:llm',
  ],
  [AgentRole.REALIZATION]: [
    'read:customers',
    'read:benchmarks',
    'read:vmrt',
    'write:vmrt',
    'write:crm',
    'execute:llm',
  ],
  [AgentRole.EXPANSION]: [
    'read:customers',
    'read:benchmarks',
    'read:vmrt',
    'execute:llm',
  ],
  [AgentRole.INTEGRITY]: [
    'read:customers',
    'read:benchmarks',
    'read:vmrt',
    'read:workflows',
    'read:audit',
    'write:vmrt',
    'write:audit',
    'admin:system',
    'execute:llm',
  ],
  [AgentRole.COMMUNICATOR]: [
    'read:customers',
    'read:benchmarks',
    'read:vmrt',
    'execute:llm',
  ],
  // Extended agents inherit base permissions
  [AgentRole.BENCHMARK]: [
    'read:benchmarks',
    'execute:llm',
  ],
  [AgentRole.NARRATIVE]: [
    'read:customers',
    'read:benchmarks',
    'read:vmrt',
    'execute:llm',
  ],
  [AgentRole.ADVERSARIAL]: [
    'read:customers',
    'read:benchmarks',
    'read:vmrt',
    'execute:llm',
  ],
  [AgentRole.FINANCIAL_MODELING]: [
    'read:customers',
    'read:benchmarks',
    'write:vmrt',
    'execute:llm',
  ],
  [AgentRole.COMPANY_INTELLIGENCE]: [
    'read:customers',
    'execute:external_api',
    'execute:llm',
  ],
  [AgentRole.VALUE_MAPPING]: [
    'read:customers',
    'read:benchmarks',
    'execute:llm',
  ],
  [AgentRole.RESEARCH]: [
    'read:customers',
    'read:benchmarks',
    'execute:external_api',
    'execute:llm',
  ],
  [AgentRole.SYSTEM]: [
    'read:customers',
    'read:benchmarks',
    'read:vmrt',
    'read:workflows',
    'read:audit',
    'write:vmrt',
    'write:workflows',
    'write:audit',
    'execute:workflow',
    'execute:llm',
    'admin:system',
    'admin:agents',
  ],
};

/**
 * Actions requiring Human-in-the-Loop approval
 * Maps action types to their risk levels and required approvers
 */
export const HITL_ACTION_REGISTRY: Record<string, {
  riskLevel: RiskLevel;
  requiredApprovers: number;
  approverRoles: string[];
  timeoutSeconds: number;
  autoApproveConditions?: Record<string, unknown>;
}> = {
  'crm:sync_contacts': {
    riskLevel: 'medium',
    requiredApprovers: 1,
    approverRoles: ['admin', 'sales_manager'],
    timeoutSeconds: 3600,
    autoApproveConditions: { maxRecords: 50 },
  },
  'crm:bulk_update': {
    riskLevel: 'high',
    requiredApprovers: 1,
    approverRoles: ['admin', 'sales_director'],
    timeoutSeconds: 7200,
  },
  'workflow:execute': {
    riskLevel: 'high',
    requiredApprovers: 1,
    approverRoles: ['admin', 'workflow_manager'],
    timeoutSeconds: 7200,
  },
  'data:bulk_delete': {
    riskLevel: 'critical',
    requiredApprovers: 2,
    approverRoles: ['super_admin'],
    timeoutSeconds: 86400,
  },
  'external:api_call': {
    riskLevel: 'medium',
    requiredApprovers: 1,
    approverRoles: ['admin', 'integration_manager'],
    timeoutSeconds: 1800,
  },
  'admin:config_change': {
    riskLevel: 'critical',
    requiredApprovers: 2,
    approverRoles: ['super_admin', 'cto'],
    timeoutSeconds: 86400,
  },
};

// ============================================================================
// Agent Identity Factory
// ============================================================================

/**
 * Default token expiration: 1 hour
 */
const DEFAULT_TOKEN_EXPIRATION_SECONDS = 3600;

/**
 * Create a new Agent Identity
 *
 * @param options - Configuration for the new agent identity
 * @returns A fully constructed AgentIdentity object
 */
export function createAgentIdentity(options: CreateAgentIdentityOptions): AgentIdentity {
  const now = new Date();
  const expirationSeconds = options.expirationSeconds ?? DEFAULT_TOKEN_EXPIRATION_SECONDS;
  const expiresAt = new Date(now.getTime() + expirationSeconds * 1000);

  // Get default permissions for the role
  const rolePermissions = AGENT_PERMISSION_MATRIX[options.role] || [];

  // Merge with any additional permissions (if explicitly granted)
  const permissions = options.permissions
    ? [...new Set([...rolePermissions, ...options.permissions])]
    : rolePermissions;

  const identity: AgentIdentity = {
    id: `agent:${options.role.toLowerCase()}:${uuidv4().slice(0, 8)}`,
    type: 'agent',
    role: options.role,
    name: options.name || options.role,
    version: options.version || '1.0.0',
    lifecycleStage: options.lifecycleStage || mapRoleToLifecycleStage(options.role),
    permissions,
    organizationId: options.organizationId,
    parentSessionId: options.parentSessionId,
    initiatingUserId: options.initiatingUserId,
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    auditToken: `audit:${uuidv4()}`,
    metadata: options.metadata || {},
  };

  logger.info('Agent identity created', {
    agentId: identity.id,
    role: identity.role,
    organizationId: identity.organizationId,
    permissions: identity.permissions.length,
    expiresAt: identity.expiresAt,
  });

  return identity;
}

/**
 * Map agent role to lifecycle stage
 */
function mapRoleToLifecycleStage(role: AgentRole): string {
  const stageMap: Record<AgentRole, string> = {
    [AgentRole.COORDINATOR]: 'orchestration',
    [AgentRole.OPPORTUNITY]: 'discovery',
    [AgentRole.TARGET]: 'definition',
    [AgentRole.REALIZATION]: 'realization',
    [AgentRole.EXPANSION]: 'expansion',
    [AgentRole.INTEGRITY]: 'governance',
    [AgentRole.COMMUNICATOR]: 'interface',
    [AgentRole.BENCHMARK]: 'discovery',
    [AgentRole.NARRATIVE]: 'interface',
    [AgentRole.ADVERSARIAL]: 'governance',
    [AgentRole.FINANCIAL_MODELING]: 'definition',
    [AgentRole.COMPANY_INTELLIGENCE]: 'discovery',
    [AgentRole.VALUE_MAPPING]: 'discovery',
    [AgentRole.RESEARCH]: 'discovery',
    [AgentRole.SYSTEM]: 'system',
  };
  return stageMap[role] || 'unknown';
}

/**
 * Convert AgentIdentity to JWT claims
 */
export function toTokenClaims(identity: AgentIdentity): AgentTokenClaims {
  return {
    sub: identity.id,
    iss: 'valueos-auth',
    aud: 'valueos-api',
    scope: identity.permissions,
    org_id: identity.organizationId,
    agent_role: identity.role,
    agent_type: identity.lifecycleStage,
    trace_id: identity.auditToken,
    parent_session: identity.parentSessionId,
    initiating_user: identity.initiatingUserId,
    iat: Math.floor(new Date(identity.issuedAt).getTime() / 1000),
    exp: Math.floor(new Date(identity.expiresAt).getTime() / 1000),
    jti: identity.auditToken,
  };
}

/**
 * Reconstruct AgentIdentity from JWT claims
 */
export function fromTokenClaims(claims: AgentTokenClaims): AgentIdentity {
  return {
    id: claims.sub,
    type: 'agent',
    role: claims.agent_role,
    name: claims.agent_type,
    version: '1.0.0',
    lifecycleStage: claims.agent_type,
    permissions: claims.scope,
    organizationId: claims.org_id,
    parentSessionId: claims.parent_session,
    initiatingUserId: claims.initiating_user,
    issuedAt: new Date(claims.iat * 1000).toISOString(),
    expiresAt: new Date(claims.exp * 1000).toISOString(),
    auditToken: claims.trace_id,
    metadata: {},
  };
}

// ============================================================================
// Permission Validation
// ============================================================================

/**
 * Custom error for permission denials
 */
export class PermissionDeniedError extends Error {
  constructor(
    public readonly agentId: string,
    public readonly action: Permission,
    public readonly context?: Record<string, unknown>
  ) {
    super(`Permission denied: Agent ${agentId} cannot perform action '${action}'`);
    this.name = 'PermissionDeniedError';
  }
}

/**
 * Check if an agent has a specific permission
 * Implements deny-by-default
 *
 * @param identity - The agent identity to check
 * @param action - The permission to verify
 * @returns true if the agent has the permission
 */
export function hasPermission(identity: AgentIdentity, action: Permission): boolean {
  // Check expiration
  const now = new Date();
  const expiresAt = new Date(identity.expiresAt);
  if (now > expiresAt) {
    logger.warn('Agent identity expired', {
      agentId: identity.id,
      expiresAt: identity.expiresAt,
    });
    return false;
  }

  // Check if permission is explicitly granted
  const hasIt = identity.permissions.includes(action);

  if (!hasIt) {
    logger.debug('Permission check failed', {
      agentId: identity.id,
      action,
      grantedPermissions: identity.permissions,
    });
  }

  return hasIt;
}

/**
 * Require a permission, throwing if not granted
 *
 * @param identity - The agent identity to check
 * @param action - The permission to require
 * @throws PermissionDeniedError if permission is not granted
 */
export function requirePermission(identity: AgentIdentity, action: Permission): void {
  if (!hasPermission(identity, action)) {
    logger.error('Permission denied', {
      agentId: identity.id,
      action,
      auditToken: identity.auditToken,
    });
    throw new PermissionDeniedError(identity.id, action, {
      auditToken: identity.auditToken,
      organizationId: identity.organizationId,
    });
  }
}

/**
 * Check if an action requires Human-in-the-Loop approval
 *
 * @param actionType - The action type to check
 * @returns HITL gate configuration if required, undefined otherwise
 */
export function requiresHITL(actionType: string): typeof HITL_ACTION_REGISTRY[string] | undefined {
  return HITL_ACTION_REGISTRY[actionType];
}

/**
 * Validate an agent identity
 *
 * @param identity - The identity to validate
 * @returns Validation result with any errors
 */
export function validateIdentity(identity: AgentIdentity): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check required fields
  if (!identity.id) errors.push('Missing agent ID');
  if (!identity.role) errors.push('Missing agent role');
  if (!identity.organizationId) errors.push('Missing organization ID');
  if (!identity.auditToken) errors.push('Missing audit token');

  // Check ID format
  if (identity.id && !identity.id.startsWith('agent:')) {
    errors.push('Agent ID must start with "agent:"');
  }

  // Check expiration
  const now = new Date();
  const expiresAt = new Date(identity.expiresAt);
  if (isNaN(expiresAt.getTime())) {
    errors.push('Invalid expiration timestamp');
  } else if (expiresAt <= now) {
    errors.push('Agent identity has expired');
  }

  // Check permissions against role matrix
  const allowedPermissions = AGENT_PERMISSION_MATRIX[identity.role] || [];
  const invalidPermissions = identity.permissions.filter(
    p => !allowedPermissions.includes(p)
  );
  if (invalidPermissions.length > 0) {
    errors.push(`Invalid permissions for role ${identity.role}: ${invalidPermissions.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Exports
// ============================================================================

export default {
  AgentRole,
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
};
