/**
 * Human-in-the-Loop (HITL) Framework (VOS-HITL-001)
 * 
 * Implements the approval workflow for high-risk agent actions:
 * - HITL gate definition and registry
 * - Approval workflow state machine
 * - Timeout and escalation handling
 * - Approval delegation rules
 * 
 * @see /docs/PHASE4_PLUS_ENTERPRISE_TICKETS.md - VOS-HITL-001
 * @author Enterprise Agentic Architect
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../logger';
import { AgentIdentity, HITL_ACTION_REGISTRY, RiskLevel } from '../auth/AgentIdentity';

const logger = createLogger({ component: 'HITLFramework' });

// ============================================================================
// Types
// ============================================================================

/**
 * HITL Gate Definition
 */
export interface HITLGate {
  /** Unique gate ID */
  id: string;
  /** Action type this gate applies to */
  action: string;
  /** Risk level */
  riskLevel: RiskLevel;
  /** Number of approvals required */
  requiredApprovers: number;
  /** Roles that can approve */
  approverRoles: string[];
  /** Timeout in seconds */
  timeoutSeconds: number;
  /** Escalation path (ordered list of roles) */
  escalationPath: string[];
  /** Conditions for auto-approval */
  autoApproveConditions?: {
    maxAmount?: number;
    maxRecords?: number;
    allowedHours?: [number, number];
    trustedAgents?: string[];
  };
  /** Whether gate is enabled */
  enabled: boolean;
}

/**
 * Approval request status
 */
export type ApprovalStatus = 
  | 'pending' 
  | 'approved' 
  | 'rejected' 
  | 'escalated' 
  | 'expired' 
  | 'auto_approved'
  | 'cancelled';

/**
 * Individual approval record
 */
export interface Approval {
  /** Approver user ID */
  approverId: string;
  /** Approver role */
  approverRole: string;
  /** Decision */
  decision: 'approve' | 'reject';
  /** Reason for decision */
  reason?: string;
  /** Timestamp */
  timestamp: string;
  /** IP address */
  ipAddress?: string;
}

/**
 * Approval request
 */
export interface ApprovalRequest {
  /** Unique request ID */
  id: string;
  /** Associated gate */
  gateId: string;
  /** Gate configuration snapshot */
  gate: HITLGate;
  /** Requesting agent */
  agent: {
    id: string;
    role: string;
    organizationId: string;
  };
  /** Action details */
  action: {
    type: string;
    description: string;
    impact: string;
    reversible: boolean;
  };
  /** Data preview */
  data: {
    preview: Record<string, unknown>;
    affectedRecords: number;
    estimatedDuration?: number;
  };
  /** Current status */
  status: ApprovalStatus;
  /** Collected approvals */
  approvals: Approval[];
  /** Rejections */
  rejections: Approval[];
  /** Current escalation level (0 = not escalated) */
  escalationLevel: number;
  /** Timestamps */
  createdAt: string;
  expiresAt: string;
  resolvedAt?: string;
  /** Audit token */
  auditToken: string;
  /** Organization ID */
  organizationId: string;
}

/**
 * HITL decision callback
 */
export type HITLDecisionCallback = (
  request: ApprovalRequest,
  decision: 'approved' | 'rejected' | 'expired'
) => Promise<void>;

/**
 * HITL notification callback
 */
export type HITLNotificationCallback = (
  request: ApprovalRequest,
  event: 'created' | 'escalated' | 'reminder' | 'resolved'
) => Promise<void>;

// ============================================================================
// HITL Gate Registry
// ============================================================================

/**
 * Convert HITL_ACTION_REGISTRY to full HITLGate objects
 */
function createGatesFromRegistry(): Map<string, HITLGate> {
  const gates = new Map<string, HITLGate>();
  
  for (const [action, config] of Object.entries(HITL_ACTION_REGISTRY)) {
    gates.set(action, {
      id: `gate:${action.replace(/:/g, '_')}`,
      action,
      riskLevel: config.riskLevel,
      requiredApprovers: config.requiredApprovers,
      approverRoles: config.approverRoles,
      timeoutSeconds: config.timeoutSeconds,
      escalationPath: ['manager', 'director', 'vp', 'cto'],
      autoApproveConditions: config.autoApproveConditions as HITLGate['autoApproveConditions'],
      enabled: true,
    });
  }
  
  return gates;
}

// ============================================================================
// HITL Framework
// ============================================================================

/**
 * HITL Framework
 * Manages Human-in-the-Loop approval workflows
 */
export class HITLFramework {
  private static instance: HITLFramework;
  
  /** Registered gates */
  private gates: Map<string, HITLGate>;
  
  /** Pending approval requests */
  private pendingRequests: Map<string, ApprovalRequest> = new Map();
  
