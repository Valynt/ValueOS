import { SupabaseClient } from '@supabase/supabase-js';
import { LLMGateway, LLMMessage } from '../LLMGateway';
import { MemorySystem } from '../MemorySystem';
import { AuditLogger } from '../AuditLogger';
import secureLLMInvoke from '../../llm/secureLLMInvoke';
import { z } from 'zod';
import { AgentConfig, ConfidenceLevel } from '../../../types/agent';
import { getTracer } from '../../observability';
import { SpanStatusCode } from '@opentelemetry/api';
import { AgentCircuitBreaker, SafetyLimits, withCircuitBreaker } from '../CircuitBreaker';
import { enforceRules } from '../../rules';
import { logger } from '../../../lib/logger';
// VOS-SEC-001: Agent Identity System
import {
  AgentIdentity,
  AgentRole,
  Permission,
  createAgentIdentity,
  hasPermission,
  requirePermission,
  requiresHITL,
  PermissionDeniedError,
} from '../../auth/AgentIdentity';
// VOS-SEC-002: Permission Middleware
import { permissionMiddleware, withPermissionScope } from '../../auth/PermissionMiddleware';
// VOS-HITL-001: HITL Framework
import { hitlFramework, ApprovalRequest } from '../../hitl/HITLFramework';
// 4-Layer Truth Architecture
import {
  IIntegrityAgent,
  IntegrityCheckRequest,
  IntegrityCheckResult,
  IntegrityError,
  IntegrityIssue,
  Citation,
  ReasoningChain,
  getIntegrityAgent,
  verifyCitations,
  parseCitations,
  createReasoningChain,
  addReasoningStep,
  finalizeReasoningChain,
} from '../../truth/GroundTruthEngine';

export interface SecureInvocationOptions {
  /** Custom confidence thresholds */
  confidenceThresholds?: ConfidenceThresholds;
  /** Whether to throw on low confidence */
  throwOnLowConfidence?: boolean;
  /** Whether to store prediction for accuracy tracking */
  trackPrediction?: boolean;
  /** Additional context for the agent */
  context?: Record<string, any>;
  /** Custom safety limits for circuit breaker */
  safetyLimits?: Partial<SafetyLimits>;
}

export abstract class BaseAgent {
  protected supabase: SupabaseClient | null;
  protected agentId: string;
  protected organizationId?: string;
  protected userId?: string;
  protected sessionId?: string;
  protected llmGateway: LLMGateway;
  protected memorySystem: MemorySystem;
  protected auditLogger: AuditLogger;
  
  /** VOS-SEC-001: Agent Identity for RBAC enforcement */
  protected agentIdentity: AgentIdentity;
  
  /** 4-Layer Truth: Integrity Agent for adversarial peer review */
  protected integrityAgent: IIntegrityAgent;
  
  /** 4-Layer Truth: Current reasoning chain for transparency */
  protected currentReasoningChain: ReasoningChain | null = null;

  public abstract lifecycleStage: string;
  public abstract version: string;
  public abstract name: string;

  constructor(config: AgentConfig) {
    if (!config.llmGateway || !config.memorySystem || !config.auditLogger) {
      throw new Error('Agent requires llmGateway, memorySystem, and auditLogger in its configuration.');
    }
    this.agentId = config.id;
    this.organizationId = config.organizationId;
    this.userId = config.userId;
    this.sessionId = config.sessionId;
    this.supabase = config.supabase ?? null;
    this.llmGateway = config.llmGateway;
    this.memorySystem = config.memorySystem;
    this.auditLogger = config.auditLogger;
    
    // VOS-SEC-001: Initialize agent identity for RBAC
    this.agentIdentity = createAgentIdentity({
      role: this.mapNameToAgentRole(),
      organizationId: config.organizationId || 'default',
      parentSessionId: config.sessionId,
      initiatingUserId: config.userId,
      expirationSeconds: 7200, // 2 hours
    });
    
    // 4-Layer Truth: Initialize integrity agent for adversarial peer review
    this.integrityAgent = getIntegrityAgent();
    
    logger.info('Agent initialized with identity and integrity check', {
      agentId: this.agentIdentity.id,
      role: this.agentIdentity.role,
      permissions: this.agentIdentity.permissions.length,
      integrityEnabled: true,
    });
  }
  
