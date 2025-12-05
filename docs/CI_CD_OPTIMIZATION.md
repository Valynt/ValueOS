# CI/CD Pipeline Optimization

## Overview

The ValueCanvas CI/CD pipeline has been optimized to use **smart matrix builds** that only build and deploy changed services, significantly reducing deployment time and costs.

## Problem Statement

### Before Optimization

**Issue**: Every deployment built all 6 backend services, even if only one file changed.

**Impact**:
- ⏱️ **18+ minutes** per deployment (6 services × 3 min each)
- 💰 **High CI/CD costs** (unnecessary compute time)
- 🐌 **Slow feedback loop** for developers
- ♻️ **Wasted resources** building unchanged code

**Example**: Changing a single line in the frontend triggered:
- ✗ Build opportunity service (unnecessary)
- ✗ Build target service (unnecessary)
- ✗ Build realization service (unnecessary)
- ✗ Build expansion service (unnecessary)
- ✗ Build integrity service (unnecessary)
- ✗ Build orchestrator service (unnecessary)
- ✓ Build frontend (necessary)

**Total time**: ~20 minutes for a 1-line change

### After Optimization

**Solution**: Dynamic matrix generation based on changed files

**Impact**:
- ⏱️ **2-5 minutes** for typical deployments
- 💰 **70-90% cost reduction** on CI/CD
- 🚀 **Fast feedback loop** for developers
- ♻️ **Efficient resource usage**

**Same example**: Changing a single line in the frontend triggers:
- ✓ Build frontend (necessary)
- ✗ Skip all backend services (smart)

**Total time**: ~3 minutes (85% faster)

---

## How It Works

### 1. Change Detection

The workflow uses `dorny/paths-filter@v3` to detect which files changed:

```yaml
detect-changes:
  runs-on: ubuntu-latest
  outputs:
    services: ${{ steps.filter.outputs.changes }}
    frontend: ${{ steps.filter.outputs.frontend }}
    infrastructure: ${{ steps.filter.outputs.infrastructure }}
  steps:
    - uses: actions/checkout@v4
    - uses: dorny/paths-filter@v3
      id: filter
      with:
        filters: |
          opportunity:
            - 'blueprint/infra/backend/services/opportunity/**'
          target:
            - 'blueprint/infra/backend/services/target/**'
          # ... other services
          frontend:
            - 'src/**'
            - 'public/**'
          infrastructure:
            - 'infrastructure/**'
```

**Output**: JSON array of changed services, e.g., `["opportunity", "target"]`

### 2. Dynamic Matrix Generation

The build job uses the detected changes to create a dynamic matrix:

```yaml
build-images:
  needs: [detect-changes]
  if: ${{ needs.detect-changes.outputs.services != '[]' }}
  strategy:
    matrix:
      service: ${{ fromJSON(needs.detect-changes.outputs.services) }}
  steps:
    - name: Build and push Docker image
      uses: docker/build-push-action@v5
      with:
        context: ./blueprint/infra/backend/services/${{ matrix.service }}
```

**Result**: Only changed services are built in parallel

### 3. Conditional Deployment

Each deployment job checks if it needs to run:

```yaml
deploy-kubernetes:
  needs: [detect-changes]
  if: ${{ needs.detect-changes.outputs.services != '[]' }}
  steps:
    - name: Deploy changed services
      run: |
        for service in $(echo '${{ needs.detect-changes.outputs.services }}' | jq -r '.[]'); do
          kubectl rollout restart deployment/${service}-agent
        done
```

**Result**: Only changed services are deployed

---

## Optimization Scenarios

### Scenario 1: Frontend-Only Change

**Changed files**: `src/components/Layout/MainLayout.tsx`

**Jobs that run**:
- ✓ Test (always runs)
- ✓ Security scan (always runs)
- ✓ Build frontend
- ✓ Deploy frontend
- ✗ Build images (skipped)
- ✗ Deploy Kubernetes (skipped)
- ✗ Deploy infrastructure (skipped)

**Time**: ~3 minutes (vs 20 minutes)  
**Savings**: 85%

---

### Scenario 2: Single Service Change

**Changed files**: `blueprint/infra/backend/services/opportunity/handler.go`

**Jobs that run**:
- ✓ Test (always runs)
- ✓ Security scan (always runs)
- ✓ Build images (opportunity only)
- ✓ Deploy infrastructure
- ✓ Deploy Kubernetes (opportunity only)
- ✗ Build frontend (skipped)
- ✗ Deploy frontend (skipped)

**Time**: ~5 minutes (vs 20 minutes)  
**Savings**: 75%

---

### Scenario 3: Multiple Services Change

**Changed files**:
- `blueprint/infra/backend/services/opportunity/handler.go`
- `blueprint/infra/backend/services/target/service.go`

