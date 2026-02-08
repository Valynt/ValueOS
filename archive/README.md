# Archive Folder

This folder contains files moved from the root of the ValueOS repository that are not actively referenced by build, compose, scripts, or CI. Files are archived here for safe-keeping and can be restored if needed. Do not delete files from this folder until they have been unused for at least 30 days and a clean build/test cycle has been confirmed.

Criteria for archiving:
- Not referenced by devcontainer.json, compose*.yml, scripts, or .github/workflows
- Not required for build, lint, or test
- Not part of active infra wiring

If you need to restore a file, move it back to the root and update references as needed.

---
Last updated: 2026-02-08
