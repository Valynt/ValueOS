/**
 * SessionExpiredModal Component
 *
 * Displays when user session expires, prompting re-login.
 * Preserves the attempted URL for redirect after successful login.
 */

import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Clock, LogIn, X } from "lucide-react";
import { cn } from "../../lib/utils";

interface SessionExpiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  attemptedUrl?: string;
}

export function SessionExpiredModal({ isOpen, onClose, attemptedUrl }: SessionExpiredModalProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isRedirecting, setIsRedirecting] = useState(false);

  if (!isOpen) return null;

  const handleLogin = () => {
    setIsRedirecting(true);
    // Store the attempted URL in location state for redirect after login
    const returnUrl = attemptedUrl || location.pathname;
    navigate("/login", { state: { from: returnUrl }, replace: true });
  };

  const handleDismiss = () => {
    onClose();
    navigate("/login", { replace: true });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
      aria-describedby="session-expired-description"
    >
      <div
        className={cn(
          "bg-gray-900 border border-gray-700 rounded-xl",
          "w-full max-w-md mx-4 shadow-2xl",
          "animate-scale-in"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <h2 id="session-expired-title" className="text-lg font-semibold text-white">
              Session Expired
            </h2>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p id="session-expired-description" className="text-gray-400 mb-4">
            Your session has expired due to inactivity. Please sign in again to continue where you
            left off.
          </p>

          {attemptedUrl && (
            <div className="mb-4 p-3 bg-gray-800/50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">You were viewing:</p>
              <p className="text-sm text-gray-300 font-mono truncate">{attemptedUrl}</p>
            </div>
          )}

          <p className="text-sm text-gray-500">
            You'll be redirected back to your previous page after signing in.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-800">
          <button
            onClick={handleDismiss}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium",
              "bg-gray-800 hover:bg-gray-700 text-gray-300",
              "transition-colors"
            )}
          >
            Dismiss
          </button>
          <button
            onClick={handleLogin}
            disabled={isRedirecting}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
              "bg-primary hover:bg-primary/90 text-white",
              "transition-colors",
              isRedirecting && "opacity-50 cursor-not-allowed"
            )}
          >
            <LogIn className="w-4 h-4" />
            {isRedirecting ? "Redirecting..." : "Sign In Again"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SessionExpiredModal;
