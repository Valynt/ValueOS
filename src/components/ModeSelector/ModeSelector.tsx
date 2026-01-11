/**
 * ModeSelector Component
 *
 * Toggle between workspace modes: Builder, Presenter, Tracker.
 * Persists selection to localStorage.
 */

import { useState, useEffect, useCallback } from "react";
import { Hammer, Presentation, BarChart3, Check } from "lucide-react";
import { cn } from "../../lib/utils";

export type WorkspaceMode = "builder" | "presenter" | "tracker";

interface ModeConfig {
  id: WorkspaceMode;
  label: string;
  description: string;
  icon: React.ReactNode;
  density: "compact" | "normal" | "spacious";
  features: {
    editingEnabled: boolean;
    showToolbar: boolean;
    showMetrics: boolean;
    exportReady: boolean;
  };
}

const modeConfigs: ModeConfig[] = [
  {
    id: "builder",
    label: "Builder",
    description: "Full editing capabilities",
    icon: <Hammer className="w-4 h-4" />,
    density: "normal",
    features: {
      editingEnabled: true,
      showToolbar: true,
      showMetrics: true,
      exportReady: false,
    },
  },
  {
    id: "presenter",
    label: "Presenter",
    description: "Clean view for presentations",
    icon: <Presentation className="w-4 h-4" />,
    density: "spacious",
    features: {
      editingEnabled: false,
      showToolbar: false,
      showMetrics: false,
      exportReady: true,
    },
  },
  {
    id: "tracker",
    label: "Tracker",
    description: "Focus on metrics and progress",
    icon: <BarChart3 className="w-4 h-4" />,
    density: "compact",
    features: {
      editingEnabled: false,
      showToolbar: false,
      showMetrics: true,
      exportReady: false,
    },
  },
];

const STORAGE_KEY = "valueos-workspace-mode";

interface ModeSelectorProps {
  onChange?: (mode: WorkspaceMode, config: ModeConfig) => void;
  defaultMode?: WorkspaceMode;
  variant?: "buttons" | "dropdown" | "pills";
  showDescription?: boolean;
  className?: string;
}

export function ModeSelector({
  onChange,
  defaultMode = "builder",
  variant = "pills",
  showDescription = false,
  className,
}: ModeSelectorProps) {
  const [currentMode, setCurrentMode] = useState<WorkspaceMode>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && modeConfigs.some((m) => m.id === stored)) {
        return stored as WorkspaceMode;
      }
    }
    return defaultMode;
  });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, currentMode);
  }, [currentMode]);

  const handleModeChange = useCallback(
    (mode: WorkspaceMode) => {
      setCurrentMode(mode);
      const config = modeConfigs.find((m) => m.id === mode);
      if (config) {
        onChange?.(mode, config);
      }
    },
    [onChange]
  );

  const currentConfig = modeConfigs.find((m) => m.id === currentMode);

  if (variant === "dropdown") {
    return (
      <div className={cn("relative", className)}>
        <select
          value={currentMode}
          onChange={(e) => handleModeChange(e.target.value as WorkspaceMode)}
          className={cn(
            "appearance-none px-4 py-2 pr-8 rounded-lg",
            "bg-gray-800 border border-gray-700 text-white",
            "focus:border-primary focus:ring-1 focus:ring-primary/50 outline-none",
            "cursor-pointer"
          )}
        >
          {modeConfigs.map((mode) => (
            <option key={mode.id} value={mode.id}>
              {mode.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (variant === "buttons") {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        {modeConfigs.map((mode) => {
          const isActive = currentMode === mode.id;

          return (
            <button
              key={mode.id}
              onClick={() => handleModeChange(mode.id)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-left",
                "border transition-all duration-200",
                isActive
                  ? "bg-primary/10 border-primary text-white"
                  : "bg-gray-800/50 border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-white"
              )}
            >
              <div
                className={cn(
                  "p-2 rounded-lg",
                  isActive ? "bg-primary/20 text-primary" : "bg-gray-700 text-gray-400"
                )}
              >
                {mode.icon}
              </div>
              <div className="flex-1">
                <div className="font-medium">{mode.label}</div>
                {showDescription && <div className="text-sm text-gray-500">{mode.description}</div>}
              </div>
              {isActive && <Check className="w-5 h-5 text-primary" />}
            </button>
          );
        })}
      </div>
    );
  }

  // Pills variant (default)
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 p-1 rounded-lg bg-gray-800/50 border border-gray-700",
        className
      )}
      role="radiogroup"
      aria-label="Workspace mode"
    >
      {modeConfigs.map((mode) => {
        const isActive = currentMode === mode.id;

        return (
          <button
            key={mode.id}
            onClick={() => handleModeChange(mode.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium",
              "transition-all duration-200",
              isActive
                ? "bg-primary text-white shadow-sm"
                : "text-gray-400 hover:text-white hover:bg-gray-700/50"
            )}
            role="radio"
            aria-checked={isActive}
          >
            {mode.icon}
            <span className="hidden sm:inline">{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Hook to get current mode and config
 */
export function useWorkspaceMode(): {
  mode: WorkspaceMode;
  config: ModeConfig;
  setMode: (mode: WorkspaceMode) => void;
} {
  const [mode, setModeState] = useState<WorkspaceMode>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && modeConfigs.some((m) => m.id === stored)) {
        return stored as WorkspaceMode;
      }
    }
    return "builder";
  });

  const setMode = useCallback((newMode: WorkspaceMode) => {
    setModeState(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
  }, []);

  const config = modeConfigs.find((m) => m.id === mode) || modeConfigs[0];

  return { mode, config, setMode };
}

export { modeConfigs };
export default ModeSelector;
