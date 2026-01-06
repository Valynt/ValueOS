# Frontend Context

## Overview
ValueOS frontend is built with React 18.3, TypeScript, and Vite. The UI follows a deal-centric workflow with lifecycle stages.

## Tech Stack

### Core
- **React:** 18.3.1
- **TypeScript:** 5.6.2
- **Vite:** 7.2.0
- **React Router:** 7.1.3

### UI Components
- **Radix UI:** Accessible component primitives
- **Tailwind CSS:** Utility-first styling
- **Lucide React:** Icon library
- **Recharts:** Data visualization

### State Management
- **React Context:** Global state
- **React Query:** Server state (planned)
- **Local Storage:** Persistence

### Forms & Validation
- **React Hook Form:** Form management
- **Zod:** Schema validation

---

## Project Structure

```
src/
├── components/          # React components
│   ├── ui/             # Base UI components (Radix)
│   ├── Deals/          # Deal-specific components
│   ├── Chat/           # Chat interface (legacy)
│   └── Layout/         # Layout components
├── views/              # Page-level components
│   ├── DealsView.tsx   # Main sales enablement UI
│   ├── ChatView.tsx    # Legacy chat interface
│   └── SettingsView.tsx
├── services/           # API clients
│   ├── UnifiedAgentAPI.ts
│   ├── ValueCaseService.ts
│   └── OpportunityService.ts
├── lib/                # Utilities
│   ├── supabase.ts     # Supabase client
│   └── utils.ts        # Helper functions
├── hooks/              # Custom React hooks
├── types/              # TypeScript types
├── config/             # Configuration
└── styles/             # Global styles
```

---

## Key Views

### DealsView (`src/views/DealsView.tsx`)
Main sales enablement interface.

**Features:**
- Deal import/creation
- Deal selection
- Lifecycle stage navigation
- Business case generation
- Persona customization

**Layout:**
```
┌─────────────────────────────────────┐
│ Header: Import/Create Deal          │
├─────────────────────────────────────┤
│ Deal Selector (if no deal selected) │
├─────────────────────────────────────┤
│ Lifecycle Stage Navigation           │
│ [Discovery] [Modeling] [Realization] │
├─────────────────────────────────────┤
│ Stage Content                        │
│ - Discovery: Opportunity Analysis    │
│ - Modeling: Value Model + Financial  │
│ - Realization: Metrics Tracking      │
│ - Expansion: Upsell Opportunities    │
└─────────────────────────────────────┘
```

**State Management:**
```typescript
const [selectedDeal, setSelectedDeal] = useState<ValueCase | null>(null);
const [currentStage, setCurrentStage] = useState<LifecycleStage>('discovery');
const [isGenerating, setIsGenerating] = useState(false);
```

---

## Component Library

### Base UI Components (`src/components/ui/`)

All base components use Radix UI primitives with Tailwind styling.

**Available Components:**
- `button.tsx` - Button variants
- `card.tsx` - Card container
- `dialog.tsx` - Modal dialogs
- `input.tsx` - Text inputs
- `select.tsx` - Dropdown selects
- `badge.tsx` - Status badges
- `progress.tsx` - Progress bars
- `tabs.tsx` - Tab navigation
- `tooltip.tsx` - Tooltips
- `alert.tsx` - Alert messages

**Usage Pattern:**
```typescript
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

<Card>
  <Button variant="primary" size="lg">
    Generate Business Case
  </Button>
</Card>
```

**Variants:**
```typescript
// Button variants
variant: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
size: 'default' | 'sm' | 'lg' | 'icon'

// Badge variants
variant: 'default' | 'secondary' | 'destructive' | 'outline'
```

---

### Deal Components (`src/components/Deals/`)

#### DealImportModal
Import deals from CRM or create manually.

**Props:**
```typescript
interface DealImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDealCreated: (deal: ValueCase) => void;
}
```

**Features:**
- CRM integration (Salesforce, HubSpot)
- Manual deal creation
- Company name validation
- Description input

#### DealSelector
Browse and select existing deals.

**Props:**
```typescript
interface DealSelectorProps {
  onDealSelected: (deal: ValueCase) => void;
}
```

**Features:**
- Search by company name
- Filter by lifecycle stage
- Sort by date/status
- Pagination

#### LifecycleStageNav
Navigate between lifecycle stages.

**Props:**
```typescript
interface LifecycleStageNavProps {
  currentStage: LifecycleStage;
  onStageChange: (stage: LifecycleStage) => void;
  completedStages: LifecycleStage[];
}
```

**Stages:**
1. Discovery - Identify pain points
2. Modeling - Build value model
3. Realization - Track delivery
4. Expansion - Identify upsell

#### BusinessCaseGenerator
Orchestrate multi-agent workflow with real-time progress.

