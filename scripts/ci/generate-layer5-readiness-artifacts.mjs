#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const DOC_PATH = 'docs/operations/layer5-production-readiness.md';
const runId = process.env.GITHUB_RUN_ID ?? 'local';
const sha = process.env.GITHUB_SHA ?? 'local';
const generatedAt = new Date().toISOString();
const STALENESS_WINDOW_HOURS = Number(process.env.LAYER5_STALENESS_WINDOW_HOURS ?? 72);
const outDir = path.join('artifacts', 'operations');
fs.mkdirSync(outDir, { recursive: true });

const validationChecks = [];

const addCheck = ({ name, passed, reason = null, remediation = null, details = {} }) => {
  validationChecks.push({ name, passed, reason, remediation, details });
};

const writeArtifacts = ({ status, extra = {} }) => {
  const report = {
    generated_at: generatedAt,
    source_commit: sha,
    source_doc: DOC_PATH,
    status,
    validation_checks: validationChecks,
    failed_checks: validationChecks.filter((check) => !check.passed).length,
    ...extra,
  };

  const jsonPath = path.join(outDir, `layer5-readiness-report-${runId}.json`);
  const mdPath = path.join(outDir, `layer5-readiness-report-${runId}.md`);

  const failedItems = validationChecks.filter((check) => !check.passed);
  const markdownFailures = failedItems.length
    ? failedItems
        .map(
          (check) =>
            `- ❌ ${check.name}: ${check.reason ?? 'failed'}${
              check.remediation ? `\n  - Remediation: ${check.remediation}` : ''
            }`
        )
        .join('\n')
    : '- ✅ No readiness validation failures.';

  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(
    mdPath,
    `# Layer 5 Readiness Artifact\n\n- generated_at: ${generatedAt}\n- source_commit: ${sha}\n- source_doc: ${DOC_PATH}\n- status: ${status}\n\n## Validation Summary\n- checks_run: ${validationChecks.length}\n- checks_failed: ${failedItems.length}\n\n## Failures\n${markdownFailures}\n`
  );

  return { jsonPath, mdPath };
};

if (!fs.existsSync(DOC_PATH)) {
  addCheck({
    name: 'readiness_document_exists',
    passed: false,
    reason: `Missing required Layer 5 readiness report: ${DOC_PATH}`,
    remediation: 'Restore the readiness report and re-run CI.',
  });

  const { jsonPath, mdPath } = writeArtifacts({
    status: 'not_ready',
    extra: {
      stale_evidence_reasons: [],
      remediation_hints: ['Ensure docs/operations/layer5-production-readiness.md exists in the branch.'],
    },
  });

  console.error(`❌ Layer 5 readiness not ready. Artifacts:\n  - ${jsonPath}\n  - ${mdPath}`);
  process.exit(1);
}

const content = fs.readFileSync(DOC_PATH, 'utf8');
const requiredMarkers = [
  '## Control Checklist',
  '## Drift Scenarios Tested',
  '## Pass/Fail Status Log',
  '## Unresolved Risks',
  '## Operational Runbook',
  '## Dashboards, Metrics, and Alert Thresholds',
];

const missing = requiredMarkers.filter((marker) => !content.includes(marker));
addCheck({
  name: 'required_sections_present',
  passed: missing.length === 0,
  reason: missing.length ? `Missing required sections: ${missing.join(', ')}` : null,
  remediation: missing.length ? 'Add the missing markdown sections to the Layer 5 report.' : null,
  details: { missing_sections: missing },
});

const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
const frontmatter = {};
if (frontmatterMatch) {
  for (const line of frontmatterMatch[1].split('\n')) {
    const entry = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (entry) frontmatter[entry[1]] = entry[2].trim();
  }
}

const frontmatterSourceCommit = frontmatter.source_commit ?? null;
const sourceCommitMatches = frontmatterSourceCommit === sha;
addCheck({
  name: 'frontmatter_source_commit_matches_github_sha',
  passed: sourceCommitMatches,
  reason: sourceCommitMatches
    ? null
    : `Frontmatter source_commit (${frontmatterSourceCommit ?? 'missing'}) does not match GITHUB_SHA (${sha}).`,
  remediation: sourceCommitMatches
    ? null
    : 'Populate frontmatter source_commit with the current CI commit SHA before release artifact generation.',
  details: { frontmatter_source_commit: frontmatterSourceCommit, github_sha: sha },
});

