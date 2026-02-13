/**
 * VOS-SUPER-001: Agent Activity Monitor (Real-time)
 * Real-time monitoring dashboard for agent activities with WebSocket integration
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  Clock, 
  CheckCircle, 
  XCircle, 
  TrendingUp,
  RefreshCw,
  Play,
  Pause,
  Search
} from 'lucide-react';
import AgentBadge from '../components/Agents/AgentBadge';
import { auditLogService } from '@backend/services/AuditLogService';

// ============================================================================
// Types
// ============================================================================

export interface AgentActivity {
  id: string;
  agentId: string;
  agentName: string;
  agentRole: string;
  action: string;
  status: 'running' | 'completed' | 'failed' | 'pending';
  timestamp: string;
  duration?: number;
  metadata?: Record<string, any>;
  confidence?: number;
  cost?: number;
}

export interface ActivityFilter {
  agentRole?: string;
  status?: string;
  timeRange?: '5m' | '15m' | '1h' | '24h' | 'all';
  searchQuery?: string;
}

// ============================================================================
// Components
// ============================================================================

const ActivityCard: React.FC<{ activity: AgentActivity }> = ({ activity }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-blue-500 bg-blue-50 border-blue-200';
      case 'completed': return 'text-green-600 bg-green-50 border-green-200';
      case 'failed': return 'text-red-600 bg-red-50 border-red-200';
      case 'pending': return 'text-amber-600 bg-amber-50 border-amber-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'failed': return <XCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  return (
    <div className={`p-4 rounded-lg border ${getStatusColor(activity.status)} mb-3 transition-all hover:shadow-md`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <AgentBadge agentId={activity.agentId} size="sm" showName={false} />
          <span className="font-semibold text-sm">{activity.agentName}</span>
          <span className="text-xs px-2 py-0.5 bg-white/50 rounded">{activity.agentRole}</span>
        </div>
        <div className="flex items-center gap-2">
          {getStatusIcon(activity.status)}
          <span className="text-xs font-medium uppercase">{activity.status}</span>
        </div>
      </div>
      
      <div className="text-sm mb-2">{activity.action}</div>
      
      <div className="flex items-center gap-3 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {new Date(activity.timestamp).toLocaleTimeString()}
        </span>
        {activity.duration && (
          <span className="flex items-center gap-1">
            <Activity className="w-3 h-3" />
            {activity.duration}ms
          </span>
        )}
        {activity.cost !== undefined && (
          <span className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            ${activity.cost.toFixed(2)}
          </span>
        )}
        {activity.confidence !== undefined && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            {Math.round(activity.confidence)}%
          </span>
        )}
      </div>

      {activity.metadata && Object.keys(activity.metadata).length > 0 && (
        <div className="mt-2 p-2 bg-white/30 rounded text-xs">
          <pre className="whitespace-pre-wrap font-mono">
            {JSON.stringify(activity.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

const FilterPanel: React.FC<{
  filters: ActivityFilter;
  onFilterChange: (filters: ActivityFilter) => void;
  availableRoles: string[];
}> = ({ filters, onFilterChange, availableRoles }) => {
  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Agent Role Filter */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">
            Agent Role
          </label>
          <select
            value={filters.agentRole || ''}
            onChange={(e) => onFilterChange({ 
              ...filters, 
              agentRole: e.target.value || undefined 
            })}
            className="w-full px-3 py-2 text-sm border border-border rounded bg-background"
          >
            <option value="">All Roles</option>
            {availableRoles.map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">
            Status
          </label>
          <select
            value={filters.status || ''}
            onChange={(e) => onFilterChange({ 
              ...filters, 
              status: e.target.value || undefined 
            })}
            className="w-full px-3 py-2 text-sm border border-border rounded bg-background"
          >
            <option value="">All Status</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        {/* Time Range */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">
            Time Range
          </label>
          <select
            value={filters.timeRange || 'all'}
            onChange={(e) => onFilterChange({ 
              ...filters, 
              timeRange: e.target.value as ActivityFilter['timeRange']
            })}
            className="w-full px-3 py-2 text-sm border border-border rounded bg-background"
          >
            <option value="5m">Last 5 minutes</option>
            <option value="15m">Last 15 minutes</option>
            <option value="1h">Last 1 hour</option>
            <option value="24h">Last 24 hours</option>
            <option value="all">All time</option>
          </select>
        </div>

        {/* Search */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search activities..."
              value={filters.searchQuery || ''}
              onChange={(e) => onFilterChange({ 
                ...filters, 
                searchQuery: e.target.value 
              })}
              className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded bg-background"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const RealTimeIndicator: React.FC<{ isLive: boolean }> = ({ isLive }) => {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background border border-border">
      <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
      <span className="text-xs font-medium">
        {isLive ? 'LIVE' : 'PAUSED'}
      </span>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const AgentActivityMonitor: React.FC = () => {
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<AgentActivity[]>([]);
  const [filters, setFilters] = useState<ActivityFilter>({ timeRange: '15m' });
  const [isLive, setIsLive] = useState(true);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    running: 0,
    completed: 0,
    failed: 0,
    avgDuration: 0,
    totalCost: 0,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const activityBufferRef = useRef<AgentActivity[]>([]);
  const lastUpdateRef = useRef<number>(Date.now());

  // Load historical activities on mount
  useEffect(() => {
    loadHistoricalActivities();
    setupRealTimeConnection();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Apply filters whenever activities or filters change
  useEffect(() => {
    applyFilters();
    updateStats();
  }, [activities, filters]);

  // Periodic buffer flush for real-time updates
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      flushActivityBuffer();
    }, 1000);

    return () => clearInterval(interval);
  }, [isLive]);

  const loadHistoricalActivities = async () => {
    try {
      // Load from audit logs
      const logs = await auditLogService.query({
        limit: 100,
        action: 'agent%',
      });

      const historicalActivities: AgentActivity[] = logs.map((log, index) => ({
        id: `hist-${index}`,
        agentId: log.userId || 'unknown',
        agentName: log.metadata?.agentName || 'Agent',
        agentRole: log.metadata?.agentRole || 'Unknown',
        action: log.action,
        status: log.metadata?.status || 'completed',
        timestamp: log.timestamp,
        duration: log.metadata?.duration,
        metadata: log.metadata,
        confidence: log.metadata?.confidence,
        cost: log.metadata?.cost,
      }));

      setActivities(historicalActivities);
    } catch (error) {
      console.error('Failed to load historical activities:', error);
    }
  };

  const setupRealTimeConnection = () => {
    // In production, this would connect to a WebSocket server
    // For now, we'll simulate real-time updates
    
    // Subscribe to secure message bus for real-time agent events
    try {
      // This would be the actual WebSocket connection
      // wsRef.current = new WebSocket('wss://api.valueos.com/agent-activity');
      
      // Simulate real-time updates for demo
      const simulateInterval = setInterval(() => {
        if (!isLive) return;
        
        const mockActivity = generateMockActivity();
        activityBufferRef.current.push(mockActivity);
      }, 2000);

      return () => clearInterval(simulateInterval);
    } catch (error) {
      console.error('WebSocket connection failed:', error);
    }
  };

  const flushActivityBuffer = () => {
    if (activityBufferRef.current.length === 0) return;

    const newActivities = [...activityBufferRef.current];
    activityBufferRef.current = [];

    setActivities(prev => [...newActivities, ...prev].slice(0, 200)); // Keep last 200
    lastUpdateRef.current = Date.now();
  };

  const generateMockActivity = (): AgentActivity => {
    const roles = ['CoordinatorAgent', 'OpportunityAgent', 'TargetAgent', 'RealizationAgent', 'IntegrityAgent'];
    const actions = [
      'Analyzing opportunity data',
      'Generating value hypothesis',
      'Executing workflow',
      'Validating ROI calculations',
      'Syncing CRM data',
      'Running LLM inference',
      'Creating audit trail',
    ];
    const statuses = ['running', 'completed', 'failed', 'pending'];

    const role = roles[Math.floor(Math.random() * roles.length)];
    const action = actions[Math.floor(Math.random() * actions.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];

    return {
      id: `live-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      agentId: `agent-${Math.random().toString(36).substr(2, 8)}`,
      agentName: role.replace('Agent', ''),
      agentRole: role,
      action,
      status,
      timestamp: new Date().toISOString(),
      duration: status === 'completed' ? Math.floor(Math.random() * 5000) + 500 : undefined,
      confidence: status === 'completed' ? Math.random() * 0.3 + 0.7 : undefined,
      cost: status === 'completed' ? Math.random() * 0.5 : undefined,
      metadata: {
        sessionId: `sess-${Math.random().toString(36).substr(2, 9)}`,
        model: 'gpt-4-turbo',
        tokens: Math.floor(Math.random() * 1000),
      },
    };
  };

  const applyFilters = () => {
    let filtered = [...activities];

    // Time range filter
    if (filters.timeRange && filters.timeRange !== 'all') {
      const now = Date.now();
      const ranges = {
        '5m': 5 * 60 * 1000,
        '15m': 15 * 60 * 1000,
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
      };
      const cutoff = now - ranges[filters.timeRange];
      filtered = filtered.filter(a => new Date(a.timestamp).getTime() > cutoff);
    }

    // Agent role filter
    if (filters.agentRole) {
      filtered = filtered.filter(a => a.agentRole === filters.agentRole);
    }

    // Status filter
    if (filters.status) {
      filtered = filtered.filter(a => a.status === filters.status);
    }

    // Search filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(a => 
        a.action.toLowerCase().includes(query) ||
        a.agentName.toLowerCase().includes(query) ||
        a.agentRole.toLowerCase().includes(query)
      );
    }

    setFilteredActivities(filtered);
  };

  const updateStats = () => {
    const total = filteredActivities.length;
    const running = filteredActivities.filter(a => a.status === 'running').length;
    const completed = filteredActivities.filter(a => a.status === 'completed').length;
    const failed = filteredActivities.filter(a => a.status === 'failed').length;
    const avgDuration = filteredActivities
      .filter(a => a.duration)
      .reduce((acc, a, _, arr) => acc + (a.duration || 0) / arr.length, 0);
    const totalCost = filteredActivities
      .filter(a => a.cost)
      .reduce((acc, a) => acc + (a.cost || 0), 0);

    setStats({ total, running, completed, failed, avgDuration, totalCost });

    // Update available roles
    const roles = Array.from(new Set(activities.map(a => a.agentRole)));
    setAvailableRoles(roles);
  };

  const toggleLive = () => {
    setIsLive(!isLive);
  };

  const clearActivities = () => {
    setActivities([]);
    setFilteredActivities([]);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="h-14 border-b border-border px-6 flex items-center justify-between bg-card">
        <div className="flex items-center gap-4">
          <Activity className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold">Agent Activity Monitor</h1>
          <RealTimeIndicator isLive={isLive} />
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={toggleLive}
            className="px-3 py-1.5 text-sm border border-border rounded hover:bg-secondary flex items-center gap-2"
          >
            {isLive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isLive ? 'Pause' : 'Resume'}
          </button>
          <button
            onClick={clearActivities}
            className="px-3 py-1.5 text-sm border border-border rounded hover:bg-secondary flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Clear
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="px-6 py-3 bg-secondary/50 border-b border-border">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="bg-card border border-border rounded p-2">
            <div className="text-xs text-muted-foreground">Total Activities</div>
            <div className="text-xl font-bold">{stats.total}</div>
          </div>
          <div className="bg-card border border-border rounded p-2">
            <div className="text-xs text-muted-foreground">Running</div>
            <div className="text-xl font-bold text-blue-600">{stats.running}</div>
          </div>
          <div className="bg-card border border-border rounded p-2">
            <div className="text-xs text-muted-foreground">Completed</div>
            <div className="text-xl font-bold text-green-600">{stats.completed}</div>
          </div>
          <div className="bg-card border border-border rounded p-2">
            <div className="text-xs text-muted-foreground">Failed</div>
            <div className="text-xl font-bold text-red-600">{stats.failed}</div>
          </div>
          <div className="bg-card border border-border rounded p-2">
            <div className="text-xs text-muted-foreground">Avg Duration</div>
            <div className="text-xl font-bold">{Math.round(stats.avgDuration)}ms</div>
          </div>
          <div className="bg-card border border-border rounded p-2">
            <div className="text-xs text-muted-foreground">Total Cost</div>
            <div className="text-xl font-bold">${stats.totalCost.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-4">
        <FilterPanel
          filters={filters}
          onFilterChange={setFilters}
          availableRoles={availableRoles}
        />
      </div>

      {/* Activity Feed */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {filteredActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Activity className="w-12 h-12 mb-4 opacity-50" />
            <p>No activities found</p>
            <p className="text-sm mt-2">Adjust filters or wait for real-time updates</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredActivities.map(activity => (
              <ActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentActivityMonitor;