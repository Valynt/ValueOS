# ValueOS UX Redesign - Implementation Roadmap

## Overview

This roadmap implements the Principal Product Designer deliverable for the ValueOS UX Redesign. The implementation follows a sprint-based approach with clear deliverables and dependencies.

**Total Duration:** 8 Sprints (16 weeks)
**Sprint Length:** 2 weeks

---

## Sprint 0: Foundation & Design System (Week 1-2)

### Goals
- Establish design tokens and theme
- Set up component architecture
- Create base layout components

### Tasks

| ID | Task | Priority | Estimate | Dependencies |
|----|------|----------|----------|--------------|
| S0-1 | Create ValueOS design tokens (colors, typography, spacing) | P0 | 4h | - |
| S0-2 | Implement light theme CSS variables | P0 | 2h | S0-1 |
| S0-3 | Set up Tailwind config with design tokens | P0 | 2h | S0-1 |
| S0-4 | Create base Button component variants | P0 | 3h | S0-2 |
| S0-5 | Create base Input component variants | P0 | 3h | S0-2 |
| S0-6 | Create Card component with variants | P0 | 2h | S0-2 |
| S0-7 | Create Badge/Tag component | P1 | 1h | S0-2 |
| S0-8 | Create Avatar component | P1 | 1h | S0-2 |
| S0-9 | Create Dropdown/Select component | P0 | 3h | S0-2 |
| S0-10 | Create Modal/Dialog component | P0 | 3h | S0-2 |

**Design Tokens:**
```
Primary: #3B82F6 (Blue-500)
Success: #10B981 (Emerald-500)
Warning: #F59E0B (Amber-500)
Error: #EF4444 (Red-500)
Background: #FFFFFF
Surface: #F8FAFC (Slate-50)
Border: #E2E8F0 (Slate-200)
Text Primary: #0F172A (Slate-900)
Text Secondary: #64748B (Slate-500)
```

---

## Sprint 1: Shell & Navigation (Week 3-4)

### Goals
- Implement global navigation structure
- Create persistent shell components
- Set up routing architecture

### Tasks

| ID | Task | Priority | Estimate | Dependencies |
|----|------|----------|----------|--------------|
| S1-1 | Create Sidebar component with navigation items | P0 | 4h | S0 |
| S1-2 | Implement NavItem component with active states | P0 | 2h | S1-1 |
| S1-3 | Create Header component with search and actions | P0 | 4h | S0 |
| S1-4 | Implement TenantBadge component | P0 | 2h | S0 |
| S1-5 | Create TenantSwitcher dropdown | P0 | 3h | S0-9 |
| S1-6 | Implement UserMenu component | P0 | 2h | S0-9 |
| S1-7 | Create AppShell layout wrapper | P0 | 3h | S1-1, S1-3 |
| S1-8 | Set up route structure (Home, Cases, Library, Team, Settings) | P0 | 4h | S1-7 |
| S1-9 | Implement breadcrumb navigation | P1 | 2h | S1-8 |
| S1-10 | Add keyboard shortcuts (⌘K for search) | P1 | 2h | S1-3 |

**Wireframe Reference:** Wireframe B (Shell)

---

## Sprint 2: Home Page (Week 5-6)

### Goals
- Implement Home page with resume functionality
- Create quick action cards
- Build recent cases list

### Tasks

| ID | Task | Priority | Estimate | Dependencies |
|----|------|----------|----------|--------------|
| S2-1 | Create HomePage layout | P0 | 2h | S1-7 |
| S2-2 | Implement ContinueCard component (resume work) | P0 | 4h | S0-6 |
| S2-3 | Create QuickActionCard component | P0 | 3h | S0-6 |
| S2-4 | Build QuickActions grid (New Case, Upload, Templates) | P0 | 3h | S2-3 |
| S2-5 | Create RecentCasesList component | P0 | 4h | S0 |
| S2-6 | Implement CaseListItem with status badges | P0 | 2h | S0-7 |
| S2-7 | Add empty state for no recent cases | P1 | 1h | S2-5 |
| S2-8 | Implement "View all cases" link | P1 | 1h | S2-5 |
| S2-9 | Add loading skeletons for Home page | P1 | 2h | S2-1 |
| S2-10 | Connect to cases API (GET /api/cases/recent) | P0 | 3h | S2-5 |

