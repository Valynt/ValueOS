# Archived Pull Request Status Files

This directory contains historical pull request status and review files that were previously tracked in the repository.

## Purpose

These files documented the status and reviews of pull requests during development. They have been archived as:

1. Pull request information is better tracked in GitHub's native PR system
2. These files created repository bloat
3. The information is historical and not needed for current development

## Archived Files

The following pull request status files have been archived:

- 28_approval.md
- 29_status.md
- 31_status.md
- 33_status.md
- 34_status.md
- 36_status.md
- 37_status.md
- 39_status.md
- 40_status.md
- 41_status.md
- 43_status.md
- 44_reviews.md
- 44_status.md
- 45_status.md
- 48_status.md
- 53_status.md
- 54_status.md
- 57_status.md

## Current Practice

Going forward, all pull request tracking should be done through:

1. **GitHub Pull Requests** - Use GitHub's native PR system for reviews and status
2. **GitHub Projects** - Track PR progress in project boards
3. **GitHub Actions** - Automate PR checks and status updates
4. **Commit Messages** - Reference PR numbers in commit messages (e.g., "feat: Add feature (#123)")

## Accessing Historical PR Information

To view information about these historical pull requests:

1. Visit the repository on GitHub: https://github.com/bmsull560/ValueCanvas
2. Navigate to the "Pull requests" tab
3. Use the search filters to find closed PRs
4. PR numbers correspond to the filenames (e.g., 28_approval.md = PR #28)

## Best Practices for PR Management

### Creating Pull Requests

```bash
# Create a feature branch
git checkout -b feature/my-feature

# Make changes and commit
git add .
git commit -m "feat: Add my feature"

# Push and create PR
git push origin feature/my-feature
gh pr create --title "Add my feature" --body "Description of changes"
```

### PR Review Process

1. **Automated Checks** - CI/CD pipeline runs tests and linting
2. **Code Review** - At least one team member reviews the code
3. **Approval** - PR must be approved before merging
4. **Merge** - Use squash merge for clean history

### PR Templates

Use the PR template in `.github/PULL_REQUEST_TEMPLATE.md` (if available) to ensure consistent PR descriptions.

## Cleanup Rationale

These files were removed from the main repository as part of the codebase audit initiative to:

- Reduce repository size and complexity
- Eliminate redundant tracking mechanisms
- Improve repository organization
- Focus on GitHub's native PR features

For more information, see `CODEBASE_AUDIT_REPORT.md` in the repository root.

---

**Archived:** November 21, 2024  
**Reason:** Consolidation of PR tracking to GitHub native features  
**Impact:** No loss of functionality, improved repository organization
