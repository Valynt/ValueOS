export interface GatingPolicy {
  maxTokensPerMinute: number;
  maxRequestsPerMinute: number;
  allowedModels: string[];
}

export interface GatingResult {
  allowed: boolean;
  reason?: string;
  retryAfter?: number;
}
