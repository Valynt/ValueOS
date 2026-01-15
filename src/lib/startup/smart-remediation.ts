/**
 * Smart Remediation
 *
 * Provides "Fix It" buttons for known failure scenarios.
 * Instead of just reporting errors, offers one-click fixes.
 */

export interface RemediationAction {
  id: string;
  label: string;
  description: string;
  icon: string;
  severity: "info" | "warning" | "error";
  condition: () => boolean | Promise<boolean>;
  action: () => Promise<RemediationResult>;
  devOnly?: boolean;
}

export interface RemediationResult {
  success: boolean;
  message: string;
  requiresReload?: boolean;
  nextAction?: string;
}

export interface DetectedIssue {
  id: string;
  title: string;
  description: string;
  severity: "info" | "warning" | "error";
  remediation?: RemediationAction;
  detectedAt: number;
}

const DEV_API_BASE = "/api/dev";

/**
 * Available remediation actions
 */
export const REMEDIATION_ACTIONS: RemediationAction[] = [
  {
    id: "seed-database",
    label: "Seed Database",
    description:
      "Database exists but is empty. Click to populate with demo data.",
    icon: "🌱",
    severity: "warning",
    devOnly: true,
    condition: async () => {
      try {
        const res = await fetch(`${DEV_API_BASE}/db/status`, { method: "GET" });
        if (!res.ok) return false;
        const data = await res.json();
        return data.connected && data.empty;
      } catch {
        return false;
      }
    },
    action: async () => {
      try {
        const res = await fetch(`${DEV_API_BASE}/seed`, { method: "POST" });
        if (!res.ok) {
          const error = await res.text();
          return { success: false, message: `Seed failed: ${error}` };
        }
        return {
          success: true,
          message: "Database seeded successfully!",
          requiresReload: true,
        };
      } catch (error) {
        return {
          success: false,
          message: `Seed failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
      }
    },
  },

  {
    id: "refresh-dev-token",
    label: "Refresh Dev Token",
    description:
      "Auth token expired or invalid. Click to get a fresh dev token.",
    icon: "🔑",
    severity: "warning",
    devOnly: true,
    condition: async () => {
      const token = localStorage.getItem("sb-access-token");
      if (!token) return false;

      try {
        const parts = token.split(".");
        if (parts.length < 2 || !parts[1]) return true;
        const payload = JSON.parse(atob(parts[1]));
        const exp = payload.exp * 1000;
        return Date.now() > exp;
      } catch {
        return true;
      }
    },
    action: async () => {
      try {
        const res = await fetch(`${DEV_API_BASE}/auth/dev-token`, {
          method: "POST",
        });
        if (!res.ok) {
          return { success: false, message: "Failed to get dev token" };
        }
        const { token, refreshToken } = await res.json();
        localStorage.setItem("sb-access-token", token);
        if (refreshToken) {
          localStorage.setItem("sb-refresh-token", refreshToken);
        }
        return {
          success: true,
          message: "Dev token refreshed!",
          requiresReload: true,
        };
      } catch (error) {
        return {
          success: false,
          message: `Token refresh failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
      }
    },
  },

  {
    id: "run-migrations",
    label: "Run Migrations",
    description:
      "Database schema is outdated. Click to apply pending migrations.",
    icon: "📦",
    severity: "error",
    devOnly: true,
    condition: async () => {
      try {
        const res = await fetch(`${DEV_API_BASE}/db/migrations/status`);
        if (!res.ok) return false;
        const data = await res.json();
        return data.pending > 0;
      } catch {
        return false;
      }
    },
    action: async () => {
      try {
        const res = await fetch(`${DEV_API_BASE}/db/migrations/run`, {
          method: "POST",
        });
        if (!res.ok) {
          const error = await res.text();
          return { success: false, message: `Migration failed: ${error}` };
        }
        const data = await res.json();
        return {
          success: true,
          message: `Applied ${data.applied} migrations`,
          requiresReload: true,
        };
      } catch (error) {
        return {
          success: false,
          message: `Migration failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
      }
    },
  },

  {
    id: "clear-all-storage",
    label: "Nuke State",
    description:
      "Clear all browser storage (localStorage, sessionStorage, IndexedDB, cookies) and reload.",
    icon: "💥",
    severity: "info",
    devOnly: true,
    condition: () => true,
    action: async () => {
      try {
        localStorage.clear();
        sessionStorage.clear();

        const databases = await indexedDB.databases?.();
        if (databases) {
          for (const db of databases) {
            if (db.name) {
              indexedDB.deleteDatabase(db.name);
            }
          }
        }

        document.cookie.split(";").forEach((c) => {
          document.cookie = c
            .replace(/^ +/, "")
            .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
        });

        return {
          success: true,
          message: "All state cleared!",
          requiresReload: true,
        };
      } catch (error) {
        return {
          success: false,
          message: `Clear failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
      }
    },
  },

  {
    id: "restart-backend",
    label: "Restart Backend",
    description: "Backend appears stuck. Click to trigger a restart.",
    icon: "🔄",
    severity: "error",
    devOnly: true,
    condition: async () => {
      try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 2000);
        await fetch("/api/health", { signal: controller.signal });
        return false;
      } catch {
        return true;
      }
    },
    action: async () => {
      try {
        const res = await fetch(`${DEV_API_BASE}/restart`, { method: "POST" });
        if (!res.ok) {
          return { success: false, message: "Restart request failed" };
        }
        return {
          success: true,
          message: "Backend restart triggered. Waiting 5s...",
          nextAction: "retry-health",
        };
      } catch (error) {
        return {
          success: false,
          message: `Restart failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
      }
    },
  },

  {
    id: "enable-ghost-mode",
    label: "Enable Ghost Mode",
    description: "Backend is down. Switch to mock data for UI development.",
    icon: "👻",
    severity: "info",
    devOnly: true,
    condition: async () => {
      if (window.__GHOST_MODE__?.active) return false;
      try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 2000);
        const res = await fetch("/api/health", { signal: controller.signal });
        return !res.ok;
      } catch {
        return true;
      }
    },
    action: async () => {
      try {
        const { activateGhostMode } = await import("./ghost-mode");
        const state = await activateGhostMode(
          "Manual activation from remediation"
        );
        return {
          success: state.active,
          message: state.active
            ? `Ghost Mode active! Mocking ${state.mockedEndpoints.length} endpoints.`
            : "Failed to activate Ghost Mode",
        };
      } catch (error) {
        return {
          success: false,
          message: `Ghost Mode failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
      }
    },
  },
];

/**
 * Detect issues and return available remediations
 */
export async function detectIssues(
  isDev: boolean = true
): Promise<DetectedIssue[]> {
  const issues: DetectedIssue[] = [];
  const actions = isDev
    ? REMEDIATION_ACTIONS
    : REMEDIATION_ACTIONS.filter((a) => !a.devOnly);

  for (const action of actions) {
    try {
      const matches = await action.condition();
      if (matches) {
        issues.push({
          id: action.id,
          title: action.label,
          description: action.description,
          severity: action.severity,
          remediation: action,
          detectedAt: Date.now(),
        });
      }
    } catch {
      // Condition check failed, skip this action
    }
  }

  return issues;
}

/**
 * Execute a remediation action by ID
 */
export async function executeRemediation(
  actionId: string
): Promise<RemediationResult> {
  const action = REMEDIATION_ACTIONS.find((a) => a.id === actionId);
  if (!action) {
    return { success: false, message: `Unknown action: ${actionId}` };
  }

  console.info(`[Remediation] Executing: ${action.label}`);
  const result = await action.action();
  console.info(`[Remediation] Result:`, result);

  if (result.requiresReload) {
    setTimeout(() => window.location.reload(), 1500);
  }

  return result;
}
