/**
 * Settings Async Feedback Components
 * Phase 3: End-User Experience & System Observability
 * 
 * Standardized async feedback for all settings operations
 * Provides consistent loading, success, and error states
 */

import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Loader2, XCircle } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type AsyncState = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncFeedbackProps {
  state: AsyncState;
  successMessage?: string;
  errorMessage?: string;
  onDismiss?: () => void;
  autoHideDuration?: number; // milliseconds
}

// ============================================================================
// Async Feedback Banner
// ============================================================================

/**
 * Banner that shows loading, success, or error state
 * Automatically hides success messages after duration
 * 
 * @example
 * ```tsx
 * const [state, setState] = useState<AsyncState>('idle');
 * 
 * <AsyncFeedbackBanner
 *   state={state}
 *   successMessage="Settings saved successfully"
 *   errorMessage="Failed to save settings"
 *   autoHideDuration={3000}
 * />
 * ```
 */
export const AsyncFeedbackBanner: React.FC<AsyncFeedbackProps> = ({
  state,
  successMessage = 'Operation completed successfully',
  errorMessage = 'Operation failed',
  onDismiss,
  autoHideDuration = 3000,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (state === 'success' || state === 'error') {
      setVisible(true);

      if (state === 'success' && autoHideDuration > 0) {
        const timer = setTimeout(() => {
          setVisible(false);
          onDismiss?.();
        }, autoHideDuration);

        return () => clearTimeout(timer);
      }
    } else {
      setVisible(false);
    }
  }, [state, autoHideDuration, onDismiss]);

  if (!visible) return null;

  const config = {
    success: {
      icon: CheckCircle,
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-800',
      iconColor: 'text-green-600',
      message: successMessage,
    },
    error: {
      icon: XCircle,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-800',
      iconColor: 'text-red-600',
      message: errorMessage,
    },
  };

  const currentConfig = state === 'success' ? config.success : config.error;
  const Icon = currentConfig.icon;

  return (
    <div
      className={`
        flex items-center justify-between p-4 rounded-lg border mb-6
        ${currentConfig.bgColor} ${currentConfig.borderColor}
        animate-slide-down
      `}
      role="alert"
    >
      <div className="flex items-center space-x-3">
        <Icon className={`h-5 w-5 ${currentConfig.iconColor}`} />
        <p className={`text-sm font-medium ${currentConfig.textColor}`}>
          {currentConfig.message}
        </p>
      </div>

      {onDismiss && (
        <button
          onClick={() => {
            setVisible(false);
            onDismiss();
          }}
          className={`
            p-1 rounded hover:bg-white/50 transition-colors
            ${currentConfig.textColor}
          `}
          aria-label="Dismiss"
        >
          <XCircle className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

// ============================================================================
// Inline Async Status
// ============================================================================

/**
 * Inline status indicator for form fields
 * Shows loading spinner, checkmark, or error icon
 */
export const InlineAsyncStatus: React.FC<{
  state: AsyncState;
  successText?: string;
  errorText?: string;
}> = ({ state, successText = 'Saved', errorText = 'Error' }) => {
  if (state === 'idle') return null;

  if (state === 'loading') {
    return (
      <span className="inline-flex items-center text-sm text-gray-600">
        <Loader2 className="h-4 w-4 animate-spin mr-1" />
        Saving...
      </span>
    );
  }

  if (state === 'success') {
    return (
      <span className="inline-flex items-center text-sm text-green-600">
        <CheckCircle className="h-4 w-4 mr-1" />
        {successText}
      </span>
    );
  }

  if (state === 'error') {
    return (
      <span className="inline-flex items-center text-sm text-red-600">
        <AlertCircle className="h-4 w-4 mr-1" />
        {errorText}
      </span>
    );
  }

  return null;
};

// ============================================================================
// Settings Save Button with State
// ============================================================================

/**
 * Save button that shows loading state and feedback
 */
export const AsyncSaveButton: React.FC<{
  state: AsyncState;
  onClick: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
}> = ({ state, onClick, disabled, children = 'Save Changes' }) => {
  const isLoading = state === 'loading';
  const isDisabled = disabled || isLoading;

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`
        flex items-center justify-center px-4 py-2 rounded-lg
        font-medium transition-all
        ${
          isDisabled
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }
      `}
    >
      {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
      {state === 'success' && <CheckCircle className="h-4 w-4 mr-2" />}
      {children}
    </button>
  );
};

// ============================================================================
// Settings Section with Async State
// ============================================================================

/**
 * Wrapper for settings sections with built-in async feedback
 */
export const AsyncSettingsSection: React.FC<{
  title: string;
  description?: string;
  state: AsyncState;
  successMessage?: string;
  errorMessage?: string;
  onSave?: () => void;
  children: React.ReactNode;
}> = ({
  title,
  description,
  state,
  successMessage,
  errorMessage,
  onSave,
  children,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
        </div>
        <InlineAsyncStatus state={state} />
      </div>

      <AsyncFeedbackBanner
        state={state}
        successMessage={successMessage}
        errorMessage={errorMessage}
      />

      <div className="space-y-4">{children}</div>

      {onSave && (
        <div className="flex justify-end pt-4 border-t">
          <AsyncSaveButton state={state} onClick={onSave}>
            Save Changes
          </AsyncSaveButton>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Hook for Managing Async State
// ============================================================================

/**
 * Hook to manage async operation state
 * 
 * @example
 * ```tsx
 * const { state, execute, reset } = useAsyncState();
 * 
 * const handleSave = async () => {
 *   await execute(async () => {
 *     await saveSetting('key', 'value');
 *   });
 * };
 * ```
 */
export function useAsyncState() {
  const [state, setState] = useState<AsyncState>('idle');
  const [error, setError] = useState<Error | null>(null);

  const execute = async <T,>(operation: () => Promise<T>): Promise<T | null> => {
    setState('loading');
    setError(null);

    try {
      const result = await operation();
      setState('success');
      return result;
    } catch (err) {
      setState('error');
      setError(err as Error);
      return null;
    }
  };

  const reset = () => {
    setState('idle');
    setError(null);
  };

  return {
    state,
    error,
    execute,
    reset,
    isLoading: state === 'loading',
    isSuccess: state === 'success',
    isError: state === 'error',
  };
}

// ============================================================================
// Global Settings Error Handler
// ============================================================================

export interface SettingsError {
  code: string;
  message: string;
  field?: string;
  details?: Record<string, any>;
}

/**
 * Parse and format settings errors for user display
 */
export function formatSettingsError(error: unknown): string {
  if (!error) return 'An unknown error occurred';

  // Handle SettingsError type
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const err = error as SettingsError;
    
    // Add field context if available
    if (err.field) {
      return `${err.field}: ${err.message}`;
    }
    
    return err.message;
  }

  // Handle Error type
  if (error instanceof Error) {
    // Parse common error patterns
    if (error.message.includes('permission')) {
      return 'You do not have permission to change this setting';
    }
    if (error.message.includes('network')) {
      return 'Network error. Please check your connection and try again';
    }
    if (error.message.includes('validation')) {
      return 'Invalid value. Please check your input and try again';
    }
    
    return error.message;
  }

  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }

  return 'An unexpected error occurred. Please try again';
}

// ============================================================================
// Settings Error Boundary
// ============================================================================

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class SettingsErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Settings Error Boundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <XCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-red-900">
                Settings Error
              </h3>
              <p className="text-sm text-red-700 mt-1">
                {formatSettingsError(this.state.error)}
              </p>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
