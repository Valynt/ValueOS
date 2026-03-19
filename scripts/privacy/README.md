# Non-production data anonymization pipeline

This directory contains the staging/dev data privacy pipeline used to convert representative restored snapshots into anonymized artifacts and then verify the result before release sign-off.

## What it does

1. Reads a representative non-production dataset or restored snapshot.
2. Reuses backend anonymization primitives from `packages/backend/src/lib/anonymization.ts` plus existing redaction helpers in:
   - `packages/shared/src/lib/piiFilter.ts`
   - `packages/backend/src/lib/redaction.ts`
3. Writes anonymized output into an artifact directory.
4. Verifies that the anonymized output:
   - does not contain configured forbidden production identifiers,
   - keeps sensitive fields null/redacted/anonymized only, and
   - does not contain raw sensitive literals such as email addresses, SSNs, bearer tokens, or payment-card strings.

## Run locally

```bash
pnpm exec tsx scripts/privacy/nonprod-data-pipeline.ts \
  --input scripts/privacy/fixtures/restored-snapshot.sample.json \
  --forbidden-identifiers-file scripts/privacy/fixtures/forbidden-production-identifiers.txt \
  --output-dir artifacts/nonprod-data-privacy
```

## Expected outputs

- `artifacts/nonprod-data-privacy/anonymized/**`
- `artifacts/nonprod-data-privacy/verification-report.json`
- `artifacts/nonprod-data-privacy/verification-summary.md`

Use the generated `verification-summary.md` as the release sign-off artifact for staging/dev data privacy checks.
