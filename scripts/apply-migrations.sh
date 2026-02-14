#!/usr/bin/env bash
set -euo pipefail

exec bash scripts/db/apply-migrations.sh "$@"
