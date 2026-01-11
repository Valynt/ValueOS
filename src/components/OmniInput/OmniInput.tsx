/**
 * OmniInput Component
 *
 * Smart input that detects input type (URL, company name, natural language query)
 * and provides suggestions based on recent/popular items.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Search,
  Globe,
  Building2,
  MessageSquare,
  Clock,
  Sparkles,
  Loader2,
  X,
  ArrowRight,
} from "lucide-react";
import { cn } from "../../lib/utils";

export type InputType = "url" | "company" | "query";

export interface ParsedInput {
  type: InputType;
  value: string;
  metadata?: Record<string, unknown>;
}

export interface SuggestionItem {
  id: string;
  type: InputType;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  metadata?: Record<string, unknown>;
}

interface OmniInputProps {
  onSubmit: (input: ParsedInput) => void;
  placeholder?: string;
  autoFocus?: boolean;
  recentItems?: SuggestionItem[];
  popularItems?: SuggestionItem[];
  className?: string;
  disabled?: boolean;
}

const typeConfig = {
  url: {
    icon: <Globe className="w-4 h-4" />,
    label: "URL",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
  },
  company: {
    icon: <Building2 className="w-4 h-4" />,
    label: "Company",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
  },
  query: {
    icon: <MessageSquare className="w-4 h-4" />,
    label: "Query",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
  },
};

/**
 * Detect input type based on content
 */
function detectInputType(value: string): InputType {
  const trimmed = value.trim();

  // URL detection
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("www.") ||
    /^[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}/.test(trimmed)
  ) {
    return "url";
  }

  // Company name detection (capitalized words, common suffixes)
  const companyPatterns = [
    /\b(Inc|LLC|Ltd|Corp|Co|Company|Group|Holdings|Partners)\b/i,
    /^[A-Z][a-zA-Z]*(\s+[A-Z][a-zA-Z]*)+$/, // Multiple capitalized words
  ];

  if (companyPatterns.some((pattern) => pattern.test(trimmed))) {
    return "company";
  }

  // Default to query
  return "query";
}

export function OmniInput({
  onSubmit,
  placeholder = "Enter URL, company name, or ask a question...",
  autoFocus = false,
  recentItems = [],
  popularItems = [],
  className,
  disabled = false,
}: OmniInputProps) {
  const [value, setValue] = useState("");
  const [detectedType, setDetectedType] = useState<InputType>("query");
  const [isDetecting, setIsDetecting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced type detection
  useEffect(() => {
    if (!value.trim()) {
      setDetectedType("query");
      return;
    }

    setIsDetecting(true);
    const timer = setTimeout(() => {
      setDetectedType(detectInputType(value));
      setIsDetecting(false);
    }, 150);

    return () => clearTimeout(timer);
  }, [value]);

  // Filter suggestions based on input
  const suggestions = useMemo(() => {
    const query = value.toLowerCase().trim();
    if (!query) {
      // Show recent items when empty
      return recentItems.slice(0, 5);
    }

    // Filter and combine recent + popular
    const allItems = [...recentItems, ...popularItems];
    const filtered = allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(query) || item.description?.toLowerCase().includes(query)
    );

    // Deduplicate by id
    const seen = new Set<string>();
    return filtered
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .slice(0, 8);
  }, [value, recentItems, popularItems]);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!value.trim() || disabled) return;

    const parsed: ParsedInput = {
      type: detectedType,
      value: value.trim(),
      metadata: {
        detectedAt: new Date().toISOString(),
      },
    };

    // Add URL-specific metadata
    if (detectedType === "url") {
      try {
        const url = value.startsWith("http") ? value : `https://${value}`;
        const parsed_url = new URL(url);
        parsed.metadata = {
          ...parsed.metadata,
          hostname: parsed_url.hostname,
          pathname: parsed_url.pathname,
        };
      } catch {
        // Invalid URL, continue with raw value
      }
    }

    onSubmit(parsed);
    setValue("");
    setShowSuggestions(false);
  }, [value, detectedType, onSubmit, disabled]);

  const handleSuggestionSelect = useCallback(
    (suggestion: SuggestionItem) => {
      const parsed: ParsedInput = {
        type: suggestion.type,
        value: suggestion.label,
        metadata: suggestion.metadata,
      };
      onSubmit(parsed);
      setValue("");
      setShowSuggestions(false);
    },
    [onSubmit]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSuggestionSelect(suggestions[selectedIndex]);
        } else {
          handleSubmit();
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        setShowSuggestions(true);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        setShowSuggestions(true);
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    },
    [suggestions, selectedIndex, handleSubmit, handleSuggestionSelect]
  );

  const currentTypeConfig = typeConfig[detectedType];

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Input container */}
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-xl",
          "bg-gray-900 border border-gray-700",
          "focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
          "transition-all duration-200",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {/* Type indicator */}
        <div
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium",
            currentTypeConfig.bgColor,
            currentTypeConfig.color,
            "transition-colors duration-200"
          )}
        >
          {isDetecting ? <Loader2 className="w-3 h-3 animate-spin" /> : currentTypeConfig.icon}
          <span className="hidden sm:inline">{currentTypeConfig.label}</span>
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setShowSuggestions(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className={cn(
            "flex-1 bg-transparent text-white placeholder-gray-500",
            "text-base outline-none",
            disabled && "cursor-not-allowed"
          )}
          aria-label="Search input"
          aria-expanded={showSuggestions}
          aria-haspopup="listbox"
        />

        {/* Clear button */}
        {value && (
          <button
            onClick={() => {
              setValue("");
              inputRef.current?.focus();
            }}
            className="p-1 rounded hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="Clear input"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={!value.trim() || disabled}
          className={cn(
            "p-2 rounded-lg transition-colors",
            value.trim() && !disabled
              ? "bg-primary hover:bg-primary/90 text-white"
              : "bg-gray-800 text-gray-500 cursor-not-allowed"
          )}
          aria-label="Submit"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          className={cn(
            "absolute top-full left-0 right-0 mt-2 z-50",
            "bg-gray-900 border border-gray-700 rounded-xl shadow-xl",
            "overflow-hidden animate-fade-in"
          )}
          role="listbox"
        >
          {/* Recent header */}
          {!value.trim() && recentItems.length > 0 && (
            <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-2">
              <Clock className="w-3 h-3" />
              Recent
            </div>
          )}

          {/* Suggestions list */}
          {suggestions.map((suggestion, index) => {
            const config = typeConfig[suggestion.type];
            const isSelected = index === selectedIndex;

            return (
              <button
                key={suggestion.id}
                onClick={() => handleSuggestionSelect(suggestion)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-left",
                  "transition-colors",
                  isSelected ? "bg-primary/20 text-white" : "text-gray-300 hover:bg-gray-800"
                )}
                role="option"
                aria-selected={isSelected}
              >
                <span className={cn("flex-shrink-0", config.color)}>
                  {suggestion.icon || config.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{suggestion.label}</div>
                  {suggestion.description && (
                    <div className="text-sm text-gray-500 truncate">{suggestion.description}</div>
                  )}
                </div>
                <span className={cn("text-xs px-1.5 py-0.5 rounded", config.bgColor, config.color)}>
                  {config.label}
                </span>
              </button>
            );
          })}

          {/* AI suggestion hint */}
          {value.trim() && (
            <div className="px-4 py-2 border-t border-gray-800 text-xs text-gray-500 flex items-center gap-2">
              <Sparkles className="w-3 h-3" />
              Press Enter to search with AI
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default OmniInput;
