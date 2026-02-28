/**
 * Configuration Monitoring Service
 *
 * Monitors configuration changes and triggers alerts
 */

import { createClient } from '@/lib/supabase/server';

export interface ConfigurationChangeEvent {
  organizationId: string;
  userId: string;
  category: string;
  setting: string;
  oldValue: any;
  newValue: any;
  timestamp: string;
  userRole: string;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: (event: ConfigurationChangeEvent) => boolean;
  severity: 'info' | 'warning' | 'critical';
  recipients: string[];
  enabled: boolean;
}

export class ConfigurationMonitor {
  private alertRules: AlertRule[] = [];

  constructor() {
    this.initializeDefaultRules();
  }

  /**
   * Initialize default monitoring rules
   */
  private initializeDefaultRules() {
    this.alertRules = [
      {
        id: 'llm-budget-increase',
        name: 'LLM Budget Increase',
        condition: (event) =>
          event.setting === 'llm_spending_limits' &&
          event.newValue.monthlyHardCap > event.oldValue.monthlyHardCap * 1.5,
        severity: 'warning',
        recipients: ['finance@valueos.com'],
        enabled: true
      },
      {
        id: 'security-policy-change',
        name: 'Security Policy Change',
        condition: (event) =>
          event.category === 'security' ||
          (event.category === 'iam' && event.setting === 'auth_policy'),
        severity: 'critical',
        recipients: ['security@valueos.com'],
        enabled: true
      },
      {
        id: 'tenant-status-change',
        name: 'Tenant Status Change',
        condition: (event) =>
          event.setting === 'tenant_provisioning' &&
          event.oldValue.status !== event.newValue.status,
        severity: 'info',
        recipients: ['ops@valueos.com'],
        enabled: true
      },
      {
        id: 'resource-limit-increase',
        name: 'Resource Limit Increase',
        condition: (event) =>
          event.setting === 'tenant_provisioning' &&
          (event.newValue.maxUsers > event.oldValue.maxUsers * 2 ||
            event.newValue.maxStorageGB > event.oldValue.maxStorageGB * 2),
        severity: 'warning',
        recipients: ['ops@valueos.com'],
        enabled: true
      },
      {
        id: 'rls-monitoring-disabled',
        name: 'RLS Monitoring Disabled',
        condition: (event) =>
          event.setting === 'rls_monitoring' &&
          event.oldValue.enabled === true &&
          event.newValue.enabled === false,
        severity: 'critical',
        recipients: ['security@valueos.com', 'ops@valueos.com'],
        enabled: true
      },
      {
        id: 'audit-integrity-disabled',
        name: 'Audit Integrity Disabled',
        condition: (event) =>
          event.setting === 'audit_integrity' &&
          event.oldValue.enableHashChaining === true &&
          event.newValue.enableHashChaining === false,
        severity: 'critical',
        recipients: ['security@valueos.com', 'compliance@valueos.com'],
        enabled: true
      },
      {
        id: 'retention-policy-reduced',
        name: 'Retention Policy Reduced',
        condition: (event) =>
          event.setting === 'retention_policies' &&
          (event.newValue.dataRetentionDays < event.oldValue.dataRetentionDays ||
            event.newValue.auditRetentionDays < event.oldValue.auditRetentionDays),
        severity: 'warning',
        recipients: ['compliance@valueos.com'],
        enabled: true
      },
      {
        id: 'agent-disabled',
        name: 'AI Agent Disabled',
        condition: (event) => {
          if (event.setting !== 'agent_toggles') return false;
          const oldAgents = event.oldValue.enabledAgents;
          const newAgents = event.newValue.enabledAgents;
          return Object.keys(oldAgents).some(
            (agent) => oldAgents[agent] === true && newAgents[agent] === false
          );
        },
        severity: 'info',
        recipients: ['ai-team@valueos.com'],
        enabled: true
      }
    ];
  }

  /**
   * Record configuration change
   */
  async recordChange(event: ConfigurationChangeEvent): Promise<void> {
    const supabase = await createClient();

    // Log to audit table
    await supabase.from('audit_logs').insert({
      organization_id: event.organizationId,
      user_id: event.userId,
      action: 'update',
      resource_type: 'configuration',
      resource_id: event.setting,
      changes: {
        category: event.category,
        setting: event.setting,
        oldValue: event.oldValue,
        newValue: event.newValue
      },
      metadata: {
        userRole: event.userRole,
        timestamp: event.timestamp
      }
    });

    // Check alert rules
    await this.checkAlertRules(event);

    // Update metrics
    await this.updateMetrics(event);
  }

  /**
   * Check alert rules and trigger notifications
   */
  private async checkAlertRules(event: ConfigurationChangeEvent): Promise<void> {
    const triggeredRules = this.alertRules.filter(
      (rule) => rule.enabled && rule.condition(event)
    );

    for (const rule of triggeredRules) {
      await this.sendAlert(rule, event);
    }
  }

  /**
   * Send alert notification
   */
  private async sendAlert(
    rule: AlertRule,
    event: ConfigurationChangeEvent
  ): Promise<void> {
    const supabase = await createClient();

      // Create alert record
      await supabase.from('alerts').insert({
        organization_id: event.organizationId,
      rule_id: rule.id,
      rule_name: rule.name,
      severity: rule.severity,
      organization_id: event.organizationId,
      triggered_by: event.userId,
      event_data: event,
      recipients: rule.recipients,
      status: 'pending'
    });

    // Send notifications (email, Slack, etc.)
    await this.sendNotifications(rule, event);
  }

