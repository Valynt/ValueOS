# jsPDF Readiness Blocker Resolution Artifact

- **Generated at (UTC):** 2026-04-08
- **Finding:** `jsPDF HTML injection` blocker
- **Status:** Resolved
- **Remediation version:** `jspdf@4.2.1`

## Anchor evidence

### 1) `apps/ValyntApp/package.json` dependency anchor

Command:
```bash
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('apps/ValyntApp/package.json','utf8'));console.log(p.dependencies.jspdf);"
```

Observed output:
```text
^4.2.1
```

### 2) `pnpm-lock.yaml` resolution anchors for `jspdf@4.2.1`

Command:
```bash
rg -n "jspdf@4\\.2\\.1|jspdf:" pnpm-lock.yaml | sed -n '1,20p'
```

Observed output:
```text
19:  jspdf: ^4.2.1
467:      jspdf:
1070:      jspdf:
8033:  jspdf@4.2.1:
16375:      jspdf: 4.2.1
19872:  jspdf@4.2.1:
```

### 3) CI policy proof (`jspdf@4.2.0` forbidden)

Command:
```bash
node scripts/ci/check-jspdf-version-policy.mjs
```

Observed output:
```text
Dependency policy check passed: no jspdf@4.2.0 lockfile resolutions detected.
```

## Fresh dependency scan attempt (workspace)

Command:
```bash
pnpm audit --json
```

Observed output (saved to `docs/release/artifacts/dependency-scan-2026-04-08.json`):
```json
{
  "error": {
    "code": "ERR_PNPM_AUDIT_BAD_RESPONSE",
    "message": "The audit endpoint (at https://registry.npmjs.org/-/npm/v1/security/audits) responded with 403: Method forbidden"
  }
}
```

Result: `pnpm audit` endpoint response prevents full advisory refresh in this environment; blocker remediation evidence above remains valid from manifest + lock + policy checks.