  /**
   * Map agent name to AgentRole enum (VOS-SEC-001)
   */
  private mapNameToAgentRole(): AgentRole {
    const name = (this.constructor.name || '').toLowerCase();
    
    if (name.includes('coordinator') || name.includes('orchestrator')) return AgentRole.COORDINATOR;
    if (name.includes('opportunity')) return AgentRole.OPPORTUNITY;
    if (name.includes('target')) return AgentRole.TARGET;
    if (name.includes('realization')) return AgentRole.REALIZATION;
    if (name.includes('expansion')) return AgentRole.EXPANSION;
    if (name.includes('integrity')) return AgentRole.INTEGRITY;
    if (name.includes('communicator')) return AgentRole.COMMUNICATOR;
    if (name.includes('benchmark')) return AgentRole.BENCHMARK;
    if (name.includes('narrative')) return AgentRole.NARRATIVE;
    if (name.includes('adversarial')) return AgentRole.ADVERSARIAL;
    if (name.includes('financial')) return AgentRole.FINANCIAL_MODELING;
    if (name.includes('company') || name.includes('intelligence')) return AgentRole.COMPANY_INTELLIGENCE;
    if (name.includes('value') && name.includes('map')) return AgentRole.VALUE_MAPPING;
    if (name.includes('research')) return AgentRole.RESEARCH;
    
    return AgentRole.SYSTEM; // Default for unknown agents
  }

  abstract execute(sessionId: string, input: any): Promise<any>;

  /**
   * Secure agent invocation with structured outputs and hallucination detection
   * NOW WITH CIRCUIT BREAKER PROTECTION (Production Fix)
   */
  protected async secureInvoke<T extends z.ZodType>(
    sessionId: string,
    input: any,
    resultSchema: T,
    options: SecureInvocationOptions = {}
  ): Promise<SecureAgentOutput & { result: z.infer<T> }> {
    const startTime = Date.now();
    const thresholds = options.confidenceThresholds || DEFAULT_CONFIDENCE_THRESHOLDS;

    // CRITICAL FIX: Wrap execution in circuit breaker
    const { result: output, metrics } = await withCircuitBreaker(
      async (breaker: AgentCircuitBreaker) => {
        // GOVERNANCE ENFORCEMENT: Check GR/LR rules before LLM execution
        const governanceCheck = await this.checkGovernanceRules(sessionId, input, options);
        if (!governanceCheck.allowed) {
          throw new Error(`Governance violation: ${governanceCheck.violations.map(v => v.message).join(', ')}`);
        }

        // Sanitize input
        const sanitizedInput = this.sanitizeInput(input);

        // Create full schema with result type
        const fullSchema = createSecureAgentSchema(resultSchema);

        // Build messages with XML sandboxing
        const messages: LLMMessage[] = [
          {
            role: 'system',
            content: getSecureAgentSystemPrompt(this.name, this.lifecycleStage)
          },
          {
            role: 'user',
            content: this.buildSandboxedPrompt(sanitizedInput)
          }
        ];

        // Invoke LLM with structured output + circuit breaker
        const taskContext = {
          sessionId,
          organizationId: this.organizationId,
          userId: this.userId,
          agentId: this.agentId,
          estimatedPromptTokens: 0,
          estimatedCompletionTokens: 0
        };

        // Use secureLLMInvoke to ensure sanitization, schema validation, provenance and telemetry
        const promptStr = messages.map(m => `${m.role}:\n${m.content}`).join('\n\n');

        const secureResult = await secureLLMInvoke(promptStr, {
          tenantId: this.organizationId || 'unknown',
          traceId: taskContext?.traceId,
          requestId: taskContext?.requestId,
          model: undefined,
          temperature: 0.7,
          maxTokens: 4000,
          schema: fullSchema,
          deterministicParse: true,
          executor: this.llmGateway as any,
        });

        if (!secureResult.ok) {
          // Log and surface validation failures; fail-closed semantics
          logger.error('secureLLMInvoke failed', { agent: this.agentId, sessionId, reason: secureResult.reason, details: secureResult.details });
          throw new Error(`secureLLMInvoke failed: ${secureResult.reason}`);
        }

        const parsed = secureResult.data as any;
        const validation = validateAgentOutput(parsed, thresholds);

        // Log warnings
        if (validation.warnings.length > 0) {
          logger.warn('Agent output validation warnings', {
            agent: this.agentId,
            sessionId,
            warnings: validation.warnings
          });
        }

        // Handle errors
        if (!validation.valid) {
          logger.error('Agent output validation failed', {
            agent: this.agentId,
            sessionId,
            errors: validation.errors
          });

          if (options.throwOnLowConfidence) {
            throw new Error(`Agent output validation failed: ${validation.errors.join(', ')}`);
          }
        }

        const processingTime = Date.now() - startTime;
        const enhancedOutput = {
          ...validation.enhanced,
          processing_time_ms: processingTime
        };

        // Store prediction for accuracy tracking
        if (options.trackPrediction && this.supabase) {
          await this.storePrediction(sessionId, sanitizedInput, enhancedOutput);
        }

        // Log execution
        await this.logExecution(
          sessionId,
          'secure_invoke',
          sanitizedInput,
          enhancedOutput.result,
          enhancedOutput.reasoning || 'No reasoning provided',
          enhancedOutput.confidence_level,
          enhancedOutput.evidence || []
        );

        return enhancedOutput as SecureAgentOutput & { result: z.infer<T> };
      },
      options.safetyLimits // Pass custom safety limits if provided
    );

    // Log circuit breaker metrics
    logger.info('Agent execution metrics', {
      agent: this.agentId,
      sessionId,
      llmCalls: metrics.llmCallCount,
      duration: metrics.duration,
      completed: metrics.completed
    });

    return output;
  }

