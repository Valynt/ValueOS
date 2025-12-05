/**
 * SOF Governance and Audit Service
 * 
 * Service layer for managing governance controls and audit events.
 */

import { supabase } from './supabase';
import type {
  SOFGovernanceControl,
  CreateGovernanceControl,
  SOFAuditEvent,
  CreateAuditEvent,
  GovernanceComplianceResult,
  AuditTrailEntry,
  CreateLifecycleArtifactLink,
  LifecycleArtifactLink,
} from '../types/sof-governance';

// ============================================================================
// Governance Control Management
// ============================================================================

/**
 * Create a new governance control
 */
export async function createGovernanceControl(
  control: CreateGovernanceControl
): Promise<SOFGovernanceControl> {
  const { data, error } = await supabase
    .from('sof_governance_controls')
    .insert(control)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get all governance controls for a business case
 */
export async function getGovernanceControls(
  businessCaseId: string
): Promise<SOFGovernanceControl[]> {
  const { data, error } = await supabase
    .from('sof_governance_controls')
    .select('*')
    .eq('business_case_id', businessCaseId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get governance controls for a specific system map
 */
export async function getSystemMapGovernanceControls(
  systemMapId: string
): Promise<SOFGovernanceControl[]> {
  const { data, error } = await supabase
    .from('sof_governance_controls')
    .select('*')
    .eq('system_map_id', systemMapId)
    .order('enforcement_level', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Update governance control compliance status
 */
export async function updateControlCompliance(
  controlId: string,
  complianceStatus: SOFGovernanceControl['compliance_status'],
  evidence?: any[]
): Promise<SOFGovernanceControl> {
  const updateData: any = {
    compliance_status: complianceStatus,
    last_reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (evidence) {
    updateData.compliance_evidence = evidence;
  }

  const { data, error } = await supabase
    .from('sof_governance_controls')
    .update(updateData)
    .eq('id', controlId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Approve or reject a governance control
 */
export async function approveGovernanceControl(
  controlId: string,
  approved: boolean,
  notes?: string
): Promise<SOFGovernanceControl> {
  const { data: userData } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('sof_governance_controls')
    .update({
      approval_status: approved ? 'approved' : 'rejected',
      approved_by: userData?.user?.id,
      approved_at: new Date().toISOString(),
      approval_notes: notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', controlId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Check governance compliance for a business case
 */
export async function checkGovernanceCompliance(
  businessCaseId: string
): Promise<GovernanceComplianceResult> {
  const { data, error } = await supabase
    .rpc('check_sof_governance_compliance', {
      p_business_case_id: businessCaseId,
    })
    .single();

  if (error) throw error;
  return data;
}

// ============================================================================
// Audit Event Management
// ============================================================================

/**
 * Create an audit event
 */
export async function createAuditEvent(
  event: CreateAuditEvent
): Promise<SOFAuditEvent> {
  const { data, error } = await supabase
    .from('sof_audit_events')
    .insert(event)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get audit events for a business case
 */
export async function getAuditEvents(
  businessCaseId: string,
  limit: number = 100
): Promise<SOFAuditEvent[]> {
  const { data, error } = await supabase
    .from('sof_audit_events')
    .select('*')
    .eq('business_case_id', businessCaseId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

/**
 * Get audit trail for a specific SOF entity
 */
export async function getEntityAuditTrail(
  entityType: 'system_map' | 'entity' | 'relationship' | 'intervention' | 'outcome' | 'feedback_loop',
  entityId: string
): Promise<AuditTrailEntry[]> {
  const { data, error } = await supabase
    .rpc('get_sof_entity_audit_trail', {
      p_entity_type: entityType,
      p_entity_id: entityId,
    });

  if (error) throw error;
  return data || [];
}

/**
 * Get audit events by type
 */
export async function getAuditEventsByType(
  businessCaseId: string,
  eventType: SOFAuditEvent['event_type']
): Promise<SOFAuditEvent[]> {
  const { data, error } = await supabase
    .from('sof_audit_events')
    .select('*')
    .eq('business_case_id', businessCaseId)
    .eq('event_type', eventType)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// ============================================================================
// Lifecycle Artifact Link Management
// ============================================================================

/**
 * Create a lifecycle artifact link
 */
export async function createLifecycleLink(
  link: CreateLifecycleArtifactLink
): Promise<LifecycleArtifactLink> {
  const { data, error } = await supabase
    .rpc('create_sof_lifecycle_link', {
      p_source_stage: link.source_stage,
      p_source_type: link.source_type,
      p_source_id: link.source_artifact_id,
      p_target_stage: link.target_stage,
      p_target_type: link.target_type,
      p_target_id: link.target_artifact_id,
      p_relationship_type: link.relationship_type || 'derived_from',
      p_reasoning_trace: link.reasoning_trace || null,
    });

  if (error) throw error;

  // Fetch the created link
  const { data: linkData, error: fetchError } = await supabase
    .from('lifecycle_artifact_links')
    .select('*')
    .eq('id', data)
    .single();

  if (fetchError) throw fetchError;
  return linkData;
}

/**
 * Get lifecycle links for an artifact
 */
export async function getArtifactLinks(
  artifactId: string,
  direction: 'upstream' | 'downstream' | 'both' = 'both'
): Promise<LifecycleArtifactLink[]> {
  let query = supabase.from('lifecycle_artifact_links').select('*');

  if (direction === 'upstream' || direction === 'both') {
    query = query.or(`target_artifact_id.eq.${artifactId}`);
  }

  if (direction === 'downstream' || direction === 'both') {
    query = query.or(`source_artifact_id.eq.${artifactId}`);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get full lineage chain for an artifact
 */
export async function getArtifactLineage(
  artifactId: string
): Promise<{
  upstream: LifecycleArtifactLink[];
  downstream: LifecycleArtifactLink[];
}> {
  const [upstream, downstream] = await Promise.all([
    getArtifactLinks(artifactId, 'upstream'),
    getArtifactLinks(artifactId, 'downstream'),
  ]);

  return { upstream, downstream };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Log a system map creation event
 */
export async function logSystemMapCreated(
  businessCaseId: string,
  systemMapId: string,
  agentName: string,
  reasoningTrace?: string
): Promise<void> {
  await createAuditEvent({
    business_case_id: businessCaseId,
    system_map_id: systemMapId,
    event_type: 'system_map_created',
    event_description: `System map created by ${agentName}`,
    actor_type: 'agent',
    agent_name: agentName,
    reasoning_trace: reasoningTrace,
  });
}

/**
 * Log an intervention design event
 */
export async function logInterventionDesigned(
  businessCaseId: string,
  systemMapId: string,
  interventionPointId: string,
  agentName: string,
  reasoningTrace?: string
): Promise<void> {
  await createAuditEvent({
    business_case_id: businessCaseId,
    system_map_id: systemMapId,
    intervention_point_id: interventionPointId,
    event_type: 'intervention_designed',
    event_description: `Intervention point designed by ${agentName}`,
    actor_type: 'agent',
    agent_name: agentName,
    reasoning_trace: reasoningTrace,
  });
}

/**
 * Log a feedback loop closure event
 */
export async function logFeedbackLoopClosed(
  businessCaseId: string,
  feedbackLoopId: string,
  closureReason: string
): Promise<void> {
  await createAuditEvent({
    business_case_id: businessCaseId,
    feedback_loop_id: feedbackLoopId,
    event_type: 'feedback_loop_closed',
    event_description: `Feedback loop closed: ${closureReason}`,
    actor_type: 'system',
  });
}

/**
 * Log a behavior change observation
 */
export async function logBehaviorChange(
  businessCaseId: string,
  feedbackLoopId: string,
  changeDescription: string,
  observedData: any
): Promise<void> {
  await createAuditEvent({
    business_case_id: businessCaseId,
    feedback_loop_id: feedbackLoopId,
    event_type: 'behavior_change_observed',
    event_description: changeDescription,
    actor_type: 'system',
    new_state: observedData,
  });
}

/**
 * Create default governance controls for a new system map
 */
export async function createDefaultGovernanceControls(
  businessCaseId: string,
  systemMapId: string
): Promise<SOFGovernanceControl[]> {
  const defaultControls: CreateGovernanceControl[] = [
    {
      business_case_id: businessCaseId,
      system_map_id: systemMapId,
      control_type: 'ethical_review',
      control_name: 'Ethical Impact Assessment',
      control_description: 'Review potential ethical implications of system interventions',
      enforcement_level: 'warning',
      compliance_status: 'pending',
    },
    {
      business_case_id: businessCaseId,
      system_map_id: systemMapId,
      control_type: 'risk_mitigation',
      control_name: 'Risk Assessment',
      control_description: 'Identify and mitigate potential risks from system changes',
      enforcement_level: 'advisory',
      compliance_status: 'pending',
    },
    {
      business_case_id: businessCaseId,
      system_map_id: systemMapId,
      control_type: 'documentation_requirement',
      control_name: 'Intervention Documentation',
      control_description: 'Document all intervention designs and rationale',
      enforcement_level: 'advisory',
      compliance_status: 'pending',
    },
  ];

  const controls = await Promise.all(
    defaultControls.map((control) => createGovernanceControl(control))
  );

  return controls;
}
