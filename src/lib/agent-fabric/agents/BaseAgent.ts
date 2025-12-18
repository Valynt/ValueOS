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
}
