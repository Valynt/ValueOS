/**
 * Health Check Types
 * 
 * Shared types for health checks (client and server safe)
 */

/**
 * Health status type
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Component health check result
 */
export interface ComponentHealth {
  status: HealthStatus;
  message?: string;
  available: boolean;
}

/**
 * Overall configuration health (server-side complete version)
 */
export interface ConfigHealth {
  status: HealthStatus;
  timestamp: string;
  components: {
    llm: ComponentHealth & {
      provider: string;
      gating_enabled: boolean;
      provider_available: boolean;
    };
    supabase: ComponentHealth & {
      url_configured: boolean;
      anon_key_configured: boolean;
    };
    redis: ComponentHealth & {
      enabled: boolean;
      url_configured: boolean;
    };
    monitoring: ComponentHealth & {
      sentry_enabled: boolean;
    };
  };
  validation: {
    errors: number;
    warnings: number;
  };
}
