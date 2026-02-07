#!/usr/bin/env bash
set -euo pipefail

# Create a branch, run the dockerfile validator, commit the changes and open a PR using GitHub CLI
# Usage: bash scripts/ci/create-dockerfile-hardening-pr.sh [base-branch]

BASE_BRANCH=${1:-main}
BRANCH_NAME="fix/dockerfile-hardening-$(date +%Y%m%d%H%M%S)"
COMMIT_MSG="chore(docker): harden Dockerfiles, add validator and CI checks"
PR_TITLE="chore(docker): harden Dockerfiles and add validator"
PR_BODY="This PR adds a Dockerfile hardening validator (scripts/dx/dockerfile-validate.cjs), wires it into CI (.github/workflows/ci-tests.yml), and hardens Dockerfiles to use a non-privileged user, --chown on COPYs, and EXPOSE ports validated against config/ports.json.\n\n- Adds validator script\n- Adds CI job to validate and build representative images using ports from config/ports.json\n- Applies non-root user and --chown changes across Dockerfiles\n\nPlease review security changes and the CI build-arg wiring."

# Ensure git working tree is clean
if [ -n "$(git status --porcelain)" ]; then
  echo "Git working tree is not clean. Please commit or stash unrelated changes before running this script." >&2
  git status --porcelain
  exit 1
fi

# Run the validator locally
echo "Running Dockerfile validator..."
pnpm run lint:dockerfiles

# Create branch
echo "Creating branch ${BRANCH_NAME} from ${BASE_BRANCH}"
git fetch origin ${BASE_BRANCH}
git checkout -b ${BRANCH_NAME}

# Add targeted files (edit list if you changed additional files)
FILES=(
  "scripts/dx/dockerfile-validate.cjs"
  "package.json"
  ".github/workflows/ci-tests.yml"
  "Dockerfile.optimized"
  "Dockerfile.build"
  "Dockerfile.optimized.agent"
  "Dockerfile.optimized.frontend"
  ".devcontainer/Dockerfile.dev"
  ".devcontainer/Dockerfile.optimized"
)

echo "Staging files..."
for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    git add "$f"
  else
    echo "Warning: $f not found, skipping"
  fi
done

# Commit
git commit -m "$COMMIT_MSG"

echo "Pushing branch to origin..."
git push --set-upstream origin ${BRANCH_NAME}

# Open PR (requires gh CLI)
if command -v gh >/dev/null 2>&1; then
  echo "Opening PR via gh..."
  gh pr create --base ${BASE_BRANCH} --title "$PR_TITLE" --body "$PR_BODY"
  echo "PR opened."
else
  echo "gh CLI not found. To open a PR run:
  gh pr create --base ${BASE_BRANCH} --title \"${PR_TITLE}\" --body \"${PR_BODY}\""
fi

echo "Done. Branch: ${BRANCH_NAME}"
