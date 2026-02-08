#!/bin/bash
###############################################################################
# ValueOS UI Seed Script
#
# Populates local JSON fixtures for common UI states (empty/error/long-text).
###############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$PROJECT_ROOT/apps/ValyntApp/public/ui-fixtures"

mkdir -p "$FIXTURE_DIR"

echo "🎨 Writing UI seed fixtures to $FIXTURE_DIR"

cat <<'JSON' > "$FIXTURE_DIR/empty.json"
{
  "state": "empty",
  "message": "No results yet. Add your first entry to get started.",
  "items": []
}
JSON

cat <<'JSON' > "$FIXTURE_DIR/error.json"
{
  "state": "error",
  "error": {
    "code": "UI_SEED_ERROR",
    "message": "We couldn't load this data right now.",
    "details": "Simulated error payload for UI testing. Try again or check your network connection."
  }
}
JSON

cat <<'JSON' > "$FIXTURE_DIR/long-text.json"
{
  "state": "long-text",
  "title": "Quarterly Value Impact Summary",
  "summary": "This is intentionally verbose copy that mimics long-form insights, executive summaries, or multi-paragraph descriptions that need to be visually truncated, expanded, or otherwise handled gracefully in the UI.",
  "items": [
    {
      "id": "impact-001",
      "title": "Enterprise renewal expansion with multi-stakeholder buy-in",
      "description": "After a series of cross-functional workshops, the value narrative matured into a repeatable template that ties operational efficiencies to measurable outcomes. The stakeholders aligned on cost-avoidance metrics, risk reduction framing, and timeline-based milestones that now power the renewal briefing. This description is long enough to test how cards, tables, or drawers handle multi-sentence copy without collapsing layout or overflowing containers.",
      "notes": "Key themes: alignment, long-term roadmap, stakeholder enablement, and platform scalability."
    },
    {
      "id": "impact-002",
      "title": "New pipeline momentum driven by revamped product narrative",
      "description": "Prospects reacted positively to a more concise narrative, but they still requested detailed proof points across industry case studies. The resulting documentation now includes a high-level overview, a technical appendix, and a set of lightweight visuals. Use this long text to verify typography, line-height, and maximum-width constraints in the UI.",
      "notes": "Key themes: clarity, proof points, and funnel acceleration."
    }
  ]
}
JSON

echo "✅ UI fixtures seeded."
