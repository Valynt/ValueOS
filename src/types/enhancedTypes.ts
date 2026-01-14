/**
 * Enhanced Type Definitions
 *
 * Provides stricter type safety with branded types, discriminated unions,
 * and comprehensive validation schemas.
 */

// Branded types for type safety
export type CaseId = string & { readonly brand: unique symbol };
export type UserId = string & { readonly brand: unique symbol };
export type TenantId = string & { readonly brand: unique symbol };
export type SessionId = string & { readonly brand: unique symbol };

// Type guards for branded types
export const isCaseId = (value: string): value is CaseId =>
  typeof value === 'string' && value.length > 0 && /^[a-zA-Z0-9_-]+$/.test(value);

export const isUserId = (value: string): value is UserId =>
  typeof value === 'string' && value.length > 0 && /^[a-zA-Z0-9_-]+$/.test(value);

export const isTenantId = (value: string): value is TenantId =>
  typeof value === 'string' && value.length > 0 && /^[a-zA-Z0-9_-]+$/.test(value);

export const isSessionId = (value: string): value is SessionId =>
  typeof value === 'string' && value.length > 0 && /^[a-zA-Z0-9_-]+$/.test(value);

// Factory functions for creating branded types
export const createCaseId = (value: string): CaseId => {
  if (!isCaseId(value)) {
    throw new Error(`Invalid CaseId format: ${value}`);
  }
  return value as CaseId;
};

export const createUserId = (value: string): UserId => {
  if (!isUserId(value)) {
    throw new Error(`Invalid UserId format: ${value}`);
  }
  return value as UserId;
};

export const createTenantId = (value: string): TenantId => {
  if (!isTenantId(value)) {
    throw new Error(`Invalid TenantId format: ${value}`);
  }
  return value as TenantId;
};

export const createSessionId = (value: string): SessionId => {
  if (!isSessionId(value)) {
    throw new Error(`Invalid SessionId format: ${value}`);
  }
  return value as SessionId;
};

// Enhanced Workflow State with stricter typing
export interface EnhancedWorkflowState {
  readonly currentStage: LifecycleStage;
  readonly status: WorkflowStatus;
  readonly completedStages: readonly LifecycleStage[];
  readonly context: Readonly<WorkflowContext>;
  readonly metadata: Readonly<WorkflowMetadata>;
}

export interface WorkflowContext {
  readonly caseId: CaseId;
  readonly company: string;
  readonly industry?: string;
  readonly lastQuery?: string;
  readonly lastResponse?: string;
  readonly lastUpdated?: string;
  readonly lastAnalysis?: Record<string, unknown>;
}

export interface WorkflowMetadata {
  readonly startedAt: string;
  readonly lastUpdatedAt: string;
  readonly errorCount: number;
  readonly retryCount: number;
  readonly version?: number;
}

// Discriminated unions for better type safety
export type LifecycleStage =
  | { readonly type: 'opportunity'; readonly phase: 'discovery' }
  | { readonly type: 'target'; readonly phase: 'modeling' }
  | { readonly type: 'realization'; readonly phase: 'tracking' }
  | { readonly type: 'expansion'; readonly phase: 'growth' };

export type WorkflowStatus =
  | { readonly type: 'in_progress'; readonly progress: number }
  | { readonly type: 'completed'; readonly completedAt: string }
  | { readonly type: 'paused'; readonly reason: string }
  | { readonly type: 'error'; readonly error: string };

// Enhanced Value Case types
export interface EnhancedValueCase {
  readonly id: CaseId;
  readonly name: string;
  readonly company: string;
  readonly stage: ValueCaseStage;
  readonly status: ValueCaseStatus;
  readonly updatedAt: Date;
  readonly sduiPage?: SDUIPageDefinition;
  readonly metadata: Readonly<ValueCaseMetadata>;
}

export interface ValueCaseMetadata {
  readonly createdAt: Date;
  readonly createdBy: UserId;
  readonly tenantId: TenantId;
  readonly tags: readonly string[];
  readonly priority: ValueCasePriority;
}

