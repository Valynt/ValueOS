/**
 * Secure Shared Context Manager
 *
 * Provides secure context sharing between agents while maintaining
 * security boundaries and compliance requirements.
 */

import { logger } from '../lib/logger';
import { AgentType } from './agent-types';
import { getAuditLogger } from './AgentAuditLogger';

// ============================================================================
// Types
// ============================================================================

export interface SharedContext {
  sessionId: string;
  tenantId: string;
  userId: string;
  traceId: string;
  workflowId?: string;
  timestamp: number;
  metadata: Record<string, unknown>;
}

export interface AgentContext {
  agentType: AgentType;
  sessionId: string;
  data: Record<string, unknown>;
  permissions: string[];
  dataAccessLevel: string;
  complianceChecks: string[];
  timestamp: number;
  expiresAt: number;
}

export interface ContextShareRequest {
  fromAgent: AgentType;
  toAgent: AgentType;
  contextKey: string;
  data: unknown;
  securityContext: SecurityContext;
  auditMetadata: Record<string, unknown>;
}

export interface SecurityContext {
  tenantId: string;
  userId: string;
  permissions: string[];
  trustLevel: 'low' | 'medium' | 'high' | 'privileged';
  sessionId: string;
  traceId: string;
}

export interface ContextValidationResult {
  valid: boolean;
  allowed: boolean;
  reasons: string[];
  warnings: string[];
  requiredPermissions: string[];
  complianceFlags: string[];
}

export interface ContextCache {
  key: string;
  data: unknown;
  securityContext: SecurityContext;
  createdAt: number;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
  allowedAgents: AgentType[];
}

// ============================================================================
// Secure Shared Context Implementation
// ============================================================================

export class SecureSharedContext {
  private sharedContexts: Map<string, SharedContext> = new Map();
  private agentContexts: Map<string, AgentContext[]> = new Map();
  private contextCache: Map<string, ContextCache> = new Map();
  private auditLogger = getAuditLogger();

  private readonly DEFAULT_TTL = 1800000; // 30 minutes
  private readonly MAX_CACHE_SIZE = 500;
  private readonly CONTEXT_CLEANUP_INTERVAL = 300000; // 5 minutes

  constructor() {
    // Start cleanup interval
    setInterval(() => this.cleanupExpiredContexts(), this.CONTEXT_CLEANUP_INTERVAL);
  }

  /**
   * Get shared context for a session
   */
  async getSharedContext(
    sessionId: string,
    securityContext: SecurityContext
  ): Promise<SharedContext> {
    const key = this.generateSharedContextKey(sessionId, securityContext.tenantId);

    let sharedContext = this.sharedContexts.get(key);

    if (!sharedContext) {
      // Create new shared context
      sharedContext = {
        sessionId,
        tenantId: securityContext.tenantId,
        userId: securityContext.userId,
        traceId: securityContext.traceId,
        timestamp: Date.now(),
        metadata: {},
      };

      this.sharedContexts.set(key, sharedContext);

      // Log context creation
      await this.auditLogger.log({
        agent_name: 'system' as AgentType,
        input_query: 'shared_context_created',
        context: {
          sessionId,
          userId: securityContext.userId,
        },
        success: true,
        response_metadata: {
          duration: 0,
        },
      });
    }

    return sharedContext;
  }

  /**
   * Get agent-specific context
   */
  async getAgentContext(
    agentType: AgentType,
    sessionId: string,
    securityContext: SecurityContext
  ): Promise<AgentContext> {
    const key = this.generateAgentContextKey(agentType, sessionId);
    const contexts = this.agentContexts.get(key) || [];

    // Find valid context for this agent
    let agentContext = contexts.find(ctx =>
      ctx.expiresAt > Date.now() &&
      ctx.agentType === agentType
    );

    if (!agentContext) {
      // Create new agent context
      agentContext = {
        agentType,
        sessionId,
        data: {},
        permissions: this.getAgentPermissions(agentType),
        dataAccessLevel: this.getAgentDataAccessLevel(agentType),
        complianceChecks: this.getAgentComplianceChecks(agentType),
        timestamp: Date.now(),
        expiresAt: Date.now() + this.DEFAULT_TTL,
      };

      contexts.push(agentContext);
      this.agentContexts.set(key, contexts);
    }

    // Update access time
    agentContext.timestamp = Date.now();

    return agentContext;
  }

