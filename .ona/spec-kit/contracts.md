# ValueOS Feature Contracts
## Component Interface Specifications

### Version
1.0.0

---

## 1. Frontend Contracts

### 1.1 Value Tree Visualization Component

**Interface:** `ValueTreeRenderer`

**Props:**
```typescript
interface ValueTreeRendererProps {
  treeId: string;
  mode: 'interactive' | 'static' | 'export';
  depthLimit?: number;           // Default: 5
  showConfidence: boolean;       // Default: true
  onNodeClick?: (nodeId: string) => void;
  tenantId: string;            // Required
}
```

**Events:**
- `tree:node:selected` - User clicked node
- `tree:depth:changed` - User expanded/collapsed level
- `tree:export:requested` - User requested PNG/SVG export

**Data Contract:**
```typescript
interface ValueTreeNode {
  id: string;
  label: string;
  type: 'driver' | 'formula' | 'input' | 'output' | 'assumption';
  value?: number | string;
  confidence?: number;
  children?: ValueTreeNode[];
  metadata: {
    formula?: string;
    source?: string;
    editable: boolean;
  };
}
```

---

### 1.2 Hypothesis Builder Component

**Interface:** `HypothesisBuilder`

**Props:**
```typescript
interface HypothesisBuilderProps {
  initialMetric?: string;
  suggestions: MetricSuggestion[];
  onSubmit: (hypothesis: HypothesisDraft) => Promise<ValidationResult>;
  tenantId: string;
}

interface MetricSuggestion {
  metric: string;
  category: 'cash_flow' | 'cost' | 'revenue';
  typicalRange: [number, number];
  rationale: string;
}
```

**State Machine Integration:**
- Emits `hypothesis:draft:created` event
- Validates against `/api/v1/hypothesis/validate` before submission
- Displays confidence preview before commit

---

### 1.3 Objection Explorer Component

**Interface:** `ObjectionExplorer`

**Props:**
```typescript
interface ObjectionExplorerProps {
  workflowId: string;
  objections: Objection[];
  onResolve: (objectionId: string, resolution: Resolution) => void;
  onEscalate: (objectionId: string) => void;
  readOnly: boolean;
  tenantId: string;
}

interface Objection {
  id: string;
  type: 'assumption' | 'data_quality' | 'model_logic' | 'risk';
  severity: 'info' | 'warning' | 'critical';
  description: string;
  suggestedFix?: string;
  status: 'open' | 'addressed' | 'overridden';
}
```

---

## 2. Backend for Frontend (BFF) Contracts

### 2.1 Session Orchestration API

**Endpoint:** `POST /api/v1/sessions`

**Request:**
```typescript
interface CreateSessionRequest {
  tenantId: string;
  userId: string;
  opportunityId?: string;
  workflowType: 'standard' | 'parallel' | 'expedited';
  context?: Record<string, unknown>;
}
```

**Response:**
```typescript
interface CreateSessionResponse {
  sessionId: string;
  workflowId: string;
  initialState: WorkflowState;
  estimatedDuration: number;     // Minutes
  requiredApprovals: string[];
}
```

---

### 2.2 Workflow State API

**Endpoint:** `GET /api/v1/workflows/{workflowId}/state`

**Response:**
```typescript
interface WorkflowStateResponse {
  workflowId: string;
  currentStage: LifecycleStage;
  status: 'active' | 'paused' | 'completed' | 'failed';
  artifacts: ArtifactSummary[];
  pendingApprovals: ApprovalRequest[];
  nextActions: ActionOption[];
  tenantId: string;
}

interface ActionOption {
  action: string;
  label: string;
  enabled: boolean;
  reason?: string;               // Why disabled if not enabled
}
```

---

### 2.3 Evidence Retrieval API

**Endpoint:** `POST /api/v1/evidence/retrieve`

**Request:**
```typescript
interface EvidenceRetrievalRequest {
  hypothesisId: string;
  requiredMetrics: string[];
  sources: SourceType[];
  confidenceThreshold: number;
  tenantId: string;
}

type SourceType = 'sec_edgar' | 'benchmark' | 'crm' | 'erp' | 'internal';
```

**Response:**
```typescript
interface EvidenceRetrievalResponse {
  evidenceId: string;
  sources: RetrievedSource[];
  aggregateConfidence: number;
  gaps: DataGap[];
  estimatedCompletion: number;   // 0-1 coverage ratio
}

interface DataGap {
  metric: string;
  severity: 'blocking' | 'degrading' | 'minor';
  alternatives: string[];        // Suggested proxy metrics
}
```

