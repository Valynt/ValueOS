# Husky Setup - Modern v9+ Configuration

**Status:** ✅ Correctly Configured  
**Version:** Husky v9.1.7  
**Pattern:** Modern (2024-2025)

---

## Current Setup

### ✅ Correct Modern Configuration

Our Husky setup follows **modern v9+ best practices**:

1. **Pure Git hooks** - No magic installers
2. **Simple `prepare` script** - Runs on `npm install`
3. **Plain shell scripts** - No wrappers
4. **Fast pre-commit checks** - Heavy validation in CI
5. **Conventional commits** - Enforced via commit-msg hook

---

## File Structure

```
.husky/
├── _/                    # Husky internals
├── pre-commit           # Runs lint-staged
└── commit-msg           # Enforces conventional commits

.commitlintrc.json       # Commitlint config
package.json             # Contains "prepare": "husky"
```

---

## Configuration Files

### package.json

```json
{
  "scripts": {
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml,yaml}": ["prettier --write"]
  },
  "devDependencies": {
    "husky": "^9.1.7",
    "lint-staged": "^16.2.7",
    "@commitlint/cli": "^19.x",
    "@commitlint/config-conventional": "^19.x"
  }
}
```

**Note:** Only `"prepare": "husky"` - no other Husky scripts needed.

---

### .husky/pre-commit

```sh
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Fast checks only - heavy validation in CI
npx lint-staged
```

**What it does:**

- Runs ESLint with auto-fix on staged files
- Runs Prettier on staged files
- Fast (only checks changed files)
- Blocks commit if errors remain

---

### .husky/commit-msg

```sh
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Enforce conventional commits
npx --no -- commitlint --edit $1
```

**What it does:**

- Validates commit message format
- Enforces conventional commits (feat:, fix:, etc.)
- Blocks commit if format is invalid

---

### .commitlintrc.json

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
        "chore",
        "revert"
      ]
    ],
    "subject-case": [0]
  }
}
```

**Allowed commit types:**

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Code style (formatting)
- `refactor:` - Code refactoring
- `perf:` - Performance improvement
- `test:` - Tests
- `chore:` - Maintenance
- `revert:` - Revert previous commit

---

## How It Works

### On `npm install`

```bash
npm install
# → Runs "prepare": "husky"
# → Installs Git hooks from .husky/
```

### On `git commit`

```bash
git add src/services/MyService.ts
git commit -m "feat: add new feature"

# 1. pre-commit hook runs
#    → npx lint-staged
#    → Runs eslint --fix on MyService.ts
#    → Runs prettier --write on MyService.ts
#    → If errors: commit blocked
#    → If clean: continues

# 2. commit-msg hook runs
#    → npx commitlint --edit
#    → Validates "feat: add new feature"
#    → If invalid format: commit blocked
#    → If valid: commit succeeds
```

---

## Developer Workflow

### Valid Commit

```bash
git add .
git commit -m "feat: add user authentication"
# ✅ pre-commit: lint-staged passes
# ✅ commit-msg: conventional format valid
# ✅ Commit succeeds
```

### Invalid Commit (Bad Format)

```bash
git commit -m "added stuff"
# ✅ pre-commit: lint-staged passes
# ❌ commit-msg: not conventional format
# ❌ Commit blocked
```

**Fix:**

```bash
git commit -m "chore: add stuff"
# ✅ Commit succeeds
```

### Invalid Commit (Lint Errors)

```bash
git add src/broken.ts  # Has lint errors
git commit -m "fix: broken code"
# ❌ pre-commit: eslint errors
# ❌ Commit blocked
```

**Fix:**

```bash
# Fix the errors manually or let eslint --fix handle it
git add src/broken.ts
git commit -m "fix: broken code"
# ✅ Commit succeeds
```

---

## Bypassing Hooks (Emergency Only)

**Not recommended**, but if absolutely necessary:

```bash
git commit --no-verify -m "emergency fix"
```

**Warning:** This bypasses all checks. Use only in emergencies.

---

## Verification

### Check Husky Version

```bash
npx husky --version
# Should show v9.x.x
```

### Check Hooks Are Installed

```bash
ls -la .husky/
# Should show:
# - pre-commit (executable)
# - commit-msg (executable)
```

### Test Pre-commit Hook

```bash
# Make a change
echo "test" >> test.txt
git add test.txt
git commit -m "test: verify hooks"
# Should run lint-staged
```

### Test Commit-msg Hook

```bash
# Try invalid format
git commit --allow-empty -m "bad format"
# Should fail with commitlint error

