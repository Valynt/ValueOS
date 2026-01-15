import React, { useEffect, useRef, useState } from "react";
import { useBootstrap } from "../../hooks/useBootstrap";
import { logger } from "../../lib/logger";

interface BootstrapGuardProps {
  children: React.ReactNode;
}

/**
 * Check if Supabase is reachable with timeout
 */
async function checkSupabaseHealth(timeoutMs = 5000): Promise<{
  reachable: boolean;
  error?: string;
}> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  if (!supabaseUrl) {
    return { reachable: false, error: "VITE_SUPABASE_URL not configured" };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: "HEAD",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return { reachable: response.ok || response.status === 400 }; // 400 is OK (no auth)
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { reachable: false, error: "Connection timed out" };
    }
    return {
      reachable: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Guard component that handles application bootstrap sequence
 * Runs bootstrap in the background without blocking the UI.
 * Shows appropriate error screens for configuration and connectivity issues.
 */
export const BootstrapGuard: React.FC<BootstrapGuardProps> = ({ children }) => {
  const { status, errors, startBootstrap } = useBootstrap();
  const hasStarted = useRef(false);
  const [supabaseStatus, setSupabaseStatus] = useState<{
    checked: boolean;
    reachable: boolean;
    error?: string;
  }>({ checked: false, reachable: true });

  useEffect(() => {
    if (!hasStarted.current) {
      hasStarted.current = true;

      // Check Supabase connectivity first (with timeout)
      checkSupabaseHealth(5000).then((result) => {
        setSupabaseStatus({ checked: true, ...result });

        if (!result.reachable) {
          logger.warn("Supabase not reachable", { error: result.error });
        }
      });

      // Run bootstrap in the background without blocking UI
      startBootstrap()
        .then((result) => {
          if (result) {
            logger.info("Bootstrap completed", {
              success: result.success,
              duration: result.duration,
              warnings: result.warnings.length,
            });
          }
        })
        .catch((err) => {
          logger.error("Bootstrap failed", err);
        });
    }
  }, [startBootstrap]);

  // Show Supabase connectivity warning banner (non-blocking)
  const showSupabaseWarning =
    supabaseStatus.checked && !supabaseStatus.reachable;

  // Only block the UI for critical configuration errors
  // that would prevent the app from functioning at all
  if (
    status === "error" &&
    errors.some(
      (e) =>
        e.includes("configuration") ||
        e.includes("VITE_SUPABASE_URL") ||
        e.includes("VITE_SUPABASE_ANON_KEY")
    )
  ) {
    return (
      <div className="vc-error-root">
        <div className="vc-error-card">
          <div className="vc-error-icon">⚠️</div>
          <div className="vc-error-title">Critical Configuration Error</div>
          <div className="vc-error-message">
            The application is missing required configuration. Please check your
            environment variables.
          </div>
          <div className="vc-error-details">
            <div className="vc-error-summary">Error Details</div>
            <ul
              className="vc-error-list"
              style={{ textAlign: "left", marginTop: "1rem" }}
            >
              {errors.map((error: string, idx: number) => (
                <li key={idx} className="vc-error-list-item">
                  {error}
                </li>
              ))}
            </ul>
          </div>
          <div style={{ marginTop: "1rem", fontSize: "0.875rem", color: "#666" }}>
            <strong>Quick Fix:</strong> Run <code>npm run dx</code> to start the
            development environment with correct configuration.
          </div>
          <button
            className="vc-retry-button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: "2rem",
              padding: "0.5rem 2rem",
              background: "var(--vc-color-primary, #0066ff)",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Render children with optional warning banner
  return (
    <>
      <div
        id="bootstrap-status"
        data-testid="bootstrap-status"
        data-status={status}
        style={{ display: "none" }}
      />

      {/* Supabase connectivity warning banner */}
      {showSupabaseWarning && (
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
            gap: "0.5rem",
          }}
        >
          <span>⚠️</span>
          <span>
            <strong>Supabase not reachable:</strong> {supabaseStatus.error}.
            Authentication and data features may not work.
          </span>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginLeft: "1rem",
              padding: "0.25rem 0.75rem",
              background: "#f59e0b",
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
            onClick={() =>
              setSupabaseStatus((s) => ({ ...s, reachable: true }))
            }
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
      )}

      {/* Add padding when warning banner is shown */}
      <div style={{ paddingTop: showSupabaseWarning ? "3rem" : 0 }}>
        {children}
      </div>
    </>
  );
};
