/**
 * Repository for interacting with the 'kpi_targets' table.
 * Encapsulates all database logic for KPI Targets.
 */
import { supabase } from '../lib/supabase';
import { KPITarget } from '../types/vos';

export class KpiTargetRepository {
  private tenantId: string;

  constructor(tenantId: string) {
    if (!tenantId) {
      throw new Error('Tenant ID is required for KpiTargetRepository');
    }
    this.tenantId = tenantId;
  }

  /**
   * Finds all KPI Targets associated with a specific value commit.
   * @param valueCommitId The ID of the value commit.
   * @returns A Supabase postgrest response with an array of KPI targets or an error.
   */
  async findByValueCommitId(valueCommitId: string) {
    // Note: The table in the DB is 'kpis', but the code uses 'kpi_targets'.
    // This repository will use 'kpi_targets' as per the existing agent code.
    // A migration should be created to align the database schema with the code's expectations.
    return supabase
      .from('kpi_targets')
      .select('*')
      .eq('value_commit_id', valueCommitId)
      .eq('tenant_id', this.tenantId);
  }

  /**
   * Creates a new KPI Target.
   * @param kpiData The data for the new KPI Target.
   * @returns A Supabase postgrest response with the created KPI Target or an error.
   */
  async create(kpiData: Omit<KPITarget, 'id' | 'tenant_id' | 'created_at'>) {
    const dataToInsert = {
      ...kpiData,
      tenant_id: this.tenantId,
    };
    return supabase
      .from('kpi_targets')
      .insert(dataToInsert)
      .select()
      .single();
  }
}
