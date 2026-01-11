/**
 * Permission Scope Matrix Middleware (VOS-SEC-002)
 * 
 * Implements permission validation middleware for agent actions.
 * Integrates with BaseAgent to enforce deny-by-default RBAC.
 * 
 * @see /docs/PHASE4_PLUS_ENTERPRISE_TICKETS.md - VOS-SEC-002
 * @author Enterprise Agentic Architect
 * @version 1.0.0
 */

import { createLogger } from '../logger';
import {
  AgentIdentity,
  AgentRole,
  Permission,
  hasPermission,
  requirePermission,
  requiresHITL,
  PermissionDeniedError,
  AGENT_PERMISSION_MATRIX,
} from './AgentIdentity';

const logger = createLogger({ component: 'PermissionMiddleware' });

// ============================================================================
// Types
// ============================================================================

/**
 * Action context for permission evaluation
 */
export interface ActionContext {
  /** The action being performed */
  action: string;
  /** Resource being accessed */
  resource?: string;
  /** Resource ID if applicable */
  resourceId?: string;
  /** Additional context data */
  data?: Record<string, unknown>;
  /** Request metadata */
  metadata?: {
    ip?: string;
    userAgent?: string;
    sessionId?: string;
    traceId?: string;
  };
}

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  requiredPermissions: Permission[];
  grantedPermissions: Permission[];
  missingPermissions: Permission[];
  requiresHITL: boolean;
  hitlConfig?: {
    riskLevel: string;
    requiredApprovers: number;
    timeoutSeconds: number;
  };
}

/**
 * Permission evaluation options
 */
export interface PermissionEvaluationOptions {
  /** Whether to throw on permission denied */
  throwOnDenied?: boolean;
  /** Whether to check HITL requirements */
  checkHITL?: boolean;
  /** Custom permission overrides for testing */
  permissionOverrides?: Permission[];
}

/**
 * Middleware execution context
 */
export interface MiddlewareContext {
  identity: AgentIdentity;
  action: ActionContext;
  timestamp: Date;
  evaluationId: string;
}

/**
 * Middleware handler function type
 */
export type PermissionMiddlewareHandler = (
  context: MiddlewareContext,
  next: () => Promise<void>
) => Promise<void>;

// ============================================================================
// Action to Permission Mapping
// ============================================================================

/**
 * Maps action types to required permissions
 * Supports wildcards for resource-based actions
 */
export const ACTION_PERMISSION_MAP: Record<string, Permission[]> = {
  // Read actions
  'read:customer': ['read:customers'],
  'read:customers': ['read:customers'],
  'read:benchmark': ['read:benchmarks'],
  'read:benchmarks': ['read:benchmarks'],
  'read:vmrt': ['read:vmrt'],
  'read:workflow': ['read:workflows'],
  'read:workflows': ['read:workflows'],
  'read:audit': ['read:audit'],
  
  // Write actions
  'write:vmrt': ['write:vmrt'],
  'create:vmrt': ['write:vmrt'],
  'update:vmrt': ['write:vmrt'],
  'delete:vmrt': ['write:vmrt', 'admin:system'],
  'write:crm': ['write:crm'],
  'sync:crm': ['write:crm'],
  'write:workflow': ['write:workflows'],
  'create:workflow': ['write:workflows'],
  'write:audit': ['write:audit'],
  
  // Execute actions
  'execute:workflow': ['execute:workflow'],
  'run:workflow': ['execute:workflow'],
  'execute:llm': ['execute:llm'],
  'invoke:llm': ['execute:llm'],
  'execute:external_api': ['execute:external_api'],
  'call:external_api': ['execute:external_api'],
  
  // Admin actions
  'admin:system': ['admin:system'],
  'config:system': ['admin:system'],
  'admin:agents': ['admin:agents'],
  'manage:agents': ['admin:agents'],
  'admin:security': ['admin:security'],
  'manage:security': ['admin:security'],
  
  // CRM-specific actions
  'crm:sync_contacts': ['write:crm'],
  'crm:bulk_update': ['write:crm', 'admin:system'],
  'crm:get_deal_context': ['read:customers'],
  'crm:sync_metrics': ['write:crm'],
  
  // Workflow-specific actions
  'workflow:execute': ['execute:workflow'],
  'workflow:create': ['write:workflows'],
  'workflow:delete': ['write:workflows', 'admin:system'],
  
  // Data actions
  'data:bulk_delete': ['admin:system', 'admin:security'],
  'data:export': ['read:customers', 'read:vmrt'],
  
  // External API actions
  'external:api_call': ['execute:external_api'],
};

