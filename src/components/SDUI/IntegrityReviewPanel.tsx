import React, { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Shield,
} from 'lucide-react';

/**
 * Severity level for rule violations
 */
export type RuleSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Single rule validation result
 */
export interface RuleResult {
  /**
   * Rule identifier
   */
  rule: string;

  /**
   * Rule description
   */
  description?: string;

  /**
   * Whether the rule passed
   */
  passed: boolean;

  /**
   * Optional message explaining the result
   */
  message?: string;

  /**
   * Severity level (for failures)
   */
  severity?: RuleSeverity;

  /**
   * Suggested remediation
   */
  remediation?: string;

  /**
   * Related manifesto principle
   */
  principle?: string;
}

/**
 * Props for IntegrityReviewPanel component
 */
export interface IntegrityReviewPanelProps {
  /**
   * Array of rule validation results
   */
  results: RuleResult[];

  /**
   * Panel title
   */
  title?: string;

  /**
   * Show detailed information
   * @default false
   */
  showDetails?: boolean;

  /**
   * Show remediation suggestions
   * @default true
   */
  showRemediation?: boolean;

  /**
   * Group results by status
   * @default true
   */
  groupByStatus?: boolean;

  /**
   * Callback when a rule is clicked
   */
  onRuleClick?: (rule: string) => void;

  /**
   * Show summary statistics
   * @default true
   */
  showSummary?: boolean;
}

/**
 * Get severity color classes
 */