**Wireframe Reference:** Wireframe A (Home)

---

## Sprint 3: Case Workspace - Layout & Conversation Panel (Week 7-8)

### Goals
- Implement split-pane workspace layout
- Build conversation panel with message rendering
- Create agent message components

### Tasks

| ID | Task | Priority | Estimate | Dependencies |
|----|------|----------|----------|--------------|
| S3-1 | Create CaseWorkspace split-pane layout (35%/65%) | P0 | 4h | S1-7 |
| S3-2 | Implement resizable pane divider | P1 | 3h | S3-1 |
| S3-3 | Create ConversationPanel container | P0 | 2h | S3-1 |
| S3-4 | Implement MessageBubble component (agent/user variants) | P0 | 4h | S0 |
| S3-5 | Create AgentMessage with reasoning disclosure | P0 | 3h | S3-4 |
| S3-6 | Implement UserMessage component | P0 | 2h | S3-4 |
| S3-7 | Create ClarifyCard with option buttons | P0 | 4h | S3-4 |
| S3-8 | Build MessageInput with send button | P0 | 3h | S0-5 |
| S3-9 | Implement typing indicator animation | P1 | 2h | S3-3 |
| S3-10 | Add auto-scroll to latest message | P1 | 1h | S3-3 |
| S3-11 | Create message timestamp formatting | P2 | 1h | S3-4 |

**Wireframe Reference:** Wireframe C (CaseWorkspace - Conversation Panel)

---

## Sprint 4: Case Workspace - Canvas Panel (Week 9-10)

### Goals
- Build canvas panel with mode selector
- Implement Plan Card and Assumptions Panel
- Create live preview area

### Tasks

| ID | Task | Priority | Estimate | Dependencies |
|----|------|----------|----------|--------------|
| S4-1 | Create CanvasPanel container | P0 | 2h | S3-1 |
| S4-2 | Implement ModeSelector (Builder/Presenter/Tracker) | P0 | 3h | S0-4 |
| S4-3 | Create PlanCard with workflow steps | P0 | 4h | S0-6 |
| S4-4 | Implement WorkflowStep component (completed/running/pending) | P0 | 3h | S4-3 |
| S4-5 | Add progress bar animation for running steps | P1 | 2h | S4-4 |
| S4-6 | Create AssumptionsPanel component | P0 | 4h | S0-6 |
| S4-7 | Implement AssumptionRow with inline editing | P0 | 4h | S4-6 |
| S4-8 | Add source verification badges (Verified/Estimated) | P0 | 2h | S4-7 |
| S4-9 | Create LivePreview container | P0 | 3h | S4-1 |
| S4-10 | Implement ROI chart with Recharts/ECharts | P0 | 4h | S4-9 |
| S4-11 | Create MetricCard component (Payback, NPV, etc.) | P0 | 2h | S4-9 |
| S4-12 | Add "Add Custom Driver" button | P1 | 1h | S4-6 |

**Wireframe Reference:** Wireframe C (CaseWorkspace - Canvas Panel)

---

## Sprint 5: Agent Orchestration & State Management (Week 11-12)

### Goals
- Implement agent state machine
- Build real-time updates via WebSocket
- Create snapshot-based undo/redo

### Tasks

| ID | Task | Priority | Estimate | Dependencies |
|----|------|----------|----------|--------------|
| S5-1 | Implement AgentStateMachine (Idle→Clarify→Plan→Execute→Review→Finalize) | P0 | 6h | - |
| S5-2 | Create useAgentState hook | P0 | 4h | S5-1 |
| S5-3 | Implement WebSocket connection for agent events | P0 | 4h | S5-2 |
| S5-4 | Create ThoughtEvent parser and handler | P0 | 3h | S5-3 |
| S5-5 | Build AgentStatusIndicator with state animations | P0 | 3h | S5-2 |
| S5-6 | Implement snapshot creation on state transitions | P0 | 4h | S5-1 |
| S5-7 | Create useCanvasState hook with undo/redo | P0 | 4h | S5-6 |
| S5-8 | Add optimistic updates for assumption changes | P1 | 3h | S5-7 |
| S5-9 | Implement auto-save with debouncing | P0 | 2h | S5-7 |
| S5-10 | Create session resume functionality | P0 | 4h | S5-6 |
| S5-11 | Add "Resume where you left off" banner | P1 | 2h | S5-10 |

