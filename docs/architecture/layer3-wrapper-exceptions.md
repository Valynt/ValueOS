# Layer 3 Wrapper Exception Registry

## Purpose

This document is the single source of truth for all occurrences of the marker string:

`Allowed service-local exception for Layer 3 service wrapper`

A CI guard validates that every marker has a matching tracked entry and that no untracked additions ship.

## Scope scanned by CI

- `services/layer3-knowledge/src/`
- `value_fabric/layer3/`

## Policy

- Every exception marker comment **must** include an entry ID in the format `L3W-EXC-###`.
- Every entry ID must appear exactly once in this registry.
- Entries must define reason, removal condition, owner, milestone/sprint, and planned replacement path.
- Optional sunset enforcement: entries with `sunset_date` before `2026-09-30` fail CI unless `extension_approved: true` is set.

## Entries

_No active exceptions found as of 2026-05-12._

## Entry template

Use this template when adding a new exception marker.

```yaml
- id: <L3W-EXC-###>
  marker: "Allowed service-local exception for Layer 3 service wrapper"
  path: services/layer3-knowledge/src/<file>.ts
  symbol: <functionOrClassName>
  reason: <why this exception exists>
  removal_condition: <concrete technical prerequisite to remove>
  owner: <team-or-person>
  target_milestone: <sprint/milestone>
  replacement_path: <direct-value-fabric-import|shared-module-extraction|route-rewrite>
  sunset_date: 2026-09-30
  extension_approved: false
```
