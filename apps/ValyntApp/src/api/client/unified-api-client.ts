/**
 * Unified API Client
 *
 * Consolidated API client with consistent error handling,
 * authentication, request/response transformation, and retry logic.
 */

import { getClientConfig } from "@valueos/shared/config/client-config";

import { toast } from "../../components/ui/use-toast";
import { sanitizeInput } from "../../security/InputSanitizer";

// ============================================================================
// Types
// ============================================================================

export interface ApiClientConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  authToken?: string;
  defaultHeaders?: Record<string, string>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata?: ResponseMetadata;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
}

export interface ResponseMetadata {
  requestId: string;
  timestamp: string;
  duration: number;
  version: string;
}

export interface RequestConfig {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  url: string;
  data?: unknown;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
  timeout?: number;
  retryAttempts?: number;
  validateResponse?: boolean;
}

// ============================================================================
// API Client Class
// ============================================================================

export class UnifiedApiClient {
  private config: ApiClientConfig;
  private lastFallbackNoticeAt?: number;
  private interceptors: {
    request: Array<(config: RequestConfig) => RequestConfig>;
    response: Array<(response: ApiResponse) => ApiResponse>;
    error: Array<(error: ApiError) => ApiError>;
  };

  constructor(config: Partial<ApiClientConfig> = {}) {
    const appConfig = getClientConfig();

    this.config = {
      baseUrl: config.baseUrl || appConfig.api.baseUrl,
      timeout: config.timeout || appConfig.api.timeout,
      retryAttempts: config.retryAttempts || appConfig.api.retryAttempts,
      authToken: config.authToken,
      defaultHeaders: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...config.defaultHeaders,
      },
    };

