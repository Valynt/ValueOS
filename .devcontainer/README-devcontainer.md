# Devcontainer notes (local DX)

This dev container setup is intentionally lightweight and optimized for local developer iteration.

Key points:

- Dockerfile: `.devcontainer/Dockerfile.dev` — used only for local development (keeps the container small and fast to rebuild).
- Production image: `Dockerfile.optimized` (or `Dockerfile.optimized.agent`) is used in CI and the release pipeline; we do not build it locally by default.
- Image tag: `valueos-app:devcontainer` is used for the dev image to avoid accidental pulls of a missing or stale `valueos-app:latest` image.

Rebuild & attach:

1. Build the dev image locally:

   COMPOSE_PROFILES=devcontainer docker compose -f compose.yml -f .devcontainer/compose.devcontainer.override.yml build app

   If host UID/GID differs from defaults, pass build args:

   COMPOSE_PROFILES=devcontainer docker compose -f compose.yml -f .devcontainer/compose.devcontainer.override.yml build --build-arg USER_ID=1000 --build-arg USER_GID=1000 app

2. Start the dev container services:

   COMPOSE_PROFILES=devcontainer docker compose -f compose.yml -f .devcontainer/compose.devcontainer.override.yml up -d

3. In VS Code: Command Palette → Dev Containers: Reopen in Container (or reopen workspace) to attach to `app` service.

Why this split? The production Dockerfile is optimized for CI and reproducible builds and may require build-time secrets or a different context. Keeping devfile local reduces iteration time and avoids native build failures during dev iteration.
