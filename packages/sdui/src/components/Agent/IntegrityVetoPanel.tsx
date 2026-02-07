import React, { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, Eye, EyeOff } from "lucide-react";
import { ConfidenceDisplay } from "./ConfidenceDisplay";

export interface IntegrityIssue {
  id: string;
  agentId: string;
  sessionId: string;
  issueType: "low_confidence" | "hallucination" | "data_integrity" | "logic_error";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  originalOutput: any;
  suggestedFix?: any;
  confidence: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface IntegrityVetoPanelProps {
  issues: IntegrityIssue[];
  onResolve: (
    issueId: string,
    resolution: "accept" | "reject" | "modify",
    modifiedOutput?: any
  ) => void;
  onDismiss: (issueId: string) => void;
  className?: string;
}

export const IntegrityVetoPanel: React.FC<IntegrityVetoPanelProps> = ({
  issues,
  onResolve,
  onDismiss,
  className = "",
}) => {
  const [selectedIssue, setSelectedIssue] = useState<IntegrityIssue | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "border-red-500 bg-red-50";
      case "high":
        return "border-orange-500 bg-orange-50";
      case "medium":
        return "border-yellow-500 bg-yellow-50";
      case "low":
        return "border-blue-500 bg-blue-50";
      default:
        return "border-gray-500 bg-gray-50";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
      case "high":
        return <XCircle className="w-5 h-5 text-red-600" />;
      case "medium":
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case "low":
        return <CheckCircle className="w-5 h-5 text-blue-600" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-gray-600" />;
    }
  };

  const getIssueTypeLabel = (type: string) => {
    switch (type) {
      case "low_confidence":
        return "Low Confidence";
      case "hallucination":
        return "Potential Hallucination";
      case "data_integrity":
        return "Data Integrity Issue";
      case "logic_error":
        return "Logic Error";
      default:
        return "Integrity Issue";
    }
  };

  if (issues.length === 0) {
    return null;
  }

  return (
    <div className={`bg-card border border-border rounded-lg p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-orange-600" />
        <h3 className="text-lg font-semibold">Integrity Veto Panel</h3>
        <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-medium">
          {issues.length} issue{issues.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-3">
        {issues.map((issue) => (
          <div
            key={issue.id}
            className={`border-2 rounded-lg p-3 cursor-pointer transition-all hover:shadow-md ${getSeverityColor(issue.severity)}`}
            onClick={() => setSelectedIssue(issue)}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                {getSeverityIcon(issue.severity)}
                <span className="font-medium">{getIssueTypeLabel(issue.issueType)}</span>
                <ConfidenceDisplay data={{ score: issue.confidence }} size="sm" showLabel={false} />
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(issue.timestamp).toLocaleTimeString()}
              </span>
            </div>

            <p className="text-sm text-muted-foreground mb-2">{issue.description}</p>

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onResolve(issue.id, "accept");
                }}
                className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
              >
                Accept
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onResolve(issue.id, "reject");
                }}
                className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors"
              >
                Reject
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedIssue(issue);
                  setShowDetails(true);
                }}
                className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
              >
                Compare & Resolve
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss(issue.id);
                }}
                className="px-3 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Compare & Resolve Modal */}
      {selectedIssue && showDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Compare & Resolve</h2>
                <p className="text-sm text-muted-foreground">
                  {getIssueTypeLabel(selectedIssue.issueType)} - {selectedIssue.description}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedIssue(null);
                  setShowDetails(false);
                }}
                className="p-2 hover:bg-secondary rounded"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Original Output */}
                <div className="space-y-2">
                  <h3 className="font-medium text-red-600 flex items-center gap-2">
                    <EyeOff className="w-4 h-4" />
                    Original Output (Flagged)
                  </h3>
                  <div className="bg-red-50 border border-red-200 rounded p-3">
                    <pre className="text-sm whitespace-pre-wrap">
                      {JSON.stringify(selectedIssue.originalOutput, null, 2)}
                    </pre>
                  </div>
                  <ConfidenceDisplay data={{ score: selectedIssue.confidence }} size="sm" />
                </div>

                {/* Suggested Fix */}
                <div className="space-y-2">
                  <h3 className="font-medium text-green-600 flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    Suggested Fix
                  </h3>
                  <div className="bg-green-50 border border-green-200 rounded p-3">
                    {selectedIssue.suggestedFix ? (
                      <pre className="text-sm whitespace-pre-wrap">
                        {JSON.stringify(selectedIssue.suggestedFix, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-sm text-muted-foreground">No suggestion available</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Metadata */}
              {selectedIssue.metadata && (
                <div className="mt-4">
                  <h3 className="font-medium mb-2">Additional Details</h3>
                  <div className="bg-secondary/50 rounded p-3">
                    <pre className="text-xs whitespace-pre-wrap">
                      {JSON.stringify(selectedIssue.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border flex justify-end gap-2">
              <button
                onClick={() => {
                  onResolve(selectedIssue.id, "reject");
                  setSelectedIssue(null);
                  setShowDetails(false);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Reject Original
              </button>
              <button
                onClick={() => {
                  onResolve(selectedIssue.id, "accept");
                  setSelectedIssue(null);
                  setShowDetails(false);
                }}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                Accept Original
              </button>
              {selectedIssue.suggestedFix && (
                <button
                  onClick={() => {
                    onResolve(selectedIssue.id, "modify", selectedIssue.suggestedFix);
                    setSelectedIssue(null);
                    setShowDetails(false);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Use Suggested Fix
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntegrityVetoPanel;
