/**
 * EnvironmentBanner Component
 *
 * Displays environment information and configuration warnings.
 * Only visible in non-production environments.
 */

import { useState, useEffect } from "react";
import { AlertTriangle, X, Info, CheckCircle } from "lucide-react";
import { getConfig, validateEnvironmentConfig } from "../../config/environment";
import { cn } from "../../lib/utils";

interface EnvironmentBannerProps {
  className?: string;
}

export function EnvironmentBanner({ className }: EnvironmentBannerProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [config, setConfig] = useState<ReturnType<typeof getConfig> | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    try {
      const cfg = getConfig();
      setConfig(cfg);
      setErrors(validateEnvironmentConfig(cfg));
    } catch (err) {
      setErrors([(err as Error).message]);
    }
  }, []);

  if (!config || config.app.env === "production") {
    return null;
  }

  if (!isVisible) {
    return null;
  }

  const envColors = {
    development: "bg-blue-500/10 border-blue-500/30 text-blue-400",
    staging: "bg-amber-500/10 border-amber-500/30 text-amber-400",
    test: "bg-purple-500/10 border-purple-500/30 text-purple-400",
  };

  const envColor = envColors[config.app.env] || envColors.development;
  const hasErrors = errors.length > 0;

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 max-w-md",
        "rounded-lg border shadow-lg backdrop-blur-sm",
        hasErrors ? "bg-red-500/10 border-red-500/30" : envColor,
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="p-3">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            {hasErrors ? (
              <AlertTriangle className="w-5 h-5 text-red-400" />
            ) : (
              <Info className="w-5 h-5" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm uppercase tracking-wide">
                {config.app.env}
              </span>
              {!hasErrors && <CheckCircle className="w-4 h-4 text-green-400" />}
            </div>

            {hasErrors ? (
              <div className="space-y-1">
                <p className="text-xs text-red-300">Configuration issues detected:</p>
                <ul className="text-xs text-red-200 space-y-0.5">
                  {errors.slice(0, 3).map((error, i) => (
                    <li key={i} className="truncate">
                      • {error}
                    </li>
                  ))}
                  {errors.length > 3 && (
                    <li className="text-red-300">+{errors.length - 3} more issues</li>
                  )}
                </ul>
              </div>
            ) : (
              <p className="text-xs opacity-80">API: {config.app.apiBaseUrl}</p>
            )}
          </div>

          <button
            onClick={() => setIsVisible(false)}
            className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
            aria-label="Dismiss environment banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feature flags summary */}
        <div className="mt-2 pt-2 border-t border-white/10">
          <div className="flex flex-wrap gap-1">
            {Object.entries(config.features).map(([key, enabled]) => (
              <span
                key={key}
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded",
                  enabled ? "bg-green-500/20 text-green-300" : "bg-gray-500/20 text-gray-400"
                )}
              >
                {key.replace(/([A-Z])/g, " $1").trim()}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EnvironmentBanner;
