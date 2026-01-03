# AES (Agentic Experience System) UI/UX Adaptation Plan

## Executive Summary

**Current State:** ValueOS has a solid foundation with Chat+Canvas layout, workflow orchestration, and agent reasoning visualization.

**AES Alignment:** 70% aligned with AES principles, but missing key experiential layers for full transparency and co-presence.

**Recommendation:** Evolutionary adaptation (not revolution) - enhance existing UI with AES layers while preserving current workflow patterns.

---

## Current ValueOS UI Analysis

### ✅ Strengths (What's Already AES-Compatible)

1. **Chat+Canvas Pattern**
   - `ChatCanvasLayout.tsx` provides conversational interface
   - SDUI rendering for dynamic agent outputs
   - Command bar (⌘K) for intent capture
   - **AES Mapping:** Intent Layer ✓

2. **Workflow Orchestration**
   - `EnhancedWorkflowContainer.tsx` manages multi-stage workflows
   - Progress tracking and stage navigation
   - Agent health monitoring
   - **AES Mapping:** Orchestration UX (partial) ⚠️

3. **Agent Reasoning Visualization**
   - `AgentReasoningViewer.tsx` shows thought chains
   - Tree-based reasoning trace
   - Confidence scores and metadata
   - **AES Mapping:** Reflection Layer (partial) ⚠️

4. **Audit & Observability**
   - `AuditTraceViewer.tsx` for compliance
   - `ProvenanceTraceViewer.tsx` for data lineage
   - Telemetry integration
   - **AES Mapping:** Trust & Identity (partial) ⚠️

### ❌ Gaps (Missing AES Layers)

1. **Real-Time Orchestration Graph**
   - No live visualization of Temporal workflows
   - No LangGraph reasoning loop display
   - Missing agent-to-agent communication view
   - **Impact:** Users can't see "what's happening now"

2. **Co-Presence Layer**
   - No live presence indicators (humans + agents)
   - No collaborative session sync
   - Missing "who's working on what" awareness
   - **Impact:** Feels like single-player, not collaborative

3. **Unified Reflection Dashboard**
   - Reasoning, evals, and costs are scattered
   - No single "outcome + rationale" view
   - Missing token cost tracking
   - **Impact:** Hard to understand "why" and "how much"

4. **Trust Graph Visualization**
   - OpenFGA authorization not visualized
   - No agent ↔ tool ↔ resource permission map
   - Vault secret leases hidden
   - **Impact:** Security is opaque

5. **Eval Metrics Console**
   - No real-time faithfulness/safety scores
   - Missing latency/cost per agent call
   - No A/B test comparison
   - **Impact:** Can't optimize agent performance

---

## AES Adaptation Strategy

### Phase 1: Enhance Existing Components (2 weeks)

#### 1.1 Upgrade ChatCanvasLayout → AES Workspace

**Current:**
```tsx
<ChatCanvasLayout>
  <Sidebar /> {/* Library of cases */}
  <Canvas />  {/* SDUI output */}
  <CommandBar /> {/* ⌘K agent invocation */}
</ChatCanvasLayout>
```

**AES-Enhanced:**
```tsx
<AESWorkspace>
  <IntentPanel />           {/* Left: Conversational + agent roster */}
  <OrchestrationCanvas />   {/* Center: Live workflow graph */}
  <ReflectionPanel />       {/* Right: Outcomes + rationale */}
</AESWorkspace>
```

**Changes:**
- **Left Panel:** Add "Active Agents" roster with live status
- **Center Canvas:** Overlay orchestration graph on SDUI output
- **Right Panel:** New reflection panel for outcomes + metrics

