/**
 * AccessDenied Component
 *
 * Displays when user lacks permission to access a resource.
 * Provides clear messaging and navigation options.
 */

import { ShieldX, ArrowLeft, Home, HelpCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "../../lib/utils";

interface AccessDeniedProps {
  title?: string;
  message?: string;
  requiredPermission?: string;
  showHomeButton?: boolean;
  showBackButton?: boolean;
  showHelpButton?: boolean;
  onHelp?: () => void;
  className?: string;
}

export function AccessDenied({
  title = "Access Denied",
  message = "You don't have permission to access this resource.",
  requiredPermission,
  showHomeButton = true,
  showBackButton = true,
  showHelpButton = true,
  onHelp,
  className,
}: AccessDeniedProps) {
  const navigate = useNavigate();

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center min-h-[400px] p-8 text-center",
        className
      )}
      role="alert"
      aria-live="polite"
    >
      {/* Icon */}
      <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
        <ShieldX className="w-10 h-10 text-red-400" />
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>

      {/* Message */}
      <p className="text-gray-400 max-w-md mb-2">{message}</p>

      {/* Required permission hint */}
      {requiredPermission && (
        <p className="text-sm text-gray-500 mb-6">
          Required permission:{" "}
          <code className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400">
            {requiredPermission}
          </code>
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 mt-4">
        {showBackButton && (
          <button
            onClick={() => navigate(-1)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg",
              "bg-gray-800 hover:bg-gray-700 text-gray-300",
              "text-sm font-medium transition-colors"
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        )}
        {showHomeButton && (
          <button
            onClick={() => navigate("/")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg",
              "bg-primary hover:bg-primary/90 text-white",
              "text-sm font-medium transition-colors"
            )}
          >
            <Home className="w-4 h-4" />
            Go Home
          </button>
        )}
        {showHelpButton && (
          <button
            onClick={onHelp || (() => navigate("/docs"))}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg",
              "bg-gray-800 hover:bg-gray-700 text-gray-300",
              "text-sm font-medium transition-colors"
            )}
          >
            <HelpCircle className="w-4 h-4" />
            Get Help
          </button>
        )}
      </div>

      {/* Contact admin hint */}
      <p className="text-xs text-gray-600 mt-8">
        If you believe this is an error, please contact your administrator.
      </p>
    </div>
  );
}

export default AccessDenied;
