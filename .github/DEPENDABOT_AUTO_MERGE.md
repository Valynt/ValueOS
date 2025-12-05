# Dependabot Auto-Merge Workflow

This repository includes an automated workflow that handles Dependabot pull requests by automatically merging them when all tests pass, with different behavior based on the type of update.

## How It Works

The workflow (`dependabot-auto-merge.yml`) is triggered when:
- A pull request is opened, synchronized, or reopened
- The pull request is created by `dependabot[bot]`

## Workflow Steps

1. **Fetch Dependabot Metadata**: Extracts information about the dependency update
2. **Wait for All Tests**: Ensures all CI checks pass before proceeding:
   - Unit & Integration Tests
   - Playwright Smoke Tests
   - ESLint Check
   - TypeScript Check
   - Security Audit
   - Secret Scanning
3. **Process Based on Update Type**:
   - **Patch/Minor Updates**: Auto-approved and auto-merged
   - **Major Updates**: Commented for manual review
   - **Unknown Types**: Commented for manual review

## Auto-Merge Behavior

### ✅ Automatically Merged
- **Patch updates** (`1.0.0` → `1.0.1`)
- **Minor updates** (`1.0.0` → `1.1.0`)

These are considered safe updates that typically include:
- Bug fixes
- New features (backward compatible)
- Security patches

### ⚠️ Manual Review Required
- **Major updates** (`1.0.0` → `2.0.0`)
- **Unknown update types**

Major updates may include breaking changes and require manual review.

## Security Features

- Only runs on Dependabot PRs (verified by GitHub actor)
- Waits for all security checks to pass
- Includes secret scanning validation
- Requires all tests to pass before merging

## Permissions

The workflow requires these permissions:
- `contents: write` - To merge pull requests
- `pull-requests: write` - To approve and comment on PRs
- `checks: read` - To read status check results

## Monitoring

The workflow provides detailed logging including:
- Dependency name and versions
- Update type classification
- Test status for each check
- Merge/review decisions

## Configuration

The workflow is configured to:
- Use squash merge strategy
- Wait up to 30 seconds between status checks
- Provide detailed comments explaining actions taken

## Disabling Auto-Merge

To disable auto-merge for specific dependencies, update the Dependabot configuration in `.github/dependabot.yml` to ignore those packages.

## Troubleshooting

If the workflow fails:
1. Check that all required status checks are configured
2. Verify the check names match those in your CI workflows
3. Ensure the repository has the necessary permissions
4. Review the workflow logs for specific error messages