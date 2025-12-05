/**
 * Critical Path Tracing
 * 
 * Specialized tracing for high-value operations:
 * - Value tree operations
 * - Workflow orchestration
 * - SDUI generation
 */

import { getTracer, addSpanAttributes, addSpanEvent } from './index';
import { SpanStatusCode, Span } from '@opentelemetry/api';
import { logger } from '../logger';

/**
 * Trace value tree operations
 */
export async function traceValueTreeOperation\u003cT\u003e(
  operationName: string,
  attributes: {
    sessionId: string;
    treeId?: string;
    nodeCount?: number;
    depth?: number;
  },
  operation: (span: Span) =\u003e Promise\u003cT\u003e
): Promise\u003cT\u003e {
  const tracer = getTracer();
  
  return await tracer.startActiveSpan(
    `value_tree.${operationName}`,
    {
      attributes: {
        'value_tree.operation': operationName,
        'session.id': attributes.sessionId,
        'value_tree.id': attributes.treeId || 'unknown',
        'value_tree.node_count': attributes.nodeCount || 0,
        'value_tree.depth': attributes.depth || 0
      }
    },
    async (span) => {
      const startTime = Date.now();
      
      try {
        const result = await operation(span);
        
        const duration = Date.now() - startTime;
        span.setAttributes({
          'value_tree.duration_ms': duration,
          'value_tree.success': true
        });
        
        span.setStatus({ code: SpanStatusCode.OK });
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        span.setAttributes({
          'value_tree.duration_ms': duration,
          'value_tree.success': false,
          'value_tree.error': error instanceof Error ? error.message : 'Unknown error'
        });
        
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
        
        span.recordException(error as Error);
        
        logger.error('Value tree operation failed', error as Error, {
          operation: operationName,
          sessionId: attributes.sessionId
        });
        
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Trace workflow orchestration
 */
export async function traceWorkflowOperation\u003cT\u003e(
  operationName: string,
  attributes: {
    sessionId: string;
    workflowId?: string;
    workflowType?: string;
    currentStage?: string;
    stageCount?: number;
  },
  operation: (span: Span) =\u003e Promise\u003cT\u003e
): Promise\u003cT\u003e {
  const tracer = getTracer();
  
  return await tracer.startActiveSpan(
    `workflow.${operationName}`,
    {
      attributes: {
        'workflow.operation': operationName,
        'session.id': attributes.sessionId,
        'workflow.id': attributes.workflowId || 'unknown',
        'workflow.type': attributes.workflowType || 'unknown',
        'workflow.current_stage': attributes.currentStage || 'unknown',
        'workflow.stage_count': attributes.stageCount || 0
      }
    },
    async (span) => {
      const startTime = Date.now();
      
      try {
        const result = await operation(span);
        
        const duration = Date.now() - startTime;
        span.setAttributes({
          'workflow.duration_ms': duration,
          'workflow.success': true
        });
        
        span.setStatus({ code: SpanStatusCode.OK });
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        span.setAttributes({
          'workflow.duration_ms': duration,
          'workflow.success': false,
          'workflow.error': error instanceof Error ? error.message : 'Unknown error'
        });
        
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
        
        span.recordException(error as Error);
        
        logger.error('Workflow operation failed', error as Error, {
          operation: operationName,
          sessionId: attributes.sessionId,
          workflowType: attributes.workflowType
        });
        
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Trace SDUI generation
 */
export async function traceSDUIGeneration\u003cT\u003e(
  operationName: string,
  attributes: {
    sessionId: string;
    componentType?: string;
    componentCount?: number;
    dataSize?: number;
  },
  operation: (span: Span) =\u003e Promise\u003cT\u003e
): Promise\u003cT\u003e {
  const tracer = getTracer();
  
  return await tracer.startActiveSpan(
    `sdui.${operationName}`,
    {
      attributes: {
        'sdui.operation': operationName,
        'session.id': attributes.sessionId,
        'sdui.component_type': attributes.componentType || 'unknown',
        'sdui.component_count': attributes.componentCount || 0,
        'sdui.data_size_bytes': attributes.dataSize || 0
      }
    },
    async (span) => {
      const startTime = Date.now();
      
      try {
        const result = await operation(span);
        
        const duration = Date.now() - startTime;
        span.setAttributes({
          'sdui.duration_ms': duration,
          'sdui.success': true
        });
        
        span.setStatus({ code: SpanStatusCode.OK });
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        span.setAttributes({
          'sdui.duration_ms': duration,
          'sdui.success': false,
          'sdui.error': error instanceof Error ? error.message : 'Unknown error'
        });
        
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
        
        span.recordException(error as Error);
        
        logger.error('SDUI generation failed', error as Error, {
          operation: operationName,
          sessionId: attributes.sessionId,
          componentType: attributes.componentType
        });
        
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Record value tree metrics
 */
export function recordValueTreeMetrics(
  nodeCount: number,
  linkCount: number,
  depth: number,
  calculationCount: number
): void {
  addSpanAttributes({
    'value_tree.nodes': nodeCount,
    'value_tree.links': linkCount,
    'value_tree.depth': depth,
    'value_tree.calculations': calculationCount
  });
}

/**
 * Record workflow stage transition
 */
export function recordWorkflowStageTransition(
  fromStage: string,
  toStage: string,
  transitionDuration: number
): void {
  addSpanEvent('workflow.stage_transition', {
    'workflow.from_stage': fromStage,
    'workflow.to_stage': toStage,
    'workflow.transition_duration_ms': transitionDuration
  });
}

/**
 * Record SDUI component generation
 */
export function recordSDUIComponentGeneration(
  componentType: string,
  componentCount: number,
  generationTime: number
): void {
  addSpanEvent('sdui.component_generated', {
    'sdui.component_type': componentType,
    'sdui.component_count': componentCount,
    'sdui.generation_time_ms': generationTime
  });
}

/**
 * Record ROI calculation
 */
export function recordROICalculation(
  calculationType: string,
  inputVariableCount: number,
  calculationTime: number,
  result: number
): void {
  addSpanEvent('roi.calculation_complete', {
    'roi.calculation_type': calculationType,
    'roi.input_variables': inputVariableCount,
    'roi.calculation_time_ms': calculationTime,
    'roi.result_value': result
  });
}

/**
 * Record value prediction
 */
export function recordValuePrediction(
  predictionType: string,
  predictedValue: number,
  confidence: number,
  baselineValue?: number
): void {
  const attributes: Record\u003cstring, string | number | boolean\u003e = {
    'prediction.type': predictionType,
    'prediction.value': predictedValue,
    'prediction.confidence': confidence
  };
  
  if (baselineValue !== undefined) {
    attributes['prediction.baseline'] = baselineValue;
    attributes['prediction.delta'] = predictedValue - baselineValue;
    attributes['prediction.delta_percent'] = ((predictedValue - baselineValue) / baselineValue) * 100;
  }
  
  addSpanEvent('value.prediction_made', attributes);
}