  /**
   * Send notifications to recipients
   */
  private async sendNotifications(
    rule: AlertRule,
    event: ConfigurationChangeEvent
  ): Promise<void> {
    const message = this.formatAlertMessage(rule, event);

    // Send email notifications
    for (const recipient of rule.recipients) {
      await this.sendEmail(recipient, rule.name, message);
    }

    // Send Slack notification if configured
    if (process.env.SLACK_WEBHOOK_URL) {
      await this.sendSlackNotification(rule, event, message);
    }
  }

  /**
   * Format alert message
   */
  private formatAlertMessage(
    rule: AlertRule,
    event: ConfigurationChangeEvent
  ): string {
    return `
Configuration Change Alert: ${rule.name}

Severity: ${rule.severity.toUpperCase()}
Organization: ${event.organizationId}
User: ${event.userId} (${event.userRole})
Category: ${event.category}
Setting: ${event.setting}
Timestamp: ${event.timestamp}

Old Value:
${JSON.stringify(event.oldValue, null, 2)}

New Value:
${JSON.stringify(event.newValue, null, 2)}

This alert was triggered because: ${rule.name}
    `.trim();
  }

  /**
   * Send email notification
   */
  private async sendEmail(
    recipient: string,
    subject: string,
    message: string
  ): Promise<void> {
    // Implementation depends on email service (SendGrid, AWS SES, etc.)
    console.log(`Sending email to ${recipient}: ${subject}`);
    // await emailService.send({ to: recipient, subject, body: message });
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(
    rule: AlertRule,
    event: ConfigurationChangeEvent,
    message: string
  ): Promise<void> {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) return;

    const color = {
      info: '#36a64f',
      warning: '#ff9900',
      critical: '#ff0000'
    }[rule.severity];

    const payload = {
      attachments: [
        {
          color,
          title: `🔔 ${rule.name}`,
          text: message,
          fields: [
            {
              title: 'Organization',
              value: event.organizationId,
              short: true
            },
            {
              title: 'User',
              value: `${event.userId} (${event.userRole})`,
              short: true
            },
            {
              title: 'Category',
              value: event.category,
              short: true
            },
            {
              title: 'Setting',
              value: event.setting,
              short: true
            }
          ],
          footer: 'ValueOS Configuration Monitor',
          ts: Math.floor(new Date(event.timestamp).getTime() / 1000)
        }
      ]
    };

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error('Failed to send Slack notification:', error);
    }
  }

  /**
   * Update monitoring metrics
   */
  private async updateMetrics(event: ConfigurationChangeEvent): Promise<void> {
    // Increment configuration change counter
    // Track by category, setting, organization
    // This would integrate with your metrics system (Prometheus, DataDog, etc.)

    const metrics = {
      'configuration.changes.total': 1,
      [`configuration.changes.${event.category}`]: 1,
      [`configuration.changes.${event.category}.${event.setting}`]: 1,
      [`configuration.changes.by_role.${event.userRole}`]: 1
    };

    // Send to metrics service
    console.log('Metrics:', metrics);
  }

  /**
   * Get configuration change history
   */
  async getChangeHistory(
    organizationId: string,
    options?: {
      category?: string;
      setting?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
    }
  ): Promise<ConfigurationChangeEvent[]> {
    const supabase = await createClient();

    let query = supabase
      .from('audit_logs')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('resource_type', 'configuration')
      .order('created_at', { ascending: false });

    if (options?.category) {
      query = query.eq('changes->>category', options.category);
    }

    if (options?.setting) {
      query = query.eq('resource_id', options.setting);
    }

    if (options?.startDate) {
      query = query.gte('created_at', options.startDate);
    }

    if (options?.endDate) {
      query = query.lte('created_at', options.endDate);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data.map((log) => ({
      organizationId: log.organization_id,
      userId: log.user_id,
      category: log.changes.category,
      setting: log.changes.setting,
      oldValue: log.changes.oldValue,
      newValue: log.changes.newValue,
      timestamp: log.created_at,
      userRole: log.metadata?.userRole || 'unknown'
    }));
  }

  /**
   * Get alert statistics
   */
  async getAlertStats(
    organizationId: string,
    timeRange: { start: string; end: string }
  ): Promise<{
    total: number;
    bySeverity: Record<string, number>;
    byRule: Record<string, number>;
  }> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('created_at', timeRange.start)
      .lte('created_at', timeRange.end);

    if (error) {
      throw error;
    }

    const stats = {
      total: data.length,
      bySeverity: {} as Record<string, number>,
      byRule: {} as Record<string, number>
    };

    for (const alert of data) {
      stats.bySeverity[alert.severity] =
        (stats.bySeverity[alert.severity] || 0) + 1;
      stats.byRule[alert.rule_name] = (stats.byRule[alert.rule_name] || 0) + 1;
    }

    return stats;
  }

  /**
   * Add custom alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.push(rule);
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(ruleId: string): void {
    this.alertRules = this.alertRules.filter((rule) => rule.id !== ruleId);
  }

  /**
   * Enable/disable alert rule
   */
  toggleAlertRule(ruleId: string, enabled: boolean): void {
    const rule = this.alertRules.find((r) => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
    }
  }

  /**
   * Get all alert rules
   */
  getAlertRules(): AlertRule[] {
    return this.alertRules;
  }
}

// Singleton instance
export const configurationMonitor = new ConfigurationMonitor();
