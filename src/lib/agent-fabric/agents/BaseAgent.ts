import { SupabaseClient } from '@supabase/supabase-js';
import { LLMGateway, LLMMessage } from '../LLMGateway';
import { MemorySystem } from '../MemorySystem';
import { AuditLogger } from '../AuditLogger';
import { AgentConfig, ConfidenceLevel } from '../../../types/agent';
import { getTracer } from '../../observability';
import { SpanStatusCode } from '@opentelemetry/api';
import { AgentCircuitBreaker, SafetyLimits, withCircuitBreaker } from '../CircuitBreaker';

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
        const response = await this.llmGateway.complete(
          messages,
          {
            temperature: 0.7,
            max_tokens: 4000
          },
          undefined, // taskContext
          breaker    // CRITICAL: Pass circuit breaker
        );

        // Parse and validate response
        const parsed = await this.extractJSON(response.content, fullSchema);
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
      { input: inputData, output: outputData }
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
    if (featureFlags.ENABLE_SAFE_JSON_PARSER && schema) {
      // Use SafeJSON parser with schema validation
      return await parseLLMOutputStrict(content, schema);
    } else if (featureFlags.ENABLE_SAFE_JSON_PARSER) {
      // Use SafeJSON parser without schema (permissive)
      return await parseLLMOutputStrict(content, z.any());
    } else {
      // Legacy: Use regex-based parsing
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in LLM response');
      return JSON.parse(jsonMatch[0]);
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
