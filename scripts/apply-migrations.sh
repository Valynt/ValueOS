#!/bin/bash
set -euo pipefail

# Canonical migration entrypoint wrapper.
exec bash infra/scripts/apply_migrations.sh "$@"
