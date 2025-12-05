/**
 * Agent Tracing Utilities
 * 
 * Provides tracing wrappers for agent operations
 */

import { getTracer, addSpanAttributes, addSpanEvent, recordSpanException } from './index';
import { SpanStatusCode, Span } from '@opentelemetry/api';
import { logger } from '../logger';

export interface AgentSpanAttributes {
  agentId: string;
  agentName: string;
  lifecycleStage: string;
  version: string;
  sessionId: string;
}

/**
 * Trace an agent execution
 */
export async function traceAgentExecution\u003cT\u003e(
  operationName: string,
  attributes: AgentSpanAttributes,
  operation: (span: Span) =\u003e Promise\u003cT\u003e
): Promise\u003cT\u003e {
  const tracer = getTracer();
  
  return await tracer.startActiveSpan(
    `agent.${attributes.lifecycleStage}.${operationName}`,
    {
      attributes: {
        'agent.id': attributes.agentId,
        'agent.name': attributes.agentName,
        'agent.stage': attributes.lifecycleStage,
        'agent.version': attributes.version,
        'session.id': attributes.sessionId
      }
    },
    async (span) => {
      const startTime = Date.now();
      
      try {
        const result = await operation(span);
        
        const duration = Date.now() - startTime;
        span.setAttributes({
          'agent.duration_ms': duration,
          'agent.success': true
        });
        
        span.setStatus({ code: SpanStatusCode.OK });
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        span.setAttributes({
          'agent.duration_ms': duration,
          'agent.success': false,
          'agent.error': error instanceof Error ? error.message : 'Unknown error'
        });
        
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
        
        span.recordException(error as Error);
        
        logger.error('Agent execution failed', error as Error, {
          agent: attributes.agentName,
          stage: attributes.lifecycleStage,
          operation: operationName
        });
        
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Trace agent invocation with confidence tracking
 */
export async function traceAgentInvocation\u003cT\u003e(
  attributes: AgentSpanAttributes,
  operation: (span: Span) =\u003e Promise\u003cT \u0026 { confidence_level?: string; confidence_score?: number }\u003e
): Promise\u003cT\u003e {
  return await traceAgentExecution('invoke', attributes, async (span) => {
    const result = await operation(span);
    
    // Add confidence metrics to span
    if (result.confidence_level) {
      span.setAttributes({
        'agent.confidence.level': result.confidence_level,
        'agent.confidence.score': result.confidence_score || 0
      });
    }
    
    return result;
  });
}

/**
 * Trace value prediction with accuracy tracking
 */
export async function traceValuePrediction\u003cT\u003e(
  attributes: AgentSpanAttributes,
  predictionType: string,
  operation: (span: Span) =\u003e Promise\u003cT\u003e
): Promise\u003cT\u003e {
  const tracer = getTracer();
  
  return await tracer.startActiveSpan(
    `agent.${attributes.lifecycleStage}.predict.${predictionType}`,
    {
      attributes: {
        ...attributes,
        'prediction.type': predictionType
      }
    },
    async (span) => {
      try {
        const result = await operation(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Add agent event to current span
 */
export function addAgentEvent(
  eventName: string,
  attributes?: Record\u003cstring, string | number | boolean\u003e
): void {
  addSpanEvent(`agent.${eventName}`, attributes);
}

/**
 * Record agent confidence in current span
 */
export function recordAgentConfidence(
  confidenceLevel: string,
  confidenceScore: number,
  hallucinationDetected: boolean = false
): void {
  addSpanAttributes({
    'agent.confidence.level': confidenceLevel,
    'agent.confidence.score': confidenceScore,
    'agent.hallucination_detected': hallucinationDetected
  });
}

/**
 * Record agent reasoning in current span
 */
export function recordAgentReasoning(
  reasoning: string,
  assumptions: string[] = [],
  dataGaps: string[] = []
): void {
  addSpanEvent('agent.reasoning', {
    'reasoning.length': reasoning.length,
    'reasoning.assumptions_count': assumptions.length,
    'reasoning.data_gaps_count': dataGaps.length
  });
}
