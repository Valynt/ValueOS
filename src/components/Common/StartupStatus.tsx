/**
 * Startup Status Component
 *
 * Displays boot diagnostics and dependency status.
 * Shows immediately on app load to prevent blank screens.
 */

import React, { useCallback, useEffect, useState } from "react";
import type {
  DependencyCheck,
  DependencyStatus,
  StartupState,
} from "../../lib/startup/types";
import {
  checkAllDependencies,
  getDefaultDependencies,
  recheckDependency,
} from "../../lib/startup/dependency-checker";
import {
  shouldActivateGhostMode,
  activateGhostMode,
  getGhostModeState,
} from "../../lib/startup/ghost-mode";

interface StartupStatusProps {
  onReady?: () => void;
  onDegraded?: (state: StartupState) => void;
  showAlways?: boolean;
  children?: React.ReactNode;
}

const STATUS_ICONS: Record<DependencyStatus, string> = {
  pending: "⏳",
  checking: "🔄",
  ok: "✅",
  degraded: "⚠️",
  failed: "❌",
  timeout: "⏱️",
};

const STATUS_COLORS: Record<DependencyStatus, string> = {
  pending: "#6b7280",
  checking: "#3b82f6",
  ok: "#10b981",
  degraded: "#f59e0b",
  failed: "#ef4444",
  timeout: "#f59e0b",
};

