/**
 * Chat Canvas Types
 *
 * Shared types for ChatCanvas components with enhanced type safety
 */

import { SDUIPageDefinition } from "../../sdui/schema";
import { EnhancedValueCase, CaseId } from "../../types/enhancedTypes";
import { WorkflowState } from "../../repositories/WorkflowStateRepository";
import { RenderPageResult } from "../../sdui/renderPage";
import { StreamingUpdate } from "../../services/UnifiedAgentOrchestrator";
import {
  StrictChatRequest,
  StrictChatResponse,
  StrictStreamingUpdate,
  StrictCanvasWorkspaceProps,
  StrictCommandInterfaceProps,
  StrictFormState,
  StrictModalState,
  ModalType,
  ValidationResult
} from "./types/enhanced";

// Re-export enhanced types for backward compatibility
export type ValueCase = EnhancedValueCase;

export interface ChatCanvasLayoutProps {
  onSettingsClick?: () => void;
  onHelpClick?: () => void;
  initialAction?: {
    type: string;
    data: unknown;
  } | null;
}

// Type-safe event handlers
export interface CanvasEventHandlers {
  onCaseSelect: (caseId: CaseId) => void;
  onCommand: (command: string) => Promise<void>;
  onStarterAction: (action: string, data?: unknown) => void;
  onNewCase: () => void;
}

// Strongly typed component props
export interface CaseSidebarProps extends CanvasEventHandlers {
  cases: readonly ValueCase[];
  selectedCaseId: CaseId | null;
  isFetchingCases: boolean;
}

export interface CanvasWorkspaceProps extends StrictCanvasWorkspaceProps {
  // Inherits all strict props with proper typing
}

export interface CommandInterfaceProps extends StrictCommandInterfaceProps {
  // Inherits all strict props with proper typing
}

// Enhanced form and modal state types
export type FormState = StrictFormState;
export type ModalState = StrictModalState;

// Enhanced request/response types
export type ChatRequest = StrictChatRequest;
export type ChatResponse = StrictChatResponse;
export type TypedStreamingUpdate = StrictStreamingUpdate;

// Utility types for better type safety
export interface ComponentState {
  isLoading: boolean;
  error: string | null;
  lastUpdated: number;
}

export interface UserContext {
  userId: string;
  tenantId: string;
  email?: string;
  createdAt: string | null;
  permissions: readonly string[];
}

export interface SessionContext {
  sessionId: string;
  caseId: CaseId;
  userId: string;
  tenantId: string;
  isActive: boolean;
  createdAt: string;
  lastActivity: string;
}

// Validation types
export interface FormValidation {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

// Event types for analytics and telemetry
export interface CanvasEvent {
  type: 'case_selected' | 'command_submitted' | 'modal_opened' | 'form_submitted' | 'error_occurred';
  timestamp: number;
  sessionId: string;
  caseId?: CaseId;
  data?: Record<string, unknown>;
  metadata?: {
    source: string;
    version: string;
    userId: string;
  };
}

// Error handling types
export interface CanvasError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
  recoverable: boolean;
  stack?: string;
}

// Performance metrics
export interface PerformanceMetrics {
  renderTime: number;
  componentCount: number;
  hydrationTime: number;
  errorCount: number;
  memoryUsage?: number;
}

// Configuration types
export interface CanvasConfig {
  enableDebugMode: boolean;
  enableTelemetry: boolean;
  maxSessionAge: number; // in minutes
  retryAttempts: number;
  cacheEnabled: boolean;
}

// Export all enhanced types for convenience
export type {
  StrictChatRequest as TypedChatRequest,
  StrictChatResponse as TypedChatResponse,
  StrictStreamingUpdate as TypedStreamingUpdate,
  StrictCanvasWorkspaceProps as TypedCanvasWorkspaceProps,
  StrictCommandInterfaceProps as TypedCommandInterfaceProps,
  StrictFormState as TypedFormState,
  StrictModalState as TypedModalState,
  ModalType,
  ValidationResult
} from "./types/enhanced";
