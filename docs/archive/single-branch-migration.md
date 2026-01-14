# Single-Branch Migration Strategy

## Overview

Migrate from branch-per-environment (`develop` → `staging` → `main`) to single-branch strategy with artifact promotion.

## Current State

```
develop branch → rebuild → deploy to dev
   ↓ merge
staging branch → rebuild → deploy to staging
   ↓ merge
main branch → rebuild → deploy to prod
```

**Problems:**
- Rebuilds artifacts per branch (config drift risk)
- Merge conflicts between branches
- State divergence
- Slower deployments

## Target State

```
main branch (only)
   ↓ build once
artifact:sha-abc123
   ↓ promote
dev → staging → production
```

**Benefits:**
- Build once, deploy everywhere
- No merge conflicts
- Single source of truth
- Faster deployments
- Guaranteed identical artifacts

## Migration Plan

### Phase 1: Preparation (Week 1)

#### 1.1 Audit Current Branches
```bash
# Check branch divergence
git log --oneline --graph --all --decorate

# Identify unique commits per branch
git log develop..staging --oneline
git log staging..main --oneline
```

#### 1.2 Merge All Branches to Main
```bash
# Ensure all changes are in main
git checkout main
git pull origin main

# Merge develop
git merge origin/develop --no-ff -m "Merge develop into main for single-branch migration"

# Merge staging
git merge origin/staging --no-ff -m "Merge staging into main for single-branch migration"

# Push
git push origin main
```

#### 1.3 Update CI/CD Workflows
- ✅ Already created: `build-once-promote.yml`
- ✅ Already created: `pr-preview-environment.yml`
- Update existing workflows to use `main` only

### Phase 2: Transition (Week 2)

#### 2.1 Enable New Workflows
```bash
# Test new workflow
git push origin main

# Verify:
# 1. Build runs on main
# 2. Artifact promoted to dev
# 3. Artifact promoted to staging
# 4. Production approval gate works
```

#### 2.2 Update Branch Protection Rules

**GitHub Settings → Branches → Branch protection rules**

**For `main` branch:**
- ✅ Require pull request reviews (2 approvals)
- ✅ Require status checks to pass
  - `build` (from build-once-promote.yml)
  - `promote-to-dev`
  - `promote-to-staging`
- ✅ Require branches to be up to date
- ✅ Require conversation resolution
- ✅ Require signed commits
- ✅ Include administrators
- ✅ Restrict pushes (only via PR)

#### 2.3 Disable Old Workflows
```bash
# Rename old workflows to disable them
mv .github/workflows/pipeline.yml .github/workflows/pipeline.yml.disabled
mv .github/workflows/build-and-push-images.yml .github/workflows/build-and-push-images.yml.disabled
mv .github/workflows/deploy-to-k8s.yml .github/workflows/deploy-to-k8s.yml.disabled
```

### Phase 3: Cleanup (Week 3)

#### 3.1 Archive Old Branches
```bash
# Create archive tags
git tag archive/develop origin/develop
git tag archive/staging origin/staging

# Push tags
git push origin --tags

# Delete remote branches
git push origin --delete develop
git push origin --delete staging
```

#### 3.2 Update Documentation
- Update README.md with new workflow
- Update CONTRIBUTING.md
- Update deployment runbooks

#### 3.3 Team Communication
- Announce migration completion
- Provide training on new workflow
- Update team playbooks

## New Developer Workflow

### Before (Branch-per-environment)
```bash
# Create feature branch from develop
git checkout develop
git pull origin develop
git checkout -b feature/my-feature

# Make changes, commit
git add .
git commit -m "Add feature"

# Push and create PR to develop
git push origin feature/my-feature

# After merge to develop → auto-deploy to dev
# Then merge develop → staging → auto-deploy to staging
# Then merge staging → main → auto-deploy to prod
```

### After (Single-branch)
```bash
# Create feature branch from main
git checkout main
git pull origin main
git checkout -b feature/my-feature

# Make changes, commit
git add .
git commit -m "Add feature"

# Push and create PR to main
git push origin feature/my-feature

# PR creates ephemeral preview environment
# After merge to main:
#   1. Build artifact once
#   2. Auto-promote to dev
#   3. Auto-promote to staging (after tests)
#   4. Manual approval for production
```

## Rollback Strategy

If migration causes issues:

```bash
# Restore old branches
git checkout -b develop origin/archive/develop
git checkout -b staging origin/archive/staging

# Re-enable old workflows
mv .github/workflows/pipeline.yml.disabled .github/workflows/pipeline.yml
mv .github/workflows/build-and-push-images.yml.disabled .github/workflows/build-and-push-images.yml

# Push branches
git push origin develop
git push origin staging
```

## Validation Checklist

- [ ] All branches merged to main
- [ ] New workflows tested and working
- [ ] Branch protection rules updated
- [ ] Old workflows disabled
- [ ] Old branches archived and deleted
- [ ] Documentation updated
- [ ] Team trained on new workflow
- [ ] Rollback plan tested

## Timeline

| Week | Phase | Tasks |
|------|-------|-------|
| 1 | Preparation | Audit branches, merge to main, update workflows |
| 2 | Transition | Enable new workflows, update branch protection, disable old workflows |
| 3 | Cleanup | Archive branches, update docs, train team |

## Success Metrics

- **Deployment Speed:** 50% faster (no rebuilds)
- **Merge Conflicts:** 0 (single branch)
- **Config Drift:** 0 (same artifact everywhere)
- **Developer Satisfaction:** Improved (simpler workflow)

## FAQ

### Q: What happens to open PRs targeting develop/staging?
**A:** Retarget them to `main` before migration.

```bash
# Update PR base branch via GitHub UI or:
gh pr edit PR_NUMBER --base main
```

### Q: How do we test changes before production?
**A:** Use ephemeral PR preview environments. Every PR gets its own isolated environment.

### Q: What if we need a hotfix?
**A:** Create PR to `main`, merge, and promote through environments. For emergency, use manual promotion to skip environments.

### Q: Can we still have feature flags?
**A:** Yes! Feature flags are even more important with single-branch. Use them to control feature rollout independently of deployment.

### Q: What about database migrations?
**A:** Migrations run automatically during promotion to each environment. Use expand-migrate-contract pattern for zero-downtime.

## References

- [Build Once, Promote Workflow](.github/workflows/build-once-promote.yml)
- [PR Preview Environments](.github/workflows/pr-preview-environment.yml)
- [External Secrets Configuration](infra/k8s/base/external-secrets.yaml)
