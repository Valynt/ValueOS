import { HelpCircle, Sparkles } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

interface HelpTooltipProps {
  text: string;
  onProvenanceClick?: () => void;
  position?: "top" | "bottom" | "left" | "right";
  icon?: "sparkles" | "help";
}

const positionClasses = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
} as const;

export const HelpTooltip: React.FC<HelpTooltipProps> = ({
  text,
  onProvenanceClick,
  position = "top",
  icon = "sparkles",
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isProvenanced, setIsProvenanced] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(true);
  };

  const hideTooltip = () => {
    timeoutRef.current = setTimeout(() => setIsVisible(false), 150);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleProvenanceClick = () => {
    setIsProvenanced(!isProvenanced);
    onProvenanceClick?.();
  };

  const Icon = icon === "sparkles" ? Sparkles : HelpCircle;

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {/* Tooltip */}
      <div
        className={`absolute z-50 ${positionClasses[position]} pointer-events-none transition-all duration-200 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
          }`}
        role="tooltip"
        aria-hidden={!isVisible}
      >
        <div className="bg-slate-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap max-w-xs">
          {text}
          {onProvenanceClick && (
            <button
              onClick={handleProvenanceClick}
              className={`ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors ${isProvenanced
                  ? "bg-green-500/20 text-green-300"
                  : "bg-white/10 hover:bg-white/20"
                }`}
              aria-label={isProvenanced ? "Provenance verified" : "Show provenance"}
              aria-pressed={isProvenanced}
              onMouseEnter={showTooltip}
              onMouseLeave={hideTooltip}
            >
              <Sparkles className="w-3 h-3" aria-hidden="true" />
              {isProvenanced ? "Verified" : "Source"}
            </button>
          )}
          {/* Arrow */}
          <div className={`absolute w-2 h-2 bg-slate-900 rotate-45 ${position === "top" ? "top-full left-1/2 -translate-x-1/2 -mt-1" :
              position === "bottom" ? "bottom-full left-1/2 -translate-x-1/2 -mb-1" :
                position === "left" ? "left-full top-1/2 -translate-y-1/2 -ml-1" :
                  "right-full top-1/2 -translate-y-1/2 -mr-1"
            }`} />
        </div>
      </div>

      {/* Trigger button */}
      <button
        className="inline-flex items-center justify-center w-6 h-6 rounded-full hover:bg-indigo-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
        aria-label={isProvenanced ? "Help (verified)" : "Help"}
        onClick={handleProvenanceClick}
        aria-describedby={isVisible ? "tooltip-content" : undefined}
      >
        <Icon className={`w-4 h-4 ${isProvenanced ? "text-green-600" : "text-indigo-500"}`} aria-hidden="true" />
      </button>
    </div>
  );
};

HelpTooltip.displayName = "HelpTooltip";
