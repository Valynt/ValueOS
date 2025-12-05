# Pre-Commit Hooks Guide

## Overview

Pre-commit hooks automatically check code quality, security, and formatting before each commit. This ensures consistent code quality across the team and catches issues early.

## Installation

### 1. Install pre-commit

```bash
# Using pip
pip install pre-commit

# Using homebrew (macOS)
brew install pre-commit

# Using npm (alternative)
npm install -g pre-commit
```

### 2. Install hooks

```bash
# Install git hooks
pre-commit install

# Install commit-msg hook
pre-commit install --hook-type commit-msg

# Install pre-push hook
pre-commit install --hook-type pre-push
```

### 3. Verify installation

```bash
pre-commit --version
# Should output: pre-commit 3.x.x
```

## Usage

### Automatic (on commit)

Hooks run automatically when you commit:

```bash
git add .
git commit -m "feat: add new feature"
# Hooks run automatically
```

### Manual (all files)

```bash
# Run all hooks on all files
pre-commit run --all-files

# Run specific hook
pre-commit run eslint --all-files

# Run on specific files
pre-commit run --files src/services/*.ts
```

### Skip hooks (emergency only)

```bash
# Skip all hooks
git commit --no-verify -m "emergency fix"

# Skip specific hook
SKIP=eslint git commit -m "fix: urgent fix"
```

## Hooks Configured

### 1. General File Checks

- **trailing-whitespace**: Remove trailing whitespace
- **end-of-file-fixer**: Ensure files end with newline
- **check-yaml**: Validate YAML syntax
- **check-json**: Validate JSON syntax
- **check-added-large-files**: Prevent large files (>1MB)
- **check-merge-conflict**: Detect merge conflict markers
- **detect-private-key**: Prevent committing private keys
- **no-commit-to-branch**: Prevent direct commits to main/production

### 2. TypeScript/JavaScript

- **eslint**: Lint and auto-fix code
- **tsc**: Type checking
- **prettier**: Format code
- **no-console-log**: Prevent console.log (use logger instead)

### 3. Security

- **detect-secrets**: Scan for secrets and credentials
- **check-env-files**: Prevent sensitive data in .env files

### 4. Documentation

- **markdownlint**: Lint and format Markdown files

### 5. Infrastructure

- **shellcheck**: Lint shell scripts
- **hadolint**: Lint Dockerfiles
- **terraform_fmt**: Format Terraform files
- **terraform_validate**: Validate Terraform configuration

### 6. Database

- **sqlfluff**: Lint and format SQL files

### 7. Custom Checks

- **run-tests**: Run unit tests before commit
- **check-todos**: Warn about TODO comments
- **commit-msg-format**: Validate commit message format
- **check-imports**: Warn about deep relative imports
- **check-hardcoded-urls**: Warn about hardcoded localhost URLs

## Commit Message Format

Commits must follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Test changes
- **chore**: Build process or auxiliary tool changes
- **ci**: CI/CD changes
- **build**: Build system changes
- **revert**: Revert previous commit

### Examples

```bash
# Good
git commit -m "feat(llm): add caching for LLM responses"
git commit -m "fix(auth): resolve token expiration issue"
git commit -m "docs: update API documentation"

# Bad
git commit -m "fixed stuff"
git commit -m "WIP"
git commit -m "asdf"
```

## Troubleshooting

### Hook fails with "command not found"

```bash
# Install missing dependencies
npm install

# Update pre-commit
pre-commit autoupdate
```

### ESLint fails

```bash
# Fix automatically
npm run lint -- --fix

# Or skip if urgent
SKIP=eslint git commit -m "fix: urgent fix"
```

### TypeScript errors

```bash
# Check types
npm run type-check

# Fix errors before committing
```

### Tests fail

```bash
# Run tests locally
npm test

# Fix failing tests before committing
```

### Secrets detected

```bash
# Remove secrets from code
# Use environment variables or AWS Secrets Manager

# Update secrets baseline
detect-secrets scan > .secrets.baseline
```

### Large file detected

```bash
# Remove large file
git rm --cached large-file.zip

# Add to .gitignore
echo "large-file.zip" >> .gitignore

# Use Git LFS for large files
git lfs track "*.zip"
```

## Configuration

### Disable specific hook

Edit `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
        # Disable this hook
        # stages: [manual]
```

### Add custom hook

```yaml
repos:
  - repo: local
    hooks:
      - id: my-custom-hook
        name: My Custom Hook
        entry: ./scripts/my-hook.sh
        language: system
        pass_filenames: false
```

### Update hooks

```bash
# Update all hooks to latest versions
pre-commit autoupdate

# Update specific hook
pre-commit autoupdate --repo https://github.com/pre-commit/pre-commit-hooks
```

## Best Practices

### 1. Run hooks before pushing

```bash
# Run all hooks
pre-commit run --all-files

# Then push
git push
```

### 2. Fix issues incrementally

```bash
# Run specific hook
pre-commit run eslint --all-files

# Fix issues
npm run lint -- --fix

# Commit fixes
git add .
git commit -m "style: fix linting issues"
```

### 3. Keep hooks fast

- Hooks should complete in <30 seconds
- Use `pass_filenames: false` for slow hooks
- Consider moving slow checks to CI/CD

### 4. Document custom hooks

Add comments to `.pre-commit-config.yaml`:

```yaml
# Custom hook to check for console.log
- id: no-console-log
  name: Check for console.log
  # Prevents console.log in production code
  entry: bash -c '...'
```

### 5. Use baseline for secrets

```bash
# Create baseline
detect-secrets scan > .secrets.baseline

# Audit baseline
detect-secrets audit .secrets.baseline

# Update baseline
detect-secrets scan --baseline .secrets.baseline
```

## CI/CD Integration

Pre-commit hooks also run in CI/CD:

```yaml
# .github/workflows/pre-commit.yml
name: Pre-commit

on: [push, pull_request]

jobs:
  pre-commit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - uses: pre-commit/action@v3.0.0
```

## Performance Tips

### 1. Cache dependencies

```bash
# Pre-commit caches dependencies automatically
# Cache location: ~/.cache/pre-commit
```

### 2. Run only on changed files

```bash
# Hooks run only on staged files by default
git add specific-file.ts
git commit -m "fix: update specific file"
# Only specific-file.ts is checked
```

### 3. Skip slow hooks locally

```bash
# Skip tests locally (run in CI instead)
SKIP=run-tests git commit -m "feat: add feature"
```

## Team Guidelines

### 1. Never skip security hooks

```bash
# Never skip these hooks
- detect-secrets
- detect-private-key
- check-env-files
```

### 2. Fix, don't skip

```bash
# Bad
git commit --no-verify -m "fix"

# Good
npm run lint -- --fix
git add .
git commit -m "fix: resolve linting issues"
```

### 3. Update hooks regularly

```bash
# Weekly or monthly
pre-commit autoupdate
git add .pre-commit-config.yaml
git commit -m "chore: update pre-commit hooks"
```

## Metrics

Track hook effectiveness:

```bash
# Count commits with --no-verify
git log --all --grep="--no-verify" --oneline | wc -l

# Count hook failures in CI
# Check CI/CD logs
```

## Support

For issues or questions:
- Documentation: This file
- Slack: #engineering
- Pre-commit docs: https://pre-commit.com/