    this.interceptors = {
      request: [],
      response: [],
      error: [],
    };
  }

  // ============================================================================
  // Interceptor Management
  // ============================================================================

  addRequestInterceptor(interceptor: (config: RequestConfig) => RequestConfig): void {
    this.interceptors.request.push(interceptor);
  }

  addResponseInterceptor(interceptor: (response: ApiResponse) => ApiResponse): void {
    this.interceptors.response.push(interceptor);
  }

  addErrorInterceptor(interceptor: (error: ApiError) => ApiError): void {
    this.interceptors.error.push(interceptor);
  }

  // ============================================================================
  // HTTP Methods
  // ============================================================================

  async get<T = unknown>(
    url: string,
    params?: Record<string, unknown>,
    config?: Partial<RequestConfig>
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: "GET",
      url,
      params,
      ...config,
    });
  }

  async post<T = unknown>(
    url: string,
    data?: unknown,
    config?: Partial<RequestConfig>
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: "POST",
      url,
      data,
      ...config,
    });
  }

  async put<T = unknown>(
    url: string,
    data?: unknown,
    config?: Partial<RequestConfig>
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: "PUT",
      url,
      data,
      ...config,
    });
  }

  async patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: Partial<RequestConfig>
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: "PATCH",
      url,
      data,
      ...config,
    });
  }

  async delete<T = unknown>(url: string, config?: Partial<RequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: "DELETE",
      url,
      ...config,
    });
  }

  // ============================================================================
  // Core Request Method
  // ============================================================================

  async request<T = unknown>(requestConfig: RequestConfig): Promise<ApiResponse<T>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // Apply request interceptors
      let config = requestConfig;
      for (const interceptor of this.interceptors.request) {
        config = interceptor(config);
      }

      // Build final request config
      const finalConfig = this.buildRequestConfig(config, requestId);

      // Make HTTP request with retry logic
      const response = await this.makeRequestWithRetry(finalConfig);

      // Parse response
      const parsedResponse = await this.parseResponse<T>(response);

      // Apply response interceptors
      let finalResponse = parsedResponse;
      for (const interceptor of this.interceptors.response) {
        finalResponse = interceptor(finalResponse);
      }

      // Add metadata
      finalResponse.metadata = {
        requestId,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        version: "1.0.0",
      };

      return finalResponse;
    } catch (error) {
      const apiError = this.createApiError(error, requestId);

      // Apply error interceptors
      let finalError = apiError;
      for (const interceptor of this.interceptors.error) {
        finalError = interceptor(finalError);
      }

      return {
        success: false,
        error: finalError,
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          version: "1.0.0",
        },
      };
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private buildRequestConfig(
    config: RequestConfig,
    requestId: string
  ): RequestInit & { url: string } {
    const url = this.buildUrl(config.url, config.params);

    const headers = {
      ...this.config.defaultHeaders,
      ...config.headers,
    };

    // Add authentication header
    if (this.config.authToken) {
      headers["Authorization"] = `Bearer ${this.config.authToken}`;
    }

    // Add request ID header
    headers["X-Request-ID"] = requestId;

    const requestOptions: RequestInit = {
      method: config.method || "GET",
      headers,
    };

    if (config.data && ["POST", "PUT", "PATCH"].includes(config.method || "GET")) {
      requestOptions.body = JSON.stringify(config.data);
    }

    return {
      url,
      ...requestOptions,
    };
  }

  private buildUrl(path: string, params?: Record<string, unknown>): string {
    const baseUrl = this.config.baseUrl.endsWith("/")
      ? this.config.baseUrl.slice(0, -1)
      : this.config.baseUrl;
    const cleanPath = this.sanitizePath(path);

    let url = `${baseUrl}/${cleanPath}`;

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          const sanitizedKey = sanitizeInput(String(key), { allowHtml: false, maxLength: 128 });
          const sanitizedValue = sanitizeInput(String(value), { allowHtml: false, maxLength: 2048 });
          searchParams.append(sanitizedKey, sanitizedValue);
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    return url;
  }

  private sanitizePath(path: string): string {
    const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
    return normalizedPath
      .split("/")
      .map((segment) => sanitizeInput(segment, { allowHtml: false, maxLength: 256 }))
      .join("/");
  }

  private async makeRequestWithRetry(config: RequestInit & { url: string }): Promise<Response> {
    const maxRetries = config.retryAttempts ?? this.config.retryAttempts;
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const timeout = config.timeout ?? this.config.timeout;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(config.url, {
          ...config,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        this.handleFallbackHeader(response);
        return response;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on certain errors
        if (
          error instanceof Error &&
          (error.message.includes("400") ||
            error.message.includes("401") ||
            error.message.includes("403") ||
            error.message.includes("404"))
        ) {
          throw error;
        }

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  private async parseResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const contentType = response.headers.get("content-type");

    const data: T = contentType && contentType.includes("application/json")
      ? (await response.json()) as T
      : (await response.text()) as T;

    return {
      success: true,
      data,
    };
  }

  private handleFallbackHeader(response: Response): void {
    const fallbackHeader = response.headers.get("X-LLM-Fallback");
    if (!fallbackHeader) return;

    const normalized = fallbackHeader.toLowerCase();
    const shouldNotify = normalized === "true" || normalized === "1";
    if (!shouldNotify || typeof window === "undefined") return;

    const now = Date.now();
    if (this.lastFallbackNoticeAt && now - this.lastFallbackNoticeAt < 30000) return;

    this.lastFallbackNoticeAt = now;
    toast("Using fallback model", {
      description: "Your request was served by the fallback model because the monthly token budget was exceeded.",
      duration: 6000,
    });
  }

  private createApiError(error: unknown, requestId: string): ApiError {
    if (error instanceof Error) {
      return {
        code: "REQUEST_ERROR",
        message: error.message,
        stack: error.stack,
        details: {
          requestId,
          name: error.name,
        },
      };
    }

    if (error && typeof error === "object" && "message" in error) {
      return {
        code: "UNKNOWN_ERROR",
        message: String(error.message),
        details: {
          requestId,
          error,
        },
      };
    }

    return {
      code: "UNKNOWN_ERROR",
      message: "An unknown error occurred",
      details: {
        requestId,
        error,
      },
    };
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ============================================================================
  // Configuration Updates
  // ============================================================================

  updateConfig(config: Partial<ApiClientConfig>): void {
    this.config = { ...this.config, ...config };
  }

  setAuthToken(token: string): void {
    this.config.authToken = token;
  }

  clearAuthToken(): void {
    this.config.authToken = undefined;
  }

  /**
   * Fetch a URL with auth headers applied, returning the raw Response.
   * Use this only when the response body requires streaming or blob handling
   * (e.g. file downloads). For JSON APIs, use get/post/patch/delete instead.
   */
  async fetchRaw(url: string, init: RequestInit = {}): Promise<Response> {
    const headers: Record<string, string> = {
      ...(this.config.defaultHeaders as Record<string, string>),
      ...(init.headers as Record<string, string>),
    };
    if (this.config.authToken) {
      headers["Authorization"] = `Bearer ${this.config.authToken}`;
    }
    return fetch(url, { ...init, headers });
  }
}

// ============================================================================
// Default Client Instance
// ============================================================================

export const apiClient = new UnifiedApiClient();

// ============================================================================
// Typed API Methods
// ============================================================================

export const api = {
  // Value Cases
  getValueCases: (params?: Record<string, unknown>) => apiClient.get("/api/cases", params),

  createValueCase: (data: unknown) => apiClient.post("/api/cases", data),

  updateValueCase: (id: string, data: unknown) => apiClient.put(`/api/cases/${id}`, data),

  deleteValueCase: (id: string) => apiClient.delete(`/api/cases/${id}`),

  // Agents
  executeAgent: (type: string, data: unknown) => apiClient.post("/api/agents/execute", { type, data }),

  getAgentStatus: (id: string) => apiClient.get(`/api/agents/${id}/status`),

  // Workflows
  executeWorkflow: (data: unknown) => apiClient.post("/api/workflows/execute", data),

  getWorkflow: (id: string) => apiClient.get(`/api/workflows/${id}`),

  getWorkflowStatus: (id: string) => apiClient.get(`/api/workflows/${id}/status`),

  // Integrations
  getIntegrations: () => apiClient.get("/api/integrations"),

  createIntegration: (data: unknown) => apiClient.post("/api/integrations", data),

  testIntegration: (id: string) => apiClient.post(`/api/integrations/${id}/test`),

  syncIntegration: (id: string) => apiClient.post(`/api/integrations/${id}/sync`),

  deleteIntegration: (id: string) => apiClient.delete(`/api/integrations/${id}`),

  // User Management
  getCurrentUser: () => apiClient.get("/api/user/me"),

  updateProfile: (data: unknown) => apiClient.put("/api/user/profile", data),

  // LLM
  chat: (data: {
    prompt: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
    dealId?: string;
  }) => apiClient.post("/api/llm/chat", data),
};