  /**
   * Share context between agents with security validation
   */
  async shareContext(request: ContextShareRequest): Promise<boolean> {
    try {
      // Validate the context share request
      const validation = await this.validateContextShare(request);

      if (!validation.valid || !validation.allowed) {
        logger.warn('Context share denied', {
          fromAgent: request.fromAgent,
          toAgent: request.toAgent,
          reasons: validation.reasons,
          warnings: validation.warnings,
        });

        // Log denied share
        await this.auditLogger.log({
          agent_name: request.fromAgent,
          input_query: 'context_share_denied',
          context: {
            userId: request.securityContext.userId,
            organizationId: request.securityContext.tenantId,
            sessionId: request.securityContext.sessionId,
            metadata: {
              toAgent: request.toAgent,
              contextKey: request.contextKey,
              reasons: validation.reasons,
            },
          },
          success: false,
          error_message: validation.reasons.join(', '),
          response_metadata: {
            duration: 0,
          },
        });

        return false;
      }

      // Store shared context in cache
      const cacheKey = this.generateCacheKey(
        request.fromAgent,
        request.toAgent,
        request.contextKey,
        request.securityContext.tenantId
      );

      const contextCache: ContextCache = {
        key: cacheKey,
        data: request.data,
        securityContext: request.securityContext,
        createdAt: Date.now(),
        expiresAt: Date.now() + this.DEFAULT_TTL,
        accessCount: 0,
        lastAccessed: Date.now(),
        allowedAgents: [request.fromAgent, request.toAgent],
      };

      this.contextCache.set(cacheKey, contextCache);

      // Log successful share
      await this.auditLogger.log({
        agent_name: request.fromAgent,
        input_query: 'context_shared',
        context: {
          userId: request.securityContext.userId,
          organizationId: request.securityContext.tenantId,
          sessionId: request.securityContext.sessionId,
          metadata: {
            toAgent: request.toAgent,
            contextKey: request.contextKey,
            cacheKey,
          },
        },
        success: true,
        response_metadata: {
          duration: 0,
        },
      });

      return true;
    } catch (error) {
      logger.error('Context share failed', error instanceof Error ? error : undefined, {
        fromAgent: request.fromAgent,
        toAgent: request.toAgent,
        contextKey: request.contextKey,
      });

      return false;
    }
  }

  /**
   * Retrieve shared context
   */
  async retrieveSharedContext(
    fromAgent: AgentType,
    toAgent: AgentType,
    contextKey: string,
    securityContext: SecurityContext
  ): Promise<any | null> {
    const cacheKey = this.generateCacheKey(fromAgent, toAgent, contextKey, securityContext.tenantId);
    const cached = this.contextCache.get(cacheKey);

    if (!cached) {
      return null;
    }

    // Validate access permissions
    const validation = await this.validateAccess(cached, toAgent, securityContext);

    if (!validation.allowed) {
      logger.warn('Context access denied', {
        context: {
          fromAgent,
          contextKey,
          reasons: validation.reasons,
        },
      });

      return null;
    }

    // Update access statistics
    cached.accessCount++;
    cached.lastAccessed = Date.now();

    // Log access
    await this.auditLogger.log({
      agent_name: toAgent,
      input_query: 'context_accessed',
      context: {
        metadata: {
          fromAgent,
          contextKey,
          accessCount: cached.accessCount,
        },
      },
      success: true,
      response_metadata: {
        duration: 0,
      },
    });

    return cached.data;
  }

