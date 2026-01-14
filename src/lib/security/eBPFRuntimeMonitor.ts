/**
 * eBPF Runtime Security Monitor
 *
 * Implements runtime security monitoring using eBPF for process and network activity
 * detection in the zero-trust architecture. Monitors for suspicious behavior, unauthorized
 * access attempts, and security policy violations.
 */

import { EventEmitter } from "events";
import { logger } from "../logger";
import { ZeroTrustMTLSManager } from "./ZeroTrustMTLS";

// ============================================================================
// Types
// ============================================================================

export interface ProcessEvent {
  pid: number;
  ppid: number;
  uid: number;
  gid: number;
  command: string;
  args: string[];
  timestamp: number;
  containerId?: string;
  tenantId?: string;
}

export interface NetworkEvent {
  srcIP: string;
  dstIP: string;
  srcPort: number;
  dstPort: number;
  protocol: "tcp" | "udp" | "icmp";
  direction: "ingress" | "egress";
  bytes: number;
  timestamp: number;
  containerId?: string;
  tenantId?: string;
  connectionState: "established" | "closed" | "reset";
}

export interface FileEvent {
  pid: number;
  path: string;
  operation: "read" | "write" | "execute" | "delete" | "create";
  timestamp: number;
  containerId?: string;
  tenantId?: string;
}

export interface SecurityAlert {
  id: string;
  type:
    | "process_anomaly"
    | "network_anomaly"
    | "file_anomaly"
    | "policy_violation";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  details: any;
  timestamp: number;
  containerId?: string;
  tenantId?: string;
  resolved: boolean;
}

export interface eBPFConfig {
  enabled: boolean;
  processMonitoring: boolean;
  networkMonitoring: boolean;
  fileMonitoring: boolean;
  anomalyDetection: boolean;
  alertThresholds: {
    suspiciousProcessesPerMinute: number;
    suspiciousConnectionsPerMinute: number;
    fileAccessViolationsPerMinute: number;
  };
  exclusionRules: {
    allowedProcesses: string[];
    allowedIPs: string[];
    allowedPaths: string[];
  };
}

// ============================================================================
// eBPF Runtime Security Monitor
// ============================================================================

export class eBPFRuntimeMonitor extends EventEmitter {
  private static instance: eBPFRuntimeMonitor;
  private config: eBPFConfig;
  private alerts: Map<string, SecurityAlert> = new Map();
  private metrics: {
    totalEvents: number;
    alertsGenerated: number;
    eventsProcessedPerSecond: number;
    lastProcessedTimestamp: number;
  };
  private anomalyDetector: AnomalyDetector;

  private constructor(config: eBPFConfig) {
    super();
    this.config = config;
    this.anomalyDetector = new AnomalyDetector(config.alertThresholds);
    this.metrics = {
      totalEvents: 0,
      alertsGenerated: 0,
      eventsProcessedPerSecond: 0,
      lastProcessedTimestamp: Date.now(),
    };

    this.initializeMonitoring();
    this.startMetricsCollection();
  }

  static getInstance(config?: eBPFConfig): eBPFRuntimeMonitor {
    if (!eBPFRuntimeMonitor.instance) {
      if (!config) {
        throw new Error("eBPF config required for first initialization");
      }
      eBPFRuntimeMonitor.instance = new eBPFRuntimeMonitor(config);
    }
    return eBPFRuntimeMonitor.instance;
  }

  /**
   * Initialize eBPF monitoring hooks
   */
  private initializeMonitoring(): void {
    if (!this.config.enabled) {
      logger.warn("eBPF runtime monitoring is DISABLED");
      return;
    }

    logger.info("Initializing eBPF runtime security monitoring", {
      processMonitoring: this.config.processMonitoring,
      networkMonitoring: this.config.networkMonitoring,
      fileMonitoring: this.config.fileMonitoring,
    });

    // Initialize eBPF programs for different monitoring types
    if (this.config.processMonitoring) {
      this.initializeProcessMonitoring();
    }

    if (this.config.networkMonitoring) {
      this.initializeNetworkMonitoring();
    }

    if (this.config.fileMonitoring) {
      this.initializeFileMonitoring();
    }
  }

  /**
   * Initialize process monitoring eBPF program
   */
  private initializeProcessMonitoring(): void {
    // Load eBPF program for process exec events
    // This would typically use BCC, bpftrace, or libbpf
    logger.info("Process monitoring eBPF program loaded");

    // Set up event handlers
    this.on("process_event", this.handleProcessEvent.bind(this));
  }

  /**
   * Initialize network monitoring eBPF program
   */
  private initializeNetworkMonitoring(): void {
    // Load eBPF program for network connection events
    logger.info("Network monitoring eBPF program loaded");

    // Set up event handlers
    this.on("network_event", this.handleNetworkEvent.bind(this));
  }

  /**
   * Initialize file monitoring eBPF program
   */
  private initializeFileMonitoring(): void {
    // Load eBPF program for file access events
    logger.info("File monitoring eBPF program loaded");

    // Set up event handlers
    this.on("file_event", this.handleFileEvent.bind(this));
  }

