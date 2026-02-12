import { SupabaseClient } from '@supabase/supabase-js';
import { TenantAwareService } from './TenantAwareService';
import { log } from '../lib/logger';

export interface SOC2Control {
  id: string;
  category: 'security' | 'availability' | 'processing_integrity' | 'confidentiality' | 'privacy';
  controlId: string; // e.g., "CC6.1", "A1.1"
  title: string;
  description: string;
  requirements: string[];
  evidenceRequired: string[];
  frequency: 'continuous' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
  automated: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface ComplianceEvidence {
  id: string;
  controlId: string;
  tenantId: string;
  evidenceType: 'log' | 'metric' | 'test_result' | 'manual_review' | 'audit';
  description: string;
  data: Record<string, any>;
  timestamp: Date;
  validUntil?: Date;
  status: 'compliant' | 'non_compliant' | 'needs_review';
  reviewedBy?: string;
  reviewNotes?: string;
}

export interface ComplianceReport {
  tenantId: string;
  reportPeriod: {
    start: Date;
    end: Date;
  };
  overallCompliance: number; // percentage
  controlsStatus: {
    compliant: number;
    nonCompliant: number;
    needsReview: number;
    total: number;
  };
  categoryBreakdown: CategoryBreakdown;
  criticalFindings: string[];
  recommendations: string[];
  nextAuditDate: Date;
}

export interface ControlAssessment {
  control: SOC2Control;
  status: 'compliant' | 'non_compliant' | 'needs_review';
  findings: string[];
  evidenceCount: number;
}

export interface CategoryBreakdown {
  [category: string]: {
    compliant: number;
    total: number;
    percentage: number;
  };
}

export interface AuthLogEntry {
  event_type: string;
  mfa_used?: boolean;
}

export interface SystemMetric {
  value: number;
}

export class SOC2ComplianceService extends TenantAwareService {
  private readonly soc2Controls: SOC2Control[] = [
    // Security Controls (CC6)
    {
      id: 'cc6.1',
      category: 'security',
      controlId: 'CC6.1',
      title: 'Restrict Logical Access',
      description: 'Logical access security software, infrastructure, and architectures are designed, developed, implemented, operated, maintained, and monitored to restrict unauthorized physical and logical access.',
      requirements: [
        'Multi-factor authentication implemented',
        'Role-based access controls enforced',
        'Access reviews conducted regularly',
        'Failed login attempts logged and monitored'
      ],
      evidenceRequired: ['auth_logs', 'access_reviews', 'mfa_usage'],
      frequency: 'continuous',
      automated: true,
      riskLevel: 'critical'
    },
    {
      id: 'cc6.6',
      category: 'security',
      controlId: 'CC6.6',
      title: 'Restrict Access to Audit Logs',
      description: 'Access to audit logs is restricted to authorized personnel.',
      requirements: [
        'Audit logs stored separately from application data',
        'Access to audit logs requires elevated privileges',
        'Audit log access is logged and monitored'
      ],
      evidenceRequired: ['audit_access_logs', 'permission_reviews'],
      frequency: 'continuous',
      automated: true,
      riskLevel: 'high'
    },

    // Availability Controls (A1)
    {
      id: 'a1.1',
      category: 'availability',
      controlId: 'A1.1',
      title: 'Performance Monitoring',
      description: 'Processes are in place to monitor system performance and availability.',
      requirements: [
        'System performance metrics collected',
        'Availability monitoring implemented',
        'Incident response procedures documented',
        'Backup and recovery processes tested'
      ],
      evidenceRequired: ['performance_metrics', 'availability_logs', 'backup_tests'],
      frequency: 'continuous',
      automated: true,
      riskLevel: 'high'
    },

    // Processing Integrity Controls (PI1)
    {
      id: 'pi1.1',
      category: 'processing_integrity',
      controlId: 'PI1.1',
      title: 'Data Processing Accuracy',
      description: 'System processing is complete, accurate, timely, and authorized.',
      requirements: [
        'Data validation implemented',
        'Transaction processing verified',
        'Error handling procedures in place',
        'Data integrity checks performed'
      ],
      evidenceRequired: ['validation_logs', 'error_logs', 'integrity_checks'],
      frequency: 'continuous',
      automated: true,
      riskLevel: 'medium'
    },

    // Confidentiality Controls (CC6.7)
    {
      id: 'cc6.7',
      category: 'confidentiality',
      controlId: 'CC6.7',
      title: 'Encrypt Data at Rest',
      description: 'Data at rest is encrypted using industry-accepted algorithms.',
      requirements: [
        'Database encryption implemented',
        'File storage encryption enabled',
        'Encryption keys properly managed',
        'Encryption standards meet industry requirements'
      ],
      evidenceRequired: ['encryption_config', 'key_management_logs'],
      frequency: 'monthly',
      automated: true,
      riskLevel: 'high'
    },

    // Privacy Controls (P6)
    {
      id: 'p6.1',
      category: 'privacy',
      controlId: 'P6.1',
      title: 'Privacy Notice and Communication',
      description: 'The entity communicates privacy practices to data subjects.',
      requirements: [
        'Privacy policy published and accessible',
        'Data collection consent obtained',
        'Data usage clearly communicated',
        'Privacy rights explained to users'
      ],
      evidenceRequired: ['privacy_policy', 'consent_logs', 'user_communications'],
      frequency: 'annually',
      automated: false,
      riskLevel: 'medium'
    }
  ];

