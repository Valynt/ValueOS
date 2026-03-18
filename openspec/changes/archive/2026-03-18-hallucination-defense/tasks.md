# Tasks

## 5. Hallucination Defense

- [x] 5.1 Implement `NarrativeHallucinationChecker` service
- [x] 5.2 Parse financial figures from generated narrative text
- [x] 5.3 Cross-reference each figure against economic kernel deterministic calculations
- [x] 5.4 Flag any discrepancy as a hallucination with severity and location
- [x] 5.5 Wire checker into narrative generation pipeline (run after NarrativeAgent, before persist)
- [x] 5.6 Block narrative persistence if critical hallucinations detected

## 8. Tests

- [x] 8.5 Unit test NarrativeHallucinationChecker with matching and mismatching figures
