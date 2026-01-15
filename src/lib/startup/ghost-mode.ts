/**
 * Ghost Mode - Auto-MSW Activation
 *
 * When backend is unreachable, automatically activates Mock Service Worker
 * to provide synthetic data, allowing UI development to continue.
 */

import type { StartupState } from "./types";

export interface GhostModeState {
  active: boolean;
  activatedAt?: number;
  reason?: string;
  mockedEndpoints: string[];
}

let ghostModeState: GhostModeState = {
  active: false,
  mockedEndpoints: [],
};

let mswWorker: unknown = null;

/**
 * Check if Ghost Mode should be activated based on startup state
 */
export function shouldActivateGhostMode(state: StartupState): boolean {
  if (state.phase !== "degraded" && state.phase !== "failed") {
    return false;
  }

  const backendDown = Object.values(state.dependencies).some(
    (dep) =>
      dep.name === "Backend API" &&
      (dep.status === "failed" || dep.status === "timeout")
  );

  return backendDown;
}

/**
 * Activate Ghost Mode with MSW
 */
export async function activateGhostMode(
  reason: string = "Backend unreachable"
): Promise<GhostModeState> {
  if (ghostModeState.active) {
    return ghostModeState;
  }

  try {
    const { setupWorker } = await import("msw/browser");
    const handlers = await loadMockHandlers();

    mswWorker = setupWorker(...handlers);
    await (mswWorker as { start: (opts: unknown) => Promise<void> }).start({
      onUnhandledRequest: "bypass",
      quiet: true,
    });

    ghostModeState = {
      active: true,
      activatedAt: Date.now(),
      reason,
      mockedEndpoints: handlers.map((h) => {
        const info = h.info as { path?: string; method?: string };
        return `${info.method || "GET"} ${info.path || "unknown"}`;
      }),
    };

    console.info(
      "%c👻 Ghost Mode Activated",
      "color: #8b5cf6; font-weight: bold; font-size: 14px;"
    );
    console.info(`%cReason: ${reason}`, "color: #6b7280; font-size: 12px;");
    console.info(
      `%cMocked ${ghostModeState.mockedEndpoints.length} endpoints`,
      "color: #6b7280; font-size: 12px;"
    );

    window.dispatchEvent(
      new CustomEvent("ghostmode:activated", { detail: ghostModeState })
    );

    return ghostModeState;
  } catch (error) {
    console.warn("Failed to activate Ghost Mode:", error);
    ghostModeState = {
      active: false,
      reason: `Activation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      mockedEndpoints: [],
    };
    return ghostModeState;
  }
}

/**
 * Deactivate Ghost Mode
 */
export async function deactivateGhostMode(): Promise<void> {
  if (!ghostModeState.active || !mswWorker) {
    return;
  }

  try {
    await (mswWorker as { stop: () => Promise<void> }).stop();
    mswWorker = null;

    ghostModeState = {
      active: false,
      mockedEndpoints: [],
    };

    console.info(
      "%c👻 Ghost Mode Deactivated",
      "color: #10b981; font-weight: bold;"
    );

    window.dispatchEvent(new CustomEvent("ghostmode:deactivated"));
  } catch (error) {
    console.warn("Failed to deactivate Ghost Mode:", error);
  }
}

/**
 * Get current Ghost Mode state
 */
export function getGhostModeState(): GhostModeState {
  return { ...ghostModeState };
}

/**
 * Load mock handlers dynamically
 */
async function loadMockHandlers() {
  const { http, HttpResponse } = await import("msw");

  return [
    http.get("/api/health", () => {
      return HttpResponse.json({ status: "ok", mode: "ghost" });
    }),

    http.get("/api/user/me", () => {
      return HttpResponse.json({
        id: "ghost-user-001",
        email: "ghost@valueos.dev",
        name: "Ghost User",
        tier: "pro",
        tenant_id: "ghost-tenant",
        created_at: new Date().toISOString(),
      });
    }),

    http.get("/api/agents", () => {
      return HttpResponse.json({
        agents: [
          {
            id: "ghost-agent-1",
            name: "Mock Agent Alpha",
            status: "idle",
            capabilities: ["analysis", "generation"],
          },
          {
            id: "ghost-agent-2",
            name: "Mock Agent Beta",
            status: "idle",
            capabilities: ["review", "optimization"],
          },
        ],
      });
    }),

    http.post("/api/agents/:agentId/invoke", async ({ params }) => {
      await new Promise((r) => setTimeout(r, 500));
      return HttpResponse.json({
        id: `ghost-task-${Date.now()}`,
        agentId: params.agentId,
        status: "completed",
        result: {
          message: "This is a mock response from Ghost Mode",
          timestamp: new Date().toISOString(),
        },
      });
    }),

    http.get("/api/settings", () => {
      return HttpResponse.json({
        theme: "system",
        notifications: true,
        language: "en",
      });
    }),

    http.get("/api/feature-flags", () => {
      return HttpResponse.json({
        flags: {
          "new-dashboard": true,
          "ai-suggestions": true,
          "beta-features": false,
        },
      });
    }),

    http.all("*", ({ request }) => {
      console.debug(
        `[Ghost Mode] Passthrough: ${request.method} ${request.url}`
      );
      return undefined;
    }),
  ];
}

declare global {
  interface Window {
    __GHOST_MODE__?: GhostModeState;
  }
}

if (typeof window !== "undefined") {
  Object.defineProperty(window, "__GHOST_MODE__", {
    get: () => ghostModeState,
    configurable: true,
  });
}
