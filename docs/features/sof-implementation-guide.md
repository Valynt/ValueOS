# Systemic Outcome Framework (SOF) Implementation Guide

## Overview

The Systemic Outcome Framework (SOF) extends ValueCanvas with sophisticated system mapping, intervention design, and outcome engineering capabilities. This guide covers the complete SOF implementation across all system layers.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [Type System](#type-system)
4. [Agent Layer](#agent-layer)
5. [Component Layer](#component-layer)
6. [Template Layer](#template-layer)
7. [Governance & Audit](#governance--audit)
8. [API Reference](#api-reference)
9. [Usage Examples](#usage-examples)
10. [Best Practices](#best-practices)

## Architecture Overview

SOF integrates with the ValueCanvas lifecycle through five stages:

```
Opportunity → Target → Realization → Expansion → Integrity
    ↓           ↓           ↓            ↓           ↓
System Map → Intervention → Feedback → Replication → Governance
```

### Key Components

- **Database Layer**: 6 core tables + 3 extended tables + governance/audit tables
- **Type System**: 50+ TypeScript types with Zod validation
- **Agent Layer**: 4 specialized agents for analysis and design
- **Component Layer**: Interactive UI components for visualization
- **Template Layer**: 5 lifecycle page templates
- **Governance Layer**: Controls, audit trails, and compliance tracking

## Database Schema

### Core SOF Tables

#### `sof_system_maps`
System-level representation of the business context.

```sql
CREATE TABLE sof_system_maps (
  id uuid PRIMARY KEY,
  business_case_id uuid REFERENCES business_cases(id),
  map_name text NOT NULL,
  map_description text,
  system_boundaries jsonb,
  created_at timestamptz DEFAULT now()
);
```

#### `sof_entities`
Actors, resources, processes, and structures in the system.

```sql
CREATE TABLE sof_entities (
  id uuid PRIMARY KEY,
  system_map_id uuid REFERENCES sof_system_maps(id),
  entity_type text CHECK (entity_type IN ('actor', 'resource', 'process', 'structure')),
  entity_name text NOT NULL,
  entity_description text,
  attributes jsonb DEFAULT '{}'
);
```

#### `sof_relationships`
Connections and dependencies between entities.

```sql
CREATE TABLE sof_relationships (
  id uuid PRIMARY KEY,
  system_map_id uuid REFERENCES sof_system_maps(id),
  source_entity_id uuid REFERENCES sof_entities(id),
  target_entity_id uuid REFERENCES sof_entities(id),
  relationship_type text,
  relationship_strength numeric(3,2),
  is_feedback_loop boolean DEFAULT false
);
```

#### `sof_intervention_points`
High-leverage points for system change.

```sql
CREATE TABLE sof_intervention_points (
  id uuid PRIMARY KEY,
  system_map_id uuid REFERENCES sof_system_maps(id),
  leverage_point_id uuid,
  intervention_type text,
  intervention_description text,
  expected_impact numeric(3,2),
  intervention_sequence jsonb DEFAULT '[]'
);
```

#### `sof_outcome_hypotheses`
Testable predictions linking interventions to outcomes.

```sql
CREATE TABLE sof_outcome_hypotheses (
  id uuid PRIMARY KEY,
  intervention_point_id uuid REFERENCES sof_intervention_points(id),
  hypothesis_statement text NOT NULL,
  causal_chain jsonb NOT NULL,
  success_criteria jsonb,
  validation_status text
);
```

#### `sof_feedback_loops`
Monitoring system behavior changes.

```sql
CREATE TABLE sof_feedback_loops (
  id uuid PRIMARY KEY,
  outcome_hypothesis_id uuid REFERENCES sof_outcome_hypotheses(id),
  loop_type text CHECK (loop_type IN ('reinforcing', 'balancing')),
  trigger_conditions jsonb,
  monitored_behaviors jsonb,
  closure_status text
);
```

### Governance Tables

#### `sof_governance_controls`
Governance policies and compliance tracking.

```sql
CREATE TABLE sof_governance_controls (
  id uuid PRIMARY KEY,
  business_case_id uuid REFERENCES business_cases(id),
  system_map_id uuid REFERENCES sof_system_maps(id),
  control_type text,
  enforcement_level text CHECK (enforcement_level IN ('advisory', 'warning', 'blocking')),
  compliance_status text
);
```

#### `sof_audit_events`
Immutable audit trail for all SOF changes.

```sql
CREATE TABLE sof_audit_events (
  id uuid PRIMARY KEY,
  business_case_id uuid REFERENCES business_cases(id),
  event_type text NOT NULL,
  previous_state jsonb,
  new_state jsonb,
  actor_type text,
  created_at timestamptz DEFAULT now()
);
```

## Type System

### Core Types

```typescript
// System Map
export interface SystemMap {
  id: string;
  business_case_id: string;
  map_name: string;
  map_description?: string;
  system_boundaries?: SystemBoundaries;
  created_at: string;
}

// Entity
export interface Entity {
  id: string;
  system_map_id: string;
  entity_type: 'actor' | 'resource' | 'process' | 'structure';
  entity_name: string;
  entity_description?: string;
  attributes: Record<string, any>;
}

// Intervention Point
export interface InterventionPoint {
  id: string;
  system_map_id: string;
  intervention_type: InterventionType;
  intervention_description: string;
  expected_impact: number;
  intervention_sequence: InterventionStep[];
}

// Outcome Hypothesis
export interface OutcomeHypothesis {
  id: string;
  intervention_point_id: string;
  hypothesis_statement: string;
  causal_chain: CausalChainLink[];
  success_criteria: SuccessCriteria;
  validation_status: ValidationStatus;
}
```

### Zod Schemas

All types have corresponding Zod schemas for runtime validation:

```typescript
export const SystemMapSchema = z.object({
  id: z.string().uuid(),
  business_case_id: z.string().uuid(),
  map_name: z.string().min(1),
  map_description: z.string().optional(),
  system_boundaries: SystemBoundariesSchema.optional(),
  created_at: z.string().datetime(),
});
```

## Agent Layer

### SystemMapperAgent

Analyzes discovery data to create system maps.

```typescript
import { SystemMapperAgent } from '@/agents/sof/SystemMapperAgent';

const agent = new SystemMapperAgent();

const result = await agent.analyzeDiscoveryData(
  businessCaseId,
  discoveryData
);

// Returns: { systemMap, entities, relationships, leveragePoints }
```

**Key Methods:**
- `analyzeDiscoveryData()`: Create system map from discovery
- `identifyLeveragePoints()`: Find high-impact intervention points
- `updateSystemMap()`: Modify existing system map

### InterventionDesignerAgent

Designs interventions based on system maps.

```typescript
import { InterventionDesignerAgent } from '@/agents/sof/InterventionDesignerAgent';

const agent = new InterventionDesignerAgent();

const result = await agent.designInterventions(
  systemMap,
  leveragePoints
);

// Returns: { interventions, sequences, feasibilityAssessments }
```

**Key Methods:**
- `designInterventions()`: Create intervention options
- `assessFeasibility()`: Evaluate implementation feasibility
- `createInterventionSequence()`: Plan implementation steps

### OutcomeEngineerAgent

Creates testable outcome hypotheses.

```typescript
import { OutcomeEngineerAgent } from '@/agents/sof/OutcomeEngineerAgent';

const agent = new OutcomeEngineerAgent();

const result = await agent.createOutcomeHypotheses(
  interventionPoint,
  targetKPIs
);

// Returns: { hypotheses, causalChains, kpiMappings }
```

**Key Methods:**
- `createOutcomeHypotheses()`: Generate testable hypotheses
- `mapToKPIs()`: Link outcomes to measurable KPIs
- `validateHypothesis()`: Test hypothesis validity

### RealizationLoopAgent

Monitors feedback loops and behavior changes.

```typescript
import { RealizationLoopAgent } from '@/agents/sof/RealizationLoopAgent';

const agent = new RealizationLoopAgent();

const result = await agent.monitorFeedbackLoops(
  outcomeHypotheses,
  realizationData
);

// Returns: { feedbackLoops, behaviorChanges, closureRecommendations }
```

**Key Methods:**
- `monitorFeedbackLoops()`: Track system responses
- `detectBehaviorChanges()`: Identify pattern shifts
- `assessLoopClosure()`: Determine when loops are complete

## Component Layer

### SystemMapCanvas

Interactive system map visualization.

```typescript
import { SystemMapCanvas } from '@/components/sof/SystemMapCanvas';

<SystemMapCanvas
  systemMap={systemMap}
  entities={entities}
  relationships={relationships}
  onEntityClick={handleEntityClick}
  onRelationshipClick={handleRelationshipClick}
/>
```

**Features:**
- Drag-and-drop entity positioning
- Relationship visualization
- Leverage point highlighting
- Zoom and pan controls

### InterventionDesigner

Intervention design interface.

```typescript
import { InterventionDesigner } from '@/components/sof/InterventionDesigner';

<InterventionDesigner
  systemMap={systemMap}
  leveragePoints={leveragePoints}
  onInterventionCreated={handleCreated}
/>
```

**Features:**
- Intervention option generation
- Feasibility assessment
- Sequence planning
- Resource estimation

### FeedbackLoopViewer

Feedback loop monitoring dashboard.

```typescript
import { FeedbackLoopViewer } from '@/components/sof/FeedbackLoopViewer';

<FeedbackLoopViewer
  loop={feedbackLoop}
  showMetrics={true}
  showBehaviorChanges={true}
/>
```

**Features:**
- Loop status visualization
- Behavior change timeline
- Metric tracking
- Closure criteria display

## Template Layer

### Lifecycle Templates

SOF extends each lifecycle stage with specialized templates:

#### Opportunity Template
```typescript
import { generateSOFOpportunityPage } from '@/sdui/templates/sof-opportunity-template';

const page = generateSOFOpportunityPage({
  businessCase,
  discoveryData,
});
```

**Features:**
- System map creation
- Entity identification
- Leverage point analysis

#### Target Template
```typescript
import { generateSOFTargetPage } from '@/sdui/templates/sof-target-template';

const page = generateSOFTargetPage({
  businessCase,
  systemMap,
  leveragePoints,
});
```

**Features:**
- Intervention design
- Outcome engineering
- KPI mapping

#### Realization Template
```typescript
import { generateSOFRealizationPage } from '@/sdui/templates/sof-realization-template';

const page = generateSOFRealizationPage({
  businessCase,
  systemMap,
  interventionPoint,
  feedbackLoops,
});
```

**Features:**
- Feedback loop monitoring
- Behavior change tracking
- System stability indicators

#### Expansion Template
```typescript
import { generateSOFExpansionPage } from '@/sdui/templates/sof-expansion-template';

const page = generateSOFExpansionPage({
  businessCase,
  systemMap,
  interventionPoint,
  feedbackLoops,
  expansionData,
});
```

**Features:**
- System replication analysis
- Context comparison
- Scaling strategy

#### Integrity Template
```typescript
import { generateSOFIntegrityPage } from '@/sdui/templates/sof-integrity-template';

const page = generateSOFIntegrityPage({
  businessCase,
  systemMap,
  interventionPoint,
  feedbackLoops,
  integrityData,
});
```

**Features:**
- System health monitoring
- Governance controls
- Audit trail
- Compliance tracking

## Governance & Audit

### Governance Controls

```typescript
import {
  createGovernanceControl,
  checkGovernanceCompliance,
} from '@/lib/sof-governance';

// Create control
const control = await createGovernanceControl({
  business_case_id: businessCaseId,
  system_map_id: systemMapId,
  control_type: 'ethical_review',
  control_name: 'Ethical Impact Assessment',
  enforcement_level: 'warning',
});

// Check compliance
const compliance = await checkGovernanceCompliance(businessCaseId);
if (!compliance.is_compliant) {
  console.log('Blocking controls:', compliance.blocking_controls);
}
```

### Audit Events

```typescript
import {
  createAuditEvent,
  getEntityAuditTrail,
} from '@/lib/sof-governance';

// Log event
await createAuditEvent({
  business_case_id: businessCaseId,
  system_map_id: systemMapId,
  event_type: 'system_map_created',
  event_description: 'System map created by SystemMapperAgent',
  actor_type: 'agent',
  agent_name: 'SystemMapperAgent',
});

// Get audit trail
const trail = await getEntityAuditTrail('system_map', systemMapId);
```

### Lifecycle Links

```typescript
import { createLifecycleLink } from '@/lib/sof-governance';

// Link discovery to system map
await createLifecycleLink({
  source_stage: 'opportunity',
  source_type: 'discovery',
  source_artifact_id: discoveryId,
  target_stage: 'target',
  target_type: 'system_map',
  target_artifact_id: systemMapId,
  relationship_type: 'derived_from',
});
```

## API Reference

### Database Functions

#### `check_sof_governance_compliance(p_business_case_id uuid)`
Returns compliance status for a business case.

```sql
SELECT * FROM check_sof_governance_compliance('bc-123');
```

#### `get_sof_entity_audit_trail(p_entity_type text, p_entity_id uuid)`
Returns audit trail for a specific entity.

```sql
SELECT * FROM get_sof_entity_audit_trail('system_map', 'map-123');
```

#### `create_sof_lifecycle_link(...)`
Creates a lifecycle artifact link.

```sql
SELECT create_sof_lifecycle_link(
  'opportunity', 'discovery', 'disc-123',
  'target', 'system_map', 'map-123',
  'derived_from', 'Mapped from discovery insights'
);
```

## Usage Examples

### Complete Workflow

```typescript
// 1. Create system map from discovery
const mapperAgent = new SystemMapperAgent();
const { systemMap, entities, relationships, leveragePoints } = 
  await mapperAgent.analyzeDiscoveryData(businessCaseId, discoveryData);

// 2. Design interventions
const designerAgent = new InterventionDesignerAgent();
const { interventions } = await designerAgent.designInterventions(
  systemMap,
  leveragePoints
);

// 3. Create outcome hypotheses
const engineerAgent = new OutcomeEngineerAgent();
const { hypotheses } = await engineerAgent.createOutcomeHypotheses(
  interventions[0],
  targetKPIs
);

// 4. Monitor feedback loops
const realizationAgent = new RealizationLoopAgent();
const { feedbackLoops } = await realizationAgent.monitorFeedbackLoops(
  hypotheses,
  realizationData
);

// 5. Check governance compliance
const compliance = await checkGovernanceCompliance(businessCaseId);
if (compliance.is_compliant) {
  console.log('Ready to proceed!');
}
```

## Best Practices

### System Mapping
1. **Start Simple**: Begin with core entities and relationships
2. **Iterate**: Refine the map as you learn more
3. **Validate**: Review with stakeholders
4. **Focus**: Map what matters, not everything

### Intervention Design
1. **High Leverage**: Target points with maximum impact
2. **Feasibility**: Consider resource constraints
3. **Sequences**: Plan implementation steps
4. **Side Effects**: Anticipate unintended consequences

### Outcome Engineering
1. **Specific**: Quantify expected outcomes
2. **Causal**: Explain why changes will occur
3. **Measurable**: Link to concrete KPIs
4. **Testable**: Create falsifiable hypotheses

### Feedback Monitoring
1. **Early**: Start tracking from day one
2. **Multiple Metrics**: Use leading and lagging indicators
3. **Regular Review**: Check progress frequently
4. **Adapt**: Respond to signals promptly

### Governance
1. **Proactive**: Apply controls early
2. **Proportional**: Match enforcement to risk
3. **Documented**: Maintain audit trail
4. **Reviewed**: Regular compliance checks

## Migration Guide

### Enabling SOF for Existing Business Cases

```typescript
// 1. Create system map from existing data
const systemMap = await createSystemMapFromBusinessCase(businessCase);

// 2. Apply default governance controls
await createDefaultGovernanceControls(businessCase.id, systemMap.id);

// 3. Generate lifecycle links
await linkExistingArtifacts(businessCase.id);
```

## Troubleshooting

### Common Issues

**System map not appearing**
- Check RLS policies
- Verify business case ownership
- Ensure system map is linked to business case

**Governance blocking progress**
- Review compliance status
- Update control evidence
- Request approval if needed

**Audit events not logging**
- Verify triggers are enabled
- Check database permissions
- Review event type validity

## Further Reading

- [SOF Academy Track](../supabase/migrations/20251120110000_create_academy_sof_track.sql)
- [Test Suite](../test/sof/README.md)
- [Database Schema](../supabase/migrations/20251120000000_create_sof_schema.sql)
- [Governance Integration](../supabase/migrations/20251120100000_integrate_sof_governance.sql)
