import React, { useState, useEffect } from 'react';
import { AlertCircle, ChevronDown, ChevronRight, Clock, XCircle, RotateCcw, Activity } from 'lucide-react';
import { workflowOrchestrator } from '../../services/WorkflowOrchestrator';
import { workflowCompensation } from '../../services/WorkflowCompensation';
import { WorkflowExecution, WorkflowExecutionLog } from '../../types/workflow';

interface WorkflowErrorPanelProps {
  executionId: string;
  onRetry?: () => void;
  onRollback?: () => void;
  onClose?: () => void;
}

export function WorkflowErrorPanel({ executionId, onRetry, onRollback, onClose }: WorkflowErrorPanelProps) {
  const [execution, setExecution] = useState<WorkflowExecution | null>(null);
  const [logs, setLogs] = useState<WorkflowExecutionLog[]>([]);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [canRollback, setCanRollback] = useState(false);

  useEffect(() => {
    loadExecutionData();
  }, [executionId]);

  const loadExecutionData = async () => {
    try {
      setLoading(true);
      const [execData, logsData, rollbackAllowed] = await Promise.all([
        workflowOrchestrator.getExecutionStatus(executionId),
        workflowOrchestrator.getExecutionLogs(executionId),
        workflowCompensation.canRollback(executionId)
      ]);

      setExecution(execData);
      setLogs(logsData);
      setCanRollback(rollbackAllowed);

      const failedStages = logsData
        .filter(log => log.status === 'failed')
        .map(log => log.stage_id);
      setExpandedStages(new Set(failedStages));
    } catch (error) {
      logger.error('Failed to load execution data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleStageExpansion = (stageId: string) => {
    setExpandedStages(prev => {
      const next = new Set(prev);
      if (next.has(stageId)) {
        next.delete(stageId);
      } else {
        next.add(stageId);
      }
      return next;
    });
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      case 'in_progress':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'failed':
        return <XCircle className="w-4 h-4" />;
      case 'in_progress':
        return <Activity className="w-4 h-4 animate-pulse" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const groupLogsByStage = () => {
    const grouped = new Map<string, WorkflowExecutionLog[]>();
    logs.forEach(log => {
      if (!grouped.has(log.stage_id)) {
        grouped.set(log.stage_id, []);
      }
      grouped.get(log.stage_id)!.push(log);
    });
    return grouped;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center text-gray-500">
          <AlertCircle className="w-12 h-12 mx-auto mb-4" />
          <p>Execution not found</p>
        </div>
      </div>
    );
  }

  const groupedLogs = groupLogsByStage();
  const failedStages = Array.from(groupedLogs.entries()).filter(
    ([_, stageLogs]) => stageLogs.some(log => log.status === 'failed')
  );

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="bg-red-50 border-b border-red-100 px-6 py-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-red-900">
                Workflow Execution Failed
              </h3>
              <p className="text-sm text-red-700 mt-1">
                Execution ID: {executionId.slice(0, 8)}...
              </p>
              {execution.error_message && (
                <p className="text-sm text-red-600 mt-2 font-medium">
                  {execution.error_message}
                </p>
              )}
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-red-400 hover:text-red-600 transition-colors"
            >
              <XCircle className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="px-6 py-4 border-b border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Status:</span>
            <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(execution.status)}`}>
              {execution.status}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Started:</span>
            <span className="ml-2 text-gray-900">
              {new Date(execution.started_at).toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Current Stage:</span>
            <span className="ml-2 text-gray-900">
              {execution.current_stage || 'N/A'}
            </span>
          </div>
        </div>
      </div>

      <div className="px-6 py-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
          <AlertCircle className="w-4 h-4 mr-2 text-red-500" />
          Failed Stages ({failedStages.length})
        </h4>

        <div className="space-y-2">
          {failedStages.map(([stageId, stageLogs]) => {
            const isExpanded = expandedStages.has(stageId);
            const lastLog = stageLogs[stageLogs.length - 1];

            return (
              <div key={stageId} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleStageExpansion(stageId)}
                  className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    )}
                    {getStatusIcon(lastLog.status)}
                    <span className="font-medium text-gray-900">{stageId}</span>
                    <span className="text-xs text-gray-500">
                      {stageLogs.length} attempt{stageLogs.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <div className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatDuration(lastLog.duration_ms)}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-200 bg-white">
                    {stageLogs.map((log, index) => (
                      <div
                        key={log.id}
                        className={`px-4 py-3 ${index > 0 ? 'border-t border-gray-100' : ''}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-medium text-gray-500">
                              Attempt {log.attempt_number}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(log.status)}`}>
                              {log.status}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(log.started_at).toLocaleTimeString()}
                          </span>
                        </div>

                        {log.error_message && (
                          <div className="bg-red-50 border border-red-200 rounded p-3 mb-2">
                            <p className="text-xs text-red-800 font-mono">
                              {log.error_message}
                            </p>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-gray-500">Duration:</span>
                            <span className="ml-2 text-gray-900">
                              {formatDuration(log.duration_ms)}
                            </span>
                          </div>
                          {log.completed_at && (
                            <div>
                              <span className="text-gray-500">Completed:</span>
                              <span className="ml-2 text-gray-900">
                                {new Date(log.completed_at).toLocaleTimeString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-end space-x-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Retry Workflow</span>
          </button>
        )}
        {onRollback && canRollback && (
          <button
            onClick={onRollback}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Rollback Changes</span>
          </button>
        )}
      </div>
    </div>
  );
}
