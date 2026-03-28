/**
 * Agent-UX Bridge — Core Domain Types
 *
 * These types form the contract between the backend agent system and the
 * frontend user experience. Every backend state, agent output, and async
 * event maps to a precise UI representation through these types.
 */

// ─── 1. STATE → EXPERIENCE MAPPING ──────────────────────────────────────────

/**
 * The canonical workflow lifecycle states from the backend saga orchestrator.
 * Each state maps to a distinct UI experience — never ambiguous.
 */
export type WorkflowState =
  | 'INITIATED'
  | 'DRAFTING'
  | 'VALIDATING'
  | 'COMPOSING'
  | 'REFINING'
  | 'FINALIZED';

/**
 * The 7-step hypothesis loop — the atomic unit of agent work.
 */
export type WorkflowStep =
  | 'hypothesis'
  | 'model'
  | 'evidence'
  | 'narrative'
  | 'objection'
  | 'revision'
  | 'approval';

/**
 * Maps every backend state to a precise UI experience descriptor.
 * This is the contract that prevents "what's happening?" confusion.
 */
export interface StateExperienceMap {
  state: WorkflowState;
  /** Human-readable label shown in the UI */
  label: string;
  /** Present-tense action description ("Assembling context...") */
  activeVerb: string;
  /** What the user should do next */
  nextAction: string;
  /** Whether the user can interact with the canvas */
  canEdit: boolean;
  /** Whether the user can approve/reject */
  canApprove: boolean;
  /** Whether the user can trigger red-team validation */
  canRedTeam: boolean;
  /** Visual theme for this state */
  theme: 'discovery' | 'building' | 'validating' | 'composing' | 'reviewing' | 'complete';
  /** Progress percentage (0-100) for this state */
  progressRange: [number, number];
}

export const STATE_EXPERIENCE_MAP: Record<WorkflowState, StateExperienceMap> = {
  INITIATED: {
    state: 'INITIATED',
    label: 'Discovery',
    activeVerb: 'Assembling opportunity context...',
    nextAction: 'Review extracted signals and confirm scope',
    canEdit: false,
    canApprove: false,
    canRedTeam: false,
    theme: 'discovery',
    progressRange: [0, 20],
  },
  DRAFTING: {
    state: 'DRAFTING',
    label: 'Modeling',
    activeVerb: 'Building value hypothesis...',
    nextAction: 'Review the draft model and fill any flagged gaps',
    canEdit: true,
    canApprove: false,
    canRedTeam: false,
    theme: 'building',
    progressRange: [20, 45],
  },
  VALIDATING: {
    state: 'VALIDATING',
    label: 'Validation',
    activeVerb: 'Verifying evidence and scoring confidence...',
    nextAction: 'Address any integrity warnings before proceeding',
    canEdit: false,
    canApprove: false,
    canRedTeam: true,
    theme: 'validating',
    progressRange: [45, 65],
  },
  COMPOSING: {
    state: 'COMPOSING',
    label: 'Composing',
    activeVerb: 'Generating executive artifacts...',
    nextAction: 'Preview and edit the generated outputs',
    canEdit: true,
    canApprove: false,
    canRedTeam: false,
    theme: 'composing',
    progressRange: [65, 80],
  },
  REFINING: {
    state: 'REFINING',
    label: 'Review',
    activeVerb: 'Awaiting your review...',
    nextAction: 'Approve the case or request revisions',
    canEdit: true,
    canApprove: true,
    canRedTeam: true,
    theme: 'reviewing',
    progressRange: [80, 95],
  },
  FINALIZED: {
    state: 'FINALIZED',
    label: 'Finalized',
    activeVerb: 'Business case locked and ready.',
    nextAction: 'Export artifacts or hand off to Customer Success',
    canEdit: false,
    canApprove: false,
    canRedTeam: false,
    theme: 'complete',
    progressRange: [100, 100],
  },
};

// ─── 2. AGENT OUTPUT → USER ARTIFACTS ────────────────────────────────────────

/**
 * Source classification for every data point — the foundation of trust.
 * Users can always see where a number came from.
 */
export type SourceClassification =
  | 'customer-confirmed'
  | 'internally-observed'
  | 'benchmark-derived'
  | 'inferred'
  | 'externally-researched'
  | 'sec-filing'
  | 'unsupported';

/**
 * A single piece of evidence backing a value claim.
 */
export interface Evidence {
  id: string;
  source: string;
  sourceType: SourceClassification;
  citation: string;
  url?: string;
  confidence: number; // 0-1
  retrievedAt: string;
  isStale: boolean;
  weight: number; // 0-1, relative importance
  excerpt?: string;
}

/**
 * A single node in the value tree — the atomic unit of business value.
 */
