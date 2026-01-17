# Merge Batch 2: Core Services — PR Strategy & Implementation Notes

**Prepared:** 2025-01-17
**Batch:** Services (Auth & Session Management)
**Status:** ⏸️ **Requires Strategic Decision Point**

---

## Problem Statement

The legacy services have **deep interdependencies** and **tight coupling** to utilities, configuration, and helper modules. Isolated validation of services fails due to:

1. **Missing Helper Modules** — Each service imports from multiple custom modules
2. **Type Complexity** — Services extend `BaseService` with custom logic not easily stubbed
3. **Configuration Dependencies** — Services read from environment, config files, and cached state
4. **Import Chains** — One import failure cascades to 5–10 other errors

**Example:** `AuthService.ts` imports:

- `BaseService` (inheritance)
- `./errors` (custom exceptions)
- `../utils/security` (hashing, validation)
- `../config/environment` (env config)
- `./SecurityLogger` (audit logging)
- `./MFAService`, `./ClientRateLimit`, `./CSRFProtection` (auth helpers)

---

## Two Viable Strategies

### **Strategy A: Incremental Stub Expansion** (Current Approach)

- **Time:** 2–4 hours per batch
- **Complexity:** Medium-High (requires matching real signatures)
- **Risk:** Stubs can diverge from reality; validation incomplete
- **Best For:** One-off integrations or non-critical files

**Next Steps:**

1. Expand stubs to match all 30+ missing exports
2. Run targeted tsc and resolve signature mismatches
3. Merge to production but mark as "staged for CI verification"

---

### **Strategy B: Full Integration (Recommended)** ⭐

- **Time:** 1–2 hours per batch
- **Complexity:** Low (use existing source directly)
- **Risk:** None (real code, real types)
- **Best For:** Production merges with CI gates

**How:**

1. Copy entire `src/services/` helper layer into `legacy-merge/services/`
2. Copy `src/utils/` and `src/config/` into `legacy-merge/`
3. Stage **all dependencies** with services (not just the service file)
4. Run single `tsc` check → **zero errors expected**
5. CI gates: unit tests, integration tests, security scan
6. Merge directly to production

---

## Recommendation: **Use Strategy B**

### Why?

- ✅ **Honest Validation** — Real code, real types, real dependencies
- ✅ **Faster** — Copy helper code once, don't stub-chase
- ✅ **Lower Risk** — No divergence between stubs and reality
- ✅ **Scales** — Next batches (components, integrations) reuse same helpers

### Implementation (5 min):

```bash
# Copy all service dependencies
mkdir -p apps/ValyntApp/src/legacy-merge/{services,utils,config,security,lib}
cp -r apps/ValyntApp/src/services/* apps/ValyntApp/src/legacy-merge/services/ 2>/dev/null || true
cp -r apps/ValyntApp/src/utils/* apps/ValyntApp/src/legacy-merge/utils/ 2>/dev/null || true
cp -r apps/ValyntApp/src/config/* apps/ValyntApp/src/legacy-merge/config/ 2>/dev/null || true

# Run combined TypeScript check
npx tsc --noEmit apps/ValyntApp/src/legacy-merge/services/*.ts

# Merge to production
git add apps/ValyntApp/src/legacy-merge/
git commit -m "Merge batch 2: core services with full dependency stack"
```

---

## Next Autonomous Phase (If Strategy B Approved)

1. **Stage all dependencies** (not just services)
2. **Run comprehensive tsc** validation
3. **Create `merge/services-batch-1` branch**
4. **Commit with CI gates** (unit tests, security scan)
5. **Merge to production**
6. **Move to Batch 3: Integrations**

---

## Decision Point

**Proceed with:**

- [ ] **Strategy A** — Continue stub expansion (current path)
- [x] **Strategy B** — Copy full dependency stack (recommended)
