# EPIC-003: UI Template Implementation
## Phase 4 - Complete Implementation Guide

**Epic Points**: 60 | **Duration**: 4 weeks | **Sprint**: 3-6

---

## 📋 Epic Overview

This epic implements the 5 core UI templates that connect to the Phase 3.5 Ground Truth Engine. Each template is designed for specific personas and use cases, providing beautiful, interactive interfaces for the deterministic business intelligence platform.

---

## 🎯 Template Specifications

### VOS-UI-001: Trinity Dashboard Template
**Points**: 13 | **Sprint**: 3-4 | **Persona**: CFO

**Purpose**: Primary financial dashboard showing ROI, NPV, and Payback Period

**Data Source**: Phase 3.5 `BusinessCaseResult` via `adaptBusinessCaseToTemplate()`

**Component Structure**:
```
src/components/templates/organisms/TrinityDashboard.tsx
├── FinancialSummary.tsx (Molecule)
│   ├── KPIValue.tsx (Atom) - ROI
│   ├── KPIValue.tsx (Atom) - NPV
│   └── KPIValue.tsx (Atom) - Payback
├── CashFlowChart.tsx (Molecule)
├── RiskAnalysis.tsx (Molecule)
└── TrustOverlay.tsx (Molecule)
```

**Key Features**:
- Three-column KPI display with trend indicators
- Interactive cash flow projection chart
- Risk scenario comparison (Downside/Base/Upside)
- Trust badges on all metrics
- Export to PDF/PPTX
- Real-time updates via WebSocket

**Implementation Steps**:

1. **Create Atoms** (Day 1-2)
```typescript
// src/components/templates/atoms/KPICard.tsx
interface KPICardProps {
  label: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'flat';
  confidence: number;
  onTrustClick: () => void;
}

export const KPICard: React.FC<KPICardProps> = ({ 
  label, value, unit, trend, confidence, onTrustClick 
}) => {
  const formattedValue = formatNumber(value, unit);
  const trendColor = trend === 'up' ? '#10B981' : trend === 'down' ? '#EF4444' : '#6B7280';
  
  return (
    <div className="kpi-card" data-testid={`kpi-${label}`}>
      <div className="kpi-header">
        <span className="kpi-label">{label}</span>
        <TrustBadge 
          confidence={confidence} 
          onClick={onTrustClick}
        />
      </div>
      <div className="kpi-value" style={{ color: trendColor }}>
        {formattedValue}
        <span className="kpi-trend">{trend === 'up' ? '▲' : trend === 'down' ? '▼' : '─'}</span>
      </div>
      <div className="kpi-confidence">
        <ConfidenceBar confidence={confidence} />
      </div>
    </div>
  );
};
```

2. **Create Molecules** (Day 3-4)
```typescript
// src/components/templates/molecules/FinancialSummary.tsx
export const FinancialSummary: React.FC<{ financials: FinancialMetrics }> = ({ financials }) => {
  const { roi, npv, paybackPeriod } = financials;
  
  return (
    <div className="financial-summary">
      <KPICard 
        label="ROI"
        value={roi * 100}
        unit="%"
        trend={roi > 0 ? 'up' : 'down'}
        confidence={financials.roiConfidence || 0.95}
        onTrustClick={() => showTrustBadge('roi')}
      />
      <KPICard 
        label="NPV"
        value={npv}
        unit="$"
        trend={npv > 0 ? 'up' : 'down'}
        confidence={financials.npvConfidence || 0.95}
        onTrustClick={() => showTrustBadge('npv')}
      />
      <KPICard 
        label="Payback"
        value={paybackPeriod}
        unit="days"
        trend="flat"
        confidence={financials.paybackConfidence || 0.95}
        onTrustClick={() => showTrustBadge('payback')}
      />
    </div>
  );
};
```

