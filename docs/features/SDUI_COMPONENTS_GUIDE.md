# SDUI Component Library - Complete Guide

## Overview

The ValueCanvas SDUI Component Library provides a comprehensive set of production-ready components for building server-driven UI experiences across the Value Operating System (VOS) lifecycle.

## Component Catalog

### Core Components (Existing)

1. **InfoBanner** - High-level lifecycle banners
2. **DiscoveryCard** - Discovery prompts for opportunity framing
3. **ValueTreeCard** - Nested value drivers for target outcomes
4. **ExpansionBlock** - ROI snapshot for expansion stage

### New Components (v1.0)

5. **MetricBadge** - KPI labels with numeric/percentage values
6. **KPIForm** - Baseline and target value entry
7. **ValueCommitForm** - Multiple KPI entries with assumptions
8. **RealizationDashboard** - Baseline vs. target vs. actual tracking
9. **LifecyclePanel** - Generic panel container for lifecycle stages
10. **IntegrityReviewPanel** - Manifesto rule validation results

---

## Component Details

### 1. MetricBadge

**Purpose**: Display KPI labels with numeric or percentage values in a consistent, visually appealing format.

**Props**:
```typescript
interface MetricBadgeProps {
  label: string;              // Metric label
  value: number | string;     // Metric value
  tone?: 'success' | 'warning' | 'error' | 'info';  // Visual tone
  unit?: string;              // Unit (e.g., '%', 'USD')
  size?: 'small' | 'medium' | 'large';  // Size variant
  icon?: React.ReactNode;     // Optional icon
  onClick?: () => void;       // Click handler
}
```

**Usage**:
```tsx
<MetricBadge
  label="Conversion Rate"
  value={23.5}
  unit="%"
  tone="success"
/>
```

**SDUI Registration**:
```json
{
  "component": "MetricBadge",
  "version": 1,
  "props": {
    "label": "Revenue Growth",
    "value": 150000,
    "unit": "USD",
    "tone": "success"
  }
}
```

---

### 2. KPIForm

**Purpose**: Form for entering baseline and target values for a single KPI.

**Props**:
```typescript
interface KPIFormProps {
  kpiName: string;            // KPI name
  onSubmit: (baseline: number, target: number) => void;  // Submit handler
  initialBaseline?: number;   // Initial baseline value
  initialTarget?: number;     // Initial target value
  description?: string;       // KPI description
  unit?: string;              // Unit of measurement
  loading?: boolean;          // Loading state
  disabled?: boolean;         // Disabled state
  onCancel?: () => void;      // Cancel handler
  showSuccess?: boolean;      // Show success message
}
```

**Usage**:
```tsx
<KPIForm
  kpiName="Lead Conversion Rate"
  unit="%"
  onSubmit={(baseline, target) => {
    console.log(`Baseline: ${baseline}, Target: ${target}`);
  }}
/>
```

**Features**:
- Real-time validation
- Improvement percentage calculation
- Success/error messaging
- Accessibility support

**SDUI Registration**:
```json
{
  "component": "KPIForm",
  "version": 1,
  "props": {
    "kpiName": "Lead Conversion Rate",
    "unit": "%",
    "description": "Track lead-to-customer conversion"
  },
  "hydrateWith": ["/api/kpi/lead-conversion"]
}
```

---

### 3. ValueCommitForm

**Purpose**: Extended form for multiple KPI entries with supporting assumptions.

**Props**:
```typescript
interface ValueCommitFormProps {
  kpis: string[];             // List of KPI names
  onCommit: (committed: CommitKPI[], assumptions: string) => void;
  initialCommitted?: CommitKPI[];  // Initial committed KPIs
  initialAssumptions?: string;     // Initial assumptions
  loading?: boolean;
  disabled?: boolean;
  onCancel?: () => void;
  showSuccess?: boolean;
  allowCustomKPIs?: boolean;  // Allow custom KPI entry
}

interface CommitKPI {
  kpiName: string;
  baseline: number;
  target: number;
  unit?: string;
}
```

