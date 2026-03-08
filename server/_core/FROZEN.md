# FROZEN — server/_core/

**Status:** Frozen as of Sprint 0 of the ValueOS architectural refactor.

**Decision:** This directory is the legacy root runtime. It is the entry point referenced by the root `package.json` `dev`, `build`, and `start` scripts. It will be deleted in Sprint 2 after `apps/ValyntApp` and `packages/backend` are confirmed as the sole active runtimes.

**Rules while frozen:**
- No new product logic may be added here.
- Bug fixes only, and only if the bug cannot be fixed in the canonical runtime.
- All new development goes to `apps/ValyntApp` (frontend) or `packages/backend` (backend).

**Deletion target:** Sprint 2 (Runtime Unification complete).

**Reference:** ValueOS Refactor Roadmap, Sprint 0, Task 0.1.