**Implementation:**
```tsx
// src/components/AES/AESWorkspace.tsx
export function AESWorkspace() {
  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      {/* Left: Intent + Agents */}
      <IntentPanel className="w-72 border-r border-slate-800">
        <IntentInput />
        <ActiveAgentsRoster />
        <CaseLibrary />
      </IntentPanel>

      {/* Center: Orchestration + Canvas */}
      <OrchestrationCanvas className="flex-1">
        <LiveWorkflowGraph />
        <SDUIOutput />
      </OrchestrationCanvas>

      {/* Right: Reflection + Audit */}
      <ReflectionPanel className="w-80 border-l border-slate-800">
        <OutcomeSummary />
        <ReasoningTrace />
        <MetricsConsole />
        <TrustGraph />
      </ReflectionPanel>
    </div>
  );
}
```

---

#### 1.2 Add Live Orchestration Graph

**Component:** `src/components/AES/LiveWorkflowGraph.tsx`

**Features:**
- Real-time Temporal workflow visualization
- LangGraph reasoning loop display
- Agent-to-agent communication edges
- WebSocket connection to Temporal API

**Visual Design:**
```
┌─────────────────────────────────────────┐
│  Live Orchestration Graph               │
├─────────────────────────────────────────┤
│                                         │
│   [Guardian] ──→ [Builder] ──→ [Operator]
│       ↓              ↓              ↓   │
│   Monitoring    Composing      Executing│
│                                         │
│   Status: ✓ Healthy  ⏱ 1.3s  💰 $0.012 │
└─────────────────────────────────────────┘
```

**Implementation:**
```tsx
export function LiveWorkflowGraph() {
  const { workflowState } = useTemporalWorkflow();
  const { reasoningLoop } = useLangGraphState();

  return (
    <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
      <h3 className="text-sm font-semibold mb-3">Orchestration Graph</h3>
      
      {/* D3.js or React Flow graph */}
      <WorkflowGraphCanvas
        nodes={workflowState.activities}
        edges={reasoningLoop.transitions}
        onNodeClick={showAgentDetails}
      />

      {/* Live metrics */}
      <div className="mt-3 flex gap-4 text-xs text-slate-400">
        <span>⏱ Latency: {workflowState.latency}s</span>
        <span>💰 Cost: ${workflowState.cost}</span>
        <span>🔄 Loops: {reasoningLoop.iterations}</span>
      </div>
    </div>
  );
}
```

---

#### 1.3 Add Co-Presence Indicators

**Component:** `src/components/AES/CoPresenceLayer.tsx`

