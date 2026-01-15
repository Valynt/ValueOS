/**
 * Dev HUD - Persistent Developer Heads-Up Display
 *
 * A collapsible overlay that stays in the corner during development.
 * Provides:
 * - Environment toggles (hot-swap API URLs)
 * - Auth masquerade (force login as test users)
 * - Feature flag overrides
 * - Nuke state button
 * - Ghost Mode status
 * - Smart remediation actions
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  getRuntimeConfig,
  overrideRuntimeConfig,
  type RuntimeConfig,
} from "../../lib/startup/runtime-config";
import {
  getGhostModeState,
  activateGhostMode,
  deactivateGhostMode,
  type GhostModeState,
} from "../../lib/startup/ghost-mode";
import {
  detectIssues,
  executeRemediation,
  type DetectedIssue,
} from "../../lib/startup/smart-remediation";

interface DevHUDProps {
  defaultOpen?: boolean;
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}

interface LocalFeatureFlags {
  [key: string]: boolean;
}

const STORAGE_KEY = "dev-hud-state";
const FLAGS_STORAGE_KEY = "dev-feature-flag-overrides";

const PRESET_ENVIRONMENTS: { label: string; config: Partial<RuntimeConfig> }[] =
  [
    {
      label: "Local",
      config: {
        api: "/api",
        supabaseUrl: "http://localhost:54321",
        agentApiUrl: "http://localhost:3001/api/agents",
        environment: "development",
      },
    },
    {
      label: "Staging",
      config: {
        api: "https://staging-api.valueos.dev",
        supabaseUrl: "https://staging.supabase.valueos.dev",
        agentApiUrl: "https://staging-agents.valueos.dev/api/agents",
        environment: "staging",
      },
    },
    {
      label: "Mock (Ghost)",
      config: {
        api: "/api",
        environment: "development",
      },
    },
  ];

const TEST_USERS = [
  { id: "test-admin", email: "admin@test.valueos.dev", role: "admin" },
  { id: "test-user", email: "user@test.valueos.dev", role: "user" },
  { id: "test-guest", email: "guest@test.valueos.dev", role: "guest" },
];

const DEFAULT_FLAGS: LocalFeatureFlags = {
  "new-dashboard": false,
  "ai-suggestions": true,
  "beta-features": false,
  "debug-mode": false,
  "performance-overlay": false,
};

export function DevHUD({
  defaultOpen = false,
  position = "bottom-right",
}: DevHUDProps) {
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved).isOpen : defaultOpen;
    } catch {
      return defaultOpen;
    }
  });

  const [activeTab, setActiveTab] = useState<
    "env" | "auth" | "flags" | "tools" | "issues"
  >("env");

  const [config, setConfig] = useState<RuntimeConfig>(getRuntimeConfig);
  const [ghostMode, setGhostMode] = useState<GhostModeState>(getGhostModeState);
  const [flags, setFlags] = useState<LocalFeatureFlags>(() => {
    try {
      const saved = localStorage.getItem(FLAGS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_FLAGS;
    } catch {
      return DEFAULT_FLAGS;
    }
  });
  const [issues, setIssues] = useState<DetectedIssue[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ isOpen }));
  }, [isOpen]);

  useEffect(() => {
    localStorage.setItem(FLAGS_STORAGE_KEY, JSON.stringify(flags));
    window.dispatchEvent(
      new CustomEvent("featureflags:changed", { detail: flags })
    );
  }, [flags]);

  useEffect(() => {
    const handleGhostMode = () => setGhostMode(getGhostModeState());
    window.addEventListener("ghostmode:activated", handleGhostMode);
    window.addEventListener("ghostmode:deactivated", handleGhostMode);
    return () => {
      window.removeEventListener("ghostmode:activated", handleGhostMode);
      window.removeEventListener("ghostmode:deactivated", handleGhostMode);
    };
  }, []);

  useEffect(() => {
    detectIssues(true).then(setIssues);
    const interval = setInterval(() => {
      detectIssues(true).then(setIssues);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const showToast = useCallback(
    (message: string, type: "success" | "error") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
    },
    []
  );

  const handleEnvChange = useCallback(
    (preset: (typeof PRESET_ENVIRONMENTS)[0]) => {
      const newConfig = overrideRuntimeConfig(preset.config);
      setConfig(newConfig);

      if (preset.label === "Mock (Ghost)") {
        activateGhostMode("Switched to Mock environment");
      }

      showToast(`Switched to ${preset.label}`, "success");
    },
    [showToast]
  );

  const handleMasquerade = useCallback(
    async (user: (typeof TEST_USERS)[0]) => {
      const fakeToken = btoa(
        JSON.stringify({
          sub: user.id,
          email: user.email,
          role: user.role,
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        })
      );

      localStorage.setItem("sb-access-token", `fake.${fakeToken}.sig`);
      localStorage.setItem("dev-masquerade-user", JSON.stringify(user));

      showToast(`Masquerading as ${user.email}`, "success");
      setTimeout(() => window.location.reload(), 1000);
    },
    [showToast]
  );

  const handleFlagToggle = useCallback((key: string) => {
    setFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleNukeState = useCallback(async () => {
    setActionLoading("nuke");
    try {
      localStorage.clear();
      sessionStorage.clear();

      const databases = await indexedDB.databases?.();
      if (databases) {
        for (const db of databases) {
          if (db.name) indexedDB.deleteDatabase(db.name);
        }
      }

      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
      });

      showToast("All state nuked! Reloading...", "success");
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      showToast(
        `Nuke failed: ${error instanceof Error ? error.message : "Unknown"}`,
        "error"
      );
    } finally {
      setActionLoading(null);
    }
  }, [showToast]);

  const handleGhostModeToggle = useCallback(async () => {
    setActionLoading("ghost");
    try {
      if (ghostMode.active) {
        await deactivateGhostMode();
        showToast("Ghost Mode deactivated", "success");
      } else {
        await activateGhostMode("Manual activation");
        showToast("Ghost Mode activated", "success");
      }
      setGhostMode(getGhostModeState());
    } catch (error) {
      showToast(
        `Ghost Mode toggle failed: ${error instanceof Error ? error.message : "Unknown"}`,
        "error"
      );
    } finally {
      setActionLoading(null);
    }
  }, [ghostMode.active, showToast]);

  const handleRemediation = useCallback(
    async (actionId: string) => {
      setActionLoading(actionId);
      try {
        const result = await executeRemediation(actionId);
        showToast(result.message, result.success ? "success" : "error");
      } catch (error) {
        showToast(
          `Action failed: ${error instanceof Error ? error.message : "Unknown"}`,
          "error"
        );
      } finally {
        setActionLoading(null);
      }
    },
    [showToast]
  );

  const positionStyles: React.CSSProperties = {
    position: "fixed",
    zIndex: 99999,
    ...(position.includes("top") ? { top: "1rem" } : { bottom: "1rem" }),
    ...(position.includes("left") ? { left: "1rem" } : { right: "1rem" }),
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          ...positionStyles,
          width: "40px",
          height: "40px",
          borderRadius: "50%",
          background: ghostMode.active
            ? "linear-gradient(135deg, #8b5cf6, #6366f1)"
            : "linear-gradient(135deg, #3b82f6, #1d4ed8)",
          border: "none",
          color: "white",
          fontSize: "18px",
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        title="Open Dev HUD"
      >
        {ghostMode.active ? "👻" : "🛠️"}
        {issues.length > 0 && (
          <span
            style={{
              position: "absolute",
              top: "-4px",
              right: "-4px",
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              background: "#ef4444",
              color: "white",
              fontSize: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {issues.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <>
      <div
        style={{
          ...positionStyles,
          width: "360px",
          maxHeight: "480px",
          background: "#1f2937",
          borderRadius: "12px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
          overflow: "hidden",
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: "13px",
          color: "#e5e7eb",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.75rem 1rem",
            background: ghostMode.active
              ? "linear-gradient(135deg, #8b5cf6, #6366f1)"
              : "linear-gradient(135deg, #3b82f6, #1d4ed8)",
            color: "white",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>{ghostMode.active ? "👻" : "🛠️"}</span>
            <span style={{ fontWeight: 600 }}>Dev HUD</span>
            {ghostMode.active && (
              <span
                style={{
                  fontSize: "10px",
                  padding: "2px 6px",
                  background: "rgba(255,255,255,0.2)",
                  borderRadius: "4px",
                }}
              >
                Ghost Mode
              </span>
            )}
          </div>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              background: "none",
              border: "none",
              color: "white",
              cursor: "pointer",
              fontSize: "16px",
              padding: "4px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #374151",
            background: "#111827",
          }}
        >
          {(
            [
              { id: "env", label: "🌐 Env" },
              { id: "auth", label: "🔐 Auth" },
              { id: "flags", label: "🚩 Flags" },
              { id: "tools", label: "🔧 Tools" },
              { id: "issues", label: `⚠️ (${issues.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: "0.5rem",
                background: activeTab === tab.id ? "#1f2937" : "transparent",
                border: "none",
                borderBottom:
                  activeTab === tab.id
                    ? "2px solid #3b82f6"
                    : "2px solid transparent",
                color: activeTab === tab.id ? "#fff" : "#9ca3af",
                cursor: "pointer",
                fontSize: "11px",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: "1rem", maxHeight: "340px", overflowY: "auto" }}>
          {activeTab === "env" && (
            <div>
              <div style={{ marginBottom: "1rem" }}>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#9ca3af",
                    marginBottom: "0.5rem",
                  }}
                >
                  Current: {config.environment} → {config.api}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  {PRESET_ENVIRONMENTS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => handleEnvChange(preset)}
                      style={{
                        padding: "0.5rem 0.75rem",
                        background:
                          config.api === preset.config.api
                            ? "#3b82f6"
                            : "#374151",
                        border: "none",
                        borderRadius: "6px",
                        color: "white",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: "1rem" }}>
                <label style={{ fontSize: "11px", color: "#9ca3af" }}>
                  Custom API URL
                </label>
                <input
                  type="text"
                  value={config.api}
                  onChange={(e) => {
                    const newConfig = overrideRuntimeConfig({
                      api: e.target.value,
                    });
                    setConfig(newConfig);
                  }}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    marginTop: "0.25rem",
                    background: "#374151",
                    border: "1px solid #4b5563",
                    borderRadius: "6px",
                    color: "white",
                    fontSize: "12px",
                  }}
                />
              </div>
            </div>
          )}

          {activeTab === "auth" && (
            <div>
              <div
                style={{
                  fontSize: "11px",
                  color: "#9ca3af",
                  marginBottom: "0.75rem",
                }}
              >
                Masquerade as a test user (bypasses real auth)
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                {TEST_USERS.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleMasquerade(user)}
                    style={{
                      padding: "0.5rem 0.75rem",
                      background: "#374151",
                      border: "none",
                      borderRadius: "6px",
                      color: "white",
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>{user.email}</span>
                    <span
                      style={{
                        fontSize: "10px",
                        padding: "2px 6px",
                        background: "#4b5563",
                        borderRadius: "4px",
                      }}
                    >
                      {user.role}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === "flags" && (
            <div>
              <div
                style={{
                  fontSize: "11px",
                  color: "#9ca3af",
                  marginBottom: "0.75rem",
                }}
              >
                Toggle feature flags instantly
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                {Object.entries(flags).map(([key, value]) => (
                  <div
                    key={key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.5rem 0.75rem",
                      background: "#374151",
                      borderRadius: "6px",
                    }}
                  >
                    <span>{key}</span>
                    <button
                      onClick={() => handleFlagToggle(key)}
                      style={{
                        width: "40px",
                        height: "20px",
                        borderRadius: "10px",
                        background: value ? "#10b981" : "#4b5563",
                        border: "none",
                        cursor: "pointer",
                        position: "relative",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          top: "2px",
                          left: value ? "22px" : "2px",
                          width: "16px",
                          height: "16px",
                          borderRadius: "50%",
                          background: "white",
                          transition: "left 0.2s",
                        }}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "tools" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <button
                onClick={handleGhostModeToggle}
                disabled={actionLoading === "ghost"}
                style={{
                  padding: "0.75rem",
                  background: ghostMode.active
                    ? "linear-gradient(135deg, #8b5cf6, #6366f1)"
                    : "#374151",
                  border: "none",
                  borderRadius: "6px",
                  color: "white",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                👻 {ghostMode.active ? "Disable" : "Enable"} Ghost Mode
                {actionLoading === "ghost" && " ..."}
              </button>

              <button
                onClick={handleNukeState}
                disabled={actionLoading === "nuke"}
                style={{
                  padding: "0.75rem",
                  background: "#dc2626",
                  border: "none",
                  borderRadius: "6px",
                  color: "white",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                💥 Nuke All State
                {actionLoading === "nuke" && " ..."}
              </button>

              <button
                onClick={() => {
                  console.clear();
                  showToast("Console cleared", "success");
                }}
                style={{
                  padding: "0.75rem",
                  background: "#374151",
                  border: "none",
                  borderRadius: "6px",
                  color: "white",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                🧹 Clear Console
              </button>

              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: "0.75rem",
                  background: "#374151",
                  border: "none",
                  borderRadius: "6px",
                  color: "white",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                🔄 Reload Page
              </button>
            </div>
          )}

          {activeTab === "issues" && (
            <div>
              {issues.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    color: "#9ca3af",
                    padding: "2rem",
                  }}
                >
                  ✅ No issues detected
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}
                >
                  {issues.map((issue) => (
                    <div
                      key={issue.id}
                      style={{
                        padding: "0.75rem",
                        background: "#374151",
                        borderRadius: "6px",
                        borderLeft: `3px solid ${
                          issue.severity === "error"
                            ? "#ef4444"
                            : issue.severity === "warning"
                              ? "#f59e0b"
                              : "#3b82f6"
                        }`,
                      }}
                    >
                      <div style={{ fontWeight: 500, marginBottom: "0.25rem" }}>
                        {issue.remediation?.icon} {issue.title}
                      </div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#9ca3af",
                          marginBottom: "0.5rem",
                        }}
                      >
                        {issue.description}
                      </div>
                      {issue.remediation && (
                        <button
                          onClick={() => handleRemediation(issue.id)}
                          disabled={actionLoading === issue.id}
                          style={{
                            padding: "0.375rem 0.75rem",
                            background: "#3b82f6",
                            border: "none",
                            borderRadius: "4px",
                            color: "white",
                            cursor: "pointer",
                            fontSize: "11px",
                          }}
                        >
                          {actionLoading === issue.id ? "Running..." : "Fix It"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "5rem",
            right: "1rem",
            padding: "0.75rem 1rem",
            background: toast.type === "success" ? "#10b981" : "#ef4444",
            color: "white",
            borderRadius: "6px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 100000,
            fontSize: "13px",
          }}
        >
          {toast.message}
        </div>
      )}
    </>
  );
}

export default DevHUD;