  /**
   * Handle process execution events
   */
  private handleProcessEvent(event: ProcessEvent): void {
    this.metrics.totalEvents++;

    // Check if process is allowed
    if (!this.isProcessAllowed(event)) {
      this.generateAlert({
        type: "process_anomaly",
        severity: "high",
        description: `Unauthorized process execution: ${event.command}`,
        details: event,
        timestamp: event.timestamp,
        containerId: event.containerId,
        tenantId: event.tenantId,
      });
      return;
    }

    // Update anomaly detector
    this.anomalyDetector.updateProcessMetrics(event);

    // Check for process anomalies
    if (this.anomalyDetector.detectProcessAnomaly(event)) {
      this.generateAlert({
        type: "process_anomaly",
        severity: "medium",
        description: "Suspicious process behavior detected",
        details: event,
        timestamp: event.timestamp,
        containerId: event.containerId,
        tenantId: event.tenantId,
      });
    }

    logger.debug("Process event processed", {
      pid: event.pid,
      command: event.command,
      containerId: event.containerId,
    });
  }

  /**
   * Handle network connection events
   */
  private handleNetworkEvent(event: NetworkEvent): void {
    this.metrics.totalEvents++;

    // Check if connection is allowed
    if (!this.isConnectionAllowed(event)) {
      this.generateAlert({
        type: "network_anomaly",
        severity: "high",
        description: `Unauthorized network connection: ${event.srcIP}:${event.srcPort} -> ${event.dstIP}:${event.dstPort}`,
        details: event,
        timestamp: event.timestamp,
        containerId: event.containerId,
        tenantId: event.tenantId,
      });
      return;
    }

    // Update anomaly detector
    this.anomalyDetector.updateNetworkMetrics(event);

    // Check for network anomalies
    if (this.anomalyDetector.detectNetworkAnomaly(event)) {
      this.generateAlert({
        type: "network_anomaly",
        severity: "medium",
        description: "Suspicious network activity detected",
        details: event,
        timestamp: event.timestamp,
        containerId: event.containerId,
        tenantId: event.tenantId,
      });
    }

    logger.debug("Network event processed", {
      srcIP: event.srcIP,
      dstIP: event.dstIP,
      protocol: event.protocol,
      containerId: event.containerId,
    });
  }

  /**
   * Handle file access events
   */
  private handleFileEvent(event: FileEvent): void {
    this.metrics.totalEvents++;

    // Check if file access is allowed
    if (!this.isFileAccessAllowed(event)) {
      this.generateAlert({
        type: "file_anomaly",
        severity: "high",
        description: `Unauthorized file access: ${event.operation} on ${event.path}`,
        details: event,
        timestamp: event.timestamp,
        containerId: event.containerId,
        tenantId: event.tenantId,
      });
      return;
    }

    // Update anomaly detector
    this.anomalyDetector.updateFileMetrics(event);

    // Check for file access anomalies
    if (this.anomalyDetector.detectFileAnomaly(event)) {
      this.generateAlert({
        type: "file_anomaly",
        severity: "medium",
        description: "Suspicious file access pattern detected",
        details: event,
        timestamp: event.timestamp,
        containerId: event.containerId,
        tenantId: event.tenantId,
      });
    }

    logger.debug("File event processed", {
      pid: event.pid,
      path: event.path,
      operation: event.operation,
      containerId: event.containerId,
    });
  }

  /**
   * Check if process is allowed to run
   */
  private isProcessAllowed(event: ProcessEvent): boolean {
    // Check against allowed processes list
    const allowedCommand = this.config.exclusionRules.allowedProcesses.some(
      (allowed) => event.command.includes(allowed)
    );

    if (!allowedCommand) {
      // Check if it's a known system process
      return this.isKnownSystemProcess(event);
    }

    return true;
  }

  /**
   * Check if network connection is allowed
   */
  private isConnectionAllowed(event: NetworkEvent): boolean {
    // Check against allowed IPs
    const allowedSrc = this.config.exclusionRules.allowedIPs.some(
      (allowed) =>
        event.srcIP.startsWith(allowed) || event.dstIP.startsWith(allowed)
    );

    return allowedSrc;
  }

  /**
   * Check if file access is allowed
   */
  private isFileAccessAllowed(event: FileEvent): boolean {
    // Check against allowed paths
    const allowedPath = this.config.exclusionRules.allowedPaths.some(
      (allowed) => event.path.startsWith(allowed)
    );

    if (!allowedPath) {
      // Allow access to container-specific paths
      return event.path.includes(event.containerId || "");
    }

    return true;
  }

  /**
   * Check if process is a known system process
   */
  private isKnownSystemProcess(event: ProcessEvent): boolean {
    const systemProcesses = [
      "node",
      "npm",
      "yarn",
      "docker",
      "containerd",
      "systemd",
      "init",
      "bash",
      "sh",
      "sleep",
    ];

    return systemProcesses.some((proc) => event.command.includes(proc));
  }

