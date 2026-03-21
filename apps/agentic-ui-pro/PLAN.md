# Agentic UI Pro — Phase 1 Plan

## 1. Product Framing

**What it is:** A structured intelligence engine and pattern library for agentic SaaS UI. It helps developers, product designers, and AI agents discover, understand, and generate high-quality UI patterns specifically for AI-native and agent-enabled SaaS products.

**Who it is for:**
- Frontend engineers building agentic SaaS products
- Product designers creating AI-native workflows
- AI agents generating UI scaffolding from prompts
- Design system architects at enterprise SaaS companies

**Key use cases:**
- Browse a taxonomy of agentic UI patterns by category, persona, density, or workflow
- Enter a natural-language prompt and receive recommended layouts, components, and shadcn code
- Export production-ready React + TypeScript + shadcn/ui page skeletons
- Validate designs against a quality/UX checklist

**Differentiation:** Unlike Dribbble or generic component galleries, this is a domain-specific intelligence layer for agentic SaaS — organized around workflows, personas, trust patterns, and AI-native interaction models.

---

## 2. Domain Model

| Entity | Description |
|---|---|
| Pattern | A named, categorized UI pattern with metadata, anatomy, and component mapping |
| Component | A shadcn/ui or custom component with usage notes |
| Layout | A page-level structural archetype (e.g., sidebar+main, split-pane) |
| Workflow | A multi-step job-to-be-done with ordered stages and pattern recommendations |
| PageTemplate | A full-page composition combining layout + sections + components |
| PromptIntent | Parsed representation of a user prompt (context, workflow, persona, density) |
| Persona | A SaaS user role (e.g., ops analyst, AI engineer, customer success manager) |
| SaaSUseCase | A product-level use case (e.g., agent run monitoring, QBR prep) |
| AgenticPrimitive | A low-level agentic UX building block (e.g., confidence badge, trace panel) |
| DataDensity | Classification of information density (low / medium / high / ultra-dense) |
| InteractionMode | How the user interacts (read-only, command-driven, conversational, approval-gated) |
| TrustPattern | A UI pattern for building user trust in AI outputs |
| EvidencePattern | A pattern for surfacing reasoning, provenance, or citations |
| Recommendation | Output of the recommendation engine: page type + layout + components + code |
| CodeTemplate | A React/shadcn code skeleton for a pattern or page |
| DesignTokenProfile | A token set for a specific SaaS aesthetic (enterprise, developer, consumer) |

---

## 3. Taxonomy

### SaaS Page Types
- Dashboard / Command Center
- Agent Workspace / Chat
- Approval / Review Queue
- Onboarding / Setup Wizard
- Settings / Permissions / Audit
- Analytics / KPI / ROI
- Orchestration / Observability
- Knowledge / Memory View
- Admin Console
- Workflow Builder
- Side Panel / Drawer
- Form / Wizard
- Table / Data Operations
- Explainability / Evidence View

### Component Categories
- Navigation (sidebar, topbar, breadcrumbs, command palette)
- Data Display (tables, cards, stats, charts, timelines)
- Forms & Inputs (text, select, multi-step, validation)
- Feedback (toasts, alerts, progress, loading, empty states)
- Agentic Primitives (confidence badge, trace panel, approval gate, agent status)
- Trust & Explainability (evidence card, reasoning trace, citation list, confidence meter)
- Governance (audit log, permission matrix, policy badge, role indicator)

### Agentic UX Categories
- Agent Status & Monitoring
- Human-in-the-Loop (HITL) Review
- Reasoning / Explanation Surfaces
- Multi-Agent Orchestration
- Memory / Knowledge Retrieval
- Tool Invocation / Run History
- Model Routing / Provider Selection
- Confidence & Uncertainty Display

### Layout Archetypes
- Full-width dashboard (topbar + main content)
- Sidebar + main (persistent nav)
- Split-pane (list + detail)
- Command center (dark, dense, real-time)
- Wizard / stepper (linear flow)
- Side panel overlay (drawer pattern)
- Three-column (nav + content + context)

