# Spec: Fix 4 Code Review Issues

## Problem Statement

Four issues were identified in the code review of the `modeling/` fixes. All are in
already-changed files and must be corrected.

---

## Fix 1 — config.py: Replace sys.exit(1) with EnvironmentError

**File:** modeling/valueverse_engine/analysis_engine/config.py

### Problem
sys.exit(1) executes at module import time. Any tool that imports config without DB_URL
set terminates the process rather than raising a catchable exception.

### Fix
Replace the print + sys.exit(1) block with a raised EnvironmentError:

    DB_URL = os.getenv("DB_URL")
    if not DB_URL:
        raise EnvironmentError(
            "DB_URL environment variable is not set. "
            "See analysis_engine/.env.example for required variables."
        )

Remove import sys if it is no longer used after this change.
main.py already wraps ValueVerseEngine() in a try/except — no changes to main.py needed.

### Acceptance criteria
- grep -n "sys.exit" config.py returns nothing
- Importing config without DB_URL set raises EnvironmentError, does not call sys.exit

---

## Fix 2 — engine.py: Add JSON extraction fallback for Together.ai response

**File:** modeling/valueverse_engine/analysis_engine/engine.py

### Problem
response_format={"type": "json_object"} is not reliably honoured by
meta-llama/Llama-3.3-70B-Instruct-Turbo on Together.ai. The model may return
markdown-fenced JSON, causing json.loads to raise. The exception is caught and []
is returned silently — mock data does not trigger because api_key is set.

### Fix
- Remove response_format from the client.chat.completions.create call
- Update system prompt to instruct the model to return raw JSON with no markdown fences
- Add markdown-fence stripping before json.loads:

    content = response.choices[0].message.content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    data = json.loads(content)

### Acceptance criteria
- response_format parameter is absent from the API call
- System prompt instructs model to return raw JSON without markdown
- Markdown-fence stripping applied before json.loads

---

## Fix 3 — main.js: Re-apply draft-toggle hide state after applyFilters

**File:** modeling/causal_truth_export/explorer/src/main.js

### Problem
applyFilters() calls setupGraph() which destroys and recreates the Cytoscape instance.
After any filter change, all nodes are re-created as visible. If draftsHidden is true,
DRAFT nodes reappear while the button still reads "Show Drafts".

### Fix
After setupGraph() inside applyFilters, re-apply the hide if draftsHidden is true:

    function applyFilters() {
      // ... existing filter logic unchanged ...
      setupGraph();
      if (draftsHidden) {
        cy.nodes("[status = 'DRAFT']").hide();
      }
      setOverviewStats(filteredRelationships);
      renderActionList(filteredRelationships);
    }

### Acceptance criteria
- After toggling "Hide Drafts" then changing the filter, DRAFT nodes remain hidden
- draftsHidden state and button label remain consistent with graph visibility

---

## Fix 4 — main.js: Align runSimulation with absolute-unit path from miner.py

**File:** modeling/causal_truth_export/explorer/src/main.js

### Problem
runSimulation computes baseline * (impactPct / 100) for all units, then for non-% units
displays the raw impactPct without adding the baseline. This is inconsistent with
simulate_action_outcome in miner.py which returns baseline + dist.p50 for absolute units.

### Fix
Branch on unit type, matching miner.py semantics:

    function runSimulation() {
      if (!selectedNodeData) return;
      const baseline = parseFloat(document.getElementById("sim-baseline").value) || 0;
      const dist = selectedNodeData.impact_distribution;
      const impactVal = dist.p50;
      const unit = dist.unit;
      const formatter = new Intl.NumberFormat("en-US", {
        style: "currency", currency: "USD", signDisplay: "always",
      });
      let displayVal;
      if (unit === "%") {
        const result = baseline * (impactVal / 100);
        displayVal = formatter.format(result);
      } else {
        const result = baseline + impactVal;
        displayVal = `${result.toLocaleString()} ${unit}`;
      }
      document.getElementById("sim-gain").textContent = displayVal;
    }

### Acceptance criteria
- For % unit: output matches baseline * (p50 / 100) formatted as currency
- For absolute unit (e.g. days): output matches baseline + p50 with unit label
- Variable impactPct renamed to impactVal

---

## Implementation Order

1. config.py — remove sys.exit, raise EnvironmentError, remove import sys
2. engine.py — remove response_format, update system prompt, add fence-stripping
3. main.js — add draftsHidden re-apply in applyFilters
4. main.js — rewrite runSimulation with unit-branching logic
