# Tasks

## 4. Confidence Scoring Enhancements

- [x] 4.1 Add corroboration boost to `ConfidenceScorer`: each additional independent source increases confidence (up to cap of 0.15 boost)
- [x] 4.2 Add expired evidence penalty: evidence exceeding max age for its tier receives freshness penalty
- [x] 4.3 Ensure claims with confidence < 0.5 are flagged as requiring additional evidence
- [x] 4.4 Ensure no financial claim appears in final outputs without a confidence score

## 8. Tests

- [x] 8.4 Unit test corroboration boost and expired evidence penalty
