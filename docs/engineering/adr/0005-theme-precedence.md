# ADR 0005: Theme Precedence and Token Governance

- **Status:** Proposed
- **Date:** 2026-01-15
- **Scope:** Design system tokens, theme layering, and product UI styling
- **Supersedes:** N/A

## Context

ValueOS currently exposes multiple token sources (ValueOS semantic tokens and the AI Indigo theme),
which risks inconsistent brand application and unclear precedence across product surfaces.
Teams need a deterministic rule set for which tokens to use and how to scope experimental themes
without impacting core UI or accessibility baselines.

## Decision

1. **Semantic Tokens First**: All component styles map to semantic tokens in `valueos-theme.css`.
2. **Canonical Palette Source**: Raw color values live only in `valueos-palette.css`.
3. **Scoped Themes**: Experimental themes (e.g., AI Indigo) are gated behind
   `data-theme="ai-indigo"` at the root or container level.
4. **Documentation as Enforcement**: Design system docs must include:
   - Typography role map
   - Component state matrix
   - Normalized shadow + motion token references

## Alternatives Considered

1. **Global theme override**: Rejected because it creates unintended changes across all app surfaces.
2. **Separate app-level token sets**: Rejected due to drift risk and higher maintenance costs.

## Consequences

- **Positive**: Clear precedence reduces inconsistencies and lowers rollout risk for new themes.
- **Negative**: Requires a small upfront audit to align any existing AI Indigo usage with scoped containers.
- **Operational**: Teams must set `data-theme` explicitly when using experimental themes.