3. **Create Organism** (Day 5-7)
```typescript
// src/components/templates/organisms/TrinityDashboard.tsx
export const TrinityDashboard: React.FC = () => {
  const { templateData, trustBadges, isLoading } = useTemplateStore();
  
  if (isLoading) return <DashboardSkeleton persona="cfo" />;
  
  const { financials, context, evidence } = templateData;
  
  return (
    <DashboardLayout 
      persona="cfo"
      title="Trinity Dashboard"
      subtitle="Financial Analysis & Risk Assessment"
      actions={<ExportButtons />}
    >
      <div className="trinity-grid">
        {/* KPI Row */}
        <FinancialSummary financials={financials} />
        
        {/* Charts Row */}
        <div className="charts-row">
          <CashFlowChart 
            data={financials.yearlyCashFlow}
            projection={financials.sensitivity}
          />
          <RiskAnalysis 
            risk={financials.sensitivity}
            confidence={context.confidenceScore}
          />
        </div>
        
        {/* Evidence & Trust */}
        <EvidenceList evidence={evidence} />
        
        {/* Trust Overlay */}
        <TrustOverlay badges={trustBadges} />
      </div>
    </DashboardLayout>
  );
};
```

---

### VOS-UI-002: Impact Cascade Template
**Points**: 13 | **Sprint**: 4 | **Persona**: CTO

**Purpose**: Visualize causal chains from actions to outcomes

**Data Source**: `extractCausalChain()` from Phase 3.5

**Component Structure**:
```
src/components/templates/organisms/ImpactCascadeTemplate.tsx
├── CascadeFlow.tsx (Molecule)
├── CascadeNode.tsx (Atom)
├── CascadeLink.tsx (Atom)
└── NodeDetailPanel.tsx (Molecule)
```

**Key Features**:
- Interactive Sankey diagram
- Drill-down node expansion
- Impact quantification at each level
- Confidence visualization
- Animation for value flow

**Implementation**:

```typescript
// src/components/templates/organisms/ImpactCascadeTemplate.tsx
export const ImpactCascadeTemplate: React.FC = () => {
  const { templateData } = useTemplateStore();
  const { outcomes, metrics } = templateData;
  
  const nodes = buildCascadeNodes(outcomes);
  const links = buildCascadeLinks(outcomes);
  
  return (
    <DashboardLayout persona="cto" title="Impact Cascade">
      <div className="cascade-container">
        <svg width="100%" height="600">
          {/* Render Links */}
          {links.map((link, i) => (
            <CascadeLink 
              key={i}
              source={link.source}
              target={link.target}
              value={link.value}
              confidence={link.confidence}
            />
          ))}
          
          {/* Render Nodes */}
          {nodes.map((node) => (
            <CascadeNode
              key={node.id}
              node={node}
              onExpand={() => expandNode(node.id)}
              onHover={() => highlightPath(node.id)}
            />
          ))}
        </svg>
        
        {/* Detail Panel */}
        {selectedNode && (
          <NodeDetailPanel 
            node={selectedNode}
            metrics={metrics}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
    </DashboardLayout>
  );
};

// Helper to build cascade data
const buildCascadeNodes = (outcomes: CausalChain[]): CascadeNode[] => {
  const nodes = new Map<string, CascadeNode>();
  
  outcomes.forEach(outcome => {
    // Action Node
    if (!nodes.has(outcome.driver)) {
      nodes.set(outcome.driver, {
        id: outcome.driver,
        label: formatActionName(outcome.driver),
        type: 'action',
        value: 0,
        confidence: outcome.confidence
      });
    }
    
    // Effect Node
    if (!nodes.has(outcome.effect)) {
      nodes.set(outcome.effect, {
        id: outcome.effect,
        label: formatKPIName(outcome.effect),
        type: 'kpi',
        value: 0,
        confidence: outcome.confidence
      });
    }
    
    // Accumulate values
    nodes.get(outcome.driver)!.value += Math.abs(outcome.impact);
    nodes.get(outcome.effect)!.value += Math.abs(outcome.impact);
  });
  
  return Array.from(nodes.values());
};
```

---

### VOS-UI-003: Scenario Matrix Template
**Points**: 13 | **Sprint**: 4-5 | **Persona**: VP Sales

