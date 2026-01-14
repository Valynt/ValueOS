# Final Root Cleanup Plan

This plan executes the Structural Debt Audit recommendations to reduce the root directory from 19 to 12 items by consolidating configurations, merging tooling, and removing build artifacts.

## Phase 1: Build Artifact Cleanup

- Delete `playwright-report/` (build artifact)
- Delete `test-results/` (build artifact)
- Delete `dist/` (build artifact)
- Verify `node_modules/` is already ignored

## Phase 2: Configuration Consolidation

- Move `.roomodes` → `.config/roomodes`
- Move `.windsurf/` → `.config/windsurf/`
- Move `configs/` contents → `.config/configs/`
- Update any configuration path references

## Phase 3: Tooling Consolidation

- Move `bin/` → `scripts/bin/`
- Move `tools/` → `scripts/tools/`
- Update PATH references in documentation
- Update tool import paths if needed

## Phase 4: Critical Path Verification & Reference Updates

### 4.1: CWD (Current Working Directory) Issues

- Update package.json scripts to use absolute-style paths: `--config .config/configs/vitest.config.ts`
- Test all npm scripts with new config paths
- Verify Docker compose files find their configurations

### 4.2: IDE Extension Breakage Prevention

- Update `.vscode/settings.json` with new config paths:
  - ESLint: `"eslint.options": { "configFile": ".config/configs/eslint.config.js" }`
  - Tailwind: `"tailwindCSS.experimental.configFile": ".config/configs/tailwind.config.js"`
- Test VS Code extensions recognize moved configs

### 4.3: Binary Pathing Updates

- Update `.devcontainer` scripts to use `scripts/bin/` paths
- Check CI/CD YAML files for `./bin/` references
- Update any documentation referencing old binary paths

### 4.4: Final Reference Sweep

- Update all package.json config flags to use `.config/configs/`
- Update AI/IDE settings for moved `.roomodes` and `.windsurf/`
- Verify symlink or PATH updates if needed

## Phase 5: Final Verification

- Count root items (target: 12)
- Test critical npm scripts
- Verify git status shows expected changes

## Expected Outcome

- Root directory reduced from 19 to 12 items (37% reduction)
- All configurations consolidated under `.config/`
- All tooling consolidated under `scripts/`
- Clean developer discovery path with minimal distractions

## The "Elite 12" Final Root Structure

1. `.config/` (The engine room)
2. `.github/` (The automation)
3. `.vscode/` (The workspace)
4. `docs/` (The brain)
5. `infra/` (The foundation)
6. `scripts/` (The hands)
7. `src/` (The heart)
8. `tests/` (The shield)
9. `.gitignore`
10. `package.json`
11. `README.md`
12. `LICENSE`

## Architectural Verdict

This structure signals **Senior-level discipline** with a focused discovery path centered on the **Product** (`src/`) and **Instructions** (`README.md` and `docs/`).