**Usage**:
```tsx
<ValueCommitForm
  kpis={['Lead Conversion Rate', 'Manual Hours Reduced']}
  onCommit={(committed, assumptions) => {
    console.log('Committed KPIs:', committed);
    console.log('Assumptions:', assumptions);
  }}
  allowCustomKPIs
/>
```

**Features**:
- Add/remove multiple KPIs
- Custom KPI support
- Assumptions documentation
- Average improvement calculation
- Comprehensive validation

**SDUI Registration**:
```json
{
  "component": "ValueCommitForm",
  "version": 1,
  "props": {
    "kpis": ["Lead Conversion Rate", "Manual Hours Reduced"],
    "allowCustomKPIs": true
  },
  "hydrateWith": ["/api/target/kpis", "/api/target/commitments"]
}
```

---

### 4. RealizationDashboard

**Purpose**: Display baseline vs. target vs. actual results for realized value.

**Props**:
```typescript
interface RealizationDashboardProps {
  // Single KPI mode
  kpiName?: string;
  baseline?: number;
  target?: number;
  actual?: number;
  unit?: string;
  
  // Multiple KPIs mode
  kpis?: KPIRealization[];
  
  title?: string;
  showDetails?: boolean;      // Show detailed metrics
  showTrends?: boolean;       // Show trend indicators
  onKPIClick?: (kpiName: string) => void;  // Click handler
}

interface KPIRealization {
  kpiName: string;
  baseline: number;
  target: number;
  actual: number;
  unit?: string;
  status?: 'on-track' | 'at-risk' | 'off-track' | 'achieved';
  lastUpdated?: Date;
}
```

**Usage**:
```tsx
<RealizationDashboard
  kpis={[
    {
      kpiName: 'Lead Conversion Rate',
      baseline: 15,
      target: 25,
      actual: 22,
      unit: '%'
    }
  ]}
  showDetails
  showTrends
/>
```

**Features**:
- Single or multiple KPI display
- Status indicators (achieved, on-track, at-risk, off-track)
- Progress bars
- Summary statistics
- Trend indicators
- Detailed metrics

**SDUI Registration**:
```json
{
  "component": "RealizationDashboard",
  "version": 1,
  "props": {
    "title": "Value Realization",
    "showDetails": true,
    "showTrends": true
  },
  "hydrateWith": ["/api/realization/kpis", "/api/realization/actuals"]
}
```

---

### 5. LifecyclePanel

**Purpose**: Generic panel container for each lifecycle stage with consistent styling.

**Props**:
```typescript
interface LifecyclePanelProps {
  stage: 'Opportunity' | 'Target' | 'Realization' | 'Expansion' | 'Integrity';
  children: React.ReactNode;
  title?: string;             // Override default title
  description?: string;       // Override default description
  showIcon?: boolean;         // Show stage icon
  showIndicator?: boolean;    // Show progress indicator
  variant?: 'default' | 'compact' | 'detailed';
  actions?: React.ReactNode;  // Action buttons
  onClick?: () => void;       // Click handler for navigation
  isActive?: boolean;         // Active stage indicator
  isCompleted?: boolean;      // Completed stage indicator
}
```

**Usage**:
```tsx
<LifecyclePanel stage="Opportunity" isActive>
  <DiscoveryCard questions={['What is the problem?']} />
  <ValueTreeCard title="Value Drivers" nodes={['Revenue', 'Cost']} />
</LifecyclePanel>
```

**Features**:
- Stage-specific colors and icons
- Progress indicators
- Active/completed states
- Clickable for navigation
- Action button support
- Multiple variants

**SDUI Registration**:
```json
{
  "component": "LifecyclePanel",
  "version": 1,
  "props": {
    "stage": "Opportunity",
    "isActive": true
  },
  "children": [
    {
      "component": "DiscoveryCard",
      "props": { "questions": ["What is the problem?"] }
    }
  ]
}
```

---

### 6. IntegrityReviewPanel

**Purpose**: Display manifesto rule validation results with remediation suggestions.

