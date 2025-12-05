/**
 * Audit Trace Viewer Component
 * 
 * Displays decision traces and rule evaluations from agent_audit_log
 * and policy_rules tables. Shows complete audit trail for compliance.
 */

import React, { useState, useEffect } from 'react';
import { Clock, User, FileText, CheckCircle, XCircle, AlertTriangle, ChevronRight, Filter, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName?: string;
  agentName?: string;
  actionType: string;
  resourceType: string;
  resourceId: string;
  decision: 'approved' | 'rejected' | 'pending' | 'info';
  rulesEvaluated: Array<{
    ruleId: string;
    ruleName: string;
    result: 'passed' | 'failed' | 'skipped';
    reason?: string;
  }>;
  metadata: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

interface AuditTraceViewerProps {
  resourceId?: string;
  resourceType?: string;
  userId?: string;
  limit?: number;
  showFilters?: boolean;
}

export const AuditTraceViewer: React.FC<AuditTraceViewerProps> = ({
  resourceId,
  resourceType,
  userId,
  limit = 50,
  showFilters = true,
}) => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [filters, setFilters] = useState({
    actionType: '',
    decision: '',
    dateFrom: '',
    dateTo: '',
  });

  useEffect(() => {
    loadAuditEntries();
  }, [resourceId, resourceType, userId, filters]);

  const loadAuditEntries = async () => {
    setLoading(true);

    let query = supabase
      .from('agent_audit_log')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (resourceId) {
      query = query.eq('resource_id', resourceId);
    }

    if (resourceType) {
      query = query.eq('resource_type', resourceType);
    }

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (filters.actionType) {
      query = query.eq('action_type', filters.actionType);
    }

    if (filters.decision) {
      query = query.eq('decision', filters.decision);
    }

    if (filters.dateFrom) {
      query = query.gte('timestamp', filters.dateFrom);
    }

    if (filters.dateTo) {
      query = query.lte('timestamp', filters.dateTo);
    }

    const { data, error } = await query;

    if (data && !error) {
      setEntries(data as any);
    }

    setLoading(false);
  };

  const exportToCSV = () => {
    const headers = ['Timestamp', 'User', 'Action', 'Resource', 'Decision', 'Rules Evaluated'];
    const rows = entries.map(entry => [
      entry.timestamp,
      entry.userName || entry.userId,
      entry.actionType,
      `${entry.resourceType}:${entry.resourceId}`,
      entry.decision,
      entry.rulesEvaluated.length.toString(),
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trace-${Date.now()}.csv`;
    a.click();
  };

  const getDecisionIcon = (decision: string) => {
    switch (decision) {
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'pending':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      default:
        return <FileText className="w-5 h-5 text-gray-600" />;
    }
  };

  const getDecisionColor = (decision: string) => {
    switch (decision) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Audit Trail</h3>
        <button
          onClick={exportToCSV}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Filters</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Action Type
              </label>
              <select
                value={filters.actionType}
                onChange={(e) => setFilters({ ...filters, actionType: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
                <option value="approve">Approve</option>
                <option value="reject">Reject</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Decision
              </label>
              <select
                value={filters.decision}
                onChange={(e) => setFilters({ ...filters, decision: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Date From
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Date To
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      )}

      {/* Audit Entries */}
      <div className="space-y-2">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
          >
            <button
              onClick={() => setSelectedEntry(selectedEntry?.id === entry.id ? null : entry)}
              className="w-full p-4 text-left"
            >
              <div className="flex items-start gap-4">
                {getDecisionIcon(entry.decision)}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">{entry.actionType}</span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${getDecisionColor(entry.decision)}`}>
                      {entry.decision}
                    </span>
                    {entry.agentName && (
                      <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                        {entry.agentName}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{new Date(entry.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      <span>{entry.userName || entry.userId}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="w-4 h-4" />
                      <span>{entry.resourceType}</span>
                    </div>
                  </div>

                  {entry.rulesEvaluated.length > 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                      {entry.rulesEvaluated.length} rules evaluated
                    </div>
                  )}
                </div>

                <ChevronRight
                  className={`w-5 h-5 text-gray-400 transition-transform ${
                    selectedEntry?.id === entry.id ? 'rotate-90' : ''
                  }`}
                />
              </div>
            </button>

            {/* Expanded Details */}
            {selectedEntry?.id === entry.id && (
              <div className="border-t border-gray-200 p-4 bg-gray-50">
                {/* Rules Evaluated */}
                {entry.rulesEvaluated.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">
                      Rules Evaluated
                    </h4>
                    <div className="space-y-2">
                      {entry.rulesEvaluated.map((rule, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2 p-2 bg-white rounded border border-gray-200"
                        >
                          {rule.result === 'passed' && <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />}
                          {rule.result === 'failed' && <XCircle className="w-4 h-4 text-red-600 mt-0.5" />}
                          {rule.result === 'skipped' && <AlertTriangle className="w-4 h-4 text-gray-400 mt-0.5" />}
                          
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">
                              {rule.ruleName}
                            </div>
                            {rule.reason && (
                              <div className="text-xs text-gray-600 mt-1">
                                {rule.reason}
                              </div>
                            )}
                          </div>

                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                            rule.result === 'passed' ? 'bg-green-100 text-green-800' :
                            rule.result === 'failed' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {rule.result}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                {Object.keys(entry.metadata).length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">
                      Additional Details
                    </h4>
                    <div className="bg-white rounded border border-gray-200 p-3">
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                        {JSON.stringify(entry.metadata, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Technical Details */}
                <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
                  <div>
                    <span className="font-medium">Resource ID:</span> {entry.resourceId}
                  </div>
                  {entry.ipAddress && (
                    <div>
                      <span className="font-medium">IP Address:</span> {entry.ipAddress}
                    </div>
                  )}
                  {entry.userAgent && (
                    <div className="col-span-2">
                      <span className="font-medium">User Agent:</span> {entry.userAgent}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {entries.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p>No audit entries found</p>
        </div>
      )}
    </div>
  );
};

/**
 * Compact Audit Summary
 * 
 * Shows a summary of recent audit activity
 */
interface AuditSummaryProps {
  resourceId: string;
  resourceType: string;
}

export const AuditSummary: React.FC<AuditSummaryProps> = ({ resourceId, resourceType }) => {
  const [summary, setSummary] = useState<{
    totalActions: number;
    approvedActions: number;
    rejectedActions: number;
    lastActivity: string;
  } | null>(null);

  useEffect(() => {
    loadSummary();
  }, [resourceId, resourceType]);

  const loadSummary = async () => {
    const { data } = await supabase
      .from('agent_audit_log')
      .select('*')
      .eq('resource_id', resourceId)
      .eq('resource_type', resourceType)
      .order('timestamp', { ascending: false });

    if (data) {
      setSummary({
        totalActions: data.length,
        approvedActions: data.filter(e => e.decision === 'approved').length,
        rejectedActions: data.filter(e => e.decision === 'rejected').length,
        lastActivity: data[0]?.timestamp || '',
      });
    }
  };

  if (!summary) return null;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <h4 className="text-sm font-semibold text-gray-900 mb-3">Audit Summary</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <div className="text-xs text-gray-500">Total Actions</div>
          <div className="text-lg font-semibold text-gray-900">{summary.totalActions}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Approved</div>
          <div className="text-lg font-semibold text-green-600">{summary.approvedActions}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Rejected</div>
          <div className="text-lg font-semibold text-red-600">{summary.rejectedActions}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Last Activity</div>
          <div className="text-sm font-medium text-gray-900">
            {summary.lastActivity ? new Date(summary.lastActivity).toLocaleDateString() : 'N/A'}
          </div>
        </div>
      </div>
    </div>
  );
};
