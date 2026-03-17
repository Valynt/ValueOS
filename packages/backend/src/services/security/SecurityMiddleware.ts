/**
 * Security Middleware
 *
 * Provides authentication, authorization, and RBAC enforcement for ValueOS.
 * Critical for agent authority rules and cross-agent conflict prevention.
 *
 * Authority Rule: Only governance-class agents may mutate WorkflowState directly;
 * analytical agents must emit proposals.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { logger } from '../../lib/logger.js'

// ============================================================================
// Types
// ============================================================================

export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  tenantId?: string;
  roles: string[];
  permissions: Permission[];
  error?: string;
}

export interface Permission {
  resource: string;
  action: string;
  scope: 'global' | 'tenant' | 'user' | 'session';
}

export interface AgentContext {
  agentId: string;
  agentType: SecurityAgentRole;
  sessionId: string;
  userId: string;
  tenantId: string;
  permissions: Permission[];
}

export enum SecurityAgentRole {
  GOVERNANCE = 'governance-agent',
  ANALYTICAL = 'analytical-agent',
  EXECUTION = 'execution-agent',
  UI = 'ui-agent',
  SYSTEM = 'system-agent'
}

export enum ResourceType {
  WORKFLOW_STATE = 'workflow_state',
  AGENT_MEMORY = 'agent_memory',
  CANVAS_STATE = 'canvas_state',
  SDUI_RENDER = 'sdui_render',
  SYSTEM_CONFIG = 'system_config'
}

export enum Action {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  EXECUTE = 'execute',
  APPROVE = 'approve',
  REJECT = 'reject',
  PROPOSE = 'propose'
}

// ============================================================================
// RBAC Configuration
// ============================================================================

const AGENT_PERMISSIONS: Record<SecurityAgentRole, Permission[]> = {
  [SecurityAgentRole.GOVERNANCE]: [
    { resource: ResourceType.WORKFLOW_STATE, action: Action.READ, scope: 'tenant' },
    { resource: ResourceType.WORKFLOW_STATE, action: Action.WRITE, scope: 'tenant' },
    { resource: ResourceType.WORKFLOW_STATE, action: Action.DELETE, scope: 'tenant' },
    { resource: ResourceType.AGENT_MEMORY, action: Action.READ, scope: 'global' },
    { resource: ResourceType.AGENT_MEMORY, action: Action.WRITE, scope: 'global' },
    { resource: ResourceType.SYSTEM_CONFIG, action: Action.READ, scope: 'global' },
    { resource: ResourceType.SYSTEM_CONFIG, action: Action.WRITE, scope: 'global' },
    { resource: ResourceType.AGENT_MEMORY, action: Action.APPROVE, scope: 'global' },
    { resource: ResourceType.AGENT_MEMORY, action: Action.REJECT, scope: 'global' }
  ],
  [SecurityAgentRole.ANALYTICAL]: [
    { resource: ResourceType.WORKFLOW_STATE, action: Action.READ, scope: 'tenant' },
    { resource: ResourceType.AGENT_MEMORY, action: Action.READ, scope: 'global' },
    { resource: ResourceType.CANVAS_STATE, action: Action.READ, scope: 'session' },
    { resource: ResourceType.SDUI_RENDER, action: Action.EXECUTE, scope: 'session' },
    { resource: ResourceType.WORKFLOW_STATE, action: Action.PROPOSE, scope: 'tenant' },
    { resource: ResourceType.AGENT_MEMORY, action: Action.PROPOSE, scope: 'global' }
  ],
  [SecurityAgentRole.EXECUTION]: [
    { resource: ResourceType.WORKFLOW_STATE, action: Action.READ, scope: 'tenant' },
    { resource: ResourceType.AGENT_MEMORY, action: Action.READ, scope: 'global' },
    { resource: ResourceType.CANVAS_STATE, action: Action.EXECUTE, scope: 'session' },
    { resource: ResourceType.SDUI_RENDER, action: Action.EXECUTE, scope: 'session' }
  ],
  [SecurityAgentRole.UI]: [
    { resource: ResourceType.WORKFLOW_STATE, action: Action.READ, scope: 'session' },
    { resource: ResourceType.CANVAS_STATE, action: Action.READ, scope: 'session' },
    { resource: ResourceType.CANVAS_STATE, action: Action.WRITE, scope: 'session' },
    { resource: ResourceType.SDUI_RENDER, action: Action.EXECUTE, scope: 'session' }
  ],
  [SecurityAgentRole.SYSTEM]: [
    // System agents have all permissions for internal operations
    ...Object.values(ResourceType).flatMap(resource => [
      { resource, action: Action.READ, scope: 'global' },
      { resource, action: Action.WRITE, scope: 'global' },
      { resource, action: Action.DELETE, scope: 'global' },
      { resource, action: Action.EXECUTE, scope: 'global' }
    ])
  ]
};

// ============================================================================
// Security Middleware Class
// ============================================================================

export class SecurityMiddleware {
  private sessionCache = new Map<string, AgentContext>();
  private readonly SESSION_TTL = 30 * 60 * 1000; // 30 minutes

  constructor(private supabase: SupabaseClient) { }

  /**
   * Authenticate request and return agent context
   */
  async authenticate(
    token: string,
    agentType: SecurityAgentRole,
    sessionId?: string
  ): Promise<AuthResult> {
    try {
      // Validate JWT token
      const { data: { user }, error } = await this.supabase.auth.getUser(token);

      if (error || !user) {
        logger.warn('Authentication failed', { error: error?.message });
        return {
          authenticated: false,
          roles: [],
          permissions: [],
          error: 'Invalid authentication token'
        };
      }

      // Get user roles and permissions
      const { data: profile } = await this.supabase
        .from('user_profiles')
        .select('roles, tenant_id')
        .eq('user_id', user.id)
        .single();

      const roles = profile?.roles || [];
      const tenantId = profile?.tenant_id || 'default';

      // Get agent-specific permissions
      const permissions = AGENT_PERMISSIONS[agentType] || [];

      // Cache session context
      const context: AgentContext = {
        agentId: `${agentType}-${user.id}`,
        agentType,
        sessionId: sessionId || uuidv4(),
        userId: user.id,
        tenantId,
        permissions
      };

      this.sessionCache.set(context.sessionId, context);

      logger.info('Authentication successful', {
        agentId: context.agentId,
        agentType,
        userId: user.id,
        tenantId,
        permissionsCount: permissions.length
      });

      return {
        authenticated: true,
        userId: user.id,
        tenantId,
        roles,
        permissions
      };

    } catch (error) {
      logger.error('Authentication error', error instanceof Error ? error : undefined);
      return {
        authenticated: false,
        roles: [],
        permissions: [],
        error: 'Authentication service error'
      };
    }
  }

  /**
   * Authorize agent action based on RBAC rules
   */
  authorize(
    agentContext: AgentContext,
    resource: ResourceType,
    action: Action,
    scope?: string
  ): boolean {
    try {
      // Check if agent has required permission
      const hasPermission = agentContext.permissions.some(permission =>
        permission.resource === resource &&
        permission.action === action &&
        this.scopeMatches(permission.scope, scope, agentContext)
      );

      if (!hasPermission) {
        logger.warn('Authorization failed', {
          agentId: agentContext.agentId,
          agentType: agentContext.agentType,
          resource,
          action,
          scope,
          reason: 'Insufficient permissions'
        });
        return false;
      }

      // Enforce authority rules for critical operations
      if (resource === ResourceType.WORKFLOW_STATE && action === Action.WRITE) {
        return this.enforceWorkflowStateAuthority(agentContext);
      }

      if (resource === ResourceType.AGENT_MEMORY && [Action.APPROVE, Action.REJECT].includes(action)) {
        return this.enforceGovernanceAuthority(agentContext);
      }

      return true;

    } catch (error) {
      logger.error('Authorization error', error instanceof Error ? error : undefined);
      return false;
    }
  }

  /**
   * Enforce authority rules for WorkflowState mutations
   * Authority Rule: Only governance-class agents may mutate WorkflowState directly
   */
  private enforceWorkflowStateAuthority(agentContext: AgentContext): boolean {
    const isGovernanceAgent = agentContext.agentType === SecurityAgentRole.GOVERNANCE ||
      agentContext.agentType === SecurityAgentRole.SYSTEM;

    if (!isGovernanceAgent) {
      logger.warn('WorkflowState mutation denied - non-governance agent', {
        agentId: agentContext.agentId,
        agentType: agentContext.agentType,
        rule: 'Only governance agents may mutate WorkflowState directly'
      });
      return false;
    }

    return true;
  }

  /**
   * Enforce governance authority for approval/rejection actions
   */
  private enforceGovernanceAuthority(agentContext: AgentContext): boolean {
    const isGovernanceAgent = agentContext.agentType === SecurityAgentRole.GOVERNANCE ||
      agentContext.agentType === SecurityAgentRole.SYSTEM;

    if (!isGovernanceAgent) {
      logger.warn('Governance action denied - non-governance agent', {
        agentId: agentContext.agentId,
        agentType: agentContext.agentType,
        rule: 'Only governance agents may approve/reject proposals'
      });
      return false;
    }

    return true;
  }

  /**
   * Check if permission scope matches request scope
   */
  private scopeMatches(
    permissionScope: string,
    requestScope: string | undefined,
    context: AgentContext
  ): boolean {
    switch (permissionScope) {
      case 'global':
        return true;
      case 'tenant':
        return requestScope === context.tenantId || requestScope === undefined;
      case 'user':
        return requestScope === context.userId || requestScope === undefined;
      case 'session':
        return requestScope === context.sessionId || requestScope === undefined;
      default:
        return false;
    }
  }

  /**
   * Get cached session context
   */
  getSession(sessionId: string): AgentContext | null {
    const context = this.sessionCache.get(sessionId);
    if (!context) {
      return null;
    }

    // Check session expiry
    const age = Date.now() - parseInt(sessionId.split('-')[1] || '0');
    if (age > this.SESSION_TTL) {
      this.sessionCache.delete(sessionId);
      return null;
    }

    return context;
  }

  /**
   * Clear session cache
   */
  clearSession(sessionId: string): void {
    this.sessionCache.delete(sessionId);
    logger.info('Session cleared', { sessionId });
  }

  /**
   * Validate agent request with full security check
   */
  async validateAgentRequest(
    token: string,
    agentType: SecurityAgentRole,
    resource: ResourceType,
    action: Action,
    scope?: string,
    sessionId?: string
  ): Promise<{ authorized: boolean; context?: AgentContext; error?: string }> {
    // Authenticate
    const authResult = await this.authenticate(token, agentType, sessionId);
    if (!authResult.authenticated) {
      return {
        authorized: false,
        error: authResult.error || 'Authentication failed'
      };
    }

    // Get session context
    const context = this.getSession(sessionId || '');
    if (!context) {
      return {
        authorized: false,
        error: 'Session not found or expired'
      };
    }

    // Authorize
    const authorized = this.authorize(context, resource, action, scope);
    if (!authorized) {
      return {
        authorized: false,
        error: 'Authorization failed'
      };
    }

    return {
      authorized: true,
      context
    };
  }

  /**
   * Security audit logging
   */
  logSecurityEvent(
    event: string,
    context: AgentContext,
    resource?: ResourceType,
    action?: Action,
    success?: boolean
  ): void {
    logger.info('Security Event', {
      event,
      agentId: context.agentId,
      agentType: context.agentType,
      userId: context.userId,
      tenantId: context.tenantId,
      sessionId: context.sessionId,
      resource,
      action,
      success,
      timestamp: new Date().toISOString()
    });
  }
}

