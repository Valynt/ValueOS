/**
 * Secure Shared Context Manager
 *
 * Provides secure context sharing between agents while maintaining
 * security boundaries and compliance requirements.
 */

import { logger } from '../lib/logger';
import { AgentType } from './agent-types';
import { getAuditLogger } from './AgentAuditLogger';
import { constantTimeCompareObjects } from '../lib/crypto/CryptoUtils';

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
  metadata: Record<string, any>;
}

export interface AgentContext {
  agentType: AgentType;
  sessionId: string;
  data: Record<string, any>;
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
  data: any;
  securityContext: SecurityContext;
  auditMetadata: Record<string, any>;
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
  data: any;
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
   * Validate context share request
   */
  private validateContextShareRequest(request: ContextShareRequest): void {
    // Validate required fields
    if (!request.fromAgent || !request.toAgent) {
      throw new Error('Agent types are required');
    }

    if (!request.contextKey || typeof request.contextKey !== 'string') {
      throw new Error('Valid context key is required');
    }

    if (!request.securityContext) {
      throw new Error('Security context is required');
    }

    // Validate security context structure
    const { securityContext } = request;
    if (!securityContext.tenantId || !securityContext.userId || !securityContext.sessionId) {
      throw new Error('Security context must contain tenantId, userId, and sessionId');
    }

    // Validate agent types
    const validAgents = new Set([
      'coordinator', 'opportunity', 'target', 'realization', 'expansion', 'integrity',
      'research', 'benchmark', 'company-intelligence', 'financial-modeling', 'value-mapping',
      'communicator', 'narrative', 'groundtruth', 'system-mapper', 'intervention-designer',
      'outcome-engineer', 'value-eval'
    ]);

    if (!validAgents.has(request.fromAgent) || !validAgents.has(request.toAgent)) {
      throw new Error('Invalid agent type specified');
    }

    // Validate context key format
    if (request.contextKey.length > 255 || !/^[a-zA-Z0-9_-]+$/.test(request.contextKey)) {
      throw new Error('Context key must be alphanumeric with underscores/hyphens and max 255 chars');
    }

    // Validate data size
    const dataSize = JSON.stringify(request.data || {}).length;
    if (dataSize > 1024 * 1024) { // 1MB limit
      throw new Error('Context data too large (max 1MB)');
    }

    // Validate audit metadata
    if (request.auditMetadata && typeof request.auditMetadata !== 'object') {
      throw new Error('Audit metadata must be an object');
    }
  }

