# CI/CD Maturity Roadmap - Implementation Guide

## Overview

This guide provides step-by-step instructions to implement the "slick" dev → stage → prod environment strategy with artifact promotion, ephemeral previews, and progressive delivery.

---

## Phase 1: Quick Wins (1-2 weeks)

### ✅ 1.1 Artifact Promotion Strategy

**Goal:** Build once, promote everywhere (no rebuilds between environments)

**Files Created:**
- `.github/workflows/build-once-promote.yml`

**Implementation Steps:**

1. **Test the new workflow:**
   ```bash
   # Push to main to trigger build
   git checkout main
   git pull origin main
   git push origin main
   
   # Watch workflow in GitHub Actions
   # Verify:
   # - Build creates immutable artifact
   # - Artifact promoted to dev
   # - Artifact promoted to staging
   # - Production requires manual approval
   ```

2. **Disable old workflows:**
   ```bash
   # Rename to disable
   mv .github/workflows/pipeline.yml .github/workflows/pipeline.yml.disabled
   mv .github/workflows/build-and-push-images.yml .github/workflows/build-and-push-images.yml.disabled
   ```

3. **Update deployment scripts:**
   - Ensure Kubernetes deployments use image digests (not tags)
   - Update Kustomize overlays to reference same artifact

**Validation:**
- [ ] Same image digest deployed to all environments
- [ ] No rebuilds between environments
- [ ] Deployment time reduced by 50%

---

### ✅ 1.2 Ephemeral PR Preview Environments

**Goal:** Automatic preview environment for every PR

**Files Created:**
- `.github/workflows/pr-preview-environment.yml`

**Implementation Steps:**

1. **Configure DNS wildcard:**
   ```bash
   # Add DNS record for preview subdomain
   # *.preview.valuecanvas.app → Load Balancer IP
   ```

2. **Install cert-manager (for TLS):**
   ```bash
   kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
   
   # Create ClusterIssuer for Let's Encrypt
   cat <<EOF | kubectl apply -f -
   apiVersion: cert-manager.io/v1
   kind: ClusterIssuer
   metadata:
     name: letsencrypt-prod
   spec:
     acme:
       server: https://acme-v02.api.letsencrypt.org/directory
       email: devops@valuecanvas.app
       privateKeySecretRef:
         name: letsencrypt-prod
       solvers:
       - http01:
           ingress:
             class: nginx
   EOF
   ```

3. **Test PR preview:**
   ```bash
   # Create test PR
   git checkout -b test-preview-env
   echo "test" > test.txt
   git add test.txt
   git commit -m "Test preview environment"
   git push origin test-preview-env
   
   # Create PR via GitHub UI
   # Verify:
   # - Preview environment created
   # - Comment added to PR with URL
   # - Environment accessible
   ```

4. **Configure cleanup schedule:**
   - Workflow runs daily at 2 AM UTC
   - Deletes preview environments older than 7 days

**Validation:**
- [ ] PR creates preview environment
- [ ] Preview URL posted as comment
- [ ] Environment auto-deleted on PR close
- [ ] Stale environments cleaned up daily

---

### ✅ 1.3 Centralized Secrets Management

**Goal:** Single source of truth for secrets (AWS Secrets Manager)

**Files Created:**
- `.github/workflows/secrets-sync.yml`
- `infra/k8s/base/external-secrets.yaml`

**Implementation Steps:**

1. **Install External Secrets Operator:**
   ```bash
   helm repo add external-secrets https://charts.external-secrets.io
   helm install external-secrets external-secrets/external-secrets \
     -n external-secrets-system \
     --create-namespace
   ```

2. **Create IAM role for secrets access:**
   ```bash
   # Create IAM policy
   cat > secrets-policy.json <<EOF
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "secretsmanager:GetSecretValue",
           "secretsmanager:DescribeSecret"
         ],
         "Resource": "arn:aws:secretsmanager:us-east-1:*:secret:valuecanvas/*"
       }
     ]
   }
   EOF
   
   aws iam create-policy \
     --policy-name ValueCanvasSecretsReader \
     --policy-document file://secrets-policy.json
   
   # Create service account with IAM role
   eksctl create iamserviceaccount \
     --name valuecanvas-app \
     --namespace default \
     --cluster valuecanvas-dev-cluster \
     --attach-policy-arn arn:aws:iam::ACCOUNT_ID:policy/ValueCanvasSecretsReader \
     --approve
   ```