// ============================================================================
// Middleware Factory
// ============================================================================

export function createSecurityMiddleware(supabase: SupabaseClient): SecurityMiddleware {
  return new SecurityMiddleware(supabase);
}

// ============================================================================
// Express Middleware (if needed)
// ============================================================================

export function createAuthMiddleware(security: SecurityMiddleware) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const agentType = req.headers['x-agent-type'] as SecurityAgentRole;
    const sessionId = req.headers['x-session-id'] as string;

    if (!token || !agentType) {
      return res.status(401).json({ error: 'Missing authentication headers' });
    }

    const result = await security.authenticate(token, agentType, sessionId);
    if (!result.authenticated) {
      return res.status(401).json({ error: result.error });
    }

    req.agentContext = security.getSession(sessionId || '');
    next();
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

export function hasPermission(
  context: AgentContext,
  resource: ResourceType,
  action: Action
): boolean {
  return context.permissions.some(permission =>
    permission.resource === resource && permission.action === action
  );
}

export function isGovernanceAgent(context: AgentContext): boolean {
  return context.agentType === SecurityAgentRole.GOVERNANCE ||
    context.agentType === SecurityAgentRole.SYSTEM;
}

export function canMutateWorkflowState(context: AgentContext): boolean {
  return isGovernanceAgent(context) &&
    hasPermission(context, ResourceType.WORKFLOW_STATE, Action.WRITE);
}
