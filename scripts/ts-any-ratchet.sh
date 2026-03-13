#!/usr/bin/env bash
# ts-any-ratchet.sh — Enforce declining explicit-any count in CI.
#
# Counts explicit `any` occurrences in .ts/.tsx source files using the
# canonical debt-policy pattern: `:\s*any`, `as any`, and `<any>` (excluding
# tests, node_modules, dist, and .d.ts). Fails if global or per-package counts
# exceed baselines stored in ts-any-baseline.json. Also tracks monthly
# reduction targets per package for debt burn-down reporting.
#
# Usage:
#   bash scripts/ts-any-ratchet.sh                 # check mode (CI)
#   bash scripts/ts-any-ratchet.sh --update        # capture new baseline
#   bash scripts/ts-any-ratchet.sh --report-only   # write dashboard only

set -euo pipefail

BASELINE_FILE="ts-any-baseline.json"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPORT_DIR="$ROOT_DIR/docs/debt"
REPORT_FILE="$REPORT_DIR/ts-any-dashboard.md"
cd "$ROOT_DIR"

compute_counts() {
  python3 - <<'PY'
import json
import pathlib
import re
from collections import Counter

root = pathlib.Path('.')
pattern = re.compile(r':\s*any\b|as\s+any\b|<\s*any\s*>')
counts = Counter()
total = 0

for path in root.rglob('*'):
    if path.suffix not in {'.ts', '.tsx'}:
        continue
    parts = path.parts
    if not parts:
        continue
    if parts[0] not in {'apps', 'packages', 'src'}:
        continue
    if 'node_modules' in parts or 'dist' in parts or '__tests__' in parts:
        continue
    name = path.name
    if name.endswith('.d.ts') or '.test.' in name or '.spec.' in name:
        continue

    try:
        lines = path.read_text(encoding='utf-8', errors='ignore').splitlines()
    except Exception:
        continue

    file_count = sum(1 for line in lines if pattern.search(line))
    if file_count == 0:
        continue

    total += file_count
    if parts[0] in {'apps', 'packages'} and len(parts) > 1:
        package = f"{parts[0]}/{parts[1]}"
    else:
        package = parts[0]
    counts[package] += file_count

print(json.dumps({"total": total, "packages": dict(sorted(counts.items()))}))
PY
}

build_report() {
  local counts_json="$1"
  local baseline_json="$2"

  mkdir -p "$REPORT_DIR"

  COUNTS_JSON="$counts_json" BASELINE_JSON="$baseline_json" REPORT_FILE="$REPORT_FILE" python3 - <<'PY'
import datetime as dt
import json
import math
import os
from pathlib import Path

counts = json.loads(os.environ["COUNTS_JSON"])
baseline = json.loads(os.environ["BASELINE_JSON"])
report_file = Path(os.environ["REPORT_FILE"])

base_packages = baseline.get("packages", {})
current_packages = counts.get("packages", {})
updated_at = baseline.get("updated_at")

months_elapsed = 0
if updated_at:
    try:
        start = dt.datetime.fromisoformat(updated_at.replace('Z', '+00:00')).date().replace(day=1)
        today = dt.date.today().replace(day=1)
        months_elapsed = max(0, (today.year - start.year) * 12 + (today.month - start.month))
    except Exception:
        months_elapsed = 0

rows = []
for package in sorted(set(base_packages) | set(current_packages)):
    b = int(base_packages.get(package, {}).get("baseline", 0))
    c = int(current_packages.get(package, 0))
    monthly = int(base_packages.get(package, {}).get("monthly_reduction", max(1, math.ceil(b * 0.03)) if b else 1))
    expected = max(0, b - (monthly * months_elapsed))
    delta = c - b
    trend = "⬇️" if delta < 0 else ("⬆️" if delta > 0 else "➡️")
    rows.append((package, b, c, delta, monthly, expected, trend))

lines = []
lines.append("# TS `any` Debt Dashboard")
lines.append("")
lines.append(f"_Generated: {dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%d %H:%M:%SZ')}_")
lines.append("")
lines.append("## Global")
lines.append("")
lines.append(f"- Baseline: **{baseline.get('baseline', 0)}**")
lines.append(f"- Current: **{counts.get('total', 0)}**")
lines.append(f"- Long-term target: **<{baseline.get('target', 100)}**")
lines.append(f"- Baseline updated: **{updated_at or 'unknown'}**")
lines.append(f"- Months elapsed since baseline month: **{months_elapsed}**")
lines.append("")
lines.append("## Generation notes")
lines.append("")
lines.append("- Canonical explicit-`any` pattern: `:\\s*any`, `as any`, `<any>`")
lines.append("- Included files: `apps/**`, `packages/**`, `src/**` with `.ts`/`.tsx` suffixes")
lines.append("- Excluded paths/files: `node_modules`, `dist`, `__tests__`, `*.test.*`, `*.spec.*`, `*.d.ts`")
lines.append("")
lines.append("## Module burn-down")
lines.append("")
lines.append("| Module | Baseline | Current | Δ vs baseline | Monthly target | Expected by now | Trend |")
lines.append("| --- | ---: | ---: | ---: | ---: | ---: | :---: |")
for package, b, c, d, m, e, t in sorted(rows, key=lambda r: (-r[2], r[0])):
    lines.append(f"| `{package}` | {b} | {c} | {d:+d} | -{m}/month | ≤{e} | {t} |")

report_file.write_text("\n".join(lines) + "\n", encoding='utf-8')
PY
}

