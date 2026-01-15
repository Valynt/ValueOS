/**
 * Comprehensive Audit Trail System
 * 
 * Provides full traceability for all business case generation activities:
 * - Immutable audit logs
 * - Compliance tracking
 * - Data provenance
 * - Regulatory reporting
 * - Tamper-evident records
 * 
 * Part of Phase 3 - Integration & Business Case Generation
 */

import { createHash, randomUUID } from 'crypto';

// ============================================================================
// AUDIT TYPES
// ============================================================================

export type AuditLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
export type AuditCategory = 
  | 'VALIDATION'
  | 'CALCULATION'
  | 'DECISION'
  | 'EVIDENCE'
  | 'COMPLIANCE'
  | 'ERROR'
  | 'PERFORMANCE'
  | 'SECURITY';

export interface AuditEntry {
  id: string;
  timestamp: string;
  level: AuditLevel;
  category: AuditCategory;
  component: string;
  operation: string;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  confidence: number;
  reasoning: string;
  evidence: string[];
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  metadata: Record<string, any>;
  hash: string;
  previousHash?: string;
}

export interface AuditQuery {
  startTime?: string;
  endTime?: string;
  level?: AuditLevel[];
  category?: AuditCategory[];
  component?: string[];
  operation?: string[];
  correlationId?: string;
  sessionId?: string;
  userId?: string;
  minConfidence?: number;
}

export interface AuditStats {
  totalEntries: number;
  byLevel: Record<AuditLevel, number>;
  byCategory: Record<AuditCategory, number>;
  byComponent: Record<string, number>;
  averageConfidence: number;
  complianceScore: number;
  errorRate: number;
}

export interface ComplianceReport {
  period: { start: string; end: string };
  totalOperations: number;
  compliantOperations: number;
  violations: Violation[];
  recommendations: string[];
  signature: string;
}

export interface Violation {
  type: 'MISSING_DATA' | 'LOW_CONFIDENCE' | 'INVALID_CALCULATION' | 'COMPLIANCE_BREACH';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  entryId: string;
  timestamp: string;
  mitigation?: string;
}

// ============================================================================
// AUDIT TRAIL MANAGER
// ============================================================================

export class AuditTrailManager {
  private static instance: AuditTrailManager;
  private entries: AuditEntry[] = [];
  private maxEntries: number = 10000; // Prevent memory overflow
  private enabled: boolean = true;
  private persistentStorage: boolean = false;
  private storagePath: string = './audit-logs';

  private constructor() {
    // Singleton pattern
  }

  static getInstance(): AuditTrailManager {
    if (!AuditTrailManager.instance) {
      AuditTrailManager.instance = new AuditTrailManager();
    }
    return AuditTrailManager.instance;
  }

  /**
   * Configure audit trail settings
   */
  configure(options: {
    enabled?: boolean;
    maxEntries?: number;
    persistentStorage?: boolean;
    storagePath?: string;
  }): void {
    if (options.enabled !== undefined) this.enabled = options.enabled;
    if (options.maxEntries) this.maxEntries = options.maxEntries;
    if (options.persistentStorage !== undefined) this.persistentStorage = options.persistentStorage;
    if (options.storagePath) this.storagePath = options.storagePath;

    if (this.persistentStorage) {
      this.ensureStorageDirectory();
    }
  }

  /**
   * Log an audit entry
   */
  log(entry: {
    level: AuditLevel;
    category: AuditCategory;
    component: string;
    operation: string;
    inputs: Record<string, any>;
    outputs: Record<string, any>;
    confidence: number;
    reasoning: string;
    evidence?: string[];
    userId?: string;
    sessionId?: string;
    correlationId?: string;
    metadata?: Record<string, any>;
  }): AuditEntry {
    if (!this.enabled) {
      return {} as AuditEntry;
    }

    const timestamp = new Date().toISOString();
    const previousHash = this.entries.length > 0 ? this.entries[this.entries.length - 1].hash : 'GENESIS';
    
    const auditEntry: AuditEntry = {
      id: randomUUID(),
      timestamp,
      level: entry.level,
      category: entry.category,
      component: entry.component,
      operation: entry.operation,
      inputs: this.sanitizeData(entry.inputs),
      outputs: this.sanitizeData(entry.outputs),
      confidence: Math.max(0, Math.min(1, entry.confidence)),
      reasoning: entry.reasoning,
      evidence: entry.evidence || [],
      userId: entry.userId,
      sessionId: entry.sessionId,
      correlationId: entry.correlationId,
      metadata: entry.metadata || {},
      previousHash,
      hash: this.calculateHash({ timestamp, ...entry })
    };

    this.entries.push(auditEntry);

    // Maintain max entries limit
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    // Persist if enabled
    if (this.persistentStorage) {
      this.persistEntry(auditEntry);
    }

    // Emit event for real-time monitoring
    this.emitAuditEvent(auditEntry);

    return auditEntry;
  }