  /**
   * Check Governance Rules (GR/LR) before LLM execution
   * CRITICAL: Policy-as-Code enforcement - fail-closed on violations
   */
  private async checkGovernanceRules(
    sessionId: string,
    input: any,
    options: SecureInvocationOptions
  ): Promise<{ allowed: boolean; violations: string[] }> {
    try {
      // Map agent type for governance rules
      const agentType = this.mapAgentToType();

      const governanceResult = await enforceRules({
        agentId: this.agentId,
        agentType,
        userId: this.userId || 'system',
        tenantId: this.organizationId || 'default',
        sessionId,
        action: 'llm_invoke',
        payload: {
          input,
          agent: this.name,
          lifecycleStage: this.lifecycleStage,
          context: options.context,
        },
        environment: process.env.NODE_ENV as 'development' | 'staging' | 'production' || 'development',
      });

      if (!governanceResult.allowed) {
        logger.error('GOVERNANCE VIOLATION - LLM EXECUTION BLOCKED', {
          agent: this.agentId,
          sessionId,
          violations: governanceResult.violations.map(v => `${v.ruleId}: ${v.message}`),
        });

        return {
          allowed: false,
          violations: governanceResult.violations.map(v => v.message),
        };
      }

      logger.debug('Governance rules passed for LLM execution', {
        agent: this.agentId,
        globalRulesChecked: governanceResult.metadata.globalRulesChecked,
        localRulesChecked: governanceResult.metadata.localRulesChecked,
      });

      return { allowed: true, violations: [] };
    } catch (error) {
      logger.error('CRITICAL: Governance check failed - BLOCKING LLM EXECUTION', {
        agent: this.agentId,
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });

      // FAIL-CLOSED: Block execution on governance system failure
      return {
        allowed: false,
        violations: ['Governance system error - execution blocked for safety'],
      };
    }
  }