**Wireframe Reference:** Interaction Model (Section 2.2)

---

## Sprint 6: Cases List & Library (Week 13-14)

### Goals
- Build Cases list page with filtering
- Implement Library with templates
- Create case creation flow

### Tasks

| ID | Task | Priority | Estimate | Dependencies |
|----|------|----------|----------|--------------|
| S6-1 | Create CasesListPage layout | P0 | 3h | S1-7 |
| S6-2 | Implement CaseCard component | P0 | 3h | S0-6 |
| S6-3 | Build filter bar (status, date, owner) | P0 | 4h | S0-9 |
| S6-4 | Add search functionality for cases | P0 | 3h | S6-1 |
| S6-5 | Implement sort options (recent, name, value) | P1 | 2h | S6-1 |
| S6-6 | Create NewCaseModal with company input | P0 | 4h | S0-10 |
| S6-7 | Build LibraryPage layout | P0 | 3h | S1-7 |
| S6-8 | Create TemplateCard component | P0 | 3h | S0-6 |
| S6-9 | Implement template categories | P1 | 2h | S6-7 |
| S6-10 | Add "Use template" flow | P0 | 3h | S6-8 |
| S6-11 | Create empty states for Cases and Library | P1 | 2h | S6-1, S6-7 |

**Wireframe Reference:** Wireframe D (CasesList), Wireframe E (Library)

---

## Sprint 7: Settings & Team Management (Week 15-16)

### Goals
- Implement Settings pages
- Build Team management with invitations
- Create Usage/Billing page

### Tasks

| ID | Task | Priority | Estimate | Dependencies |
|----|------|----------|----------|--------------|
| S7-1 | Create SettingsLayout with sidebar navigation | P0 | 3h | S1-7 |
| S7-2 | Implement GeneralSettings page | P0 | 3h | S7-1 |
| S7-3 | Build TeamSettings page with member list | P0 | 4h | S7-1 |
| S7-4 | Create MemberRow component with role dropdown | P0 | 3h | S7-3 |
| S7-5 | Implement InviteMemberModal | P0 | 4h | S0-10 |
| S7-6 | Add role change confirmation | P1 | 2h | S7-4 |
| S7-7 | Create BillingSettings page | P0 | 4h | S7-1 |
| S7-8 | Implement UsageChart component | P0 | 4h | S7-7 |
| S7-9 | Build usage progress bar with states (normal/warning/critical) | P0 | 2h | S7-7 |
| S7-10 | Create usage alert toggles | P1 | 2h | S7-7 |
| S7-11 | Implement IntegrationsSettings page | P1 | 4h | S7-1 |
| S7-12 | Create AuditLog page | P2 | 4h | S7-1 |

**Wireframe Reference:** Wireframe F (Team), Wireframe G (Billing)

---

## Sprint 8: Error Handling, Polish & QA (Week 17-18)

### Goals
- Implement error recovery patterns
- Add loading states and animations
- Final polish and accessibility audit

### Tasks

| ID | Task | Priority | Estimate | Dependencies |
|----|------|----------|----------|--------------|
| S8-1 | Create ErrorRecoveryCard component | P0 | 4h | S0-6 |
| S8-2 | Implement tool failure recovery (H1 pattern) | P0 | 3h | S8-1 |
| S8-3 | Add permission denied handling (H2 pattern) | P0 | 2h | S8-1 |
| S8-4 | Create validation error display (H3 pattern) | P0 | 2h | S8-1 |
| S8-5 | Implement session timeout recovery (H4 pattern) | P0 | 3h | S8-1 |
| S8-6 | Add loading skeletons to all pages | P1 | 4h | All |
| S8-7 | Implement toast notifications | P0 | 3h | S0 |
| S8-8 | Add keyboard navigation support | P1 | 4h | All |
| S8-9 | Conduct WCAG AA accessibility audit | P0 | 4h | All |
| S8-10 | Fix accessibility issues | P0 | 6h | S8-9 |
| S8-11 | Add reduced-motion support | P1 | 2h | All |
| S8-12 | Performance optimization (lazy loading, code splitting) | P1 | 4h | All |
| S8-13 | Final QA and bug fixes | P0 | 8h | All |

