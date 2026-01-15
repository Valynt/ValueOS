# ValyntApp Migration Plan

## Completed Phases (1-16)
- [x] types/, lib/, app/config, services/http, components/ui, hooks/
- [x] Common Components, Auth Flow, Bootstrap, Settings, Billing
- [x] Feature Modules, Services (analytics, storage, api), Tests Setup

---

## Remaining Migration - Organized by Priority

### Priority 1: Core Infrastructure (Migrate First)
| ValueOS Folder | ValyntApp Target | Notes |
|----------------|------------------|-------|
| `src/contexts/` | `src/app/providers/` | Auth, Theme, Toast contexts (partial done) |
| `src/lib/permissions/` | `src/lib/permissions/` | RBAC system |
| `src/lib/auth/` | `src/lib/auth/` | Auth utilities, token management |
| `src/lib/validation/` | `src/lib/validation/` | Form validation, Zod schemas |
| `src/config/` | `src/app/config/` | Environment, feature flags (partial done) |

### Priority 2: UI Components (High Reuse)
| ValueOS Folder | ValyntApp Target | Notes |
|----------------|------------------|-------|
| `src/components/Common/` | `src/components/common/` | Partial done |
| `src/components/Form/` | `src/components/form/` | Form components |
| `src/components/Layout/` | `src/layouts/` | App layouts, sidebar |
| `src/components/Modals/` | `src/components/modals/` | Dialog components |
| `src/components/ui/` | `src/components/ui/` | shadcn components (partial done) |
| `src/components/EmptyState/` | `src/components/common/` | Already have EmptyState |
| `src/components/Feedback/` | `src/components/feedback/` | Toast, alerts, notifications |

### Priority 3: Feature Views (Pages)
| ValueOS Folder | ValyntApp Target | Notes |
|----------------|------------------|-------|
| `src/views/Auth/` | `src/pages/auth/` | Done |
| `src/views/Settings/` | `src/pages/settings/` | Done |
| `src/views/Admin/` | `src/pages/admin/` | Admin dashboard |
| `src/views/Customer/` | `src/pages/customers/` | Customer management |

### Priority 4: Business Logic Services
| ValueOS Folder | ValyntApp Target | Notes |
|----------------|------------------|-------|
| `src/services/billing/` | `src/services/billing/` | Stripe integration |
| `src/services/api/` | `src/services/api/` | Partial done |
| `src/services/cache/` | `src/services/cache/` | Caching utilities |
| `src/services/onboarding/` | `src/services/onboarding/` | User onboarding flow |

### Priority 5: Advanced Features (Defer)
| ValueOS Folder | ValyntApp Target | Notes |
|----------------|------------------|-------|
| `src/components/Agent/` | `src/features/agents/` | AI agent components |
| `src/components/Canvas/` | `src/features/canvas/` | Canvas editor |
| `src/components/ChatCanvas/` | `src/features/chat/` | Chat interface |
| `src/components/Workflow/` | `src/features/workflow/` | Workflow builder |
| `src/components/SDUI/` | `src/features/sdui/` | Server-driven UI |
| `src/lib/agent/` | `src/lib/agent/` | Agent runtime |
| `src/lib/llm/` | `src/lib/llm/` | LLM integrations |
| `src/lib/mcp/` | `src/lib/mcp/` | MCP protocol |

### Priority 6: Enterprise Features (Optional)
| ValueOS Folder | ValyntApp Target | Notes |
|----------------|------------------|-------|
| `src/components/Billing/` | `src/features/billing/` | Billing UI |
| `src/components/Team/` | `src/features/team/` | Team management |
| `src/components/Audit/` | `src/features/audit/` | Audit logs |
| `src/components/Compliance/` | `src/features/compliance/` | Compliance tools |
| `src/integrations/` | `src/integrations/` | Third-party integrations |
| `src/services/tenant/` | `src/services/tenant/` | Multi-tenancy |

### Skip / Not Needed
| ValueOS Folder | Reason |
|----------------|--------|
| `src/__tests__/` | Create fresh tests |
| `src/mocks/` | Create fresh mocks |
| `src/stories/` | Rebuild Storybook if needed |
| `src/test/` | Already set up |
| `src/test-utils/` | Already created `src/test/utils.tsx` |
| `src/components/dev/` | Dev-only components |
| `src/components/Debug/` | Debug tools |
| `src/components/examples/` | Example code |

---

## Recommended Next Steps

### Batch 1: Core UI (Est. 2-3 hours)
```
1. src/components/Form/ → src/components/form/
2. src/components/Layout/ → src/layouts/
3. src/components/Modals/ → src/components/modals/
4. src/contexts/ → src/app/providers/ (remaining)
```

### Batch 2: Business Logic (Est. 2-3 hours)
```
1. src/lib/permissions/ → src/lib/permissions/
2. src/lib/validation/ → src/lib/validation/
3. src/services/billing/ → src/services/billing/
4. src/services/onboarding/ → src/services/onboarding/
```

### Batch 3: Feature Pages (Est. 3-4 hours)
```
1. src/views/Admin/ → src/pages/admin/
2. src/views/Customer/ → src/pages/customers/
3. src/components/Team/ → src/features/team/
4. src/components/Onboarding/ → src/features/onboarding/
```

### Batch 4: Advanced Features (Est. 4-6 hours)
```
1. src/components/Agent/ → src/features/agents/
2. src/components/Canvas/ → src/features/canvas/
3. src/lib/agent/ → src/lib/agent/
4. src/lib/llm/ → src/lib/llm/
```

---

## Migration Guidelines

1. **Simplify on migration** - Remove unused code, simplify complex logic
2. **Update imports** - Use `@/` path aliases consistently
3. **Type safety** - Fix TypeScript errors during migration
4. **Test coverage** - Add tests for migrated code
5. **Dependencies** - Only add deps when actually needed

## Current ValyntApp Structure
```
ValyntApp/src/
├── app/           # App shell (providers, routes, config, bootstrap)
├── assets/        # Static assets
├── components/    # Reusable components (ui/, common/)
├── features/      # Feature modules (auth/, billing/, workspace/)
├── hooks/         # Custom hooks
├── layouts/       # Layout components
├── lib/           # Utilities (utils, env, logger, format)
├── pages/         # Route pages (auth/, settings/, billing/, marketing/)
├── services/      # API/external services (http/, api/, analytics/, storage/)
├── styles/        # Global styles
├── test/          # Test setup
└── types/         # TypeScript types
```
