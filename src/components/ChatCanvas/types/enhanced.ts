/**
 * Enhanced Type Definitions for Canvas Pipeline
 *
 * Replaces 'any' types with strict, well-defined interfaces
 * for better type safety and developer experience.
 */

import { SDUIPageDefinition } from '../../sdui/schema';
import { WorkflowState } from '../../repositories/WorkflowStateRepository';
import { CaseId } from '../../types/enhancedTypes';
import { LifecycleStage } from '../../types/vos';

// ============================================================================
// Enhanced Agent Chat Service Types
// ============================================================================

export interface StrictChatRequest {
  query: string;
  caseId: CaseId;
  userId: string;
  sessionId: string;
  tenantId?: string;
  workflowState: WorkflowState;
}

export interface StrictChatResponse {
  message: StrictConversationMessage;
  sduiPage?: SDUIPageDefinition;
  nextState: WorkflowState;
  traceId: string;
  metadata?: ChatResponseMetadata;
}

export interface StrictConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  agentName?: string;
  confidence: number;
  reasoning: string[];
  status: 'pending' | 'completed' | 'error';
  metadata?: MessageMetadata;
}

export interface ChatResponseMetadata {
  processingTimeMs: number;
  modelUsed: string;
  tokenCount?: number;
  cacheHit: boolean;
}

export interface MessageMetadata {
  source: 'ai' | 'template' | 'fallback';
  version: string;
  correlationId?: string;
}

// ============================================================================
// Enhanced AI Response Schema
// ============================================================================

export interface StrictAIResponseSchema {
  analysisSummary: string;
  identifiedIndustry: string;
  confidence: number; // 0-100
  valueHypotheses: readonly StrictValueHypothesis[];
  keyMetrics: readonly StrictKeyMetric[];
  recommendedActions: readonly string[];
  metadata?: AIMetadata;
}

export interface StrictValueHypothesis {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly impact: 'High' | 'Medium' | 'Low';
  readonly confidence: number; // 0-100
  readonly category: string;
  readonly estimatedValue?: number;
  readonly timeframe?: string;
}

export interface StrictKeyMetric {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly trend: 'up' | 'down' | 'neutral';
  readonly unit?: string;
  readonly target?: string;
  readonly category: 'financial' | 'operational' | 'strategic';
}

export interface AIMetadata {
  modelVersion: string;
  processingTimeMs: number;
  tokenCount: {
    input: number;
    output: number;
    total: number;
  };
  temperature: number;
  templateUsed?: string;
}

// ============================================================================
// Enhanced Streaming Types
// ============================================================================

export interface StrictStreamingUpdate {
  stage: StreamingStage;
  message: string;
  progress?: number; // 0-1
  timestamp: number;
  traceId?: string;
  metadata?: StreamingMetadata;
}

export type StreamingStage =
  | 'analyzing'
  | 'processing'
  | 'generating'
  | 'hydrating'
  | 'rendering'
  | 'complete'
  | 'error';

export interface StreamingMetadata {
  componentCount?: number;
  estimatedTimeRemaining?: number;
  currentComponent?: string;
  retryCount?: number;
}

// ============================================================================
// Enhanced Canvas Types
// ============================================================================

export interface StrictCanvasWorkspaceProps {
  renderedPage: StrictRenderPageResult | null;
  isLoading: boolean;
  streamingUpdate: StrictStreamingUpdate | null;
  isInitialLoad?: boolean;
  error?: CanvasError;
}

export interface StrictRenderPageResult {
  element: React.ReactElement;
  warnings: readonly string[];
  metadata: {
    componentCount: number;
    hydratedComponentCount: number;
    version: number;
    renderTimeMs?: number;
    errors: readonly ComponentError[];
  };
}

export interface CanvasError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
  recoverable: boolean;
}

export interface ComponentError {
  component: string;
  error: string;
  timestamp: number;
  recovered: boolean;
}

// ============================================================================
// Enhanced Command Interface Types
// ============================================================================

export interface StrictCommandInterfaceProps {
  selectedCaseId: CaseId | null;
  workflowState: WorkflowState | null;
  currentSessionId: string | null;
  sessionId: string | null;
  isLoading: boolean;
  onCommand: (command: string) => Promise<void>;
  onCaseSelect: (caseId: CaseId) => void;
  onStarterAction: (action: string, data?: unknown) => void;
  onNewCase: () => void;
}

export interface CommandPayload {
  type: 'query' | 'action' | 'navigation';
  content: string;
  metadata?: CommandMetadata;
}

