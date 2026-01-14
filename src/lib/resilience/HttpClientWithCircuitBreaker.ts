/**
 * HTTP Client with Circuit Breaker Protection
 *
 * Provides comprehensive circuit breaker protection for all HTTP requests:
 * - Automatic circuit breaker integration
 * - Retry logic with exponential backoff
 * - Request/response interceptors
 * - Metrics and monitoring
 * - Service-specific configurations
 */

import { CircuitBreaker } from './CircuitBreaker';
import { logger } from '../logger';
import { analyticsClient } from '../analyticsClient';

export interface HttpClientConfig {
  baseURL?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
  circuitBreaker?: {
    failureThreshold?: number;
    resetTimeout?: number;
    halfOpenSuccessThreshold?: number;
  };
}

export interface RequestConfig {
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
  signal?: AbortSignal;
}

export interface HttpResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: RequestConfig;
}

export interface HttpError extends Error {
  status?: number;
  statusText?: string;
  config?: RequestConfig;
  response?: HttpResponse;
}

/**
 * HTTP Client with built-in circuit breaker protection
 */
export class HttpClientWithCircuitBreaker {
  private circuitBreaker: CircuitBreaker;
  private config: HttpClientConfig;
  private serviceName: string;

  constructor(serviceName: string, config: HttpClientConfig = {}) {
    this.serviceName = serviceName;
    this.config = {
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...config,
    };

    // Initialize circuit breaker with service-specific configuration
    this.circuitBreaker = new CircuitBreaker(
      config.circuitBreaker?.failureThreshold || 5,
      config.circuitBreaker?.resetTimeout || 60000,
      config.circuitBreaker?.halfOpenSuccessThreshold || 2
    );

    // Set up circuit breaker event handlers
    this.setupCircuitBreakerEvents();
  }

  private setupCircuitBreakerEvents(): void {
    this.circuitBreaker.on('state-change', (from, to) => {
      logger.info(`Circuit breaker state changed for ${this.serviceName}`, {
        serviceName: this.serviceName,
        from,
        to,
        timestamp: new Date().toISOString(),
      });

      analyticsClient.track('circuit_breaker_state_change', {
        serviceName: this.serviceName,
        fromState: from,
        toState: to,
      });
    });

    this.circuitBreaker.on('failure', (error) => {
      logger.warn(`Circuit breaker recorded failure for ${this.serviceName}`, {
        serviceName: this.serviceName,
        error: error.message,
        failureCount: this.circuitBreaker.getFailureCount(),
      });
    });

    this.circuitBreaker.on('success', () => {
      logger.debug(`Circuit breaker recorded success for ${this.serviceName}`, {
        serviceName: this.serviceName,
      });
    });
  }

  /**
   * Execute HTTP request with circuit breaker protection
   */
  async request<T = any>(requestConfig: RequestConfig): Promise<HttpResponse<T>> {
    const mergedConfig = { ...this.config, ...requestConfig };
    const url = this.buildUrl(mergedConfig.url || '');

    const operation = async (): Promise<HttpResponse<T>> => {
      return this.executeRequest<T>(url, mergedConfig);
    };

    try {
      return await this.circuitBreaker.execute(operation);
    } catch (error) {
      // Handle circuit breaker errors
      if (error instanceof Error && error.message.includes('Circuit breaker is OPEN')) {
        const circuitBreakerError: HttpError = new Error(
          `Service ${this.serviceName} is temporarily unavailable`
        ) as HttpError;
        circuitBreakerError.status = 503;
        circuitBreakerError.statusText = 'Service Unavailable';
        circuitBreakerError.config = mergedConfig;

        analyticsClient.track('circuit_breaker_open', {
          serviceName: this.serviceName,
          url,
        });

        throw circuitBreakerError;
      }

      throw error;
    }
  }