**Props:**
```typescript
interface BusinessCaseGeneratorProps {
  valueCaseId: string;
  onComplete: (result: BusinessCaseResult) => void;
}
```

**Features:**
- Real-time progress updates
- Agent execution streaming
- Error handling
- Retry logic
- Confidence scores

**Progress States:**
```typescript
type AgentStatus = 'pending' | 'running' | 'complete' | 'error';

interface AgentProgress {
  agent: string;
  status: AgentStatus;
  progress: number; // 0-100
  message: string;
  duration?: number;
}
```

#### PersonaSelector
Select and customize buyer persona.

**Props:**
```typescript
interface PersonaSelectorProps {
  selectedPersona: BuyerPersona | null;
  onPersonaSelected: (persona: BuyerPersona) => void;
}
```

**Personas:**
1. **CFO** - Financial decision maker
2. **CIO/CTO** - Technology leader
3. **COO** - Operations executive
4. **VP Sales** - Revenue leader
5. **VP Marketing** - Marketing leader
6. **Business Unit Leader** - Department head

**Persona Attributes:**
```typescript
interface BuyerPersona {
  role: string;
  seniority: 'C-level' | 'VP' | 'Director' | 'Manager';
  decision_authority: 'high' | 'medium' | 'low';
  priorities: string[];
  pain_points: string[];
  success_metrics: string[];
}
```

#### OpportunityAnalysisPanel
Display identified pain points and objectives.

**Props:**
```typescript
interface OpportunityAnalysisPanelProps {
  valueCaseId: string;
}
```

**Features:**
- Pain point list with impact scores
- Business objectives with priority
- Data source attribution
- Confidence indicators

#### BenchmarkComparisonPanel
Visualize industry benchmarks.

**Props:**
```typescript
interface BenchmarkComparisonPanelProps {
  valueCaseId: string;
  kpiName: string;
  currentValue: number;
}
```

**Features:**
- Percentile visualization
- Gap analysis
- Improvement opportunity
- Industry comparison

---

## Services

### UnifiedAgentAPI (`src/services/UnifiedAgentAPI.ts`)
Single interface for all agent invocations.

**Usage:**
```typescript
import { getUnifiedAgentAPI } from '@/services/UnifiedAgentAPI';

const api = getUnifiedAgentAPI();

// Invoke agent
const response = await api.invoke({
  agent: 'opportunity',
  query: 'Analyze Acme Corp',
  context: {
    valueCaseId: 'uuid',
    company: 'Acme Corp'
  }
});

// Stream agent execution
const stream = api.streamInvoke({
  agent: 'opportunity',
  query: 'Analyze Acme Corp',
  context: { valueCaseId: 'uuid' }
});

for await (const chunk of stream) {
  console.log(chunk.progress, chunk.message);
}
```

### ValueCaseService (`src/services/ValueCaseService.ts`)
CRUD operations for value cases.

**Methods:**
```typescript
class ValueCaseService {
  async create(data: CreateValueCaseInput): Promise<ValueCase>;
  async getById(id: string): Promise<ValueCase>;
  async list(filters?: ValueCaseFilters): Promise<ValueCase[]>;
  async update(id: string, data: UpdateValueCaseInput): Promise<ValueCase>;
  async delete(id: string): Promise<void>;
  async updateLifecycleStage(id: string, stage: LifecycleStage): Promise<void>;
}

// Singleton instance
export const valueCaseService = new ValueCaseService();
```

### OpportunityService (`src/services/OpportunityService.ts`)
Manage opportunities (pain points and objectives).

**Methods:**
```typescript
class OpportunityService {
  async create(data: CreateOpportunityInput): Promise<Opportunity>;
  async listByValueCase(valueCaseId: string): Promise<Opportunity[]>;
  async update(id: string, data: UpdateOpportunityInput): Promise<Opportunity>;
  async delete(id: string): Promise<void>;
}

export const opportunityService = new OpportunityService();
```

---

## Routing

### AppRoutes (`src/AppRoutes.tsx`)

```typescript
<Routes>
  <Route path="/" element={<DealsView />} />
  <Route path="/deals" element={<DealsView />} />
  <Route path="/deals/:id" element={<DealsView />} />
  <Route path="/chat" element={<ChatView />} />
  <Route path="/settings" element={<SettingsView />} />
</Routes>
```

**Default Route:** `/` redirects to `/deals`

---

## State Management

### Global State (Context)
```typescript
// src/contexts/AppContext.tsx
interface AppState {
  user: User | null;
  tenant: Tenant | null;
  selectedDeal: ValueCase | null;
}

const AppContext = createContext<AppState>(initialState);

export const useApp = () => useContext(AppContext);
```