**Wireframe Reference:** Wireframe H (Error Recovery Patterns)

---

## Component Inventory

### Shell Components
- [ ] AppShell
- [ ] Sidebar
- [ ] NavItem
- [ ] Header
- [ ] TenantBadge
- [ ] TenantSwitcher
- [ ] UserMenu
- [ ] Breadcrumbs

### Base Components
- [ ] Button (primary, secondary, ghost, destructive)
- [ ] Input (text, search, textarea)
- [ ] Select/Dropdown
- [ ] Modal/Dialog
- [ ] Card
- [ ] Badge
- [ ] Avatar
- [ ] Tooltip
- [ ] Toast

### Workspace Components
- [ ] ConversationPanel
- [ ] MessageBubble
- [ ] AgentMessage
- [ ] UserMessage
- [ ] ClarifyCard
- [ ] MessageInput
- [ ] TypingIndicator
- [ ] CanvasPanel
- [ ] ModeSelector
- [ ] PlanCard
- [ ] WorkflowStep
- [ ] AssumptionsPanel
- [ ] AssumptionRow
- [ ] LivePreview
- [ ] ROIChart
- [ ] MetricCard

### Page Components
- [ ] HomePage
- [ ] ContinueCard
- [ ] QuickActionCard
- [ ] RecentCasesList
- [ ] CasesListPage
- [ ] CaseCard
- [ ] LibraryPage
- [ ] TemplateCard
- [ ] SettingsLayout
- [ ] TeamSettings
- [ ] BillingSettings
- [ ] UsageChart

### Error Components
- [ ] ErrorRecoveryCard
- [ ] ToolFailureRecovery
- [ ] PermissionDenied
- [ ] ValidationError
- [ ] SessionTimeout

---

## API Endpoints Required

### Cases
- `GET /api/cases` - List cases
- `GET /api/cases/recent` - Recent cases for home
- `GET /api/cases/:id` - Get case details
- `POST /api/cases` - Create case
- `PATCH /api/cases/:id` - Update case
- `DELETE /api/cases/:id` - Delete case

### Agent
- `POST /api/agent/query` - Submit query
- `WS /api/agent/stream` - WebSocket for events
- `GET /api/cases/:id/snapshots` - Get snapshots
- `POST /api/cases/:id/snapshots` - Create snapshot

### Organization
- `GET /api/organizations/:id/members` - List members
- `POST /api/organizations/:id/invitations` - Send invite
- `PATCH /api/organizations/:id/members/:userId` - Update role
- `GET /api/organizations/:id/usage` - Get usage
- `GET /api/organizations/:id/billing` - Get billing

### Library
- `GET /api/templates` - List templates
- `GET /api/templates/:id` - Get template
- `POST /api/cases/from-template/:id` - Create from template

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time-to-first-draft | < 15 minutes | Analytics |
| LCP (Largest Contentful Paint) | < 1.2s | Lighthouse |
| Interaction Readiness | < 200ms | Performance monitoring |
| WCAG Compliance | AA | Accessibility audit |
| Error Recovery Rate | > 90% | User completes recovery |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| WebSocket reliability | Implement reconnection with exponential backoff |
| Large case data | Implement pagination and virtualization |
| Agent latency | Show streaming responses, optimistic UI |
| Browser compatibility | Test on Chrome, Firefox, Safari, Edge |
| Mobile responsiveness | P2 - defer to post-launch sprint |

---

## Definition of Done

Each task is complete when:
1. Code is written and passes linting
2. Component has TypeScript types
3. Unit tests pass (where applicable)
4. Storybook story exists (for UI components)
5. Accessibility requirements met
6. Code reviewed and merged
7. Deployed to staging environment
