# TypeScript Zero Swarm - Quick Start Guide

## Overview

The TypeScript Zero Swarm uses KimiK2.5 agents to systematically eliminate the 7,597 TypeScript errors across the ValueOS monorepo.

## Current State

- **Baseline:** 7,597 TS errors
- **Target:** <100 errors (Week 4)
- **Strategy:** Parallel agent execution with dependency resolution
- **Agent Roles:** 6 specialist types handling different error categories

## Prerequisites

```bash
# Ensure pnpm is installed and dependencies are up to date
pnpm install

# Verify the swarm infrastructure is in place
ls -la .windsurf/swarm/
ls -la .windsurf/skills/ts-*/
```

## Phase 1: Error Analysis (5 minutes)

### 1.1 Generate Hotspots Report

```bash
pnpm run swarm:hotspots
```

This creates `.windsurf/swarm/hotspots-report.json` with:
- Error distribution by package
- Top 50 file hotspots
- Auto-fixable error categorization
- Effort estimates

### 1.2 Review the Report

```bash
# View summary
cat .windsurf/swarm/hotspots-report.json | jq '.summary'

# View critical files
cat .windsurf/swarm/hotspots-report.json | jq '.fileHotspots[:10]'

# View recommendations
cat .windsurf/swarm/hotspots-report.json | jq '.recommendations'
```

## Phase 2: Partition Errors (5 minutes)

### 2.1 Run Partitioning

```bash
pnpm run swarm:partition
```

This creates agent work batches in `.windsurf/swarm/batches/`:
- `manifest.json` - Master list of all batches
- `batch-*.json` - Individual batch files
- Dependency tracking between batches

### 2.2 Verify Partitioning

```bash
# View batch manifest
cat .windsurf/swarm/batches/manifest.json | jq '.summary'

# List all batches
ls .windsurf/swarm/batches/*.json | wc -l

# View a specific batch
cat .windsurf/swarm/batches/valueos-backend-ts-null-safety-1.json | jq '{id, agentRole, errorCount, files}'
```

## Phase 3: Start Orchestrator Dashboard

### 3.1 Launch Dashboard

```bash
# Single update
pnpm run swarm:dashboard update

# Continuous monitoring (60 second refresh)
pnpm run swarm:dashboard watch

# Custom refresh interval
pnpm run swarm:dashboard watch 30
```

### 3.2 Dashboard Features

The dashboard shows:
- Real-time error count
- Progress percentage
- Errors by package
- Velocity (errors/hour)
- ETA for completion
- Batch status (completed/in-progress/remaining)

## Phase 4: Execute Batches

### 4.1 Sequential Execution

Process batches one at a time (safest for testing):

```bash
# Execute first 10 batches sequentially
pnpm run swarm:parallel sequential 10

# Execute all remaining batches
pnpm run swarm:parallel sequential
```

### 4.2 Parallel Execution

Process multiple batches concurrently:

```bash
# Run with default 4 concurrent agents
pnpm run swarm:parallel parallel

# Run with custom concurrency
pnpm run swarm:parallel parallel 8

# Run with maximum concurrency (use with caution)
pnpm run swarm:parallel parallel 12
```

### 4.3 Execute Single Batch

For testing or targeted fixes:

```bash
# List available batches
node scripts/swarm/execute-batch.mjs --list

# Execute specific batch
pnpm run swarm:execute valueos-backend-ts-null-safety-1
```

## Phase 5: Monitor and Verify

### 5.1 Check Progress

```bash
# Dashboard status
pnpm run swarm:dashboard update

# Raw error count
pnpm run typecheck:full 2>&1 | grep -c "error TS"

# Package breakdown
pnpm --filter @valueos/backend exec tsc --noEmit 2>&1 | grep -c "error TS"
pnpm --filter valynt-app exec tsc --noEmit 2>&1 | grep -c "error TS"
```

### 5.2 Run Quality Gates

After each batch of changes:

```bash
# Type check
pnpm run typecheck:full

# Unit tests for affected packages
pnpm run test

# RLS tenant isolation tests
pnpm run test:rls

# Lint check
pnpm run lint
```

### 5.3 Reset State (if needed)

```bash
# Reset execution state (keeps backup)
pnpm run swarm:parallel reset

# Reset dashboard
node scripts/swarm/orchestrator-dashboard.mjs reset
```

## Agent Role Reference