  /**
   * Map agent name to governance agent type
   */
  private mapAgentToType(): 'coordinator' | 'system_mapper' | 'intervention_designer' | 'outcome_engineer' | 'realization_loop' | 'value_eval' | 'communicator' {
    const name = this.name.toLowerCase();
    
    if (name.includes('coordinator') || name.includes('orchestrator')) return 'coordinator';
    if (name.includes('system') || name.includes('mapper')) return 'system_mapper';
    if (name.includes('intervention') || name.includes('design')) return 'intervention_designer';
    if (name.includes('outcome') || name.includes('engineer')) return 'outcome_engineer';
    if (name.includes('realization') || name.includes('loop')) return 'realization_loop';
    if (name.includes('value') || name.includes('eval')) return 'value_eval';
    if (name.includes('communicator') || name.includes('message')) return 'communicator';
    
    return 'coordinator'; // Default
  }

  /**
   * Sanitize user input to prevent prompt injection
   */
  private sanitizeInput(input: any): any {
    if (typeof input === 'string') {
      return sanitizeUserInput(input);
    }

    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeInput(item));
    }

    if (typeof input === 'object' && input !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = this.sanitizeInput(value);
      }
      return sanitized;
    }

    return input;
  }

  /**
   * Store prediction for accuracy tracking
   */
  private async storePrediction(
    sessionId: string,
    input: any,
    output: SecureAgentOutput
  ): Promise<void> {
    if (!this.supabase) return;

    try {
      await this.supabase.from('agent_predictions').insert({
        session_id: sessionId,
        agent_id: this.agentId,
        agent_type: this.lifecycleStage,
        input_hash: this.hashInput(input),
        input_data: input,
        prediction: output.result,
        confidence_level: output.confidence_level,
        confidence_score: output.confidence_score,
        hallucination_detected: output.hallucination_check,
        assumptions: output.assumptions,
        data_gaps: output.data_gaps,
        evidence: output.evidence,
        reasoning: output.reasoning,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to store prediction', {
        agent: this.agentId,
        sessionId,
        error: error.message
      });
    }
  }

  /**
   * Hash input for deduplication
   */
  private hashInput(input: any): string {
    const str = JSON.stringify(input);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * Build sandboxed prompt with XML tags
   */
  private buildSandboxedPrompt(input: any): string {
    const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
    
    // Apply XML sandboxing to clearly delineate user input
    return `<user_input>${this.escapeXml(inputStr)}</user_input>`;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  protected async logExecution(
    sessionId: string,
    action: string,
    inputData: any,
    outputData: any,
    reasoning: string,
    confidence: ConfidenceLevel,
    evidence: any[] = []
  ): Promise<void> {
    await this.auditLogger.logAction(sessionId, this.agentId, action, {
      reasoning,
      inputData,
      outputData,
      confidenceLevel: confidence,
      evidence
    });

    await this.memorySystem.storeEpisodicMemory(
      sessionId,
      this.agentId,
      `${action}: ${reasoning}`,
      { input: inputData, output: outputData },
      this.organizationId,
      { source: 'agent_execution', trace_id: sessionId }
    );
  }

  protected async logMetric(
    sessionId: string,
    metricType: string,
    value: number,
    unit?: string
  ): Promise<void> {
    await this.auditLogger.logMetric(sessionId, this.agentId, metricType, value, unit);
  }

  protected async logPerformanceMetric(
    sessionId: string,
    operation: string,
    durationMs: number,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    await this.auditLogger.logPerformanceMetric(
      sessionId,
      this.agentId,
      operation,
      durationMs,
      metadata
    );
  }

  protected async extractJSON(content: string, schema?: z.ZodSchema): Promise<any> {
    // Use new comprehensive SafeJSONParser with error handling
    const { extractJSON: safeExtractJSON } = await import('../SafeJSONParser');
    
    try {
      return await safeExtractJSON(content, schema, {
        maxSize: 5 * 1024 * 1024, // 5 MB limit
        allowPartial: !schema // Allow partial recovery if no schema validation
      });
    } catch (error: any) {
      logger.error('JSON extraction failed in BaseAgent', {
        agent: this.agentId,
        error: error.message,
        contentPreview: content.substring(0, 200)
      });
      
      // Graceful degradation: return empty object for backward compatibility
      // but log the failure for monitoring
      if (schema) {
        throw error; // Re-throw if schema validation was requested
      }
      
      return {};
    }
  }

  protected determineConfidence(
    hasEvidence: boolean,
    dataQuality: 'high' | 'medium' | 'low'
  ): ConfidenceLevel {
    if (!hasEvidence || dataQuality === 'low') return 'low';
    if (dataQuality === 'medium') return 'medium';
    return 'high';
  }

  protected async recordLifecycleLink(
    sessionId: string,
    link: Omit<LifecycleArtifactLink, 'id' | 'created_at'>
  ): Promise<void> {
    if (!this.supabase) return;

    const payload = {
      session_id: sessionId,
      source_stage: link.source_type?.split('_')?.[0] || null,
      target_stage: link.target_type?.split('_')?.[0] || null,
      source_type: link.source_type,
      source_artifact_id: link.source_id,
      target_type: link.target_type,
      target_artifact_id: link.target_id,
      relationship_type: link.relationship_type || 'derived_from',
      reasoning_trace: link.reasoning_trace || null,
      chain_depth: link.chain_depth || null,
      metadata: link.metadata || {},
      created_by: this.agentId
    };

    await this.supabase.from('lifecycle_artifact_links').insert(payload);

    await this.logProvenanceAudit({
      session_id: sessionId,
      agent_id: this.agentId,
      artifact_type: link.target_type,
      artifact_id: link.target_id,
      action: 'lifecycle_link_created',
      reasoning_trace: link.reasoning_trace,
      artifact_data: {
        source: { type: link.source_type, id: link.source_id },
        target: { type: link.target_type, id: link.target_id },
      },
      metadata: {
        source_type: link.source_type,
        source_id: link.source_id,
        relationship_type: link.relationship_type || 'derived_from',
        chain_depth: link.chain_depth ?? undefined
      }
    });
  }

  protected async logProvenanceAudit(entry: ProvenanceAuditEntry): Promise<void> {
    if (!this.supabase) return;

    await this.supabase.from('provenance_audit_log').insert({
      ...entry,
      created_at: new Date().toISOString(),
      metadata: entry.metadata || {}
    });
  }

  protected async logArtifactProvenance(
    sessionId: string,
    artifactType: string,
    artifactId: string,
    action: string,
    options: {
      reasoning_trace?: string;
      artifact_data?: Record<string, any>;
      input_variables?: Record<string, any>;
      output_snapshot?: Record<string, any>;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<void> {
    await this.logProvenanceAudit({
      session_id: sessionId,
      agent_id: this.agentId,
      artifact_type: artifactType,
      artifact_id: artifactId,
      action,
      reasoning_trace: options.reasoning_trace,
      artifact_data: options.artifact_data,
      input_variables: options.input_variables,
      output_snapshot: options.output_snapshot,
      metadata: options.metadata,
    });
  }

  // =========================================================================
  // VOS-SEC-001/002: RBAC Enforcement Methods
  // =========================================================================

  /**
   * Check if this agent has a specific permission
   * Implements deny-by-default RBAC (VOS-SEC-002)
   */
  protected hasPermission(action: Permission): boolean {
    return hasPermission(this.agentIdentity, action);
  }

  /**
   * Require a permission, throwing PermissionDeniedError if not granted
   * Implements deny-by-default RBAC (VOS-SEC-002)
   */
  protected requirePermission(action: Permission): void {
    requirePermission(this.agentIdentity, action);
  }

  /**
   * Execute an action with permission scope validation
   * Uses middleware for caching and consistent enforcement (VOS-SEC-002)
   */
  protected async withPermissionScope<T>(
    action: string,
    executor: () => Promise<T>
  ): Promise<T> {
    return withPermissionScope(
      this.agentIdentity,
      { action, resource: 'agent_action', metadata: { agentId: this.agentId } },
      executor
    );
  }

  // =========================================================================
  // VOS-HITL-001: Human-in-the-Loop Methods
  // =========================================================================

  /**
   * Check if an action requires Human-in-the-Loop approval
   */
  protected requiresHITL(action: string): boolean {
    return hitlFramework.requiresApproval(action);
  }

  /**
   * Request HITL approval for a high-risk action
   * Returns the approval request which can be awaited or handled asynchronously
   */
  protected async requestHITLApproval(
    action: string,
    details: {
      description: string;
      impact: string;
      reversible: boolean;
      affectedRecords: number;
      preview?: Record<string, unknown>;
    }
  ): Promise<ApprovalRequest> {
    return hitlFramework.requestApproval(
      this.agentIdentity,
      action,
      {
        description: details.description,
        impact: details.impact,
        reversible: details.reversible,
      },
      {
        preview: details.preview || {},
        affectedRecords: details.affectedRecords,
      }
    );
  }

  /**
   * Execute an action that may require HITL approval
   * Automatically handles the approval workflow
   */
  protected async executeWithHITL<T>(
    action: string,
    details: {
      description: string;
      impact: string;
      reversible: boolean;
      affectedRecords: number;
      preview?: Record<string, unknown>;
    },
    executor: () => Promise<T>
  ): Promise<T> {
    // Check if HITL is required
    if (!this.requiresHITL(action)) {
      return executor();
    }

    // Request approval
    const request = await this.requestHITLApproval(action, details);

    // Check if auto-approved
    if (request.status === 'auto_approved') {
      logger.info('HITL auto-approved, executing action', {
        requestId: request.id,
        action,
      });
      return executor();
    }

    // For pending requests, throw to indicate async approval needed
    throw new Error(
      `HITL approval required. Request ID: ${request.id}. ` +
      `Risk level: ${request.gate.riskLevel}. ` +
      `Required approvers: ${request.gate.requiredApprovers}`
    );
  }

  /**
   * Get the agent's identity for audit purposes
   */
  public getAgentIdentity(): Readonly<AgentIdentity> {
    return this.agentIdentity;
  }

  /**
   * Get the agent's audit token for trace correlation
   */
  public getAuditToken(): string {
    return this.agentIdentity.auditToken;
  }

  // =========================================================================
  // 4-Layer Truth Architecture: Integrity Enforcement
  // =========================================================================

  /**
   * Execute a task with mandatory integrity check (Layer 1)
   * For high/critical risk tasks, IntegrityAgent performs adversarial review.
   * NO AGENT CAN BYPASS THIS CHECK.
   */
  protected async executeWithIntegrityCheck<T>(
    sessionId: string,
    task: {
      input: Record<string, unknown>;
      riskLevel: 'low' | 'medium' | 'high' | 'critical';
      requiresCitations: boolean;
    },
    executor: () => Promise<{ output: T; sources?: Citation[]; reasoning?: string }>
  ): Promise<T> {
    // Start reasoning chain for transparency (Layer 3)
    this.currentReasoningChain = createReasoningChain(this.agentId, sessionId);
    
    // 1. Perform the primary work
    const result = await executor();
    
    // 2. Verify citations if required (Layer 2)
    if (task.requiresCitations) {
      const outputText = typeof result.output === 'string' 
        ? result.output 
        : JSON.stringify(result.output);
      
      const citationIssues = this.verifySource(outputText);
      
      if (citationIssues.length > 0) {
        logger.warn('Citation verification failed', {
          agentId: this.agentId,
          sessionId,
          issues: citationIssues.length,
        });
        
        // For high/critical risk, fail immediately on citation issues
        if (task.riskLevel === 'high' || task.riskLevel === 'critical') {
          throw new IntegrityError(citationIssues, {
            passed: false,
            confidence: 0,
            issues: citationIssues,
            recommendations: ['Add citations for all numerical claims'],
            checkedAt: new Date().toISOString(),
            checkedBy: 'citation_validator',
          });
        }
      }
    }
    
    // 3. For high/critical risk, invoke IntegrityAgent for peer review (Layer 1)
    if (task.riskLevel === 'high' || task.riskLevel === 'critical') {
      const integrityCheck = await this.requestPeerReview({
        originalPrompt: JSON.stringify(task.input),
        agentOutput: result.output as Record<string, unknown>,
        citedSources: result.sources || [],
        reasoningChain: this.currentReasoningChain,
        riskLevel: task.riskLevel,
        producingAgent: {
          id: this.agentIdentity.id,
          role: this.agentIdentity.role,
        },
      });
      
      // 4. Block if integrity check fails
      if (!integrityCheck.passed) {
        logger.error('Integrity check failed - blocking output', {
          agentId: this.agentId,
          sessionId,
          issues: integrityCheck.issues.length,
          confidence: integrityCheck.confidence,
        });
        
        // Log to audit trail (Layer 4)
        await this.auditLogger.logAction(sessionId, this.agentId, 'integrity_check_failed', {
          reasoning: result.reasoning,
          inputData: task.input,
          outputData: result.output as Record<string, unknown>,
          metadata: {
            riskLevel: task.riskLevel,
            issues: integrityCheck.issues,
            checkedBy: integrityCheck.checkedBy,
          },
        });
        
        throw new IntegrityError(integrityCheck.issues, integrityCheck);
      }
      
      // Log successful integrity check
      await this.auditLogger.logAction(sessionId, this.agentId, 'integrity_check_passed', {
        reasoning: result.reasoning,
        metadata: {
          riskLevel: task.riskLevel,
          confidence: integrityCheck.confidence,
          checkedBy: integrityCheck.checkedBy,
        },
      });
    }
    
    // Finalize reasoning chain
    if (this.currentReasoningChain) {
      this.currentReasoningChain = finalizeReasoningChain(
        this.currentReasoningChain,
        typeof result.output === 'string' ? result.output : JSON.stringify(result.output),
        true
      );
    }
    
    return result.output;
  }

  /**
   * Verify that all numerical claims have source citations (Layer 2)
   * Returns issues if uncited claims are found.
   */
  protected verifySource(text: string): IntegrityIssue[] {
    return verifyCitations(text);
  }

  /**
   * Parse citations from text
   */
  protected extractCitations(text: string): Citation[] {
    return parseCitations(text);
  }

  /**
   * Request peer review from IntegrityAgent (Layer 1)
   */
  protected async requestPeerReview(
    request: IntegrityCheckRequest
  ): Promise<IntegrityCheckResult> {
    logger.info('Requesting peer review from IntegrityAgent', {
      producingAgent: request.producingAgent.id,
      riskLevel: request.riskLevel,
      citationCount: request.citedSources.length,
    });
    
    return this.integrityAgent.audit(request);
  }

  /**
   * Add a step to the current reasoning chain (Layer 3)
   * Makes agent logic visible for human review
   */
  protected addReasoningStep(
    action: string,
    input: Record<string, unknown>,
    output: Record<string, unknown>,
    citations: Citation[] = [],
    verified: boolean = false
  ): void {
    if (this.currentReasoningChain) {
      this.currentReasoningChain = addReasoningStep(this.currentReasoningChain, {
        action,
        input,
        output,
        citations,
        verified,
        verificationMethod: verified ? 'data_match' : undefined,
      });
    }
  }

  /**
   * Get the current reasoning chain for transparency
   */
  public getReasoningChain(): Readonly<ReasoningChain> | null {
    return this.currentReasoningChain;
  }

  /**
   * Create a citation for a VMRT source
   */
  protected createVMRTCitation(
    id: string,
    field: string,
    value: string | number
  ): Citation {
    return {
      id: `VMRT-${id}`,
      type: 'VMRT',
      field,
      value,
      accessedAt: new Date().toISOString(),
    };
  }

  /**
   * Create a citation for a CRM source
   */
  protected createCRMCitation(
    recordId: string,
    field: string,
    value: string | number
  ): Citation {
    return {
      id: `CRM-${recordId}`,
      type: 'CRM',
      field,
      value,
      accessedAt: new Date().toISOString(),
    };
  }

  /**
   * Create a citation for a benchmark source
   */
  protected createBenchmarkCitation(
    benchmarkId: string,
    field: string,
    value: string | number
  ): Citation {
    return {
      id: `BENCHMARK-${benchmarkId}`,
      type: 'BENCHMARK',
      field,
      value,
      accessedAt: new Date().toISOString(),
    };
  }

  /**
   * Format a value with its citation for output
   */
  protected formatWithCitation(value: string | number, citation: Citation): string {
    return `${value} [Source: ${citation.id}${citation.field ? ':' + citation.field : ''}]`;
  }
}
