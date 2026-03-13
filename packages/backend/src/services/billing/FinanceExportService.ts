/**
 * Finance Export Service
 * Handles finance exports and reconciliation for billing data
 */

import { type SupabaseClient } from '@supabase/supabase-js';

import { BillingMetric } from '../../config/billing.js';
import { createLogger } from '../../lib/logger.js';

import { InvoiceMathEngine } from './InvoiceMathEngine.js';

const logger = createLogger({ component: 'FinanceExportService' });

export interface FinanceExport {
  id: string;
  export_type: 'invoices' | 'usage' | 'reconciliation' | 'revenue';
  period_start: string;
  period_end: string;
  tenant_filter?: string[]; // Empty array means all tenants
  format: 'csv' | 'json' | 'xlsx';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  file_url?: string;
  record_count: number;
  total_amount?: number;
  requested_by: string;
  created_at: string;
  completed_at?: string;
  error_message?: string;
}

export interface ReconciliationReport {
  period_start: string;
  period_end: string;
  total_invoiced: number;
  total_paid: number;
  outstanding_amount: number;
  disputed_amount: number;
  written_off_amount: number;
  by_tenant: Array<{
    tenant_id: string;
    tenant_name?: string;
    invoiced: number;
    paid: number;
    outstanding: number;
    disputed: number;
    last_payment_date?: string | null;
  }>;
  by_plan: Array<{
    plan_tier: string;
    tenant_count: number;
    total_invoiced: number;
    total_paid: number;
    outstanding: number;
  }>;
  aging_analysis: {
    current: number; // 0-30 days
    past_due_30: number; // 31-60 days
    past_due_60: number; // 61-90 days
    past_due_90: number; // 90+ days
  };
}

interface InvoiceRecord {
  invoice_id: string;
  stripe_invoice_id: string | null;
  tenant_id: string;
  tenant_name: string;
  organization_id: string;
  period_start: string;
  period_end: string;
  amount_due: number;
  amount_paid: number;
  amount_remaining: number;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
}

interface UsageRecord {
  tenant_id: string;
  tenant_name: string;
  subscription_id: string;
  price_version_id: string;
  meter_key: string;
  period_start: string;
  period_end: string;
  quantity_used: number;
  quantity_included: number;
  quantity_overage: number;
  unit_price: number;
  amount: number;
  rated_at: string;
  source_aggregate_hash: string;
}

interface RevenueRecord {
  tenant_id: string;
  tenant_name: string;
  period_start: string;
  period_end: string;
  revenue_amount: number;
  recognized_revenue: number;
  deferred_revenue: number;
}

