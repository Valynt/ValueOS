---
name: lint-and-format
description: Applies linting and formatting standards with relevant configs and scripts
---

# Lint and Format

This skill provides standardized procedures for applying linting and formatting standards across the ValueOS codebase, ensuring consistent code quality and style.

## When to Run

Run this skill when:
- Before committing code changes
- During CI/CD pipeline validation
- After code generation or refactoring
- Preparing code for code review
- Fixing code style violations

## Linting Standards

### ESLint Configuration

#### Base Configuration (`eslint.config.js`)
```javascript
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import importPlugin from 'eslint-plugin-import'

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
      import: importPlugin
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    rules: {
      // Code quality rules
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-unused-vars': 'off', // Handled by TypeScript
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],

      // React rules
      'react/prop-types': 'off', // Using TypeScript
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Import rules
      'import/order': ['error', {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index'
        ],
        'newlines-between': 'always'
      }],
      'import/no-unresolved': 'error',
      'import/no-cycle': 'error'
    }
  }
]
```

### Custom Rules for ValueOS

#### Business Logic Rules
```javascript
// .eslintrc.js - Additional project rules
module.exports = {
  rules: {
    // Security rules
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',

    // Performance rules
    'react/jsx-no-bind': ['error', {
      ignoreRefs: true,
      allowArrowFunctions: true
    }],

    // Code consistency
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-template': 'error'
  }
}
```

## Formatting Standards

### Prettier Configuration

#### Base Configuration (`.prettierrc`)
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "bracketSameLine": false,
  "arrowParens": "avoid",
  "endOfLine": "lf",
  "quoteProps": "as-needed",
  "jsxSingleQuote": true,
  "overrides": [
    {
      "files": "*.md",
      "options": {
        "printWidth": 80,
        "proseWrap": "preserve"
      }
    },
    {
      "files": "*.json",
      "options": {
        "printWidth": 200
      }
    }
  ]
}
```

#### Prettier Ignore File (`.prettierignore`)
```
# Dependencies
node_modules/
pnpm-lock.yaml

# Build outputs
dist/
build/
.next/
out/

# Generated files
*.generated.ts
*.generated.js

# Logs
*.log

# Coverage
coverage/

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db
```

## Execution Commands

### Manual Linting and Formatting

#### Lint Code Only
```bash
# Lint all files
pnpm lint

# Lint specific files
pnpm lint packages/backend/src/api/users.ts

# Lint with auto-fix
pnpm lint:fix

# Lint TypeScript only
pnpm lint:ts

# Lint with detailed output
pnpm lint --format=verbose
```

#### Format Code Only
```bash
# Format all files
pnpm format

# Format specific files
pnpm format packages/components/src/Button.tsx

# Check formatting without changes
pnpm format:check

# Format with custom config
pnpm format --config .prettierrc.custom.json
```

#### Combined Lint and Format
```bash
# Run both linting and formatting
pnpm quality

# Fix both automatically where possible
pnpm quality:fix

# Check quality gates
pnpm quality:check
```

### CI/CD Integration

#### GitHub Actions Workflow
```yaml
name: Code Quality
on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18.17.0'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Check formatting
        run: pnpm format:check

      - name: Run linter
        run: pnpm lint

      - name: Type check
        run: pnpm type-check
```

### Pre-commit Hooks

#### Husky Configuration
```javascript
// .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Run quality checks
pnpm quality:check

# Format staged files
pnpm format:staged
```

## Configuration Files

### Package.json Scripts
```json
{
  "scripts": {
    "lint": "eslint . --ext .ts,.tsx,.js,.jsx",
    "lint:fix": "eslint . --ext .ts,.tsx,.js,.jsx --fix",
    "lint:ts": "eslint . --ext .ts,.tsx",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "format:staged": "pretty-quick --staged",
    "quality": "pnpm lint && pnpm format:check",
    "quality:fix": "pnpm lint:fix && pnpm format",
    "quality:check": "pnpm lint && pnpm format:check && pnpm type-check",
    "type-check": "tsc --noEmit"
  }
}
```

### VS Code Integration

#### Settings (`.vscode/settings.json`)
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  },
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ]
}
```

## Rule Categories

### Code Quality Rules

#### Error Prevention
- **no-console**: Prevent console statements in production
- **no-debugger**: Prevent debugger statements
- **no-eval**: Prevent dangerous eval usage
- **no-implied-eval**: Prevent indirect eval usage