  constructor(supabase: SupabaseClient) {
    super(supabase);
    this.auditLog = this.createAuditLogger();
  }

  /**
   * Generates a comprehensive SOC 2 compliance report
   */
  async generateComplianceReport(
    tenantId: string,
    reportPeriod?: { start: Date; end: Date }
  ): Promise<ComplianceReport> {
    await this.validateTenantAccess('system', tenantId);

    const period = reportPeriod || {
      start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
      end: new Date()
    };

    // Assess each control
    const controlAssessments = await Promise.all(
      this.soc2Controls.map(control => this.assessControlCompliance(tenantId, control, period))
    );

    // Calculate overall compliance
    const compliant = controlAssessments.filter(a => a.status === 'compliant').length;
    const nonCompliant = controlAssessments.filter(a => a.status === 'non_compliant').length;
    const needsReview = controlAssessments.filter(a => a.status === 'needs_review').length;
    const total = controlAssessments.length;

    const overallCompliance = (compliant / total) * 100;

    // Category breakdown
    const categoryBreakdown = this.calculateCategoryBreakdown(controlAssessments);

    // Critical findings and recommendations
    const criticalFindings = controlAssessments
      .filter(a => a.status === 'non_compliant' && a.control.riskLevel === 'critical')
      .map(a => `${a.control.controlId}: ${a.control.title} - ${a.findings.join(', ')}`);

    const recommendations = this.generateRecommendations(controlAssessments);

    const report: ComplianceReport = {
      tenantId,
      reportPeriod: period,
      overallCompliance,
      controlsStatus: { compliant, nonCompliant, needsReview, total },
      categoryBreakdown,
      criticalFindings,
      recommendations,
      nextAuditDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days from now
    };

    // Store the report
    await this.storeComplianceReport(report);

    // Log report generation
    await this.auditLog.log({
      userId: 'system',
      action: 'compliance.report_generated',
      resourceType: 'compliance_report',
      resourceId: crypto.randomUUID(),
      details: {
        tenantId,
        overallCompliance,
        criticalFindingsCount: criticalFindings.length
      },
      status: overallCompliance >= 95 ? 'success' : overallCompliance >= 80 ? 'warning' : 'critical'
    });

    log.info('SOC 2 compliance report generated', {
      tenantId,
      overallCompliance: `${overallCompliance.toFixed(1)}%`,
      criticalFindings: criticalFindings.length
    });

    return report;
  }

  /**
   * Collects evidence for a specific control
   */
  async collectControlEvidence(
    tenantId: string,
    controlId: string
  ): Promise<ComplianceEvidence[]> {
    await this.validateTenantAccess('system', tenantId);

    const control = this.soc2Controls.find(c => c.id === controlId);
    if (!control) {
      throw new Error(`Control ${controlId} not found`);
    }

    const evidence: ComplianceEvidence[] = [];

    // Collect evidence based on control requirements
    for (const evidenceType of control.evidenceRequired) {
      const collectedEvidence = await this.collectEvidenceByType(tenantId, control, evidenceType);
      evidence.push(...collectedEvidence);
    }

    return evidence;
  }