---

## 3. Backend for Agents (BFA) Contracts

### 3.1 Agent Execution Interface

**All agents implement:**
```typescript
interface Agent<TInput, TOutput> {
  name: string;
  version: string;
  lifecycleStage: LifecycleStage;
  
  execute(
    input: TInput,
    context: AgentContext
  ): Promise<AgentResult<TOutput>>;
  
  validate(output: TOutput): ValidationResult;
  compensate?(executionId: string): Promise<void>;
}

interface AgentContext {
  sessionId: string;
  tenantId: string;
  userId: string;
  traceId: string;
  memoryAccess: MemoryAccess;
  toolRegistry: ToolRegistry;
}

interface AgentResult<T> {
  output: T;
  confidence: number;
  reasoning: string;
  metadata: {
    executionTimeMs: number;
    tokensUsed?: number;
    modelVersion?: string;
  };
}
```

---

### 3.2 Hypothesis Agent Contract

**Purpose:** Generate quantifiable value theses

**Input:**
```typescript
interface HypothesisAgentInput {
  opportunityId?: string;
  painPoints: string[];
  financialContext: {
    arr?: number;
    cashBurn?: number;
    currentMetrics: Record<string, number>;
  };
  constraints: {
    maxInvestment?: number;
    timelineMonths?: number;
  };
}
```

**Output:**
```typescript
interface HypothesisAgentOutput {
  hypotheses: HypothesisCandidate[];
  ranking: 'impact' | 'feasibility' | 'speed';
  selectedHypothesisId?: string;
}

interface HypothesisCandidate {
  id: string;
  metric: string;
  currentValue: number;
  targetValue: number;
  expectedDelta: number;
  valueAtStake: number;
  confidence: number;
  rationale: string;
  dataRequirements: string[];
}
```

---

### 3.3 Financial Model Agent Contract

**Purpose:** Construct deterministic value trees

**Input:**
```typescript
interface FinancialModelAgentInput {
  hypothesisId: string;
  valueType: 'cash_flow_improvement' | 'cost_reduction' | 'revenue_growth';
  timeHorizon: {
    months: number;
    discountRate: number;
  };
  knownVariables: Record<string, number>;
}
```

**Output:**
```typescript
interface FinancialModelAgentOutput {
  valueTreeId: string;
  formula: string;
  inputs: ModelInput[];
  outputs: {
    npv: number;
    irr: number;
    paybackMonths: number;
    totalValue: number;
  };
  assumptions: ModelAssumption[];
  sensitivityAnalysis: SensitivityResult[];
}

interface ModelAssumption {
  id: string;
  variable: string;
  value: number;
  confidence: number;
  source?: string;
  impact: 'high' | 'medium' | 'low';  // On overall model
}
```

---

### 3.4 Evidence Retrieval Agent Contract

**Purpose:** Source and validate grounding data

**Input:**
```typescript
interface EvidenceAgentInput {
  hypothesisId: string;
  requiredMetrics: string[];
  preferredSources: SourceType[];
  minConfidence: number;
  maxSourcesPerMetric: number;
}
```

**Output:**
```typescript
interface EvidenceAgentOutput {
  evidenceBundleId: string;
  sources: ValidatedSource[];
  aggregateConfidence: number;
  gaps: EvidenceGap[];
  recommendations: string[];
}

interface ValidatedSource {
  id: string;
  type: SourceType;
  origin: string;
  metric: string;
  value: number;
  timestamp: ISO8601;
  confidence: number;
  validationChain: ValidationStep[];
}
```

---

### 3.5 Red Team Agent Contract

**Purpose:** Adversarial validation of hypotheses and models

**Input:**
```typescript
interface RedTeamAgentInput {
  targetType: 'hypothesis' | 'model' | 'evidence' | 'narrative';
  targetId: string;
  attackVectors: AttackVector[];
  intensity: 'standard' | 'aggressive';
}

type AttackVector = 
  | 'assumption_weakness'
  | 'data_quality'
  | 'model_logic'
  | 'omitted_risks'
  | 'alternative_explanations'
  | 'counter_examples';
```

**Output:**
```typescript
interface RedTeamAgentOutput {
  objections: Objection[];
  riskScore: number;             // 0-1, higher = more concerns
  criticalFlaws: string[];
  suggestedTests: string[];
  overridePossible: boolean;
  overrideRequiredConfidence: number;
}
```

---

