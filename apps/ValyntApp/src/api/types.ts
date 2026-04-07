import type { AxiosError, AxiosResponse } from 'axios';

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  data: T;
  meta?: {
    page?: number;
    perPage?: number;
    total?: number;
    totalPages?: number;
  };
}

/**
 * API error response structure
 */
export interface ApiErrorResponse {
  message: string;
  error?: string;
  code?: string;
  details?: Record<string, string[]>;
}

/**
 * Pagination parameters for list endpoints
 */
export interface PaginationParams {
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Typed Axios error for API calls
 */
export type ApiError = AxiosError<ApiErrorResponse>;

/**
 * Typed Axios response for API calls
 */
export type ApiSuccess<T> = AxiosResponse<ApiResponse<T>>;
