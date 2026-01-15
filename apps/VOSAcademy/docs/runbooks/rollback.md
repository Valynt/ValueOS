# Rollback Runbook

## When to roll back
- Deployment verification fails or key metrics degrade (HTTP 5xx > 1%, P99 latency > 2x baseline, auth failures, or AI tutor outages).
- Security exposure or migration issues that cannot be mitigated quickly.

## Steps
1. **Freeze traffic**
   - Halt further releases; notify on-call leads and #release.
   - If needed, reduce traffic via load balancer weight or feature flag kill-switches.
2. **Select target version**
   - Choose the last known-good tag (N-1). Confirm artifact checksum and infra compatibility.
3. **Revert application**
   - Redeploy prior container/static build via pipeline promotion.
   - Revert config flags or environment variables introduced in the failed release.
4. **Data considerations**
   - If migrations were applied, run the documented down-migration or apply compensating scripts. Capture backups/snapshots before changes.
5. **Validate rollback**
   - Re-run smoke tests: login, course load, quiz submit, AI tutor chat.
   - Watch errors/latency to confirm return to baseline; verify observability alerts close.
6. **Communicate and follow up**
   - Post incident note with timeline, root trigger, and affected ADRs/PRs.
   - Open issues for fixes and update this runbook if new steps were required.
