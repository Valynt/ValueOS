/**
 * Application Layer — Public API
 *
 * All use cases and types exported from this barrel.
 * Import from here, not from individual files.
 */

export type { UseCase, RequestContext, UseCaseResult } from './types.js';
export { buildRequestContext } from './types.js';

export { CreateValueCase } from './useCases/CreateValueCase.js';
export type { CreateValueCaseInput, CreatedValueCase, ValueCaseRepository } from './useCases/CreateValueCase.js';

export { RunDiscoveryWorkflow } from './useCases/RunDiscoveryWorkflow.js';
export type { RunDiscoveryWorkflowInput, DiscoveryWorkflowResult, DiscoveryAgentPort } from './useCases/RunDiscoveryWorkflow.js';

export { GenerateROIModel } from './useCases/GenerateROIModel.js';
export type { GenerateROIModelInput, ROIModelResult, ScenarioBuilderPort, HypothesisRepository, AssumptionRepository } from './useCases/GenerateROIModel.js';
