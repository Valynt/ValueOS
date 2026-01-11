/**
 * VOS-SUPER-003: Audit Trail Dashboard - Custom Hook
 * Manages audit trail data fetching, real-time updates, and filtering
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AuditEvent, AuditFilter, AuditStatistics, IntegrityVerification, RealTimeConfig } from '../types/audit';
import { auditLogService } from '../services/AuditLogService';
import { secureMessageBus } from '../lib/agent-fabric/SecureMessageBus';
import { EnhancedAuditLogger } from '../lib/audit/EnhancedAuditLogger';

interface UseAuditTrailReturn {
  events: AuditEvent[];
  filteredEvents: AuditEvent[];
  statistics: AuditStatistics;
  integrity: IntegrityVerification;
  loading: boolean;
  error: string | null;
  realTimeConfig: RealTimeConfig;
  applyFilters: (filters: AuditFilter) => void;
  exportData: (format: 'csv' | 'json', includeMetadata?: boolean) => Promise<Blob>;
  verifyIntegrity: () => Promise<IntegrityVerification>;
  toggleRealTime: (enabled: boolean) => void;
  clearError: () => void;
}

export const useAuditTrail = (): UseAuditTrailReturn => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<AuditEvent[]>([]);
  const [statistics, setStatistics] = useState<AuditStatistics>({
    totalEvents: 0,
    criticalEvents: 0,
    warningEvents: 0,
    complianceEvents: 0,
    integrityFailures: 0,
    eventsPerHour: 0,
    uniqueUsers: 0,
    uniqueAgents: 0,
    complianceScore: 100,
  });
  const [integrity, setIntegrity] = useState<IntegrityVerification>({
    hashChainValid: true,
    tamperedEvents: [],
    verificationErrors: [],
    lastVerified: new Date().toISOString(),
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realTimeConfig, setRealTimeConfig] = useState<RealTimeConfig>({
    enabled: true,
    updateInterval: 5000,
    maxBufferSize: 1000,
    pauseOnInactive: true,
  });

  const [filters, setFilters] = useState<AuditFilter>({});
  const bufferRef = useRef<AuditEvent[]>([]);
  const subscriptionRef = useRef<any>(null);
  const lastUpdateRef = useRef<number>(Date.now());

  // Load initial audit events
  useEffect(() => {
    loadInitialEvents();
    setupRealTimeSubscription();

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, []);

  // Apply filters when they change
  useEffect(() => {
    applyFilters(filters);
  }, [events, filters]);

  // Flush buffer periodically
  useEffect(() => {
    if (!realTimeConfig.enabled) return;

    const interval = setInterval(() => {
      flushBuffer();
    }, realTimeConfig.updateInterval);

    return () => clearInterval(interval);
  }, [realTimeConfig.enabled, realTimeConfig.updateInterval]);

  const loadInitialEvents = async () => {
    try {
      setLoading(true);
      
      // Load from audit log service
      const logs = await auditLogService.query({
        limit: 1000,
        orderBy: 'timestamp_desc',
      });

      const auditEvents: AuditEvent[] = logs.map(log => ({
        id: log.id,
        timestamp: log.timestamp,
        userId: log.userId,
        userName: log.metadata?.userName,
        agentId: log.metadata?.agentId,
        agentName: log.metadata?.agentName,
        action: log.action,
        actionType: log.metadata?.actionType || 'agent_action',
        severity: log.metadata?.severity || 'info',
        resource: log.metadata?.resource,
        metadata: log.metadata,
        ipAddress: log.metadata?.ipAddress,
        sessionId: log.metadata?.sessionId,
        integrityHash: log.integrityHash,
        previousHash: log.previousHash,
        verificationStatus: log.verificationStatus || 'verified',
      }));

      setEvents(auditEvents);
      calculateStatistics(auditEvents);
      await verifyIntegrity();
      setError(null);
    } catch (err) {
      setError(`Failed to load audit events: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const setupRealTimeSubscription = () => {
    try {
      // Subscribe to secure message bus for real-time audit events
      subscriptionRef.current = secureMessageBus.subscribe(
        'audit_events',
        (message: any) => {
          if (!realTimeConfig.enabled) return;

          const event: AuditEvent = {
            id: message.id || `rt-${Date.now()}`,
            timestamp: message.timestamp || new Date().toISOString(),
            userId: message.userId,
            userName: message.userName,
            agentId: message.agentId,
            agentName: message.agentName,
            action: message.action,
            actionType: message.actionType || 'agent_action',
            severity: message.severity || 'info',
            resource: message.resource,
            metadata: message.metadata,
            ipAddress: message.ipAddress,
            sessionId: message.sessionId,
            integrityHash: message.integrityHash || '',
            previousHash: message.previousHash,
            verificationStatus: message.verificationStatus || 'verified',
          };

          // Add to buffer
          bufferRef.current.push(event);
          
          // Limit buffer size
          if (bufferRef.current.length > realTimeConfig.maxBufferSize) {
            bufferRef.current = bufferRef.current.slice(-realTimeConfig.maxBufferSize);
          }

          // Update statistics immediately for real-time feel
          setStatistics(prev => ({
            ...prev,
            totalEvents: prev.totalEvents + 1,
            eventsPerHour: prev.eventsPerHour + 1,
          }));
        }
      );
    } catch (err) {
      console.warn('Real-time subscription failed:', err);
    }
  };

  const flushBuffer = useCallback(() => {
    if (bufferRef.current.length === 0) return;

    const newEvents = [...bufferRef.current];
    bufferRef.current = [];

    setEvents(prev => {
      const updated = [...newEvents, ...prev].slice(0, realTimeConfig.maxBufferSize);
      calculateStatistics(updated);
      return updated;
    });

    lastUpdateRef.current = Date.now();
  }, [realTimeConfig.maxBufferSize]);

  const calculateStatistics = (auditEvents: AuditEvent[]) => {
    const total = auditEvents.length;
    const critical = auditEvents.filter(e => e.severity === 'critical').length;
    const warning = auditEvents.filter(e => e.severity === 'warning').length;
    const compliance = auditEvents.filter(e => e.severity === 'compliance').length;
    const integrityFailures = auditEvents.filter(e => e.verificationStatus === 'failed').length;

    const uniqueUsers = new Set(auditEvents.map(e => e.userId).filter(Boolean)).size;
    const uniqueAgents = new Set(auditEvents.map(e => e.agentId).filter(Boolean)).size;

    // Calculate compliance score (100 - penalty points)
    let score = 100;
    if (integrityFailures > 0) score -= 20;
    if (critical > 0) score -= Math.min(critical * 5, 30);
    if (warning > 0) score -= Math.min(warning * 2, 15);
    score = Math.max(0, score);

    // Events per hour (based on last hour)
    const oneHourAgo = Date.now() - 3600000;
    const recentEvents = auditEvents.filter(e => new Date(e.timestamp).getTime() > oneHourAgo);
    const eventsPerHour = recentEvents.length;

    setStatistics({
      totalEvents: total,
      criticalEvents: critical,
      warningEvents: warning,
      complianceEvents: compliance,
      integrityFailures,
      eventsPerHour,
      uniqueUsers,
      uniqueAgents,
      complianceScore: score,
    });
  };

  const applyFilters = useCallback((filterParams: AuditFilter) => {
    setFilters(filterParams);
    
    let filtered = [...events];

    // Date range filter
    if (filterParams.dateRange) {
      const start = filterParams.dateRange.start.getTime();
      const end = filterParams.dateRange.end.getTime();
      filtered = filtered.filter(e => {
        const time = new Date(e.timestamp).getTime();
        return time >= start && time <= end;
      });
    }

    // User ID filter
    if (filterParams.userId) {
      filtered = filtered.filter(e => 
        e.userId?.toLowerCase().includes(filterParams.userId!.toLowerCase())
      );
    }

    // Agent ID filter
    if (filterParams.agentId) {
      filtered = filtered.filter(e => 
        e.agentId?.toLowerCase().includes(filterParams.agentId!.toLowerCase())
      );
    }

    // Action type filter
    if (filterParams.actionType) {
      filtered = filtered.filter(e => e.actionType === filterParams.actionType);
    }

    // Severity filter
    if (filterParams.severity) {
      filtered = filtered.filter(e => e.severity === filterParams.severity);
    }

    // Session ID filter
    if (filterParams.sessionId) {
      filtered = filtered.filter(e => 
        e.sessionId?.toLowerCase().includes(filterParams.sessionId!.toLowerCase())
      );
    }

    // Search query filter
    if (filterParams.searchQuery) {
      const query = filterParams.searchQuery.toLowerCase();
      filtered = filtered.filter(e => 
        e.action.toLowerCase().includes(query) ||
        e.userName?.toLowerCase().includes(query) ||
        e.agentName?.toLowerCase().includes(query) ||
        e.resource?.toLowerCase().includes(query) ||
        JSON.stringify(e.metadata).toLowerCase().includes(query)
      );
    }

    setFilteredEvents(filtered);
  }, [events]);

  const exportData = useCallback(async (format: 'csv' | 'json', includeMetadata: boolean = true): Promise<Blob> => {
    try {
      // Log export activity for audit purposes
      const logger = new EnhancedAuditLogger();
      logger.log({
        action: 'audit_export',
        userId: 'current_user', // Would be from auth context
        metadata: {
          format,
          includeMetadata,
          filterCount: filteredEvents.length,
          filters,
        },
        severity: 'info',
        actionType: 'compliance_check',
      });

      if (format === 'json') {
        const data = JSON.stringify(
          filteredEvents.map(e => ({
            ...e,
            metadata: includeMetadata ? e.metadata : undefined,
          })),
          null,
          2
        );
        return new Blob([data], { type: 'application/json' });
      } else {
        // CSV export
        const headers = [
          'Timestamp',
          'User ID',
          'User Name',
          'Agent ID',
          'Agent Name',
          'Action',
          'Action Type',
          'Severity',
          'Resource',
          'Session ID',
          'Integrity Status',
        ];

        const rows = filteredEvents.map(e => [
          e.timestamp,
          e.userId || '',
          e.userName || '',
          e.agentId || '',
          e.agentName || '',
          e.action,
          e.actionType,
          e.severity,
          e.resource || '',
          e.sessionId || '',
          e.verificationStatus,
          includeMetadata && e.metadata ? JSON.stringify(e.metadata) : '',
        ]);

        const csv = [
          headers.join(','),
          ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
        ].join('\n');

        return new Blob([csv], { type: 'text/csv' });
      }
    } catch (err) {
      throw new Error(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [filteredEvents, filters]);

  const verifyIntegrity = useCallback(async (): Promise<IntegrityVerification> => {
    try {
      const verification: IntegrityVerification = {
        hashChainValid: true,
        tamperedEvents: [],
        verificationErrors: [],
        lastVerified: new Date().toISOString(),
      };

      // Verify hash chain
      for (let i = 1; i < events.length; i++) {
        const current = events[i];
        const previous = events[i - 1];

        if (current.previousHash && current.previousHash !== previous.integrityHash) {
          verification.hashChainValid = false;
          verification.tamperedEvents.push(current.id);
          verification.verificationErrors.push(
            `Hash mismatch at event ${current.id}: expected ${previous.integrityHash}, got ${current.previousHash}`
          );
        }

        if (current.verificationStatus === 'failed') {
          verification.hashChainValid = false;
          verification.tamperedEvents.push(current.id);
        }
      }

      setIntegrity(verification);
      return verification;
    } catch (err) {
      const error: IntegrityVerification = {
        hashChainValid: false,
        tamperedEvents: [],
        verificationErrors: [`Verification failed: ${err instanceof Error ? err.message : 'Unknown error'}`],
        lastVerified: new Date().toISOString(),
      };
      setIntegrity(error);
      return error;
    }
  }, [events]);

  const toggleRealTime = useCallback((enabled: boolean) => {
    setRealTimeConfig(prev => ({ ...prev, enabled }));
    
    if (!enabled) {
      // Flush any remaining buffer
      flushBuffer();
    }
  }, [flushBuffer]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
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
  };
};