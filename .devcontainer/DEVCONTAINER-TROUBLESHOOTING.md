Troubleshooting — devcontainer build fails with "group 'vscode' already exists"

Symptom
- devcontainer build (or VS Code Remote - Containers) can abort with:
  `groupadd: group 'vscode' already exists`
  This happens when the devcontainer tooling injects an auto-generated Dockerfile step to update the remote user's UID/GID.

Quick workaround (local debugging)
- Use the devcontainer CLI and disable the automatic UID/GID update step:
  - Build (no install):
    `npx @devcontainers/cli@latest build --workspace-folder . --config .devcontainer/devcontainer.json --log-level debug --no-cache --update-remote-user-uid-default off`
  - Start container:
    `npx @devcontainers/cli@latest up --workspace-folder . --config .devcontainer/devcontainer.json --log-level debug --update-remote-user-uid-default off`

Notes
- If you prefer a persistent CLI install: `npm i -g @devcontainers/cli` (or use your package manager).
- The flag `--update-remote-user-uid-default off` prevents the devcontainers tool from injecting the user/group-change step that can collide with images that already include a `vscode` user/group.

Permanent / repo-level options
1) Prebuild an image and use `image:` in `devcontainer.json` (recommended for CI):
   - `docker build -f .devcontainer/Dockerfile.dev -t valueos-dev:local .`
   - In `.devcontainer/devcontainer.json` replace the `build` block with:
     `"image": "valueos-dev:local"`
   This avoids the generated Dockerfile modifications entirely.

2) Continue using the CLI flag in developer docs until tooling changes upstream.

If you'd like, I can:
- Add the `image:` variant and a small PR to switch to a prebuilt image for CI.
- Add the CLI-workaround to the main `.devcontainer/README.md`.

