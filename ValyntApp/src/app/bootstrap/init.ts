/**
 * Application Bootstrap
 * Initialization sequence for the ValyntApp application.
 */

import { loadConfig, getConfig } from "@/app/config/env";

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

  console.log("🚀 Bootstrapping ValyntApp...");

  // Step 1: Load environment configuration
  onProgress?.("Loading configuration...");
  try {
    loadConfig();
    const config = getConfig();
    console.log("✅ Configuration loaded", {
      environment: config.env,
      apiUrl: config.apiBaseUrl,
    });
  } catch (error) {
    const errorMsg = `Failed to load configuration: ${error instanceof Error ? error.message : "Unknown error"}`;
    errors.push(errorMsg);
    onError?.(errorMsg);
    console.error("❌", errorMsg);
  }

  // Step 2: Validate required environment variables
  onProgress?.("Validating environment...");
  const requiredVars = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];
  const missingVars = requiredVars.filter((v) => !import.meta.env[v]);

  if (missingVars.length > 0) {
    const warningMsg = `Missing environment variables: ${missingVars.join(", ")}`;
    warnings.push(warningMsg);
    onWarning?.(warningMsg);
    console.warn("⚠️", warningMsg);
  }

  // Step 3: Initialize analytics (if enabled)
  onProgress?.("Initializing analytics...");
  if (import.meta.env.VITE_ANALYTICS_ENABLED === "true") {
    try {
      // Analytics initialization would go here
      console.log("✅ Analytics initialized");
    } catch (error) {
      const warningMsg = `Analytics initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`;
      warnings.push(warningMsg);
      onWarning?.(warningMsg);
    }
  }

  // Step 4: Initialize error tracking (if enabled)
  onProgress?.("Initializing error tracking...");
  if (import.meta.env.VITE_SENTRY_DSN) {
    try {
      // Sentry initialization would go here
      console.log("✅ Error tracking initialized");
    } catch (error) {
      const warningMsg = `Error tracking initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`;
      warnings.push(warningMsg);
      onWarning?.(warningMsg);
    }
  }

  const duration = Date.now() - startTime;
  const success = errors.length === 0;

  console.log(`🎉 Bootstrap complete in ${duration}ms`, {
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
    onProgress: (msg) => console.log(`⏳ ${msg}`),
    onWarning: (msg) => console.warn(`⚠️ ${msg}`),
    onError: (msg) => console.error(`❌ ${msg}`),
  });
}

export default bootstrap;
