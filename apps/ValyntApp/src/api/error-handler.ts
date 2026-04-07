import type { AxiosError } from 'axios';

/**
 * Centralized API error handler.
 * Provides user-friendly error messages and triggers appropriate actions.
 */
export function handleApiError(error: AxiosError): void {
  // Log error for debugging (but not in production to avoid console noise)
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.error('API Error:', error);
  }

  if (!error.response) {
    // Network error or timeout
    // Dispatch custom event that ToastProvider can listen to
    dispatchToastEvent('Network error. Please check your connection and try again.', 'error');
    return;
  }

  const status = error.response.status;
  const data = error.response.data as { message?: string; error?: string } | undefined;
  const message = data?.message || data?.error || 'An error occurred';

  switch (status) {
    case 400:
      dispatchToastEvent(`Invalid request: ${message}`, 'error');
      break;
    case 401:
      // Auth error - redirect to login
      window.location.href = '/login';
      break;
    case 403:
      dispatchToastEvent('You do not have access to this organization', 'error');
      break;
    case 404:
      dispatchToastEvent('Resource not found', 'error');
      break;
    case 409:
      dispatchToastEvent(`Conflict: ${message}`, 'error');
      break;
    case 422:
      dispatchToastEvent(`Validation error: ${message}`, 'error');
      break;
    case 429:
      dispatchToastEvent('Too many requests. Please try again later.', 'error');
      break;
    case 500:
    case 502:
    case 503:
    case 504:
      dispatchToastEvent('Server error. Please try again later.', 'error');
      break;
    default:
      dispatchToastEvent(`Error ${status}: ${message}`, 'error');
  }
}

/**
 * Dispatch a toast event that the ToastProvider can catch
 */
function dispatchToastEvent(message: string, type: 'error' | 'success' | 'info'): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('api-toast', {
        detail: { message, type },
      })
    );
  }
}

/**
 * Check if an error is a specific HTTP status
 */
export function isApiError(error: unknown, status: number): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const axiosError = error as { response?: { status?: number } };
  return axiosError.response?.status === status;
}

/**
 * Check if error is an auth error (401)
 */
export function isAuthError(error: unknown): boolean {
  return isApiError(error, 401);
}

/**
 * Check if error is a permission error (403)
 */
export function isPermissionError(error: unknown): boolean {
  return isApiError(error, 403);
}