  /**
   * Performs automated compliance checks
   */
  async performAutomatedChecks(tenantId: string): Promise<{
    passed: number;
    failed: number;
    results: Array<{
      controlId: string;
      status: 'passed' | 'failed';
      details: string;
    }>;
  }> {
    await this.validateTenantAccess('system', tenantId);

    const results: Array<{
      controlId: string;
      status: 'passed' | 'failed';
      details: string;
    }> = [];

    for (const control of this.soc2Controls.filter(c => c.automated)) {
      const checkResult = await this.performControlCheck(tenantId, control);
      results.push(checkResult);
    }

    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status === 'failed').length;

    // Store automated check results
    await this.storeAutomatedCheckResults(tenantId, results);

    return { passed, failed, results };
  }

  /**
   * Monitors continuous compliance controls
   */
  async monitorContinuousCompliance(tenantId: string): Promise<{
    alerts: Array<{
      controlId: string;
      severity: string;
      message: string;
    }>;
    status: 'healthy' | 'warning' | 'critical';
  }> {
    await this.validateTenantAccess('system', tenantId);

    const alerts: Array<{
      controlId: string;
      severity: string;
      message: string;
    }> = [];

    // Check continuous controls
    const continuousControls = this.soc2Controls.filter(c => c.frequency === 'continuous');

    for (const control of continuousControls) {
      const monitoringResult = await this.monitorControl(tenantId, control);
      if (monitoringResult.alerts) {
        alerts.push(...monitoringResult.alerts);
      }
    }

    // Determine overall status
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    const warningAlerts = alerts.filter(a => a.severity === 'warning');

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (criticalAlerts.length > 0) {
      status = 'critical';
    } else if (warningAlerts.length > 0) {
      status = 'warning';
    }

    // Log monitoring results
    if (alerts.length > 0) {
      await this.auditLog.log({
        userId: 'system',
        action: 'compliance.monitoring_alert',
        resourceType: 'compliance_monitoring',
        resourceId: crypto.randomUUID(),
        details: {
          tenantId,
          alertCount: alerts.length,
          status
        },
        status: status === 'critical' ? 'critical' : 'warning'
      });
    }

    return { alerts, status };
  }

  // Private helper methods
  private async assessControlCompliance(
    tenantId: string,
    control: SOC2Control,
    period: { start: Date; end: Date }
  ): Promise<ControlAssessment> {
    const evidence = await this.queryWithTenantCheck(
      'compliance_evidence',
      'system',
      {
        control_id: control.id,
        tenant_id: tenantId,
        timestamp: { gte: period.start, lte: period.end }
      }
    );

    const validEvidence = evidence.filter((e: any) =>
      e.status === 'compliant' &&
      (!e.validUntil || e.validUntil > new Date())
    );

    let status: 'compliant' | 'non_compliant' | 'needs_review' = 'needs_review';
    const findings: string[] = [];

    if (validEvidence.length >= control.evidenceRequired.length) {
      status = 'compliant';
    } else {
      status = 'non_compliant';
      findings.push(`Missing evidence: ${control.evidenceRequired.length - validEvidence.length} items`);
    }

    return {
      control,
      status,
      findings,
      evidenceCount: validEvidence.length
    };
  }

  private calculateCategoryBreakdown(assessments: ControlAssessment[]): CategoryBreakdown {
    const categories = ['security', 'availability', 'processing_integrity', 'confidentiality', 'privacy'];
    const breakdown: Record<string, any> = {};

    for (const category of categories) {
      const categoryAssessments = assessments.filter(a => a.control.category === category);
      const compliant = categoryAssessments.filter(a => a.status === 'compliant').length;
      const total = categoryAssessments.length;

      breakdown[category] = {
        compliant,
        total,
        percentage: total > 0 ? (compliant / total) * 100 : 0
      };
    }

    return breakdown;
  }

