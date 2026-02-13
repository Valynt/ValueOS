/**
 * ESO Data Types
 * 
 * Data structures for external service orchestration payloads
 */

import type { ESOKPINode, ESOEdge, ESOPersonaValueMap } from "./eso";

// ============================================================================
// Ground Truth Seed Data
// ============================================================================

/** All ESO KPI definitions. Populated at build time or from seed files. */
export const ALL_ESO_KPIS: ESOKPINode[] = [];

/** Persona-to-KPI mappings for stakeholder-driven analysis. */
export const EXTENDED_PERSONA_MAPS: ESOPersonaValueMap[] = [];

/** Causal edges between KPIs in the value graph. */
export const EXTENDED_ESO_EDGES: ESOEdge[] = [];

// ============================================================================
// Data Mapping Types
// ============================================================================

export interface ESODataMapping {
  id: string;
  source_service: string;
  target_service: string;
  field_mappings: FieldMapping[];
  transformations: DataTransformation[];
}

export interface FieldMapping {
  source_field: string;
  target_field: string;
  data_type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  required: boolean;
  default_value?: any;
}

export interface DataTransformation {
  type: 'map' | 'filter' | 'aggregate' | 'format' | 'custom';
  function_name: string;
  parameters: Record<string, any>;
}

export interface ESODataBatch {
  batch_id: string;
  service_id: string;
  records: ESODataRecord[];
  metadata: {
    total_count: number;
    processed_count: number;
    failed_count: number;
    started_at: string;
    completed_at?: string;
  };
}

export interface ESODataRecord {
  id: string;
  data: Record<string, any>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export interface ESOSyncStatus {
  service_id: string;
  last_sync: string;
  next_sync?: string;
  sync_interval_minutes: number;
  records_synced: number;
  errors: string[];
}
