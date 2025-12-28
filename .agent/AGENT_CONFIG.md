# Antigravity Agent Configuration for ValueOS

## Terminal Execution Policy

### Safe Commands (Auto-execute with `// turbo`)

These commands are safe for Antigravity to run without manual approval:

```
npm run lint
npm run lint:fix
npm run lint:all
npm run lint:css
npm run test
npm run test:unit
npm run test:integration
npx vitest run
npx tsc --noEmit
npm run build
npx supabase status
npm run dev
npm run storybook
```

### Requires Review (Always ask before executing)

These commands have side effects and need human approval:

```
npx supabase db reset
npx supabase migration new
npm run db:backup
npm run db:restore
bash scripts/deploy-*
git push
git commit
docker-compose up
npm install
npm update
rm -rf
```

### Deny List (Never execute automatically)

```
git push --force
rm -rf /
DROP DATABASE
DELETE FROM * (without WHERE)
TRUNCATE TABLE
```

## Review Policy Recommendations

| Context                               | Policy         | Reason               |
| ------------------------------------- | -------------- | -------------------- |
| Test files (`*.test.ts`, `*.spec.ts`) | Agent Decides  | Low risk             |
| Documentation (`docs/*`, `*.md`)      | Always Proceed | Minimal risk         |
| Source code (`src/*`)                 | Request Review | Core functionality   |
| Database (`supabase/migrations/*`)    | Request Review | Data integrity       |
| Security (`*security*`, `*auth*`)     | Request Review | Security critical    |
| Deployment (`scripts/deploy-*`)       | Request Review | Production impact    |
| Config files (`*.config.*`)           | Request Review | Build/runtime impact |

## Model Selection for ValueOS Tasks

| Task Type                    | Recommended Model      | Reason                   |
| ---------------------------- | ---------------------- | ------------------------ |
| Complex debugging            | Claude Sonnet 4.5      | Superior reasoning       |
| Multi-file refactoring       | Gemini 3 Pro           | Multi-agent coordination |
| TypeScript/React development | Gemini 3 Pro or Claude | Strong typing support    |
| Database migrations          | Claude Sonnet 4.5      | SQL precision            |
| Documentation                | GPT-based              | Fast, cost-effective     |
| Test generation              | Claude Sonnet 4.5      | Edge case coverage       |
| Browser automation           | Gemini 3 Pro           | Native browser tools     |
| Security analysis            | Claude Sonnet 4.5      | Thorough analysis        |

## Artifact Types to Generate

For ValueOS, configure Antigravity to generate these artifacts:

1. **Implementation Plans** - For features touching 3+ files
2. **Walkthroughs** - For complex existing code understanding
3. **Task Lists** - For multi-step implementations
4. **Migration Plans** - For database changes
5. **Test Plans** - For new feature coverage

## Context Files to Always Include

When starting a new task, these files provide essential context:

- `package.json` - Available scripts and dependencies
- `README.md` - Project overview
- `CONTRIBUTING.md` - Coding standards
- `openapi.yaml` - API contracts
- `.env.example` - Environment configuration

## Multi-Agent Orchestration Patterns

### Pattern 1: Full-Stack Feature

```
Agent 1: Backend API (services/)
Agent 2: Frontend UI (components/, pages/)
Agent 3: Tests (tests/)
Agent 4: Documentation (docs/)
```

### Pattern 2: Database-Heavy Task

```
Agent 1: Migration SQL (supabase/migrations/)
Agent 2: TypeScript types (src/types/)
Agent 3: Service layer (src/services/)
Agent 4: RLS validation (scripts/)
```

### Pattern 3: Security Hardening

```
Agent 1: Security scan analysis
Agent 2: Fix implementation
Agent 3: Security test writing
Agent 4: Documentation update
```