### 3.6 Narrative Agent Contract

**Purpose:** Translate financial logic to executive communication

**Input:**
```typescript
interface NarrativeAgentInput {
  valueTreeId: string;
  targetPersonas: Persona[];
  outputFormats: Format[];
  constraints: {
    maxWords?: number;
    technicalDepth: 'high' | 'medium' | 'low';
  };
}

type Persona = 'cfo' | 'cro' | 'coo' | 'ceo' | 'board_member' | 'vp_sales';
type Format = 'executive_summary' | 'board_deck' | 'email' | 'talking_points';
```

**Output:**
```typescript
interface NarrativeAgentOutput {
  narrativeId: string;
  outputs: FormattedNarrative[];
  keyMessages: string[];
  riskDisclosures: string[];
  appendix?: string;
}

interface FormattedNarrative {
  format: Format;
  persona: Persona;
  content: string;
  confidence: number;
}
```

---

### 3.7 Integrity Agent Contract

**Purpose:** Audit and compliance validation

**Input:**
```typescript
interface IntegrityAgentInput {
  workflowId: string;
  stage: LifecycleStage;
  artifacts: string[];
  validationRules: ValidationRule[];
}

type ValidationRule = 
  | 'audit_trail_complete'
  | 'confidence_threshold_met'
  | 'source_attribution_present'
  | 'sensitivity_analysis_included'
  | 'risk_disclosure_present';
```

**Output:**
```typescript
interface IntegrityAgentOutput {
  validationId: string;
  passed: boolean;
  checks: ValidationCheck[];
  violations: Violation[];
  recommendations: string[];
  approvalRequired: boolean;
}

interface ValidationCheck {
  rule: ValidationRule;
  passed: boolean;
  details?: string;
}
```

---

## 4. Data Layer Contracts

### 4.1 Workflow Repository

**Interface:** `WorkflowRepository`

```typescript
interface WorkflowRepository {
  create(definition: WorkflowDefinition, tenantId: string): Promise<Workflow>;
  getById(id: string, tenantId: string): Promise<Workflow | null>;
  updateState(
    id: string, 
    transition: StateTransition, 
    tenantId: string
  ): Promise<Workflow>;
  listByTenant(tenantId: string, filters?: WorkflowFilters): Promise<Workflow[]>;
  compensate(executionId: string, tenantId: string): Promise<void>;
}
```

---

### 4.2 Artifact Repository

**Interface:** `ArtifactRepository`

```typescript
interface ArtifactRepository {
  store<T>(
    type: ArtifactType,
    data: T,
    metadata: ArtifactMetadata,
    tenantId: string
  ): Promise<string>;             // Returns artifact ID
  
  retrieve<T>(id: string, tenantId: string): Promise<T>;
  
  getLineage(
    workflowId: string, 
    tenantId: string
  ): Promise<ArtifactLineage>;
  
  delete(id: string, tenantId: string): Promise<void>;
}

type ArtifactType = 
  | 'hypothesis' 
  | 'value_tree' 
  | 'evidence_bundle' 
  | 'narrative' 
  | 'objection_report' 
  | 'audit_trail';
```

---

### 4.3 Vector Store Contract

**Purpose:** Semantic search for similar opportunities and benchmarks

```typescript
interface VectorStore {
  index(
    content: string,
    metadata: {
      tenantId: string;
      type: 'opportunity' | 'benchmark' | 'best_practice';
      tags: string[];
    }
  ): Promise<string>;
  
  query(
    embedding: number[],
    filters: {
      tenantId: string;
      type?: string;
      minSimilarity?: number;
    },
    limit: number
  ): Promise<VectorResult[]>;
}
```

---

## 5. Orchestration Layer Contracts

### 5.1 Workflow Engine Interface

```typescript
interface WorkflowEngine {
  start(
    definition: WorkflowDefinition,
    context: WorkflowContext,
    tenantId: string
  ): Promise<WorkflowExecution>;
  
  advance(
    executionId: string,
    event: WorkflowEvent,
    tenantId: string
  ): Promise<WorkflowState>;
  
  pause(executionId: string, tenantId: string): Promise<void>;
  resume(executionId: string, tenantId: string): Promise<void>;
  cancel(executionId: string, tenantId: string): Promise<void>;
  
  getStatus(executionId: string, tenantId: string): Promise<ExecutionStatus>;
}
```

---

### 5.2 Message Bus Contract