**Purpose**: Compare multiple business scenarios side-by-side

**Data Source**: Multiple `BusinessCaseResult` objects via `compare_business_scenarios()`

**Component Structure**:
```
src/components/templates/organisms/ScenarioMatrix.tsx
├── ScenarioComparisonTable.tsx (Molecule)
├── ScenarioCard.tsx (Molecule)
├── VariableControls.tsx (Molecule)
└── ScenarioSelector.tsx (Atom)
```

**Key Features**:
- Multi-column comparison grid
- Variable adjustment sliders
- Probability weighting
- Best/Worst/Expected highlighting
- Scenario export

**Implementation**:

```typescript
// src/components/templates/organisms/ScenarioMatrix.tsx
export const ScenarioMatrix: React.FC = () => {
  const { scenarios, setScenarios, compareScenarios } = useScenarioStore();
  const [variables, setVariables] = useState<ScenarioVariables>({});
  
  const handleVariableChange = (key: string, value: number) => {
    const newVariables = { ...variables, [key]: value };
    setVariables(newVariables);
    
    // Recalculate scenarios
    const updated = scenarios.map(s => recalculateScenario(s, newVariables));
    setScenarios(updated);
  };
  
  return (
    <DashboardLayout persona="vp_sales" title="Scenario Comparison">
      <div className="scenario-matrix">
        {/* Variable Controls */}
        <VariableControls 
          variables={variables}
          onChange={handleVariableChange}
        />
        
        {/* Comparison Table */}
        <ScenarioComparisonTable scenarios={scenarios} />
        
        {/* Visual Comparison */}
        <div className="scenario-cards">
          {scenarios.map((scenario, i) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              isBest={i === 0} // Assuming sorted by ROI
              isSelected={selectedScenario === scenario.id}
              onSelect={() => setSelectedScenario(scenario.id)}
            />
          ))}
        </div>
        
        {/* Insights */}
        <ScenarioInsights 
          scenarios={scenarios}
          best={getBestScenario(scenarios)}
          worst={getWorstScenario(scenarios)}
        />
      </div>
    </DashboardLayout>
  );
};

// Scenario Card Component
const ScenarioCard: React.FC<{ 
  scenario: Scenario; 
  isBest: boolean; 
  isSelected: boolean;
  onSelect: () => void;
}> = ({ scenario, isBest, isSelected, onSelect }) => {
  return (
    <div 
      className={`scenario-card ${isBest ? 'best' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <div className="scenario-header">
        <h3>{scenario.name}</h3>
        {isBest && <span className="badge best">Recommended</span>}
      </div>
      
      <div className="scenario-metrics">
        <Metric 
          label="ROI" 
          value={scenario.financials.roi * 100} 
          unit="%" 
          trend="up"
        />
        <Metric 
          label="NPV" 
          value={scenario.financials.npv} 
          unit="$" 
          trend={scenario.financials.npv > 0 ? 'up' : 'down'}
        />
        <Metric 
          label="Risk" 
          value={scenario.riskLevel} 
          unit="" 
          trend={scenario.riskLevel === 'low' ? 'up' : 'down'}
        />
      </div>
      
      <div className="scenario-confidence">
        <ConfidenceBar confidence={scenario.confidence} />
      </div>
    </div>
  );
};
```

---

### VOS-UI-004: Story Arc Canvas Template
**Points**: 8 | **Sprint**: 5 | **Persona**: Executive/Board

**Purpose**: Narrative-driven timeline visualization for presentations

**Data Source**: `BusinessCaseResult.timeline` and `auditTrail`

**Component Structure**:
```
src/components/templates/organisms/StoryArcCanvas.tsx
├── Timeline.tsx (Molecule)
├── StoryNode.tsx (Atom)
├── NarrativeText.tsx (Molecule)
└── PresentationExport.tsx (Molecule)
```

**Key Features**:
- Horizontal timeline with story nodes
- Before/After comparison sections
- Embedded mini-charts
- Narrative text generation
- PowerPoint export

**Implementation**:

```typescript
// src/components/templates/organisms/StoryArcCanvas.tsx
export const StoryArcCanvas: React.FC = () => {
  const { templateData } = useTemplateStore();
  const { timeline, context, financials } = templateData;
  
  const storyNodes = buildStoryNodes(timeline);
  
  return (
    <DashboardLayout persona="executive" title="Story Arc">
      <div className="story-canvas">
        {/* Title Slide */}
        <div className="story-intro">
          <h1>{context.title || "Strategic Value Journey"}</h1>
          <p>{context.subtitle || generateNarrativeSummary(financials)}</p>
        </div>
        
        {/* Timeline */}
        <Timeline>
          {storyNodes.map((node, i) => (
            <StoryNode
              key={node.id}
              node={node}
              position={i}
              onExpand={() => showNodeDetail(node)}
            />
          ))}
        </Timeline>
        
        {/* Before/After Comparison */}
        <div className="comparison-section">
          <div className="before">
            <h3>Current State</h3>
            <MiniChart data={timeline[0]?.baseline} />
          </div>
          <div className="after">
            <h3>Projected State</h3>
            <MiniChart data={timeline[timeline.length - 1]?.impact} />
          </div>
        </div>
        
        {/* Narrative Text */}
        <NarrativeText 
          timeline={timeline}
          financials={financials}
          context={context}
        />
        
        {/* Export */}
        <PresentationExport 
          sections={[
            { type: 'title', content: context.title },
            { type: 'timeline', content: storyNodes },
            { type: 'comparison', content: { before: timeline[0], after: timeline[timeline.length - 1] } },
            { type: 'narrative', content: generateNarrativeText(templateData) }
          ]}
        />
      </div>
    </DashboardLayout>
  );
};

