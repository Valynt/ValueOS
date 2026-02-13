/**
 * @valueos/agents/orchestration
 *
 * Multi-agent coordination: hypothesis-first core loop and Red Team agent.
 */

export {
  HypothesisLoop,
  ValueHypothesisSchema,
  LoopResultSchema,
  type ValueHypothesis,
  type ValueTree,
  type ValueTreeNode,
  type NarrativeBlock,
  type NarrativeSection,
  type LoopProgress,
  type LoopResult,
  type LoopConfig,
  type OpportunityAgentInterface,
  type FinancialModelingAgentInterface,
  type GroundTruthAgentInterface,
  type NarrativeAgentInterface,
  type SSEEmitter,
} from './HypothesisLoop.js';

export {
  RedTeamAgent,
  ObjectionSchema,
  RedTeamOutputSchema,
  type Objection,
  type RedTeamInput,
  type RedTeamOutput,
  type RedTeamLLMGateway,
} from './agents/RedTeamAgent.js';
