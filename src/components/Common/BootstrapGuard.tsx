import React, { useEffect, useRef } from "react";
import { useBootstrap } from "../../hooks/useBootstrap";
import { logger } from "../../lib/logger";

interface BootstrapGuardProps {
  children: React.ReactNode;
}

/**
 * Guard component that handles application bootstrap sequence
 * Runs bootstrap in the background without blocking the UI.
 * Only shows error screen for critical configuration failures.
 */
export const BootstrapGuard: React.FC<BootstrapGuardProps> = ({ children }) => {
  const { status, errors, startBootstrap } = useBootstrap();
  const hasStarted = useRef(false);

  useEffect(() => {
    if (!hasStarted.current) {
      hasStarted.current = true;
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

  // Render children immediately - bootstrap runs in background
  // Agent health checks and other non-critical checks won't block the UI
  return (
    <>
      <div
        id="bootstrap-status"
        data-testid="bootstrap-status"
        data-status={status}
        style={{ display: "none" }}
      />
      {children}
    </>
  );
};
