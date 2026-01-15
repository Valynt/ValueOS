/**
 * Dependency Checker
 *
 * Checks boot dependencies with timeouts and retries.
 * Classifies dependencies as required vs optional.
 */

import type {
  DependencyCheck,
  DependencyConfig,
  DependencyStatus,
  StartupState,
} from "./types";
import { detectEnvironmentIssues } from "./types";

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_RETRIES = 2;
const RETRY_DELAY_MS = 500;

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
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
    throw error;
  }
}

async function checkWithRetry(
  config: DependencyConfig,
  retryCount = 0
): Promise<DependencyCheck> {
  const startTime = performance.now();

  try {
    const result = await config.check();
    const responseTime = Math.round(performance.now() - startTime);

    return {
      name: config.name,
      status: result.ok ? "ok" : "degraded",
      required: config.required,
      error: result.error,
      endpoint: config.endpoint,
      responseTime: result.responseTime ?? responseTime,
      lastChecked: Date.now(),
    };
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "AbortError";
    const errorMessage = isTimeout
      ? `Timeout after ${config.timeoutMs}ms`
      : error instanceof Error
        ? error.message
        : "Unknown error";

    if (retryCount < config.retries) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return checkWithRetry(config, retryCount + 1);
    }

    return {
      name: config.name,
      status: isTimeout ? "timeout" : "failed",
      required: config.required,
      error: errorMessage,
      endpoint: config.endpoint,
      responseTime: Math.round(performance.now() - startTime),
      lastChecked: Date.now(),
    };
  }
}

export function createApiHealthCheck(baseUrl: string): DependencyConfig {
  const endpoint = baseUrl.startsWith("/")
    ? `${baseUrl}/health`
    : `${baseUrl}/health`;

  return {
    name: "Backend API",
    required: false,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    retries: DEFAULT_RETRIES,
    endpoint,
    check: async () => {
      try {
        const response = await fetchWithTimeout(
          endpoint,
          { method: "GET" },
          DEFAULT_TIMEOUT_MS
        );
        return { ok: response.ok || response.status === 503 };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Network error",
        };
      }
    },
  };
}

export function createSupabaseHealthCheck(): DependencyConfig {
  const supabaseUrl =
    (typeof import.meta !== "undefined" &&
      import.meta.env?.VITE_SUPABASE_URL) ||
    "";
  const endpoint = supabaseUrl ? `${supabaseUrl}/rest/v1/` : "";

  return {
    name: "Supabase",
    required: false,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    retries: DEFAULT_RETRIES,
    endpoint: endpoint || "Not configured",
    check: async () => {
      if (!supabaseUrl) {
        return { ok: false, error: "VITE_SUPABASE_URL not configured" };
      }

      try {
        const response = await fetchWithTimeout(
          endpoint,
          { method: "HEAD" },
          DEFAULT_TIMEOUT_MS
        );
        return { ok: response.ok || response.status === 400 };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Network error",
        };
      }
    },
  };
}

export function createAgentApiHealthCheck(): DependencyConfig {
  const agentApiUrl =
    (typeof import.meta !== "undefined" &&
      import.meta.env?.VITE_AGENT_API_URL) ||
    "http://localhost:3001/api/agents";
  const endpoint = `${agentApiUrl.replace(/\/+$/, "")}/health`;

  return {
    name: "Agent API",
    required: false,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    retries: 1,
    endpoint,
    check: async () => {
      try {
        const response = await fetchWithTimeout(
          endpoint,
          { method: "GET" },
          DEFAULT_TIMEOUT_MS
        );
        return { ok: response.ok };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Network error",
        };
      }
    },
  };
}

export function getDefaultDependencies(): DependencyConfig[] {
  const apiBaseUrl =
    (typeof import.meta !== "undefined" &&
      import.meta.env?.VITE_API_BASE_URL) ||
    "/api";

  return [
    createApiHealthCheck(apiBaseUrl),
    createSupabaseHealthCheck(),
    createAgentApiHealthCheck(),
  ];
}

export async function checkAllDependencies(
  configs: DependencyConfig[] = getDefaultDependencies(),
  onProgress?: (name: string, status: DependencyStatus) => void
): Promise<StartupState> {
  const startTime = Date.now();
  const dependencies: Record<string, DependencyCheck> = {};
  const errors: string[] = [];
  const warnings: string[] = [];

  const envIssues = detectEnvironmentIssues();
  if (envIssues.length > 0) {
    errors.push(...envIssues);
  }

  for (const config of configs) {
    dependencies[config.name] = {
      name: config.name,
      status: "checking",
      required: config.required,
      endpoint: config.endpoint,
    };
    onProgress?.(config.name, "checking");
  }

  const results = await Promise.all(
    configs.map(async (config) => {
      const result = await checkWithRetry(config);
      onProgress?.(config.name, result.status);
      return result;
    })
  );

  for (const result of results) {
    dependencies[result.name] = result;

    if (result.status === "failed" || result.status === "timeout") {
      if (result.required) {
        errors.push(`${result.name}: ${result.error}`);
      } else {
        warnings.push(`${result.name}: ${result.error}`);
      }
    }
  }

  const hasRequiredFailure = results.some(
    (r) => r.required && (r.status === "failed" || r.status === "timeout")
  );
  const hasAnyFailure = results.some(
    (r) => r.status === "failed" || r.status === "timeout"
  );

  let phase: StartupState["phase"];
  if (hasRequiredFailure || envIssues.length > 0) {
    phase = "failed";
  } else if (hasAnyFailure) {
    phase = "degraded";
  } else {
    phase = "ready";
  }

  return {
    phase,
    dependencies,
    startTime,
    readyTime: Date.now(),
    errors,
    warnings,
  };
}

export async function recheckDependency(
  name: string,
  configs: DependencyConfig[] = getDefaultDependencies()
): Promise<DependencyCheck | null> {
  const config = configs.find((c) => c.name === name);
  if (!config) return null;

  return checkWithRetry(config);
}
