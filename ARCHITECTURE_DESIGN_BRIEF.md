# Architecture & Design Brief for ValueOS

This brief follows the PRD framework and ValueOS-specific conventions, synthesizing architectural, workflow, and security patterns from the codebase and documentation.

---

## 1. PROJECT VISION

| Field                     | Details                                                                                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project Name              | ValueOS                                                                                                                                                               |
| One-line description      | A multi-tenant platform for value modeling, lifecycle intelligence, and secure agent orchestration                                                                    |
| Target users              | Enterprise teams, analysts, and engineers managing complex value streams and workflows                                                                                |
| Core problem being solved | Fragmented value management, lack of secure, auditable AI agent workflows, and poor cross-team visibility                                                             |
| Success metrics           | - 99.99% tenant data isolation<br>- <5 min onboarding to first value model<br>- 90%+ test coverage on agent code<br>- <1hr mean time to recovery (MTTR) for incidents |

---

## 2. TECHNICAL DECISIONS

### Frontend

| Component     | Choice                                                       | Rationale                         |
| ------------- | ------------------------------------------------------------ | --------------------------------- |
| Framework     | React (Vite)                                                 | Fast HMR, modular SDUI, SSR-ready |
| SDUI          | Server-Driven UI (src/sdui/)                                 | Dynamic, AI-driven UI composition |
| Key Libraries | `@tanstack/react-query`, `zod`, `tailwindcss`, `supabase-js` |

### Backend

| Component | Choice                     | Rationale                            |
| --------- | -------------------------- | ------------------------------------ |
| Framework | Node.js (TypeScript)       | Type safety, async workflows         |
| Database  | Supabase/PostgreSQL        | RLS, multi-tenancy, vector memory    |
| Messaging | CloudEvents via MessageBus | Async, traceable agent communication |

### Infrastructure

| Component     | Choice                 | Rationale                             |
| ------------- | ---------------------- | ------------------------------------- |
| Orchestration | Docker Compose + Caddy | Local HTTPS, reproducible dev         |
| CI/CD         | GitHub Actions         | Deterministic builds, security checks |

---

## 3. CORE FEATURES

| #   | Feature                            | Description                                                                                                                                          | Acceptance Criteria                                                                                                          |
| --- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | Multi-Agent Workflows              | Specialized agents (Opportunity, Target, FinancialModeling, Realization, Expansion, Benchmark) collaborate to analyze, model, and track value cases. | Each agent extends `BaseAgent`, uses `secureInvoke()`, and logs all actions. Workflows are DAGs, acyclic, and auditable.     |
| 2   | Vector Memory System               | Agents share and persist context using tenant-scoped vector memory (ContextFabric).                                                                  | All memory queries and storage include `tenant_id`. No cross-tenant access. Memory ops audited.                              |
| 3   | Value Case Lifecycle               | Value cases progress through discovery, modeling, realization, and expansion, tracked in `value_cases` table.                                        | Each stage triggers agent actions and updates. Status and lifecycle fields updated atomically.                               |
| 4   | Opportunity & Value Driver Mapping | Opportunities and value drivers are linked to value cases, quantified, and prioritized.                                                              | Opportunities and value drivers reference correct value_case and tenant. Quantification and prioritization fields populated. |
| 5   | Financial Modeling                 | FinancialModelingAgent computes ROI, NPV, IRR, payback, and scenario analysis for each value case.                                                   | Financial models reference value_case and tenant. All outputs (roi, npv, irr, payback, scenarios) present.                   |
| 6   | SDUI (Server-Driven UI)            | Dynamic UI composition for cases, library, and workspace, with AI-generated content and artifact display.                                            | All UI components registered in `ui-registry.json` and `registry.tsx`. AI content visually distinct.                         |
| 7   | RLS & Tenant Isolation             | Row Level Security enforced on all core tables (tenants, users, value_cases, opportunities, value_drivers, financial_models).                        | All queries filtered by `tenant_id`. RLS policies tested and verified.                                                       |
| 8   | Secure Auth & MFA                  | Supabase Auth with email/password, OAuth, and TOTP MFA.                                                                                              | All auth flows tested. MFA setup and verification available. PKCE and state parameter enabled for OAuth.                     |
| 9   | Role-Based Access Control          | Roles (admin, manager, user, viewer) enforced at API and UI layers.                                                                                  | Role checks present in backend and frontend. RLS policies restrict data by role.                                             |
| 10  | Audit Logging & Circuit Breaker    | All agent and user actions logged. Circuit breaker prevents cascading failures in agent calls.                                                       | Audit logs available for all critical actions. Circuit breaker status observable.                                            |
| 11  | Secure Token & Session Management  | Tokens encrypted at rest, rotated automatically, and stored in httpOnly cookies.                                                                     | SecureTokenManager used for all token ops. 100% test coverage on token logic.                                                |
| 12  | Industry Benchmarks                | BenchmarkAgent provides comparative KPI data for value cases.                                                                                        | Benchmarks reference correct KPI, industry, and company size. Data sourced and updated regularly.                            |
| 13  | Real-Time Collaboration            | Case workspace supports real-time updates and artifact generation.                                                                                   | Changes reflected live for all users in tenant.                                                                              |
| 14  | Library & Template Hub             | Centralized library for templates, value drivers, and playbooks.                                                                                     | Assets reusable across cases. Library stats and search functional.                                                           |

