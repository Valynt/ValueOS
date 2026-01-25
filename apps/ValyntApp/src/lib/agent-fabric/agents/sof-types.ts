export interface SystemMap {
  id: string;
  business_case_id: string;
  map_name: string;
  map_description?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Entity {
  id: string;
  entity_type: string;
  entity_name: string;
  entity_description?: string;
  system_map_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Relationship {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  relationship_strength?: number;
  system_map_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface InterventionPoint {
  id?: string;
  system_map_id?: string;
  intervention_type: string;
  intervention_description: string;
  leverage_point_id?: string;
  expected_impact?: number;
  feasibility_score?: number;
  required_resources: string[];
  intervention_sequence?: string[];
}
