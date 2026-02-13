/**
 * Type Exports
 */

export * from "./api";
export * from "./core";
export * from "./vos";
export {
  type WorkflowStatus,
  type StageStatus,
  type RetryConfig,
  type WorkflowStage,
  type WorkflowTransition,
  type WorkflowDAG,
  type CircuitBreakerState,
  type ExecutedStep,
  type CompensationPolicy,
  type RollbackState,
  type WorkflowExecutionLog,
  type WorkflowEvent,
  type WorkflowAuditLog,
  type CompensationContext,
} from "./workflow";

export interface CanvasComponent {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children?: CanvasComponent[];
  position: { x: number; y: number; z?: number };
  size: { width: number; height: number };
  style?: Record<string, unknown>;
  className?: string;
  visible?: boolean;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}