---

## 4. Information Architecture

```
/ (Landing Page)
/browse (Pattern Library — grid/list browse)
/browse/:category (Filtered by category)
/pattern/:id (Pattern Detail Page)
/workflows (Workflow Library)
/workflow/:id (Workflow Detail Page)
/prompt-lab (Prompt Lab — input + results)
/prompt-lab/result (Recommendation Result + Code Output)
/favorites (Saved Patterns)
```

---

## 5. Search & Recommendation Model

1. Parse prompt → extract: product context, workflow type, persona, page intent, density, trust needs
2. Score patterns by keyword overlap + tag matching
3. Select top page archetype + layout archetype
4. Bundle recommended components + sections
5. Apply trust/governance overlays if detected
6. Generate shadcn code skeleton from matched CodeTemplate

---

## 6. Feature Specification

### MVP
- Searchable pattern database (keyword + tag)
- Filterable browsing (category, persona, density, interaction model)
- Pattern detail pages
- Workflow pattern pages
- Prompt Lab with rule-based recommendation engine
- Prompt-to-layout blueprint
- Prompt-to-component checklist
- Prompt-to-shadcn page skeleton (code generation)
- Quality/UX checklist per recommendation

### Stretch
- Favorites / saved patterns
- Dark/light theme toggle
- Copy-to-clipboard for code
- Shareable prompt result URLs

---

## 7. Data Strategy

- MVP: TypeScript data modules (`/src/data/patterns.ts`, `workflows.ts`, `personas.ts`)
- All data typed with shared interfaces in `/src/types/index.ts`
- Migration path: export to JSON → load into Supabase/Postgres later

---

## 8. UX Strategy

- Dark mode default (enterprise SaaS aesthetic)
- Dense but readable — 14px body, 12px metadata
- Strong typographic hierarchy
- Sidebar navigation for app shell
- Excellent empty, loading, and error states throughout
- Explainable recommendations with rationale text

---

## 9. Code Architecture

```
client/src/
  types/           ← Domain model interfaces
  data/            ← Seed data (patterns, workflows, personas)
  lib/
    search.ts      ← Keyword + tag search engine
    recommend.ts   ← Rule-based recommendation engine
    codegen.ts     ← Code template generator
    utils.ts       ← Shared utilities
  components/
    ui/            ← shadcn/ui primitives
    layout/        ← AppShell, Sidebar, Topbar
    patterns/      ← PatternCard, PatternGrid, PatternDetail
    workflows/     ← WorkflowCard, WorkflowDetail
    prompt/        ← PromptInput, RecommendationResult, CodeOutput
    shared/        ← QualityChecklist, TagBadge, DensityBadge, etc.
  pages/
    Home.tsx       ← Landing page
    Browse.tsx     ← Pattern library browser
    PatternDetail.tsx
    Workflows.tsx
    WorkflowDetail.tsx
    PromptLab.tsx
    PromptResult.tsx
    Favorites.tsx
  App.tsx
  index.css
```

---

## 10. Delivery Roadmap

| Milestone | Scope |
|---|---|
| M1 | Types, seed data, recommendation engine |
| M2 | App shell, routing, sidebar navigation |
| M3 | Landing page |
| M4 | Browse/search page + filters |
| M5 | Pattern detail + workflow detail pages |
| M6 | Prompt Lab + recommendation results + code output |
| M7 | Polish, quality checklist, dark mode, empty/error states |

---

## 11. Risks & Design Decisions

| Risk | Decision |
|---|---|
| Code generation quality | Use realistic, well-structured templates; not toy snippets |
| Data volume | Start with ~30 patterns, ~10 workflows — enough to feel real |
| Recommendation accuracy | Rule-based keyword matching is sufficient for MVP |
| Performance | All data in-memory; no API calls needed |
| Routing | Wouter (already in template) — sufficient for this SPA |