### Local State (Component)
```typescript
// Component-level state
const [deals, setDeals] = useState<ValueCase[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

### Server State (React Query - Planned)
```typescript
// Future implementation
const { data, isLoading, error } = useQuery({
  queryKey: ['value-cases'],
  queryFn: () => valueCaseService.list()
});
```

---

## Styling

### Tailwind Configuration (`tailwind.config.js`)

**Custom Colors:**
```javascript
colors: {
  primary: {
    50: '#f0f9ff',
    500: '#3b82f6',
    900: '#1e3a8a'
  },
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444'
}
```

**Custom Utilities:**
```css
/* src/styles/globals.css */
@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
}
```

### Component Styling Pattern
```typescript
// Use cn() utility for conditional classes
import { cn } from '@/lib/utils';

<div className={cn(
  "base-classes",
  isActive && "active-classes",
  variant === 'primary' && "primary-classes"
)}>
```

---

## Data Fetching

### Pattern: Fetch on Mount
```typescript
useEffect(() => {
  const fetchDeals = async () => {
    setLoading(true);
    try {
      const data = await valueCaseService.list();
      setDeals(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  fetchDeals();
}, []);
```

### Pattern: Optimistic Updates
```typescript
const handleUpdate = async (id: string, data: UpdateData) => {
  // Optimistic update
  setDeals(prev => prev.map(d => 
    d.id === id ? { ...d, ...data } : d
  ));
  
  try {
    await valueCaseService.update(id, data);
  } catch (err) {
    // Revert on error
    setDeals(prev => prev.map(d => 
      d.id === id ? originalDeal : d
    ));
    setError(err.message);
  }
};
```

---

## Error Handling

### Error Boundary
```typescript
// src/components/ErrorBoundary.tsx
class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught:', error, errorInfo);
    // Log to error tracking service
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
```

### API Error Handling
```typescript
try {
  const result = await api.invoke({ ... });
} catch (error) {
  if (error instanceof NetworkError) {
    toast.error('Network error. Please check your connection.');
  } else if (error instanceof AuthError) {
    toast.error('Authentication failed. Please log in again.');
  } else {
    toast.error('An unexpected error occurred.');
  }
}
```

---

## Performance Optimization

### Code Splitting
```typescript
// Lazy load routes
const ChatView = lazy(() => import('./views/ChatView'));
const SettingsView = lazy(() => import('./views/SettingsView'));

<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    <Route path="/chat" element={<ChatView />} />
    <Route path="/settings" element={<SettingsView />} />
  </Routes>
</Suspense>
```

### Memoization
```typescript
// Memoize expensive calculations
const sortedDeals = useMemo(() => {
  return deals.sort((a, b) => 
    new Date(b.created_at) - new Date(a.created_at)
  );
}, [deals]);

// Memoize callbacks
const handleDealSelect = useCallback((deal: ValueCase) => {
  setSelectedDeal(deal);
}, []);
```

### Virtual Scrolling
```typescript
// For large lists (planned)
import { useVirtualizer } from '@tanstack/react-virtual';

const virtualizer = useVirtualizer({
  count: deals.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 100
});
```

---

## Testing

### Component Tests
```typescript
// src/components/Deals/__tests__/DealSelector.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { DealSelector } from '../DealSelector';

describe('DealSelector', () => {
  it('renders deals list', () => {
    render(<DealSelector onDealSelected={jest.fn()} />);
    expect(screen.getByText('Select a Deal')).toBeInTheDocument();
  });
  
  it('calls onDealSelected when deal clicked', () => {
    const onSelect = jest.fn();
    render(<DealSelector onDealSelected={onSelect} />);
    
    fireEvent.click(screen.getByText('Acme Corp'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
      company_name: 'Acme Corp'
    }));
  });
});
```

---

## Common Patterns

### Loading States
```typescript
if (loading) {
  return <LoadingSpinner />;
}

if (error) {
  return <ErrorMessage message={error} />;
}

return <Content data={data} />;
```

### Form Handling
```typescript
const { register, handleSubmit, formState: { errors } } = useForm();

const onSubmit = async (data: FormData) => {
  try {
    await valueCaseService.create(data);
    toast.success('Deal created successfully');
  } catch (err) {
    toast.error('Failed to create deal');
  }
};

<form onSubmit={handleSubmit(onSubmit)}>
  <input {...register('company_name', { required: true })} />
  {errors.company_name && <span>Required</span>}
</form>
```

### Conditional Rendering
```typescript
{selectedDeal ? (
  <DealDetails deal={selectedDeal} />
) : (
  <DealSelector onDealSelected={setSelectedDeal} />
)}
```

---

## Troubleshooting

### Build Errors
```bash
# Clear cache
rm -rf node_modules/.vite

# Rebuild
npm run build
```

### Type Errors
```bash
# Regenerate types
npm run type-check
```

### Hot Reload Issues
```bash
# Restart dev server
npm run dev
```

---

**Last Updated:** 2026-01-06  
**Related:** `src/`, `vite.config.ts`, `tailwind.config.js`