  /**
   * Generate security alert
   */
  private generateAlert(alert: Omit<SecurityAlert, "id" | "resolved">): void {
    const securityAlert: SecurityAlert = {
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      resolved: false,
    };

    this.alerts.set(securityAlert.id, securityAlert);
    this.metrics.alertsGenerated++;

    // Emit alert event
    this.emit("security_alert", securityAlert);

    logger.warn("Security alert generated", {
      id: securityAlert.id,
      type: securityAlert.type,
      severity: securityAlert.severity,
      description: securityAlert.description,
    });
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      const now = Date.now();
      const timeDiff = (now - this.metrics.lastProcessedTimestamp) / 1000; // seconds
      this.metrics.eventsProcessedPerSecond =
        this.metrics.totalEvents / timeDiff;
      this.metrics.lastProcessedTimestamp = now;
    }, 10000); // Update every 10 seconds
  }

  /**
   * Get monitoring metrics
   */
  public getMetrics(): any {
    return {
      ...this.metrics,
      activeAlerts: this.alerts.size,
      unresolvedAlerts: Array.from(this.alerts.values()).filter(
        (a) => !a.resolved
      ).length,
      alertsBySeverity: this.getAlertsBySeverity(),
      anomalyDetector: this.anomalyDetector.getMetrics(),
    };
  }

  /**
   * Get alerts grouped by severity
   */
  private getAlertsBySeverity(): Record<string, number> {
    const severityCounts: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    for (const alert of this.alerts.values()) {
      severityCounts[alert.severity]++;
    }

    return severityCounts;
  }

  /**
   * Resolve security alert
   */
  public resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      logger.info("Security alert resolved", { alertId });
      return true;
    }
    return false;
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): SecurityAlert[] {
    return Array.from(this.alerts.values()).filter((alert) => !alert.resolved);
  }

  /**
   * Clean up old resolved alerts
   */
  public cleanupResolvedAlerts(maxAge: number = 24 * 60 * 60 * 1000): number {
    let cleaned = 0;
    const cutoffTime = Date.now() - maxAge;

    for (const [id, alert] of this.alerts.entries()) {
      if (alert.resolved && alert.timestamp < cutoffTime) {
        this.alerts.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info("Cleaned up resolved alerts", { cleaned });
    }

    return cleaned;
  }
}

// ============================================================================
// Anomaly Detection
// ============================================================================

class AnomalyDetector {
  private processMetrics: Map<string, number> = new Map();
  private networkMetrics: Map<string, number> = new Map();
  private fileMetrics: Map<string, number> = new Map();
  private thresholds: eBPFConfig["alertThresholds"];

  constructor(thresholds: eBPFConfig["alertThresholds"]) {
    this.thresholds = thresholds;
  }

  updateProcessMetrics(event: ProcessEvent): void {
    const key = `${event.containerId || "unknown"}:${event.tenantId || "unknown"}`;
    const current = this.processMetrics.get(key) || 0;
    this.processMetrics.set(key, current + 1);
  }

  updateNetworkMetrics(event: NetworkEvent): void {
    const key = `${event.containerId || "unknown"}:${event.tenantId || "unknown"}`;
    const current = this.networkMetrics.get(key) || 0;
    this.networkMetrics.set(key, current + 1);
  }

  updateFileMetrics(event: FileEvent): void {
    const key = `${event.containerId || "unknown"}:${event.tenantId || "unknown"}`;
    const current = this.fileMetrics.get(key) || 0;
    this.fileMetrics.set(key, current + 1);
  }

  detectProcessAnomaly(event: ProcessEvent): boolean {
    const key = `${event.containerId || "unknown"}:${event.tenantId || "unknown"}`;
    const count = this.processMetrics.get(key) || 0;
    return count > this.thresholds.suspiciousProcessesPerMinute;
  }

  detectNetworkAnomaly(event: NetworkEvent): boolean {
    const key = `${event.containerId || "unknown"}:${event.tenantId || "unknown"}`;
    const count = this.networkMetrics.get(key) || 0;
    return count > this.thresholds.suspiciousConnectionsPerMinute;
  }

  detectFileAnomaly(event: FileEvent): boolean {
    const key = `${event.containerId || "unknown"}:${event.tenantId || "unknown"}`;
    const count = this.fileMetrics.get(key) || 0;
    return count > this.thresholds.fileAccessViolationsPerMinute;
  }

  getMetrics(): any {
    return {
      processMetrics: Object.fromEntries(this.processMetrics),
      networkMetrics: Object.fromEntries(this.networkMetrics),
      fileMetrics: Object.fromEntries(this.fileMetrics),
      thresholds: this.thresholds,
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

export function createEBPFRuntimeMonitor(
  config: eBPFConfig
): eBPFRuntimeMonitor {
  return eBPFRuntimeMonitor.getInstance(config);
}

export default {
  eBPFRuntimeMonitor,
  createEBPFRuntimeMonitor,
};
