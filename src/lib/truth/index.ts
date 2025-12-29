/**
 * Ground Truth Module Index
 * 
 * 4-Layer Truth Architecture exports
 */

export {
  // Types
  SourceType,
  Citation,
  ReasoningStep,
  ReasoningChain,
  IntegrityCheckRequest,
  IntegrityCheckResult,
  IntegrityIssue,
  IntegrityError,
  IIntegrityAgent,
  
  // Citation enforcement (Layer 2)
  parseCitations,
  findUncitedClaims,
  verifyCitations,
  validateCitedSources,
  
  // Reasoning chain (Layer 3)
  createReasoningChain,
  addReasoningStep,
  finalizeReasoningChain,
  
  // Integrity agent (Layer 1)
  DefaultIntegrityAgent,
  getIntegrityAgent,
  setIntegrityAgent,
} from './GroundTruthEngine';
