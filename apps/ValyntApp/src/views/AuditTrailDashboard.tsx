/**
 * VOS-SUPER-003: Audit Trail Dashboard
 * Main component for immutable audit trail viewing with compliance features
 */

import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Database,
  Download,
  FileText,
  Filter,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  XCircle
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { useAuditTrail } from '../hooks/useAuditTrail';
import { PermissionMiddleware } from '../lib/auth/PermissionMiddleware';
import { AuditFilter } from '../types/audit';

// Sub-components
const FilterPanel: React.FC<{
  filters: AuditFilter;
  onFilterChange: (filters: AuditFilter) => void;
  onApply: () => void;
}> = ({ filters, onFilterChange, onApply }) => {
  const [expanded, setExpanded] = useState(true);

  const handleDateChange = (type: 'start' | 'end', value: string) => {
    const date = value ? new Date(value) : undefined;
    onFilterChange({
      ...filters,
      dateRange: filters.dateRange || { start: new Date(Date.now() - 3600000), end: new Date() },
      [type]: date,
    });
  };

  return (
    <div className="bg-card border border-border rounded-lg mb-4 overflow-hidden">
      <div 
        className="p-3 bg-secondary/50 flex items-center justify-between cursor-pointer hover:bg-secondary"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" />
          <span className="font-semibold text-sm">Filters</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </div>

      {expanded && (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Date Range */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Start Date/Time
              </label>
              <input
                type="datetime-local"
                value={filters.dateRange?.start?.toISOString().slice(0, 16) || ''}
                onChange={(e) => handleDateChange('start', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded bg-background"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                End Date/Time
              </label>
              <input
                type="datetime-local"
                value={filters.dateRange?.end?.toISOString().slice(0, 16) || ''}
                onChange={(e) => handleDateChange('end', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded bg-background"
              />
            </div>

            {/* User ID */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                User ID
              </label>
              <input
                type="text"
                placeholder="Filter by user..."
                value={filters.userId || ''}
                onChange={(e) => onFilterChange({ ...filters, userId: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-border rounded bg-background"
              />
            </div>

            {/* Agent ID */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Agent ID
              </label>
              <input
                type="text"
                placeholder="Filter by agent..."
                value={filters.agentId || ''}
                onChange={(e) => onFilterChange({ ...filters, agentId: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-border rounded bg-background"
              />
            </div>

            {/* Action Type */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Action Type
              </label>
              <select
                value={filters.actionType || ''}
                onChange={(e) => onFilterChange({ ...filters, actionType: e.target.value || undefined })}
                className="w-full px-3 py-2 text-sm border border-border rounded bg-background"
              >
                <option value="">All Types</option>
                <option value="agent_action">Agent Action</option>
                <option value="security_event">Security Event</option>
                <option value="system_event">System Event</option>
                <option value="compliance_check">Compliance Check</option>
              </select>
            </div>

            {/* Severity */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Severity
              </label>
              <select
                value={filters.severity || ''}
                onChange={(e) => onFilterChange({ ...filters, severity: e.target.value || undefined })}
                className="w-full px-3 py-2 text-sm border border-border rounded bg-background"
              >
                <option value="">All Severities</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
                <option value="compliance">Compliance</option>
              </select>
            </div>

            {/* Session ID */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Session ID
              </label>
              <input
                type="text"
                placeholder="Filter by session..."
                value={filters.sessionId || ''}
                onChange={(e) => onFilterChange({ ...filters, sessionId: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-border rounded bg-background"
              />
            </div>

            {/* Search */}
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search in actions, users, agents, resources..."
                  value={filters.searchQuery || ''}
                  onChange={(e) => onFilterChange({ ...filters, searchQuery: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded bg-background"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onApply}
              className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm hover:opacity-90"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const StatisticsCards: React.FC<{ statistics: any; integrity: any }> = ({ statistics, integrity }) => {
  const cards = [
    {
      title: 'Total Events',
      value: statistics.totalEvents,
      icon: Activity,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: 'Critical',
      value: statistics.criticalEvents,
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      title: 'Warning',
      value: statistics.warningEvents,
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      title: 'Compliance',
      value: statistics.complianceEvents,
      icon: ShieldCheck,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      title: 'Integrity',
      value: integrity.hashChainValid ? 'Valid' : 'Failed',
      icon: integrity.hashChainValid ? CheckCircle2 : XCircle,
      color: integrity.hashChainValid ? 'text-green-600' : 'text-red-600',
      bg: integrity.hashChainValid ? 'bg-green-50' : 'bg-red-50',
    },
    {
      title: 'Compliance Score',
      value: `${statistics.complianceScore}%`,
      icon: Shield,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <div key={index} className={`p-3 rounded-lg border ${card.bg} border-opacity-50`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-muted-foreground">{card.title}</span>
              <Icon className={`w-4 h-4 ${card.color}`} />
            </div>
            <div className={`text-xl font-bold ${card.color}`}>{card.value}</div>
          </div>
        );
      })}
    </div>
  );
};

const AuditLogTable: React.FC<{
  events: any[];
  loading: boolean;
  onRowClick: (event: any) => void;
}> = ({ events, loading, onRowClick }) => {
  const getSeverityBadge = (severity: string) => {
    const colors = {
      info: 'bg-blue-100 text-blue-800',
      warning: 'bg-amber-100 text-amber-800',
      critical: 'bg-red-100 text-red-800',
      compliance: 'bg-green-100 text-green-800',
    };
    return colors[severity as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getVerificationBadge = (status: string) => {
    const colors = {
      verified: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      pending: 'bg-amber-100 text-amber-800',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">Loading audit events...</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <Database className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">No audit events found</p>
        <p className="text-sm text-muted-foreground mt-2">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Timestamp</th>
              <th className="px-4 py-3 text-left font-semibold">User/Agent</th>
              <th className="px-4 py-3 text-left font-semibold">Action</th>
              <th className="px-4 py-3 text-left font-semibold">Type</th>
              <th className="px-4 py-3 text-left font-semibold">Severity</th>
              <th className="px-4 py-3 text-left font-semibold">Integrity</th>
              <th className="px-4 py-3 text-left font-semibold">Session</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event, _index) => (
              <tr 
                key={event.id}
                className="border-b border-border hover:bg-secondary/30 cursor-pointer transition-colors"
                onClick={() => onRowClick(event)}
              >
                <td className="px-4 py-3">
                  <div className="font-mono text-xs">
                    {new Date(event.timestamp).toLocaleString()}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{event.userName || event.agentName || 'Unknown'}</div>
                  <div className="text-xs text-muted-foreground">{event.userId || event.agentId}</div>
                </td>
                <td className="px-4 py-3 max-w-xs truncate" title={event.action}>
                  {event.action}
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100">
                    {event.actionType}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityBadge(event.severity)}`}>
                    {event.severity}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getVerificationBadge(event.verificationStatus)}`}>
                    {event.verificationStatus}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs">{event.sessionId || '-'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const EventDetailModal: React.FC<{ event: any; onClose: () => void }> = ({ event, onClose }) => {
  if (!event) return null;

  const metadata = event.metadata ? JSON.stringify(event.metadata, null, 2) : '{}';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Audit Event Details</h2>
            <p className="text-sm text-muted-foreground">ID: {event.id}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Timestamp</label>
              <div className="font-mono text-sm">{new Date(event.timestamp).toLocaleString()}</div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">User/Agent</label>
              <div className="text-sm">
                {event.userName || event.agentName || 'Unknown'} ({event.userId || event.agentId})
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Action</label>
              <div className="text-sm font-medium">{event.action}</div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Resource</label>
              <div className="text-sm">{event.resource || '-'}</div>
            </div>
          </div>

          {/* Security Info */}
          <div className="bg-secondary/50 p-3 rounded">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="font-semibold">Action Type:</span> {event.actionType}
              </div>
              <div>
                <span className="font-semibold">Severity:</span> {event.severity}
              </div>
              <div>
                <span className="font-semibold">Integrity Status:</span> {event.verificationStatus}
              </div>
              <div>
                <span className="font-semibold">Session ID:</span> {event.sessionId || '-'}
              </div>
              <div>
                <span className="font-semibold">IP Address:</span> {event.ipAddress || '-'}
              </div>
            </div>
          </div>

          {/* Integrity Info */}
          <div className="bg-secondary/50 p-3 rounded">
            <div className="text-xs font-semibold mb-2">Cryptographic Integrity</div>
            <div className="space-y-1 text-xs font-mono break-all">
              <div><span className="text-muted-foreground">Hash:</span> {event.integrityHash}</div>
              {event.previousHash && (
                <div><span className="text-muted-foreground">Previous:</span> {event.previousHash}</div>
              )}
            </div>
          </div>

          {/* Metadata */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Metadata</label>
            <pre className="bg-secondary/30 p-3 rounded text-xs font-mono overflow-x-auto">
              {metadata}
            </pre>
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const ExportTools: React.FC<{
  onExport: (format: 'csv' | 'json', includeMetadata?: boolean) => void;
  onVerifyIntegrity: () => void;
  integrity: any;
}> = ({ onExport, onVerifyIntegrity, _integrity }) => {
  const [showExportMenu, setShowExportMenu] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onVerifyIntegrity}
        className="px-3 py-2 bg-secondary hover:bg-secondary/80 rounded text-sm flex items-center gap-2"
      >
        <ShieldCheck className="w-4 h-4" />
        Verify Integrity
      </button>

      <div className="relative">
        <button
          onClick={() => setShowExportMenu(!showExportMenu)}
          className="px-3 py-2 bg-primary text-primary-foreground rounded text-sm flex items-center gap-2 hover:opacity-90"
        >
          <Download className="w-4 h-4" />
          Export
        </button>

        {showExportMenu && (
          <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg z-50">
            <div className="p-2 space-y-1">
              <button
                onClick={() => {
                  onExport('csv', false);
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-secondary rounded"
              >
                <FileText className="w-4 h-4 inline mr-2" />
                CSV (Basic)
              </button>
              <button
                onClick={() => {
                  onExport('csv', true);
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-secondary rounded"
              >
                <FileText className="w-4 h-4 inline mr-2" />
                CSV (Full)
              </button>
              <button
                onClick={() => {
                  onExport('json', true);
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-secondary rounded"
              >
                <FileText className="w-4 h-4 inline mr-2" />
                JSON (Full)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const AuditTrailDashboard: React.FC = () => {
  const {
    events,
    filteredEvents,
    statistics,
    integrity,
    loading,
    error,
    realTimeConfig,
    applyFilters,
    exportData,
    verifyIntegrity,
    toggleRealTime,
    clearError,
  } = useAuditTrail();

  const [filters, setFilters] = useState<AuditFilter>({});
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [showRealTime, setShowRealTime] = useState(true);

  // Check permissions
  useEffect(() => {
    const checkPermissions = async () => {
      const middleware = new PermissionMiddleware();
      const hasAccess = await middleware.checkPermission('audit:read');
      if (!hasAccess) {
        // In real app, redirect or show access denied
        console.warn('Access denied: audit:read permission required');
      }
    };
    checkPermissions();
  }, []);

  const handleApplyFilters = () => {
    applyFilters(filters);
  };

  const handleExport = async (format: 'csv' | 'json', includeMetadata: boolean = true) => {
    try {
      const blob = await exportData(format, includeMetadata);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-export-${new Date().toISOString()}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleVerifyIntegrity = async () => {
    const result = await verifyIntegrity();
    if (!result.hashChainValid) {
      alert(`Integrity verification failed!\n\nTampered events: ${result.tamperedEvents.join(', ')}\n\nErrors: ${result.verificationErrors.join('\n')}`);
    } else {
      alert('✓ Integrity verification passed - all events are valid');
    }
  };

  const handleToggleRealTime = () => {
    const newEnabled = !realTimeConfig.enabled;
    toggleRealTime(newEnabled);
    setShowRealTime(newEnabled);
  };

  return (
    <PermissionMiddleware requiredPermissions={['audit:read']}>
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {/* Header */}
        <div className="h-14 border-b border-border px-6 flex items-center justify-between bg-card">
          <div className="flex items-center gap-4">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">Audit Trail Dashboard</h1>
            {realTimeConfig.enabled && (
              <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
                <span className="w-1.5 h-1.5 bg-green-600 rounded-full animate-pulse" />
                Live
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Real-time Toggle */}
            <button
              onClick={handleToggleRealTime}
              className={`px-3 py-1.5 text-sm rounded border ${
                realTimeConfig.enabled
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-gray-50 border-gray-200 text-gray-700'
              } flex items-center gap-2`}
            >
              <Activity className="w-4 h-4" />
              {realTimeConfig.enabled ? 'Live' : 'Paused'}
            </button>

            <ExportTools
              onExport={handleExport}
              onVerifyIntegrity={handleVerifyIntegrity}
              integrity={integrity}
            />
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border-b border-red-200 px-6 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
            <button onClick={clearError} className="text-red-800 hover:underline text-sm">
              Dismiss
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Statistics */}
          <StatisticsCards statistics={statistics} integrity={integrity} />

          {/* Filters */}
          <FilterPanel
            filters={filters}
            onFilterChange={setFilters}
            onApply={handleApplyFilters}
          />

          {/* Audit Log Table */}
          <AuditLogTable
            events={filteredEvents}
            loading={loading}
            onRowClick={setSelectedEvent}
          />
        </div>

        {/* Event Detail Modal */}
        <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      </div>
    </PermissionMiddleware>
  );
};

export default AuditTrailDashboard;