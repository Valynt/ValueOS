# Deploy Runbook

## Preconditions
- Release branch synced with `main`; release notes and ADR references are reviewed.
- CI green on lint, tests, and build artifacts.
- Confirm infrastructure credentials and feature flag defaults in the target environment.

## Steps
1. **Sanity checks**
   - `npm ci`
   - `npm run lint`
   - `npm run test -- --runInBand`
   - `npm run build`
2. **Prepare release artifact**
   - Capture build output and checksum (e.g., `sha256sum dist/**/*`).
   - Upload static assets to CDN bucket; set cache-control headers for immutable assets.
3. **Deploy**
   - Push Docker image or static bundle to the release registry.
   - Update environment config for the target stage (staging → production) and run migrations if applicable.
   - Trigger deployment pipeline (GitHub Actions → cloud provider) with the release tag.
4. **Post-deploy verification**
   - Hit `/health` and `/api/analytics` in the target environment.
   - Run smoke tests for authentication, course loading, quiz submission, and AI tutor chat.
   - Watch logs/metrics for 15 minutes (errors, latency, queue depth) and confirm alerts stay green.
5. **Completion**
   - Announce success in #release with version, time, and links to the PR/ADR.
   - Update runbooks/ADRs if any steps changed during deployment.

## Rollback linkage
- If verification fails, follow `rollback.md` immediately and document the trigger plus observed signals.