export type ValueCaseStage = 'opportunity' | 'target' | 'realization' | 'expansion';
export type ValueCaseStatus = 'in-progress' | 'completed' | 'paused';
export type ValueCasePriority = 'low' | 'medium' | 'high' | 'critical';

// Type-safe API request/response types
export interface TypedChatRequest {
  readonly query: string;
  readonly caseId: CaseId;
  readonly userId: UserId;
  readonly sessionId: SessionId;
  readonly tenantId: TenantId;
  readonly workflowState: EnhancedWorkflowState;
  readonly context?: Readonly<ChatContext>;
}

export interface ChatContext {
  readonly userRole?: string;
  readonly permissions: readonly string[];
  readonly features: readonly string[];
  readonly locale: string;
}

export interface TypedChatResponse {
  readonly message: ConversationMessage;
  readonly sduiPage?: SDUIPageDefinition;
  readonly nextState: EnhancedWorkflowState;
  readonly traceId: string;
  readonly metadata: Readonly<ResponseMetadata>;
}

export interface ResponseMetadata {
  readonly processingTimeMs: number;
  readonly confidence: number;
  readonly model: string;
  readonly timestamp: string;
}

// Type-safe SDUI definitions
export interface TypedSDUIPageDefinition {
  readonly type: 'page';
  readonly version: number;
  readonly sections: readonly SDUISection[];
  readonly metadata: Readonly<SDUIMetadata>;
}

export interface SDUISection {
  readonly type: 'component' | 'layout';
  readonly component?: string;
  readonly version: number;
  readonly props?: Readonly<Record<string, unknown>>;
  readonly layout?: string;
  readonly children?: readonly SDUISection[];
}

export interface SDUIMetadata {
  readonly case_id: CaseId;
  readonly session_id: SessionId;
  readonly trace_id: string;
  readonly generated_at: number;
  readonly priority: 'low' | 'medium' | 'high';
}

// Type-safe validation schemas
export interface ValidationSchema<T> {
  parse: (input: unknown) => T;
  safeParse: (input: unknown) => { success: true; data: T } | { success: false; error: string };
}

// Type guards for runtime validation
export const isEnhancedWorkflowState = (obj: unknown): obj is EnhancedWorkflowState => {
  if (!obj || typeof obj !== 'object') return false;

  const state = obj as any;
  return (
    typeof state.currentStage === 'string' &&
    typeof state.status === 'string' &&
    Array.isArray(state.completedStages) &&
    typeof state.context === 'object' &&
    typeof state.metadata === 'object'
  );
};

export const isTypedChatRequest = (obj: unknown): obj is TypedChatRequest => {
  if (!obj || typeof obj !== 'object') return false;

  const req = obj as any;
  return (
    typeof req.query === 'string' &&
    typeof req.caseId === 'string' &&
    typeof req.userId === 'string' &&
    typeof req.sessionId === 'string' &&
    typeof req.tenantId === 'string' &&
    isEnhancedWorkflowState(req.workflowState)
  );
};

// Utility types for better inference
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Type-safe event handling
export interface TypedEvent<T = void> {
  readonly type: string;
  readonly payload: T;
  readonly timestamp: number;
}

export type EventHandler<T> = (event: TypedEvent<T>) => void;

// Type-safe async operations
export interface AsyncResult<T, E = Error> {
  readonly status: 'pending' | 'success' | 'error';
  readonly data?: T;
  readonly error?: E;
  readonly timestamp: number;
}

export const createAsyncResult = <T>(): {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  promise: Promise<AsyncResult<T>>;
} => {
  let resolve: (value: T) => void;
  let reject: (error: Error) => void;

  const promise = new Promise<AsyncResult<T>>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    resolve: (value: T) => resolve({ status: 'success', data: value, timestamp: Date.now() }),
    reject: (error: Error) => reject({ status: 'error', error, timestamp: Date.now() }),
    promise
  };
};
