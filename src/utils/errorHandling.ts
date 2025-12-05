/**
 * Error Handling Utilities
 * Provides specific, user-friendly error messages
 */

export enum ErrorType {
  NETWORK = 'NETWORK_ERROR',
  VALIDATION = 'VALIDATION_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
  AUTH = 'AUTH_ERROR',
  FILE_UPLOAD = 'FILE_UPLOAD_ERROR',
  PARSE = 'PARSE_ERROR',
  AI_GENERATION = 'AI_GENERATION_ERROR',
  DATABASE = 'DATABASE_ERROR',
  UNKNOWN = 'UNKNOWN_ERROR',
}

export interface UserFriendlyError {
  type: ErrorType;
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}

export class AppError extends Error {
  constructor(
    public type: ErrorType,
    public userMessage: string,
    public originalError?: Error,
    public metadata?: Record<string, any>
  ) {
    super(userMessage);
    this.name = 'AppError';
  }
}

/**
 * Convert any error to a user-friendly format
 */
export function toUserFriendlyError(
  error: unknown,
  context?: string,
  retryAction?: () => void
): UserFriendlyError {
  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      type: ErrorType.NETWORK,
      title: 'Connection Lost',
      message: 'Please check your internet connection and try again',
      action: retryAction ? { label: 'Retry', onClick: retryAction } : undefined,
      duration: 0, // Persist until dismissed
    };
  }

  // App-specific errors
  if (error instanceof AppError) {
    return {
      type: error.type,
      title: getErrorTitle(error.type),
      message: error.userMessage,
      action: retryAction ? { label: 'Retry', onClick: retryAction } : undefined,
      duration: error.type === ErrorType.RATE_LIMIT ? 30000 : 0,
    };
  }

  // HTTP errors
  if (error && typeof error === 'object' && 'status' in error) {
    const httpError = error as { status: number; message?: string };
    
    if (httpError.status === 429) {
      return {
        type: ErrorType.RATE_LIMIT,
        title: 'Too Many Requests',
        message: 'Please wait 30 seconds before trying again',
        duration: 30000,
      };
    }
    
    if (httpError.status === 401 || httpError.status === 403) {
      return {
        type: ErrorType.AUTH,
        title: 'Authentication Error',
        message: 'Please sign in again to continue',
        duration: 0,
      };
    }
    
    if (httpError.status >= 500) {
      return {
        type: ErrorType.DATABASE,
        title: 'Server Error',
        message: 'Our servers are experiencing issues. Please try again in a moment',
        action: retryAction ? { label: 'Retry', onClick: retryAction } : undefined,
        duration: 0,
      };
    }
  }

  // File upload errors
  if (error && typeof error === 'object' && 'name' in error && error.name === 'FileError') {
    return {
      type: ErrorType.FILE_UPLOAD,
      title: 'File Upload Failed',
      message: getFileErrorMessage(error),
      action: retryAction ? { label: 'Try Another File', onClick: retryAction } : undefined,
      duration: 0,
    };
  }

  // Generic fallback
  const errorMessage = error instanceof Error ? error.message : String(error);
  return {
    type: ErrorType.UNKNOWN,
    title: context ? `${context} Failed` : 'An Error Occurred',
    message: errorMessage || 'Something went wrong. Please try again',
    action: retryAction ? { label: 'Retry', onClick: retryAction } : undefined,
    duration: 0,
  };
}

function getErrorTitle(type: ErrorType): string {
  switch (type) {
    case ErrorType.NETWORK:
      return 'Connection Lost';
    case ErrorType.VALIDATION:
      return 'Invalid Input';
    case ErrorType.RATE_LIMIT:
      return 'Too Many Requests';
    case ErrorType.AUTH:
      return 'Authentication Error';
    case ErrorType.FILE_UPLOAD:
      return 'File Upload Failed';
    case ErrorType.PARSE:
      return 'Could Not Parse File';
    case ErrorType.AI_GENERATION:
      return 'AI Analysis Failed';
    case ErrorType.DATABASE:
      return 'Database Error';
    default:
      return 'Error';
  }
}

function getFileErrorMessage(error: any): string {
  const fileType = error.fileType || 'file';
  const maxSize = error.maxSize || '10MB';
  
  if (error.code === 'FILE_TOO_LARGE') {
    return `File is too large. Maximum size is ${maxSize}`;
  }
  
  if (error.code === 'INVALID_TYPE') {
    return `File type not supported. Please upload PDF, DOC, or TXT files`;
  }
  
  if (error.code === 'PARSE_FAILED') {
    return `Could not read ${fileType}. Please try a different file`;
  }
  
  return 'File upload failed. Please try again';
}

/**
 * Create specific error types
 */
export const createFileError = (code: string, fileType?: string, maxSize?: string) => {
  const error = new Error('File error');
  (error as any).name = 'FileError';
  (error as any).code = code;
  (error as any).fileType = fileType;
  (error as any).maxSize = maxSize;
  return error;
};

export const createNetworkError = (message: string = 'Network request failed') => {
  return new AppError(ErrorType.NETWORK, message);
};

export const createValidationError = (message: string) => {
  return new AppError(ErrorType.VALIDATION, message);
};

export const createRateLimitError = () => {
  return new AppError(
    ErrorType.RATE_LIMIT,
    'Too many requests. Please wait 30 seconds before trying again'
  );
};

export const createAIError = (message: string = 'AI analysis failed') => {
  return new AppError(ErrorType.AI_GENERATION, message);
};
