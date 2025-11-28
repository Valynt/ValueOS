/**
 * AI Transparency Components
 * 
 * Components for displaying AI confidence, reasoning, and transparency
 * following the agentic UI patterns from the design spec.
 */

import React, { useState } from 'react';
import { 
  Brain, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  CheckCircle2,
  Info,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  RefreshCw
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface AIConfidence {
  level: number; // 0-1
  label: 'high' | 'medium' | 'low';
  factors?: string[];
}

export interface AIReasoning {
  thought: string;
  action: string;
  observation?: string;
  sources?: string[];
}

export interface AITransparencyData {
  confidence: AIConfidence;
  reasoning?: AIReasoning[];
  agentName: string;
  timestamp: Date;
  humanOverrideAvailable: boolean;
}

// ============================================================================
// Confidence Indicator
// ============================================================================

interface ConfidenceIndicatorProps {
  confidence: AIConfidence;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
  confidence,
  showLabel = true,
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'w-16 h-1.5',
    md: 'w-24 h-2',
    lg: 'w-32 h-2.5',
  };

  const colorClasses = {
    high: 'bg-green-500',
    medium: 'bg-amber-500',
    low: 'bg-red-500',
  };

  const labelClasses = {
    high: 'text-green-700',
    medium: 'text-amber-700',
    low: 'text-red-700',
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`${sizeClasses[size]} bg-gray-200 rounded-full overflow-hidden`}>
        <div
          className={`h-full ${colorClasses[confidence.label]} transition-all duration-300`}
          style={{ width: `${confidence.level * 100}%` }}
        />
      </div>
      {showLabel && (
        <span className={`text-xs font-medium ${labelClasses[confidence.label]} capitalize`}>
          {confidence.label} ({Math.round(confidence.level * 100)}%)
        </span>
      )}
    </div>
  );
};

// ============================================================================
// AI Insight Badge
// ============================================================================

interface AIInsightBadgeProps {
  confidence: AIConfidence;
  agentName: string;
  onClick?: () => void;
}

export const AIInsightBadge: React.FC<AIInsightBadgeProps> = ({
  confidence,
  agentName,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 rounded-full text-xs font-medium text-indigo-700 transition-colors"
    >
      <Sparkles className="w-3 h-3" />
      <span>{agentName}</span>
      <span className="w-1 h-1 rounded-full bg-indigo-400" />
      <span className="capitalize">{confidence.label}</span>
    </button>
  );
};

// ============================================================================
// Reasoning Drawer
// ============================================================================

interface ReasoningDrawerProps {
  reasoning: AIReasoning[];
  isOpen: boolean;
  onClose: () => void;
}

export const ReasoningDrawer: React.FC<ReasoningDrawerProps> = ({
  reasoning,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-indigo-600" />
          <h3 className="font-semibold text-gray-900">AI Reasoning</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
        >
          <ChevronDown className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {reasoning.map((step, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-medium">
                {index + 1}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">Thought</p>
                <p className="text-sm text-gray-600">{step.thought}</p>
              </div>
            </div>
            <div className="ml-8 pl-3 border-l-2 border-indigo-200 space-y-2">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Action</p>
                <p className="text-sm text-gray-700">{step.action}</p>
              </div>
              {step.observation && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Observation</p>
                  <p className="text-sm text-gray-700">{step.observation}</p>
                </div>
              )}
              {step.sources && step.sources.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Sources</p>
                  <ul className="text-sm text-indigo-600 space-y-1">
                    {step.sources.map((source, i) => (
                      <li key={i} className="hover:underline cursor-pointer">{source}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// AI Recommendation Card
// ============================================================================

interface AIRecommendationCardProps {
  title: string;
  description: string;
  confidence: AIConfidence;
  agentName: string;
  onAccept?: () => void;
  onModify?: () => void;
  onDismiss?: () => void;
  onExplain?: () => void;
}

export const AIRecommendationCard: React.FC<AIRecommendationCardProps> = ({
  title,
  description,
  confidence,
  agentName,
  onAccept,
  onModify,
  onDismiss,
  onExplain,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-medium text-indigo-700">{agentName}</span>
          </div>
          <ConfidenceIndicator confidence={confidence} size="sm" />
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h4 className="font-semibold text-gray-900 mb-1">{title}</h4>
        <p className="text-sm text-gray-600 mb-4">{description}</p>

        {/* Confidence Factors */}
        {confidence.factors && confidence.factors.length > 0 && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-3"
          >
            <Info className="w-3 h-3" />
            <span>Why this confidence?</span>
            {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}

        {showDetails && confidence.factors && (
          <ul className="mb-4 space-y-1 text-xs text-gray-600 bg-gray-50 p-2 rounded">
            {confidence.factors.map((factor, i) => (
              <li key={i} className="flex items-start gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                <span>{factor}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {onAccept && (
            <button
              onClick={onAccept}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <ThumbsUp className="w-4 h-4" />
              Accept
            </button>
          )}
          {onModify && (
            <button
              onClick={onModify}
              className="flex items-center justify-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Modify
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="flex items-center justify-center gap-1 px-3 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 text-sm rounded-lg transition-colors"
            >
              <ThumbsDown className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Explain Button */}
      {onExplain && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
          <button
            onClick={onExplain}
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
          >
            <Brain className="w-3 h-3" />
            <span>Explain this recommendation</span>
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Human Override Panel
// ============================================================================

interface HumanOverridePanelProps {
  aiValue: string;
  onOverride: (newValue: string) => void;
  onAcceptAI: () => void;
  label?: string;
}

export const HumanOverridePanel: React.FC<HumanOverridePanelProps> = ({
  aiValue,
  onOverride,
  onAcceptAI,
  label = 'AI Suggestion',
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedValue, setEditedValue] = useState(aiValue);

  const handleSave = () => {
    onOverride(editedValue);
    setIsEditing(false);
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle className="w-4 h-4 text-amber-600" />
        <span className="text-sm font-medium text-amber-800">{label}</span>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={editedValue}
            onChange={(e) => setEditedValue(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            rows={3}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
            >
              Save Override
            </button>
            <button
              onClick={() => {
                setEditedValue(aiValue);
                setIsEditing(false);
              }}
              className="px-3 py-1.5 text-gray-600 text-sm hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-gray-700">{aiValue}</p>
          <div className="flex gap-2">
            <button
              onClick={onAcceptAI}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
            >
              <CheckCircle2 className="w-4 h-4" />
              Accept
            </button>
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 text-indigo-600 text-sm hover:bg-indigo-50 rounded-lg"
            >
              Override
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default {
  ConfidenceIndicator,
  AIInsightBadge,
  ReasoningDrawer,
  AIRecommendationCard,
  HumanOverridePanel,
};
