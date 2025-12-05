/**
 * AgentResponseCard Component
 * 
 * Displays agent outputs with reasoning transparency.
 * Shows agent name, avatar, reasoning chain, confidence score, and actions.
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Check, X, Edit, Clock, Brain } from 'lucide-react';
import { ConfidenceIndicator } from './ConfidenceIndicator';

export interface ReasoningStep {
  id: string;
  step: number;
  description: string;
  confidence?: number;
  evidence?: string[];
}

export interface AgentResponse {
  id: string;
  agentId: string;
  agentName: string;
  agentAvatar?: string;
  timestamp: string;
  content: string;
  reasoning?: ReasoningStep[];
  confidence?: number;
  status?: 'pending' | 'approved' | 'rejected' | 'modified';
  metadata?: Record<string, any>;
}

export interface AgentResponseCardProps {
  response: AgentResponse;
  showReasoning?: boolean;
  showActions?: boolean;
  onApprove?: (response: AgentResponse) => void;
  onReject?: (response: AgentResponse) => void;
  onModify?: (response: AgentResponse) => void;
  className?: string;
}

/**
 * AgentResponseCard Component
 */
export const AgentResponseCard: React.FC<AgentResponseCardProps> = ({
  response,
  showReasoning = true,
  showActions = true,
  onApprove,
  onReject,
  onModify,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  const toggleStep = (stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const statusColors = {
    pending: '#FFB800',
    approved: '#39FF14',
    rejected: '#FF3B30',
    modified: '#0A84FF',
  };

  const statusLabels = {
    pending: 'Pending Review',
    approved: 'Approved',
    rejected: 'Rejected',
    modified: 'Modified',
  };

  return (
    <div className={`sdui-agent-response-card ${className}`}>
      {/* Header */}
      <div className="sdui-agent-response-header">
        <div className="sdui-agent-response-agent">
          {response.agentAvatar ? (
            <img
              src={response.agentAvatar}
              alt={response.agentName}
              className="sdui-agent-response-avatar"
            />
          ) : (
            <div className="sdui-agent-response-avatar-placeholder">
              <Brain size={20} />
            </div>
          )}
          <div className="sdui-agent-response-agent-info">
            <div className="sdui-agent-response-agent-name">{response.agentName}</div>
            <div className="sdui-agent-response-timestamp">
              <Clock size={12} />
              {formatTimestamp(response.timestamp)}
            </div>
          </div>
        </div>

        <div className="sdui-agent-response-meta">
          {response.confidence !== undefined && (
            <ConfidenceIndicator
              value={response.confidence}
              size="sm"
              variant="badge"
              showPercentage
            />
          )}
          {response.status && (
            <div
              className="sdui-agent-response-status"
              style={{
                backgroundColor: `${statusColors[response.status]}20`,
                color: statusColors[response.status],
                borderColor: statusColors[response.status],
              }}
            >
              {statusLabels[response.status]}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="sdui-agent-response-content">
        {response.content}
      </div>

      {/* Reasoning */}
      {showReasoning && response.reasoning && response.reasoning.length > 0 && (
        <div className="sdui-agent-response-reasoning">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="sdui-agent-response-reasoning-toggle"
          >
            <Brain size={16} />
            <span>Reasoning Chain ({response.reasoning.length} steps)</span>
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {isExpanded && (
            <div className="sdui-agent-response-reasoning-steps">
              {response.reasoning.map((step) => {
                const isStepExpanded = expandedSteps.has(step.id);
                return (
                  <div key={step.id} className="sdui-agent-response-reasoning-step">
                    <div className="sdui-agent-response-reasoning-step-header">
                      <div className="sdui-agent-response-reasoning-step-number">
                        {step.step}
                      </div>
                      <div className="sdui-agent-response-reasoning-step-content">
                        <div className="sdui-agent-response-reasoning-step-description">
                          {step.description}
                        </div>
                        {step.confidence !== undefined && (
                          <ConfidenceIndicator
                            value={step.confidence}
                            size="sm"
                            variant="bar"
                            showPercentage={false}
                          />
                        )}
                      </div>
                      {step.evidence && step.evidence.length > 0 && (
                        <button
                          onClick={() => toggleStep(step.id)}
                          className="sdui-agent-response-reasoning-step-toggle"
                        >
                          {isStepExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      )}
                    </div>

                    {isStepExpanded && step.evidence && (
                      <div className="sdui-agent-response-reasoning-step-evidence">
                        <div className="sdui-agent-response-reasoning-step-evidence-label">
                          Evidence:
                        </div>
                        <ul className="sdui-agent-response-reasoning-step-evidence-list">
                          {step.evidence.map((item, index) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {showActions && (
        <div className="sdui-agent-response-actions">
          {onApprove && (
            <button
              onClick={() => onApprove(response)}
              className="sdui-agent-response-action-btn sdui-agent-response-action-approve"
              disabled={response.status === 'approved'}
            >
              <Check size={16} />
              Approve
            </button>
          )}
          {onReject && (
            <button
              onClick={() => onReject(response)}
              className="sdui-agent-response-action-btn sdui-agent-response-action-reject"
              disabled={response.status === 'rejected'}
            >
              <X size={16} />
              Reject
            </button>
          )}
          {onModify && (
            <button
              onClick={() => onModify(response)}
              className="sdui-agent-response-action-btn sdui-agent-response-action-modify"
            >
              <Edit size={16} />
              Modify
            </button>
          )}
        </div>
      )}

      <style jsx>{`
        .sdui-agent-response-card {
          background-color: #333333;
          border: 1px solid #444444;
          border-radius: 8px;
          padding: 16px;
          transition: all 200ms;
        }

        .sdui-agent-response-card:hover {
          border-color: #555555;
        }

        .sdui-agent-response-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 16px;
          gap: 16px;
        }

        .sdui-agent-response-agent {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .sdui-agent-response-avatar,
        .sdui-agent-response-avatar-placeholder {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          object-fit: cover;
        }

        .sdui-agent-response-avatar-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #39FF14, #0A3A0A);
          color: #121212;
        }

        .sdui-agent-response-agent-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .sdui-agent-response-agent-name {
          color: #FFFFFF;
          font-size: 14px;
          font-weight: 600;
        }

        .sdui-agent-response-timestamp {
          display: flex;
          align-items: center;
          gap: 4px;
          color: #808080;
          font-size: 12px;
        }

        .sdui-agent-response-meta {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sdui-agent-response-status {
          padding: 4px 12px;
          border: 1px solid;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }

        .sdui-agent-response-content {
          color: #FFFFFF;
          font-size: 14px;
          line-height: 1.6;
          margin-bottom: 16px;
        }

        .sdui-agent-response-reasoning {
          margin-bottom: 16px;
        }

        .sdui-agent-response-reasoning-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 12px;
          background-color: rgba(57, 255, 20, 0.05);
          border: 1px solid rgba(57, 255, 20, 0.2);
          border-radius: 6px;
          color: #39FF14;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 150ms;
        }

        .sdui-agent-response-reasoning-toggle:hover {
          background-color: rgba(57, 255, 20, 0.1);
        }

        .sdui-agent-response-reasoning-steps {
          margin-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .sdui-agent-response-reasoning-step {
          background-color: #1A1A1A;
          border: 1px solid #444444;
          border-radius: 6px;
          padding: 12px;
        }

        .sdui-agent-response-reasoning-step-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .sdui-agent-response-reasoning-step-number {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          background-color: #39FF14;
          color: #121212;
          border-radius: 50%;
          font-size: 12px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .sdui-agent-response-reasoning-step-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .sdui-agent-response-reasoning-step-description {
          color: #FFFFFF;
          font-size: 13px;
          line-height: 1.5;
        }

        .sdui-agent-response-reasoning-step-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          background-color: transparent;
          border: none;
          border-radius: 4px;
          color: #B3B3B3;
          cursor: pointer;
          transition: all 150ms;
          flex-shrink: 0;
        }

        .sdui-agent-response-reasoning-step-toggle:hover {
          background-color: #333333;
          color: #39FF14;
        }

        .sdui-agent-response-reasoning-step-evidence {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #444444;
        }

        .sdui-agent-response-reasoning-step-evidence-label {
          color: #B3B3B3;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }

        .sdui-agent-response-reasoning-step-evidence-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .sdui-agent-response-reasoning-step-evidence-list li {
          color: #B3B3B3;
          font-size: 12px;
          line-height: 1.5;
          padding-left: 16px;
          position: relative;
        }

        .sdui-agent-response-reasoning-step-evidence-list li::before {
          content: '•';
          position: absolute;
          left: 0;
          color: #39FF14;
        }

        .sdui-agent-response-actions {
          display: flex;
          gap: 8px;
          padding-top: 16px;
          border-top: 1px solid #444444;
        }

        .sdui-agent-response-action-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border: 1px solid;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 150ms;
        }

        .sdui-agent-response-action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .sdui-agent-response-action-approve {
          background-color: transparent;
          border-color: #39FF14;
          color: #39FF14;
        }

        .sdui-agent-response-action-approve:hover:not(:disabled) {
          background-color: rgba(57, 255, 20, 0.1);
        }

        .sdui-agent-response-action-reject {
          background-color: transparent;
          border-color: #FF3B30;
          color: #FF3B30;
        }

        .sdui-agent-response-action-reject:hover:not(:disabled) {
          background-color: rgba(255, 59, 48, 0.1);
        }

        .sdui-agent-response-action-modify {
          background-color: transparent;
          border-color: #0A84FF;
          color: #0A84FF;
        }

        .sdui-agent-response-action-modify:hover:not(:disabled) {
          background-color: rgba(10, 132, 255, 0.1);
        }
      `}</style>
    </div>
  );
};

export default AgentResponseCard;
