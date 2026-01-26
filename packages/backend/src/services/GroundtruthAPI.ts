/**
 * Groundtruth API Service
 *
 * Provides a typed client for the Groundtruth service with
 * authentication, timeouts, and normalized error handling.
 */

import { logger } from '../lib/logger.js'
import { getGroundtruthConfig } from '../lib/env';

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

  constructor(config: GroundtruthAPIConfig = {}) {
    this.config = { ...getDefaultConfig(), ...config };
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
        return {
          success: false,
          error: this.normalizeErrorMessage(response.status, response.statusText, responseBody),
          status: response.status,
          details: responseBody,
        };
      }

      return {
        success: true,
        data: (responseBody as T) ?? undefined,
        status: response.status,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Groundtruth API request failed', error instanceof Error ? error : undefined);
      return {
        success: false,
        error: message,
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

export default GroundtruthAPI;