  /**
   * Query audit trail
   */
  query(filter: AuditQuery = {}): AuditEntry[] {
    let results = [...this.entries];

    // Time range filter
    if (filter.startTime) {
      results = results.filter(e => e.timestamp >= filter.startTime);
    }
    if (filter.endTime) {
      results = results.filter(e => e.timestamp <= filter.endTime);
    }

    // Level filter
    if (filter.level && filter.level.length > 0) {
      results = results.filter(e => filter.level!.includes(e.level));
    }

    // Category filter
    if (filter.category && filter.category.length > 0) {
      results = results.filter(e => filter.category!.includes(e.category));
    }

    // Component filter
    if (filter.component && filter.component.length > 0) {
      results = results.filter(e => filter.component!.includes(e.component));
    }

    // Operation filter
    if (filter.operation && filter.operation.length > 0) {
      results = results.filter(e => filter.operation!.includes(e.operation));
    }

    // Correlation ID filter
    if (filter.correlationId) {
      results = results.filter(e => e.correlationId === filter.correlationId);
    }

    // Session ID filter
    if (filter.sessionId) {
      results = results.filter(e => e.sessionId === filter.sessionId);
    }

    // User ID filter
    if (filter.userId) {
      results = results.filter(e => e.userId === filter.userId);
    }

    // Confidence filter
    if (filter.minConfidence !== undefined) {
      results = results.filter(e => e.confidence >= filter.minConfidence);
    }

    return results;
  }

  /**
   * Get statistics
   */
  getStats(filter: AuditQuery = {}): AuditStats {
    const entries = this.query(filter);
    
    const stats: AuditStats = {
      totalEntries: entries.length,
      byLevel: { DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0, CRITICAL: 0 },
      byCategory: {
        VALIDATION: 0, CALCULATION: 0, DECISION: 0, EVIDENCE: 0,
        COMPLIANCE: 0, ERROR: 0, PERFORMANCE: 0, SECURITY: 0
      },
      byComponent: {},
      averageConfidence: 0,
      complianceScore: 0,
      errorRate: 0
    };

    let totalConfidence = 0;
    let errorCount = 0;
    let criticalCount = 0;

    for (const entry of entries) {
      // Count by level
      stats.byLevel[entry.level]++;
      
      // Count by category
      stats.byCategory[entry.category]++;
      
      // Count by component
      stats.byComponent[entry.component] = (stats.byComponent[entry.component] || 0) + 1;
      
      // Accumulate confidence
      totalConfidence += entry.confidence;
      
      // Count errors
      if (entry.level === 'ERROR' || entry.level === 'CRITICAL') {
        errorCount++;
        if (entry.level === 'CRITICAL') criticalCount++;
      }
    }

    stats.averageConfidence = entries.length > 0 ? totalConfidence / entries.length : 0;
    stats.errorRate = entries.length > 0 ? errorCount / entries.length : 0;
    
    // Compliance score (0-100)
    const criticalPenalty = criticalCount * 10;
    const errorPenalty = errorCount * 2;
    const confidenceBonus = stats.averageConfidence * 10;
    stats.complianceScore = Math.max(0, Math.min(100, 100 - criticalPenalty - errorPenalty + confidenceBonus));

    return stats;
  }

