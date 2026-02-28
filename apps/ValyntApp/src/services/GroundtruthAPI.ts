/**
 * Groundtruth API Service
 *
 * Provides a typed client for the Groundtruth service with
 * authentication, timeouts, and normalized error handling.
 */

import { getGroundtruthConfig } from '../lib/env';
import { logger } from '../lib/logger';

import { CircuitBreakerConfig, CircuitBreakerManager } from './CircuitBreaker';
import { ExternalCircuitBreaker } from './ExternalCircuitBreaker';

export interface GroundtruthAPIConfig {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export interface GroundtruthRequestPayload {
  query: string;
  agent?: string;
  response?: unknown;
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface GroundtruthAPIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
  details?: unknown;
}

export interface GroundtruthRequestOptions {
  endpoint?: string;
  timeoutMs?: number;
}

function getDefaultConfig(): Required<GroundtruthAPIConfig> {
  const envConfig = getGroundtruthConfig();

  return {
    baseUrl: envConfig.apiUrl || '',
    apiKey: envConfig.apiKey || '',
    timeoutMs: envConfig.timeoutMs,
    headers: {},
  };
}

export class GroundtruthAPI {
  private config: Required<GroundtruthAPIConfig>;
  private readonly circuitBreakerManager: CircuitBreakerManager;
  private readonly circuitBreaker: ExternalCircuitBreaker;
  private readonly breakerKey = 'external:groundtruth:evaluate';
  private readonly breakerConfig: Partial<CircuitBreakerConfig>;

  constructor(config: GroundtruthAPIConfig = {}) {
    this.config = { ...getDefaultConfig(), ...config };
    this.config.timeoutMs = Number(this.config.timeoutMs) || 30_000;
    this.circuitBreakerManager = new CircuitBreakerManager();
    this.circuitBreaker = new ExternalCircuitBreaker('groundtruth', this.circuitBreakerManager);
    this.breakerConfig = {
      windowMs: 60_000,
      failureRateThreshold: 0.5,
      latencyThresholdMs: Math.max(2_000, this.config.timeoutMs),
      minimumSamples: 2,
      timeoutMs: 30_000,
      halfOpenMaxProbes: 1,
    };
  }

  isConfigured(): boolean {
    return Boolean(this.config.baseUrl);
  }

  async evaluate<T = unknown>(
    payload: GroundtruthRequestPayload,
    options: GroundtruthRequestOptions = {}
  ): Promise<GroundtruthAPIResponse<T>> {
    if (!this.config.baseUrl) {
      return {
        success: false,
        error: 'Groundtruth API URL is not configured',
      };
    }

    const endpoint = options.endpoint ?? '/evaluate';
    const url = this.buildUrl(endpoint);

    try {
      return await this.circuitBreaker.execute(
        this.breakerKey,
        async () => {
          const response = await this.fetchWithTimeout(
            url,
            {
              method: 'POST',
              headers: this.buildHeaders(),
              body: JSON.stringify(payload),
            },
            options.timeoutMs ?? this.config.timeoutMs
          );

          const contentType = response.headers.get('content-type') || '';
          const isJson = contentType.includes('application/json');
          const responseBody = isJson ? await response.json() : await response.text();

          if (!response.ok) {
            const message = this.normalizeErrorMessage(response.status, response.statusText, responseBody);
            throw new GroundtruthRequestError(message, response.status, responseBody);
          }

          this.logCircuitBreakerState('groundtruth:success');

          return {
            success: true,
            data: (responseBody as T) ?? undefined,
            status: response.status,
          };
        },
        {
          config: this.breakerConfig,
          fallback: (error, state) => {
            const normalized = this.normalizeError(error);
            this.logCircuitBreakerState('groundtruth:fallback', state, normalized.message);
            return {
              success: false,
              error: normalized.message,
              status: normalized.status,
              details: normalized.details,
            };
          },
        }
      );
    } catch (error) {
      const normalized = this.normalizeError(error);
      this.logCircuitBreakerState('groundtruth:exception', this.circuitBreaker.getState(this.breakerKey), normalized.message);
      return {
        success: false,
        error: normalized.message,
        status: normalized.status,
        details: normalized.details,
      };
    }
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers,
    };

    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }

  private buildUrl(endpoint: string): string {
    const normalizedBase = this.config.baseUrl.replace(/\/+$/, '');
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${normalizedBase}${normalizedEndpoint}`;
  }

  private normalizeErrorMessage(
    status: number,
    statusText: string,
    body: unknown
  ): string {
    if (body && typeof body === 'object' && 'message' in body) {
      const message = (body as { message?: string }).message;
      if (message) {
        return message;
      }
    }

    const fallback = typeof body === 'string' && body.trim().length > 0
      ? body
      : statusText;

    return `HTTP ${status}: ${fallback}`.trim();
  }

  private normalizeError(error: unknown): { message: string; status?: number; details?: unknown } {
    if (error instanceof GroundtruthRequestError) {
      return {
        message: error.message,
        status: error.status,
        details: error.details,
      };
    }

    if (error instanceof Error) {
      return { message: error.message };
    }

    return { message: String(error) };
  }

  private logCircuitBreakerState(context: string, state?: string, error?: string): void {
    const metrics = this.circuitBreaker.getMetrics(this.breakerKey);
    const breakerState = state ?? metrics.state;
    const payload = {
      context,
      breakerKey: this.breakerKey,
      state: breakerState,
      failureRate: metrics.failureRate,
      totalRequests: metrics.totalRequests,
      failedRequests: metrics.failedRequests,
      error,
    };

    if (breakerState === 'open') {
      logger.warn('Groundtruth circuit breaker is OPEN', payload);
      return;
    }

    if (breakerState === 'half_open') {
      logger.warn('Groundtruth circuit breaker is HALF_OPEN', payload);
      return;
    }

    if (error) {
      logger.info('Groundtruth circuit breaker state recorded after error', payload);
      return;
    }

    logger.debug('Groundtruth circuit breaker state recorded', payload);
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as Error).name === 'AbortError') {
        throw new Error(`Request timeout after ${timeoutMs}ms`);
      }
      throw error;
    }
  }
}

class GroundtruthRequestError extends Error {
  status?: number;
  details?: unknown;

  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'GroundtruthRequestError';
    this.status = status;
    this.details = details;
  }
}

export default GroundtruthAPI;
