# Contributing to ValueCanvas

Thank you for your interest in contributing to ValueCanvas! This document provides guidelines and instructions for contributing to the project.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Code Standards](#code-standards)
5. [Testing Guidelines](#testing-guidelines)
6. [Commit Convention](#commit-convention)
7. [Pull Request Process](#pull-request-process)
8. [Documentation](#documentation)
9. [Issue Reporting](#issue-reporting)

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors. We expect all participants to:

- Be respectful and considerate
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards other community members

### Unacceptable Behavior

- Harassment, discrimination, or offensive comments
- Trolling, insulting, or derogatory remarks
- Publishing others' private information
- Any conduct that could be considered inappropriate in a professional setting

---

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- Node.js 18+ and npm installed
- Docker Desktop (for local Supabase)
- Supabase CLI installed
- Git configured with your name and email
- A GitHub account

### Setting Up Your Development Environment

1. **Fork the repository** on GitHub

2. **Clone your fork:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/ValueCanvas.git
   cd ValueCanvas
   ```

3. **Add upstream remote:**
   ```bash
   git remote add upstream https://github.com/bmsull560/ValueCanvas.git
   ```

4. **Install dependencies:**
   ```bash
   npm install
   ```

5. **Set up environment:**
   ```bash
   cp .env.local .env
   # Edit .env and add your LLM API key
   ```

6. **Start development environment:**
   ```bash
   ./start.sh
   ```

7. **Verify setup:**
   ```bash
   npm test
   npm run lint
   ```

---

## Development Workflow

### Creating a Feature Branch

Always create a new branch for your work:

```bash
# Update your main branch
git checkout main
git pull upstream main

# Create a feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

### Branch Naming Convention

Use descriptive branch names with prefixes:

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions or updates
- `chore/` - Maintenance tasks

Examples:
- `feature/add-export-functionality`
- `fix/resolve-memory-leak`
- `docs/update-api-documentation`

### Making Changes

1. **Write code** following our [Code Standards](#code-standards)
2. **Add tests** for new functionality
3. **Update documentation** as needed
4. **Run tests** to ensure nothing breaks
5. **Run linting** to check code style

```bash
# Run tests
npm test

# Run linting
npm run lint

# Fix linting issues automatically
npm run lint -- --fix
```

### Keeping Your Branch Updated

Regularly sync with upstream:

```bash
git fetch upstream
git rebase upstream/main
```

---

## Code Standards

### TypeScript Guidelines

1. **Use TypeScript strict mode** - No `any` types without justification
2. **Define proper interfaces** - Create types for all data structures
3. **Use type guards** - Validate runtime types when necessary
4. **Avoid type assertions** - Use type narrowing instead

**Good:**
```typescript
interface User {
  id: string;
  name: string;
  email: string;
}

function getUser(id: string): User | null {
  // Implementation
}
```

**Bad:**
```typescript
function getUser(id: string): any {
  // Implementation
}
```

### React Guidelines

1. **Use functional components** - No class components
2. **Use hooks properly** - Follow Rules of Hooks
3. **Optimize performance** - Use React.memo, useMemo, useCallback when appropriate
4. **Handle errors** - Use error boundaries for component errors

**Good:**
```typescript
export const MyComponent: React.FC<Props> = ({ data }) => {
  const processedData = useMemo(() => expensiveOperation(data), [data]);
  
  return <div>{processedData}</div>;
};
```

### Code Style

1. **Use named exports** - Avoid default exports
2. **Use arrow functions** - For consistency
3. **Use const** - Prefer const over let
4. **Use template literals** - For string interpolation
5. **Use destructuring** - For cleaner code

**Good:**
```typescript
export const calculateTotal = (items: Item[]): number => {
  const total = items.reduce((sum, item) => sum + item.price, 0);
  return total;
};
```

### File Organization

1. **Co-locate related files** - Keep tests next to source files
2. **Use index files** - For clean imports
3. **Group by feature** - Not by file type
4. **Keep files small** - Target <500 lines per file

```
src/
├── components/
│   ├── Agent/
│   │   ├── CommandBar.tsx
│   │   ├── CommandBar.test.tsx
│   │   └── index.ts
```

### Naming Conventions

- **Components:** PascalCase (`MyComponent.tsx`)
- **Hooks:** camelCase with `use` prefix (`useMyHook.ts`)
- **Services:** PascalCase (`MyService.ts`)
- **Utilities:** camelCase (`myUtility.ts`)
- **Types:** PascalCase (`MyType.ts`)
- **Constants:** UPPER_SNAKE_CASE (`MY_CONSTANT`)

---

## Testing Guidelines

### Test Requirements

All new features must include tests:

1. **Unit tests** - For individual functions and utilities
2. **Component tests** - For React components
3. **Integration tests** - For service interactions
4. **E2E tests** - For critical user workflows (when applicable)

### Writing Tests

Use Vitest and Testing Library:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('handles user interaction', async () => {
    const { user } = render(<MyComponent />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('Clicked')).toBeInTheDocument();
  });
});
```

### Test Coverage

- Aim for **>80% code coverage**
- Focus on critical paths and edge cases
- Don't test implementation details
- Test behavior, not internals

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test -- --coverage

# Run specific test file
npm test src/components/MyComponent.test.tsx
```

---

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, etc.)
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks
- `perf` - Performance improvements
- `ci` - CI/CD changes
- `build` - Build system changes

### Examples

```bash
# Feature
git commit -m "feat(agents): Add CoordinatorAgent for task planning"

# Bug fix
git commit -m "fix(ui): Resolve memory leak in Canvas component"

# Documentation
git commit -m "docs(readme): Update installation instructions"

# Breaking change
git commit -m "feat(api): Change authentication flow

BREAKING CHANGE: Authentication now requires OAuth2"
```

### Commit Guidelines

1. **Use imperative mood** - "Add feature" not "Added feature"
2. **Keep subject line short** - Max 72 characters
3. **Capitalize subject line** - Start with capital letter
4. **No period at end** - Don't end subject with period
5. **Separate subject from body** - Use blank line
6. **Explain what and why** - Not how (code shows how)

---

## Pull Request Process

### Before Submitting

1. **Update your branch** with latest upstream changes
2. **Run all tests** and ensure they pass
3. **Run linting** and fix any issues
4. **Update documentation** if needed
5. **Add tests** for new functionality
6. **Review your changes** carefully

### Creating a Pull Request

1. **Push your branch** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Open a Pull Request** on GitHub

3. **Fill out the PR template** with:
   - Clear description of changes
   - Related issue numbers
   - Testing performed
   - Screenshots (if UI changes)
   - Breaking changes (if any)

### PR Title Format

Follow commit convention for PR titles:

```
feat(agents): Add CoordinatorAgent for task planning
fix(ui): Resolve memory leak in Canvas component
docs(readme): Update installation instructions
```

### PR Description Template

```markdown
## Description
Brief description of what this PR does.

## Related Issues
Fixes #123
Relates to #456

## Changes Made
- Added new feature X
- Fixed bug Y
- Updated documentation Z

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed
- [ ] All tests passing

## Screenshots (if applicable)
[Add screenshots here]

## Breaking Changes
None / [Describe breaking changes]

## Checklist
- [ ] Code follows project style guidelines
- [ ] Tests added for new functionality
- [ ] Documentation updated
- [ ] All tests passing
- [ ] No console.log statements
- [ ] No TypeScript errors
```

### Review Process

1. **Automated checks** run on your PR:
   - Tests must pass
   - Linting must pass
   - Build must succeed

2. **Code review** by maintainers:
   - At least one approval required
   - Address all review comments
   - Make requested changes

3. **Merge** when approved:
   - Squash merge preferred
   - Clean commit history
   - Delete branch after merge

### Addressing Review Comments

```bash
# Make changes based on feedback
git add .
git commit -m "refactor: Address review comments"
git push origin feature/your-feature-name
```

---

## Documentation

### Documentation Requirements

Update documentation when:

- Adding new features
- Changing existing behavior
- Adding new APIs or services
- Modifying configuration
- Changing deployment process

### Documentation Types

1. **Code Comments**
   - JSDoc for public APIs
   - Inline comments for complex logic
   - Explain "why" not "what"

2. **README Files**
   - Update main README.md
   - Add README in new directories
   - Keep examples up to date

3. **API Documentation**
   - Document all public APIs
   - Include examples
   - Specify types and parameters

4. **Architecture Docs**
   - Create ADRs for significant decisions
   - Update architecture diagrams
   - Document design patterns

### Documentation Style

```typescript
/**
 * Calculate the total value of items in the cart.
 * 
 * This function applies discounts and taxes based on the user's
 * location and membership status.
 * 
 * @param items - Array of cart items
 * @param userId - User ID for discount calculation
 * @returns Total value including taxes and discounts
 * 
 * @example
 * ```typescript
 * const total = calculateTotal(cartItems, 'user-123');
 * console.log(total); // 99.99
 * ```
 */
export const calculateTotal = (
  items: CartItem[],
  userId: string
): number => {
  // Implementation
};
```

---

## Issue Reporting

### Before Creating an Issue

1. **Search existing issues** - Check if already reported
2. **Check documentation** - Ensure it's not a usage issue
3. **Verify the bug** - Reproduce in clean environment
4. **Gather information** - Collect relevant details

### Bug Report Template

```markdown
## Bug Description
Clear description of the bug.

## Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. See error

## Expected Behavior
What should happen.

## Actual Behavior
What actually happens.

## Environment
- OS: [e.g., macOS 13.0]
- Browser: [e.g., Chrome 120]
- Node.js: [e.g., 18.17.0]
- ValueCanvas version: [e.g., 0.0.0]

## Screenshots
[Add screenshots if applicable]

## Additional Context
Any other relevant information.
```

### Feature Request Template

```markdown
## Feature Description
Clear description of the proposed feature.

## Use Case
Why is this feature needed? What problem does it solve?

## Proposed Solution
How should this feature work?

## Alternatives Considered
What other approaches did you consider?

## Additional Context
Any other relevant information.
```

---

## Questions?

If you have questions about contributing:

1. **Check documentation** - See README.md and other docs
2. **Search issues** - Someone may have asked before
3. **Ask in discussions** - Use GitHub Discussions
4. **Contact maintainers** - Open an issue for clarification

---

## Recognition

Contributors will be recognized in:

- GitHub contributors list
- Release notes
- Project documentation

Thank you for contributing to ValueCanvas! 🎉

---

**Last Updated:** November 21, 2024  
**Version:** 1.0