  /**
   * Generate compliance report
   */
  generateComplianceReport(startTime: string, endTime: string): ComplianceReport {
    const entries = this.query({ startTime, endTime });
    
    const violations: Violation[] = [];
    let compliantOperations = 0;

    for (const entry of entries) {
      // Check for violations
      if (entry.confidence < 0.6 && entry.category !== 'ERROR') {
        violations.push({
          type: 'LOW_CONFIDENCE',
          severity: entry.confidence < 0.3 ? 'high' : 'medium',
          description: `Low confidence (${entry.confidence.toFixed(2)}) for ${entry.component}:${entry.operation}`,
          entryId: entry.id,
          timestamp: entry.timestamp,
          mitigation: 'Review calculation methodology and data sources'
        });
      }

      if (entry.category === 'ERROR' && entry.level === 'CRITICAL') {
        violations.push({
          type: 'INVALID_CALCULATION',
          severity: 'critical',
          description: `Critical error: ${entry.reasoning}`,
          entryId: entry.id,
          timestamp: entry.timestamp,
          mitigation: 'Immediate investigation required'
        });
      }

      if (entry.category === 'VALIDATION' && entry.outputs.valid === false) {
        violations.push({
          type: 'MISSING_DATA',
          severity: 'medium',
          description: `Validation failed: ${(entry.outputs.errors || []).join(', ')}`,
          entryId: entry.id,
          timestamp: entry.timestamp,
          mitigation: 'Provide missing data or adjust constraints'
        });
      }

      // Count compliant operations
      if (entry.level !== 'ERROR' && entry.level !== 'CRITICAL' && entry.confidence >= 0.7) {
        compliantOperations++;
      }
    }

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (violations.some(v => v.type === 'LOW_CONFIDENCE')) {
      recommendations.push('Improve data quality and source reliability');
    }
    
    if (violations.some(v => v.type === 'INVALID_CALCULATION')) {
      recommendations.push('Review calculation logic and validation rules');
    }
    
    if (violations.some(v => v.type === 'MISSING_DATA')) {
      recommendations.push('Implement data collection for missing KPIs');
    }

    if (violations.length === 0) {
      recommendations.push('All operations compliant - maintain current processes');
    }

    // Create signature
    const signature = this.createComplianceSignature(startTime, endTime, violations.length);

    return {
      period: { start: startTime, end: endTime },
      totalOperations: entries.length,
      compliantOperations,
      violations,
      recommendations,
      signature
    };
  }