  /**
   * Validate context share request
   */
  private async validateContextShare(request: ContextShareRequest): Promise<ContextValidationResult> {
    const result: ContextValidationResult = {
      valid: true,
      allowed: true,
      reasons: [],
      warnings: [],
      requiredPermissions: [],
      complianceFlags: [],
    };

    // Check if agents are allowed to communicate
    const allowedPairs = this.getAllowedAgentPairs();
    const pairKey = `${request.fromAgent}-${request.toAgent}`;

    if (!allowedPairs.includes(pairKey) && !allowedPairs.includes('*')) {
      result.allowed = false;
      result.reasons.push('Agent communication not allowed');
    }

    // Check security level compatibility
    const fromSecurityLevel = this.getAgentSecurityLevel(request.fromAgent);
    const toSecurityLevel = this.getAgentSecurityLevel(request.toAgent);

    if (fromSecurityLevel > toSecurityLevel) {
      result.warnings.push('Security level downgrade detected');
    }

    // Check data sensitivity
    const dataSensitivity = this.assessDataSensitivity(request.data);
    if (dataSensitivity === 'high' && request.securityContext.trustLevel !== 'privileged') {
      result.allowed = false;
      result.reasons.push('Insufficient trust level for sensitive data');
    }

    // Check compliance requirements
    const complianceChecks = this.getComplianceRequirements(request.fromAgent, request.toAgent);
    result.complianceFlags = complianceChecks;

    // Check required permissions
    const requiredPermissions = this.getRequiredPermissionsForShare(request.fromAgent, request.toAgent);
    result.requiredPermissions = requiredPermissions;

    const hasPermissions = requiredPermissions.every(perm =>
      request.securityContext.permissions.includes(perm)
    );

    if (!hasPermissions) {
      result.allowed = false;
      result.reasons.push('Missing required permissions');
    }

    return result;
  }

  /**
   * Validate access to cached context
   */
  private async validateAccess(
    cached: ContextCache,
    requestingAgent: AgentType,
    securityContext: SecurityContext
  ): Promise<ContextValidationResult> {
    const result: ContextValidationResult = {
      valid: true,
      allowed: true,
      reasons: [],
      warnings: [],
      requiredPermissions: [],
      complianceFlags: [],
    };

    // Check if agent is allowed to access this context
    if (!cached.allowedAgents.includes(requestingAgent)) {
      result.allowed = false;
      result.reasons.push('Agent not in allowed list');
    }

    // Check if context has expired
    if (cached.expiresAt < Date.now()) {
      result.valid = false;
      result.reasons.push('Context expired');
    }

    // Check tenant isolation
    if (cached.securityContext.tenantId !== securityContext.tenantId) {
      result.allowed = false;
      result.reasons.push('Tenant isolation violation');
    }

    // Check user access
    if (cached.securityContext.userId !== securityContext.userId) {
      result.warnings.push('Cross-user access attempt');
    }

    return result;
  }

  /**
   * Cleanup expired contexts
   */
  private cleanupExpiredContexts(): void {
    const now = Date.now();
    let cleanedCount = 0;

    // Cleanup shared contexts
    for (const [key, context] of this.sharedContexts.entries()) {
      if (now - context.timestamp > this.DEFAULT_TTL) {
        this.sharedContexts.delete(key);
        cleanedCount++;
      }
    }

    // Cleanup agent contexts
    for (const [key, contexts] of this.agentContexts.entries()) {
      const validContexts = contexts.filter(ctx => ctx.expiresAt > now);
      if (validContexts.length !== contexts.length) {
        this.agentContexts.set(key, validContexts);
        cleanedCount += contexts.length - validContexts.length;
      }
    }

    // Cleanup cache
    for (const [key, cached] of this.contextCache.entries()) {
      if (cached.expiresAt < now) {
        this.contextCache.delete(key);
        cleanedCount++;
      }
    }

    // Prevent cache from growing too large
    if (this.contextCache.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.contextCache.entries());
      entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

      const toRemove = entries.slice(0, this.contextCache.size - this.MAX_CACHE_SIZE);
      toRemove.forEach(([key]) => this.contextCache.delete(key));

      cleanedCount += toRemove.length;
    }

