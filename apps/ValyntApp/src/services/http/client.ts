/**
 * HTTP Client
 */

import { getConfig } from "@app/config";

import type { ApiError, ApiRequestConfig, ApiResponse } from "@/types";

class HttpClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getConfig().apiBaseUrl;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    options: ApiRequestConfig & { body?: unknown } = {},
  ): Promise<ApiResponse<T>> {
    const { headers = {}, params, signal, body } = options;

    let url = `${this.baseUrl}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        searchParams.append(key, String(value));
      });
      url += `?${searchParams.toString()}`;
    }

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });

    const data = await response.json();

    if (!response.ok) {
      const error: ApiError = {
        code: data.code || "UNKNOWN_ERROR",
        message: data.message || "An error occurred",
        details: data.details,
      };
      return { data: null as T, error };
    }

    return { data };
  }

  async get<T>(
    endpoint: string,
    config?: ApiRequestConfig,
  ): Promise<ApiResponse<T>> {
    return this.request<T>("GET", endpoint, config);
  }

  async post<T>(
    endpoint: string,
    body?: unknown,
    config?: ApiRequestConfig,
  ): Promise<ApiResponse<T>> {
    return this.request<T>("POST", endpoint, { ...config, body });
  }

  async put<T>(
    endpoint: string,
    body?: unknown,
    config?: ApiRequestConfig,
  ): Promise<ApiResponse<T>> {
    return this.request<T>("PUT", endpoint, { ...config, body });
  }

  async patch<T>(
    endpoint: string,
    body?: unknown,
    config?: ApiRequestConfig,
  ): Promise<ApiResponse<T>> {
    return this.request<T>("PATCH", endpoint, { ...config, body });
  }

  async delete<T>(
    endpoint: string,
    config?: ApiRequestConfig,
  ): Promise<ApiResponse<T>> {
    return this.request<T>("DELETE", endpoint, config);
  }
}

export const httpClient = new HttpClient();
export default httpClient;