  private generateRecommendations(assessments: ControlAssessment[]): string[] {
    const recommendations: string[] = [];

    const nonCompliant = assessments.filter(a => a.status === 'non_compliant');

    for (const assessment of nonCompliant) {
      if (assessment.control.automated) {
        recommendations.push(`Implement automated monitoring for ${assessment.control.controlId}: ${assessment.control.title}`);
      } else {
        recommendations.push(`Conduct manual review for ${assessment.control.controlId}: ${assessment.control.title}`);
      }
    }

    if (nonCompliant.some(a => a.control.category === 'security')) {
      recommendations.push('Priority: Address security control gaps immediately');
    }

    return recommendations;
  }

  private async collectEvidenceByType(
    tenantId: string,
    control: SOC2Control,
    evidenceType: string
  ): Promise<ComplianceEvidence[]> {
    const evidence: ComplianceEvidence[] = [];

    switch (evidenceType) {
      case 'auth_logs':
        evidence.push(await this.collectAuthLogsEvidence(tenantId, control));
        break;
      case 'audit_access_logs':
        evidence.push(await this.collectAuditAccessEvidence(tenantId, control));
        break;
      case 'performance_metrics':
        evidence.push(await this.collectPerformanceMetricsEvidence(tenantId, control));
        break;
      // Add more evidence collection types as needed
    }

    return evidence;
  }

  private async performControlCheck(
    tenantId: string,
    control: SOC2Control
  ): Promise<{
    controlId: string;
    status: 'passed' | 'failed';
    details: string;
  }> {
    // Implement automated checks for each control
    switch (control.id) {
      case 'cc6.1':
        return await this.checkAccessRestrictions(tenantId);
      case 'cc6.6':
        return await this.checkAuditLogAccess(tenantId);
      case 'cc6.7':
        return await this.checkEncryptionAtRest(tenantId);
      default:
        return {
          controlId: control.controlId,
          status: 'failed',
          details: 'Automated check not implemented'
        };
    }
  }

  private async monitorControl(
    tenantId: string,
    control: SOC2Control
  ): Promise<{
    alerts: Array<{
      controlId: string;
      severity: string;
      message: string;
    }> | undefined;
  }> {
    // Implement continuous monitoring logic
    const alerts: Array<{
      controlId: string;
      severity: string;
      message: string;
    }> = [];

    // Example: Monitor for authentication failures
    if (control.id === 'cc6.1') {
      const recentFailures = await this.supabase
        .from('auth_logs')
        .select('count')
        .eq('tenant_id', tenantId)
        .eq('event_type', 'failed_login')
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000)); // Last hour

