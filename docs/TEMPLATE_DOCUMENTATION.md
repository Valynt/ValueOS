# UI Template Documentation

## Overview
This document provides comprehensive documentation for all UI templates in the ValueOS system, including usage guidelines, security features, and integration patterns.

## Templates

### 1. Trinity Dashboard (ROI/NPV/Payback)
**File:** `src/views/ROICalculator.tsx`  
**Security:** `src/views/SecureROICalculator.tsx`

#### Purpose
Calculates and visualizes financial metrics including ROI, NPV, and Payback Period for business case analysis.

#### Key Features
- Real-time financial calculations
- Smart optimization engine
- 3-year trajectory visualization
- Value breakdown analysis
- Strategic insights generation

#### Usage
```tsx
import ROICalculator from '../views/ROICalculator';

function App() {
  return <ROICalculator />;
}
```

#### Input Parameters
| Parameter | Type | Range | Description |
|-----------|------|-------|-------------|
| engHeadcount | number | 1-50 | Engineering team size |
| engSalary | number | 80-200 | Average salary ($k) |
| buildCost | number | 50-500 | Initial build cost ($k) |
| efficiencyTarget | number | 5-50 | Target efficiency gain (%) |

#### Calculations
- **Dev Productivity**: `engHeadcount × engSalary × (efficiencyTarget / 100)`
- **Total Benefits**: `devProductivity + maintenanceAvoidance`
- **ROI**: `((totalBenefits - buildCost) / buildCost) × 100`
- **Payback**: `buildCost / (totalBenefits / 12)`
- **NPV**: `(netBenefit × 2.8) / 1000`

#### Security Features
- ✅ Input sanitization for all numeric fields
- ✅ Range validation (prevents extreme values)
- ✅ XSS prevention in drawer content
- ✅ CSRF protection for API calls
- ✅ Rate limiting on calculations

#### Accessibility
- ARIA labels on all interactive elements
- Keyboard navigation support
- Screen reader announcements for calculations
- High contrast mode support

#### Performance
- Renders in <100ms
- Handles 100+ concurrent calculations
- Optimized re-renders with React.memo
- Debounced input updates

---

### 2. Impact Cascade (Sankey)
**File:** `src/views/ImpactCascade.tsx`

#### Purpose
Visualizes value flow through organizational layers using a Sankey diagram approach.

#### Key Features
- Tree and table view modes
- Drag-and-drop feature mapping
- Confidence indicators
- Challenge resolution tracking
- Validation status panel

#### Usage
```tsx
import ImpactCascade from '../views/ImpactCascade';

function App() {
  return <ImpactCascade />;
}
```

#### Data Structure
```typescript
interface Driver {
  label: string;
  value: string;
  change: string;
  type: string;
  confidence: number;
}

interface SubDriver {
  label: string;
  value: string;
  parent: string;
  confidence: number;
  ai?: boolean;
}
```

#### Security Features
- ✅ Sanitizes all displayed text
- ✅ Validates drag-and-drop data
- ✅ Prevents XSS in challenge cards
- ✅ Secure file upload validation
- ✅ Input length limits

#### Accessibility
- Drag-and-drop keyboard alternatives
- ARIA live regions for updates
- Focus management in modals
- Descriptive button labels

#### Mobile Responsiveness
- Collapsible side panels
- Touch-friendly drag targets
- Responsive grid layout
- Gesture support for navigation

---

### 3. Scenario Matrix (Scenario Selector)
**File:** `src/components/SDUI/ScenarioSelector.tsx`

#### Purpose
Multi-view scenario selection interface with AI recommendations and filtering.

#### Key Features
- Grid and list view modes
- AI-powered recommendations
- Category filtering
- Search functionality
- Multi-select support
- Preview functionality

#### Usage
```tsx
import { ScenarioSelector } from '../components/SDUI/ScenarioSelector';

const scenarios = [
  {
    id: 'roi-calculator',
    title: 'ROI Calculator',
    description: 'Calculate return on investment',
    category: 'Financial',
    icon: 'chart',
    aiRecommended: true,
    aiConfidence: 0.95,
    estimatedTime: '15 min',
    estimatedValue: '$50K-500K',
    complexity: 'simple',
    tags: ['finance', 'investment'],
  },
];

function App() {
  return (
    <ScenarioSelector
      scenarios={scenarios}
      onSelect={(scenario) => console.log(scenario)}
      showAIRecommendations={true}
    />
  );
}
```

#### Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| title | string | - | Component title |
| description | string | - | Component description |
| scenarios | Scenario[] | [] | Array of scenarios |
| categories | ScenarioCategory[] | - | Filter categories |
| selectedId | string | - | Pre-selected scenario |
| multiSelect | boolean | false | Enable multi-select |
| showAIRecommendations | boolean | true | Show AI badges |
| showSearch | boolean | true | Show search input |
| showFilters | boolean | true | Show category filter |
| showViewToggle | boolean | true | Show view mode toggle |
| defaultView | 'grid' \| 'list' | 'grid' | Initial view mode |
| columns | 1 \| 2 \| 3 \| 4 | 2 | Grid columns |
| maxHeight | string | - | Container max height |

#### Security Features
- ✅ Comprehensive XSS sanitization
- ✅ Input validation for search
- ✅ CSRF token handling
- ✅ Rate limiting on search
- ✅ Safe JSON parsing

#### Accessibility
- Keyboard navigation (Tab, Enter, Arrow keys)
- Screen reader announcements
- Focus trap in modals
- ARIA labels and roles

#### Performance
- Virtual scrolling for large lists
- Debounced search (300ms)
- Memoized filtered results
- Lazy loading support

---

### 4. Story Arc Canvas (Value Canvas)
**File:** `src/views/ValueCanvas.tsx`

#### Purpose
Chat-based interface for creating value narratives from various sources.

#### Key Features
- Multiple input sources (research, CRM, sales calls, uploads)
- Template-based initialization
- Chat canvas layout
- Session management
- State persistence

#### Usage
```tsx
import ValueCanvas from '../views/ValueCanvas';
import { useNavigate } from 'react-router-dom';

function App() {
  const navigate = useNavigate();
  
  const startFromResearch = (domain: string) => {
    navigate('/value-canvas', {
      state: { source: 'research', domain }
    });
  };
  
  return <ValueCanvas />;
}
```

#### Supported Sources
| Source | Required Props | Description |
|--------|----------------|-------------|
| research | domain | Start from market research |
| sales-call | data | Start from sales call notes |
| crm | data | Start from CRM data |
| upload-notes | data | Start from uploaded notes |
| template | templateId | Start from template |
| generic | - | Generic starting point |

#### Security Features
- ✅ Source validation
- ✅ Data sanitization per source
- ✅ File upload validation
- ✅ Session isolation
- ✅ CSRF protection

#### Accessibility
- Chat interface ARIA patterns
- Keyboard shortcuts
- Screen reader friendly
- Focus management

---

### 5. Quantum View (Multi-Persona)
**File:** `src/views/QuantumView.tsx`

#### Purpose
Multi-perspective analysis from different AI personas with consensus tracking.

#### Key Features
- 5 persona types (Financial, Technical, Strategic, Risk, Operational)
- Consensus detection
- Detailed analysis views
- Confidence scoring
- AI-generated indicators

#### Usage
```tsx
import QuantumView from '../views/QuantumView';

const analyses = [
  {
    id: 'financial-1',
    persona: 'financial',
    title: 'Financial Analysis',
    summary: 'Strong ROI potential',
    confidence: 85,
    keyMetrics: [
      { label: 'ROI', value: '245', unit: '%', trend: 'up' }
    ],
    recommendations: ['Proceed with investment'],
    risks: ['Market volatility'],
    consensus: true,
    aiGenerated: true,
  },
];

function App() {
  return (
    <QuantumView
      title="Business Analysis"
      analyses={analyses}
      showConsensus={true}
      autoSync={false}
    />
  );
}
```

#### Persona Types
| Persona | Icon | Color | Focus |
|---------|------|-------|-------|
| financial | TrendingUp | Green | ROI, NPV, Payback |
| technical | Brain | Blue | Architecture, Scale |
| strategic | Users | Purple | Market position, Vision |
| risk | Shield | Red | Risks, Mitigation |
| operational | Activity | Orange | Process, Efficiency |

#### Security Features
- ✅ Persona data validation
- ✅ Consensus algorithm security
- ✅ Input sanitization
- ✅ Rate limiting on analysis
- ✅ Secure data aggregation

#### Accessibility
- Persona selection keyboard navigation
- Consensus announcement
- Detail view focus management
- Screen reader friendly metrics

#### Performance
- Handles 20+ personas
- Fast consensus calculation
- Optimized re-renders
- Lazy loading support

---

## Security Hardening Guide

### XSS Prevention
All templates use DOMPurify for sanitization:

```typescript
import { sanitizeHTML, sanitizeUserInput } from '../../utils/templateSecurity';

// For HTML content
const safeHTML = sanitizeHTML(userInput);

// For plain text
const safeText = sanitizeUserInput(userInput);
```

### Input Validation
Use template-specific validators:

