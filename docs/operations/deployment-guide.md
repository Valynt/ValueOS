---
title: Deployment Guide (Legacy Consolidated)
owner: team-platform
canonical: ../../DEPLOY.md
note: "Canonical deployment guidance lives in docs/operations/runbooks/deployment-runbook.md. This file retains legacy examples only."
escalation_path: "pagerduty://valueos-primary -> slack:#incident-response -> email:platform-leadership@valueos.com"
review_date: 2026-05-31
status: deprecated
---

> [!WARNING]
> **Deprecated document.** Use the authoritative runbook at [`docs/operations/runbooks/deployment-runbook.md`](./runbooks/deployment-runbook.md) for all active staging/production deployments.

# Deployment Guide (Legacy Consolidated)

This file is intentionally reduced to:

1. A fast pointer to **authoritative active commands**.
2. A clear boundary between **active instructions** and **historical/legacy examples**.
3. Legacy identifier notes for operators maintaining older evidence trails.

---

## Authoritative quick path (staging / production)

Use this exact sequence for active deploy operations. These commands are aligned with the current deployment runbook and Kubernetes overlays.

### 1) Preflight and policy gates

```bash
# Required gating checks before promotion
node scripts/ci/check-agent-service-accounts.mjs
node scripts/ci/check-k8s-ingress-security-annotations.mjs
```

### 2) Apply deterministic overlay rollout command

```bash
# Staging
kustomize build infra/k8s/overlays/staging | kubectl apply -f -

# Production
kustomize build infra/k8s/overlays/production | kubectl apply -f -
```

### 3) Run blocking post-deploy smoke/chaos suite

```bash
node scripts/chaos/launch-chaos-smoke.mjs
```

### 4) Required evidence artifacts for release record

Attach all of the following:

- CI run URL for the deployed commit.
- Release ID / tag.
- Smoke + integration evidence.
- Chaos evidence artifact: `artifacts/chaos-launch/**/launch-chaos-results.json`.
- Any incident/degradation ticket references.

For full operational detail, rollback policy, and key-rotation procedure, use: [`docs/operations/runbooks/deployment-runbook.md`](./runbooks/deployment-runbook.md).

---

## Active environment/resource mapping (current manifests)

These names and endpoints reflect the currently committed overlays and should be treated as active unless superseded by runbook updates:

- **Staging overlay path:** `infra/k8s/overlays/staging`
  - Namespace: `valynt-staging`
  - Ingress host: `staging.valueos.app`
- **Production overlay path:** `infra/k8s/overlays/production`
  - Namespace: `valynt`
  - Ingress host: `app.valynt.com`
- **Container image repos (both overlays):**
  - `ghcr.io/valynt/valueos-backend`
  - `ghcr.io/valynt/valueos-frontend`

> [!NOTE]
> Product naming is **ValueOS**. Some Kubernetes namespaces, image registry org paths, and ingress resource names still use historical `valynt-*` identifiers in manifests; treat these as active infrastructure identifiers, not product branding.

---

## Historical / legacy examples only (non-authoritative)

> [!CAUTION]
> The following examples are preserved for incident forensics and migration history only. **Do not use them as active deployment instructions.**

### [legacy-example] Historical naming transitions

- `ValueVerse` → `ValueCanvas` → **ValueOS** (current product name)
- Legacy examples may contain `valuecanvas` / `ValueCanvas` strings in:
  - archived URLs,
  - sample `vault` policies,
  - old `kubectl` object names,
  - historical CI links and artifact snapshots.

### [legacy-example] Historical command snippet pattern

```bash
# historical example only — do not run as active instruction
kubectl rollout status deployment/valuecanvas-api -n production
```

### [legacy-example] Historical URL pattern

```text
https://api.valuecanvas.io/...   # historical example only
```

If legacy examples are needed for audit response, pair them with the authoritative runbook link and explicitly label them as historical in incident notes.

---

## Change-control note for this file

When updating this legacy file:

- Keep active instructions limited to exact runbook-aligned commands.
- Move all old identifiers (`ValueCanvas`, `valuecanvas`) into explicitly labeled historical blocks only.
- Do not add new operational steps here; add them in the runbook first, then mirror only a minimal quick path here.
