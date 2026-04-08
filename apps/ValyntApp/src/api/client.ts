import axios from 'axios';

import type { AxiosError } from 'axios';

import { supabase } from '@/lib/supabase';

import { handleApiError } from './error-handler';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Centralized API client with tenant-aware request interceptors,
 * auth token injection, and error handling.
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Inject tenant context and auth token
apiClient.interceptors.request.use(
  async (config) => {
    // Inject tenant context from URL if in browser
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      const orgMatch = pathname.match(/^\/org\/([^/]+)/);
      const tenantSlug = orgMatch?.[1];
      if (tenantSlug) {
        config.headers['X-Tenant-Slug'] = tenantSlug;
      }
    }

    // Inject auth token from Supabase
    try {
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;
        if (accessToken) {
          config.headers.Authorization = `Bearer ${accessToken}`;
        }
      }
    } catch {
      // Auth not available, continue without token
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Unified error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    handleApiError(error as AxiosError);
    return Promise.reject(error);
  }
);

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
