# On-Call Runbook

## Responsibilities
- Provide 24/7 coverage for user-facing incidents (learning paths, quizzes, AI tutor) and platform health.
- Acknowledge alerts within 5 minutes; begin mitigation within 15 minutes.

## Triage workflow
1. **Acknowledge and classify**
   - Confirm alert source (APM, logs, uptime, security). Tag severity (SEV-1: outage; SEV-2: major degradation; SEV-3: minor impact).
2. **Stabilize**
   - For SEV-1/2, engage incident channel and appoint incident commander.
   - Apply immediate mitigations: scale replicas, enable feature flag fallbacks, route traffic to last-known-good version, or disable non-essential jobs.
3. **Diagnose**
   - Check dashboards: error rates, latency, queue depth, CPU/memory, DB connections.
   - Inspect recent deploys (commits, tags) and compare against ADRs or runbook changes.
   - Review logs for auth errors, C1 proxy failures, quiz submission issues, or content fetch errors.
4. **Resolve/rollback**
   - If tied to recent release, follow `rollback.md`.
   - Verify `/health` and user-critical flows (login, load module, submit quiz, AI tutor chat) before closing.
5. **Communicate**
   - Post updates every 15 minutes in the incident channel; notify stakeholders if SEV-1/2.
   - Capture timeline, impact, and remediation steps in the incident report.
6. **Aftercare**
   - Create follow-up issues for fixes, tests, monitoring gaps, or documentation updates.
   - Update ADRs and runbooks with newly learned mitigations or dependencies.

## Contact and escalation
- Primary on-call: `@VOSAcademy/oncall`
- Escalation path: engineering lead → security on-call (for auth/data issues) → product owner.
- External dependencies: TheSys C1 support and CDN provider should be paged for upstream outages after internal validation.
