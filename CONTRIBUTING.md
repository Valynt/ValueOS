# ValueOS Devcontainer & Environment Invariants

## Deterministic Dev Environment: Invariants

- **Single authoritative compose file:** Only `docker-compose.yml` at repo root is the base. No `compose.yml`.
- **Dev override layer:** All devcontainer-specific config in `compose.devcontainer.override.yml` (never referenced in production).
- **No cached VS Code pollution:** Always clear VS Code Dev Containers cache after major Compose or devcontainer changes.
- **No bind-mounted build artifacts:** Never commit or mount `node_modules` from host. All `node_modules` are Docker volumes.
- **WSL-safe, Codespaces-safe, CI-safe:** This setup works on all platforms and for all contributors.
- **No COMPOSE_FILE env injection:** Do not set `COMPOSE_FILE` in your shell or `.env`.

## Resetting the Dev Environment

Use the provided script for a deterministic reset:

```sh
./reset-dev-env.sh
```

## Guard Against Host node_modules

A guard script is provided to prevent accidental host `node_modules` pollution:

```sh
./guard-node-modules.sh
```

Add this to your prestart scripts or source in your shell for extra safety.

## Troubleshooting

- If you see permission errors, EACCES, or `compose.yml` references, run `./reset-dev-env.sh` and rebuild the devcontainer.
- If you see `node_modules` on the host, delete them and use Docker volumes only.

## Contributing

- Never reintroduce `compose.yml` or host `node_modules`.
- Always use the devcontainer for local development.
- Document any changes to Compose or devcontainer setup in this file.

---

For more details, see the project README and `.devcontainer/` docs.
