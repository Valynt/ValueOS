import React, { useEffect, useRef } from "react";
import { useBootstrap } from "../../hooks/useBootstrap";

interface BootstrapGuardProps {
  children: React.ReactNode;
}

/**
 * Guard component that handles application bootstrap sequence
 * Shows loading state or error screen and only renders children on success.
 */
export const BootstrapGuard: React.FC<BootstrapGuardProps> = ({ children }) => {
  const { status, progress, step, errors, startBootstrap } = useBootstrap();
  const hasStarted = useRef(false);

  useEffect(() => {
    if (!hasStarted.current) {
      hasStarted.current = true;
      startBootstrap().catch(() => {
        // Errors are handled by the hook's state
      });
    }
  }, [startBootstrap]);

  if (status === "idle" || status === "loading") {
    return (
      <div className="vc-loading-root">
        <div className="vc-loading-inner">
          <div className="vc-loading-title">VALYNT</div>
          <div className="vc-loading-subtitle">
            {progress || "Initializing the value operating system..."}
          </div>
          <div className="vc-loading-bar" aria-hidden="true">
            <div
              className="vc-loading-fill"
              style={{
                width: `${(step / 8) * 100}%`,
                transition: "width 0.3s ease",
              }}
            ></div>
          </div>
          <div className="vc-loading-step">Step {step} of 8</div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="vc-error-root">
        <div className="vc-error-card">
          <div className="vc-error-icon">⚠️</div>
          <div className="vc-error-title">
            Application Initialization Failed
          </div>
          <div className="vc-error-message">
            The application could not be initialized. Please contact support if
            this problem persists.
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

  // Success state
  return (
    <>
      <div
        id="bootstrap-complete"
        data-testid="bootstrap-complete"
        style={{ display: "none" }}
      />
      {children}
    </>
  );
};