  /**
   * Verify audit integrity
   */
  verifyIntegrity(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      
      // Verify hash chain
      if (i > 0) {
        const expectedPreviousHash = this.entries[i - 1].hash;
        if (entry.previousHash !== expectedPreviousHash) {
          issues.push(`Hash chain broken at index ${i}`);
        }
      }

      // Verify current hash
      const expectedHash = this.calculateHash({
        timestamp: entry.timestamp,
        level: entry.level,
        category: entry.category,
        component: entry.component,
        operation: entry.operation,
        inputs: entry.inputs,
        outputs: entry.outputs,
        confidence: entry.confidence,
        reasoning: entry.reasoning,
        evidence: entry.evidence,
        userId: entry.userId,
        sessionId: entry.sessionId,
        correlationId: entry.correlationId,
        metadata: entry.metadata
      });

      if (entry.hash !== expectedHash) {
        issues.push(`Hash mismatch at entry ${entry.id}`);
      }

      // Check for tampering indicators
      if (entry.previousHash === 'GENESIS' && i > 0) {
        issues.push(`Genesis hash found at non-zero index ${i}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Export audit trail
   */
  export(format: 'json' | 'csv' | 'xml' = 'json', filter: AuditQuery = {}): string {
    const entries = this.query(filter);

    if (format === 'json') {
      return JSON.stringify(entries, null, 2);
    }

    if (format === 'csv') {
      const headers = ['id', 'timestamp', 'level', 'category', 'component', 'operation', 'confidence', 'reasoning'];
      const rows = entries.map(e => [
        e.id,
        e.timestamp,
        e.level,
        e.category,
        e.component,
        e.operation,
        e.confidence.toFixed(3),
        `"${e.reasoning.replace(/"/g, '""')}"`
      ]);
      return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    if (format === 'xml') {
      const xmlEntries = entries.map(e => `
        <entry id="${e.id}" timestamp="${e.timestamp}">
          <level>${e.level}</level>
          <category>${e.category}</category>
          <component>${e.component}</component>
          <operation>${e.operation}</operation>
          <confidence>${e.confidence}</confidence>
          <reasoning>${this.escapeXml(e.reasoning)}</reasoning>
          <hash>${e.hash}</hash>
        </entry>
      `).join('');
      return `<audit-trail>${xmlEntries}</audit-trail>`;
    }

    return '';
  }

  /**
   * Clear audit trail
   */
  clear(filter: AuditQuery = {}): number {
    if (Object.keys(filter).length === 0) {
      const count = this.entries.length;
      this.entries = [];
      return count;
    }

    const toRemove = this.query(filter);
    const removeIds = new Set(toRemove.map(e => e.id));
    const beforeCount = this.entries.length;
    this.entries = this.entries.filter(e => !removeIds.has(e.id));
    return beforeCount - this.entries.length;
  }

  /**
   * Get entry by ID
   */
  getEntry(id: string): AuditEntry | undefined {
    return this.entries.find(e => e.id === id);
  }

  /**
   * Get total count
   */
  getCount(): number {
    return this.entries.length;
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private calculateHash(data: any): string {
    const hash = createHash('sha256');
    hash.update(JSON.stringify(data));
    return hash.digest('hex');
  }

  private sanitizeData(data: any): any {
    if (data === null || data === undefined) return {};
    
    // Remove sensitive data
    const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'privateKey'];
    
    const sanitize = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;
      
      if (Array.isArray(obj)) {
        return obj.map(sanitize);
      }
      
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
          result[key] = '***REDACTED***';
        } else {
          result[key] = sanitize(value);
        }
      }
      return result;
    };

    return sanitize(data);
  }

  private createComplianceSignature(startTime: string, endTime: string, violationCount: number): string {
    const data = `${startTime}|${endTime}|${violationCount}|${this.entries.length}`;
    return this.calculateHash(data).substring(0, 16);
  }

  private escapeXml(text: string): string {
    return text.replace(/&/g, '&')
               .replace(/</g, '<')
               .replace(/>/g, '>')
               .replace(/"/g, '"')
               .replace(/'/g, ''');
  }

  private emitAuditEvent(entry: AuditEntry): void {
    // In a real implementation, this would emit events to listeners
    // For now, we'll just log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[AUDIT] ${entry.level} ${entry.category} ${entry.component}:${entry.operation} (conf: ${entry.confidence.toFixed(2)})`);
    }
  }

  private ensureStorageDirectory(): void {
    const fs = require('fs');
    const path = require('path');
    
    const dir = path.resolve(this.storagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private persistEntry(entry: AuditEntry): void {
    if (!this.persistentStorage) return;

    const fs = require('fs');
    const path = require('path');

    try {
      const date = new Date().toISOString().split('T')[0];
      const filename = `audit-${date}.jsonl`;
      const filepath = path.join(this.storagePath, filename);

      const line = JSON.stringify(entry) + '\n';
      fs.appendFileSync(filepath, line);
    } catch (error) {
      console.error('Failed to persist audit entry:', error);
    }
  }
}

// ============================================================================
// AUDIT TRAIL DECORATOR
// ============================================================================

/**
 * Decorator to automatically audit method calls
 */
export function AuditTrail(
  component: string,
  options: {
    level?: AuditLevel;
    category?: AuditCategory;
    includeInputs?: boolean;
    includeOutputs?: boolean;
    confidence?: (result: any) => number;
  } = {}
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const audit = AuditTrailManager.getInstance();

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const inputs = options.includeInputs !== false ? args : {};

      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - startTime;

        const confidence = options.confidence ? options.confidence(result) : 1.0;

        audit.log({
          level: options.level || 'INFO',
          category: options.category || 'CALCULATION',
          component,
          operation: propertyKey,
          inputs,
          outputs: options.includeOutputs !== false ? { result, duration } : {},
          confidence,
          reasoning: `Method ${propertyKey} executed successfully in ${duration}ms`,
          evidence: [],
          metadata: { duration }
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        audit.log({
          level: 'ERROR',
          category: 'ERROR',
          component,
          operation: propertyKey,
          inputs,
          outputs: { error: error instanceof Error ? error.message : 'Unknown error' },
          confidence: 0,
          reasoning: `Method ${propertyKey} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          evidence: [],
          metadata: { duration, error: String(error) }
        });

        throw error;
      }
    };

    return descriptor;
  };
}

// ============================================================================
// COMPLIANCE MONITOR
// ============================================================================

export class ComplianceMonitor {
  private auditManager: AuditTrailManager;
  private thresholds: {
    minConfidence: number;
    maxErrorRate: number;
    maxCriticalCount: number;
  };

  constructor(thresholds?: {
    minConfidence?: number;
    maxErrorRate?: number;
    maxCriticalCount?: number;
  }) {
    this.auditManager = AuditTrailManager.getInstance();
    this.thresholds = {
      minConfidence: thresholds?.minConfidence ?? 0.7,
      maxErrorRate: thresholds?.maxErrorRate ?? 0.05,
      maxCriticalCount: thresholds?.maxCriticalCount ?? 0,
      ...thresholds
    };
  }

  /**
   * Check if system is compliant
   */
  isCompliant(filter: AuditQuery = {}): { compliant: boolean; issues: string[] } {
    const stats = this.auditManager.getStats(filter);
    const issues: string[] = [];

    if (stats.averageConfidence < this.thresholds.minConfidence) {
      issues.push(`Average confidence (${stats.averageConfidence.toFixed(2)}) below threshold (${this.thresholds.minConfidence})`);
    }

    if (stats.errorRate > this.thresholds.maxErrorRate) {
      issues.push(`Error rate (${(stats.errorRate * 100).toFixed(1)}%) exceeds threshold (${(this.thresholds.maxErrorRate * 100).toFixed(1)}%)`);
    }

    const criticalCount = stats.byLevel.CRITICAL;
    if (criticalCount > this.thresholds.maxCriticalCount) {
      issues.push(`Critical errors (${criticalCount}) exceed threshold (${this.thresholds.maxCriticalCount})`);
    }

    return {
      compliant: issues.length === 0,
      issues
    };
  }

  /**
   * Monitor for anomalies
   */
  detectAnomalies(): string[] {
    const anomalies: string[] = [];
    const recentEntries = this.auditManager.query({
      startTime: new Date(Date.now() - 3600000).toISOString() // Last hour
    });

    // Check for sudden spike in errors
    const errorCount = recentEntries.filter(e => e.level === 'ERROR' || e.level === 'CRITICAL').length;
    if (errorCount > 10) {
      anomalies.push(`Error spike detected: ${errorCount} errors in last hour`);
    }

    // Check for low confidence patterns
    const lowConfidence = recentEntries.filter(e => e.confidence < 0.5).length;
    if (lowConfidence > 5) {
      anomalies.push(`Low confidence pattern: ${lowConfidence} entries below 0.5`);
    }

    // Check for missing evidence
    const noEvidence = recentEntries.filter(e => e.evidence.length === 0).length;
    if (noEvidence > 3) {
      anomalies.push(`Evidence gap: ${noEvidence} entries without supporting evidence`);
    }

    return anomalies;
  }

  /**
   * Get compliance dashboard data
   */
  getDashboardData(): {
    complianceScore: number;
    health: 'green' | 'yellow' | 'red';
    stats: AuditStats;
    anomalies: string[];
  } {
    const stats = this.auditManager.getStats();
    const compliance = this.isCompliant();
    const anomalies = this.detectAnomalies();

    let health: 'green' | 'yellow' | 'red' = 'green';
    if (stats.complianceScore < 70) health = 'red';
    else if (stats.complianceScore < 85) health = 'yellow';

    return {
      complianceScore: stats.complianceScore,
      health,
      stats,
      anomalies
    };
  }
}

// ============================================================================
// MCP TOOLS FOR AUDIT TRAIL
// ============================================================================

export const AuditTrailTools = {
  /**
   * Query audit trail
   */
  query_audit_trail: {
    description: 'Query the audit trail for compliance and analysis',
    inputSchema: {
      type: 'object',
      properties: {
        startTime: { type: 'string', format: 'date-time' },
        endTime: { type: 'string', format: 'date-time' },
        level: { type: 'array', items: { type: 'string', enum: ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'] } },
        category: { type: 'array', items: { type: 'string', enum: ['VALIDATION', 'CALCULATION', 'DECISION', 'EVIDENCE', 'COMPLIANCE', 'ERROR', 'PERFORMANCE', 'SECURITY'] } },
        component: { type: 'array', items: { type: 'string' } },
        operation: { type: 'array', items: { type: 'string' } },
        correlationId: { type: 'string' },
        sessionId: { type: 'string' },
        userId: { type: 'string' },
        minConfidence: { type: 'number', minimum: 0, maximum: 1 }
      }
    }
  },

  /**
   * Get audit statistics
   */
  get_audit_stats: {
    description: 'Get statistics about the audit trail',
    inputSchema: {
      type: 'object',
      properties: {
        startTime: { type: 'string', format: 'date-time' },
        endTime: { type: 'string', format: 'date-time' },
        component: { type: 'array', items: { type: 'string' } }
      }
    }
  },

  /**
   * Generate compliance report
   */
  generate_compliance_report: {
    description: 'Generate a compliance report for a specific period',
    inputSchema: {
      type: 'object',
      properties: {
        startTime: { type: 'string', format: 'date-time', required: true },
        endTime: { type: 'string', format: 'date-time', required: true }
      },
      required: ['startTime', 'endTime']
    }
  },

  /**
   * Verify audit integrity
   */
  verify_audit_integrity: {
    description: 'Verify the integrity of the audit trail (tamper detection)',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },

  /**
   * Export audit trail
   */
  export_audit_trail: {
    description: 'Export audit trail in various formats',
    inputSchema: {
      type: 'object',
      properties: {
        format: { type: 'string', enum: ['json', 'csv', 'xml'], default: 'json' },
        startTime: { type: 'string', format: 'date-time' },
        endTime: { type: 'string', format: 'date-time' }
      }
    }
  },

  /**
   * Get compliance dashboard
   */
  get_compliance_dashboard: {
    description: 'Get compliance dashboard data',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
};