| Role | Error Codes | Auto-Fixable | Avg Effort | Skill File |
|------|-------------|--------------|------------|------------|
| ts-inference | TS7006, TS7019, TS7023 | ✅ Yes | 2 min | `.windsurf/skills/ts-type-inference/SKILL.md` |
| ts-null-safety | TS18047, TS18048, TS2532 | ✅ Yes | 1 min | `.windsurf/skills/ts-null-safety/SKILL.md` |
| ts-property | TS2339 | ❌ No | 5 min | `.windsurf/skills/ts-property-definition/SKILL.md` |
| ts-compatibility | TS2322, TS2345, TS2769 | ❌ No | 8 min | `.windsurf/skills/ts-compatibility/SKILL.md` |
| ts-supabase | Supabase-specific | ❌ No | 4 min | `.windsurf/skills/ts-supabase-types/SKILL.md` |
| ts-agent-fabric | Agent system | ❌ No | 6 min | `.windsurf/skills/ts-agent-fabric/SKILL.md` |

## Execution Strategy

### Week 1: High-Volume Auto-Fixable

Target 2,800+ auto-fixable errors:

```bash
# Run null-safety agents first (highest volume)
pnpm run swarm:execute valueos-backend-ts-null-safety-1
pnpm run swarm:execute valueos-backend-ts-null-safety-2
# ... continue for all null-safety batches

# Then run type-inference agents
pnpm run swarm:execute valueos-backend-ts-inference-1
# ... continue for all inference batches
```

### Week 2: Dependency Chains

Process in order: shared → backend → frontend

```bash
# Must complete first
pnpm run swarm:execute valueos-shared-ts-property-1

# Then backend services
pnpm run swarm:parallel parallel 4
```

### Week 3: Complex Cross-Cutting

Agent Fabric and integration points:

```bash
# Lower concurrency for complex coordination
pnpm run swarm:parallel parallel 2
```

### Week 4: Final Sweep

```bash
# Generate final hotspots report
pnpm run swarm:hotspots

# Target remaining errors
pnpm run swarm:parallel sequential

# Verify target met
pnpm run typecheck:full 2>&1 | grep -c "error TS"  # Should be <100
```

## CI Integration

The swarm includes automatic CI ratchet gates:

```yaml
# .github/workflows/ts-error-ratchet.yml
# Fails PR if TS errors increase from baseline
```

Manually verify before merge:

```bash
# Check against baseline
pnpm run typecheck:full 2>&1 | grep -c "error TS"
cat .quality/baselines.json | jq '.tsErrors'

# Update baseline when target met
# (Update .quality/baselines.json tsErrors field)
```

## Troubleshooting

### Issue: Batch execution fails

```bash
# Check batch exists
ls .windsurf/swarm/batches/your-batch-id.json

# Check dependencies
jq '.dependencies' .windsurf/swarm/batches/your-batch-id.json

# Verify dependencies completed
ls .windsurf/swarm/batches/dependency-id.complete
```

### Issue: Type errors increase

```bash
# Reset and re-partition
rm -rf .windsurf/swarm/batches/*
pnpm run swarm:partition

# Check for circular dependencies
jq '.batches[] | select(.dependencies | length > 0) | {id, dependencies}' .windsurf/swarm/batches/manifest.json
```

### Issue: Dashboard not updating

```bash
# Reset dashboard state
node scripts/swarm/orchestrator-dashboard.mjs reset

# Verify progress file
rm .windsurf/swarm/progress.json  # Force recreation
```

## Safety Constraints

The swarm enforces these non-negotiable rules:

1. **No `any` types** - Use `unknown` + type guards instead
2. **Preserve tenant isolation** - All RLS queries must remain valid
3. **No runtime changes** - Only type annotations, not logic
4. **Strict zones protected** - Critical paths require manual review

## Success Metrics

Track weekly progress:

```bash
#!/bin/bash
# weekly-report.sh

BASELINE=7597
CURRENT=$(pnpm run typecheck:full 2>&1 | grep -c "error TS")
FIXED=$((BASELINE - CURRENT))
PERCENT=$(echo "scale=1; ($FIXED / $BASELINE) * 100" | bc)

echo "Week: $(date +%Y-W%V)"
echo "Baseline: $BASELINE"
echo "Current: $CURRENT"
echo "Fixed: $FIXED ($PERCENT%)"
echo "Remaining: $CURRENT"
```

## Next Steps

1. Run `pnpm run swarm:hotspots` to analyze current state
2. Run `pnpm run swarm:partition` to create agent batches
3. Start dashboard: `pnpm run swarm:dashboard watch`
4. Begin execution: `pnpm run swarm:parallel sequential 5`
5. Monitor progress and adjust concurrency as needed

## Resources

- **Full Audit:** `docs/audits/typescript-comprehensive-audit-kimik-swarm-plan.md`
- **Skill Files:** `.windsurf/skills/ts-*/SKILL.md`
- **Configuration:** `.windsurf/swarm/agent-swarm-config.json`
- **Logs:** `.windsurf/swarm/logs/`
