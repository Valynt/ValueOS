import { Activity, Calendar, Download, FileText, Loader2, Search, Settings, Shield, Users } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { SettingsSection } from '../../components/settings';

import { useDebounce } from '@/hooks/useDebounce';
import { type AuditLogItem, fetchTeamAuditLogs } from '@/services/adminSettingsService';

const ACTION_TYPES = [
  { value: 'all', label: 'All Actions' },
  { value: 'member.invite', label: 'Member Invited' },
  { value: 'member.remove', label: 'Member Removed' },
  { value: 'role.change', label: 'Role Changed' },
  { value: 'settings.update', label: 'Settings Updated' },
];

const RESOURCE_TYPES = [
  { value: 'all', label: 'All Resources' },
  { value: 'member', label: 'Members' },
  { value: 'workspace', label: 'Workspace' },
  { value: 'integration', label: 'Integrations' },
  { value: 'permission', label: 'Permissions' },
  { value: 'settings', label: 'Settings' },
];

const PAGE_SIZE = 25;

export const TeamAuditLog: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [resourceFilter, setResourceFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedUser, setSelectedUser] = useState('all');
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const observerTarget = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(searchQuery, 350);

  const loadLogs = useCallback(async (nextOffset: number, append: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchTeamAuditLogs({
        search: debouncedSearch,
        action: actionFilter,
        resourceType: resourceFilter,
        userId: selectedUser,
        startDate: dateFrom || undefined,
        endDate: dateTo || undefined,
        limit: PAGE_SIZE,
        offset: nextOffset,
      });

      setLogs((prev) => append ? [...prev, ...response.logs] : response.logs);
      setOffset(nextOffset + response.logs.length);
      setHasMore(response.logs.length === PAGE_SIZE);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [actionFilter, dateFrom, dateTo, debouncedSearch, resourceFilter, selectedUser]);

  useEffect(() => {
    void loadLogs(0, false);
  }, [loadLogs]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasMore && !loading) {
        void loadLogs(offset, true);
      }
    }, { threshold: 0.1 });

    const target = observerTarget.current;
    if (target) observer.observe(target);
    return () => {
      if (target) observer.unobserve(target);
    };
  }, [hasMore, loadLogs, loading, offset]);

  const uniqueUsers = useMemo(() => {
    const dedupe = new Map<string, string>();
    for (const log of logs) {
      if (!dedupe.has(log.user_id)) {
        dedupe.set(log.user_id, log.user_email || log.user_id);
      }
    }
    return Array.from(dedupe.entries()).map(([id, name]) => ({ id, name }));
  }, [logs]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const csvContent = [
        ['Timestamp', 'User', 'Action', 'Resource Type', 'Resource ID', 'IP Address'],
        ...logs.map(log => [new Date(log.timestamp).toLocaleString(), log.user_email || log.user_id, log.action, log.resource_type, log.resource_id, log.ip_address || 'N/A'])
      ].map((row) => row.join(',')).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const getActionIcon = (action: string) => {
    if (action.includes('member')) return <Users className="h-4 w-4" />;
    if (action.includes('role')) return <Shield className="h-4 w-4" />;
    if (action.includes('settings')) return <Settings className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Team Audit Log"
        description="Track all team activities, permission changes, and security events"
      >
        <div className="p-4 border-b border-border flex justify-end">
          <button onClick={() => void handleExport()} disabled={exporting || logs.length === 0} className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"><Download className="h-4 w-4 mr-2" />{exporting ? 'Exporting...' : 'Export Logs'}</button>
        </div>
        <div className="space-y-4 p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by user, action, or resource..." className="w-full pl-10 pr-4 py-2 border border-border bg-background text-foreground rounded-lg" />
            </div>
            <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="px-3 py-2 border border-border bg-background text-foreground rounded-lg">{ACTION_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select>
            <select value={resourceFilter} onChange={(e) => setResourceFilter(e.target.value)} className="px-3 py-2 border border-border bg-background text-foreground rounded-lg">{RESOURCE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select>
            <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} className="px-3 py-2 border border-border bg-background text-foreground rounded-lg"><option value="all">All Users</option>{uniqueUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1"><label className="block text-xs text-muted-foreground mb-1">From Date</label><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg" /></div>
            <div className="flex-1"><label className="block text-xs text-muted-foreground mb-1">To Date</label><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg" /></div>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="max-h-[600px] overflow-y-auto">
              {error && <div className="px-4 py-3 text-sm text-red-700 bg-red-50 border-b border-red-100">{error}</div>}
              {logs.length === 0 && !loading ? (
                <div className="text-center py-12"><Activity className="h-12 w-12 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">No audit logs found</p></div>
              ) : (
                <div className="divide-y divide-border">
                  {logs.map((log) => (
                    <div key={log.id} className="p-4 hover:bg-accent/40 transition-colors">
                      <div className="flex items-start space-x-3">
                        <div className="mt-0.5 p-2 rounded-lg bg-accent text-accent-foreground">{getActionIcon(log.action)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1"><span className="font-medium text-foreground">{log.user_email || log.user_id}</span><span className="text-muted-foreground">•</span><span className="text-sm px-2 py-0.5 rounded-full bg-accent">{log.action}</span></div>
                          <p className="text-sm text-muted-foreground mb-2">{log.details?.description || `Performed ${log.action} on ${log.resource_type}`}</p>
                          <div className="flex items-center space-x-4 text-xs text-muted-foreground"><span className="flex items-center"><Calendar className="h-3 w-3 mr-1" />{new Date(log.timestamp).toLocaleString()}</span><span>Resource: {log.resource_type}</span>{log.ip_address && <span>IP: {log.ip_address}</span>}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {loading && <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary mr-2" /><span className="text-sm text-muted-foreground">Loading logs...</span></div>}
              <div ref={observerTarget} className="h-4" />
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Showing {logs.length} logs{hasMore && ' (scroll to load more)'}</span>
            {logs.length > 0 && <span>{new Date(logs[logs.length - 1]!.timestamp).toLocaleDateString()} - {new Date(logs[0]!.timestamp).toLocaleDateString()}</span>}
          </div>
        </div>
      </SettingsSection>
    </div>
  );
};
