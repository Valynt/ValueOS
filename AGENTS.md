# Dev Environment Stability

## Learnings
- **Devcontainer Persistence**: The root bind mount (`..:/workspaces/ValueOS`) masks the `node_modules` directory created during the Docker build. A named volume for `node_modules` is required to ensure dependencies persist and are not overwritten by the host filesystem state.
- **Boot Logic**: `scripts/dev/start-dev-env.sh` must explicitly detect the devcontainer environment and bypass Docker orchestration, as services are already running as siblings.
- **Migration Connectivity**: When running inside the devcontainer, database tools must address the service name `db` rather than `localhost`.
