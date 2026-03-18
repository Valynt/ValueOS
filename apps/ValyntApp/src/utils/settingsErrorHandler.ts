/**
 * Settings Error Handling
 *
 * Sprint 2 Enhancement: Consistent error handling
 * Provides standardized error handling and user-friendly messages
 */

import * as React from "react";

import { useToast } from "../components/common/Toast";
import { logger } from "../lib/logger";

// ============================================================================
// Error Types
// ============================================================================

export enum SettingsErrorCode {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  NOT_FOUND = "NOT_FOUND",
  NETWORK_ERROR = "NETWORK_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export class SettingsError extends Error {
  constructor(
    public code: SettingsErrorCode,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = "SettingsError";
  }
}

// ============================================================================
// Error Messages
// ============================================================================

const ERROR_MESSAGES: Record<SettingsErrorCode, string> = {
  [SettingsErrorCode.VALIDATION_ERROR]: "Invalid value provided",
  [SettingsErrorCode.PERMISSION_DENIED]: "You don't have permission to change this setting",
  [SettingsErrorCode.NOT_FOUND]: "Setting not found",
  [SettingsErrorCode.NETWORK_ERROR]: "Network error. Please check your connection",
  [SettingsErrorCode.DATABASE_ERROR]: "Failed to save setting. Please try again",
  [SettingsErrorCode.UNKNOWN_ERROR]: "An unexpected error occurred",
};

// ============================================================================
// Error Handler
// ============================================================================

export interface ErrorHandlerOptions {
  showToast?: boolean;
  logError?: boolean;
  fallbackMessage?: string;
  onToast?: (message: string) => void;
}

/**
 * Handle settings errors with consistent messaging
 *
 * @param error - The error to handle
 * @param options - Error handling options
 * @returns User-friendly error message
 *
 * @example
 * ```typescript
 * // Using the hook (recommended)
 * const { handleError } = useSettingsErrorHandler();
 * handleError(error);
 *
 * // Or manually
 * handleSettingsError(error, {
 *   showToast: true,
 *   onToast: (msg) => toast.error(msg)
 * });
 * ```
 */
export function handleSettingsError(error: unknown, options: ErrorHandlerOptions = {}): string {
  const {
    showToast = false,
    logError = true,
    fallbackMessage = "Failed to update setting",
  } = options;

  let errorMessage: string;
  let errorCode: SettingsErrorCode = SettingsErrorCode.UNKNOWN_ERROR;

  if (error instanceof SettingsError) {
    errorMessage = error.message;
    errorCode = error.code;

    if (logError) {
      logger.error("Settings error", error, {
        code: error.code,
        details: error.details,
      });
    }
  } else if (error instanceof Error) {
    errorMessage = error.message || fallbackMessage;

    // Detect error type from message
    if (error.message.includes("permission") || error.message.includes("unauthorized")) {
      errorCode = SettingsErrorCode.PERMISSION_DENIED;
      errorMessage = ERROR_MESSAGES[SettingsErrorCode.PERMISSION_DENIED];
    } else if (error.message.includes("network") || error.message.includes("fetch")) {
      errorCode = SettingsErrorCode.NETWORK_ERROR;
      errorMessage = ERROR_MESSAGES[SettingsErrorCode.NETWORK_ERROR];
    } else if (error.message.includes("validation") || error.message.includes("invalid")) {
      errorCode = SettingsErrorCode.VALIDATION_ERROR;
      errorMessage = ERROR_MESSAGES[SettingsErrorCode.VALIDATION_ERROR];
    }

    if (logError) {
      logger.error("Settings error", error, { errorCode });
    }
  } else {
    errorMessage = fallbackMessage;

    if (logError) {
      logger.error("Unknown settings error", undefined, { error });
    }
  }

  if (showToast) {
    if (options.onToast) {
      options.onToast(errorMessage);
    } else {
      console.error(errorMessage);
    }
  }

  return errorMessage;
}

