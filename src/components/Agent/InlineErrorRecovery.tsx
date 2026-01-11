/**
 * InlineErrorRecovery Component
 *
 * Handles tool failures with actionable alternatives.
 * Offers "Manual Input" or "Upload PDF" options upon API failure.
 * Part of the 7-state agentic UX model.
 */

import { useState } from "react";
import {
  AlertTriangle,
  Upload,
  Keyboard,
  RefreshCw,
  ChevronRight,
  FileText,
  Globe,
  Database,
  X,
} from "lucide-react";
import { cn } from "../../lib/utils";

export type FailureType = "api" | "parsing" | "timeout" | "auth" | "rate_limit" | "unknown";

export interface RecoveryOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  action: () => void | Promise<void>;
  primary?: boolean;
}

export interface ToolFailure {
  toolName: string;
  errorMessage: string;
  errorCode?: string;
  failureType: FailureType;
  timestamp: Date;
  retryable: boolean;
  context?: Record<string, unknown>;
}

interface InlineErrorRecoveryProps {
  failure: ToolFailure;
  onRetry?: () => Promise<void>;
  onManualInput?: () => void;
  onUploadFile?: () => void;
  onSkip?: () => void;
  onDismiss?: () => void;
  customOptions?: RecoveryOption[];
  className?: string;
}

const FAILURE_MESSAGES: Record<FailureType, { title: string; suggestion: string }> = {
  api: {
    title: "External service unavailable",
    suggestion: "The service may be temporarily down. You can retry or provide the data manually.",
  },
  parsing: {
    title: "Data extraction failed",
    suggestion: "We couldn't extract the expected data. Try uploading a cleaner document.",
  },
  timeout: {
    title: "Request timed out",
    suggestion: "The operation took too long. Try again or break it into smaller steps.",
  },
  auth: {
    title: "Authentication required",
    suggestion: "Please reconnect your account or check your API credentials.",
  },
  rate_limit: {
    title: "Rate limit exceeded",
    suggestion: "Too many requests. Please wait a moment before retrying.",
  },
  unknown: {
    title: "Something went wrong",
    suggestion: "An unexpected error occurred. Try again or use an alternative method.",
  },
};

const TOOL_ICONS: Record<string, React.ReactNode> = {
  web_search: <Globe className="w-4 h-4" />,
  document_parser: <FileText className="w-4 h-4" />,
  database_query: <Database className="w-4 h-4" />,
};

export function InlineErrorRecovery({
  failure,
  onRetry,
  onManualInput,
  onUploadFile,
  onSkip,
  onDismiss,
  customOptions = [],
  className,
}: InlineErrorRecoveryProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const failureInfo = FAILURE_MESSAGES[failure.failureType];
  const toolIcon = TOOL_ICONS[failure.toolName] || <AlertTriangle className="w-4 h-4" />;

  const handleRetry = async () => {
    if (!onRetry) return;
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleOptionClick = async (option: RecoveryOption) => {
    setSelectedOption(option.id);
    await option.action();
  };

  // Build recovery options
  const recoveryOptions: RecoveryOption[] = [
    ...(failure.retryable && onRetry
      ? [
          {
            id: "retry",
            label: "Try Again",
            description: "Retry the failed operation",
            icon: <RefreshCw className={cn("w-4 h-4", isRetrying && "animate-spin")} />,
            action: handleRetry,
            primary: true,
          },
        ]
      : []),
    ...(onManualInput
      ? [
          {
            id: "manual",
            label: "Manual Input",
            description: "Enter the data yourself",
            icon: <Keyboard className="w-4 h-4" />,
            action: onManualInput,
          },
        ]
      : []),
    ...(onUploadFile
      ? [
          {
            id: "upload",
            label: "Upload File",
            description: "Upload a PDF or document",
            icon: <Upload className="w-4 h-4" />,
            action: onUploadFile,
          },
        ]
      : []),
    ...customOptions,
  ];

  return (
    <div
      className={cn(
        "relative rounded-xl border p-5",
        "bg-red-500/5 border-red-500/20",
        "shadow-[0_0_20px_rgba(239,68,68,0.1)]",
        "animate-fade-in",
        className
      )}
      role="alert"
      aria-live="assertive"
    >
      {/* Dismiss button */}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-red-400" />
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <h3 className="text-base font-semibold text-white mb-1">{failureInfo.title}</h3>
          <p className="text-sm text-gray-400">{failureInfo.suggestion}</p>
        </div>
      </div>

      {/* Error details */}
      <div className="mb-4 p-3 rounded-lg bg-gray-800/50 border border-gray-700">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            {toolIcon}
            <span className="font-mono">{failure.toolName}</span>
          </div>
          {failure.errorCode && (
            <span className="text-xs font-mono text-red-400/70">[{failure.errorCode}]</span>
          )}
        </div>
        <p className="text-sm text-gray-400 font-mono break-words">{failure.errorMessage}</p>
      </div>

      {/* Recovery options */}
      {recoveryOptions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Recovery Options</p>
          <div className="grid gap-2">
            {recoveryOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => handleOptionClick(option)}
                disabled={isRetrying && option.id === "retry"}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg text-left",
                  "border transition-all duration-150",
                  option.primary
                    ? "bg-primary/10 border-primary/30 hover:bg-primary/20 hover:border-primary/50"
                    : "bg-gray-800/30 border-gray-700 hover:bg-gray-800/50 hover:border-gray-600",
                  selectedOption === option.id && "ring-2 ring-primary/50",
                  isRetrying && option.id === "retry" && "opacity-50 cursor-not-allowed"
                )}
              >
                <div
                  className={cn(
                    "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
                    option.primary ? "bg-primary/20 text-primary" : "bg-gray-700 text-gray-400"
                  )}
                >
                  {option.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white">{option.label}</div>
                  <div className="text-xs text-gray-500">{option.description}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Skip option */}
      {onSkip && (
        <div className="mt-4 pt-4 border-t border-gray-800">
          <button
            onClick={onSkip}
            className="text-sm text-gray-500 hover:text-gray-400 transition-colors"
          >
            Skip this step and continue →
          </button>
        </div>
      )}
    </div>
  );
}

export default InlineErrorRecovery;