const getSeverityClasses = (severity?: RuleSeverity) => {
  switch (severity) {
    case 'critical':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'high':
      return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'low':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'info':
      return 'bg-gray-100 text-gray-800 border-gray-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

/**
 * Get severity icon
 */
const getSeverityIcon = (severity?: RuleSeverity) => {
  switch (severity) {
    case 'critical':
    case 'high':
      return <XCircle className="h-5 w-5" />;
    case 'medium':
      return <AlertTriangle className="h-5 w-5" />;
    case 'low':
    case 'info':
      return <Info className="h-5 w-5" />;
    default:
      return <Info className="h-5 w-5" />;
  }
};

/**
 * Single Rule Result Component
 */
const RuleResultItem: React.FC<{
  result: RuleResult;
  showDetails: boolean;
  showRemediation: boolean;
  onClick?: () => void;
}> = ({ result, showDetails, showRemediation, onClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasDetails = result.description || result.message || result.remediation;

  return (
    <div
      className={`
        p-4 rounded-lg border transition-all
        ${
          result.passed
            ? 'bg-green-50 border-green-300'
            : getSeverityClasses(result.severity)
        }
        ${onClick ? 'cursor-pointer hover:shadow-md' : ''}
      `}
      onClick={onClick}
      data-testid="rule-result-item"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          {/* Icon */}
          <div className="flex-shrink-0 mt-0.5">
            {result.passed ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              getSeverityIcon(result.severity)
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-gray-900">{result.rule}</h4>
              {result.severity && !result.passed && (
                <span className="px-2 py-0.5 text-xs font-medium uppercase rounded-full bg-white border">
                  {result.severity}
                </span>
              )}
              {result.principle && (
                <span className="px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">
                  {result.principle}
                </span>
              )}
            </div>

            {/* Status */}
            <p className={`text-sm mt-1 ${result.passed ? 'text-green-700' : 'text-current'}`}>
              {result.passed ? 'Passed' : 'Failed'}
              {result.message && ` - ${result.message}`}
            </p>

            {/* Description (if expanded) */}
            {isExpanded && result.description && (
              <p className="text-sm text-gray-600 mt-2 italic">{result.description}</p>
            )}

            {/* Remediation (if expanded and available) */}
            {isExpanded && showRemediation && result.remediation && !result.passed && (
              <div className="mt-3 p-3 bg-white rounded-md border border-current">
                <p className="text-xs font-semibold text-gray-700 mb-1">
                  Suggested Remediation:
                </p>
                <p className="text-sm text-gray-600">{result.remediation}</p>
              </div>
            )}
          </div>
        </div>

        {/* Expand/Collapse Button */}
        {hasDetails && showDetails && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="flex-shrink-0 p-1 hover:bg-white rounded transition-colors"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-gray-600" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-600" />
            )}
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * IntegrityReviewPanel - Displays manifesto rule validation results
 *
 * Used in the Integrity stage to show compliance with VOS manifesto
 * principles and identify areas requiring attention.
 *
 * @example
 * ```tsx
 * <IntegrityReviewPanel
 *   results={[
 *     {
 *       rule: 'Value is defined by outcomes',
 *       passed: true,
 *       principle: 'Manifesto Rule #1'
 *     },
 *     {
 *       rule: 'Conservative quantification',
 *       passed: false,
 *       severity: 'high',
 *       message: 'ROI assumptions too aggressive',
 *       remediation: 'Reduce growth assumptions by 20%'
 *     }
 *   ]}
 * />
 * ```
 */
export const IntegrityReviewPanel: React.FC<IntegrityReviewPanelProps> = ({
  results,
  title = 'Integrity Review',
  showDetails = false,
  showRemediation = true,
  groupByStatus = true,
  onRuleClick,
  showSummary = true,
}) => {
  // Calculate statistics
  const totalRules = results.length;
  const passedRules = results.filter((r) => r.passed).length;
  const failedRules = totalRules - passedRules;
  const criticalFailures = results.filter(
    (r) => !r.passed && r.severity === 'critical'
  ).length;
  const highFailures = results.filter((r) => !r.passed && r.severity === 'high').length;
  const complianceRate = totalRules > 0 ? (passedRules / totalRules) * 100 : 0;

  // Group results
  const passedResults = results.filter((r) => r.passed);
  const failedResults = results.filter((r) => !r.passed);

  // Sort failed results by severity
  const sortedFailedResults = [...failedResults].sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    const aSeverity = severityOrder[a.severity || 'info'];
    const bSeverity = severityOrder[b.severity || 'info'];
    return aSeverity - bSeverity;
  });

  return (
    <div className="space-y-6" data-testid="integrity-review-panel">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
          <Shield className="h-6 w-6 text-red-700" />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manifesto compliance validation results
          </p>
        </div>
      </div>

      {/* Summary Statistics */}
      {showSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-600 font-medium">Total Rules</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{totalRules}</p>
          </div>
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700 font-medium">Passed</p>
            <p className="text-3xl font-bold text-green-900 mt-1">{passedRules}</p>
          </div>
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700 font-medium">Failed</p>
            <p className="text-3xl font-bold text-red-900 mt-1">{failedRules}</p>
          </div>
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700 font-medium">Compliance</p>
            <p className="text-3xl font-bold text-blue-900 mt-1">
              {complianceRate.toFixed(0)}%
            </p>
          </div>
        </div>
      )}

      {/* Compliance Progress Bar */}
      <div className="p-4 bg-white border border-gray-200 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-semibold text-gray-700">Compliance Rate</h3>
          <span className="text-lg font-bold text-gray-900">
            {complianceRate.toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${
              complianceRate >= 90
                ? 'bg-green-500'
                : complianceRate >= 70
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${complianceRate}%` }}
          />
        </div>
      </div>

      {/* Critical Alerts */}
      {(criticalFailures > 0 || highFailures > 0) && (
        <div className="p-4 bg-red-50 border border-red-300 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">Action Required</p>
              <p className="text-sm text-red-800 mt-1">
                {criticalFailures > 0 && (
                  <span>
                    {criticalFailures} critical violation{criticalFailures !== 1 ? 's' : ''}
                  </span>
                )}
                {criticalFailures > 0 && highFailures > 0 && <span> and </span>}
                {highFailures > 0 && (
                  <span>
                    {highFailures} high-severity issue{highFailures !== 1 ? 's' : ''}
                  </span>
                )}{' '}
                must be addressed before proceeding.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Results List */}
      {groupByStatus ? (
        <div className="space-y-6">
          {/* Failed Rules */}
          {sortedFailedResults.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900">
                Failed Rules ({failedRules})
              </h3>
              <div className="space-y-2">
                {sortedFailedResults.map((result, index) => (
                  <RuleResultItem
                    key={`failed-${index}`}
                    result={result}
                    showDetails={showDetails}
                    showRemediation={showRemediation}
                    onClick={onRuleClick ? () => onRuleClick(result.rule) : undefined}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Passed Rules */}
          {passedResults.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900">
                Passed Rules ({passedRules})
              </h3>
              <div className="space-y-2">
                {passedResults.map((result, index) => (
                  <RuleResultItem
                    key={`passed-${index}`}
                    result={result}
                    showDetails={showDetails}
                    showRemediation={showRemediation}
                    onClick={onRuleClick ? () => onRuleClick(result.rule) : undefined}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((result, index) => (
            <RuleResultItem
              key={index}
              result={result}
              showDetails={showDetails}
              showRemediation={showRemediation}
              onClick={onRuleClick ? () => onRuleClick(result.rule) : undefined}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {results.length === 0 && (
        <div className="p-8 text-center bg-gray-50 border border-gray-200 rounded-lg">
          <Shield className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No integrity rules to review</p>
        </div>
      )}
    </div>
  );
};