**Features:**
- Live presence of humans (avatars)
- Live presence of agents (status badges)
- Session sync (who's editing what)
- Redis pub/sub for real-time updates

**Visual Design:**
```
┌─────────────────────────────────────────┐
│  Active Participants                    │
├─────────────────────────────────────────┤
│  👤 Alice (you)        Editing Stage 2  │
│  👤 Bob                Reviewing Stage 1 │
│  🤖 Guardian Agent     Monitoring        │
│  🤖 Builder Agent      Idle              │
└─────────────────────────────────────────┘
```

**Implementation:**
```tsx
export function CoPresenceLayer() {
  const { humans, agents } = usePresence();

  return (
    <div className="bg-slate-900 rounded-lg p-3 border border-slate-800">
      <h4 className="text-xs font-semibold mb-2">Active Participants</h4>
      
      {/* Human users */}
      {humans.map(user => (
        <div key={user.id} className="flex items-center gap-2 mb-2">
          <Avatar src={user.avatar} size="sm" />
          <span className="text-xs">{user.name}</span>
          <span className="text-xs text-slate-400">{user.activity}</span>
        </div>
      ))}

      {/* Agent workers */}
      {agents.map(agent => (
        <div key={agent.id} className="flex items-center gap-2 mb-2">
          <AgentBadge role={agent.role} status={agent.status} />
          <span className="text-xs">{agent.name}</span>
          <span className="text-xs text-slate-400">{agent.activity}</span>
        </div>
      ))}
    </div>
  );
}
```

---

#### 1.4 Unified Reflection Panel

**Component:** `src/components/AES/ReflectionPanel.tsx`

**Features:**
- Outcome summary (what happened)
- Reasoning trace (why it happened)
- Metrics console (cost, latency, evals)
- Trust graph (authorization flow)

**Visual Design:**
```
┌─────────────────────────────────────────┐
│  Reflection & Outcomes                  │
├─────────────────────────────────────────┤
│  ✅ Refund executed successfully        │
│  💬 Guardian verified authorization     │
│  📈 Cost: $0.012 | Latency: 1.3s        │
│                                         │
│  Reasoning Trace:                       │
│  1. Parsed user intent                  │
│  2. Checked authorization (OpenFGA)     │
│  3. Executed refund (Stripe API)        │
│  4. Logged audit trail                  │
│                                         │
│  Eval Metrics:                          │
│  • Faithfulness: 94%                    │
│  • Safety: 100%                         │
│  • Hallucination: 0%                    │
│                                         │
│  [Export Audit Log]                     │
└─────────────────────────────────────────┘
```

**Implementation:**
```tsx
export function ReflectionPanel() {
  const { outcome, reasoning, metrics, trustGraph } = useReflection();

  return (
    <div className="flex flex-col h-full p-4">
      <h2 className="text-sm font-semibold mb-3">Reflection & Outcomes</h2>

      {/* Outcome summary */}
      <OutcomeSummary outcome={outcome} />

      {/* Reasoning trace */}
      <ReasoningTrace steps={reasoning.steps} />

      {/* Eval metrics */}
      <MetricsConsole metrics={metrics} />

      {/* Trust graph */}
      <TrustGraph graph={trustGraph} />

      {/* Export button */}
      <button className="mt-auto bg-emerald-600 py-2 rounded-md">
        Export Audit Log
      </button>
    </div>
  );
}
```

---

### Phase 2: Add New AES Components (2 weeks)

#### 2.1 Eval Metrics Console

**Component:** `src/components/AES/EvalMetricsConsole.tsx`

**Features:**
- Real-time faithfulness score
- Safety/toxicity detection
- Hallucination rate
- Latency per agent call
- Token cost tracking

**Visual Design:**
```
┌─────────────────────────────────────────┐
│  Eval Metrics Console                   │
├─────────────────────────────────────────┤
│  Faithfulness:    ████████░░ 94%        │
│  Safety:          ██████████ 100%       │
│  Hallucination:   ░░░░░░░░░░ 0%         │
│  Latency (p99):   1.3s                  │
│  Token Cost:      $0.012                │
│                                         │
│  [View Detailed Report]                 │
└─────────────────────────────────────────┘
```

**Implementation:**
```tsx
export function EvalMetricsConsole() {
  const { evals } = useAgentEvals();

  return (
    <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
      <h3 className="text-sm font-semibold mb-3">Eval Metrics</h3>

      {/* Metric bars */}
      {Object.entries(evals).map(([metric, value]) => (
        <div key={metric} className="mb-3">
          <div className="flex justify-between text-xs mb-1">
            <span>{metric}</span>
            <span>{value}%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500"
              style={{ width: `${value}%` }}
            />
          </div>
        </div>
      ))}

      {/* Cost/latency */}
      <div className="mt-4 text-xs text-slate-400">
        <p>Latency (p99): {evals.latency}s</p>
        <p>Token Cost: ${evals.cost}</p>
      </div>
    </div>
  );
}
```

---

#### 2.2 Trust Graph Visualization

**Component:** `src/components/AES/TrustGraphVisualization.tsx`

**Features:**
- Agent ↔ Tool ↔ Resource authorization map
- OpenFGA permission graph
- Vault secret lease status
- Real-time authorization checks

**Visual Design:**
```
┌─────────────────────────────────────────┐
│  Trust Graph                            │
├─────────────────────────────────────────┤
│                                         │
│   [Guardian Agent]                      │
│         ↓ (can:execute)                 │
│   [Refund Tool]                         │
│         ↓ (requires:secret)             │
│   [Stripe API Key] ✓ Valid              │
│         ↓ (accesses)                    │
│   [Customer DB] ✓ Authorized            │
│                                         │
│  Authorization: ✓ All checks passed     │
└─────────────────────────────────────────┘
```

**Implementation:**
```tsx
export function TrustGraphVisualization() {
  const { authGraph } = useOpenFGA();
  const { secrets } = useVaultLeases();

  return (
    <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
      <h3 className="text-sm font-semibold mb-3">Trust Graph</h3>

      {/* Authorization flow */}
      <div className="space-y-2 text-xs">
        {authGraph.nodes.map((node, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>{node.entity}</span>
            <span className="text-slate-400">→ {node.relation}</span>
            <span>{node.target}</span>
            {node.authorized && <CheckCircle className="w-3 h-3 text-emerald-500" />}
          </div>
        ))}
      </div>

      {/* Secret status */}
      <div className="mt-4 text-xs">
        <p className="text-slate-400">Secrets:</p>
        {secrets.map(secret => (
          <div key={secret.id} className="flex justify-between">
            <span>{secret.name}</span>
            <span className={secret.valid ? 'text-emerald-500' : 'text-red-500'}>
              {secret.valid ? '✓ Valid' : '✗ Expired'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

#### 2.3 Agent Roster with Live Status

**Component:** `src/components/AES/ActiveAgentsRoster.tsx`

**Features:**
- List of available agents
- Live status (idle, working, error)
- Current task/activity
- Health indicators

**Visual Design:**
```
┌─────────────────────────────────────────┐
│  Active Agents                          │
├─────────────────────────────────────────┤
│  🛡 Guardian Agent                      │
│     Status: ✓ Monitoring                │
│     Health: ████████░░ 90%              │
│                                         │
│  🧠 Builder Agent                       │
│     Status: ⚙️ Composing Stage 2        │
│     Health: ██████████ 100%             │
│                                         │
│  🤝 Operator Agent                      │
│     Status: ⏸ Idle                      │
│     Health: ██████████ 100%             │
└─────────────────────────────────────────┘
```

**Implementation:**
```tsx
export function ActiveAgentsRoster() {
  const { agents } = useAgentHealth();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Active Agents</h3>

      {agents.map(agent => (
        <div key={agent.id} className="bg-slate-900 p-3 rounded-lg border border-slate-800">
          <div className="flex items-center gap-2 mb-2">
            <AgentBadge role={agent.role} />
            <span className="text-sm font-medium">{agent.name}</span>
          </div>

          <div className="text-xs text-slate-400 mb-2">
            Status: {agent.status}
          </div>

          {/* Health bar */}
          <div className="flex items-center gap-2">
            <span className="text-xs">Health:</span>
            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500"
                style={{ width: `${agent.health}%` }}
              />
            </div>
            <span className="text-xs">{agent.health}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

### Phase 3: Integration & Polish (1 week)

#### 3.1 WebSocket Integration

**Service:** `src/services/AESRealtimeService.ts`

**Features:**
- WebSocket connection to Temporal API
- Redis pub/sub for presence
- OpenTelemetry trace streaming
- Real-time metric updates

**Implementation:**
```typescript
export class AESRealtimeService {
  private ws: WebSocket;
  private redis: Redis;

  async connect() {
    // Connect to Temporal workflow events
    this.ws = new WebSocket('ws://temporal-api:7233/events');
    
    this.ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      this.handleWorkflowUpdate(update);
    };

    // Subscribe to Redis presence channel
    this.redis.subscribe('presence:*', (message) => {
      this.handlePresenceUpdate(message);
    });
  }

  private handleWorkflowUpdate(update: WorkflowEvent) {
    // Update orchestration graph
    orchestrationStore.updateGraph(update);
    
    // Update metrics
    metricsStore.updateMetrics(update.metrics);
  }

  private handlePresenceUpdate(message: PresenceEvent) {
    // Update co-presence layer
    presenceStore.updatePresence(message);
  }
}
```

---

#### 3.2 Grafana Integration

**Service:** `src/services/GrafanaIntegrationService.ts`

**Features:**
- Fetch traces from Grafana Tempo
- Fetch logs from Grafana Loki
- Display in Reflection Panel
- Link to full Grafana dashboard

**Implementation:**
```typescript
export class GrafanaIntegrationService {
  async getTraces(workflowId: string) {
    const response = await fetch(
      `${GRAFANA_TEMPO_URL}/api/traces/${workflowId}`
    );
    return response.json();
  }

  async getLogs(workflowId: string) {
    const response = await fetch(
      `${GRAFANA_LOKI_URL}/loki/api/v1/query_range`,
      {
        params: {
          query: `{workflow_id="${workflowId}"}`,
          limit: 100
        }
      }
    );
    return response.json();
  }
}
```

---

## Visual Design System Updates

### Color Palette (AES-Specific)

```css
/* AES Layer Colors */
--aes-intent: #3b82f6;      /* Blue - Intent Layer */
--aes-orchestration: #8b5cf6; /* Purple - Orchestration */
--aes-reflection: #10b981;   /* Green - Reflection */
--aes-trust: #f59e0b;        /* Amber - Trust */
--aes-presence: #ec4899;     /* Pink - Co-Presence */

/* Status Colors */
--agent-idle: #64748b;       /* Slate - Idle */
--agent-working: #3b82f6;    /* Blue - Working */
--agent-success: #10b981;    /* Green - Success */
--agent-error: #ef4444;      /* Red - Error */
```

### Typography

```css
/* AES-Specific Typography */
.aes-heading {
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.aes-metric {
  font-size: 0.75rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.aes-trace {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
}
```

---

## Implementation Roadmap

### Week 1-2: Phase 1 (Enhance Existing)
- [ ] Refactor ChatCanvasLayout → AESWorkspace
- [ ] Add LiveWorkflowGraph component
- [ ] Add CoPresenceLayer component
- [ ] Add ReflectionPanel component

### Week 3-4: Phase 2 (New Components)
- [ ] Build EvalMetricsConsole
- [ ] Build TrustGraphVisualization
- [ ] Build ActiveAgentsRoster
- [ ] Integrate with existing AgentReasoningViewer

### Week 5: Phase 3 (Integration)
- [ ] WebSocket integration (Temporal + Redis)
- [ ] Grafana integration (Tempo + Loki)
- [ ] OpenFGA visualization
- [ ] Vault secret status

### Week 6: Polish & Testing
- [ ] Performance optimization
- [ ] Accessibility audit
- [ ] User testing
- [ ] Documentation

---

## Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Time to Understand Agent Action | 30s | 5s | User testing |
| Debugging Speed | 10 min | 2 min | Developer survey |
| Trust in Agent Decisions | 60% | 90% | User confidence survey |
| Collaboration Awareness | 20% | 80% | Co-presence usage |
| Cost Visibility | 10% | 100% | Metric dashboard usage |

---

## Migration Strategy

### Backward Compatibility

**Approach:** Feature flag for AES UI

```typescript
// src/config/featureFlags.ts
export const featureFlags = {
  ENABLE_AES_UI: parseBoolean(
    import.meta.env.VITE_ENABLE_AES_UI,
    false // Default: disabled (gradual rollout)
  ),
};

// src/App.tsx
function App() {
  return featureFlags.ENABLE_AES_UI ? (
    <AESWorkspace />
  ) : (
    <ChatCanvasLayout />
  );
}
```

### Gradual Rollout

1. **Week 1-2:** Internal team only (10% rollout)
2. **Week 3-4:** Beta users (25% rollout)
3. **Week 5-6:** All users (100% rollout)

---

## Conclusion

**Recommendation:** Proceed with evolutionary adaptation.

**Why:**
- Preserves existing workflow patterns users know
- Adds AES transparency layers incrementally
- Maintains backward compatibility
- Reduces migration risk

**Key Additions:**
1. Live orchestration graph (center canvas)
2. Co-presence layer (left panel)
3. Unified reflection panel (right panel)
4. Eval metrics console
5. Trust graph visualization

**Result:** ValueOS becomes a true "Agentic Workspace" with full observability, explainability, and collaboration - matching the AES vision while respecting existing UX patterns.