  /**
   * Execute the actual HTTP request with retry logic
   */
  private async executeRequest<T>(
    url: string,
    config: RequestConfig
  ): Promise<HttpResponse<T>> {
    const maxRetries = config.retries ?? this.config.retries ?? 3;
    const retryDelay = config.retryDelay ?? this.config.retryDelay ?? 1000;
    const timeout = config.timeout ?? this.config.timeout ?? 30000;

    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.makeRequest<T>(url, config, timeout);

        // Log successful request
        logger.debug(`HTTP request successful for ${this.serviceName}`, {
          serviceName: this.serviceName,
          url,
          method: config.method || 'GET',
          status: response.status,
          attempt: attempt + 1,
        });

        return response;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on client errors (4xx) or if this is the last attempt
        if (this.shouldNotRetry(error as HttpError) || attempt === maxRetries) {
          break;
        }

        // Calculate exponential backoff delay
        const delay = retryDelay * Math.pow(2, attempt);

        logger.warn(`HTTP request failed for ${this.serviceName}, retrying...`, {
          serviceName: this.serviceName,
          url,
          method: config.method || 'GET',
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
          delay,
          error: lastError.message,
        });

        await this.sleep(delay);
      }
    }

    // All retries failed
    logger.error(`HTTP request failed after ${maxRetries + 1} attempts for ${this.serviceName}`, lastError, {
      serviceName: this.serviceName,
      url,
      method: config.method || 'GET',
      maxRetries,
    });

    throw lastError;
  }

  /**
   * Make the actual HTTP request
   */
  private async makeRequest<T>(
    url: string,
    config: RequestConfig,
    timeout: number
  ): Promise<HttpResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: config.method || 'GET',
        headers: {
          ...this.config.headers,
          ...config.headers,
        },
        body: config.body ? JSON.stringify(config.body) : undefined,
        signal: config.signal || controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error: HttpError = new Error(`HTTP ${response.status}: ${response.statusText}`) as HttpError;
        error.status = response.status;
        error.statusText = response.statusText;
        error.config = config;

        throw error;
      }

      const data = await response.json();
      const headers: Record<string, string> = {};

      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return {
        data,
        status: response.status,
        statusText: response.statusText,
        headers,
        config,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError: HttpError = new Error(`Request timeout after ${timeout}ms`) as HttpError;
        timeoutError.status = 408;
        timeoutError.statusText = 'Request Timeout';
        timeoutError.config = config;
        throw timeoutError;
      }

      throw error;
    }
  }

  /**
   * Determine if an error should not be retried
   */
  private shouldNotRetry(error: HttpError): boolean {
    // Don't retry on client errors (4xx)
    if (error.status && error.status >= 400 && error.status < 500) {
      return true;
    }

    // Don't retry on specific error types
    if (error.message.includes('Request timeout') && error.status === 408) {
      return false; // Retry timeouts
    }

    if (error.message.includes('Network') || error.message.includes('fetch')) {
      return false; // Retry network errors
    }

    return false;
  }

  /**
   * Build full URL
   */
  private buildUrl(path: string): string {
    const baseURL = this.config.baseURL || '';
    const trimmedPath = path.startsWith('/') ? path.slice(1) : path;
    const trimmedBaseURL = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;

    return trimmedBaseURL ? `${trimmedBaseURL}/${trimmedPath}` : trimmedPath;
  }

  /**
   * Sleep helper for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * GET request
   */
  async get<T = any>(url: string, config: RequestConfig = {}): Promise<HttpResponse<T>> {
    return this.request<T>({ ...config, url, method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T = any>(url: string, data?: any, config: RequestConfig = {}): Promise<HttpResponse<T>> {
    return this.request<T>({ ...config, url, method: 'POST', body: data });
  }

  /**
   * PUT request
   */
  async put<T = any>(url: string, data?: any, config: RequestConfig = {}): Promise<HttpResponse<T>> {
    return this.request<T>({ ...config, url, method: 'PUT', body: data });
  }

  /**
   * PATCH request
   */
  async patch<T = any>(url: string, data?: any, config: RequestConfig = {}): Promise<HttpResponse<T>> {
    return this.request<T>({ ...config, url, method: 'PATCH', body: data });
  }

  /**
   * DELETE request
   */
  async delete<T = any>(url: string, config: RequestConfig = {}): Promise<HttpResponse<T>> {
    return this.request<T>({ ...config, url, method: 'DELETE' });
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus() {
    return {
      state: this.circuitBreaker.getState(),
      failureCount: this.circuitBreaker.getFailureCount(),
      lastFailureTime: this.circuitBreaker.getLastFailureTime(),
      nextAttemptTime: this.circuitBreaker.getNextAttemptTime(),
    };
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
    logger.info(`Circuit breaker reset for ${this.serviceName}`, {
      serviceName: this.serviceName,
    });
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    service: string;
    healthy: boolean;
    circuitBreaker: any;
    lastChecked: string;
  }> {
    try {
      // Try a simple health check request
      await this.get('/health', { timeout: 5000 });

      return {
        service: this.serviceName,
        healthy: true,
        circuitBreaker: this.getCircuitBreakerStatus(),
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      return {
        service: this.serviceName,
        healthy: false,
        circuitBreaker: this.getCircuitBreakerStatus(),
        lastChecked: new Date().toISOString(),
      };
    }
  }
}

/**
 * Service-specific HTTP client configurations
 */
export const serviceConfigs: Record<string, HttpClientConfig> = {
  // LLM Services
  'together-ai': {
    baseURL: 'https://api.together.xyz/v1',
    timeout: 30000,
    retries: 3,
    circuitBreaker: {
      failureThreshold: 5,
      resetTimeout: 60000,
      halfOpenSuccessThreshold: 2,
    },
  },
  'openai': {
    baseURL: 'https://api.openai.com/v1',
    timeout: 60000,
    retries: 2,
    circuitBreaker: {
      failureThreshold: 3,
      resetTimeout: 120000,
      halfOpenSuccessThreshold: 2,
    },
  },
  'anthropic': {
    baseURL: 'https://api.anthropic.com/v1',
    timeout: 45000,
    retries: 2,
    circuitBreaker: {
      failureThreshold: 4,
      resetTimeout: 90000,
      halfOpenSuccessThreshold: 2,
    },
  },

  // Internal Services
  'billing-api': {
    baseURL: '/api/billing',
    timeout: 15000,
    retries: 2,
    circuitBreaker: {
      failureThreshold: 3,
      resetTimeout: 30000,
      halfOpenSuccessThreshold: 1,
    },
  },
  'user-api': {
    baseURL: '/api/admin',
    timeout: 10000,
    retries: 2,
    circuitBreaker: {
      failureThreshold: 3,
      resetTimeout: 30000,
      halfOpenSuccessThreshold: 1,
    },
  },
  'agent-api': {
    baseURL: '/api/query',
    timeout: 120000,
    retries: 1,
    circuitBreaker: {
      failureThreshold: 2,
      resetTimeout: 60000,
      halfOpenSuccessThreshold: 1,
    },
  },

  // External Services
  'document-parser': {
    timeout: 60000,
    retries: 2,
    circuitBreaker: {
      failureThreshold: 3,
      resetTimeout: 120000,
      halfOpenSuccessThreshold: 2,
    },
  },
};

/**
 * HTTP client factory
 */
export class HttpClientFactory {
  private static clients: Map<string, HttpClientWithCircuitBreaker> = new Map();

  static getClient(serviceName: string, config?: HttpClientConfig): HttpClientWithCircuitBreaker {
    const existingClient = this.clients.get(serviceName);

    if (existingClient) {
      return existingClient;
    }

    const clientConfig = { ...serviceConfigs[serviceName], ...config };
    const client = new HttpClientWithCircuitBreaker(serviceName, clientConfig);

    this.clients.set(serviceName, client);

    logger.info(`Created HTTP client for service: ${serviceName}`, {
      serviceName,
      baseURL: clientConfig.baseURL,
      timeout: clientConfig.timeout,
    });

    return client;
  }

  static getAllClients(): Map<string, HttpClientWithCircuitBreaker> {
    return new Map(this.clients);
  }

  static resetAllCircuitBreakers(): void {
    for (const [serviceName, client] of this.clients) {
      client.resetCircuitBreaker();
      logger.info(`Reset circuit breaker for service: ${serviceName}`);
    }
  }

  static async getAllHealthStatuses(): Promise<Array<any>> {
    const statuses = [];

    for (const [serviceName, client] of this.clients) {
      try {
        const status = await client.getHealthStatus();
        statuses.push(status);
      } catch (error) {
        statuses.push({
          service: serviceName,
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          lastChecked: new Date().toISOString(),
        });
      }
    }

    return statuses;
  }
}
