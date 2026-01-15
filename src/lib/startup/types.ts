/**
 * Startup System Types
 *
 * Type definitions for the graceful degradation boot system.
 */

export type DependencyStatus =
  | "pending"
  | "checking"
  | "ok"
  | "degraded"
  | "failed"
  | "timeout";

export interface DependencyCheck {
  name: string;
  status: DependencyStatus;
  required: boolean;
  error?: string;
  endpoint?: string;
  responseTime?: number;
  lastChecked?: number;
}

export interface StartupState {
  phase: "initializing" | "checking" | "ready" | "degraded" | "failed";
  dependencies: Record<string, DependencyCheck>;
  startTime: number;
  readyTime?: number;
  errors: string[];
  warnings: string[];
}

export interface DependencyConfig {
  name: string;
  required: boolean;
  timeoutMs: number;
  retries: number;
  check: () => Promise<{ ok: boolean; error?: string; responseTime?: number }>;
  endpoint?: string;
}

export const CONTAINER_ONLY_HOSTNAMES = [
  "backend",
  "postgres",
  "redis",
  "supabase",
  "supabase-db",
  "supabase-kong",
  "supabase-auth",
  "supabase-rest",
  "supabase-realtime",
  "supabase-storage",
  "supabase-imgproxy",
  "supabase-meta",
  "supabase-edge-functions",
  "supabase-analytics",
  "supabase-vector",
  "minio",
  "mailhog",
  "grafana",
  "prometheus",
  "jaeger",
  "otel-collector",
];

export function isContainerOnlyHostname(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return CONTAINER_ONLY_HOSTNAMES.some(
      (containerHost) =>
        hostname === containerHost ||
        hostname.startsWith(`${containerHost}.`) ||
        hostname.endsWith(`.${containerHost}`)
    );
  } catch {
    return false;
  }
}

export function detectEnvironmentIssues(): string[] {
  const issues: string[] = [];

  if (typeof window === "undefined") {
    return issues;
  }

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const agentApiUrl = import.meta.env.VITE_AGENT_API_URL;

  if (apiBaseUrl && isContainerOnlyHostname(apiBaseUrl)) {
    issues.push(
      `VITE_API_BASE_URL (${apiBaseUrl}) uses a container-only hostname that won't work in the browser. ` +
        `Use a relative path like '/api' or a publicly accessible URL.`
    );
  }

  if (supabaseUrl && isContainerOnlyHostname(supabaseUrl)) {
    issues.push(
      `VITE_SUPABASE_URL (${supabaseUrl}) uses a container-only hostname. ` +
        `Use 'http://localhost:54321' or the forwarded URL in remote environments.`
    );
  }

  if (agentApiUrl && isContainerOnlyHostname(agentApiUrl)) {
    issues.push(
      `VITE_AGENT_API_URL (${agentApiUrl}) uses a container-only hostname. ` +
        `Use 'http://localhost:8000' or the forwarded URL in remote environments.`
    );
  }

  const isGitpod = window.location.hostname.includes("gitpod.io");
  const isCodespaces = window.location.hostname.includes("github.dev");
  const isRemote = isGitpod || isCodespaces;

  if (isRemote) {
    if (apiBaseUrl?.includes("localhost")) {
      issues.push(
        `You're in a remote environment (${isGitpod ? "Gitpod" : "Codespaces"}) but VITE_API_BASE_URL points to localhost. ` +
          `Use the forwarded URL or a relative path.`
      );
    }
    if (supabaseUrl?.includes("localhost")) {
      issues.push(
        `You're in a remote environment but VITE_SUPABASE_URL points to localhost. ` +
          `Use the forwarded Supabase URL.`
      );
    }
  }

  return issues;
}
