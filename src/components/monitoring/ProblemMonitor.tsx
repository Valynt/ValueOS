/**
 * Problem Monitor Component
 *
 * Automatically monitors for code problems and displays status
 */

import { useEffect } from "react";
import { useProblemMonitor } from "../../hooks/useProblemMonitor";

interface ProblemMonitorProps {
  /**
   * Whether to automatically start monitoring on mount
   * @default true
   */
  autoStart?: boolean;

  /**
   * Initial problems to load (e.g., from IDE)
   */
  initialProblems?: Array<{
    path: string;
    message: string;
    severity: "error" | "warning" | "info";
    startLine?: number;
    endLine?: number;
  }>;

  /**
   * Whether to show a visual indicator
   * @default false
   */
  showIndicator?: boolean;

  /**
   * Callback when problems are detected
   */
  onProblemsDetected?: (errorCount: number, warningCount: number) => void;
}

/**
 * Component that monitors for problems in the background
 */
export function ProblemMonitor({
  autoStart = true,
  initialProblems,
  showIndicator = false,
  onProblemsDetected,
}: ProblemMonitorProps) {
  const { stats, updateProblems, start, stop } = useProblemMonitor(false);

  // Initialize with problems if provided
  useEffect(() => {
    if (initialProblems) {
      updateProblems(initialProblems);
    }
  }, [initialProblems, updateProblems]);

  // Start/stop monitoring
  useEffect(() => {
    if (autoStart) {
      start();
      return () => stop();
    }
  }, [autoStart, start, stop]);

  // Notify when problems are detected
  useEffect(() => {
    if (stats && onProblemsDetected) {
      onProblemsDetected(stats.errors, stats.warnings);
    }
  }, [stats, onProblemsDetected]);

  // Don't render anything if indicator is disabled
  if (!showIndicator) {
    return null;
  }

  // Render a simple status indicator
  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        left: "20px",
        padding: "8px 12px",
        borderRadius: "6px",
        backgroundColor: stats?.errors
          ? "#dc2626"
          : stats?.warnings
            ? "#f59e0b"
            : "#10b981",
        color: "white",
        fontSize: "12px",
        fontFamily: "monospace",
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
        zIndex: 9999,
      }}
    >
      {stats ? (
        <>
          {stats.errors > 0 && `❌ ${stats.errors} errors`}
          {stats.errors > 0 && stats.warnings > 0 && " • "}
          {stats.warnings > 0 && `⚠️ ${stats.warnings} warnings`}
          {stats.errors === 0 && stats.warnings === 0 && "✅ No problems"}
        </>
      ) : (
        "🔍 Monitoring..."
      )}
    </div>
  );
}