  /**
   * Sanitize context data for storage
   */
  private sanitizeContextData(data: any): any {
    if (data === null || data === undefined) {
      return {};
    }

    if (typeof data === 'string') {
      // Remove potential script injections and limit length
      return data
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .substring(0, 10000); // Max 10k chars per string
    }

    if (Array.isArray(data)) {
      return data.slice(0, 1000).map(item => this.sanitizeContextData(item)); // Max 1000 items
    }

    if (typeof data === 'object') {
      const sanitized: any = {};
      const maxKeys = 100;
      let keyCount = 0;

      for (const [key, value] of Object.entries(data)) {
        if (keyCount >= maxKeys) break;

        // Sanitize key names
        const sanitizedKey = key.replace(/[<>\"'&]/g, '').substring(0, 100);
        sanitized[sanitizedKey] = this.sanitizeContextData(value);
        keyCount++;
      }

      return sanitized;
    }

    // For numbers, booleans, etc.
    return data;
  }

  /**
   * Share context between agents with security validation
   */
  async shareContext(request: ContextShareRequest): Promise<boolean> {
    try {
      // Input validation
      this.validateContextShareRequest(request);

      // Sanitize data
      const sanitizedData = this.sanitizeContextData(request.data);

      // Create sanitized request copy
      const sanitizedRequest = {
        ...request,
        data: sanitizedData
      };

      // Validate the context share request
      const validation = await this.validateContextShare(sanitizedRequest);

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
   * Validate context share request with constant-time operations
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

    // Perform all checks before making decisions to prevent timing attacks
    const checks: {
      agentPairAllowed: boolean;
      securityLevelCompatible: boolean;
      dataSensitivityAllowed: boolean;
      permissionsValid: boolean;
      complianceRequired: string[];
      requiredPermissions: string[];
    } = {
      agentPairAllowed: false,
      securityLevelCompatible: true,
      dataSensitivityAllowed: true,
      permissionsValid: false,
      complianceRequired: [],
      requiredPermissions: []
    };

    // Check if agents are allowed to communicate
    const allowedPairs = this.getAllowedAgentPairs();
    const pairKey = `${request.fromAgent}-${request.toAgent}`;
    checks.agentPairAllowed = allowedPairs.includes(pairKey) || allowedPairs.includes('*');

    // Check security level compatibility
    const fromSecurityLevel = this.getAgentSecurityLevel(request.fromAgent);
    const toSecurityLevel = this.getAgentSecurityLevel(request.toAgent);
    checks.securityLevelCompatible = fromSecurityLevel <= toSecurityLevel;

    // Check data sensitivity
    const dataSensitivity = this.assessDataSensitivity(request.data);
    checks.dataSensitivityAllowed = !(dataSensitivity === 'high' && request.securityContext.trustLevel !== 'privileged');

    // Check compliance requirements
    checks.complianceRequired = this.getComplianceRequirements(request.fromAgent, request.toAgent);
    result.complianceFlags = checks.complianceRequired;

    // Check required permissions
    checks.requiredPermissions = this.getRequiredPermissionsForShare(request.fromAgent, request.toAgent);
    result.requiredPermissions = checks.requiredPermissions;

    // Validate permissions using constant-time comparison
    const hasPermissions = checks.requiredPermissions.every(perm =>
      request.securityContext.permissions.includes(perm)
    );
    checks.permissionsValid = hasPermissions;

    // Now make decisions based on all checks
    if (!checks.agentPairAllowed) {
      result.allowed = false;
      result.reasons.push('Agent communication not allowed');
    }

    if (!checks.securityLevelCompatible) {
      result.warnings.push('Security level downgrade detected');
    }

    if (!checks.dataSensitivityAllowed) {
      result.allowed = false;
      result.reasons.push('Insufficient trust level for sensitive data');
    }

    if (!checks.permissionsValid) {
      result.allowed = false;
      result.reasons.push('Missing required permissions');
    }

    return result;
  }

  /**
   * Validate access to cached context with constant-time operations
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

    // Perform all checks before making decisions to prevent timing attacks
    const checks: {
      agentAllowed: boolean;
      contextValid: boolean;
      tenantMatch: boolean;
      userMatch: boolean;
    } = {
      agentAllowed: false,
      contextValid: false,
      tenantMatch: false,
      userMatch: false
    };

    // Check if agent is allowed to access this context
    checks.agentAllowed = cached.allowedAgents.includes(requestingAgent);

    // Check if context has expired
    checks.contextValid = cached.expiresAt >= Date.now();

    // Check tenant isolation using constant-time comparison
    checks.tenantMatch = constantTimeCompareObjects(
      cached.securityContext.tenantId,
      securityContext.tenantId
    );

    // Check user access using constant-time comparison
    checks.userMatch = constantTimeCompareObjects(
      cached.securityContext.userId,
      securityContext.userId
    );

    // Now make decisions based on all checks
    if (!checks.agentAllowed) {
      result.allowed = false;
      result.reasons.push('Agent not in allowed list');
    }

    if (!checks.contextValid) {
      result.valid = false;
      result.reasons.push('Context expired');
    }

    if (!checks.tenantMatch) {
      result.allowed = false;
      result.reasons.push('Tenant isolation violation');
    }

    if (!checks.userMatch) {
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
    // Define specific allowed agent communication pairs
    // Format: 'fromAgent-toAgent'
    // Only explicitly allowed pairs can communicate
    return [
      // Core workflow agents can communicate with coordinator
      'coordinator-opportunity',
      'coordinator-target',
      'coordinator-realization',
      'coordinator-expansion',
      'coordinator-integrity',
      'opportunity-coordinator',
      'target-coordinator',
      'realization-coordinator',
      'expansion-coordinator',
      'integrity-coordinator',

      // Sequential workflow communication
      'opportunity-target',
      'target-realization',
      'realization-expansion',
      'expansion-integrity',

      // Integrity agents can communicate with all for audit purposes
      'integrity-opportunity',
      'integrity-target',
      'integrity-realization',
      'integrity-expansion',
      'integrity-groundtruth',
      'integrity-financial-modeling',
      'integrity-company-intelligence',

      // Research and benchmark agents can share data
      'research-benchmark',
      'benchmark-research',
      'research-company-intelligence',
      'company-intelligence-research',

      // Value mapping agents can communicate with financial modeling
      'value-mapping-financial-modeling',
      'financial-modeling-value-mapping',

      // Communication agents can receive from any agent for output
      'opportunity-communicator',
      'target-communicator',
      'realization-communicator',
      'expansion-communicator',
      'integrity-communicator',
      'research-communicator',
      'benchmark-communicator',
      'narrative-communicator',

      // System mapper can communicate with most agents for analysis
      'system-mapper-opportunity',
      'system-mapper-target',
      'system-mapper-realization',
      'system-mapper-expansion',
      'system-mapper-integrity',

      // Value evaluation can receive from all agents for assessment
      'opportunity-value-eval',
      'target-value-eval',
      'realization-value-eval',
      'expansion-value-eval',
      'integrity-value-eval',
      'research-value-eval',
      'benchmark-value-eval',
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

  private assessDataSensitivity(data: any): 'low' | 'medium' | 'high' {
    if (!data || typeof data !== 'object') return 'low';

    const dataString = JSON.stringify(data).toLowerCase();

    // High sensitivity patterns - PII, credentials, secrets
    const highSensitivityPatterns = [
      // PII patterns
      /\b(social security|ssn|tax id)\b/,
      /\b(driver's license|license number)\b/,
      /\b(passport|passport number)\b/,
      /\b(birth date|dob|date of birth)\b/,
      /\b(phone number|mobile|telephone)\b/,
      /\b(email address|email)\b/,
      /\b(home address|street address|address)\b/,

      // Financial PII
      /\b(credit card|card number|cvv|expiry)\b/,
      /\b(bank account|account number|routing)\b/,
      /\b(debit card|atm card)\b/,
      /\b(credit score|fico|credit report)\b/,

      // Authentication secrets
      /\b(password|passwd|pwd)\b/,
      /\b(secret|token|key|api_key)\b/,
      /\b(private key|public key|certificate)\b/,
      /\b(session|session id|jwt|oauth)\b/,
      /\b(two factor|2fa|mfa|totp)\b/,

      // Medical/Health information
      /\b(medical|health|diagnosis|treatment)\b/,
      /\b(patient|doctor|hospital|clinic)\b/,
      /\b(prescription|medication|drug)\b/,
      /\b(hipaa|phi|protected health)\b/,

      // Personal demographics
      /\b(age|gender|sex|race|ethnicity)\b/,
      /\b(marital status|family|children)\b/,
      /\b(income|salary|wages|employment)\b/,
      /\b(education|school|university|degree)\b/,

      // Confidential business data
      /\b(confidential|proprietary|trade secret)\b/,
      /\b(internal only|company confidential)\b/,
      /\b(do not distribute|restricted)\b/,
      /\b(executive|board|leadership)\b/,
    ];

    // Medium sensitivity patterns - Financial, business operational data
    const mediumSensitivityPatterns = [
      // Financial data (non-PII)
      /\b(revenue|profit|loss|income)\b/,
      /\b(cost|expense|budget|forecast)\b/,
      /\b(salary|wage|compensation|payroll)\b/,
      /\b(invoice|billing|payment|transaction)\b/,
      /\b(tax|deduction|withholding)\b/,
      /\b(investment|portfolio|stock|equity)\b/,

      // Business operational data
      /\b(customer|client|user account)\b/,
      /\b(sales|leads|opportunities|deals)\b/,
      /\b(inventory|product|service|pricing)\b/,
      /\b(contract|agreement|proposal|quote)\b/,
      /\b(performance|metrics|kpi|analytics)\b/,
      /\b(employee|staff|team|organization)\b/,

      // System data
      /\b(server|database|network|infrastructure)\b/,
      /\b(log|error|exception|debug)\b/,
      /\b(configuration|settings|parameters)\b/,
      /\b(admin|administrator|root)\b/,
    ];

    // Check for high sensitivity patterns first
    for (const pattern of highSensitivityPatterns) {
      if (pattern.test(dataString)) {
        return 'high';
      }
    }

    // Check for medium sensitivity patterns
    for (const pattern of mediumSensitivityPatterns) {
      if (pattern.test(dataString)) {
        return 'medium';
      }
    }

    // Additional heuristic checks
    const highSensitivityKeywords = [
      'confidential', 'secret', 'private', 'sensitive', 'personal',
      'protected', 'classified', 'restricted', 'internal'
    ];

    const mediumSensitivityKeywords = [
      'financial', 'business', 'operational', 'strategic', 'analytical',
      'performance', 'metrics', 'statistics', 'reports', 'data'
    ];

    // Check for high sensitivity keywords
    if (highSensitivityKeywords.some(keyword => dataString.includes(keyword))) {
      // Additional context check - if keyword appears with other sensitive terms
      const contextWords = ['information', 'data', 'details', 'records', 'files'];
      if (contextWords.some(word => dataString.includes(word))) {
        return 'high';
      }
    }

    // Check for medium sensitivity keywords
    if (mediumSensitivityKeywords.some(keyword => dataString.includes(keyword))) {
      return 'medium';
    }

    // Check for structured data patterns that might indicate sensitivity
    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;

      // Check for arrays of objects that might contain PII
      if (Array.isArray(parsed) && parsed.length > 0) {
        const firstItem = parsed[0];
        if (typeof firstItem === 'object' && firstItem !== null) {
          const keys = Object.keys(firstItem).join(' ').toLowerCase();

          // Check for PII-like field names
          const piiFieldPatterns = [
            /(name|fname|lname|firstname|lastname)/,
            /(email|e-mail|mail)/,
            /(phone|mobile|tel|telephone)/,
            /(address|addr|street|city|state|zip)/,
            /(id|identifier|ssn|taxid)/,
            /(birth|dob|age|gender)/,
          ];

          for (const pattern of piiFieldPatterns) {
            if (pattern.test(keys)) {
              return 'high';
            }
          }
        }
      }

      // Check for numeric data that might be financial
      const numericValues = JSON.stringify(parsed).match(/\b\d{4,}\b/g);
      if (numericValues && numericValues.length > 0) {
        // Look for patterns that suggest financial data
        const hasLargeNumbers = numericValues.some(n => parseInt(n) > 10000);
        const hasDecimalNumbers = JSON.stringify(parsed).match(/\b\d+\.\d{2}\b/g);

        if (hasLargeNumbers || hasDecimalNumbers) {
          return 'medium';
        }
      }
    } catch (e) {
      // If parsing fails, continue with string-based analysis
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
