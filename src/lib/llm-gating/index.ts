/**
 * LLM Gating Module
 *
 * Comprehensive gating system based on:
 * "Gated Attention for Large Language Models: Non-linearity, Sparsity, and Attention-Sink-Free"
 *
 * Provides:
 * 1. Architectural Gating: Model selection based on MoE/sparse attention capabilities
 * 2. Application Gating: Pre/post invocation gates for security and quality
 *
 * @module llm-gating
 */

// Types
export * from './types';

// Model Registry
export {
  MODEL_REGISTRY,
  getModelTraits,
  selectBestModel,
  getRAGSuitableModels,
  getFineTuningSuitableModels,
  hasGatedArchitecture,
  getCostEffectiveAlternative,
} from './ModelRegistry';

// Pre-Invocation Gates
export {
  CostGate,
  ComplianceGate,
  TenantIsolationGate,
  PreInvocationGateManager,
  createDefaultPreInvocationGates,
} from './PreInvocationGates';

// Post-Invocation Gates
export {
  ConfidenceGate,
  HallucinationGate,
  PostInvocationGateManager,
  createDefaultPostInvocationGates,
} from './PostInvocationGates';

// Gated Gateway
export {
  GatedLLMGateway,
  createGatedLLMGateway,
  type GatedLLMConfig,
  type GatedLLMResponse,
} from './GatedLLMGateway';
