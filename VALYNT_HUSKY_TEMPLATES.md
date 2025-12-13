# Valynt Standard Husky Hook Templates

**Version:** 1.0.0  
**Last Updated:** 2025-12-13  
**Status:** Production Standard

---

## Overview

Hardened Git hook templates for all Valynt repositories. These hooks enforce:

- Conventional commits (semantic-release compatible)
- Code quality (lint, format, typecheck)
- CI/local parity
- Fast feedback loops

---

## Prerequisites

```bash
npm install -D husky lint-staged @commitlint/cli @commitlint/config-conventional
```

---

## Setup Instructions

### 1. Initialize Husky (v9+)

```bash
npx husky init
```

This creates:

- `.husky/` directory
- `package.json` with `"prepare": "husky"` script

### 2. Install Hook Templates

Copy the templates below into your `.husky/` directory.

---

## Hook Templates

### `.husky/pre-commit`

```sh
# Valynt Standard Pre-commit Hook
# Fast checks only - heavy validation in CI

npx lint-staged
```

**What it does:**

- Runs ESLint with auto-fix on staged files
- Runs Prettier on staged files
- Blocks commit if errors remain

**Make executable:**

```bash
chmod +x .husky/pre-commit
```

---

### `.husky/commit-msg`

```sh
# Valynt Standard Commit Message Hook
# Enforces conventional commits for semantic-release

npx commitlint --edit "$1"
```

**What it does:**

- Validates commit message format
- Enforces conventional commits (feat:, fix:, etc.)
- Aligns with semantic-release

**Make executable:**

```bash
chmod +x .husky/commit-msg
```

---

### `.husky/pre-push` (Optional)

```sh
# Valynt Standard Pre-push Hook
# Additional validation before pushing

npm run typecheck
```

**What it does:**

- Runs TypeScript type checking
- Catches type errors before push
- Optional but recommended

**Make executable:**

```bash
chmod +x .husky/pre-push
```

---

## Configuration Files

### `.commitlintrc.json`

```json
{
  "extends": ["@commitlint/config-conventional"],
  "rules": {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "perf",
        "test",
        "build",
        "ci",
        "chore",
        "revert"
      ]
    ],
    "type-case": [2, "always", "lower-case"],
    "type-empty": [2, "never"],
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "header-max-length": [2, "always", 100],
    "body-leading-blank": [1, "always"],
    "body-max-line-length": [2, "always", 100],
    "footer-leading-blank": [1, "always"]
  }
}
```

**Semantic-release alignment:**

- `feat:` → Minor version bump
- `fix:` → Patch version bump
- `BREAKING CHANGE:` → Major version bump
- Other types → No version bump (included in changelog)

---

### `package.json` - lint-staged

```json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml,yaml}": ["prettier --write"]
  }
}
```

---

### `package.json` - scripts

```json
{
  "scripts": {
    "prepare": "husky",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "typecheck": "tsc --noEmit"
  }
}
```

---

## CI Configuration (GitHub Actions)

### `.github/workflows/ci.yml`

```yaml
name: CI

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]

jobs:
  validate:
    name: Validate
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Required for commitlint

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type Check
        run: npm run typecheck

      - name: Tests
        run: npm test

      - name: Build
        run: npm run build

  commitlint:
    name: Commit Messages
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Validate commit messages
        run: npx commitlint --from ${{ github.event.pull_request.base.sha }} --to ${{ github.event.pull_request.head.sha }} --verbose
```

---

## Commit Message Format

### Structure

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types (Semantic-release)

| Type       | Description             | Version Bump | Changelog |
| ---------- | ----------------------- | ------------ | --------- |
| `feat`     | New feature             | Minor        | ✅ Yes    |
| `fix`      | Bug fix                 | Patch        | ✅ Yes    |
| `docs`     | Documentation           | None         | ✅ Yes    |
| `style`    | Code style (formatting) | None         | ✅ Yes    |
| `refactor` | Code refactoring        | None         | ✅ Yes    |
| `perf`     | Performance improvement | Patch        | ✅ Yes    |
| `test`     | Tests                   | None         | ✅ Yes    |
| `build`    | Build system            | None         | ✅ Yes    |
| `ci`       | CI configuration        | None         | ✅ Yes    |
| `chore`    | Maintenance             | None         | ✅ Yes    |
| `revert`   | Revert previous commit  | None         | ✅ Yes    |

### Breaking Changes

```
feat: allow provided config object to extend other configs

BREAKING CHANGE: `extends` key in config file is now used for extending other config files
```

**Result:** Major version bump

### Examples

**Feature:**

```
feat(auth): add OAuth2 authentication

Implements OAuth2 flow with Google and GitHub providers.
Includes token refresh and session management.

Closes #123
```

**Bug Fix:**

```
fix(api): handle null response from external service

Previously would throw unhandled exception.
Now returns graceful error message.

Fixes #456
```

**Breaking Change:**

```
refactor(api): change response format

BREAKING CHANGE: API responses now use camelCase instead of snake_case

Migration guide: https://docs.example.com/migration
```

---

## Local vs CI Parity

### Local (Husky Hooks)

**pre-commit:**

