#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "src");
const forbidden = /style\s*=\s*\{|style\s*=\s*"/g;
const excludedFiles = [
  "ValueCanvas.tsx",
  "node_modules",
  "AITransparency.tsx",
  "AcademyProgressTracker.tsx",
  "GhostPreview.tsx",
  "MultiStepDialog.tsx",
  "SuggestionCard.tsx",
  "ConfidenceIndicator.tsx",
  "UsageMeter.tsx",
  "CanvasGrid.tsx",
  "ContextMenu.tsx",
  "DeltaBadge.tsx",
  "RippleEffect.tsx",
  "SelectionBox.tsx",
  "SDUISkeletonLoader.tsx",
  "StageProgressIndicator.tsx",
  "ProgressBar.tsx",
  "Spinner.tsx",
  "VirtualScrollList.tsx",
  "InteractiveChart.tsx",
  "SalesCallModal.tsx",
  "FiveMinuteDemo.tsx",
  "InterfaceTour.tsx",
  "AgentResponseCard.tsx",
  "AgentWorkflowPanel.tsx",
  "Grid.tsx",
  "VerticalSplit.tsx",
  "DataTable.tsx",
  "IntegrityReviewPanel.tsx",
  "LifecyclePanel.tsx",
  "RealizationDashboard.tsx",
  "ScenarioSelector.tsx",
  "SideNavigation.tsx",
  "FeedbackLoopViewer.tsx",
  "Tooltip.tsx",
  "vite-hmr-fallback.ts",
  "AccessibilityCompliance.test.tsx",
  "LoadingFallback.tsx",
  "sanitization.ts",
  "AgentDashboard.tsx",
  "ExpansionInsightPage.tsx",
  "ImpactCascade.tsx",
  "IntegrityCompliancePage.tsx",
  "ROICalculator.tsx",
  "OrganizationBilling.tsx",
  "UserSecurity.tsx",
  "StreamingIndicator.tsx",
  "AlignmentGuide.tsx",
  "DependencyLine.tsx",
  "HorizontalSplit.tsx",
];
let found = [];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (excludedFiles.includes(entry.name)) continue;

    if (entry.isDirectory()) {
      // skip node_modules if found
      if (entry.name === "node_modules") continue;
      walk(full);
    } else if (/\.(tsx?|jsx?|css|scss)$/.test(entry.name)) {
      const content = fs.readFileSync(full, "utf8");
      if (forbidden.test(content)) {
        found.push(full);
      }
    }
  }
}

walk(root);

if (found.length > 0) {
  console.error(
    "Inline styles or raw style attributes found in the following files:"
  );
  found.forEach((f) => console.error("  - " + f));
  process.exit(1);
}

console.log("No inline style attributes found.");
