BuildKit build notes for ValueOS (devcontainer)

Purpose
- Explain how to enable Docker BuildKit and provide an example build command for the optimized Dockerfile in `.devcontainer/Dockerfile.optimized`.

Why BuildKit
- Enables advanced cache mounts (`--mount=type=cache`) which speeds up `pnpm` installs by persisting the pnpm store across builds.
- Improves layer reuse and parallelizes builds for faster iteration.

Quick example (local)
- Use BuildKit when running locally:

  DOCKER_BUILDKIT=1 docker build \
    -f .devcontainer/Dockerfile.optimized \
    --progress=plain \
    --build-arg APP=ValyntApp \
    -t valueos-valyntapp:dev .

Notes for CI
- Ensure your CI runner supports Docker BuildKit and that the environment variable `DOCKER_BUILDKIT=1` is set when building.
- Consider caching the BuildKit cache between CI runs. For GitHub Actions, use `docker/build-push-action@v4` which supports buildx caches.

CI workflow example
- See `.github/workflows/docker-build.yml` for an example that builds using BuildKit and demonstrates how to push to GitHub Container Registry (GHCR).
- If you push to GHCR, ensure the workflow job sets `permissions: packages: write` and that your repo/org does not restrict `GITHUB_TOKEN` package write access.
- For builds triggered from forks or other contexts where `GITHUB_TOKEN` is read-only, use a PAT with `write:packages` stored as a repository secret and update the workflow to use it instead of `secrets.GITHUB_TOKEN`.

REGISTRY_PAT (optional)
- Create a Personal Access Token (PAT) with the `write:packages` scope (and `repo` if publishing from forked workflows or needing repo access).
- Add the PAT to your repository secrets named `REGISTRY_PAT` (or another name and update the workflow).

  Example (GitHub CLI):

    gh secret set REGISTRY_PAT --body "$(cat /path/to/pat.txt)"

- The workflow prefers `secrets.REGISTRY_PAT` when present and falls back to `secrets.GITHUB_TOKEN` otherwise. Note: secrets from forks are not available, so PRs from forks will not push images.

Optional: Persist node_modules cache
- If your workflow benefits from persisting `node_modules`, add an extra cache mount id (for example, `--mount=type=cache,id=node-modules,target=/app/node_modules`) in the Dockerfile and configure your builder accordingly.

Tips
- For debugging, add `--progress=plain` to get full build logs.
- If you see unexpected cache misses, verify that `package.json` and `pnpm-lock.yaml` are copied before source files in the Dockerfile.

Contact
- If you want, I can add an example GitHub Actions workflow that uses BuildKit and caches build layers for faster CI.