#### TypeScript Rules
- **@typescript-eslint/no-unused-vars**: Catch unused variables
- **@typescript-eslint/explicit-function-return-type**: Require return types
- **@typescript-eslint/no-explicit-any**: Prevent any type usage
- **@typescript-eslint/prefer-nullish-coalescing**: Use ?? over ||

#### React Rules
- **react-hooks/rules-of-hooks**: Enforce hooks rules
- **react-hooks/exhaustive-deps**: Check dependency arrays
- **react/jsx-key**: Require key props in iterators
- **react/prop-types**: Validate prop types (when not using TS)

### Code Style Rules

#### Import Organization
- **import/order**: Consistent import grouping
- **import/no-unresolved**: Validate import paths
- **import/no-cycle**: Prevent circular dependencies
- **import/no-duplicates**: Remove duplicate imports

#### Code Structure
- **prefer-const**: Use const over let when possible
- **no-var**: Prevent var usage
- **object-shorthand**: Use shorthand object notation
- **prefer-template**: Use template literals over concatenation

## Auto-fixing Strategies

### ESLint Auto-fixable Rules
```bash
# Fix import order
pnpm lint:fix --rule 'import/order'

# Fix spacing issues
pnpm lint:fix --rule 'indent,no-trailing-spaces'

# Fix React issues
pnpm lint:fix --rule 'react/jsx-uses-react,react/jsx-uses-vars'
```

### Prettier Formatting
```bash
# Format specific file types
pnpm format "**/*.{ts,tsx,js,jsx,json,md}"

# Format with custom parser
pnpm format --parser typescript

# Format ignoring errors
pnpm format --ignore-errors
```

## Quality Gates

### CI/CD Quality Checks
- [ ] ESLint passes with zero errors
- [ ] Prettier formatting check passes
- [ ] TypeScript compilation succeeds
- [ ] Import organization validated
- [ ] No console statements in production code

### Pre-commit Quality Gates
- [ ] Staged files pass linting
- [ ] Staged files are formatted
- [ ] TypeScript types are valid
- [ ] No syntax errors

### Code Review Quality Gates
- [ ] Code follows established patterns
- [ ] Linting rules are followed
- [ ] Formatting is consistent
- [ ] Documentation is updated
- [ ] Tests are included for new code

## Troubleshooting

### Common ESLint Issues

#### Parsing Errors
```bash
# Check TypeScript configuration
pnpm tsc --noEmit --skipLibCheck

# Validate ESLint config
pnpm eslint --print-config packages/backend/src/index.ts
```

#### Performance Issues
```bash
# Use cache for faster runs
pnpm lint --cache

# Lint specific directories to isolate issues
pnpm lint packages/backend/
```

#### False Positives
```javascript
// Disable specific rules for valid cases
/* eslint-disable @typescript-eslint/no-explicit-any */
const value: any = getDynamicValue()
/* eslint-enable @typescript-eslint/no-explicit-any */
```

### Prettier Issues

#### Inconsistent Formatting
```bash
# Clear Prettier cache
rm -rf node_modules/.cache/prettier

# Reinstall dependencies
pnpm install
```

#### Large File Performance
```json
{
  "overrides": [
    {
      "files": "*.min.js",
      "options": {
        "parser": "babel"
      }
    }
  ]
}
```

## Integration with Development Workflow

### IDE Extensions
- **ESLint**: `dbaeumer.vscode-eslint`
- **Prettier**: `esbenp.prettier-vscode`
- **Format Code Action**: `ms-vscode.vscode-json`

### Git Integration
```bash
# Configure Git to use specific formatters
git config --global core.autocrlf input

# Set up clean/smudge filters for automatic formatting
echo "*.{js,ts,tsx,json,md} filter=prettier" >> .gitattributes
```

### Team Standards
- **Commit Message Format**: Conventional commits
- **Branch Naming**: feature/, bugfix/, hotfix/
- **PR Template**: Includes quality checklist
- **Code Review Process**: Automated quality checks required

## Maintenance

### Regular Updates
```bash
# Update ESLint and plugins monthly
pnpm update eslint @typescript-eslint/eslint-plugin

# Update Prettier quarterly
pnpm update prettier

# Review and update rules annually
# Audit rule effectiveness and adjust as needed
```

### Rule Customization
- **Add Rules**: For new patterns or issues
- **Remove Rules**: If causing more harm than good
- **Adjust Severity**: Warning vs Error based on impact
- **Create Custom Rules**: For project-specific patterns

This comprehensive linting and formatting approach ensures consistent, maintainable code across the entire ValueOS codebase.
