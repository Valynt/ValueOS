# Contributing Guide

Thank you for helping improve VOS Academy. This guide outlines how to propose changes while keeping architecture, security, and reliability guardrails intact.

## Ways to contribute
- File issues that include reproduction steps, expected vs actual behavior, and environment details.
- Improve documentation (user guides, runbooks, ADRs, diagrams-as-code) with clear rationale and references.
- Submit code changes via pull requests that stay aligned to our service boundaries (auth, content, analytics) and API versioning rules.

## Branching and commits
- Use feature branches named `feat/<area>-<short-description>` or `fix/<area>-<short-description>`.
- Keep commits focused and include context in the message (what changed, why). Avoid large, mixed changes.
- Rebase on `main` before opening a PR to reduce merge churn.

## Pull request expectations
- Link to related issues or ADRs; add a new ADR in `/docs/adr` when you change an architectural decision.
- Update diagrams-as-code and runbooks when behavior, dependencies, or operational steps change.
- Add or update tests and include local run results. Note any known limitations in the PR description.
- Follow API versioning rules: avoid breaking changes within a major version; introduce new endpoints under a new version prefix when required.

## Architecture records and diagrams-as-code
- Record architecture decisions in `/docs/adr` using numbered markdown files (see ADR 0001). Link the ADR ID in your PR description for any change that alters system boundaries, data flows, or operational posture.
- Keep diagrams-as-code in `/docs/diagrams` up to date with your change set (Mermaid preferred). When updating `docs/vos_education_hub_architecture.md`, also refresh `docs/diagrams/vos-education-hub-architecture.mmd` where applicable.
- Update runbooks in `/docs/runbooks` whenever deployment steps, rollback procedures, or on-call diagnostics change.

## Security and compliance
- Do not commit secrets; use environment variables and secret managers.
- Run SAST locally when possible; address or justify all findings. For security-sensitive areas (auth, key handling), request a security review.
- Maintain supply-chain hygiene: keep lockfiles current, prefer signed dependencies, and note any exceptions.

## Performance and reliability
- Respect performance budgets (LCP ≤ 2.5s, TTI ≤ 4s, per-service P99 targets) when shipping UI or API changes.
- Add caching headers and edge/CDN hints where applicable; avoid disabling caches for personalized endpoints unnecessarily.
- Document feature-level SLOs in PRs and ensure monitoring/alerting changes are part of the same change set.

## Code style and tooling
- Follow existing linting/formatting rules; run `npm run lint` and relevant tests before submitting.
- Prefer small, composable components and functions; keep imports clean (do not wrap imports in try/catch).

## Review and approval
- CODEOWNERS approval is required for protected areas. Auto-assign reviewers via CODEOWNERS; tag subject-matter experts for auth, content, analytics, or security changes.
- Address review feedback promptly; document follow-up tasks if deferring non-blocking items.
- Documentation, ADRs, diagrams, and runbooks are owned by the Docs/Architecture stakeholders per CODEOWNERS; obtain their review for any substantive edits.

By following these guidelines, you help us deliver secure, reliable, and maintainable learning experiences.