**Props**:
```typescript
interface IntegrityReviewPanelProps {
  results: RuleResult[];
  title?: string;
  showDetails?: boolean;      // Show detailed information
  showRemediation?: boolean;  // Show remediation suggestions
  groupByStatus?: boolean;    // Group by passed/failed
  onRuleClick?: (rule: string) => void;  // Click handler
  showSummary?: boolean;      // Show summary statistics
}

interface RuleResult {
  rule: string;               // Rule identifier
  description?: string;       // Rule description
  passed: boolean;            // Pass/fail status
  message?: string;           // Result message
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
  remediation?: string;       // Suggested fix
  principle?: string;         // Related manifesto principle
}
```

**Usage**:
```tsx
<IntegrityReviewPanel
  results={[
    {
      rule: 'Value is defined by outcomes',
      passed: true,
      principle: 'Manifesto Rule #1'
    },
    {
      rule: 'Conservative quantification',
      passed: false,
      severity: 'high',
      message: 'ROI assumptions too aggressive',
      remediation: 'Reduce growth assumptions by 20%'
    }
  ]}
  showDetails
  showRemediation
/>
```

**Features**:
- Pass/fail indicators
- Severity levels
- Remediation suggestions
- Summary statistics
- Compliance rate calculation
- Expandable details
- Grouped display

**SDUI Registration**:
```json
{
  "component": "IntegrityReviewPanel",
  "version": 1,
  "props": {
    "title": "Manifesto Compliance Review",
    "showDetails": true,
    "showRemediation": true
  },
  "hydrateWith": ["/api/integrity/validation"]
}
```

---

## Lifecycle Templates

### Opportunity Template

```json
{
  "type": "page",
  "version": 1,
  "sections": [
    {
      "component": "InfoBanner",
      "props": {
        "title": "Opportunity Discovery",
        "description": "Identify and frame business problems"
      }
    },
    {
      "component": "DiscoveryCard",
      "props": {
        "questions": [
          "What business problem are we solving?",
          "Who is the primary persona?",
          "What KPIs could be improved?"
        ]
      }
    },
    {
      "component": "ValueTreeCard",
      "props": {
        "title": "Potential Value Drivers",
        "nodes": ["Revenue Growth", "Cost Reduction"]
      },
      "hydrateWith": ["/api/opportunity/value-drivers"]
    }
  ]
}
```

### Target Template

```json
{
  "type": "page",
  "version": 1,
  "sections": [
    {
      "component": "InfoBanner",
      "props": {
        "title": "Target Value Commitment",
        "tone": "warning"
      }
    },
    {
      "component": "ValueCommitForm",
      "props": {
        "kpis": ["Lead Conversion Rate", "Manual Hours Reduced"],
        "allowCustomKPIs": true
      },
      "hydrateWith": ["/api/target/kpis"]
    }
  ]
}
```

### Realization Template

```json
{
  "type": "page",
  "version": 1,
  "sections": [
    {
      "component": "InfoBanner",
      "props": {
        "title": "Value Realization Tracking",
        "tone": "success"
      }
    },
    {
      "component": "RealizationDashboard",
      "props": {
        "showDetails": true,
        "showTrends": true
      },
      "hydrateWith": ["/api/realization/kpis"]
    }
  ]
}
```

### Expansion Template

```json
{
  "type": "page",
  "version": 1,
  "sections": [
    {
      "component": "InfoBanner",
      "props": {
        "title": "Expansion Opportunities"
      }
    },
    {
      "component": "ExpansionBlock",
      "props": {
        "gaps": ["Advanced Analytics"],
        "roi": { "revenue": 150000, "cost": 25000 }
      },
      "hydrateWith": ["/api/expansion/gaps"]
    }
  ]
}
```

### Integrity Template

```json
{
  "type": "page",
  "version": 2,
  "sections": [
    {
      "component": "InfoBanner",
      "props": {
        "title": "Integrity Check",
        "tone": "warning"
      }
    },
    {
      "component": "IntegrityReviewPanel",
      "props": {
        "showDetails": true,
        "showRemediation": true
      },
      "hydrateWith": ["/api/integrity/validation"]
    }
  ]
}
```

