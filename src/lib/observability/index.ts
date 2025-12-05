/**
 * Observability Module
 * 
 * Central export for all observability functionality
 */

export {
  initializeObservability,
  shutdownObservability,
  isObservabilityEnabled
} from './instrumentation';

export {
  initializeTelemetry,
  getTracer,
  traceLLMOperation,
  traceDatabaseOperation,
  traceCacheOperation,
  addSpanAttributes,
  addSpanEvent,
  recordSpanException,
  getCurrentTraceContext,
  getTraceContextForLogging,
  createCounter,
  createHistogram,
  createObservableGauge,
  metrics,
  tracingMiddleware
} from '../../config/telemetry';

export {
  traceAgentExecution,
  traceAgentInvocation,
  traceValuePrediction,
  addAgentEvent,
  recordAgentConfidence,
  recordAgentReasoning
} from './agentTracing';

export {
  traceValueTreeOperation,
  traceWorkflowOperation,
  traceSDUIGeneration,
  recordValueTreeMetrics,
  recordWorkflowStageTransition,
  recordSDUIComponentGeneration,
  recordROICalculation,
  recordValuePrediction
} from './criticalPathTracing';

export type { AgentSpanAttributes } from './agentTracing';
