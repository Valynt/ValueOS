/**
 * Audit Module Index
 * 
 * Exports all audit logging components for SOC 2 compliance
 */

// Audit Event Types (VOS-SEC-003)
export {
  ActorType,
  ActionResult,
  AuditSeverity,
  AuditCategory,
  SOC2ControlMapping,
  AuditActor,
  AuditAction,
  AuditContext,
  AuditDataChange,
  AuditIntegrity,
  AuditEvent,
  CreateAuditEventOptions,
  createAuditEvent,
  verifyEventChain,
  getSOC2Controls,
  redactPII,
  SOC2_CONTROL_MAPPINGS,
} from './AuditEvent';

// Enhanced Audit Logger (VOS-SEC-003)
export {
  EnhancedAuditLogger,
  AuditDestination,
  SIEMConfig,
  AuditLoggerConfig,
  AuditQueryOptions,
  AuditEventListener,
  enhancedAuditLogger,
} from './EnhancedAuditLogger';
