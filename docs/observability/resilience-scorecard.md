# Resilience Scorecard (Promotion Gate)

Use this scorecard after every planned chaos test cycle. Production promotion is allowed only when this scorecard is **PASS**.

## Gate policy

- **Hard gate:** Any FAIL in a critical category blocks production promotion.
- **Critical categories:** telemetry coverage, alert quality, timeline reconstruction, synthetic journey fidelity.
- **Evidence required:** link latest post-experiment report artifact and alert/runbook references.

## Scorecard

| Category                           | Check                                                                                                                  | Weight | Pass criteria                    | Status        | Evidence |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -----: | -------------------------------- | ------------- | -------- |
| Failure mode coverage              | Dependency outage, high latency, queue backlog, partial region outage, message loss were all executed in current cycle |     15 | 5/5 covered                      | ☐ PASS ☐ FAIL |          |
| Trace assertions                   | Required trace assertions passed in every experiment                                                                   |     15 | 100% pass                        | ☐ PASS ☐ FAIL |          |
| Log assertions                     | Required log assertions passed in every experiment                                                                     |     10 | 100% pass                        | ☐ PASS ☐ FAIL |          |
| Metric assertions                  | Required metric assertions passed in every experiment                                                                  |     10 | 100% pass                        | ☐ PASS ☐ FAIL |          |
| Alert detection latency            | Alert fired within target window for each experiment                                                                   |     15 | ≥ 95% in-window                  | ☐ PASS ☐ FAIL |          |
| Alert precision                    | Alerts map to injected failure without noisy unrelated pages                                                           |     10 | ≥ 90% precision                  | ☐ PASS ☐ FAIL |          |
| Runbook linkage                    | Fired alerts include direct runbook URLs                                                                               |      5 | 100% linked                      | ☐ PASS ☐ FAIL |          |
| `trace_id` timeline reconstruction | Timeline includes injection→symptom→alert→mitigation→recovery with correlated `trace_id`                               |     10 | 100% experiments reconstructable | ☐ PASS ☐ FAIL |          |
| Synthetic monitoring fidelity      | Critical journeys tested under baseline + partial failures and alert severity validated                                |     10 | 100% journeys covered            | ☐ PASS ☐ FAIL |          |

### Total score

- Weighted score: `_____ / 100`
- Required minimum for promotion: **85/100**
- Additional hard-stop: no critical category may be FAIL even if score ≥ 85.

## Approval checklist

- [ ] Latest chaos report linked: `________________`
- [ ] Alert dashboard snapshot linked: `________________`
- [ ] Runbook links verified for all fired alerts.
- [ ] Open remediation tickets created for every failed criterion.
- [ ] Platform on-call signoff: `________________`
- [ ] Release captain signoff: `________________`

## Decision

- **Promotion decision:** ☐ PASS (promote) ☐ FAIL (block)
- **Date:** `YYYY-MM-DD`
- **Owner:** `________________`
