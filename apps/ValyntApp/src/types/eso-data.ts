/**
 * ESO Data Types
 * 
 * Data structures for external service orchestration payloads
 */

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
