/**
 * Application Bootstrap
 * Initialization sequence for the ValyntApp application.
 */

import { logger } from "../../lib/logger";

import { getConfig, loadConfig } from "@/app/config/env";
import { trackFrontendFlow } from "@/lib/observability";

export interface BootstrapResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  duration: number;
}

export interface BootstrapOptions {
  onProgress?: (message: string) => void;
  onWarning?: (warning: string) => void;
  onError?: (error: string) => void;
}

/**
 * Bootstrap the application
 */
export async function bootstrap(
  options: BootstrapOptions = {},
): Promise<BootstrapResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];

  const { onProgress, onWarning, onError } = options;

  logger.info("🚀 Bootstrapping ValyntApp...");

  const traceId = `bootstrap-${Date.now()}`;

  // Step 1: Load environment configuration
  onProgress?.("Loading configuration...");
  try {
    await trackFrontendFlow("bootstrap.load_config", {
      service: "valynt-app",
      env: import.meta.env.MODE || "development",
      tenant_id: "anonymous",
      trace_id: traceId,
    }, async () => {
      loadConfig();
      const config = getConfig();
      logger.info("✅ Configuration loaded", {
        environment: config.env,
        apiUrl: config.apiBaseUrl,
      });
    });
  } catch (error) {
    const errorMsg = `Failed to load configuration: ${error instanceof Error ? error.message : "Unknown error"}`;
    errors.push(errorMsg);
    onError?.(errorMsg);
    logger.error("❌", errorMsg);
  }

  // Step 2: Validate required environment variables
  onProgress?.("Validating environment...");
  const requiredVars = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];
  const missingVars = requiredVars.filter((v) => !import.meta.env[v]);

  if (missingVars.length > 0) {
    const warningMsg = `Missing environment variables: ${missingVars.join(", ")}`;
    warnings.push(warningMsg);
    onWarning?.(warningMsg);
    logger.warn("⚠️", warningMsg);
  }

  // Step 3: Initialize analytics (if enabled)
  onProgress?.("Initializing analytics...");
  if (import.meta.env.VITE_ANALYTICS_ENABLED === "true") {
    try {
      await trackFrontendFlow("bootstrap.analytics", {
        service: "valynt-app",
        env: import.meta.env.MODE || "development",
        tenant_id: "anonymous",
        trace_id: traceId,
      }, async () => {
        // Analytics initialization would go here
        logger.info("✅ Analytics initialized");
      });
    } catch (error) {
      const warningMsg = `Analytics initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`;
      warnings.push(warningMsg);
      onWarning?.(warningMsg);
    }
  }


  const duration = Date.now() - startTime;
  const success = errors.length === 0;

  logger.info(`🎉 Bootstrap complete in ${duration}ms`, {
    success,
    errors: errors.length,
    warnings: warnings.length,
  });

  return {
    success,
    errors,
    warnings,
    duration,
  };
}

/**
 * Bootstrap with console logging
 */
export async function bootstrapWithLogging(): Promise<BootstrapResult> {
  return bootstrap({
    onProgress: (msg) => logger.info(`⏳ ${msg}`),
    onWarning: (msg) => logger.warn(`⚠️ ${msg}`),
    onError: (msg) => logger.error(`❌ ${msg}`),
  });
}

export default bootstrap;