3. **Sync secrets to AWS Secrets Manager:**
   ```bash
   # Run sync workflow (dry run first)
   gh workflow run secrets-sync.yml \
     -f environment=dev \
     -f dry_run=true
   
   # Review output, then run for real
   gh workflow run secrets-sync.yml \
     -f environment=dev \
     -f dry_run=false
   ```

4. **Deploy External Secrets:**
   ```bash
   # Update account ID in external-secrets.yaml
   sed -i 's/ACCOUNT_ID/123456789012/g' infra/k8s/base/external-secrets.yaml
   
   # Apply configuration
   kubectl apply -f infra/k8s/base/external-secrets.yaml
   
   # Verify secrets created
   kubectl get externalsecrets -A
   kubectl get secrets -n dev valuecanvas-secrets
   ```

5. **Remove secrets from GitHub:**
   - Keep only AWS role ARNs in GitHub Secrets
   - All other secrets now in AWS Secrets Manager

**Validation:**
- [ ] Secrets synced to AWS Secrets Manager
- [ ] External Secrets Operator running
- [ ] Kubernetes secrets auto-populated
- [ ] Application can access secrets

---

## Phase 2: Structural Changes (1 month)

### ✅ 2.1 Single-Branch Migration

**Goal:** Migrate from branch-per-environment to single main branch

**Files Created:**
- `docs/single-branch-migration.md`

**Implementation Steps:**

1. **Audit current branches:**
   ```bash
   # Check for divergence
   git log --oneline --graph --all --decorate
   git log develop..staging --oneline
   git log staging..main --oneline
   ```

2. **Merge all branches to main:**
   ```bash
   git checkout main
   git pull origin main
   
   # Merge develop
   git merge origin/develop --no-ff -m "Merge develop for single-branch migration"
   
   # Merge staging
   git merge origin/staging --no-ff -m "Merge staging for single-branch migration"
   
   # Push
   git push origin main
   ```

3. **Update branch protection rules:**
   - Go to GitHub Settings → Branches
   - Update `main` branch protection:
     - Require 2 approvals
     - Require status checks: `build`, `promote-to-dev`, `promote-to-staging`
     - Require conversation resolution
     - Restrict pushes (only via PR)

4. **Retarget open PRs:**
   ```bash
   # List open PRs targeting develop/staging
   gh pr list --base develop
   gh pr list --base staging
   
   # Retarget each PR to main
   gh pr edit PR_NUMBER --base main
   ```

5. **Archive old branches:**
   ```bash
   # Create archive tags
   git tag archive/develop origin/develop
   git tag archive/staging origin/staging
   git push origin --tags
   
   # Delete remote branches
   git push origin --delete develop
   git push origin --delete staging
   ```

6. **Update documentation:**
   - Update README.md
   - Update CONTRIBUTING.md
   - Announce to team

**Validation:**
- [ ] All code merged to main
- [ ] Old branches archived
- [ ] Branch protection rules updated
- [ ] Team trained on new workflow

---

### ✅ 2.2 Expand-Migrate-Contract Database Pattern

**Goal:** Zero-downtime database migrations

**Files Created:**
- `docs/database-migration-patterns.md`

**Implementation Steps:**

1. **Review migration patterns:**
   - Read `docs/database-migration-patterns.md`
   - Understand expand-migrate-contract phases

2. **Update migration naming convention:**
   ```bash
   # New migrations should follow pattern:
   # YYYYMMDDHHMMSS_expand_feature_name.sql
   # YYYYMMDDHHMMSS_migrate_feature_name.sql
   # YYYYMMDDHHMMSS_contract_feature_name.sql
   ```