- ✅ Lint (with auto-fix)
- ✅ Format (with auto-fix)
- ❌ Type check (too slow)
- ❌ Tests (too slow)
- ❌ Build (too slow)

**commit-msg:**

- ✅ Commit message format

**pre-push (optional):**

- ✅ Type check

### CI (GitHub Actions)

**Always runs:**

- ✅ Lint (no auto-fix)
- ✅ Type check
- ✅ Tests
- ✅ Build
- ✅ Commit message validation (PRs only)

### Philosophy

**Local:** Fast feedback, auto-fix when possible  
**CI:** Comprehensive validation, no auto-fix, blocks merge

---

## Troubleshooting

### "sh: 0: Illegal option --"

**Cause:** Using deprecated Husky patterns with `husky.sh` sourcing

**Fix:** Remove these lines from hooks:

```sh
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
```

Modern Husky v9+ doesn't need them.

---

### "husky - DEPRECATED"

**Cause:** Using old Husky patterns

**Fix:** Ensure hooks are plain shell scripts without sourcing `husky.sh`

---

### Hooks not running

**Cause:** Not executable

**Fix:**

```bash
chmod +x .husky/pre-commit
chmod +x .husky/commit-msg
chmod +x .husky/pre-push
```

---

### Commitlint fails in CI

**Cause:** Missing commit history

**Fix:** Ensure `fetch-depth: 0` in checkout action:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
```

---

## Installation Script

Create `scripts/setup-hooks.sh`:

```bash
#!/bin/bash
set -e

echo "Setting up Valynt standard Git hooks..."

# Install dependencies
npm install -D husky lint-staged @commitlint/cli @commitlint/config-conventional

# Initialize Husky
npx husky init

# Create pre-commit hook
cat > .husky/pre-commit << 'EOF'
# Valynt Standard Pre-commit Hook
# Fast checks only - heavy validation in CI

npx lint-staged
EOF
chmod +x .husky/pre-commit

# Create commit-msg hook
cat > .husky/commit-msg << 'EOF'
# Valynt Standard Commit Message Hook
# Enforces conventional commits for semantic-release

npx commitlint --edit "$1"
EOF
chmod +x .husky/commit-msg

# Create commitlint config
cat > .commitlintrc.json << 'EOF'
{
  "extends": ["@commitlint/config-conventional"],
  "rules": {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "perf",
        "test",
        "build",
        "ci",
        "chore",
        "revert"
      ]
    ],
    "type-case": [2, "always", "lower-case"],
    "type-empty": [2, "never"],
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "header-max-length": [2, "always", 100],
    "body-leading-blank": [1, "always"],
    "body-max-line-length": [2, "always", 100],
    "footer-leading-blank": [1, "always"]
  }
}
EOF

# Add lint-staged config to package.json if not exists
if ! grep -q "lint-staged" package.json; then
  echo "Adding lint-staged config to package.json..."
  npm pkg set 'lint-staged.*.{ts,tsx,js,jsx}[0]'="eslint --fix"
  npm pkg set 'lint-staged.*.{ts,tsx,js,jsx}[1]'="prettier --write"
  npm pkg set 'lint-staged.*.{json,md,yml,yaml}[0]'="prettier --write"
fi

echo "✅ Valynt standard Git hooks installed successfully!"
echo ""
echo "Test with:"
echo "  git commit --allow-empty -m 'test: verify hooks'"
```

**Usage:**

```bash
chmod +x scripts/setup-hooks.sh
./scripts/setup-hooks.sh
```

---

## Verification Checklist

### Local Setup

- [ ] Husky v9+ installed
- [ ] `.husky/pre-commit` exists and is executable
- [ ] `.husky/commit-msg` exists and is executable
- [ ] `.commitlintrc.json` exists
- [ ] `lint-staged` configured in package.json
- [ ] `"prepare": "husky"` in package.json scripts
- [ ] No deprecated patterns (no `husky.sh` sourcing)

### Test Hooks

```bash
# Test pre-commit
echo "test" >> test.txt
git add test.txt
git commit -m "test: verify pre-commit"
# Should run lint-staged

# Test commit-msg (invalid)
git commit --allow-empty -m "bad format"
# Should fail

# Test commit-msg (valid)
git commit --allow-empty -m "test: valid format"
# Should succeed
```

### CI Setup

- [ ] `.github/workflows/ci.yml` exists
- [ ] Runs lint, typecheck, tests, build
- [ ] Validates commit messages on PRs
- [ ] Uses `fetch-depth: 0` for commitlint
- [ ] Blocks merge on failure

---

## Maintenance

### Updating Across Repos

1. Update this template document
2. Increment version number
3. Distribute to all Valynt repos
4. Run setup script in each repo

### Version History

- **1.0.0** (2025-12-13) - Initial hardened template
  - Modern Husky v9+ patterns
  - Semantic-release alignment
  - CI/local parity
  - No deprecated patterns

---

## Support

**Questions?** Contact DevOps team  
**Issues?** Create ticket in ops repo  
**Updates?** Check this template quarterly

---

**Last Updated:** 2025-12-13 06:30 UTC  
**Template Version:** 1.0.0  
**Status:** Production Standard for All Valynt Repos
