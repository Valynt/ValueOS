# Quality Governor: Governance Pulse

**Scorecard:**
- **Total Errors:** `9782` 
- **Error Density:** `100.0%` of files impacted
- **Island Coverage:** `2` packages locked

## 🏝️ Green Island Status
| Package | Status | Errors | Dependency Health |
| :--- | :--- | :--- | :--- |
| `apps/ValyntApp` | 🌊 Debt | 4725 | 🔗 2 deps |
| `apps/mcp-dashboard` | 🌊 Debt | 56 | 🍃 Leaf |
| `packages/agents` | 🌊 Debt | 164 | 🔗 2 deps |
| `packages/backend` | 🌊 Debt | 4016 | 🔗 1 deps |
| `packages/infra` | 🌊 Debt | 6 | 🍃 Leaf |
| `packages/mcp` | 🌊 Debt | 468 | 🍃 Leaf |
| `packages/sdui` | 🌊 Debt | 313 | 🍃 Leaf |
| `packages/services` | 🌊 Debt | 28 | 🍃 Leaf |
| `packages/shared` | 🌊 Debt | 6 | 🍃 Leaf |

## Governance Risk Register

### Risk: Legacy Concentration

- **Risk statement:** Legacy concentration in high-change areas can stall modernization, inflate incident probability, and hide systemic quality erosion until release pressure forces reactive remediation.
- **Owner:** **Engineering Productivity Lead** (single accountable role).
- **Review frequency:** **Weekly** governance pulse review, with a monthly trend checkpoint in the engineering leadership review.
- **Escalation path on threshold breach:** Engineering Productivity Lead → Head of Engineering (same week) → CTO (if unresolved after two consecutive reviews).

### Exit Criteria (trend-based, objective)

Legacy concentration is considered under control only when **all** criteria below hold for the agreed observation windows:

1. **Error budget burn rate trend:** stays below the agreed threshold for **4 consecutive weekly periods**.
2. **Sea-of-Debt trend:** aggregate debt footprint declines by at least **10% over 4 consecutive weekly periods**.
3. **Strict-island coverage trend:** strict-island coverage expands by at least **15% over 4 consecutive weekly periods**.

> Snapshot improvements do not qualify as exit. A single-period regression resets the applicable trend window.
