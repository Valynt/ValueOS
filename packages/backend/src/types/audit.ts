/**
 * Audit log types matching the audit_logs table schema.
 * Column names are snake_case to match Supabase row returns.
 */

export interface AuditLogEntry {
  id: string;
  tenant_id: string | null;
  organization_id: string | null;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  session_id: string | null;
  status: "success" | "failed";
  timestamp: string;
  integrity_hash: string | null;
  previous_hash: string | null;
  archived: boolean;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}