export class FinanceExportService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }
  /**
   * Create finance export request
   */
  async createExport(
    exportType: FinanceExport['export_type'],
    periodStart: string,
    periodEnd: string,
    tenantFilter: string[] = [],
    format: FinanceExport['format'] = 'csv',
    requestedBy: string
  ): Promise<FinanceExport> {
    try {
      const { data, error } = await this.supabase
        .from('finance_exports')
        .insert({
          export_type: exportType,
          period_start: periodStart,
          period_end: periodEnd,
          tenant_filter: tenantFilter,
          format,
          status: 'pending',
          record_count: 0,
          requested_by: requestedBy,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating finance export', error);
        throw new Error('Failed to create finance export');
      }

      logger.info('Created finance export request', {
        exportId: data.id,
        exportType,
        periodStart,
        periodEnd,
        requestedBy
      });

      // Start async processing
      setImmediate(() => this.processExport(data.id));

      return data;
    } catch (error) {
      logger.error('Error in createExport', error as Error);
      throw error;
    }
  }

  /**
   * Process finance export (async)
   */
  async processExport(exportId: string): Promise<void> {
    try {
      // Update status to processing
      await this.supabase
        .from('finance_exports')
        .update({
          status: 'processing',
          updated_at: new Date().toISOString()
        })
        .eq('id', exportId);

      // Get export details
      const { data: exportData, error: fetchError } = await this.supabase
        .from('finance_exports')
        .select('*')
        .eq('id', exportId)
        .single();

      if (fetchError || !exportData) {
        throw new Error('Export not found');
      }

      let records: Record<string, unknown>[] = [];
      let totalAmount = 0;

      // Process based on export type
      switch (exportData.export_type) {
        case 'invoices':
          ({ records, totalAmount } = await this.exportInvoices(
            exportData.period_start,
            exportData.period_end,
            exportData.tenant_filter || []
          ));
          break;
        case 'usage':
          ({ records, totalAmount } = await this.exportUsage(
            exportData.period_start,
            exportData.period_end,
            exportData.tenant_filter || []
          ));
          break;
        case 'reconciliation':
          const reconciliationData = await this.generateReconciliationReport(
            exportData.period_start,
            exportData.period_end,
            exportData.tenant_filter || []
          );
          records = [reconciliationData];
          totalAmount = reconciliationData.total_invoiced;
          break;
        case 'revenue':
          ({ records, totalAmount } = await this.exportRevenue(
            exportData.period_start,
            exportData.period_end,
            exportData.tenant_filter || []
          ));
          break;
        default:
          throw new Error(`Unknown export type: ${exportData.export_type}`);
      }

      // Generate file
      const fileUrl = await this.generateExportFile(records, exportData.format, exportId);

      // Update export as completed
      await this.supabase
        .from('finance_exports')
        .update({
          status: 'completed',
          file_url: fileUrl,
          record_count: records.length,
          total_amount: totalAmount,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', exportId);

      logger.info('Completed finance export', {
        exportId,
        exportType: exportData.export_type,
        recordCount: records.length,
        totalAmount
      });
    } catch (error) {
      logger.error('Error processing finance export', error as Error, { exportId });

      // Update export as failed
      await this.supabase
        .from('finance_exports')
        .update({
          status: 'failed',
          error_message: (error as Error).message,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', exportId);
    }
  }

  /**
   * Export invoices data
   */
  private async exportInvoices(
    periodStart: string,
    periodEnd: string,
    tenantFilter: string[]
  ): Promise<{ records: InvoiceRecord[]; totalAmount: number }> {
    let query = this.supabase
      .from('invoices')
      .select(`
        *,
        tenants:tenant_id (
          name,
          organization_id
        )
      `)
      .gte('period_start', periodStart)
      .lte('period_end', periodEnd)
      .order('created_at', { ascending: true });

    if (tenantFilter && tenantFilter.length > 0) {
      query = query.in('tenant_id', tenantFilter);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error('Failed to fetch invoices for export');
    }

    const records: InvoiceRecord[] = (data || []).map(invoice => ({
      invoice_id: invoice.id,
      stripe_invoice_id: invoice.stripe_invoice_id ?? null,
      tenant_id: invoice.tenant_id,
      tenant_name: invoice.tenants?.name ?? '',
      organization_id: invoice.tenants?.organization_id ?? '',
      period_start: invoice.period_start,
      period_end: invoice.period_end,
      amount_due: invoice.amount_due,
      amount_paid: invoice.amount_paid,
      amount_remaining: invoice.amount_remaining,
      subtotal: invoice.subtotal,
      tax: invoice.tax,
      total: invoice.total,
      currency: invoice.currency,
      status: invoice.status,
      due_date: invoice.due_date ?? null,
      paid_at: invoice.paid_at ?? null,
      created_at: invoice.created_at
    }));

    const totalAmount = records.reduce((sum, record) => sum + record.total, 0);

    return { records, totalAmount };
  }

  /**
   * Export usage data
   */
  private async exportUsage(
    periodStart: string,
    periodEnd: string,
    tenantFilter: string[]
  ): Promise<{ records: UsageRecord[]; totalAmount: number }> {
    let query = this.supabase
      .from('rated_ledger')
      .select(`
        *,
        tenants:tenant_id (
          name
        )
      `)
      .gte('period_start', periodStart)
      .lte('period_end', periodEnd)
      .order('rated_at', { ascending: true });

    if (tenantFilter && tenantFilter.length > 0) {
      query = query.in('tenant_id', tenantFilter);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error('Failed to fetch usage data for export');
    }

    const records: UsageRecord[] = (data || []).map(entry => ({
      tenant_id: entry.tenant_id,
      tenant_name: entry.tenants?.name ?? '',
      subscription_id: entry.subscription_id,
      price_version_id: entry.price_version_id,
      meter_key: entry.meter_key,
      period_start: entry.period_start,
      period_end: entry.period_end,
      quantity_used: entry.quantity_used,
      quantity_included: entry.quantity_included,
      quantity_overage: entry.quantity_overage,
      unit_price: entry.unit_price,
      amount: entry.amount,
      rated_at: entry.rated_at,
      source_aggregate_hash: entry.source_aggregate_hash
    }));

    const totalAmount = records.reduce((sum, record) => sum + record.amount, 0);

    return { records, totalAmount };
  }

  /**
   * Generate reconciliation report
   */
  async generateReconciliationReport(
    periodStart: string,
    periodEnd: string,
    tenantFilter: string[] = []
  ): Promise<ReconciliationReport> {
    try {
      // Get all invoices in period
      const invoices = await this.exportInvoices(periodStart, periodEnd, tenantFilter);

      // Calculate totals
      const totalInvoiced = invoices.records.reduce((sum, inv) => sum + inv.total, 0);
      const totalPaid = invoices.records.reduce((sum, inv) => sum + inv.amount_paid, 0);
      const outstandingAmount = invoices.records.reduce((sum, inv) => sum + inv.amount_remaining, 0);

      // Group by tenant
      type TenantGroup = {
        tenant_id: string;
        tenant_name?: string;
        invoiced: number;
        paid: number;
        outstanding: number;
        disputed: number;
        last_payment_date: string | null;
      };

      const tenantGroups = new Map<string, TenantGroup>();
      for (const invoice of invoices.records) {
        const key = invoice.tenant_id;
        if (!tenantGroups.has(key)) {
          tenantGroups.set(key, {
            tenant_id: key,
            tenant_name: invoice.tenant_name,
            invoiced: 0,
            paid: 0,
            outstanding: 0,
            disputed: 0,
            last_payment_date: null
          });
        }
        const group = tenantGroups.get(key)!;
        group.invoiced += invoice.total;
        group.paid += invoice.amount_paid;
        group.outstanding += invoice.amount_remaining;
        if (invoice.paid_at && (!group.last_payment_date || invoice.paid_at > group.last_payment_date)) {
          group.last_payment_date = invoice.paid_at;
        }
      }

      // Group by plan (simplified - would need subscription data)
      type PlanGroup = {
        plan_tier: string;
        tenant_count: number;
        total_invoiced: number;
        total_paid: number;
        outstanding: number;
      };

      const planGroups = new Map<string, PlanGroup>();
      // This would require joining with subscriptions to get plan tiers

      // Aging analysis
      const agingAnalysis = {
        current: 0,
        past_due_30: 0,
        past_due_60: 0,
        past_due_90: 0
      };

      const now = new Date();
      for (const invoice of invoices.records) {
        if (invoice.amount_remaining > 0 && invoice.due_date) {
          const dueDate = new Date(invoice.due_date);
          const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

          if (daysPastDue <= 0) {
            agingAnalysis.current += invoice.amount_remaining;
          } else if (daysPastDue <= 30) {
            agingAnalysis.past_due_30 += invoice.amount_remaining;
          } else if (daysPastDue <= 60) {
            agingAnalysis.past_due_60 += invoice.amount_remaining;
          } else {
            agingAnalysis.past_due_90 += invoice.amount_remaining;
          }
        }
      }

      return {
        period_start: periodStart,
        period_end: periodEnd,
        total_invoiced: totalInvoiced,
        total_paid: totalPaid,
        outstanding_amount: outstandingAmount,
        disputed_amount: 0, // Would need dispute tracking
        written_off_amount: 0, // Would need write-off tracking
        by_tenant: Array.from(tenantGroups.values()),
        by_plan: Array.from(planGroups.values()),
        aging_analysis: agingAnalysis
      };
    } catch (error) {
      logger.error('Error generating reconciliation report', error as Error);
      throw error;
    }
  }

  /**
   * Export revenue data
   */
  private async exportRevenue(
    periodStart: string,
    periodEnd: string,
    tenantFilter: string[]
  ): Promise<{ records: RevenueRecord[]; totalAmount: number }> {
    // Revenue export combines invoices and usage for revenue recognition
    const invoices = await this.exportInvoices(periodStart, periodEnd, tenantFilter);
    const usage = await this.exportUsage(periodStart, periodEnd, tenantFilter);

    // Combine and aggregate for revenue reporting
    const revenueRecords = this.aggregateRevenueData(invoices.records, usage.records);
    const totalAmount = revenueRecords.reduce((sum, record) => sum + record.revenue_amount, 0);

    return { records: revenueRecords, totalAmount };
  }

  /**
   * Aggregate data for revenue reporting
   */
  private aggregateRevenueData(invoices: InvoiceRecord[], usage: UsageRecord[]): RevenueRecord[] {
    // This would create revenue recognition entries
    // Simplified implementation
    const revenueMap = new Map<string, RevenueRecord>();

    // Process invoices
    for (const invoice of invoices) {
      const key = `${invoice.tenant_id}_${invoice.period_start}_${invoice.period_end}`;
      if (!revenueMap.has(key)) {
        revenueMap.set(key, {
          tenant_id: invoice.tenant_id,
          tenant_name: invoice.tenant_name,
          period_start: invoice.period_start,
          period_end: invoice.period_end,
          revenue_amount: 0,
          recognized_revenue: 0,
          deferred_revenue: 0
        });
      }
      const record = revenueMap.get(key)!;
      record.revenue_amount += invoice.total;
      record.recognized_revenue += invoice.amount_paid;
      record.deferred_revenue += invoice.amount_remaining;
    }

    return Array.from(revenueMap.values());
  }

  /**
   * Generate export file (simplified - would integrate with file storage)
   */
  private async generateExportFile(
    records: Record<string, unknown>[],
    format: string,
    exportId: string
  ): Promise<string> {
    // In a real implementation, this would generate and upload the file
    // For now, return a mock URL
    const fileName = `finance_export_${exportId}.${format}`;
    return `https://storage.example.com/exports/${fileName}`;
  }

  /**
   * Get export status
   */
  async getExportStatus(exportId: string): Promise<FinanceExport | null> {
    const { data, error } = await this.supabase
      .from('finance_exports')
      .select('*')
      .eq('id', exportId)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error('Error getting export status', error);
      return null;
    }

    return data;
  }

  /**
   * List finance exports
   */
  async listExports(
    requestedBy?: string,
    limit: number = 50
  ): Promise<FinanceExport[]> {
    let query = this.supabase
      .from('finance_exports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (requestedBy) {
      query = query.eq('requested_by', requestedBy);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error listing finance exports', error);
      return [];
    }

    return data || [];
  }
}