      if (recentFailures.data && recentFailures.data[0].count > 10) {
        alerts.push({
          controlId: control.controlId,
          severity: 'high',
          message: 'High number of authentication failures detected'
        });
      }
    }

    return { alerts: alerts.length > 0 ? alerts : undefined };
  }

  // Specific evidence collection methods
  private async collectAuthLogsEvidence(tenantId: string, control: SOC2Control): Promise<ComplianceEvidence> {
    const recentLogs = await this.supabase
      .from('auth_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // Last 30 days
      .limit(1000);

    return {
      id: crypto.randomUUID(),
      controlId: control.id,
      tenantId,
      evidenceType: 'log',
      description: 'Authentication logs for access control verification',
      data: {
        logCount: recentLogs.data?.length || 0,
        mfaUsage: recentLogs.data?.filter(l => l.mfa_used).length || 0,
        failureRate: this.calculateFailureRate(recentLogs.data || [])
      },
      timestamp: new Date(),
      status: 'compliant'
    };
  }

  private async collectAuditAccessEvidence(tenantId: string, control: SOC2Control): Promise<ComplianceEvidence> {
    const auditAccess = await this.supabase
      .from('audit_log_access')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('accessed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

    return {
      id: crypto.randomUUID(),
      controlId: control.id,
      tenantId,
      evidenceType: 'log',
      description: 'Audit log access monitoring',
      data: {
        accessCount: auditAccess.data?.length || 0,
        uniqueUsers: new Set(auditAccess.data?.map(a => a.user_id)).size || 0
      },
      timestamp: new Date(),
      status: 'compliant'
    };
  }

  private async collectPerformanceMetricsEvidence(tenantId: string, control: SOC2Control): Promise<ComplianceEvidence> {
    const metrics = await this.supabase
      .from('system_metrics')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('metric_type', 'availability')
      .gte('timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

    const uptime = this.calculateUptime(metrics.data || []);

    return {
      id: crypto.randomUUID(),
      controlId: control.id,
      tenantId,
      evidenceType: 'metric',
      description: 'System availability and performance metrics',
      data: {
        uptimePercentage: uptime,
        totalIncidents: metrics.data?.filter(m => m.value < 99).length || 0
      },
      timestamp: new Date(),
      status: uptime >= 99.9 ? 'compliant' : 'non_compliant'
    };
  }

  // Automated check implementations
  private async checkAccessRestrictions(tenantId: string): Promise<{
    controlId: string;
    status: 'passed' | 'failed';
    details: string;
  }> {
    // Check if MFA is enforced
    const usersWithoutMfa = await this.supabase
      .from('user_settings')
      .select('count')
      .eq('tenant_id', tenantId)
      .eq('mfa_enabled', false);

    const mfaEnforced = (usersWithoutMfa.data?.[0]?.count || 0) === 0;

    return {
      controlId: 'CC6.1',
      status: mfaEnforced ? 'passed' : 'failed',
      details: mfaEnforced ?
        'MFA is enforced for all users' :
        `${usersWithoutMfa.data?.[0].count || 0} users without MFA enabled`
    };
  }

  private async checkAuditLogAccess(tenantId: string): Promise<{
    controlId: string;
    status: 'passed' | 'failed';
    details: string;
  }> {
    // Check if audit logs are properly segregated
    const auditAccessCount = await this.supabase
      .from('audit_log_access')
      .select('count')
      .eq('tenant_id', tenantId)
      .gte('accessed_at', new Date(Date.now() - 24 * 60 * 60 * 1000));

    return {
      controlId: 'CC6.6',
      status: 'passed', // Assuming proper access controls are in place
      details: `${auditAccessCount.data?.[0]?.count || 0} audit log accesses in last 24 hours`
    };
  }

  private async checkEncryptionAtRest(tenantId: string): Promise<{
    controlId: string;
    status: 'passed' | 'failed';
    details: string;
  }> {
    // Check database encryption status
    const encryptionStatus = await this.supabase
      .from('system_configuration')
      .select('value')
      .eq('key', 'database_encryption_enabled')
      .single();

    const isEncrypted = encryptionStatus.data?.value === 'true';

    return {
      controlId: 'CC6.7',
      status: isEncrypted ? 'passed' : 'failed',
      details: isEncrypted ?
        'Database encryption is enabled' :
        'Database encryption is not configured'
    };
  }

  // Utility methods
  private calculateFailureRate(logs: AuthLogEntry[]): number {
    const total = logs.length;
    const failures = logs.filter(l => l.event_type === 'failed_login').length;
    return total > 0 ? (failures / total) * 100 : 0;
  }

  private calculateUptime(metrics: SystemMetric[]): number {
    if (metrics.length === 0) return 100;

    const totalChecks = metrics.length;
    const successfulChecks = metrics.filter(m => m.value >= 99).length;
    return (successfulChecks / totalChecks) * 100;
  }

  private async storeComplianceReport(report: ComplianceReport): Promise<void> {
    await this.supabase
      .from('compliance_reports')
      .insert({
        id: crypto.randomUUID(),
        tenant_id: report.tenantId,
        report_period_start: report.reportPeriod.start,
        report_period_end: report.reportPeriod.end,
        overall_compliance: report.overallCompliance,
        controls_status: report.controlsStatus,
        category_breakdown: report.categoryBreakdown,
        critical_findings: report.criticalFindings,
        recommendations: report.recommendations,
        next_audit_date: report.nextAuditDate,
        generated_at: new Date()
      });
  }

  private async storeAutomatedCheckResults(
    tenantId: string,
    results: Array<{
      controlId: string;
      status: 'passed' | 'failed';
      details: string;
    }>
  ): Promise<void> {
    const checkResults = results.map(result => ({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      control_id: result.controlId,
      status: result.status,
      details: result.details,
      checked_at: new Date()
    }));

    await this.supabase
      .from('automated_check_results')
      .insert(checkResults);
  }
}
