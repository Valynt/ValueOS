# Production Launch Checklist (Blocking Gates)

Use this checklist immediately before a production launch. All gates are **blocking**: if any gate fails, the launch is blocked until remediated and rerun.

## Environment placeholders (replace before execution)

| Placeholder | Description |
| --- | --- |
| `APP_DOMAIN` | Public production domain (example: `app.valueos.com`) |
| `PROD_CADDYFILE_PATH` | Absolute path to production Caddyfile |
| `RCLONE_REMOTE` | rclone remote name (example: `s3-prod-backups`) |
| `RCLONE_BACKUP_PATH` | Path inside the remote for backup bridge artifacts |
| `SUPABASE_PROJECT_REF` | Supabase project ref for production |
| `SUPABASE_DATA_PATH` | Filesystem path to Supabase data to snapshot (if using self-hosted storage) |
| `KOPIA_REPO` | Kopia repository connection string/config |
| `KOPIA_SNAPSHOT_TAG` | Tag used for launch snapshots (example: `prod-launch`) |
| `ARGOCD_SERVER` | Argo CD server URL |
| `ARGOCD_APP` | Argo CD application name |
| `K8S_NAMESPACE` | Kubernetes namespace containing Argo CD Application CR |
| `K8S_CLUSTER_CONTEXT` | `kubectl` context for production cluster |

---

## Gate 1 — Edge config validation (Caddy)

### Command

```bash
caddy validate --config "$PROD_CADDYFILE_PATH"
```

### Pass criteria

- Exit code is `0`.
- Output contains no parse or adapter errors.
- `APP_DOMAIN` is present in the active Caddy config.

### Fail criteria (block launch)

- Non-zero exit code.
- Any warning/error indicating invalid directives, imports, certificates, or site blocks.

---

## Gate 2 — Backup bridge reachability (rclone)

### Command

```bash
rclone lsd "${RCLONE_REMOTE}:${RCLONE_BACKUP_PATH}"
```

### Pass criteria

- Exit code is `0`.
- Target path is listed and returns directory metadata.
- Expected backup prefix (for `APP_DOMAIN` / `SUPABASE_PROJECT_REF`) is visible.

### Fail criteria (block launch)

- Authentication failure.
- Remote/path not found.
- Empty listing when data is expected.

---

## Gate 3 — Supabase data snapshot (Kopia trigger + verification)

> Use the same repo and policy as production backup jobs.

### Trigger command

```bash
kopia snapshot create "$SUPABASE_DATA_PATH" \
  --tags "env=prod,project_ref=${SUPABASE_PROJECT_REF},launch=${KOPIA_SNAPSHOT_TAG}" \
  --description "pre-launch snapshot for ${APP_DOMAIN}"
```

### Verification commands

```bash
kopia snapshot list "$SUPABASE_DATA_PATH" \
  --tags "env=prod,project_ref=${SUPABASE_PROJECT_REF},launch=${KOPIA_SNAPSHOT_TAG}" \
  --json

kopia snapshot verify --all
```

### Pass criteria

- Snapshot create exits `0` and returns a snapshot ID.
- Snapshot list contains the newly created snapshot with matching `project_ref` and `launch` tag.
- `kopia snapshot verify --all` exits `0` with no corruption errors.

### Fail criteria (block launch)

- Snapshot creation or verification fails.
- Snapshot missing required tags/metadata.
- Any unreadable/missing pack/blob error.

---

## Gate 4 — GitOps sync + health (Argo CD)

### Commands

```bash
argocd login "$ARGOCD_SERVER" --sso
argocd app get "$ARGOCD_APP"
argocd app wait "$ARGOCD_APP" --health --sync --timeout 300

kubectl --context "$K8S_CLUSTER_CONTEXT" -n "$K8S_NAMESPACE" get application "$ARGOCD_APP" -o yaml
```

### Pass criteria

- `argocd app get` reports `Sync Status: Synced`.
- `argocd app get` reports `Health Status: Healthy`.
- `argocd app wait --health --sync` exits `0` before timeout.
- Kubernetes Application CR reflects the same healthy/synced state.

### Fail criteria (block launch)

- `OutOfSync`, `Degraded`, `Progressing` (beyond agreed deploy window), or timeout.
- Drift between Argo CD UI/CLI status and cluster resource state.

---

## Optional automation

Run the scripted gate checker:

```bash
APP_DOMAIN=... \
PROD_CADDYFILE_PATH=... \
RCLONE_REMOTE=... \
RCLONE_BACKUP_PATH=... \
SUPABASE_PROJECT_REF=... \
SUPABASE_DATA_PATH=... \
KOPIA_SNAPSHOT_TAG=prod-launch \
ARGOCD_SERVER=... \
ARGOCD_APP=... \
K8S_NAMESPACE=argocd \
K8S_CLUSTER_CONTEXT=... \
./scripts/production-launch-gates.sh
```

The script exits non-zero if any gate fails.
