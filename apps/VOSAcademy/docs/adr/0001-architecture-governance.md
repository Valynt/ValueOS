# ADR 0001: Architecture Decision Governance

- **Status:** Accepted
- **Date:** 2025-02-06
- **Context:**
  - The platform spans generative UI (TheSys C1), a React frontend, and service-layer APIs. Architecture changes ripple across deploy automation, incident playbooks, and user-facing SLAs.
  - We lacked a single source of truth for recording decisions, keeping diagrams current, and aligning runbooks with system behavior.

- **Decision:**
  - Establish `/docs/adr` as the canonical home for architecture decision records. Use numbered markdown files with status, context, decision, and consequences.
  - Store diagrams-as-code in `/docs/diagrams` (Mermaid by default) and require updates in the same change set as the behavior they depict.
  - Tie operational runbooks to architecture changes: deployment, rollback, and on-call runbooks in `/docs/runbooks` must be updated when components, dependencies, or release processes change.
  - Reference relevant ADR IDs and diagrams in PR descriptions and link runbook updates when operational impact exists.

- **Consequences:**
  - Contributors must create or amend ADRs for changes that affect system boundaries, data flows, reliability posture, or external contracts.
  - Diagrams are diffable and reviewed with code, preventing drift between design and implementation.
  - Runbooks stay aligned with the current architecture, reducing deployment and incident risk.
  - CODEOWNERS coverage on `/docs/adr`, `/docs/diagrams`, and `/docs/runbooks` enforces reviews from the appropriate subject-matter owners.