// Story Node Component
const StoryNode: React.FC<{ node: StoryNode; position: number; onExpand: () => void }> = ({ 
  node, position, onExpand 
}) => {
  const alignment = position % 2 === 0 ? 'left' : 'right';
  
  return (
    <div className={`story-node ${alignment}`}>
      <div className="node-marker" onClick={onExpand}>
        <span className="node-number">{position + 1}</span>
      </div>
      <div className="node-content">
        <h4>{node.title}</h4>
        <p>{node.description}</p>
        <div className="node-metrics">
          <span className="impact">+{node.impact}</span>
          <span className="date">{node.date}</span>
        </div>
      </div>
    </div>
  );
};
```

---

### VOS-UI-005: Quantum View Template
**Points**: 13 | **Sprint**: 5-6 | **Persona**: Multi-Persona

**Purpose**: Unified view showing multiple persona perspectives simultaneously

**Data Source**: Multiple `BusinessCaseResult` objects with different contexts

**Component Structure**:
```
src/components/templates/organisms/QuantumView.tsx
├── PersonaTabs.tsx (Molecule)
├── PerspectiveCard.tsx (Atom)
├── ConsensusView.tsx (Molecule)
└── PerspectiveSelector.tsx (Atom)
```

**Key Features**:
- Tabbed interface for personas
- Side-by-side comparison
- Consensus algorithm
- Conflict detection
- Unified recommendation

**Implementation**:

```typescript
// src/components/templates/organisms/QuantumView.tsx
export const QuantumView: React.FC = () => {
  const { perspectives, setPerspectives, selectedPersona, setSelectedPersona } = useQuantumStore();
  const [viewMode, setViewMode] = useState<'split' | 'consensus'>('split');
  
  const consensus = calculateConsensus(perspectives);
  
  return (
    <DashboardLayout persona="multi" title="Quantum View">
      <div className="quantum-view">
        {/* Persona Tabs */}
        <PersonaTabs 
          personas={perspectives.map(p => p.persona)}
          selected={selectedPersona}
          onSelect={setSelectedPersona}
        />
        
        {/* View Mode Toggle */}
        <div className="view-controls">
          <button onClick={() => setViewMode('split')}>Split View</button>
          <button onClick={() => setViewMode('consensus')}>Consensus</button>
        </div>
        
        {/* Split View */}
        {viewMode === 'split' && (
          <div className="perspectives-grid">
            {perspectives.map((perspective) => (
              <PerspectiveCard
                key={perspective.persona}
                perspective={perspective}
                isSelected={selectedPersona === perspective.persona}
                onSelect={() => setSelectedPersona(perspective.persona)}
              />
            ))}
          </div>
        )}
        
        {/* Consensus View */}
        {viewMode === 'consensus' && (
          <ConsensusView 
            consensus={consensus}
            perspectives={perspectives}
            conflicts={detectConflicts(perspectives)}
          />
        )}
        
        {/* Unified Recommendation */}
        <UnifiedRecommendation 
          consensus={consensus}
          perspectives={perspectives}
        />
      </div>
    </DashboardLayout>
  );
};

