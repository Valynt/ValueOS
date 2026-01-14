/**
 * Accessibility Audit Component
 *
 * Runs comprehensive accessibility checks and provides actionable reports.
 * Integrates with axe-core for automated WCAG compliance testing.
 */

import React, { useState, useCallback } from "react";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Download,
  Eye,
} from "lucide-react";
import {
  accessibilityChecker,
  AccessibilityIssue,
} from "../../utils/accessibility";

interface AccessibilityAuditProps {
  containerRef?: React.RefObject<HTMLElement>;
  autoRun?: boolean;
  showDetails?: boolean;
  onAuditComplete?: (results: AuditResults) => void;
}

interface AuditResults {
  score: number;
  totalIssues: number;
  errors: number;
  warnings: number;
  issues: AccessibilityIssue[];
  timestamp: Date;
}

export const AccessibilityAudit: React.FC<AccessibilityAuditProps> = ({
  containerRef,
  autoRun = false,
  showDetails = true,
  onAuditComplete,
}) => {
  const [results, setResults] = useState<AuditResults | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const runAudit = useCallback(async () => {
    setIsRunning(true);

    try {
      // Run our custom accessibility checker
      const container = containerRef?.current || document.body;
      const issues = accessibilityChecker.audit(container);
      const report = accessibilityChecker.generateReport();

      const auditResults: AuditResults = {
        ...report,
        issues,
        timestamp: new Date(),
      };

      setResults(auditResults);
      onAuditComplete?.(auditResults);

      // Announce results to screen readers
      const announcement = results
        ? `Audit complete. ${results.errors} errors, ${results.warnings} warnings. Accessibility score: ${results.score}%.`
        : "Audit complete. No previous results to compare.";

      const announcementEl = document.createElement("div");
      announcementEl.setAttribute("role", "status");
      announcementEl.setAttribute("aria-live", "polite");
      announcementEl.className = "sr-only";
      announcementEl.textContent = announcement;
      document.body.appendChild(announcementEl);

      setTimeout(() => {
        document.body.removeChild(announcementEl);
      }, 1000);
    } catch (error) {
      console.error("Accessibility audit failed:", error);
    } finally {
      setIsRunning(false);
    }
  }, [containerRef, onAuditComplete, results]);

  // Auto-run audit on mount if requested
  React.useEffect(() => {
    if (autoRun) {
      runAudit();
    }
  }, [autoRun, runAudit]);

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreIcon = (score: number) => {
    if (score >= 90) return <CheckCircle className="w-5 h-5 text-green-600" />;
    if (score >= 70)
      return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    return <XCircle className="w-5 h-5 text-red-600" />;
  };

  const exportReport = () => {
    if (!results) return;

    const reportData = {
      audit: {
        timestamp: results.timestamp.toISOString(),
        score: results.score,
        totalIssues: results.totalIssues,
        errors: results.errors,
        warnings: results.warnings,
      },
      issues: results.issues,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `accessibility-audit-${results.timestamp.toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Audit Controls */}
      <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
        <div className="flex items-center space-x-3">
          <button
            onClick={runAudit}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Running Audit...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Run Accessibility Audit
              </>
            )}
          </button>

          {results && (
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                {getScoreIcon(results.score)}
                <span
                  className={`text-lg font-semibold ${getScoreColor(results.score)}`}
                >
                  {results.score}%
                </span>
              </div>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <XCircle className="w-4 h-4 text-red-500" />
                  {results.errors} errors
                </span>
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  {results.warnings} warnings
                </span>
              </div>
            </div>
          )}
        </div>

        {results && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowReport(!showReport)}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Eye className="w-4 h-4" />
              {showReport ? "Hide" : "Show"} Report
            </button>
            <button
              onClick={exportReport}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        )}
      </div>

      {/* Detailed Report */}
      {showReport && results && showDetails && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Accessibility Audit Report
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Generated on {results.timestamp.toLocaleString()}
            </p>
          </div>

          <div className="divide-y divide-gray-200">
            {results.issues.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">
                  No accessibility issues found!
                </h4>
                <p className="text-gray-600">
                  Your component passed all accessibility checks.
                </p>
              </div>
            ) : (
              results.issues.map((issue, index) => (
                <div key={index} className="p-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      {issue.severity === "error" && (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                      {issue.severity === "warning" && (
                        <AlertTriangle className="w-5 h-5 text-yellow-500" />
                      )}
                      {issue.severity === "info" && (
                        <AlertCircle className="w-5 h-5 text-blue-500" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-gray-900">
                          {issue.issue}
                        </h4>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            issue.severity === "error"
                              ? "bg-red-100 text-red-800"
                              : issue.severity === "warning"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {issue.severity}
                        </span>
                      </div>

                      <p className="text-sm text-gray-600 mt-1">
                        <strong>Element:</strong>{" "}
                        <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
                          {issue.element}
                        </code>
                      </p>

                      <p className="text-sm text-gray-600 mt-1">
                        <strong>WCAG Criterion:</strong> {issue.wcagCriterion}
                      </p>

                      <div className="mt-2 p-3 bg-gray-50 rounded-md">
                        <p className="text-sm text-gray-700">
                          <strong>Suggestion:</strong> {issue.suggestion}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Summary for screen readers */}
      {results && (
        <div className="sr-only" role="status" aria-live="polite">
          Accessibility audit completed. Score: {results.score}%.{" "}
          {results.errors} errors, {results.warnings} warnings found.
        </div>
      )}
    </div>
  );
};

/**
 * Accessibility Checker Button
 *
 * Floating button to trigger accessibility audits in development
 */
export const AccessibilityCheckerButton: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  // Only show in development
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-50 w-12 h-12 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
        aria-label="Open accessibility checker"
        title="Accessibility Audit (Dev Only)"
      >
        <svg
          className="w-6 h-6 mx-auto"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>

      {isVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Accessibility Audit
              </h2>
              <button
                onClick={() => setIsVisible(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
                aria-label="Close accessibility checker"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <AccessibilityAudit autoRun={true} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