**Jobs that run**:
- ✓ Test (always runs)
- ✓ Security scan (always runs)
- ✓ Build images (opportunity, target)
- ✓ Deploy infrastructure
- ✓ Deploy Kubernetes (opportunity, target)
- ✗ Build frontend (skipped)
- ✗ Deploy frontend (skipped)

**Time**: ~8 minutes (vs 20 minutes)  
**Savings**: 60%

---

### Scenario 4: Frontend + Service Change

**Changed files**:
- `src/App.tsx`
- `blueprint/infra/backend/services/realization/service.go`

**Jobs that run**:
- ✓ Test (always runs)
- ✓ Security scan (always runs)
- ✓ Build frontend
- ✓ Build images (realization only)
- ✓ Deploy infrastructure
- ✓ Deploy Kubernetes (realization only)
- ✓ Deploy frontend

**Time**: ~10 minutes (vs 20 minutes)  
**Savings**: 50%

---

### Scenario 5: Infrastructure-Only Change

**Changed files**: `infrastructure/terraform/main.tf`

**Jobs that run**:
- ✓ Test (always runs)
- ✓ Security scan (always runs)
- ✓ Deploy infrastructure
- ✗ Build images (skipped)
- ✗ Build frontend (skipped)
- ✗ Deploy Kubernetes (skipped)
- ✗ Deploy frontend (skipped)

**Time**: ~4 minutes (vs 20 minutes)  
**Savings**: 80%

---

### Scenario 6: No Relevant Changes

**Changed files**: `README.md`, `docs/GUIDE.md`

**Jobs that run**:
- ✓ Test (always runs)
- ✓ Security scan (always runs)
- ✗ Build images (skipped)
- ✗ Build frontend (skipped)
- ✗ Deploy infrastructure (skipped)
- ✗ Deploy Kubernetes (skipped)
- ✗ Deploy frontend (skipped)
- ✗ Smoke tests (skipped)

**Time**: ~2 minutes (vs 20 minutes)  
**Savings**: 90%

---

## Path Filters Configuration

### Backend Services

Each service has its own filter:

```yaml
opportunity:
  - 'blueprint/infra/backend/services/opportunity/**'
target:
  - 'blueprint/infra/backend/services/target/**'
realization:
  - 'blueprint/infra/backend/services/realization/**'
expansion:
  - 'blueprint/infra/backend/services/expansion/**'
integrity:
  - 'blueprint/infra/backend/services/integrity/**'
orchestrator:
  - 'blueprint/infra/backend/services/orchestrator/**'
```

### Frontend

Triggers on any frontend-related changes:

```yaml
frontend:
  - 'src/**'
  - 'public/**'
  - 'index.html'
  - 'package.json'
  - 'vite.config.ts'
  - 'tsconfig.json'
```

### Infrastructure

Triggers on infrastructure or workflow changes:

```yaml
infrastructure:
  - 'infrastructure/**'
  - '.github/workflows/**'
```

---

## Testing the Matrix Logic

Use the provided test script to validate matrix generation:

```bash
./scripts/test-workflow-matrix.sh
```

**Output**:
```
Testing scenario: frontend-only
Changed files: src/components/Layout/MainLayout.tsx
  Services to build: []
  Frontend changed: true
  Infrastructure changed: false
Jobs that would run:
  ✗ build-images (skipped - no service changes)
  ✗ deploy-kubernetes (skipped - no service changes)
  ✓ build-frontend
  ✓ deploy-frontend
  ✗ deploy-infrastructure (skipped - no infra/service changes)
  ⏱️  Estimated time saved: ~18 minutes
```

---

## Monitoring and Metrics

### GitHub Actions Insights

View optimization impact in GitHub Actions:

1. Go to **Actions** tab
2. Select **Deploy to Production** workflow
3. Compare run times before/after optimization

**Expected metrics**:
- Average run time: 20 min → 5 min (75% reduction)
- Billable minutes: 120 min/day → 30 min/day (75% reduction)
- Cost savings: ~$50-100/month (depending on usage)

### Deployment Summary

Each workflow run includes a summary:

```yaml
deployment-summary:
  steps:
    - name: Print deployment summary
      run: |
        echo "Changed services: ${{ needs.detect-changes.outputs.services }}"
        echo "Frontend changed: ${{ needs.detect-changes.outputs.frontend }}"
        echo "Infrastructure changed: ${{ needs.detect-changes.outputs.infrastructure }}"
```

---

## Best Practices

### 1. Shared Code Changes

**Problem**: Changing shared code (e.g., `blueprint/infra/backend/shared/`) should rebuild all services.

**Solution**: Add shared paths to all service filters:

```yaml
opportunity:
  - 'blueprint/infra/backend/services/opportunity/**'
  - 'blueprint/infra/backend/shared/**'  # Shared code
```

### 2. Database Migrations

**Problem**: Database migrations affect all services.