// Perspective Card
const PerspectiveCard: React.FC<{ 
  perspective: Perspective; 
  isSelected: boolean;
  onSelect: () => void;
}> = ({ perspective, isSelected, onSelect }) => {
  return (
    <div 
      className={`perspective-card ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <div className="perspective-header">
        <h3>{formatPersonaName(perspective.persona)}</h3>
        <ConfidenceBadge confidence={perspective.confidence} />
      </div>
      
      <div className="perspective-metrics">
        {perspective.metrics.slice(0, 3).map((metric) => (
          <div key={metric.id} className="metric-row">
            <span className="metric-name">{metric.name}</span>
            <span className="metric-value">{formatMetric(metric)}</span>
            <span className="metric-trend">{metric.trend}</span>
          </div>
        ))}
      </div>
      
      <div className="perspective-summary">
        <p>{perspective.summary}</p>
      </div>
      
      <div className="perspective-actions">
        <button onClick={(e) => { e.stopPropagation(); viewDetails(perspective); }}>
          View Details
        </button>
      </div>
    </div>
  );
};

// Consensus Algorithm
const calculateConsensus = (perspectives: Perspective[]): Consensus => {
  const metrics = new Map<string, { values: number[]; confidence: number[] }>();
  
  perspectives.forEach(p => {
    p.metrics.forEach(m => {
      if (!metrics.has(m.id)) {
        metrics.set(m.id, { values: [], confidence: [] });
      }
      metrics.get(m.id)!.values.push(m.value);
      metrics.get(m.id)!.confidence.push(p.confidence);
    });
  });
  
  const consensusMetrics = Array.from(metrics.entries()).map(([id, data]) => {
    const weightedValue = weightedAverage(data.values, data.confidence);
    const variance = calculateVariance(data.values);
    
    return {
      id,
      value: weightedValue,
      variance,
      agreement: variance < 0.1 ? 'high' : variance < 0.3 ? 'medium' : 'low'
    };
  });
  
  return {
    metrics: consensusMetrics,
    bestAction: findBestAction(perspectives),
    highestImpact: findHighestImpact(consensusMetrics),
    lowestRisk: findLowestRisk(perspectives)
  };
};
```

---

## 🎨 Shared Components

### Trust Badge System
```typescript
// src/components/templates/atoms/TrustBadge.tsx
export const TrustBadge: React.FC<{ confidence: number; onClick: () => void }> = ({ 
  confidence, onClick 
}) => {
  const color = confidence >= 0.9 ? '#10B981' : confidence >= 0.7 ? '#F59E0B' : '#EF4444';
  const icon = confidence >= 0.9 ? '🛡️' : confidence >= 0.7 ? '⚠️' : '❌';
  
  return (
    <div 
      className="trust-badge" 
      style={{ backgroundColor: color }}
      onClick={onClick}
      role="button"
      aria-label={`Trust badge: ${(confidence * 100).toFixed(0)}% confidence`}
    >
      {icon}
    </div>
  );
};

// Trust Badge Tooltip
export const TrustBadgeTooltip: React.FC<{ badge: TrustBadgeProps }> = ({ badge }) => {
  return (
    <div className="trust-tooltip">
      <h4>🛡️ Trust Badge</h4>
      <div className="tooltip-section">
        <strong>Value:</strong> {badge.value}
      </div>
      <div className="tooltip-section">
        <strong>Confidence:</strong> {(badge.confidence * 100).toFixed(0)}%
      </div>
      <div className="tooltip-section">
        <strong>Formula:</strong> <code>{badge.formula}</code>
      </div>
      <div className="tooltip-section">
        <strong>Hash:</strong> <span className="hash">{badge.hash.substring(0, 16)}...</span>
      </div>
      <div className="tooltip-section">
        <strong>Sources:</strong> {badge.sources.join(', ')}
      </div>
      <div className="tooltip-section">
        <strong>Reasoning:</strong> {badge.reasoning}
      </div>
    </div>
  );
};
```

### Dashboard Layout
```typescript
// src/components/templates/templates/DashboardLayout.tsx
export const DashboardLayout: React.FC<{
  persona: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ persona, title, subtitle, actions, children }) => {
  const personaConfig = getPersonaConfig(persona);
  
  return (
    <div className={`dashboard-layout ${persona}`}>
      <header className="dashboard-header" style={{ backgroundColor: personaConfig.primaryColor }}>
        <div className="header-content">
          <div>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className="header-actions">
            {actions}
            <PersonaBadge persona={persona} />
          </div>
        </div>
      </header>
      
      <main className="dashboard-content">
        {children}
      </main>
      
      <footer className="dashboard-footer">
        <span>Powered by Ground Truth Engine</span>
        <span>Confidence: {calculateOverallConfidence(children)}</span>
      </footer>
    </div>
  );
};
```

---

## 🧪 Testing Strategy

### Unit Tests
```typescript
// src/components/templates/__tests__/TrinityDashboard.test.tsx
describe('TrinityDashboard', () => {
  const mockData = {
    financials: {
      roi: 2.14,
      npv: 1200000,
      paybackPeriod: 180,
      yearlyCashFlow: [300000, 450000, 600000]
    },
    context: { persona: 'cfo', confidenceScore: 0.95 },
    evidence: [{ source: 'EDGAR_2024', quality: 'meta_analysis' }]
  };
  
  it('renders three KPI cards', () => {
    render(<TrinityDashboard />);
    expect(screen.getByText('ROI')).toBeInTheDocument();
    expect(screen.getByText('NPV')).toBeInTheDocument();
    expect(screen.getByText('Payback')).toBeInTheDocument();
  });
  
  it('shows trust badge on hover', async () => {
    render(<TrinityDashboard />);
    fireEvent.hover(screen.getByText('214%'));
    await waitFor(() => {
      expect(screen.getByText('Confidence: 95%')).toBeInTheDocument();
    });
  });
  
  it('exports to PDF', async () => {
    const exportFn = jest.fn();
    render(<TrinityDashboard onExport={exportFn} />);
    fireEvent.click(screen.getByText('Export PDF'));
    expect(exportFn).toHaveBeenCalledWith('trinity-dashboard');
  });
});
```

### E2E Tests
```typescript
// tests/e2e/trinity-dashboard.spec.ts
test('CFO completes full workflow', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('#email', 'cfo@company.com');
  await page.click('button[type="submit"]');
  
  // Navigate to Trinity Dashboard
  await page.click('text="Trinity Dashboard"');
  await page.waitForSelector('[data-testid="kpi-roi"]');
  
  // Verify KPIs
  const roiValue = await page.textContent('[data-testid="kpi-roi"] .kpi-value');
  expect(roiValue).toContain('%');
  
  // Hover for trust badge
  await page.hover('[data-testid="kpi-roi"] .kpi-value');
  await page.waitForSelector('.trust-tooltip');
  
  // Export
  await page.click('text="Export PDF"');
  await page.waitForEvent('download');
});
```

---

## 📊 Performance Optimization

### Code Splitting
```typescript
// src/components/templates/lazy.ts
export const TrinityDashboard = lazy(() => 
  import('./organisms/TrinityDashboard')
);

export const ImpactCascadeTemplate = lazy(() => 
  import('./organisms/ImpactCascadeTemplate')
);

export const ScenarioMatrix = lazy(() => 
  import('./organisms/ScenarioMatrix')
);

export const StoryArcCanvas = lazy(() => 
  import('./organisms/StoryArcCanvas')
);

export const QuantumView = lazy(() => 
  import('./organisms/QuantumView')
);
```

### Data Caching
```typescript
// src/components/templates/hooks/useTemplateData.ts
export const useTemplateData = (template: string) => {
  const { data, error } = useSWR(
    `/api/templates/${template}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
      focusThrottleInterval: 30000,
      refreshInterval: 300000 // 5 minutes
    }
  );
  
  return { data, error, isLoading: !data && !error };
};
```

---

## 🎯 Implementation Timeline

### Week 3: Trinity Dashboard & Foundation
- **Day 1-2**: Create atoms (KPICard, TrustBadge, ConfidenceBar)
- **Day 3-4**: Create molecules (FinancialSummary, CashFlowChart, RiskAnalysis)
- **Day 5-7**: Create TrinityDashboard organism
- **Day 8-10**: Unit tests, integration tests, E2E tests

### Week 4: Impact Cascade & Scenario Matrix
- **Day 1-3**: Impact Cascade (Sankey diagram, nodes, links)
- **Day 4-6**: Scenario Matrix (comparison table, variable controls)
- **Day 7-10**: Testing and refinement

### Week 5: Story Arc & Quantum View
- **Day 1-3**: Story Arc Canvas (timeline, narrative, export)
- **Day 4-6**: Quantum View (multi-perspective, consensus algorithm)
- **Day 7-10**: Cross-template testing, performance optimization

### Week 6: Polish & Deployment
- **Day 1-3**: Accessibility audit, mobile responsiveness
- **Day 4-6**: Performance optimization, bundle splitting
- **Day 7-10**: Staging deployment, UAT, production deployment

---

## 📦 Dependencies

### Required Packages
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "framer-motion": "^10.16.0",
    "recharts": "^2.8.0",
    "swr": "^2.2.0",
    "zustand": "^4.4.0",
    "react-flow-renderer": "^12.0.0"
  },
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^5.16.5",
    "@testing-library/user-event": "^14.0.0",
    "jest": "^29.0.0",
    "playwright": "^1.35.0"
  }
}
```