---

## 4. ARCHITECTURE REQUIREMENTS

### Architecture Pattern

| Aspect        | Decision                           | Justification                                            |
| ------------- | ---------------------------------- | -------------------------------------------------------- |
| Pattern       | Modular monorepo (pnpm workspaces) | Clear boundaries, scalable, shared code                  |
| Agent Pattern | BaseAgent + secureInvoke           | Circuit breaker, hallucination detection, Zod validation |
| Workflow      | DAGs with compensation (Saga)      | Reliable, auditable state transitions                    |

### Data Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │────▶│  Supabase    │
└──────────────┘     └──────┬───────┘     └──────┬───────┘
                            │                  │
                    ┌───────▼───────┐   ┌──────▼───────┐
                    │  MessageBus   │   │ VectorMemory │
                    └───────────────┘   └──────────────┘
```

---

## 5. INTEGRATIONS

| Service        | Purpose                        |
| -------------- | ------------------------------ |
| Supabase       | Auth, RLS, database, storage   |
| Caddy          | Local HTTPS reverse proxy      |
| GitHub Actions | CI/CD, security checks         |
| Codemap        | Dependency graph, blast radius |

---

## 6. PERFORMANCE REQUIREMENTS

| Metric             | Target         |
| ------------------ | -------------- |
| Full stack startup | <2 min         |
| Agent response     | <2s (P95)      |
| Workflow execution | <5s end-to-end |
| RLS test suite     | <1m            |

---

## 7. SECURITY REQUIREMENTS

| Requirement   | Implementation                                        |
| ------------- | ----------------------------------------------------- |
| Multi-tenancy | All queries filtered by `organization_id`/`tenant_id` |
| Agent calls   | Only via `secureInvoke()` with Zod validation         |
| Memory ops    | Must include tenant metadata                          |
| Secrets       | Never committed; use env templates                    |
| Logging       | Structured, no PII                                    |

---

## 8. DEVELOPMENT CONSTRAINTS

| Constraint      | Value                                     |
| --------------- | ----------------------------------------- |
| Team size       | 2-5 core contributors                     |
| Timeline        | Continuous delivery, weekly releases      |
| Budget          | Open source, infra via Docker/local       |
| Browser support | Chrome, Firefox, Safari (last 2 versions) |

---

## 9. QUALITY REQUIREMENTS

| Type           | Target                                  |
| -------------- | --------------------------------------- |
| Test coverage  | 90%+ for agent code                     |
| E2E scenarios  | Workflow execution, RLS, agent security |
| Lint/typecheck | All PRs must pass                       |
| Monitoring     | Structured logs, error tracking via CI  |

---

## 10. SPECIAL CONSIDERATIONS

| Consideration  | Details                                                      |
| -------------- | ------------------------------------------------------------ |
| Legacy code    | All new agents in `src/lib/agent-fabric/agents/`             |
| AI/SDUI rules  | Canonical: `.windsurf/rules/*.md`, `config/ui-registry.json` |
| Prompt design  | Handlebars templates only, no string concat                  |
| Memory sharing | Only via MessageBus or SharedArtifacts table                 |

---

## 11. ORCHESTRATION HINTS

| Hint            | Recommendation                                                              |
| --------------- | --------------------------------------------------------------------------- |
| Setup           | `pnpm run setup`, then `pnpm run dx`                                        |
| Test            | `pnpm run test`, `pnpm run test:rls`, `bash scripts/test-agent-security.sh` |
| Validate        | Check `.windsurf/rules/` for AI/SDUI conventions                            |
| Critical review | After agent workflow, after RLS test, before release                        |

---

_This brief is structured per the ValueOS PRD and architecture patterns, referencing live code and documentation for actionable, project-specific guidance._