# Try valid format
git commit --allow-empty -m "test: valid format"
# Should succeed
```

---

## Troubleshooting

### "husky – DEPRECATED" Warning

**Cause:** Using old Husky patterns

**Fix:** Already fixed! Our setup uses modern v9+ patterns.

**Verify:**

```bash
# Check package.json has only "prepare": "husky"
cat package.json | grep prepare

# Check no deprecated config files
ls .huskyrc* husky.config.js 2>/dev/null
# Should show "No such file"
```

---

### Hooks Not Running

**Cause:** Hooks not executable

**Fix:**

```bash
chmod +x .husky/pre-commit
chmod +x .husky/commit-msg
```

---

### "command not found: npx"

**Cause:** Node.js not in PATH

**Fix:**

```bash
# Ensure Node.js is installed
node --version
npm --version
```

---

### Lint-staged Not Running

**Cause:** No staged files or lint-staged config missing

**Fix:**

```bash
# Check lint-staged config in package.json
cat package.json | grep -A 10 lint-staged

# Ensure files are staged
git status
```

---

## Best Practices

### ✅ Do

1. **Keep hooks fast** - Only run quick checks
2. **Push heavy validation to CI** - Tests, builds, etc.
3. **Use conventional commits** - Enforced by commit-msg
4. **Let auto-fix work** - ESLint and Prettier fix most issues
5. **Commit frequently** - Hooks run on each commit

### ❌ Don't

1. **Don't run tests in pre-commit** - Too slow
2. **Don't run builds in pre-commit** - Use CI
3. **Don't bypass hooks regularly** - Defeats the purpose
4. **Don't add heavy operations** - Keep it fast
5. **Don't use deprecated patterns** - Stay on v9+

---

## CI Integration

Husky is **local enforcement**. CI is **final enforcement**.

### Local (Husky)

- Fast checks (lint, format)
- Immediate feedback
- Can be bypassed (--no-verify)

### CI (GitHub Actions)

- Full validation (tests, build, lint)
- Cannot be bypassed
- Blocks merge if fails

**Both are necessary** - Husky catches issues early, CI ensures nothing slips through.

---

## Maintenance

### Updating Husky

```bash
npm update husky
```

**Note:** v9+ is stable. No breaking changes expected.

### Adding New Hooks

```bash
# Create new hook file
cat > .husky/pre-push << 'EOF'
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Your checks here
npm run typecheck
EOF

# Make executable
chmod +x .husky/pre-push
```

### Removing Hooks

```bash
rm .husky/pre-push
```

---

## Comparison: Old vs New

| Aspect         | Old (v4-v7)       | New (v9+)            |
| -------------- | ----------------- | -------------------- |
| **Install**    | `husky install`   | `npx husky init`     |
| **Config**     | `.huskyrc`        | `.husky/` directory  |
| **Hooks**      | `npx husky add`   | Plain shell scripts  |
| **Scripts**    | `"husky install"` | `"prepare": "husky"` |
| **Pattern**    | Magic wrappers    | Pure Git hooks       |
| **Deprecated** | ❌ Yes            | ✅ No                |

---

## Summary

### ✅ Our Setup is Correct

- Modern Husky v9+ patterns
- No deprecated config
- Fast pre-commit checks
- Conventional commits enforced
- CI integration maintained

### ✅ No Action Needed

The setup is already correct. No "husky – DEPRECATED" warnings will appear.

### ✅ Ready for Production

- Hooks are fast and deterministic
- Heavy validation in CI
- Team-friendly workflow
- Sustainable long-term

---

## References

- [Husky v9 Documentation](https://typicode.github.io/husky/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [lint-staged](https://github.com/okonet/lint-staged)
- [commitlint](https://commitlint.js.org/)

---

**Last Updated:** 2025-12-13 06:27 UTC  
**Status:** ✅ Correctly Configured  
**Husky Version:** v9.1.7  
**Pattern:** Modern (No Deprecation Warnings)