// ============================================================================
// Permission Middleware Class
// ============================================================================

/**
 * Permission Middleware Service
 * Evaluates and enforces permissions for agent actions
 */
export class PermissionMiddleware {
  private static instance: PermissionMiddleware;
  
  /** Custom middleware handlers */
  private handlers: PermissionMiddlewareHandler[] = [];
  
  /** Evaluation cache (short TTL) */
  private evaluationCache: Map<string, { result: PermissionCheckResult; expiresAt: Date }> = new Map();
  
  /** Cache TTL in milliseconds */
  private readonly CACHE_TTL_MS = 5000;
  
  private constructor() {}
  
  /**
   * Get singleton instance
   */
  static getInstance(): PermissionMiddleware {
    if (!PermissionMiddleware.instance) {
      PermissionMiddleware.instance = new PermissionMiddleware();
    }
    return PermissionMiddleware.instance;
  }
  
  /**
   * Evaluate permissions for an action
   * 
   * @param identity - The agent identity
   * @param action - The action context
   * @param options - Evaluation options
   * @returns Permission check result
   */
  evaluate(
    identity: AgentIdentity,
    action: ActionContext,
    options: PermissionEvaluationOptions = {}
  ): PermissionCheckResult {
    const evaluationId = `${identity.id}:${action.action}:${Date.now()}`;
    
    // Check cache
    const cacheKey = `${identity.id}:${action.action}`;
    const cached = this.evaluationCache.get(cacheKey);
    if (cached && cached.expiresAt > new Date()) {
      logger.debug('Permission evaluation cache hit', { 
        agentId: identity.id, 
        action: action.action 
      });
      return cached.result;
    }
    
    // Get required permissions for the action
    const requiredPermissions = this.getRequiredPermissions(action.action);
    
    // Get agent's granted permissions
    const grantedPermissions = options.permissionOverrides || identity.permissions;
    
    // Check for missing permissions
    const missingPermissions = requiredPermissions.filter(
      perm => !grantedPermissions.includes(perm)
    );
    
    // Check if action requires HITL
    const hitlConfig = options.checkHITL !== false ? requiresHITL(action.action) : undefined;
    
    const allowed = missingPermissions.length === 0;
    
    const result: PermissionCheckResult = {
      allowed,
      reason: allowed 
        ? undefined 
        : `Missing permissions: ${missingPermissions.join(', ')}`,
      requiredPermissions,
      grantedPermissions: grantedPermissions as Permission[],
      missingPermissions,
      requiresHITL: !!hitlConfig,
      hitlConfig: hitlConfig ? {
        riskLevel: hitlConfig.riskLevel,
        requiredApprovers: hitlConfig.requiredApprovers,
        timeoutSeconds: hitlConfig.timeoutSeconds,
      } : undefined,
    };
    
    // Cache the result
    this.evaluationCache.set(cacheKey, {
      result,
      expiresAt: new Date(Date.now() + this.CACHE_TTL_MS),
    });
    
    // Log the evaluation
    logger.debug('Permission evaluation', {
      evaluationId,
      agentId: identity.id,
      action: action.action,
      allowed,
      requiredPermissions,
      missingPermissions,
      requiresHITL: result.requiresHITL,
    });
    
    // Throw if configured and not allowed
    if (!allowed && options.throwOnDenied) {
      throw new PermissionDeniedError(
        identity.id,
        requiredPermissions[0], // Primary permission
        { action: action.action, missingPermissions }
      );
    }
    
    return result;
  }
  
  /**
   * Enforce permissions - throws if not allowed
   * 
   * @param identity - The agent identity
   * @param action - The action context
   */
  enforce(identity: AgentIdentity, action: ActionContext): void {
    const result = this.evaluate(identity, action, { throwOnDenied: true });
    
    if (result.requiresHITL) {
      logger.warn('Action requires HITL approval', {
        agentId: identity.id,
        action: action.action,
        hitlConfig: result.hitlConfig,
      });
      // Note: HITL approval should be handled by the HITL framework
      // This middleware only evaluates permissions
    }
  }
  
  /**
   * Check if an agent can perform an action
   * 
   * @param identity - The agent identity
   * @param action - The action string
   * @returns true if allowed
   */
  canPerform(identity: AgentIdentity, action: string): boolean {
    const result = this.evaluate(identity, { action });
    return result.allowed;
  }
  
