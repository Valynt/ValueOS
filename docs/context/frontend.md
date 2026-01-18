# Frontend Context

## Overview
ValueOS frontend is built with React 18.3, TypeScript, and Vite. The application follows a modern SaaS architecture with a dark sidebar navigation, horizontal tabs for settings, and a conversational AI workspace for building value cases.

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
- **Zustand:** Global state (agent store)
- **React Context:** Auth/tenant context
- **Local Storage:** Persistence

### Forms & Validation
- **React Hook Form:** Form management
- **Zod:** Schema validation

---

## Project Structure

```
apps/ValyntApp/src/
├── app/                    # App configuration
│   ├── routes/            # Route definitions
│   ├── providers/         # Context providers
│   └── config/            # App configuration
├── components/            # React components
│   ├── ui/               # Base UI components (Button, Card, Input, etc.)
│   ├── layout/           # Layout components (AppShell)
│   ├── marketing/        # Marketing site components
│   ├── settings/         # Settings components (SettingsRow, InviteModal)
│   └── valueDrivers/     # Value driver components
├── features/             # Feature modules
│   ├── onboarding/       # Onboarding wizard
│   └── workspace/        # Case workspace (agents, artifacts)
├── pages/                # Page components
│   ├── valueos/          # Main app pages
│   ├── settings/         # Settings pages
│   ├── marketing/        # Marketing pages
│   ├── auth/             # Auth pages
│   └── admin/            # Admin pages
├── services/             # API clients
├── hooks/                # Custom React hooks
├── types/                # TypeScript types
├── lib/                  # Utilities
└── styles/               # Global styles & theme
```

---

## Application Layout

### AppShell (`components/layout/AppShell.tsx`)
Main application layout with dark sidebar navigation.

```
┌──────────────────────────────────────────────────────────────┐
│ ┌──────────┐ ┌─────────────────────────────────────────────┐ │
│ │          │ │ Breadcrumb: Platform / Cases                │ │
│ │  SIDEBAR │ ├─────────────────────────────────────────────┤ │
│ │          │ │                                             │ │
│ │ Platform │ │                                             │ │
│ │ • Home   │ │              PAGE CONTENT                   │ │
│ │ • Cases  │ │                                             │ │
│ │ • Library│ │                                             │ │
│ │   └ Temp │ │                                             │ │
│ │   └ Driv │ │                                             │ │
│ │          │ │                                             │ │
│ │ Org      │ │                                             │ │
│ │ • Team   │ │                                             │ │
│ │ • Billing│ │                                             │ │
│ │ • Setting│ │                                             │ │
│ │          │ │                                             │ │
│ │ ──────── │ │                                             │ │
│ │ [Avatar] │ │                                             │ │
│ │ Sarah K. │ │                                             │ │
│ └──────────┘ └─────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**Navigation Sections:**
- **Platform:** Home, Cases, Library (with submenu: Templates, Value Drivers)
- **Organization:** Team, Billing, Settings
- **User Menu:** Links to profile settings

### SettingsLayout (`pages/settings/SettingsLayout.tsx`)
Horizontal tabs navigation for settings pages.

```
┌─────────────────────────────────────────────────────────────┐
│ Settings                                                     │
│ ─────────────────────────────────────────────────────────── │
│ [My profile] [Security] [Billing] [Notifications] [Team]... │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                    SETTINGS CONTENT                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Pages

### Cases (`pages/valueos/CasesPage.tsx`)
List view of all value cases with filtering and sorting.

**Features:**
- Grid/List view toggle
- Search by name/company
- Filter by status (Draft, In Progress, Committed, Closed)
- Sort by updated, created, name, value
- Summary stats (total cases, in progress, total value)

### Case Workspace (`pages/valueos/CaseWorkspace.tsx`)
Split-pane workspace for building value cases with AI assistance.

```
┌─────────────────────────────────────────────────────────────┐
│ ← Cases / Acme Corp Value Case          [Value Drivers] ... │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌─────────────────────────────────────┐ │
│ │                 │ │                                     │ │
│ │  CONVERSATION   │ │           CANVAS                    │ │
│ │                 │ │                                     │ │
│ │  Agent messages │ │  KPI Cards                          │ │
│ │  User input     │ │  Artifact display                   │ │
│ │  Progress       │ │  (Tables, Charts, Models)           │ │
│ │                 │ │                                     │ │
│ │  [Input field]  │ │                                     │ │
│ └─────────────────┘ └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- Conversational AI interface
- Real-time artifact generation
- Value Driver panel (toggle from header)
- KPI cards display
- Export to PDF
- Share modal

### Library Hub (`pages/valueos/LibraryPage.tsx`)
Central hub for reusable assets.

**Sections:**
- Case Templates - Pre-built value case structures
- Value Drivers - Strategic value propositions with formulas
- Brand Assets - Link to branding settings
- Playbooks - Coming soon

### Value Driver Library (`pages/valueos/ValueDriverLibrary.tsx`)
Admin command center for managing value drivers.

**Features:**
- Stats dashboard (total, published, usage, win rate)
- Search and filter (by type, status)
- Driver table with edit/archive actions
- AI suggestions button
- Full editor modal

### Settings Pages

| Page | Path | Purpose |
|------|------|---------|
| Profile | `/app/settings/profile` | Edit-in-place user profile |
| Security | `/app/settings/security` | Password, 2FA, sessions |
| Billing | `/app/settings/billing` | Meta-ROI dashboard, usage, invoices |
| Notifications | `/app/settings/notifications` | Email, push, Slack preferences |
| Team | `/app/settings/team` | Member management, invites |
| Branding | `/app/settings/branding` | Logo, colors, fonts, boilerplate |
| Integrations | `/app/settings/integrations` | CRM, communication, storage |

---

## Component Library

### Base UI Components (`components/ui/`)

| Component | Description |
|-----------|-------------|
| `button.tsx` | Button with variants (default, outline, ghost, destructive) |
| `card.tsx` | Card container with header, content, footer |
| `input.tsx` | Text input, SearchInput, Textarea |
| `select.tsx` | SimpleSelect dropdown |
| `badge.tsx` | Status badges |
| `progress.tsx` | Progress bars |
| `dialog.tsx` | Modal dialogs |
| `avatar.tsx` | UserAvatar with initials |
| `label.tsx` | Form labels |

**Usage:**
```typescript
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SearchInput } from '@/components/ui/input';

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>
    <SearchInput placeholder="Search..." />
    <Button variant="primary">Submit</Button>
  </CardContent>
