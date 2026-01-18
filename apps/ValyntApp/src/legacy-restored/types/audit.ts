/**
 * VOS-SUPER-003: Audit Trail Dashboard - Type Definitions
 * Types for audit trail functionality
 */

export interface AuditEvent {
  id: string;
  timestamp: string;
  userId: string;
  userName?: string;
  agentId?: string;
  agentName?: string;
  action: string;
  actionType: 'agent_action' | 'security_event' | 'system_event' | 'compliance_check';
  severity: 'info' | 'warning' | 'critical' | 'compliance';
  resource?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  sessionId?: string;
  integrityHash: string;
  previousHash?: string;
  verificationStatus: 'verified' | 'failed' | 'pending';
}

export interface AuditFilter {
  dateRange?: {
    start: Date;
    end: Date;
  };
  userId?: string;
  agentId?: string;
  actionType?: string;
  severity?: string;
  sessionId?: string;
  searchQuery?: string;
}

export interface AuditStatistics {
  totalEvents: number;
  criticalEvents: number;
  warningEvents: number;
  complianceEvents: number;
  integrityFailures: number;
  eventsPerHour: number;
  uniqueUsers: number;
  uniqueAgents: number;
  complianceScore: number;
}

export interface ExportFormat {
  format: 'csv' | 'json';
  includeMetadata: boolean;
  dateRange: {
    start: Date;
    end: Date;
  };
  filters: AuditFilter;
}

export interface IntegrityVerification {
  hashChainValid: boolean;
  tamperedEvents: string[];
  verificationErrors: string[];
  lastVerified: string;
}

export interface RealTimeConfig {
  enabled: boolean;
  updateInterval: number; // ms
  maxBufferSize: number;
  pauseOnInactive: boolean;
}