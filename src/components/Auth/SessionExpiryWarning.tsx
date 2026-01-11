/**
 * Session Expiry Warning Component
 *
 * Shows countdown and allows user to extend session
 *
 * AUTH-004: User notification for session timeout
 */

import React, { useState, useEffect, useCallback } from "react";
import { logger } from "../../lib/logger";

interface SessionWarningProps {
  onExtendSession: () => Promise<void>;
  onLogout: () => void;
}

export function SessionExpiryWarning({
  onExtendSession,
  onLogout,
}: SessionWarningProps) {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isExtending, setIsExtending] = useState(false);

  // Check session expiry from response headers
  useEffect(() => {
    const checkSessionExpiry = () => {
      // Get last response headers (stored by axios interceptor)
      const expirySeconds = sessionStorage.getItem("session_expiry_seconds");
      const shouldWarn = sessionStorage.getItem("session_warning") === "true";

      if (shouldWarn && expirySeconds) {
        setTimeRemaining(parseInt(expirySeconds, 10));
      } else {
        setTimeRemaining(null);
      }
    };

    // Check every 10 seconds
    const interval = setInterval(checkSessionExpiry, 10000);
    checkSessionExpiry(); // Initial check

    return () => clearInterval(interval);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          // Session expired
          logger.warn("Session expired - logging out");
          onLogout();
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, onLogout]);

  const handleExtend = useCallback(async () => {
    setIsExtending(true);
    try {
      await onExtendSession();
      setTimeRemaining(null); // Hide warning after extension
      logger.info("Session extended successfully");
    } catch (error) {
      logger.error("Failed to extend session", error);
    } finally {
      setIsExtending(false);
    }
  }, [onExtendSession]);

  // Don't show if no warning needed
  if (timeRemaining === null || timeRemaining > 120) {
    return null;
  }

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const isUrgent = timeRemaining <= 60; // Last minute

  return (
    <div
      className={`session-warning ${isUrgent ? "session-warning-urgent" : ""}`}
    >
      <div className="session-warning-content">
        <div className="session-warning-icon">{isUrgent ? "⚠️" : "ℹ️"}</div>
        <div className="session-warning-message">
          <strong>Session Expiring Soon</strong>
          <p>
            Your session will expire in {minutes > 0 && `${minutes}m `}
            {seconds}s
          </p>
        </div>
        <div className="session-warning-actions">
          <button
            onClick={handleExtend}
            disabled={isExtending}
            className="btn btn-primary btn-sm"
          >
            {isExtending ? "Extending..." : "Stay Logged In"}
          </button>
          <button onClick={onLogout} className="btn btn-secondary btn-sm">
            Logout
          </button>
        </div>
      </div>

      <style jsx>{`
        .session-warning {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 9999;
          background: #fff8dc;
          border: 2px solid #ffa500;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          padding: 16px;
          max-width: 400px;
          animation: slideIn 0.3s ease-out;
        }

        .session-warning-urgent {
          background: #ffe4e4;
          border-color: #dc3545;
          animation: pulse 1s infinite;
        }

        .session-warning-content {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .session-warning-icon {
          font-size: 24px;
          flex-shrink: 0;
        }

        .session-warning-message {
          flex: 1;
        }

        .session-warning-message strong {
          display: block;
          margin-bottom: 4px;
          color: #333;
        }

        .session-warning-message p {
          margin: 0;
          font-size: 14px;
          color: #666;
        }

        .session-warning-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .btn {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          white-space: nowrap;
        }

        .btn-primary {
          background: #007bff;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #0056b3;
        }

        .btn-primary:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: #6c757d;
          color: white;
        }

        .btn-secondary:hover {
          background: #5a6268;
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes pulse {
          0%,
          100% {
            box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
          }
          50% {
            box-shadow: 0 4px 20px rgba(220, 53, 69, 0.6);
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Hook to manage session expiry
 */
export function useSessionExpiry() {
  const handleExtendSession = async () => {
    // Make any API call to refresh session
    const response = await fetch("/api/auth/refresh-session", {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to extend session");
    }
  };

  const handleLogout = () => {
    window.location.href = "/logout";
  };

  return {
    handleExtendSession,
    handleLogout,
  };
}

// Axios interceptor to capture session expiry headers
export function setupSessionExpiryInterceptor(axios: any) {
  axios.interceptors.response.use(
    (response: any) => {
      const expiryHeader = response.headers["x-session-expiry"];
      const warningHeader = response.headers["x-session-warning"];

      if (expiryHeader) {
        sessionStorage.setItem("session_expiry_seconds", expiryHeader);
      }
      if (warningHeader) {
        sessionStorage.setItem("session_warning", warningHeader);
      }

      return response;
    },
    (error: any) => Promise.reject(error)
  );
}
