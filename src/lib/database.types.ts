export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      business_cases: {
        Row: {
          id: string
          name: string
          client: string
          status: 'draft' | 'in-review' | 'presented'
          owner_id: string
          created_at: string
          updated_at: string
          metadata: Json
        }
        Insert: {
          id?: string
          name: string
          client: string
          status?: 'draft' | 'in-review' | 'presented'
          owner_id: string
          created_at?: string
          updated_at?: string
          metadata?: Json
        }
        Update: {
          id?: string
          name?: string
          client?: string
          status?: 'draft' | 'in-review' | 'presented'
          owner_id?: string
          created_at?: string
          updated_at?: string
          metadata?: Json
        }
      }
      canvas_components: {
        Row: {
          id: string
          case_id: string
          type: 'metric-card' | 'interactive-chart' | 'data-table' | 'narrative-block'
          position_x: number
          position_y: number
          width: number
          height: number
          props: Json
          created_by: string
          created_at: string
          modified_at: string
          is_dirty: boolean
        }
        Insert: {
          id?: string
          case_id: string
          type: 'metric-card' | 'interactive-chart' | 'data-table' | 'narrative-block'
          position_x?: number
          position_y?: number
          width?: number
          height?: number
          props?: Json
          created_by?: string
          created_at?: string
          modified_at?: string
          is_dirty?: boolean
        }
        Update: {
          id?: string
          case_id?: string
          type?: 'metric-card' | 'interactive-chart' | 'data-table' | 'narrative-block'
          position_x?: number
          position_y?: number
          width?: number
          height?: number
          props?: Json
          created_by?: string
          created_at?: string
          modified_at?: string
          is_dirty?: boolean
        }
      }
      component_history: {
        Row: {
          id: string
          component_id: string
          action_type: 'created' | 'updated' | 'deleted' | 'moved' | 'resized'
          actor: string
          changes: Json
          timestamp: string
        }
        Insert: {
          id?: string
          component_id: string
          action_type: 'created' | 'updated' | 'deleted' | 'moved' | 'resized'
          actor: string
          changes?: Json
          timestamp?: string
        }
        Update: {
          id?: string
          component_id?: string
          action_type?: 'created' | 'updated' | 'deleted' | 'moved' | 'resized'
          actor?: string
          changes?: Json
          timestamp?: string
        }
      }
      agent_activities: {
        Row: {
          id: string
          case_id: string
          agent_name: string
          activity_type: 'suggestion' | 'calculation' | 'visualization' | 'narrative' | 'data-import'
          title: string
          content: string
          metadata: Json
          timestamp: string
        }
        Insert: {
          id?: string
          case_id: string
          agent_name: string
          activity_type: 'suggestion' | 'calculation' | 'visualization' | 'narrative' | 'data-import'
          title: string
          content: string
          metadata?: Json
          timestamp?: string
        }
        Update: {
          id?: string
          case_id?: string
          agent_name?: string
          activity_type?: 'suggestion' | 'calculation' | 'visualization' | 'narrative' | 'data-import'
          title?: string
          content?: string
          metadata?: Json
          timestamp?: string
        }
      }
      performance_metrics: {
        Row: {
          id: string
          session_id: string | null
          agent_id: string | null
          operation: string
          duration_ms: number
          alert_threshold_ms: number | null
          alert_triggered: boolean | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id?: string | null
          agent_id?: string | null
          operation: string
          duration_ms: number
          alert_threshold_ms?: number | null
          alert_triggered?: boolean | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string | null
          agent_id?: string | null
          operation?: string
          duration_ms?: number
          alert_threshold_ms?: number | null
          alert_triggered?: boolean | null
          metadata?: Json | null
          created_at?: string
        }
      }
      component_relationships: {
        Row: {
          id: string
          source_component_id: string
          target_component_id: string
          relationship_type: 'depends_on' | 'updates' | 'calculates'
          created_at: string
        }
        Insert: {
          id?: string
          source_component_id: string
          target_component_id: string
          relationship_type: 'depends_on' | 'updates' | 'calculates'
          created_at?: string
        }
        Update: {
          id?: string
          source_component_id?: string
          target_component_id?: string
          relationship_type?: 'depends_on' | 'updates' | 'calculates'
          created_at?: string
        }
      }
    }
  }
}
