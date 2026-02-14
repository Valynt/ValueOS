# Devcontainer Toolchain Pinning

Toolchain versions for the devcontainer are pinned in `pragmatic-reproducibility/ci/versions.json`.

Use this file as the single source of truth for updating pinned versions (for example: `node`, `pnpm`, `kubectl`, and `terraform`). Devcontainer scripts should read from this JSON file instead of hardcoded literals.


## Environment files

- `.env.ports` is the canonical port mapping file for local/devcontainer compose flows.
- `.env.ports.example` contains default non-secret port values.
- `.env.local` is for secrets only (API keys, tokens, connection strings) and should not define port mappings.