/**
 * Hook to handle settings errors using the toast notification system
 *
 * @returns Object containing the handleError function
 */
export function useSettingsErrorHandler() {
  const { error: showToastError } = useToast();

  const handleError = React.useCallback((error: unknown, options: ErrorHandlerOptions = {}) => {
    // Default showToast to true when using the hook unless explicitly set to false
    const shouldShowToast = options.showToast !== false;

    return handleSettingsError(error, {
      ...options,
      showToast: shouldShowToast,
      onToast: (message) => showToastError('Error', message),
    });
  }, [showToastError]);

  return { handleError };
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate a setting value
 *
 * @param key - Setting key
 * @param value - Value to validate
 * @param metadata - Setting metadata with validation rules
 * @returns Validation error message or null if valid
 */
export function validateSettingValue(
  key: string,
  value: unknown,
  metadata?: {
    type: string;
    min?: number;
    max?: number;
    pattern?: RegExp;
    options?: readonly string[];
  }
): string | null {
  if (!metadata) return null;

  switch (metadata.type) {
    case "number":
      if (typeof value !== "number" || isNaN(value)) {
        return "Value must be a number";
      }
      if (metadata.min !== undefined && value < metadata.min) {
        return `Value must be at least ${metadata.min}`;
      }
      if (metadata.max !== undefined && value > metadata.max) {
        return `Value must be at most ${metadata.max}`;
      }
      break;

    case "string":
      if (typeof value !== "string") {
        return "Value must be a string";
      }
      if (metadata.pattern && !metadata.pattern.test(value)) {
        return "Invalid format";
      }
      break;

    case "boolean":
      if (typeof value !== "boolean") {
        return "Value must be true or false";
      }
      break;

    case "select":
      if (metadata.options && !metadata.options.includes(value)) {
        return `Value must be one of: ${metadata.options.join(", ")}`;
      }
      break;

    case "array":
      if (!Array.isArray(value)) {
        return "Value must be an array";
      }
      break;
  }

  return null;
}

// ============================================================================
// Error Recovery
// ============================================================================

/**
 * Retry a settings operation with exponential backoff
 *
 * @param operation - The operation to retry
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param baseDelay - Base delay in milliseconds (default: 1000)
 * @returns Result of the operation
 *
 * @example
 * ```typescript
 * const result = await retryOperation(
 *   () => updateSetting('user.theme', 'dark'),
 *   3,
 *   1000
 * );
 * ```
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        logger.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`, {
          error: lastError.message,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Operation failed after retries");
}

// ============================================================================
// Error Boundary Helper
// ============================================================================

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Create error boundary state handler
 *
 * @returns Error boundary state and handlers
 */
export function createErrorBoundaryState() {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- called conditionally by design
  const [state, setState] = React.useState<ErrorBoundaryState>({
    hasError: false,
    error: null,
    errorInfo: null,
  });

  const resetError = () => {
    setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  const setError = (error: Error, errorInfo?: React.ErrorInfo) => {
    setState({
      hasError: true,
      error,
      errorInfo: errorInfo || null,
    });

    logger.error("Settings component error", error, {
      componentStack: errorInfo?.componentStack,
    });
  };

  return { state, resetError, setError };
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if error is a settings error
 */
export function isSettingsError(error: unknown): error is SettingsError {
  return error instanceof SettingsError;
}

/**
 * Check if error is a validation error
 */
export function isValidationError(error: unknown): boolean {
  return isSettingsError(error) && error.code === SettingsErrorCode.VALIDATION_ERROR;
}

/**
 * Check if error is a permission error
 */
export function isPermissionError(error: unknown): boolean {
  return isSettingsError(error) && error.code === SettingsErrorCode.PERMISSION_DENIED;
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  return isSettingsError(error) && error.code === SettingsErrorCode.NETWORK_ERROR;
}