    if (cleanedCount > 0) {
      logger.debug('Context cleanup completed', {
        cleanedCount,
        remainingShared: this.sharedContexts.size,
        remainingAgent: this.agentContexts.size,
        remainingCache: this.contextCache.size,
      });
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private generateSharedContextKey(sessionId: string, tenantId: string): string {
    return `shared:${sessionId}:${tenantId}`;
  }

  private generateAgentContextKey(agentType: AgentType, sessionId: string): string {
    return `agent:${agentType}:${sessionId}`;
  }

  private generateCacheKey(fromAgent: AgentType, toAgent: AgentType, contextKey: string, tenantId: string): string {
    return `cache:${fromAgent}:${toAgent}:${contextKey}:${tenantId}`;
  }

  private getAgentPermissions(agentType: AgentType): string[] {
    const permissions: Record<string, string[]> = {
      coordinator: ['workflow.execute', 'agents.coordinate', 'context.read'],
      opportunity: ['data.read', 'opportunity.execute', 'context.write'],
      target: ['data.read', 'target.execute', 'context.write'],
      realization: ['data.read', 'realization.execute', 'context.write'],
      expansion: ['data.read', 'expansion.execute', 'context.write'],
      integrity: ['data.read', 'integrity.execute', 'audit.read', 'context.read'],
      research: ['data.read', 'research.execute', 'context.write'],
      benchmark: ['data.read', 'benchmark.execute', 'context.write'],
      'company-intelligence': ['data.read', 'company-intelligence.execute', 'context.write'],
      'financial-modeling': ['data.read', 'financial-modeling.execute', 'context.write'],
      'value-mapping': ['data.read', 'value-mapping.execute', 'context.write'],
      communicator: ['data.read', 'communicator.execute', 'context.read'],
      narrative: ['data.read', 'narrative.execute', 'context.read'],
      groundtruth: ['data.read', 'groundtruth.execute', 'context.read'],
      'system-mapper': ['data.read', 'system-mapper.execute', 'context.write'],
      'intervention-designer': ['data.read', 'intervention-designer.execute', 'context.write'],
      'outcome-engineer': ['data.read', 'outcome-engineer.execute', 'context.write'],
      'value-eval': ['data.read', 'value-eval.execute', 'context.read'],
    };

    return permissions[agentType] || ['data.read'];
  }

  private getAgentDataAccessLevel(agentType: AgentType): string {
    const levels: Record<string, string> = {
      coordinator: 'workflow',
      opportunity: 'business',
      target: 'financial',
      realization: 'operational',
      expansion: 'strategic',
      integrity: 'audit',
      research: 'external',
      benchmark: 'industry',
      'company-intelligence': 'confidential',
      'financial-modeling': 'financial',
      'value-mapping': 'business',
      communicator: 'public',
      narrative: 'public',
      groundtruth: 'verification',
      'system-mapper': 'system',
      'intervention-designer': 'design',
      'outcome-engineer': 'outcome',
      'value-eval': 'evaluation',
    };

    return levels[agentType] || 'standard';
  }

  private getAgentComplianceChecks(agentType: AgentType): string[] {
    const checks: Record<string, string[]> = {
      'financial-modeling': ['sox_compliance', 'financial_accuracy'],
      target: ['sox_compliance', 'financial_accuracy'],
      integrity: ['audit_trail', 'data_integrity'],
      groundtruth: ['audit_trail', 'data_integrity'],
      'company-intelligence': ['data_privacy', 'confidentiality'],
      opportunity: ['business_validation'],
      realization: ['operational_compliance'],
      expansion: ['strategic_review'],
      research: ['data_source_validation'],
      benchmark: ['industry_compliance'],
      'value-mapping': ['value_validation'],
      communicator: ['content_compliance'],
      narrative: ['content_validation'],
      'system-mapper': ['architecture_compliance'],
      'intervention-designer': ['design_validation'],
      'outcome-engineer': ['outcome_validation'],
      'value-eval': ['evaluation_compliance'],
    };

    return checks[agentType] || [];
  }

  private getAllowedAgentPairs(): string[] {
    // Define which agents can share context
    // '*' means all agents can communicate
    return [
      '*',
      // Add specific restrictions if needed
      // 'integrity-groundtruth',
      // 'coordinator-*',
    ];
  }

  private getAgentSecurityLevel(agentType: AgentType): number {
    const levels: Record<string, number> = {
      integrity: 4,      // Highest
      groundtruth: 4,
      coordinator: 3,
      'financial-modeling': 3,
      target: 3,
      'company-intelligence': 3,
      opportunity: 2,
      realization: 2,
      expansion: 2,
      research: 2,
      benchmark: 2,
      'value-mapping': 2,
      communicator: 1,
      narrative: 1,
      'system-mapper': 2,
      'intervention-designer': 2,
      'outcome-engineer': 2,
      'value-eval': 2,
    };

    return levels[agentType] || 1;
  }

  private assessDataSensitivity(data: unknown): 'low' | 'medium' | 'high' {
    if (!data || typeof data !== 'object') return 'low';

    const sensitiveKeywords = [
      'password', 'token', 'key', 'secret', 'confidential',
      'proprietary', 'sensitive', 'private', 'personal'
    ];

    const dataString = JSON.stringify(data).toLowerCase();

    if (sensitiveKeywords.some(keyword => dataString.includes(keyword))) {
      return 'high';
    }

    const financialKeywords = ['salary', 'revenue', 'profit', 'cost', 'budget'];
    if (financialKeywords.some(keyword => dataString.includes(keyword))) {
      return 'medium';
    }

    return 'low';
  }

  private getComplianceRequirements(fromAgent: AgentType, toAgent: AgentType): string[] {
    const requirements = [];

    // Financial compliance
    if ([fromAgent, toAgent].some(agent => ['financial-modeling', 'target'].includes(agent))) {
      requirements.push('sox_compliance', 'financial_audit');
    }

    // Data privacy compliance
    if ([fromAgent, toAgent].some(agent => ['company-intelligence'].includes(agent))) {
      requirements.push('data_privacy', 'gdpr_compliance');
    }

    // Audit requirements
    if ([fromAgent, toAgent].some(agent => ['integrity', 'groundtruth'].includes(agent))) {
      requirements.push('audit_trail', 'data_integrity');
    }

    return requirements;
  }

  private getRequiredPermissionsForShare(fromAgent: AgentType, toAgent: AgentType): string[] {
    const basePermissions = ['context.read', 'context.write'];

    // Add agent-specific permissions
    if (fromAgent === 'coordinator' || toAgent === 'coordinator') {
      basePermissions.push('workflow.execute');
    }

    if ([fromAgent, toAgent].some(agent => ['integrity', 'groundtruth'].includes(agent))) {
      basePermissions.push('audit.read');
    }

    return basePermissions;
  }

  // ============================================================================
  // Public API Methods
  // ============================================================================

  /**
   * Get context statistics
   */
  getContextStats(): {
    sharedContexts: number;
    agentContexts: number;
    cachedContexts: number;
    cacheHitRate: number;
  } {
    const totalAccesses = Array.from(this.contextCache.values())
      .reduce((sum, cache) => sum + cache.accessCount, 0);

    return {
      sharedContexts: this.sharedContexts.size,
      agentContexts: Array.from(this.agentContexts.values())
        .reduce((sum, contexts) => sum + contexts.length, 0),
      cachedContexts: this.contextCache.size,
      cacheHitRate: this.contextCache.size > 0 ? totalAccesses / this.contextCache.size : 0,
    };
  }

  /**
   * Clear all contexts (for testing or emergency)
   */
  clearAllContexts(): void {
    this.sharedContexts.clear();
    this.agentContexts.clear();
    this.contextCache.clear();

    logger.info('All contexts cleared');
  }

  /**
   * Export context data for migration
   */
  exportContextData(): {
    sharedContexts: Record<string, SharedContext>;
    agentContexts: Record<string, AgentContext[]>;
    contextCache: Record<string, ContextCache>;
  } {
    return {
      sharedContexts: Object.fromEntries(this.sharedContexts),
      agentContexts: Object.fromEntries(this.agentContexts),
      contextCache: Object.fromEntries(this.contextCache),
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let secureSharedContextInstance: SecureSharedContext | null = null;

export function getSecureSharedContext(): SecureSharedContext {
  if (!secureSharedContextInstance) {
    secureSharedContextInstance = new SecureSharedContext();
  }
  return secureSharedContextInstance;
}

export function resetSecureSharedContext(): void {
  secureSharedContextInstance = null;
}
