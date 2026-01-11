/**
 * PersonaSelector Component
 *
 * Allows users to select their persona (Strategist/Closer/Grower)
 * and switch modes per workspace.
 */

import { Lightbulb, Target, TrendingUp, Check } from "lucide-react";
import type { Persona } from "./PersonaCTACard";
import { cn } from "../../lib/utils";

export type WorkspaceMode = "strategize" | "close" | "grow";

interface PersonaSelectorProps {
  currentPersona: Persona;
  currentMode?: WorkspaceMode;
  onPersonaChange: (persona: Persona) => void;
  onModeChange?: (mode: WorkspaceMode) => void;
  showModeSelector?: boolean;
  className?: string;
}

const personaConfig = {
  strategist: {
    icon: Lightbulb,
    label: "Strategist",
    description: "Build value hypotheses and business cases",
    color: "purple",
  },
  closer: {
    icon: Target,
    label: "Closer",
    description: "Win deals with compelling ROI stories",
    color: "blue",
  },
  grower: {
    icon: TrendingUp,
    label: "Grower",
    description: "Expand accounts and prove realized value",
    color: "green",
  },
};

const modeConfig = {
  strategize: {
    icon: Lightbulb,
    label: "Strategize",
    color: "purple",
  },
  close: {
    icon: Target,
    label: "Close",
    color: "blue",
  },
  grow: {
    icon: TrendingUp,
    label: "Grow",
    color: "green",
  },
};

export function PersonaSelector({
  currentPersona,
  currentMode,
  onPersonaChange,
  onModeChange,
  showModeSelector = false,
  className,
}: PersonaSelectorProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Persona selection */}
      <div>
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
          Your Persona
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(personaConfig) as Persona[]).map((persona) => {
            const config = personaConfig[persona];
            const Icon = config.icon;
            const isSelected = currentPersona === persona;

            return (
              <button
                key={persona}
                onClick={() => onPersonaChange(persona)}
                className={cn(
                  "relative flex flex-col items-center gap-2 p-3 rounded-lg",
                  "border transition-all duration-200",
                  isSelected
                    ? cn(
                        "border-opacity-50",
                        config.color === "purple" && "bg-purple-500/10 border-purple-500",
                        config.color === "blue" && "bg-blue-500/10 border-blue-500",
                        config.color === "green" && "bg-green-500/10 border-green-500"
                      )
                    : "bg-gray-800/50 border-gray-700 hover:border-gray-600"
                )}
              >
                {isSelected && (
                  <div className="absolute top-1.5 right-1.5">
                    <Check className="w-3.5 h-3.5 text-primary" />
                  </div>
                )}
                <Icon
                  className={cn(
                    "w-5 h-5",
                    isSelected
                      ? cn(
                          config.color === "purple" && "text-purple-400",
                          config.color === "blue" && "text-blue-400",
                          config.color === "green" && "text-green-400"
                        )
                      : "text-gray-400"
                  )}
                />
                <span
                  className={cn("text-xs font-medium", isSelected ? "text-white" : "text-gray-400")}
                >
                  {config.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Description */}
        <p className="text-xs text-gray-500 mt-2">{personaConfig[currentPersona].description}</p>
      </div>

      {/* Mode selector (per workspace) */}
      {showModeSelector && onModeChange && currentMode && (
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
            Current Mode
          </label>
          <div className="flex gap-1 p-1 bg-gray-800/50 rounded-lg">
            {(Object.keys(modeConfig) as WorkspaceMode[]).map((mode) => {
              const config = modeConfig[mode];
              const Icon = config.icon;
              const isSelected = currentMode === mode;

              return (
                <button
                  key={mode}
                  onClick={() => onModeChange(mode)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md",
                    "text-xs font-medium transition-all duration-150",
                    isSelected
                      ? cn(
                          "text-white",
                          config.color === "purple" && "bg-purple-500/20",
                          config.color === "blue" && "bg-blue-500/20",
                          config.color === "green" && "bg-green-500/20"
                        )
                      : "text-gray-500 hover:text-gray-300"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {config.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface PersonaBadgeProps {
  persona: Persona;
  size?: "sm" | "md";
  className?: string;
}

export function PersonaBadge({ persona, size = "md", className }: PersonaBadgeProps) {
  const config = personaConfig[persona];
  const Icon = config.icon;

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5 gap-1",
    md: "text-sm px-2.5 py-1 gap-1.5",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        sizeClasses[size],
        config.color === "purple" && "bg-purple-500/10 text-purple-400",
        config.color === "blue" && "bg-blue-500/10 text-blue-400",
        config.color === "green" && "bg-green-500/10 text-green-400",
        className
      )}
    >
      <Icon className={iconSizes[size]} />
      {config.label}
    </span>
  );
}

export default PersonaSelector;