  /** Request history */
  private requestHistory: ApprovalRequest[] = [];
  
  /** Decision callbacks */
  private decisionCallbacks: Map<string, HITLDecisionCallback> = new Map();
  
  /** Notification callbacks */
  private notificationCallback: HITLNotificationCallback | null = null;
  
  /** Expiration check interval */
  private expirationCheckInterval: NodeJS.Timeout | null = null;
  
  /** Reminder interval */
  private reminderInterval: NodeJS.Timeout | null = null;
  
  private constructor() {
    this.gates = createGatesFromRegistry();
    this.startExpirationCheck();
    this.startReminderCheck();
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(): HITLFramework {
    if (!HITLFramework.instance) {
      HITLFramework.instance = new HITLFramework();
    }
    return HITLFramework.instance;
  }
  
  /**
   * Register a HITL gate
   */
  registerGate(gate: HITLGate): void {
    this.gates.set(gate.action, gate);
    logger.info('HITL gate registered', { gateId: gate.id, action: gate.action });
  }
  
  /**
   * Check if an action requires HITL approval
   */
  requiresApproval(action: string): boolean {
    const gate = this.gates.get(action);
    return gate?.enabled ?? false;
  }
  
  /**
   * Get gate for an action
   */
  getGate(action: string): HITLGate | undefined {
    return this.gates.get(action);
  }
  
  /**
   * Request approval for an action
   */
  async requestApproval(
    agent: AgentIdentity,
    action: string,
    actionDetails: {
      description: string;
      impact: string;
      reversible: boolean;
    },
    data: {
      preview: Record<string, unknown>;
      affectedRecords: number;
      estimatedDuration?: number;
    }
  ): Promise<ApprovalRequest> {
    const gate = this.gates.get(action);
    if (!gate) {
      throw new Error(`No HITL gate defined for action: ${action}`);
    }
    
    if (!gate.enabled) {
      throw new Error(`HITL gate for action ${action} is disabled`);
    }
    
    // Check auto-approval conditions
    if (this.canAutoApprove(gate, data, agent)) {
      const autoApprovedRequest = this.createRequest(gate, agent, actionDetails, data);
      autoApprovedRequest.status = 'auto_approved';
      autoApprovedRequest.resolvedAt = new Date().toISOString();
      this.requestHistory.push(autoApprovedRequest);
      
      logger.info('HITL request auto-approved', {
        requestId: autoApprovedRequest.id,
        action,
        reason: 'Met auto-approval conditions',
      });
      
      return autoApprovedRequest;
    }
    
    // Create pending request
    const request = this.createRequest(gate, agent, actionDetails, data);
    this.pendingRequests.set(request.id, request);
    
    // Notify approvers
    if (this.notificationCallback) {
      await this.notificationCallback(request, 'created');
    }
    
    logger.info('HITL approval request created', {
      requestId: request.id,
      action,
      gateId: gate.id,
      requiredApprovers: gate.requiredApprovers,
      expiresAt: request.expiresAt,
    });
    
    return request;
  }
  
  /**
   * Submit an approval decision
   */
  async submitDecision(
    requestId: string,
    approverId: string,
    approverRole: string,
    decision: 'approve' | 'reject',
    options: {
      reason?: string;
      ipAddress?: string;
    } = {}
  ): Promise<ApprovalRequest> {
    const request = this.pendingRequests.get(requestId);
    if (!request) {
      throw new Error(`Approval request not found: ${requestId}`);
    }
    
    if (request.status !== 'pending' && request.status !== 'escalated') {
      throw new Error(`Request ${requestId} is not pending approval`);
    }
    
    // Validate approver role
    if (!this.canApprove(request, approverRole)) {
      throw new Error(`Role ${approverRole} cannot approve this request`);
    }
    
    // Check for duplicate approval
    if (request.approvals.some(a => a.approverId === approverId)) {
      throw new Error(`User ${approverId} has already approved this request`);
    }
    
    const approval: Approval = {
      approverId,
      approverRole,
      decision,
      reason: options.reason,
      timestamp: new Date().toISOString(),
      ipAddress: options.ipAddress,
    };
    
    if (decision === 'approve') {
      request.approvals.push(approval);
      
      // Check if we have enough approvals
      if (request.approvals.length >= request.gate.requiredApprovers) {
        request.status = 'approved';
        request.resolvedAt = new Date().toISOString();
        this.resolveRequest(request, 'approved');
      }
    } else {
      request.rejections.push(approval);
      request.status = 'rejected';
      request.resolvedAt = new Date().toISOString();
      this.resolveRequest(request, 'rejected');
    }
    
    logger.info('HITL decision submitted', {
      requestId,
      approverId,
      decision,
      currentApprovals: request.approvals.length,
      requiredApprovals: request.gate.requiredApprovers,
      status: request.status,
    });
    
    return request;
  }
  
  /**
   * Cancel an approval request
   */
  async cancelRequest(requestId: string, reason?: string): Promise<void> {
    const request = this.pendingRequests.get(requestId);
    if (!request) {
      throw new Error(`Approval request not found: ${requestId}`);
    }
    
    request.status = 'cancelled';
    request.resolvedAt = new Date().toISOString();
    
    this.pendingRequests.delete(requestId);
    this.requestHistory.push(request);
    
    logger.info('HITL request cancelled', { requestId, reason });
  }
  
  /**
   * Get pending requests for an approver
   */
  getPendingForApprover(approverRole: string): ApprovalRequest[] {
    const requests: ApprovalRequest[] = [];
    
    for (const request of this.pendingRequests.values()) {
      if (this.canApprove(request, approverRole)) {
        requests.push(request);
      }
    }
    
    return requests.sort((a, b) => {
      // Sort by risk level (critical first) then by creation time
      const riskOrder: Record<RiskLevel, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      const riskDiff = riskOrder[a.gate.riskLevel] - riskOrder[b.gate.riskLevel];
      if (riskDiff !== 0) return riskDiff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }
  
  /**
   * Get request by ID
   */
  getRequest(requestId: string): ApprovalRequest | undefined {
    return this.pendingRequests.get(requestId) || 
           this.requestHistory.find(r => r.id === requestId);
  }
  
  /**
   * Get request history for an organization
   */
  getRequestHistory(
    organizationId: string,
    options: {
      startTime?: Date;
      endTime?: Date;
      status?: ApprovalStatus;
      limit?: number;
    } = {}
  ): ApprovalRequest[] {
    let requests = this.requestHistory.filter(r => r.organizationId === organizationId);
    
    if (options.startTime) {
      requests = requests.filter(r => new Date(r.createdAt) >= options.startTime!);
    }
    if (options.endTime) {
      requests = requests.filter(r => new Date(r.createdAt) <= options.endTime!);
    }
    if (options.status) {
      requests = requests.filter(r => r.status === options.status);
    }
    
    requests.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    if (options.limit) {
      requests = requests.slice(0, options.limit);
    }
    
    return requests;
  }
  
  /**
   * Register a decision callback
   */
  onDecision(requestId: string, callback: HITLDecisionCallback): void {
    this.decisionCallbacks.set(requestId, callback);
  }
  
  /**
   * Set the notification callback
   */
  setNotificationCallback(callback: HITLNotificationCallback): void {
    this.notificationCallback = callback;
  }
  
  /**
   * Get pending request count
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }
  
  /**
   * Get stats
   */
  getStats(): {
    pending: number;
    approved: number;
    rejected: number;
    expired: number;
    autoApproved: number;
  } {
    const stats = {
      pending: this.pendingRequests.size,
      approved: 0,
      rejected: 0,
      expired: 0,
      autoApproved: 0,
    };
    
    for (const request of this.requestHistory) {
      switch (request.status) {
        case 'approved':
          stats.approved++;
          break;
        case 'rejected':
          stats.rejected++;
          break;
        case 'expired':
          stats.expired++;
          break;
        case 'auto_approved':
          stats.autoApproved++;
          break;
      }
    }
    
    return stats;
  }
  
  /**
   * Create an approval request
   */
  private createRequest(
    gate: HITLGate,
    agent: AgentIdentity,
    actionDetails: { description: string; impact: string; reversible: boolean },
    data: { preview: Record<string, unknown>; affectedRecords: number; estimatedDuration?: number }
  ): ApprovalRequest {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + gate.timeoutSeconds * 1000);
    
    return {
      id: `hitl:${uuidv4()}`,
      gateId: gate.id,
      gate: { ...gate },
      agent: {
        id: agent.id,
        role: agent.role,
        organizationId: agent.organizationId,
      },
      action: {
        type: gate.action,
        description: actionDetails.description,
        impact: actionDetails.impact,
        reversible: actionDetails.reversible,
      },
      data,
      status: 'pending',
      approvals: [],
      rejections: [],
      escalationLevel: 0,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      auditToken: agent.auditToken,
      organizationId: agent.organizationId,
    };
  }
  
  /**
   * Check if auto-approval conditions are met
   */
  private canAutoApprove(
    gate: HITLGate,
    data: { affectedRecords: number },
    agent: AgentIdentity
  ): boolean {
    const conditions = gate.autoApproveConditions;
    if (!conditions) return false;
    
    // Check record count
    if (conditions.maxRecords !== undefined && data.affectedRecords > conditions.maxRecords) {
      return false;
    }
    
    // Check trusted agents
    if (conditions.trustedAgents && !conditions.trustedAgents.includes(agent.id)) {
      return false;
    }
    
    // Check allowed hours
    if (conditions.allowedHours) {
      const hour = new Date().getHours();
      const [start, end] = conditions.allowedHours;
      if (hour < start || hour > end) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Check if a role can approve a request
   */
  private canApprove(request: ApprovalRequest, approverRole: string): boolean {
    // Check if role is in original approver roles
    if (request.gate.approverRoles.includes(approverRole)) {
      return true;
    }
    
    // Check escalation path (only if escalated)
    if (request.escalationLevel > 0) {
      const escalationIndex = request.gate.escalationPath.indexOf(approverRole);
      if (escalationIndex !== -1 && escalationIndex < request.escalationLevel) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Resolve a request and trigger callbacks
   */
  private async resolveRequest(
    request: ApprovalRequest,
    decision: 'approved' | 'rejected' | 'expired'
  ): Promise<void> {
    this.pendingRequests.delete(request.id);
    this.requestHistory.push(request);
    
    // Trigger decision callback
    const callback = this.decisionCallbacks.get(request.id);
    if (callback) {
      try {
        await callback(request, decision);
      } catch (error) {
        logger.error('HITL decision callback error', { requestId: request.id, error });
      }
      this.decisionCallbacks.delete(request.id);
    }
    
    // Trigger notification
    if (this.notificationCallback) {
      try {
        await this.notificationCallback(request, 'resolved');
      } catch (error) {
        logger.error('HITL notification callback error', { requestId: request.id, error });
      }
    }
  }
  
  /**
   * Escalate a request
   */
  private async escalateRequest(request: ApprovalRequest): Promise<void> {
    if (request.escalationLevel >= request.gate.escalationPath.length) {
      // No more escalation levels, expire the request
      request.status = 'expired';
      request.resolvedAt = new Date().toISOString();
      await this.resolveRequest(request, 'expired');
      return;
    }
    
    request.escalationLevel++;
    request.status = 'escalated';
    
    // Extend timeout
    const newExpiresAt = new Date(
      Date.now() + (request.gate.timeoutSeconds / 2) * 1000
    );
    request.expiresAt = newExpiresAt.toISOString();
    
    logger.warn('HITL request escalated', {
      requestId: request.id,
      escalationLevel: request.escalationLevel,
      newApproverRole: request.gate.escalationPath[request.escalationLevel - 1],
    });
    
    if (this.notificationCallback) {
      await this.notificationCallback(request, 'escalated');
    }
  }
  
  /**
   * Start expiration check interval
   */
  private startExpirationCheck(): void {
    this.expirationCheckInterval = setInterval(async () => {
      const now = new Date();
      
      for (const request of this.pendingRequests.values()) {
        const expiresAt = new Date(request.expiresAt);
        
        if (now > expiresAt) {
          // Try to escalate first
          if (request.escalationLevel < request.gate.escalationPath.length) {
            await this.escalateRequest(request);
          } else {
            // All escalation levels exhausted
            request.status = 'expired';
            request.resolvedAt = now.toISOString();
            await this.resolveRequest(request, 'expired');
            
            logger.warn('HITL request expired', { requestId: request.id });
          }
        }
      }
    }, 30000); // Check every 30 seconds
  }
  
  /**
   * Start reminder check interval
   */
  private startReminderCheck(): void {
    this.reminderInterval = setInterval(async () => {
      const now = new Date();
      
      for (const request of this.pendingRequests.values()) {
        const createdAt = new Date(request.createdAt);
        const ageMs = now.getTime() - createdAt.getTime();
        
        // Send reminder at 50% of timeout
        const reminderThreshold = (request.gate.timeoutSeconds * 1000) / 2;
        
        if (ageMs >= reminderThreshold && ageMs < reminderThreshold + 60000) {
          if (this.notificationCallback) {
            await this.notificationCallback(request, 'reminder');
          }
        }
      }
    }, 60000); // Check every minute
  }
  
  /**
   * Destroy the framework
   */
  destroy(): void {
    if (this.expirationCheckInterval) {
      clearInterval(this.expirationCheckInterval);
      this.expirationCheckInterval = null;
    }
    if (this.reminderInterval) {
      clearInterval(this.reminderInterval);
      this.reminderInterval = null;
    }
    this.pendingRequests.clear();
    this.decisionCallbacks.clear();
  }
}

// ============================================================================
// Exports
// ============================================================================

export const hitlFramework = HITLFramework.getInstance();

export default {
  HITLFramework,
  hitlFramework,
};