3. **Example: Rename column with zero downtime:**
   
   **Phase 1 - EXPAND (Deploy 1):**
   ```sql
   -- supabase/migrations/20260102000001_expand_users_email_address.sql
   ALTER TABLE users ADD COLUMN email_address VARCHAR(255);
   
   CREATE OR REPLACE FUNCTION sync_email_to_email_address()
   RETURNS TRIGGER AS $$
   BEGIN
     NEW.email_address = NEW.email;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;
   
   CREATE TRIGGER sync_email_trigger
   BEFORE INSERT OR UPDATE ON users
   FOR EACH ROW
   EXECUTE FUNCTION sync_email_to_email_address();
   ```
   
   **Phase 2 - MIGRATE (Deploy 2, after 24-48 hours):**
   ```sql
   -- supabase/migrations/20260104000001_migrate_users_email_address.sql
   UPDATE users SET email_address = email WHERE email_address IS NULL;
   ALTER TABLE users ALTER COLUMN email_address SET NOT NULL;
   CREATE INDEX idx_users_email_address ON users(email_address);
   ```
   
   **Phase 3 - CONTRACT (Deploy 3, after 24-48 hours):**
   ```sql
   -- supabase/migrations/20260106000001_contract_users_email_address.sql
   DROP TRIGGER IF EXISTS sync_email_trigger ON users;
   DROP FUNCTION IF EXISTS sync_email_to_email_address();
   ALTER TABLE users DROP COLUMN email;
   ```

4. **Update database-guard workflow:**
   - Validates expand-migrate-contract pattern
   - Checks for breaking changes
   - Enforces waiting period between phases

**Validation:**
- [ ] Migrations follow expand-migrate-contract pattern
- [ ] No downtime during migrations
- [ ] Rollback plan documented for each phase

---

### ✅ 2.3 Canary Deployments

**Goal:** Gradual production rollout with automatic rollback

**Files Created:**
- `.github/workflows/canary-deployment.yml`

**Implementation Steps:**

1. **Install Istio (for traffic splitting):**
   ```bash
   # Install Istio
   curl -L https://istio.io/downloadIstio | sh -
   cd istio-*
   export PATH=$PWD/bin:$PATH
   
   istioctl install --set profile=production -y
   
   # Enable sidecar injection for production namespace
   kubectl label namespace production istio-injection=enabled
   ```

2. **Configure Istio VirtualService:**
   ```bash
   # VirtualService is created by canary workflow
   # Verify it exists after first canary deployment
   kubectl get virtualservice -n production
   ```

3. **Test canary deployment:**
   ```bash
   # Trigger canary deployment
   gh workflow run canary-deployment.yml \
     -f image_digest=sha256:abc123... \
     -f canary_percentage=10 \
     -f auto_promote=true
   
   # Monitor metrics
   # - Check Grafana dashboard
   # - Verify traffic split (10% canary, 90% stable)
   # - Wait for auto-promotion or rollback
   ```

4. **Configure monitoring:**
   - Set up CloudWatch alarms for error rate
   - Configure Grafana dashboard for canary metrics
   - Test rollback scenario

**Validation:**
- [ ] Canary deployment creates separate deployment
- [ ] Traffic split configured correctly
- [ ] Metrics monitored for 10 minutes
- [ ] Auto-promotion works on healthy metrics
- [ ] Auto-rollback works on unhealthy metrics

---

## Phase 3: Polish (Ongoing)

### ✅ 3.1 Automated Rollback on Metrics

**Goal:** Continuous monitoring with automatic rollback

**Files Created:**
- `.github/workflows/production-health-monitor.yml`

**Implementation Steps:**

1. **Configure CloudWatch metrics:**
   - Ensure ALB metrics are being collected
   - Set up custom metrics for application errors

2. **Test health monitoring:**
   ```bash
   # Trigger health monitor manually
   gh workflow run production-health-monitor.yml
   
   # Check output
   # - Verify metrics collected
   # - Check health evaluation logic
   ```

3. **Configure alerts:**
   - PagerDuty integration for critical issues
   - Slack notifications for warnings
   - GitHub issues for rollbacks

4. **Test rollback scenario:**
   - Deploy intentionally broken version
   - Verify health monitor detects issues
   - Confirm automatic rollback executes

**Validation:**
- [ ] Health monitor runs every 5 minutes
- [ ] Metrics collected from CloudWatch
- [ ] Rollback triggers on high error rate
- [ ] Alerts sent to PagerDuty and Slack

---

### ✅ 3.2 Progressive Feature Flag Rollouts

**Goal:** Gradual feature rollout with automatic rollback

**Files Created:**
- `src/config/progressiveRollout.ts`
- `supabase/migrations/20260102000001_progressive_rollouts.sql`

**Implementation Steps:**

1. **Apply database migration:**
   ```bash
   npx supabase db push
   
   # Verify tables created
   npx supabase db execute --stdin <<< "SELECT * FROM feature_rollouts LIMIT 1;"
   ```