---

## Component Registry

All components are registered in `src/sdui/registry.tsx`:

```typescript
const baseRegistry: Record<string, RegistryEntry> = {
  MetricBadge: {
    component: MetricBadge,
    versions: [1],
    requiredProps: ['label', 'value'],
    description: 'Displays a KPI label with numeric or percentage value.',
  },
  KPIForm: {
    component: KPIForm,
    versions: [1],
    requiredProps: ['kpiName', 'onSubmit'],
    description: 'Form for entering baseline and target values for a KPI.',
  },
  // ... other components
};
```

---

## Usage with renderPage()

```tsx
import { renderPage } from './sdui';
import { OpportunityTemplate } from './sdui/templates';

function OpportunityPage() {
  const result = renderPage(OpportunityTemplate, {
    onHydrationComplete: (componentName, data) => {
      console.log(`Loaded ${componentName}:`, data);
    },
    onComponentRender: (componentName) => {
      console.log(`Rendered ${componentName}`);
    },
  });

  return result.element;
}
```

---

## Testing

All components have comprehensive test coverage:

```bash
npm run test -- src/components/SDUI/__tests__/NewComponents.test.tsx
```

Test coverage includes:
- Component rendering
- Props validation
- User interactions
- Form submissions
- Data display
- Error handling
- Accessibility

---

## Storybook

View all components in Storybook:

```bash
npm run storybook
```

Stories are available at:
- `SDUI/MetricBadge`
- `SDUI/KPIForm`
- `SDUI/ValueCommitForm`
- `SDUI/RealizationDashboard`
- `SDUI/LifecyclePanel`
- `SDUI/IntegrityReviewPanel`

---

## Best Practices

### 1. Use Appropriate Components for Each Stage

- **Opportunity**: DiscoveryCard, ValueTreeCard, InfoBanner
- **Target**: ValueCommitForm, KPIForm, ValueTreeCard
- **Realization**: RealizationDashboard, MetricBadge
- **Expansion**: ExpansionBlock, ValueTreeCard, KPIForm
- **Integrity**: IntegrityReviewPanel, InfoBanner

### 2. Leverage Data Hydration

Always use `hydrateWith` for dynamic data:

```json
{
  "component": "RealizationDashboard",
  "hydrateWith": ["/api/realization/kpis"],
  "fallback": {
    "component": "InfoBanner",
    "props": { "title": "Loading data..." }
  }
}
```

### 3. Provide Fallbacks

Always provide fallback UI for hydration failures:

```json
{
  "component": "ValueCommitForm",
  "hydrateWith": ["/api/target/kpis"],
  "fallback": {
    "message": "KPI data temporarily unavailable",
    "component": "InfoBanner",
    "props": { "tone": "warning" }
  }
}
```

### 4. Use LifecyclePanel for Consistency

Wrap stage content in LifecyclePanel for consistent styling:

```tsx
<LifecyclePanel stage="Target" isActive>
  <ValueCommitForm kpis={kpis} onCommit={handleCommit} />
</LifecyclePanel>
```

### 5. Validate with IntegrityReviewPanel

Always validate artifacts against manifesto rules:

```tsx
<IntegrityReviewPanel
  results={validationResults}
  showRemediation
  groupByStatus
/>
```

---

## Migration from Old Components

If you're using older component patterns, migrate to the new components:

### Before:
```tsx
<div className="p-4 bg-blue-50">
  <h3>Lead Conversion Rate</h3>
  <p>Baseline: 15%</p>
  <p>Target: 25%</p>
</div>
```

### After:
```tsx
<KPIForm
  kpiName="Lead Conversion Rate"
  unit="%"
  initialBaseline={15}
  initialTarget={25}
  onSubmit={handleSubmit}
/>
```

---

## Support

For questions or issues:
- Review component source code in `src/components/SDUI/`
- Check Storybook stories for examples
- Review test files for usage patterns
- See main SDUI documentation in `src/sdui/README.md`

---

**Version**: 1.0  
**Last Updated**: November 18, 2025  
**Status**: Production-Ready