const parsePassFailRows = () => {
  const section = content.match(/## Pass\/Fail Status Log\n\n([\s\S]*?)(\n## |$)/);
  if (!section) return [];

  return section[1]
    .split('\n')
    .filter((line) => /^\|/.test(line) && !/\|\s*---/.test(line) && !/\|\s*Check\s*\|/.test(line))
    .map((line) => line.split('|').map((v) => v.trim()).filter(Boolean))
    .filter((cells) => cells.length >= 4)
    .map(([check, status, timestamp, notes]) => ({ check, status, timestamp, notes }));
};

const passFailRows = parsePassFailRows();
const staleEvidenceReasons = [];
const now = new Date(generatedAt);
const staleThresholdMs = STALENESS_WINDOW_HOURS * 60 * 60 * 1000;
let timestampValidationPass = true;

for (const row of passFailRows) {
  const ts = Date.parse(row.timestamp);
  if (Number.isNaN(ts)) {
    timestampValidationPass = false;
    staleEvidenceReasons.push(`Invalid timestamp for check "${row.check}": ${row.timestamp}`);
    continue;
  }

  const ageMs = now.getTime() - ts;
  if (ageMs > staleThresholdMs) {
    timestampValidationPass = false;
    staleEvidenceReasons.push(
      `Stale evidence for "${row.check}": ${row.timestamp} is older than ${STALENESS_WINDOW_HOURS}h.`
    );
  }

  const machineValidated = /\b(ci|automation|automated|workflow|github actions|enforced by)\b/i.test(
    row.notes
  );
  if (!machineValidated) {
    timestampValidationPass = false;
    staleEvidenceReasons.push(`Missing machine-validation marker for "${row.check}" in notes.`);
  }
}

addCheck({
  name: 'pass_fail_log_machine_validated_and_fresh',
  passed: passFailRows.length > 0 && timestampValidationPass,
  reason:
    passFailRows.length === 0
      ? 'No pass/fail rows were parsed from the status log.'
      : timestampValidationPass
      ? null
      : 'One or more pass/fail rows failed machine-validation or staleness checks.',
  remediation:
    passFailRows.length === 0
      ? 'Populate Pass/Fail Status Log with CI-generated entries.'
      : timestampValidationPass
      ? null
      : `Refresh stale evidence and ensure notes include machine-validation markers (e.g., "enforced by <ci check>") within ${STALENESS_WINDOW_HOURS} hours.`,
  details: {
    staleness_window_hours: STALENESS_WINDOW_HOURS,
    parsed_rows: passFailRows.length,
  },
});

const riskSection = content.match(/## Unresolved Risks\n\n([\s\S]*?)(\n## |$)/);
const riskRows = riskSection
  ? riskSection[1]
      .split('\n')
      .filter((line) => /^\|/.test(line) && !/\|\s*---/.test(line) && !/\|\s*Risk\s*\|/.test(line))
      .map((line) => line.split('|').map((v) => v.trim()).filter(Boolean))
      .filter((cells) => cells.length >= 5)
      .map(([risk, impact, owner, eta, mitigationStatus]) => ({ risk, impact, owner, eta, mitigationStatus }))
  : [];

let riskValidationPass = true;
const riskFailureReasons = [];
for (const risk of riskRows) {
  const categoryMatch = risk.mitigationStatus.match(/\b(open|accepted|mitigated)\b/i);
  if (!categoryMatch) {
    riskValidationPass = false;
    riskFailureReasons.push(`Risk missing explicit category (open|accepted|mitigated): ${risk.risk}`);
    continue;
  }

  const category = categoryMatch[1].toLowerCase();
  const eta = Date.parse(risk.eta);
  const overdue = !Number.isNaN(eta) && eta < now.getTime();
  if ((category === 'open' || category === 'mitigated') && overdue) {
    riskValidationPass = false;
    riskFailureReasons.push(`Overdue mitigation for ${category} risk owned by ${risk.owner} (ETA ${risk.eta}).`);
  }
}

addCheck({
  name: 'unresolved_risks_categorized_and_not_overdue',
  passed: riskRows.length > 0 && riskValidationPass,
  reason:
    riskRows.length === 0
      ? 'No unresolved risk rows were parsed.'
      : riskValidationPass
      ? null
      : 'Risk categorization or mitigation due-date checks failed.',
  remediation:
    riskRows.length === 0
      ? 'Add unresolved risk entries with explicit mitigation status and ETA.'
      : riskValidationPass
      ? null
      : 'Ensure every risk uses category open|accepted|mitigated and close or re-plan overdue mitigations.',
  details: { parsed_rows: riskRows.length },
});

const allPass = validationChecks.every((check) => check.passed);
const remediationHints = validationChecks.filter((c) => !c.passed && c.remediation).map((c) => c.remediation);
const allFailureReasons = [
  ...validationChecks.filter((c) => !c.passed).map((c) => c.reason).filter(Boolean),
  ...staleEvidenceReasons,
  ...riskFailureReasons,
];

const status = allPass ? 'ready' : 'not_ready';
const { jsonPath, mdPath } = writeArtifacts({
  status,
  extra: {
    stale_evidence_reasons: [...new Set(staleEvidenceReasons)],
    remediation_hints: [...new Set(remediationHints)],
    failure_reasons: [...new Set(allFailureReasons)],
  },
});

if (status === 'not_ready') {
  console.error(`❌ Layer 5 readiness not ready. Artifacts:\n  - ${jsonPath}\n  - ${mdPath}`);
  process.exit(1);
}

console.log(`✅ Wrote Layer 5 readiness artifacts:\n  - ${jsonPath}\n  - ${mdPath}`);
