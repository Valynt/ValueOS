/**
 * AgentWorkflowPanel Component
 * 
 * Shows active agents, collaboration status, and communication log.
 * Supports real-time updates for agent workflow orchestration.
 */

import React, { useState } from 'react';
import { Brain, MessageSquare, Activity, Clock, CheckCircle, AlertCircle, Loader } from 'lucide-react';

export interface AgentStatus {
  id: string;
  name: string;
  avatar?: string;
  status: 'idle' | 'active' | 'waiting' | 'completed' | 'error';
  currentTask?: string;
  progress?: number;
  lastUpdate: string;
}

export interface AgentMessage {
  id: string;
  fromAgentId: string;
  fromAgentName: string;
  toAgentId?: string;
  toAgentName?: string;
  message: string;
  timestamp: string;
  type: 'info' | 'request' | 'response' | 'error';
}

export interface AgentWorkflowPanelProps {
  agents: AgentStatus[];
  messages?: AgentMessage[];
  showMessages?: boolean;
  showProgress?: boolean;
  onAgentClick?: (agent: AgentStatus) => void;
  className?: string;
}

/**
 * AgentWorkflowPanel Component
 */
export const AgentWorkflowPanel: React.FC<AgentWorkflowPanelProps> = ({
  agents,
  messages = [],
  showMessages = true,
  showProgress = true,
  onAgentClick,
  className = '',
}) => {
  const [selectedTab, setSelectedTab] = useState<'agents' | 'messages'>('agents');

  const statusConfig = {
    idle: {
      icon: Clock,
      color: '#808080',
      label: 'Idle',
    },
    active: {
      icon: Activity,
      color: '#39FF14',
      label: 'Active',
    },
    waiting: {
      icon: Loader,
      color: '#FFB800',
      label: 'Waiting',
    },
    completed: {
      icon: CheckCircle,
      color: '#39FF14',
      label: 'Completed',
    },
    error: {
      icon: AlertCircle,
      color: '#FF3B30',
      label: 'Error',
    },
  };

  const messageTypeConfig = {
    info: {
      color: '#0A84FF',
      label: 'Info',
    },
    request: {
      color: '#FFB800',
      label: 'Request',
    },
    response: {
      color: '#39FF14',
      label: 'Response',
    },
    error: {
      color: '#FF3B30',
      label: 'Error',
    },
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const activeAgents = agents.filter((a) => a.status === 'active').length;
  const completedAgents = agents.filter((a) => a.status === 'completed').length;
  const errorAgents = agents.filter((a) => a.status === 'error').length;

  return (
    <div className={`sdui-agent-workflow-panel ${className}`}>
      {/* Header */}
      <div className="sdui-agent-workflow-header">
        <div className="sdui-agent-workflow-title">
          <Brain size={20} />
          <span>Agent Workflow</span>
        </div>
        <div className="sdui-agent-workflow-stats">
          <div className="sdui-agent-workflow-stat">
            <Activity size={14} style={{ color: '#39FF14' }} />
            <span>{activeAgents} Active</span>
          </div>
          <div className="sdui-agent-workflow-stat">
            <CheckCircle size={14} style={{ color: '#39FF14' }} />
            <span>{completedAgents} Done</span>
          </div>
          {errorAgents > 0 && (
            <div className="sdui-agent-workflow-stat">
              <AlertCircle size={14} style={{ color: '#FF3B30' }} />
              <span>{errorAgents} Error</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      {showMessages && messages.length > 0 && (
        <div className="sdui-agent-workflow-tabs">
          <button
            onClick={() => setSelectedTab('agents')}
            className={`sdui-agent-workflow-tab ${
              selectedTab === 'agents' ? 'sdui-agent-workflow-tab-active' : ''
            }`}
          >
            Agents ({agents.length})
          </button>
          <button
            onClick={() => setSelectedTab('messages')}
            className={`sdui-agent-workflow-tab ${
              selectedTab === 'messages' ? 'sdui-agent-workflow-tab-active' : ''
            }`}
          >
            Messages ({messages.length})
          </button>
        </div>
      )}

      {/* Content */}
      <div className="sdui-agent-workflow-content">
        {selectedTab === 'agents' && (
          <div className="sdui-agent-workflow-agents">
            {agents.map((agent) => {
              const config = statusConfig[agent.status];
              const StatusIcon = config.icon;

              return (
                <div
                  key={agent.id}
                  className={`sdui-agent-workflow-agent ${
                    onAgentClick ? 'sdui-agent-workflow-agent-clickable' : ''
                  }`}
                  onClick={() => onAgentClick?.(agent)}
                >
                  <div className="sdui-agent-workflow-agent-header">
                    <div className="sdui-agent-workflow-agent-info">
                      {agent.avatar ? (
                        <img
                          src={agent.avatar}
                          alt={agent.name}
                          className="sdui-agent-workflow-agent-avatar"
                        />
                      ) : (
                        <div className="sdui-agent-workflow-agent-avatar-placeholder">
                          <Brain size={16} />
                        </div>
                      )}
                      <div className="sdui-agent-workflow-agent-details">
                        <div className="sdui-agent-workflow-agent-name">{agent.name}</div>
                        <div className="sdui-agent-workflow-agent-task">
                          {agent.currentTask || 'No active task'}
                        </div>
                      </div>
                    </div>

                    <div
                      className="sdui-agent-workflow-agent-status"
                      style={{
                        backgroundColor: `${config.color}20`,
                        color: config.color,
                        borderColor: config.color,
                      }}
                    >
                      <StatusIcon size={12} />
                      {config.label}
                    </div>
                  </div>

                  {showProgress && agent.progress !== undefined && (
                    <div className="sdui-agent-workflow-agent-progress">
                      <div className="sdui-agent-workflow-agent-progress-bar">
                        <div
                          className="sdui-agent-workflow-agent-progress-fill"
                          style={{
                            width: `${agent.progress}%`,
                            backgroundColor: config.color,
                          }}
                        />
                      </div>
                      <div className="sdui-agent-workflow-agent-progress-text">
                        {Math.round(agent.progress)}%
                      </div>
                    </div>
                  )}

                  <div className="sdui-agent-workflow-agent-footer">
                    <Clock size={12} />
                    <span>Updated {formatTimestamp(agent.lastUpdate)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedTab === 'messages' && (
          <div className="sdui-agent-workflow-messages">
            {messages.map((message) => {
              const config = messageTypeConfig[message.type];

              return (
                <div key={message.id} className="sdui-agent-workflow-message">
                  <div className="sdui-agent-workflow-message-header">
                    <div className="sdui-agent-workflow-message-from">
                      <MessageSquare size={14} />
                      <span className="sdui-agent-workflow-message-agent-name">
                        {message.fromAgentName}
                      </span>
                      {message.toAgentName && (
                        <>
                          <span className="sdui-agent-workflow-message-arrow">→</span>
                          <span className="sdui-agent-workflow-message-agent-name">
                            {message.toAgentName}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="sdui-agent-workflow-message-meta">
                      <div
                        className="sdui-agent-workflow-message-type"
                        style={{
                          backgroundColor: `${config.color}20`,
                          color: config.color,
                        }}
                      >
                        {config.label}
                      </div>
                      <div className="sdui-agent-workflow-message-time">
                        {formatTimestamp(message.timestamp)}
                      </div>
                    </div>
                  </div>
                  <div className="sdui-agent-workflow-message-content">
                    {message.message}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style jsx>{`
        .sdui-agent-workflow-panel {
          background-color: #1A1A1A;
          border: 1px solid #444444;
          border-radius: 8px;
          overflow: hidden;
        }

        .sdui-agent-workflow-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid #444444;
          gap: 16px;
        }

        .sdui-agent-workflow-title {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #FFFFFF;
          font-size: 16px;
          font-weight: 600;
        }

        .sdui-agent-workflow-stats {
          display: flex;
          gap: 16px;
        }

        .sdui-agent-workflow-stat {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #B3B3B3;
          font-size: 13px;
          font-weight: 500;
        }

        .sdui-agent-workflow-tabs {
          display: flex;
          border-bottom: 1px solid #444444;
        }

        .sdui-agent-workflow-tab {
          flex: 1;
          padding: 12px 16px;
          background-color: transparent;
          border: none;
          color: #B3B3B3;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 150ms;
          position: relative;
        }

        .sdui-agent-workflow-tab:hover {
          color: #FFFFFF;
          background-color: rgba(255, 255, 255, 0.05);
        }

        .sdui-agent-workflow-tab-active {
          color: #39FF14;
        }

        .sdui-agent-workflow-tab-active::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2px;
          background-color: #39FF14;
          box-shadow: 0 0 8px #39FF14;
        }

        .sdui-agent-workflow-content {
          max-height: 500px;
          overflow-y: auto;
        }

        .sdui-agent-workflow-agents {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px;
        }

        .sdui-agent-workflow-agent {
          background-color: #333333;
          border: 1px solid #444444;
          border-radius: 6px;
          padding: 12px;
          transition: all 150ms;
        }

        .sdui-agent-workflow-agent:hover {
          border-color: #555555;
        }

        .sdui-agent-workflow-agent-clickable {
          cursor: pointer;
        }

        .sdui-agent-workflow-agent-clickable:hover {
          border-color: #39FF14;
        }

        .sdui-agent-workflow-agent-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 12px;
          gap: 12px;
        }

        .sdui-agent-workflow-agent-info {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
        }

        .sdui-agent-workflow-agent-avatar,
        .sdui-agent-workflow-agent-avatar-placeholder {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .sdui-agent-workflow-agent-avatar-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #39FF14, #0A3A0A);
          color: #121212;
        }

        .sdui-agent-workflow-agent-details {
          flex: 1;
          min-width: 0;
        }

        .sdui-agent-workflow-agent-name {
          color: #FFFFFF;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .sdui-agent-workflow-agent-task {
          color: #B3B3B3;
          font-size: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sdui-agent-workflow-agent-status {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border: 1px solid;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
        }

        .sdui-agent-workflow-agent-progress {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .sdui-agent-workflow-agent-progress-bar {
          flex: 1;
          height: 6px;
          background-color: #1A1A1A;
          border-radius: 3px;
          overflow: hidden;
        }

        .sdui-agent-workflow-agent-progress-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 300ms ease-out;
        }

        .sdui-agent-workflow-agent-progress-text {
          color: #B3B3B3;
          font-size: 11px;
          font-weight: 600;
          min-width: 35px;
          text-align: right;
        }

        .sdui-agent-workflow-agent-footer {
          display: flex;
          align-items: center;
          gap: 4px;
          color: #808080;
          font-size: 11px;
        }

        .sdui-agent-workflow-messages {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px;
        }

        .sdui-agent-workflow-message {
          background-color: #333333;
          border: 1px solid #444444;
          border-radius: 6px;
          padding: 12px;
        }

        .sdui-agent-workflow-message-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
          gap: 12px;
        }

        .sdui-agent-workflow-message-from {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #B3B3B3;
          font-size: 12px;
        }

        .sdui-agent-workflow-message-agent-name {
          color: #FFFFFF;
          font-weight: 600;
        }

        .sdui-agent-workflow-message-arrow {
          color: #808080;
        }

        .sdui-agent-workflow-message-meta {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sdui-agent-workflow-message-type {
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .sdui-agent-workflow-message-time {
          color: #808080;
          font-size: 11px;
        }

        .sdui-agent-workflow-message-content {
          color: #FFFFFF;
          font-size: 13px;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
};

export default AgentWorkflowPanel;