export interface CommandMetadata {
  source: 'user_input' | 'voice' | 'template' | 'shortcut';
  timestamp: number;
  sessionId: string;
  context?: Record<string, unknown>;
}

// ============================================================================
// Enhanced Modal Types
// ============================================================================

export type ModalType =
  | 'newCase'
  | 'uploadNotes'
  | 'emailAnalysis'
  | 'crmImport'
  | 'salesCall'
  | 'sync'
  | 'export'
  | 'betaHub';

export interface StrictModalState {
  readonly [K in ModalType]: {
    isOpen: boolean;
    data?: unknown;
    metadata?: ModalMetadata;
  };
}

export interface ModalMetadata {
  trigger: 'button_click' | 'keyboard_shortcut' | 'auto_open';
  timestamp: number;
  source?: string;
}

// ============================================================================
// Enhanced Form Types
// ============================================================================

export interface StrictFormState {
  newCase: {
    company: string;
    website: string;
    industry?: string;
    stage: LifecycleStage;
  };
  upload: {
    file: File | null;
    fileName: string;
    fileSize: number;
    fileType: string;
  };
  crm: {
    url: string;
    provider: 'salesforce' | 'hubspot' | 'other';
    credentials?: CRMCredentials;
  };
}

export interface CRMCredentials {
  apiKey?: string;
  domain?: string;
  accessToken?: string;
}

// ============================================================================
// Enhanced Event Handler Types
// ============================================================================

export interface StrictCanvasEventHandlers {
  onCaseSelect: (caseId: CaseId) => void;
  onCommand: (command: string) => Promise<void>;
  onStarterAction: (action: string, data?: unknown) => void;
  onNewCase: () => void;
  onModalToggle: (modal: ModalType, isOpen: boolean) => void;
  onFormSubmit: (form: keyof StrictFormState, data: unknown) => void;
  onError: (error: CanvasError) => void;
  onRetry: (operation: string) => void;
}

// ============================================================================
// Enhanced Validation Types
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: readonly ValidationError[];
  warnings: readonly ValidationWarning[];
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  field: string;
  code: string;
  message: string;
  suggestion?: string;
}

// ============================================================================
// Type Guards and Validators
// ============================================================================

export function isValidChatRequest(request: unknown): request is StrictChatRequest {
  return (
    request !== null &&
    typeof request === 'object' &&
    'query' in request &&
    typeof request.query === 'string' &&
    'caseId' in request &&
    typeof request.caseId === 'string' &&
    'userId' in request &&
    typeof request.userId === 'string' &&
    'sessionId' in request &&
    typeof request.sessionId === 'string' &&
    'workflowState' in request
  );
}

export function isValidStreamingUpdate(update: unknown): update is StrictStreamingUpdate {
  return (
    update !== null &&
    typeof update === 'object' &&
    'stage' in update &&
    typeof update.stage === 'string' &&
    'message' in update &&
    typeof update.message === 'string' &&
    'timestamp' in update &&
    typeof update.timestamp === 'number'
  );
}

export function isValidAIResponse(response: unknown): response is StrictAIResponseSchema {
  return (
    response !== null &&
    typeof response === 'object' &&
    'analysisSummary' in response &&
    typeof response.analysisSummary === 'string' &&
    'identifiedIndustry' in response &&
    typeof response.identifiedIndustry === 'string' &&
    'confidence' in response &&
    typeof response.confidence === 'number' &&
    'valueHypotheses' in response &&
    Array.isArray(response.valueHypotheses) &&
    'keyMetrics' in response &&
    Array.isArray(response.keyMetrics) &&
    'recommendedActions' in response &&
    Array.isArray(response.recommendedActions)
  );
}

// ============================================================================
// Utility Types
// ============================================================================

export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// ============================================================================
// Error Types
// ============================================================================

export class CanvasValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: readonly ValidationError[],
    public readonly code: string = 'VALIDATION_ERROR'
  ) {
    super(message);
    this.name = 'CanvasValidationError';
  }
}

export class SessionError extends Error {
  constructor(
    message: string,
    public readonly sessionId?: string,
    public readonly code: string = 'SESSION_ERROR'
  ) {
    super(message);
    this.name = 'SessionError';
  }
}

export class RenderingError extends Error {
  constructor(
    message: string,
    public readonly component: string,
    public readonly originalError?: Error,
    public readonly code: string = 'RENDERING_ERROR'
  ) {
    super(message);
    this.name = 'RenderingError';
  }
}
