/**
 * Agent Audit Log View
 * 
 * UI for viewing and analyzing agent interaction logs
 */

import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import {
  getAuditLogger,
  AgentAuditLog,
  AuditLogFilters,
  AuditLogStats,
} from '../../services/AgentAuditLogger';
import { AgentType } from '../../services/AgentAPI';

/**
 * Agent Audit Log View Component
 */
export const AgentAuditLogView: React.FC = () => {
  const [logs, setLogs] = useState<AgentAuditLog[]>([]);
  const [stats, setStats] = useState<AuditLogStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<AuditLogFilters>({
    limit: 50,
    sortOrder: 'desc',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState<AgentAuditLog | null>(null);

  const logger = getAuditLogger();

  /**
   * Load logs
   */
  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await logger.query(filters);
      setLogs(data);
    } catch (error) {
      logger.error('Failed to load logs:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load statistics
   */
  const loadStats = async () => {
    try {
      const data = await logger.getStats(filters);
      setStats(data);
    } catch (error) {
      logger.error('Failed to load stats:', error);
    }
  };

  /**
   * Initial load
   */
  useEffect(() => {
    loadLogs();
    loadStats();
  }, [filters]);

  /**
   * Filter logs by search query
   */
  const filteredLogs = logs.filter((log) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.input_query.toLowerCase().includes(query) ||
      log.agent_name.toLowerCase().includes(query) ||
      log.error_message?.toLowerCase().includes(query)
    );
  });

  /**
   * Export logs to CSV
   */
  const exportToCSV = () => {
    const headers = [
      'Timestamp',
      'Agent',
      'Query',
      'Success',
      'Duration (ms)',
      'Confidence',
      'Error',
    ];

    const rows = filteredLogs.map((log) => [
      log.timestamp || '',
      log.agent_name,
      log.input_query,
      log.success ? 'Yes' : 'No',
      log.response_metadata?.duration || '',
      log.response_metadata?.confidence || '',
      log.error_message || '',
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-audit-logs-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agent Audit Logs</h1>
          <p className="text-sm text-gray-600 mt-1">
            View and analyze all agent interactions
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadLogs}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
              <Clock className="h-4 w-4" />
              Total Requests
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.totalRequests}</p>
          </div>

          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-700 text-sm mb-1">
              <CheckCircle className="h-4 w-4" />
              Successful
            </div>
            <p className="text-2xl font-bold text-green-900">{stats.successfulRequests}</p>
          </div>

          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700 text-sm mb-1">
              <XCircle className="h-4 w-4" />
              Failed
            </div>
            <p className="text-2xl font-bold text-red-900">{stats.failedRequests}</p>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 text-blue-700 text-sm mb-1">
              <TrendingUp className="h-4 w-4" />
              Avg Duration
            </div>
            <p className="text-2xl font-bold text-blue-900">
              {Math.round(stats.averageDuration)}ms
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search logs..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Agent Filter */}
          <select
            value={filters.agent || ''}
            onChange={(e) =>
              setFilters({
                ...filters,
                agent: e.target.value as AgentType | undefined,
              })
            }
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Agents</option>
            <option value="opportunity">Opportunity</option>
            <option value="target">Target</option>
            <option value="realization">Realization</option>
            <option value="expansion">Expansion</option>
            <option value="integrity">Integrity</option>
            <option value="company-intelligence">Company Intelligence</option>
            <option value="financial-modeling">Financial Modeling</option>
            <option value="value-mapping">Value Mapping</option>
          </select>

          {/* Success Filter */}
          <select
            value={
              filters.success === undefined
                ? ''
                : filters.success
                ? 'success'
                : 'failure'
            }
            onChange={(e) =>
              setFilters({
                ...filters,
                success:
                  e.target.value === ''
                    ? undefined
                    : e.target.value === 'success',
              })
            }
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
          </select>

          {/* Limit */}
          <select
            value={filters.limit || 50}
            onChange={(e) =>
              setFilters({ ...filters, limit: Number(e.target.value) })
            }
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={25}>25 logs</option>
            <option value={50}>50 logs</option>
            <option value={100}>100 logs</option>
            <option value={200}>200 logs</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Agent
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Query
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Confidence
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Loading logs...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No logs found
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {log.timestamp
                        ? new Date(log.timestamp).toLocaleString()
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                        {log.agent_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-md truncate">
                      {log.input_query}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {log.success ? (
                        <span className="flex items-center gap-1 text-green-700">
                          <CheckCircle className="h-4 w-4" />
                          Success
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-700">
                          <XCircle className="h-4 w-4" />
                          Failed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {log.response_metadata?.duration
                        ? `${log.response_metadata.duration}ms`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {log.response_metadata?.confidence
                        ? `${(log.response_metadata.confidence * 100).toFixed(0)}%`
                        : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Log Details</h2>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Agent</p>
                  <p className="text-sm text-gray-900 mt-1">{selectedLog.agent_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Timestamp</p>
                  <p className="text-sm text-gray-900 mt-1">
                    {selectedLog.timestamp
                      ? new Date(selectedLog.timestamp).toLocaleString()
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <p className="text-sm text-gray-900 mt-1">
                    {selectedLog.success ? 'Success' : 'Failed'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Duration</p>
                  <p className="text-sm text-gray-900 mt-1">
                    {selectedLog.response_metadata?.duration
                      ? `${selectedLog.response_metadata.duration}ms`
                      : '-'}
                  </p>
                </div>
              </div>

              {/* Query */}
              <div>
                <p className="text-sm font-medium text-gray-500 mb-2">Input Query</p>
                <pre className="bg-gray-50 p-3 rounded-md text-sm text-gray-900 overflow-x-auto">
                  {selectedLog.input_query}
                </pre>
              </div>

              {/* Error */}
              {selectedLog.error_message && (
                <div>
                  <p className="text-sm font-medium text-red-700 mb-2">Error Message</p>
                  <pre className="bg-red-50 p-3 rounded-md text-sm text-red-900 overflow-x-auto">
                    {selectedLog.error_message}
                  </pre>
                </div>
              )}

              {/* Response Data */}
              {selectedLog.response_data && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Response Data</p>
                  <pre className="bg-gray-50 p-3 rounded-md text-sm text-gray-900 overflow-x-auto max-h-96">
                    {JSON.stringify(selectedLog.response_data, null, 2)}
                  </pre>
                </div>
              )}

              {/* Metadata */}
              {selectedLog.response_metadata && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Metadata</p>
                  <pre className="bg-gray-50 p-3 rounded-md text-sm text-gray-900 overflow-x-auto">
                    {JSON.stringify(selectedLog.response_metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
