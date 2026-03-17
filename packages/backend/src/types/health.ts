export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface ComponentHealth {
  status: HealthStatus;
  available: boolean;
  message?: string;
  [key: string]: unknown;
}

export interface ConfigHealth {
  status: HealthStatus;
  timestamp: string;
  components: Record<string, ComponentHealth>;
  validation: {
    errors: number;
    warnings: number;
  };
}