**Solution**: Add migration paths to infrastructure filter:

```yaml
infrastructure:
  - 'infrastructure/**'
  - 'supabase/migrations/**'  # Database migrations
```

### 3. Dependency Updates

**Problem**: Updating `go.mod` or `package.json` should rebuild affected services.

**Solution**: Add dependency files to filters:

```yaml
opportunity:
  - 'blueprint/infra/backend/services/opportunity/**'
  - 'blueprint/infra/backend/go.mod'  # Go dependencies
  - 'blueprint/infra/backend/go.sum'
```

### 4. Force Full Deployment

**Problem**: Sometimes you need to deploy everything (e.g., after major changes).

**Solution**: Use workflow dispatch with a parameter:

```yaml
on:
  workflow_dispatch:
    inputs:
      force_full_deploy:
        description: 'Force full deployment (all services)'
        type: boolean
        default: false
```

Then in the workflow:

```yaml
if: |
  github.event.inputs.force_full_deploy == 'true' ||
  needs.detect-changes.outputs.services != '[]'
```

---

## Troubleshooting

### Issue: Service not building when it should

**Symptom**: Changed a service file but it didn't build

**Diagnosis**:
1. Check the path filter matches your file path
2. Verify the file is not in `.gitignore`
3. Check the workflow run logs for detected changes

**Solution**:
```bash
# Test locally
./scripts/test-workflow-matrix.sh

# Check git diff
git diff --name-only origin/main
```

### Issue: Too many services building

**Symptom**: Changing one file triggers multiple service builds

**Diagnosis**:
1. Check if the file is in a shared directory
2. Verify path filters are specific enough

**Solution**: Make path filters more specific:

```yaml
# Too broad (matches shared code)
opportunity:
  - 'blueprint/infra/backend/**'

# Better (specific to service)
opportunity:
  - 'blueprint/infra/backend/services/opportunity/**'
```

### Issue: Matrix is empty

**Symptom**: `needs.detect-changes.outputs.services` is `[]`

**Diagnosis**:
1. Check if any service paths matched
2. Verify the filter syntax is correct

**Solution**: Add debug output:

```yaml
- name: Debug changes
  run: |
    echo "Services: ${{ needs.detect-changes.outputs.services }}"
    echo "Frontend: ${{ needs.detect-changes.outputs.frontend }}"
```

---

## Cost Analysis

### Before Optimization

**Assumptions**:
- 10 deployments per day
- 20 minutes per deployment
- $0.008 per minute (GitHub Actions pricing)

**Monthly cost**:
```
10 deployments/day × 20 min × 30 days × $0.008/min = $48/month
```

### After Optimization

**Assumptions**:
- 10 deployments per day
- 5 minutes average per deployment (75% reduction)
- $0.008 per minute

**Monthly cost**:
```
10 deployments/day × 5 min × 30 days × $0.008/min = $12/month
```

**Savings**: $36/month (75% reduction)

### Annual Savings

```
$36/month × 12 months = $432/year
```

Plus:
- ⏱️ **Developer time saved**: ~150 hours/year
- 🚀 **Faster feedback**: 4x faster deployments
- 🌱 **Environmental impact**: 75% less compute resources

---

## Future Enhancements

### 1. Parallel Service Builds

**Current**: Services build sequentially in matrix  
**Enhancement**: Use build cache and parallel builds

```yaml
strategy:
  matrix:
    service: ${{ fromJSON(needs.detect-changes.outputs.services) }}
  max-parallel: 6  # Build all services in parallel
```

**Impact**: Further 50% time reduction for multi-service changes

### 2. Incremental Builds

**Current**: Full Docker builds each time  
**Enhancement**: Use Docker layer caching

```yaml
- name: Build and push
  uses: docker/build-push-action@v5
  with:
    cache-from: type=registry,ref=${{ env.ECR_REGISTRY }}/valuecanvas-${{ matrix.service }}:cache
    cache-to: type=registry,ref=${{ env.ECR_REGISTRY }}/valuecanvas-${{ matrix.service }}:cache,mode=max
```

**Impact**: 30-50% faster builds

### 3. Smart Test Selection

**Current**: All tests run every time  
**Enhancement**: Only run tests for changed services

```yaml
test:
  strategy:
    matrix:
      service: ${{ fromJSON(needs.detect-changes.outputs.services) }}
  steps:
    - name: Run service tests
      run: go test ./services/${{ matrix.service }}/...
```

**Impact**: 60-80% faster test runs

---

## References

- **Workflow file**: `.github/workflows/deploy-production.yml`
- **Test script**: `scripts/test-workflow-matrix.sh`
- **paths-filter action**: https://github.com/dorny/paths-filter
- **GitHub Actions docs**: https://docs.github.com/en/actions

---

**Last Updated**: November 23, 2024  
**Version**: 1.0  
**Author**: ValueCanvas DevOps Team