export interface ValueNode {
  id: string;
  label: string;
  category: 'efficiency' | 'revenue' | 'risk' | 'cost-avoidance' | 'strategic';
  value: number; // Annual USD
  unit: string;
  formula?: string;
  assumptions: Assumption[];
  evidence: Evidence[];
  confidence: number; // 0-1
  isLeaf: boolean;
  children?: string[]; // child node IDs
  metadata: {
    createdBy: string;
    lastModified: string;
    agentId?: string;
    version: number;
  };
}

/**
 * A single assumption backing a value calculation.
 */
export interface Assumption {
  id: string;
  label: string;
  value: number | string;
  unit?: string;
  source: SourceClassification;
  confidence: number;
  benchmarkRef?: string;
  isUnsupported: boolean;
  plausibilityFlag?: 'conservative' | 'base' | 'aggressive' | 'unrealistic';
}

/**
 * The full value graph — the core business object produced by agents.
 */
export interface ValueGraph {
  id: string;
  opportunityId: string;
  nodes: Record<string, ValueNode>;
  rootNodeId: string;
  scenarios: {
    conservative: ScenarioModel;
    base: ScenarioModel;
    upside: ScenarioModel;
  };
  totalValue: number;
  defensibilityScore: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * A financial scenario model (conservative / base / upside).
 */
export interface ScenarioModel {
  label: string;
  roi: number; // percentage
  npv: number; // USD
  paybackMonths: number;
  evf: number; // Economic Value Factor
  totalValue: number;
  assumptions: Record<string, number | string>;
}

/**
 * A value hypothesis — the top-level business claim.
 */
export interface ValueHypothesis {
  id: string;
  driver: string;
  estimatedImpactMin: number;
  estimatedImpactMax: number;
  evidenceTier: 'strong' | 'moderate' | 'weak' | 'unsupported';
  confidenceScore: number;
  status: 'pending' | 'accepted' | 'edited' | 'rejected';
  nodeId?: string;
}

/**
 * An executive artifact — the final output of the composing stage.
 */
export interface ExecutiveArtifact {
  id: string;
  type: 'executive-memo' | 'cfo-recommendation' | 'customer-narrative' | 'internal-case';
  title: string;
  content: string;
  isDraft: boolean;
  readinessScore: number;
  editHistory: ArtifactEdit[];
  generatedAt: string;
  financialClaims: FinancialClaim[];
}

export interface ArtifactEdit {
  userId: string;
  timestamp: string;
  section: string;
  before: string;
  after: string;
  reason?: string;
}

export interface FinancialClaim {
  id: string;
  text: string;
  value: number;
  nodeId: string;
  derivationChain: DerivationStep[];
}

export interface DerivationStep {
  label: string;
  value: string;
  source: string;
  agentId?: string;
  confidence: number;
}

// ─── 3. WORKFLOW → USER JOURNEY ───────────────────────────────────────────────

/**
 * A step in the user-facing journey — hides orchestration complexity.
 */
export interface JourneyStep {
  id: WorkflowStep;
  /** User-facing label (not agent terminology) */
  label: string;
  description: string;
  status: 'not_started' | 'active' | 'complete' | 'blocked' | 'skipped';
  owner: 'agent' | 'user' | 'both';
  blockingReason?: string;
  artifacts?: string[];
  startedAt?: string;
  completedAt?: string;
  estimatedDuration?: string;
}

/**
 * The full user journey — 4 phases that hide the 7-step loop.
 */
export interface UserJourney {
  phases: JourneyPhase[];
  currentPhaseId: string;
  overallProgress: number; // 0-100
}

export interface JourneyPhase {
  id: string;
  label: string;
  description: string;
  steps: WorkflowStep[];
  status: 'not_started' | 'active' | 'complete';
  workflowState: WorkflowState;
}

export const USER_JOURNEY_PHASES: JourneyPhase[] = [
  {
    id: 'discover',
    label: 'Discover',
    description: 'Ingest opportunity signals and extract structured context',
    steps: ['hypothesis'],
    status: 'not_started',
    workflowState: 'INITIATED',
  },
  {
    id: 'analyze',
    label: 'Analyze',
    description: 'Build the value model and gather supporting evidence',
    steps: ['model', 'evidence'],
    status: 'not_started',
    workflowState: 'DRAFTING',
  },
  {
    id: 'validate',
    label: 'Validate',
    description: 'Stress-test assumptions and score defensibility',
    steps: ['objection', 'revision'],
    status: 'not_started',
    workflowState: 'VALIDATING',
  },
  {
    id: 'decide',
    label: 'Decide',
    description: 'Generate executive artifacts and approve the business case',
    steps: ['narrative', 'approval'],
    status: 'not_started',
    workflowState: 'COMPOSING',
  },
];

// ─── 4. CONFIDENCE → TRUST LAYER ─────────────────────────────────────────────

/**
 * The defensibility score — the trust signal for the entire value case.
 */
export interface DefensibilityScore {
  global: number; // 0-1
  byNode: Record<string, number>;
  totalValue: number;
  backedValue: number;
  readinessLevel: 'presentation-ready' | 'needs-review' | 'blocked';
  issues: DefensibilityIssue[];
  lastCalculatedAt: string;
}

export interface DefensibilityIssue {
  id: string;
  type: 'evidence_gap' | 'low_confidence' | 'single_source' | 'stale_evidence' | 'unsupported_claim' | 'benchmark_mismatch';
  severity: 'info' | 'warning' | 'critical' | 'blocking';
  nodeId?: string;
  description: string;
  remediation: string;
  canAutoResolve: boolean;
}

/**
 * Confidence breakdown for a single value node.
 */
export interface NodeConfidence {
  nodeId: string;
  score: number;
  evidenceCoverage: number;
  sourceIndependence: number;
  auditTrailComplete: boolean;
  warnings: DefensibilityWarning[];
}

export interface DefensibilityWarning {
  type: 'low_coverage' | 'single_source' | 'stale_evidence' | 'aggressive_assumption';
  severity: 'warning' | 'critical';
  message: string;
  remediation: string;
}

// ─── 5. ASYNC SYSTEMS → SMOOTH FLOW ──────────────────────────────────────────

/**
 * A real-time agent activity event — drives the activity feed and progress.
 */
export interface AgentActivity {
  id: string;
  agentId: string;
  agentName: string;
  agentRole: 'discovery' | 'modeling' | 'integrity' | 'narrative' | 'red-team' | 'orchestrator';
  type: 'thinking' | 'tool_call' | 'result' | 'error' | 'checkpoint';
  message: string;
  detail?: string;
  timestamp: string;
  workflowStep: WorkflowStep;
  isStreaming: boolean;
  confidence?: number;
  toolName?: string;
  toolResult?: string;
}

/**
 * Workflow progress — drives the progress bar and status indicators.
 */
export interface WorkflowProgress {
  workflowId: string;
  currentState: WorkflowState;
  currentStep: WorkflowStep;
  percentComplete: number;
  completedSteps: WorkflowStep[];
  activeAgents: string[];
  estimatedTimeRemaining?: number; // seconds
  lastUpdatedAt: string;
  status: 'running' | 'paused' | 'blocked' | 'completed' | 'failed';
  statusMessage: string;
}

/**
 * A streaming token event — for typewriter-style output rendering.
 */
export interface StreamToken {
  id: string;
  workflowId: string;
  field: string; // e.g., "executive_summary", "hypothesis_text"
  token: string;
  isComplete: boolean;
  timestamp: string;
}

/**
 * A human checkpoint — requires user decision before workflow continues.
 */
export interface HumanCheckpoint {
  id: string;
  workflowId: string;
  type: 'approval' | 'gap_fill' | 'assumption_confirm' | 'override';
  title: string;
  description: string;
  context: Record<string, unknown>;
  options: CheckpointOption[];
  deadline?: string;
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number;
  createdAt: string;
}

export interface CheckpointOption {
  id: string;
  label: string;
  description: string;
  consequence: string;
  isDefault?: boolean;
}

// ─── OPPORTUNITY CONTEXT ──────────────────────────────────────────────────────

/**
 * The assembled opportunity context — the starting point of every workflow.
 */
export interface OpportunityContext {
  id: string;
  name: string;
  accountName: string;
  industry: string;
  revenue: number;
  employees: number;
  stage: string;
  closeDate: string;
  stakeholders: Stakeholder[];
  painSignals: PainSignal[];
  useCases: string[];
  missingDataFlags: MissingDataFlag[];
  sources: ContextSource[];
  assembledAt: string;
}

export interface Stakeholder {
  id: string;
  name: string;
  title: string;
  role: 'champion' | 'economic-buyer' | 'technical-buyer' | 'blocker' | 'influencer';
  sentiment: 'positive' | 'neutral' | 'negative' | 'unknown';
  source: string;
}

export interface PainSignal {
  id: string;
  description: string;
  severity: 'critical' | 'significant' | 'minor';
  source: string;
  mentionCount: number;
  linkedValueDrivers: string[];
}

export interface MissingDataFlag {
  id: string;
  field: string;
  description: string;
  impact: 'blocking' | 'high' | 'medium' | 'low';
  resolved: boolean;
  resolvedValue?: string;
}

export interface ContextSource {
  type: 'crm' | 'call-transcript' | 'email' | 'sec-filing' | 'web-research' | 'manual';
  name: string;
  retrievedAt: string;
  itemCount: number;
}