```typescript
interface MessageBus {
  publish(
    topic: string,
    event: CloudEvent,
    options: PublishOptions
  ): Promise<void>;
  
  subscribe(
    topic: string,
    handler: EventHandler,
    options: SubscribeOptions
  ): Promise<Subscription>;
  
  requestReply<TRequest, TResponse>(
    topic: string,
    request: TRequest,
    timeoutMs: number
  ): Promise<TResponse>;
}

interface CloudEvent {
  specversion: '1.0';
  type: string;
  source: string;
  id: string;
  time: ISO8601;
  datacontenttype: 'application/json';
  data: unknown;
  tenantid: string;
  traceid: string;
}
```

---

### 5.3 Saga Coordinator Contract

```typescript
interface SagaCoordinator {
  registerCompensation(
    executionId: string,
    stage: LifecycleStage,
    compensator: CompensationFunction,
    tenantId: string
  ): Promise<void>;
  
  executeCompensation(
    executionId: string,
    failedStage: LifecycleStage,
    tenantId: string
  ): Promise<CompensationResult>;
  
  getCompensationStatus(
    executionId: string,
    tenantId: string
  ): Promise<CompensationStatus>;
}
```

---

## 6. External Integration Contracts

### 6.1 SEC EDGAR Connector

```typescript
interface EdgarConnector {
  search(
    query: EdgarQuery,
    tenantId: string
  ): Promise<EdgarFiling[]>;
  
  retrieve(
    accessionNumber: string,
    tenantId: string
  ): Promise<EdgarDocument>;
}

interface EdgarQuery {
  companyName?: string;
  cik?: string;
  formType: '10-K' | '10-Q' | '8-K';
  dateRange: { start: ISO8601; end: ISO8601 };
  metrics?: string[];
}
```

---

### 6.2 CRM Connector (Abstract)

```typescript
interface CRMConnector {
  query(
    query: CRMQuery,
    tenantId: string
  ): Promise<CRMRecord[]>;
  
  supportedMetrics(): string[];
}

interface CRMQuery {
  objectType: 'account' | 'opportunity' | 'contact' | 'lead';
  fields: string[];
  filters: Record<string, unknown>;
  aggregation?: 'sum' | 'avg' | 'count';
}
```

**Implementations:** Salesforce, HubSpot, custom

---

### 6.3 ERP Connector (Abstract)

```typescript
interface ERPConnector {
  query(
    query: ERPQuery,
    tenantId: string
  ): Promise<ERPRecord[]>;
  
  supportedMetrics(): string[];
}

interface ERPQuery {
  module: 'finance' | 'inventory' | 'procurement' | 'hr';
  metrics: string[];
  period: { start: ISO8601; end: ISO8601 };
}
```

**Implementations:** NetSuite, SAP, QuickBooks, custom

---

## 7. Security Contracts

### 7.1 Authentication

```typescript
interface AuthService {
  authenticate(credentials: Credentials): Promise<AuthToken>;
  refresh(token: AuthToken): Promise<AuthToken>;
  revoke(token: AuthToken): Promise<void>;
  validate(token: AuthToken): Promise<TokenClaims>;
}

interface TokenClaims {
  userId: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
  exp: number;
}
```

---

### 7.2 Authorization

```typescript
interface AuthorizationService {
  checkPermission(
    userId: string,
    resource: string,
    action: string,
    tenantId: string
  ): Promise<boolean>;
  
  checkAgentPermission(
    agentId: string,
    tool: string,
    tenantId: string
  ): Promise<boolean>;
}
```

---

### 7.3 Audit Logger

```typescript
interface AuditLogger {
  log(event: AuditEvent): Promise<void>;
  query(filters: AuditFilters): Promise<AuditEvent[]>;
}

interface AuditEvent {
  id: string;
  timestamp: ISO8601;
  actor: string;                 // user or agent
  action: string;
  resource: string;
  resourceId: string;
  tenantId: string;
  metadata: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}
```

---

## Appendix: Error Contract

All API errors follow standard format:

```typescript
interface APIError {
  code: string;                  // Machine-readable
  message: string;               // Human-readable
  details?: Record<string, unknown>;
  requestId: string;             // For tracing
  timestamp: ISO8601;
}

// HTTP Status Mapping
// 400 - Bad Request (validation error)
// 401 - Unauthorized (auth required)
// 403 - Forbidden (permission denied)
// 404 - Not Found
// 409 - Conflict (state transition invalid)
// 422 - Unprocessable (business rule violation)
// 500 - Internal Error
// 503 - Service Unavailable (circuit breaker open)
```