---

## ✅ Success Criteria

### Functional
- [ ] All 5 templates render correctly with Phase 3.5 data
- [ ] Trust badges show cryptographic proof on hover
- [ ] Persona switching works seamlessly
- [ ] Export functionality generates valid files
- [ ] Real-time updates via WebSocket
- [ ] Mobile responsive (breakpoints: 375px, 768px, 1024px)

### Performance
- [ ] Initial load < 2 seconds
- [ ] Template switch < 500ms
- [ ] Trust badge tooltip < 100ms
- [ ] Bundle size < 500kb per template

### Quality
- [ ] Unit test coverage > 90%
- [ ] E2E tests for all personas
- [ ] Accessibility audit passed (WCAG 2.1 AA)
- [ ] No console errors or warnings

### Integration
- [ ] All templates connect to Phase 3.5 adapter
- [ ] Data flows correctly from engine to UI
- [ ] Error handling for missing data
- [ ] Loading states implemented

---

## 🚀 Ready to Execute

**Status**: All specifications complete, ready for development

**Next Actions**:
1. Create atoms (KPICard, TrustBadge, ConfidenceBar)
2. Create molecules (FinancialSummary, CashFlowChart, etc.)
3. Implement TrinityDashboard organism
4. Write tests
5. Repeat for remaining templates

**Estimated Effort**: 60 story points, 4 weeks, 2-3 developers

**Dependencies**: Phase 3.5 must be complete and deployed to staging