```typescript
import { validateROIInputs, validateScenarioData } from '../../utils/templateSecurity';

// ROI inputs
const validated = validateROIInputs({
  engHeadcount: 20,
  engSalary: 130,
  buildCost: 250,
  efficiencyTarget: 20,
});

// Scenario data
const safeScenario = validateScenarioData({
  id: 'scenario-1',
  title: 'My Scenario',
  description: 'Description',
});
```

### CSRF Protection
For API calls:

```typescript
import { getCSRFToken } from '../../utils/templateSecurity';

const token = getCSRFToken();

fetch('/api/data', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': token,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(data),
});
```

### Rate Limiting
Prevent abuse:

```typescript
import { checkRateLimit } from '../../utils/templateSecurity';

if (checkRateLimit('user-123', { maxRequests: 10, windowMs: 60000 })) {
  // Allow action
} else {
  // Rate limit exceeded
  logSecurityEvent({
    type: 'rate_limit',
    source: 'TemplateAction',
    details: { userId: 'user-123' },
  });
}
```

---

## Integration Patterns

### Template Navigation
```typescript
import { useNavigate } from 'react-router-dom';

function TemplateFlow() {
  const navigate = useNavigate();
  
  const handleComplete = (data: any) => {
    // Sanitize data before navigation
    const safeData = sanitizeDataObject(data);
    
    navigate('/next-template', {
      state: safeData,
      replace: false,
    });
  };
  
  return <CurrentTemplate onComplete={handleComplete} />;
}
```

### Data Sharing Between Templates
```typescript
// Template A: Prepare data
const prepareData = () => {
  return {
    metrics: { roi: 200, npv: 1.5 },
    assumptions: { efficiency: 20 },
    timestamp: Date.now(),
  };
};

// Template B: Consume data
const consumeData = (data: any) => {
  const safeData = sanitizeDataObject(data);
  // Use safeData
};
```

### Error Boundary Integration
```typescript
import { withErrorBoundary } from '../components/ErrorBoundary';

const SecureTemplate = withErrorBoundary(
  withSecurity(TemplateComponent, {
    sanitizeProps: true,
    validateInputs: true,
  })
);
```

---

## Testing Guidelines

### Unit Tests
Each template should have:
- Component rendering tests
- User interaction tests
- Security validation tests
- Accessibility tests
- Performance tests

### Integration Tests
Test complete workflows:
- Cross-template navigation
- Data flow between templates
- Error recovery
- Mobile responsiveness

### Security Tests
- XSS attack prevention
- CSRF token validation
- Input sanitization
- Rate limiting
- Data validation

---

## Performance Optimization

### 1. Code Splitting
```typescript
const QuantumView = React.lazy(() => import('../views/QuantumView'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <QuantumView />
    </Suspense>
  );
}
```

### 2. Memoization
```typescript
const MemoizedScenario = React.memo(ScenarioCard, (prev, next) => {
  return prev.scenario.id === next.scenario.id;
});
```

### 3. Virtual Scrolling
For large lists:
```typescript
import { FixedSizeList as List } from 'react-window';

<List
  height={400}
  itemCount={scenarios.length}
  itemSize={100}
>
  {({ index, style }) => (
    <ScenarioCard style={style} scenario={scenarios[index]} />
  )}
</List>
```

### 4. Debouncing
```typescript
import { debounce } from 'lodash-es';

const debouncedSearch = debounce((query: string) => {
  // Search logic
}, 300);
```

---

## Accessibility Checklist

### WCAG 2.1 AA Compliance
- [ ] All interactive elements have accessible names
- [ ] Color contrast ratio ≥ 4.5:1
- [ ] Keyboard navigation works everywhere
- [ ] Focus indicators are visible
- [ ] Screen readers announce changes
- [ ] Form inputs have labels
- [ ] Error messages are descriptive
- [ ] No content flashes >3 times/second

### Keyboard Shortcuts
- `Tab` - Navigate forward
- `Shift+Tab` - Navigate backward
- `Enter` - Activate button
- `Escape` - Close modals
- `Arrow keys` - Navigate lists

---

## Deployment Checklist

### Pre-deployment
- [ ] All tests passing
- [ ] Security audit complete
- [ ] Performance benchmarks met
- [ ] Accessibility audit complete
- [ ] Documentation updated

### Post-deployment
- [ ] Monitor security events
- [ ] Track performance metrics
- [ ] Check error logs
- [ ] Verify mobile responsiveness
- [ ] Test user flows

---

## Support

For issues or questions:
1. Check this documentation
2. Review test files in `src/views/__tests__/`
3. Check security utils in `src/utils/templateSecurity.ts`
4. Contact the development team

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-29 | Initial documentation |
| - | - | - |