2. **Create feature rollout:**
   ```typescript
   // In your admin panel or via SQL
   INSERT INTO feature_rollouts (
     feature_name,
     percentage,
     active,
     auto_rollback,
     error_threshold
   ) VALUES (
     'new-ui-redesign',
     10, -- Start with 10%
     true,
     true,
     5.0 -- Rollback if error rate > 5%
   );
   ```

3. **Use in application:**
   ```typescript
   import { useFeatureRollout } from '@/config/progressiveRollout';
   
   function MyComponent() {
     const { enabled, loading } = useFeatureRollout(
       'new-ui-redesign',
       userId,
       userGroups
     );
     
     if (loading) return <Spinner />;
     
     return enabled ? <NewUI /> : <OldUI />;
   }
   ```

4. **Monitor and increase percentage:**
   ```sql
   -- After 24 hours, if metrics are good
   UPDATE feature_rollouts
   SET percentage = 25
   WHERE feature_name = 'new-ui-redesign';
   
   -- Continue: 25% → 50% → 100%
   ```

5. **Configure auto-rollback:**
   - Runs every 5 minutes via pg_cron
   - Checks error rate vs threshold
   - Automatically disables feature if threshold exceeded

**Validation:**
- [ ] Feature rollout tables created
- [ ] Progressive rollout works for test feature
- [ ] Error tracking captures issues
- [ ] Auto-rollback triggers on high error rate
- [ ] Metrics dashboard shows rollout progress

---

### ✅ 3.3 Cost Optimization for Preview Environments

**Goal:** Reduce preview environment costs by 50%

**Files Created:**
- `.github/workflows/preview-env-cost-optimization.yml`

**Implementation Steps:**

1. **Enable cost allocation tags:**
   ```bash
   # Tag preview resources
   kubectl label namespace pr-* Environment=preview
   
   # Enable cost allocation tags in AWS
   aws ce update-cost-allocation-tags-status \
     --cost-allocation-tags-status \
     TagKey=Environment,Status=Active
   ```

2. **Configure auto-scaling:**
   ```bash
   # Install metrics server
   kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
   
   # Install VPA
   kubectl apply -f https://github.com/kubernetes/autoscaler/releases/latest/download/vertical-pod-autoscaler.yaml
   ```

3. **Test cost optimization:**
   ```bash
   # Run optimization workflow
   gh workflow run preview-env-cost-optimization.yml
   
   # Verify:
   # - Inactive environments scaled down
   # - Stale environments deleted
   # - Cost report generated
   ```

4. **Monitor costs:**
   - Review weekly cost reports
   - Adjust thresholds if needed
   - Optimize resource limits

**Validation:**
- [ ] Inactive environments scaled down after 2 hours
- [ ] Stale environments deleted after 7 days
- [ ] HPA and VPA configured
- [ ] Cost reduced by 50%
- [ ] Weekly cost reports generated

---

## Success Metrics

Track these metrics to measure success:

| Metric | Before | Target | Current |
|--------|--------|--------|---------|
| Deployment Time | 30 min | 15 min | ___ |
| Merge Conflicts | 5/week | 0/week | ___ |
| Config Drift Incidents | 2/month | 0/month | ___ |
| Preview Env Cost | $200/week | $100/week | ___ |
| Production Incidents | 3/month | 1/month | ___ |
| Rollback Time | 15 min | 2 min | ___ |

---

## Rollback Plan

If any phase causes issues:

1. **Artifact Promotion:**
   - Re-enable old workflows
   - Continue using branch-per-environment

2. **PR Previews:**
   - Disable workflow
   - Manual preview environments if needed

3. **Secrets Management:**
   - Revert to GitHub Secrets
   - Remove External Secrets Operator

4. **Single Branch:**
   - Restore develop/staging branches from archive tags
   - Update branch protection rules

---

## Support

For issues or questions:
- Review workflow logs in GitHub Actions
- Check Kubernetes events: `kubectl get events -n NAMESPACE`
- Review this documentation
- Contact DevOps team

---

## Next Steps

After completing all phases:

1. **Continuous Improvement:**
   - Monitor metrics weekly
   - Optimize based on feedback
   - Share learnings with team

2. **Advanced Features:**
   - Multi-region deployments
   - Chaos engineering in production
   - Advanced observability (distributed tracing)

3. **Team Training:**
   - Conduct workshops on new workflows
   - Update onboarding documentation
   - Create runbooks for common scenarios