function DependencyRow({
  dep,
  onRetry,
}: {
  dep: DependencyCheck;
  onRetry: (name: string) => void;
}) {
  const canRetry = dep.status === "failed" || dep.status === "timeout";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.5rem 0",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ fontSize: "1rem" }}>{STATUS_ICONS[dep.status]}</span>
        <span style={{ fontWeight: 500 }}>{dep.name}</span>
        {!dep.required && (
          <span
            style={{
              fontSize: "0.625rem",
              padding: "0.125rem 0.375rem",
              background: "#e5e7eb",
              borderRadius: "9999px",
              color: "#6b7280",
            }}
          >
            optional
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        {dep.responseTime !== undefined && dep.status === "ok" && (
          <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
            {dep.responseTime}ms
          </span>
        )}
        {dep.error && (
          <span
            style={{
              fontSize: "0.75rem",
              color: STATUS_COLORS[dep.status],
              maxWidth: "200px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={dep.error}
          >
            {dep.error}
          </span>
        )}
        {canRetry && (
          <button
            onClick={() => onRetry(dep.name)}
            style={{
              padding: "0.25rem 0.5rem",
              fontSize: "0.75rem",
              background: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

export function StartupStatus({
  onReady,
  onDegraded,
  showAlways = false,
  children,
}: StartupStatusProps) {
  const [state, setState] = useState<StartupState>({
    phase: "initializing",
    dependencies: {},
    startTime: Date.now(),
    errors: [],
    warnings: [],
  });
  const [showDetails, setShowDetails] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let mounted = true;

    const runChecks = async () => {
      const result = await checkAllDependencies(
        getDefaultDependencies(),
        (name, status) => {
          if (!mounted) return;
          setState((prev) => ({
            ...prev,
            phase: "checking",
            dependencies: {
              ...prev.dependencies,
              [name]: {
                ...prev.dependencies[name],
                name,
                status,
                required: prev.dependencies[name]?.required ?? false,
              },
            },
          }));
        }
      );

      if (!mounted) return;
      setState(result);

      if (result.phase === "ready") {
        onReady?.();
      } else if (result.phase === "degraded") {
        onDegraded?.(result);

        // Auto-activate Ghost Mode if backend is down
        if (shouldActivateGhostMode(result)) {
          activateGhostMode("Backend unreachable during startup").then(() => {
            console.info("[StartupStatus] Ghost Mode auto-activated");
          });
        }
      }
    };

    runChecks();

    return () => {
      mounted = false;
    };
  }, [onReady, onDegraded]);

  const handleRetry = useCallback(async (name: string) => {
    setState((prev) => ({
      ...prev,
      dependencies: {
        ...prev.dependencies,
        [name]: {
          ...prev.dependencies[name],
          status: "checking",
        },
      },
    }));

    const result = await recheckDependency(name);
    if (result) {
      setState((prev) => {
        const newDeps = { ...prev.dependencies, [name]: result };
        const allOk = Object.values(newDeps).every(
          (d) => d.status === "ok" || (!d.required && d.status !== "failed")
        );
        const hasFailure = Object.values(newDeps).some(
          (d) => d.status === "failed" || d.status === "timeout"
        );

        return {
          ...prev,
          dependencies: newDeps,
          phase: allOk ? "ready" : hasFailure ? "degraded" : prev.phase,
        };
      });
    }
  }, []);

  const handleRetryAll = useCallback(async () => {
    setState((prev) => ({ ...prev, phase: "checking" }));
    const result = await checkAllDependencies();
    setState(result);
    if (result.phase === "ready") {
      onReady?.();
    }
  }, [onReady]);

  const deps = Object.values(state.dependencies);
  const isReady = state.phase === "ready";
  const isDegraded = state.phase === "degraded";
  const isFailed = state.phase === "failed";
  const isChecking =
    state.phase === "checking" || state.phase === "initializing";

  if (isReady && !showAlways && !showDetails) {
    return <>{children}</>;
  }

  if (dismissed && isDegraded) {
    return <>{children}</>;
  }

  if (isFailed) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
          padding: "2rem",
        }}
      >
        <div
          style={{
            maxWidth: "32rem",
            width: "100%",
            background: "white",
            borderRadius: "12px",
            padding: "2rem",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>🚫</div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>
              Configuration Error
            </h1>
            <p style={{ color: "#6b7280", marginTop: "0.5rem" }}>
              The application cannot start due to configuration issues.
            </p>
          </div>

          {state.errors.length > 0 && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "8px",
                padding: "1rem",
                marginBottom: "1rem",
              }}
            >
              <h3
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#991b1b",
                  margin: "0 0 0.5rem 0",
                }}
              >
                Errors
              </h3>
              <ul
                style={{ margin: 0, paddingLeft: "1.25rem", color: "#b91c1c" }}
              >
                {state.errors.map((error, idx) => (
                  <li
                    key={idx}
                    style={{ fontSize: "0.875rem", marginBottom: "0.25rem" }}
                  >
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ marginBottom: "1rem" }}>
            <h3
              style={{
                fontSize: "0.875rem",
                fontWeight: 600,
                marginBottom: "0.5rem",
              }}
            >
              Dependency Status
            </h3>
            {deps.map((dep) => (
              <DependencyRow key={dep.name} dep={dep} onRetry={handleRetry} />
            ))}
          </div>

          <div
            style={{
              background: "#f3f4f6",
              borderRadius: "8px",
              padding: "1rem",
              marginBottom: "1rem",
            }}
          >
            <h3
              style={{
                fontSize: "0.875rem",
                fontWeight: 600,
                marginBottom: "0.5rem",
              }}
            >
              Quick Fix
            </h3>
            <p style={{ fontSize: "0.875rem", color: "#4b5563", margin: 0 }}>
              Run{" "}
              <code
                style={{
                  background: "#e5e7eb",
                  padding: "0.125rem 0.25rem",
                  borderRadius: "4px",
                }}
              >
                npm run dx
              </code>{" "}
              to start the development environment with correct configuration.
            </p>
          </div>

          <div
            style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}
          >
            <button
              onClick={handleRetryAll}
              style={{
                padding: "0.5rem 1.5rem",
                background: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Retry All
            </button>
            <button
              onClick={() => setShowDetails(!showDetails)}
              style={{
                padding: "0.5rem 1.5rem",
                background: "#e5e7eb",
                color: "#374151",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              {showDetails ? "Hide" : "Show"} Details
            </button>
          </div>

          {showDetails && (
            <details style={{ marginTop: "1rem" }}>
              <summary style={{ cursor: "pointer", fontWeight: 500 }}>
                Environment Info
              </summary>
              <pre
                style={{
                  marginTop: "0.5rem",
                  padding: "0.75rem",
                  background: "#1f2937",
                  color: "#e5e7eb",
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  overflow: "auto",
                }}
              >
                {JSON.stringify(
                  {
                    location: window.location.href,
                    userAgent: navigator.userAgent.slice(0, 50),
                    timestamp: new Date().toISOString(),
                  },
                  null,
                  2
                )}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }

  if (isChecking) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
        }}
      >
        <div style={{ textAlign: "center", color: "white" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              border: "3px solid rgba(255,255,255,0.3)",
              borderTopColor: "white",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 1rem",
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 500, margin: 0 }}>
            Starting ValueOS...
          </h1>
          <p
            style={{ opacity: 0.7, marginTop: "0.5rem", fontSize: "0.875rem" }}
          >
            Checking dependencies
          </p>
        </div>
      </div>
    );
  }

  if (isDegraded) {
    return (
      <>
        <div
          role="alert"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            padding: "0.75rem 1rem",
            background: "#fef3c7",
            borderBottom: "1px solid #f59e0b",
            color: "#92400e",
            fontSize: "0.875rem",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.75rem",
          }}
        >
          <span>⚠️</span>
          <span>
            <strong>Degraded Mode:</strong> Some services are unavailable.
            {state.warnings.length > 0 && ` ${state.warnings[0]}`}
          </span>
          <button
            onClick={() => setShowDetails(!showDetails)}
            style={{
              padding: "0.25rem 0.75rem",
              background: "#f59e0b",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.75rem",
            }}
          >
            Details
          </button>
          <button
            onClick={handleRetryAll}
            style={{
              padding: "0.25rem 0.75rem",
              background: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.75rem",
            }}
          >
            Retry
          </button>
          <button
            onClick={() => setDismissed(true)}
            style={{
              padding: "0.25rem 0.5rem",
              background: "transparent",
              color: "#92400e",
              border: "none",
              cursor: "pointer",
              fontSize: "0.75rem",
            }}
          >
            Dismiss
          </button>
        </div>

        {showDetails && (
          <div
            style={{
              position: "fixed",
              top: "3rem",
              right: "1rem",
              width: "320px",
              background: "white",
              borderRadius: "8px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
              zIndex: 9998,
              padding: "1rem",
            }}
          >
            <h3
              style={{
                margin: "0 0 0.75rem 0",
                fontSize: "0.875rem",
                fontWeight: 600,
              }}
            >
              Service Status
            </h3>
            {deps.map((dep) => (
              <DependencyRow key={dep.name} dep={dep} onRetry={handleRetry} />
            ))}
          </div>
        )}

        <div style={{ paddingTop: "3rem" }}>{children}</div>
      </>
    );
  }

  return <>{children}</>;
}

export default StartupStatus;