</Card>
```

### Settings Components (`components/settings/`)

| Component | Description |
|-----------|-------------|
| `SettingsRow` | Edit-in-place row with label, value, edit button |
| `SettingsToggleRow` | Row with toggle switch |
| `SettingsSection` | Titled card container |
| `SettingsAlert` | Contextual alert (warning, info, success, error) |
| `InviteModal` | Team member invitation modal |

### Value Driver Components (`components/valueDrivers/`)

| Component | Description |
|-----------|-------------|
| `ValueDriverEditor` | Full editor modal for creating/editing drivers |
| `ValueDriverSelector` | Seller-facing selector for case builder |

---

## Types

### Value Driver (`types/valueDriver.ts`)

```typescript
interface ValueDriver {
  id: string;
  name: string;
  description: string;
  type: "cost-savings" | "revenue-lift" | "productivity-gain" | "risk-mitigation";
  personaTags: PersonaTag[];
  salesMotionTags: SalesMotionTag[];
  formula: ValueDriverFormula;
  narrativePitch: string;
  status: "draft" | "published" | "archived";
  usageCount: number;
  winRateCorrelation?: number;
}

interface ValueDriverFormula {
  expression: string;
  variables: FormulaVariable[];
  resultUnit: "currency" | "percentage" | "hours" | "count";
}
```

---

## Routing

### Route Structure (`app/routes/index.tsx`)

```
/                           → Landing page (MarketingLayout)
/login                      → Login page
/signup                     → Signup page
/setup                      → Onboarding wizard

/app                        → Home (AppShell)
/app/cases                  → Cases list
/app/cases/new              → New case workspace
/app/cases/:id              → Case workspace
/app/library                → Library hub
/app/library/templates      → Templates list
/app/library/drivers        → Value drivers admin
/app/team                   → Team page
/app/billing                → Billing page
/app/settings/*             → Settings (nested routes)

/settings/*                 → Standalone settings (without AppShell)
```

---

## Styling

### Theme (`styles/valueos-theme.css`)

**CSS Variables:**
```css
:root {
  /* Primary - Blue */
  --primary: 217 91% 60%;
  --primary-foreground: 0 0% 100%;
  
  /* Semantic */
  --background: 0 0% 100%;
  --foreground: 222 47% 11%;
  --muted: 210 40% 96%;
  --muted-foreground: 215 19% 35%;
  
  /* Sidebar */
  --sidebar-background: 222 47% 11%;
  --sidebar-foreground: 210 40% 98%;
  
  /* Marketing */
  --bg-dark: #0B0C0F;
  --accent-green: #18C3A5;
}
```

**Utility Classes:**
- `.bg-grid` - Subtle dot grid pattern for marketing pages
- `.scrollbar-thin` - Thin scrollbar styling
- `.animate-in` / `.animate-out` - Entry/exit animations

### Component Styling Pattern
```typescript
import { cn } from '@/lib/utils';

<div className={cn(
  "base-classes",
  isActive && "active-classes",
  variant === 'primary' && "primary-classes"
)}>
```

---

## State Management

### Agent Store (`features/workspace/agent/store.ts`)
Zustand store for case workspace state.

```typescript
interface AgentState {
  phase: AgentPhase;
  messages: ConversationMessage[];
  artifacts: Artifact[];
  isStreaming: boolean;
  // ... actions
}

const useAgentStore = create<AgentState>((set, get) => ({
  // state and actions
}));
```

### Selectors
```typescript
import { useAgentStore, selectActiveArtifact } from '@/features/workspace/agent/store';

const activeArtifact = useAgentStore(selectActiveArtifact);
```

---

## Performance

### Code Splitting
- All pages lazy-loaded with `React.lazy()`
- Manual chunks in Vite config for vendor libraries
- Separate chunks for Radix UI, Zustand, Supabase

### Build Output
```
vendor.js        ~410 KB (React, React DOM)
vendorRouter.js  ~13 KB (React Router)
vendorUI.js      ~21 KB (Lucide React)
index.js         ~95 KB (App shell, routing)
CaseWorkspace.js ~272 KB (Workspace features)
```

---

## Accessibility

- ARIA labels on icon-only buttons
- `aria-pressed` for toggle buttons
- `aria-hidden="true"` on decorative icons
- Proper heading hierarchy (h1 → h2)
- Color contrast ratio ≥ 4.5:1 for text

---

## Key Files

| File | Purpose |
|------|---------|
| `app/routes/index.tsx` | Route definitions |
| `components/layout/AppShell.tsx` | Main app layout |
| `pages/settings/SettingsLayout.tsx` | Settings layout |
| `styles/valueos-theme.css` | Theme variables |
| `styles/globals.css` | Global styles |
| `vite.config.ts` | Build configuration |

---

**Last Updated:** 2026-01-16
**Related:** `apps/ValyntApp/src/`, `vite.config.ts`, `tailwind.config.js`
