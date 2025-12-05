/**
 * Compliance Stamp Component
 * 
 * Displays compliance status and Manifesto alignment for generated reports.
 * Shows passed/failed rules, evidence, and confidence tags.
 */

import React, { useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Shield, FileText, ChevronDown, ChevronUp } from 'lucide-react';

export interface ComplianceRule {
  id: string;
  name: string;
  category: string;
  status: 'passed' | 'failed' | 'warning';
  description: string;
  evidence?: string[];
  confidence?: 'high' | 'medium' | 'low';
  details?: string;
}

export interface ComplianceMetadata {
  reportId: string;
  reportType: string;
  generatedAt: string;
  generatedBy: string;
  manifestoVersion: string;
  overallStatus: 'compliant' | 'non-compliant' | 'partial';
  rules: ComplianceRule[];
  evidenceCount: number;
  confidenceScore: number;
}

interface ComplianceStampProps {
  metadata: ComplianceMetadata;
  showDetails?: boolean;
  compact?: boolean;
}

export const ComplianceStamp: React.FC<ComplianceStampProps> = ({
  metadata,
  showDetails = false,
  compact = false,
}) => {
  const [expanded, setExpanded] = useState(showDetails);

  const passedRules = metadata.rules.filter((r) => r.status === 'passed').length;
  const failedRules = metadata.rules.filter((r) => r.status === 'failed').length;
  const warningRules = metadata.rules.filter((r) => r.status === 'warning').length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'non-compliant':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'compliant':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'non-compliant':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'partial':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      default:
        return <Shield className="w-5 h-5 text-gray-600" />;
    }
  };

  const getRuleIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  const getConfidenceBadge = (confidence?: string) => {
    if (!confidence) return null;

    const colors = {
      high: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-red-100 text-red-800',
    };

    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded ${colors[confidence as keyof typeof colors]}`}>
        {confidence.toUpperCase()} CONFIDENCE
      </span>
    );
  };

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${getStatusColor(metadata.overallStatus)}`}>
        {getStatusIcon(metadata.overallStatus)}
        <span className="text-sm font-medium">
          {metadata.overallStatus === 'compliant' && 'Manifesto Compliant'}
          {metadata.overallStatus === 'non-compliant' && 'Non-Compliant'}
          {metadata.overallStatus === 'partial' && 'Partially Compliant'}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Header */}
      <div className={`p-4 border-b ${getStatusColor(metadata.overallStatus)}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(metadata.overallStatus)}
            <div>
              <h3 className="font-semibold text-lg">
                {metadata.overallStatus === 'compliant' && 'Manifesto Compliant'}
                {metadata.overallStatus === 'non-compliant' && 'Non-Compliant'}
                {metadata.overallStatus === 'partial' && 'Partially Compliant'}
              </h3>
              <p className="text-sm opacity-90">
                {passedRules} passed, {failedRules} failed, {warningRules} warnings
              </p>
            </div>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
          >
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="p-4 bg-gray-50 border-b grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <div className="text-xs text-gray-500 uppercase">Report Type</div>
          <div className="text-sm font-medium text-gray-900">{metadata.reportType}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase">Generated</div>
          <div className="text-sm font-medium text-gray-900">
            {new Date(metadata.generatedAt).toLocaleDateString()}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase">Evidence</div>
          <div className="text-sm font-medium text-gray-900">{metadata.evidenceCount} items</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase">Confidence</div>
          <div className="text-sm font-medium text-gray-900">{Math.round(metadata.confidenceScore * 100)}%</div>
        </div>
      </div>

      {/* Detailed Rules */}
      {expanded && (
        <div className="p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Compliance Rules</h4>
          <div className="space-y-3">
            {metadata.rules.map((rule) => (
              <div
                key={rule.id}
                className="border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start gap-3">
                  {getRuleIcon(rule.status)}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h5 className="font-medium text-gray-900">{rule.name}</h5>
                      {getConfidenceBadge(rule.confidence)}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{rule.description}</p>

                    {rule.details && (
                      <p className="text-xs text-gray-500 mb-2">{rule.details}</p>
                    )}

                    {rule.evidence && rule.evidence.length > 0 && (
                      <div className="mt-2">
                        <div className="text-xs font-medium text-gray-700 mb-1">Evidence:</div>
                        <ul className="space-y-1">
                          {rule.evidence.map((evidence, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-xs text-gray-600">
                              <FileText className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              <span>{evidence}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-2 text-xs text-gray-500">
                      Category: {rule.category}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-3 bg-gray-50 border-t text-xs text-gray-500 flex items-center justify-between">
        <div>
          Manifesto Version: {metadata.manifestoVersion}
        </div>
        <div>
          Generated by: {metadata.generatedBy}
        </div>
      </div>
    </div>
  );
};

/**
 * Compact Compliance Badge
 * 
 * Minimal badge for inline display
 */
interface ComplianceBadgeProps {
  status: 'compliant' | 'non-compliant' | 'partial';
  onClick?: () => void;
}

export const ComplianceBadge: React.FC<ComplianceBadgeProps> = ({ status, onClick }) => {
  const getConfig = () => {
    switch (status) {
      case 'compliant':
        return {
          icon: <CheckCircle className="w-4 h-4" />,
          text: 'Compliant',
          className: 'bg-green-100 text-green-800 border-green-300',
        };
      case 'non-compliant':
        return {
          icon: <XCircle className="w-4 h-4" />,
          text: 'Non-Compliant',
          className: 'bg-red-100 text-red-800 border-red-300',
        };
      case 'partial':
        return {
          icon: <AlertTriangle className="w-4 h-4" />,
          text: 'Partial',
          className: 'bg-yellow-100 text-yellow-800 border-yellow-300',
        };
    }
  };

  const config = getConfig();

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded border ${config.className} hover:opacity-80 transition-opacity`}
      >
        {config.icon}
        <span>{config.text}</span>
      </button>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded border ${config.className}`}>
      {config.icon}
      <span>{config.text}</span>
    </div>
  );
};