  /**
   * Get required permissions for an action
   * 
   * @param action - The action string
   * @returns Array of required permissions
   */
  getRequiredPermissions(action: string): Permission[] {
    // Direct mapping
    if (ACTION_PERMISSION_MAP[action]) {
      return ACTION_PERMISSION_MAP[action];
    }
    
    // Try prefix matching (e.g., "read:*" actions)
    const [verb, resource] = action.split(':');
    const wildcardKey = `${verb}:*`;
    if (ACTION_PERMISSION_MAP[wildcardKey]) {
      return ACTION_PERMISSION_MAP[wildcardKey];
    }
    
    // Infer from action structure
    if (verb === 'read') {
      return [`read:${resource}` as Permission];
    }
    if (verb === 'write' || verb === 'create' || verb === 'update') {
      return [`write:${resource}` as Permission];
    }
    if (verb === 'execute' || verb === 'run') {
      return [`execute:${resource}` as Permission];
    }
    if (verb === 'admin' || verb === 'manage') {
      return [`admin:${resource}` as Permission];
    }
    
    // Default: require admin for unknown actions (deny-by-default)
    logger.warn('Unknown action, requiring admin permission', { action });
    return ['admin:system'];
  }
  
  /**
   * Register a custom middleware handler
   * 
   * @param handler - The middleware handler function
   */
  use(handler: PermissionMiddlewareHandler): void {
    this.handlers.push(handler);
  }
  
  /**
   * Execute middleware chain
   * 
   * @param identity - The agent identity
   * @param action - The action context
   */
  async executeMiddleware(
    identity: AgentIdentity,
    action: ActionContext
  ): Promise<void> {
    const context: MiddlewareContext = {
      identity,
      action,
      timestamp: new Date(),
      evaluationId: `eval:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    };
    
    let index = 0;
    
    const next = async (): Promise<void> => {
      if (index < this.handlers.length) {
        const handler = this.handlers[index++];
        await handler(context, next);
      }
    };
    
    await next();
  }
  
  /**
   * Clear the evaluation cache
   */
  clearCache(): void {
    this.evaluationCache.clear();
  }
  
  /**
   * Get permission matrix for a role
   * 
   * @param role - The agent role
   * @returns Array of permissions
   */
  getPermissionsForRole(role: AgentRole): Permission[] {
    return AGENT_PERMISSION_MATRIX[role] || [];
  }
  
  /**
   * Validate that an identity has valid permissions for its role
   * 
   * @param identity - The agent identity
   * @returns Validation result
   */
  validateRolePermissions(identity: AgentIdentity): {
    valid: boolean;
    invalidPermissions: Permission[];
    message?: string;
  } {
    const allowedPermissions = this.getPermissionsForRole(identity.role);
    const invalidPermissions = identity.permissions.filter(
      perm => !allowedPermissions.includes(perm)
    );
    
    return {
      valid: invalidPermissions.length === 0,
      invalidPermissions,
      message: invalidPermissions.length > 0
        ? `Role ${identity.role} cannot have permissions: ${invalidPermissions.join(', ')}`
        : undefined,
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a permission check decorator for methods
 * 
 * @param requiredPermissions - Permissions required to execute the method
 * @returns Method decorator
 */
export function requiresPermissions(...requiredPermissions: Permission[]) {
  return function(
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(this: any, ...args: any[]) {
      const identity = this.identity || this.agentIdentity;
      if (!identity) {
        throw new Error('No agent identity found for permission check');
      }
      
      for (const permission of requiredPermissions) {
        requirePermission(identity, permission);
      }
      
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}

/**
 * Create a permission-scoped execution context
 * 
 * @param identity - The agent identity
 * @param action - The action to perform
 * @param executor - The function to execute
 * @returns The result of the executor
 */
export async function withPermissionScope<T>(
  identity: AgentIdentity,
  action: ActionContext,
  executor: () => Promise<T>
): Promise<T> {
  const middleware = PermissionMiddleware.getInstance();
  
  // Evaluate permissions
  const result = middleware.evaluate(identity, action, { throwOnDenied: true });
  
  // Log the scoped execution
  logger.info('Permission-scoped execution', {
    agentId: identity.id,
    action: action.action,
    allowed: result.allowed,
    requiresHITL: result.requiresHITL,
    auditToken: identity.auditToken,
  });
  
  // Execute the action
  return executor();
}

// ============================================================================
// Exports
// ============================================================================

export const permissionMiddleware = PermissionMiddleware.getInstance();

export default {
  PermissionMiddleware,
  permissionMiddleware,
  ACTION_PERMISSION_MAP,
  requiresPermissions,
  withPermissionScope,
};