if [[ ! -f "$BASELINE_FILE" ]]; then
  echo "ERROR: $BASELINE_FILE not found. Run with --update first."
  exit 1
fi

COUNTS_JSON="$(compute_counts)"
BASELINE_JSON="$(cat "$BASELINE_FILE")"

if [[ "${1:-}" == "--update" ]]; then
  COUNTS_JSON="$COUNTS_JSON" python3 - <<'PY' > "$BASELINE_FILE"
import datetime as dt
import json
import math
import os

counts = json.loads(os.environ["COUNTS_JSON"])
packages = {
    pkg: {
        "baseline": count,
        "monthly_reduction": max(1, math.ceil(count * 0.03)),
    }
    for pkg, count in sorted(counts.get("packages", {}).items())
}

payload = {
    "baseline": counts.get("total", 0),
    "updated_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "target": 100,
    "monthly_target_strategy": "3% reduction per package per month (minimum 1)",
    "packages": packages,
    "note": "Run 'bash scripts/ts-any-ratchet.sh --update' after reducing any count",
}
print(json.dumps(payload, indent=2))
PY
  BASELINE_JSON="$(cat "$BASELINE_FILE")"
  build_report "$COUNTS_JSON" "$BASELINE_JSON"
  echo "Baseline updated with per-package monthly targets."
  exit 0
fi

build_report "$COUNTS_JSON" "$BASELINE_JSON"

if [[ "${1:-}" == "--report-only" ]]; then
  echo "Report written to $REPORT_FILE"
  exit 0
fi

BASELINE_TOTAL=$(BASELINE_JSON="$BASELINE_JSON" python3 - <<'PY'
import json, os
print(int(json.loads(os.environ["BASELINE_JSON"]).get("baseline", 0)))
PY
)
CURRENT_TOTAL=$(COUNTS_JSON="$COUNTS_JSON" python3 - <<'PY'
import json, os
print(int(json.loads(os.environ["COUNTS_JSON"]).get("total", 0)))
PY
)

echo "TS any count: $CURRENT_TOTAL (baseline: $BASELINE_TOTAL, target: <100)"

STATUS=0

if (( CURRENT_TOTAL > BASELINE_TOTAL )); then
  echo "FAIL: global any count increased from $BASELINE_TOTAL to $CURRENT_TOTAL."
  STATUS=1
fi

PER_PACKAGE_RESULT=$(COUNTS_JSON="$COUNTS_JSON" BASELINE_JSON="$BASELINE_JSON" python3 - <<'PY'
import json, os

counts = json.loads(os.environ["COUNTS_JSON"]).get("packages", {})
baseline_packages = json.loads(os.environ["BASELINE_JSON"]).get("packages", {})

failures = []
for package, current in sorted(counts.items()):
    baseline = int(baseline_packages.get(package, {}).get("baseline", 0))
    if current > baseline:
        failures.append((package, baseline, current))

for package in sorted(set(baseline_packages) - set(counts)):
    pass

if failures:
    print("FAIL")
    for package, baseline, current in failures:
        print(f"{package}|{baseline}|{current}")
else:
    print("PASS")
PY
)

if [[ "$PER_PACKAGE_RESULT" == FAIL* ]]; then
  echo "FAIL: per-package any counts increased:"
  echo "$PER_PACKAGE_RESULT" | tail -n +2 | while IFS='|' read -r package baseline current; do
    echo "  - $package: $baseline -> $current"
  done
  STATUS=1
fi

if (( CURRENT_TOTAL < BASELINE_TOTAL )); then
  echo "Global any count decreased from $BASELINE_TOTAL to $CURRENT_TOTAL."
  echo "Update baseline: bash scripts/ts-any-ratchet.sh --update"
fi

if (( STATUS == 0 )); then
  echo "PASS"
else
  exit 1
fi
