import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SettingsSection } from '../../components/Settings/SettingsSection';
import {
  Search, Filter, Download, Calendar, User, Activity,
  Shield, FileText, Users, Settings, Loader2, ChevronDown
} from 'lucide-react';
import { TeamAuditLog as AuditLogType } from '../../types';

const MOCK_AUDIT_LOGS: AuditLogType[] = Array.from({ length: 50 }, (_, i) => ({
  id: `log-${i}`,
  timestamp: new Date(Date.now() - i * 3600000).toISOString(),
  userId: `user-${i % 5}`,
  userName: ['John Doe', 'Jane Smith', 'Bob Johnson', 'Alice Williams', 'Charlie Brown'][i % 5],
  action: ['member.invite', 'member.remove', 'role.change', 'settings.update', 'integration.enable'][i % 5],
  resourceType: ['member', 'workspace', 'integration', 'permission', 'settings'][i % 5],
  resourceId: `resource-${i}`,
  details: {
    description: `Action details for log ${i}`,
    oldValue: 'previous value',
    newValue: 'new value',
  },
  ipAddress: `192.168.1.${(i % 255) + 1}`,
}));

const ACTION_TYPES = [
  { value: 'all', label: 'All Actions' },
  { value: 'member.invite', label: 'Member Invited' },
  { value: 'member.remove', label: 'Member Removed' },
  { value: 'role.change', label: 'Role Changed' },
  { value: 'settings.update', label: 'Settings Updated' },
  { value: 'integration.enable', label: 'Integration Enabled' },
  { value: 'integration.disable', label: 'Integration Disabled' },
  { value: 'permission.change', label: 'Permission Changed' },
];

const RESOURCE_TYPES = [
  { value: 'all', label: 'All Resources' },
  { value: 'member', label: 'Members' },
  { value: 'workspace', label: 'Workspace' },
  { value: 'integration', label: 'Integrations' },
  { value: 'permission', label: 'Permissions' },
  { value: 'settings', label: 'Settings' },
];

export const TeamAuditLog: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [resourceFilter, setResourceFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedUser, setSelectedUser] = useState('all');
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const observerTarget = useRef<HTMLDivElement>(null);

  const loadMoreLogs = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const start = (page - 1) * 20;
    const end = start + 20;
    const newLogs = MOCK_AUDIT_LOGS.slice(start, end);

    setLogs(prev => [...prev, ...newLogs]);
    setPage(prev => prev + 1);
    setHasMore(end < MOCK_AUDIT_LOGS.length);
    setLoading(false);
  }, [loading, hasMore, page]);

  useEffect(() => {
    loadMoreLogs();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMoreLogs();
        }
      },
      { threshold: 0.1 }
    );

    const target = observerTarget.current;
    if (target) {
      observer.observe(target);
    }

    return () => {
      if (target) {
        observer.unobserve(target);
      }
    };
  }, [hasMore, loading, loadMoreLogs]);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = !searchQuery ||
      log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.resourceType.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    const matchesResource = resourceFilter === 'all' || log.resourceType === resourceFilter;
    const matchesUser = selectedUser === 'all' || log.userId === selectedUser;

    const logDate = new Date(log.timestamp);
    const matchesDateFrom = !dateFrom || logDate >= new Date(dateFrom);
    const matchesDateTo = !dateTo || logDate <= new Date(dateTo);

    return matchesSearch && matchesAction && matchesResource && matchesUser && matchesDateFrom && matchesDateTo;
  });

  const uniqueUsers = Array.from(new Set(logs.map(log => ({ id: log.userId, name: log.userName }))))
    .filter((user, index, self) => self.findIndex(u => u.id === user.id) === index);

  const handleExport = async () => {
    setExporting(true);
    await new Promise(resolve => setTimeout(resolve, 1500));

    const csvContent = [
      ['Timestamp', 'User', 'Action', 'Resource Type', 'Resource ID', 'IP Address'],
      ...filteredLogs.map(log => [
        new Date(log.timestamp).toLocaleString(),
        log.userName,
        log.action,
        log.resourceType,
        log.resourceId,
        log.ipAddress || 'N/A',
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    setExporting(false);
  };

  const getActionIcon = (action: string) => {
    if (action.includes('member')) return <Users className="h-4 w-4" />;
    if (action.includes('role')) return <Shield className="h-4 w-4" />;
    if (action.includes('settings')) return <Settings className="h-4 w-4" />;
    if (action.includes('integration')) return <Activity className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const getActionColor = (action: string) => {
    if (action.includes('remove') || action.includes('disable')) return 'text-red-600 bg-red-50';
    if (action.includes('invite') || action.includes('enable')) return 'text-green-600 bg-green-50';
    if (action.includes('change') || action.includes('update')) return 'text-blue-600 bg-blue-50';
    return 'text-muted-foreground bg-muted';
  };

  const formatAction = (action: string) => {
    return action.split('.').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Audit Log"
        description="View workspace activity and member actions"
        actions={
          <button
            onClick={handleExport}
            disabled={exporting || filteredLogs.length === 0}
            className="flex items-center px-4 py-2 border border-border text-muted-foreground rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search logs..."
                aria-label="Search logs"
                className="w-full pl-10 pr-3 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              aria-label="Filter by action type"
              className="px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {ACTION_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>

            <select
              value={resourceFilter}
              onChange={(e) => setResourceFilter(e.target.value)}
              aria-label="Filter by resource type"
              className="px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {RESOURCE_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>

            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              aria-label="Filter by user"
              className="px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Users</option>
              {uniqueUsers.map(user => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-xs text-muted-foreground mb-1">From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-muted-foreground mb-1">To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                }}
                className="self-end px-4 py-2 text-sm border border-border text-muted-foreground rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                Clear Dates
              </button>
            )}
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="max-h-[600px] overflow-y-auto">
              {filteredLogs.length === 0 && !loading ? (
                <div className="text-center py-12">
                  <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No audit logs found</p>
                  <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredLogs.map((log) => (
                    <div key={log.id} className="p-4 hover:bg-accent/40 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1 min-w-0">
                          <div className={`mt-0.5 p-2 rounded-lg ${getActionColor(log.action)}`}>
                            {getActionIcon(log.action)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="font-medium text-foreground">{log.userName}</span>
                              <span className="text-muted-foreground">•</span>
                              <span className={`text-sm px-2 py-0.5 rounded-full ${getActionColor(log.action)}`}>
                                {formatAction(log.action)}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {log.details.description || `Performed ${formatAction(log.action)} on ${log.resourceType}`}
                            </p>
                            <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                              <span className="flex items-center">
                                <Calendar className="h-3 w-3 mr-1" />
                                {new Date(log.timestamp).toLocaleString()}
                              </span>
                              <span>Resource: {log.resourceType}</span>
                              {log.ipAddress && (
                                <span>IP: {log.ipAddress}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                  <span className="text-sm text-muted-foreground">Loading more logs...</span>
                </div>
              )}

              <div ref={observerTarget} className="h-4" />
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {filteredLogs.length} of {logs.length} logs
              {hasMore && ' (scroll to load more)'}
            </span>
            {filteredLogs.length > 0 && (
              <span>
                {new Date(filteredLogs[0].timestamp).toLocaleDateString()} - {new Date(filteredLogs[filteredLogs.length - 1].timestamp).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </SettingsSection>
    </div>
  );
};
