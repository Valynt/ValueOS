#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE = 'docs/operations/oncall-drill-events.json';
const SCORECARD = 'docs/operations/oncall-drill-scorecard.md';
const TRENDS = 'docs/operations/oncall-drill-trends.json';

const sloTargets = {
  sev1_mttr_minutes: 30,
  sev2_mttr_minutes: 120,
};

const raw = JSON.parse(readFileSync(SOURCE, 'utf8'));
const drills = raw.drills ?? [];

const grouped = new Map();
for (const drill of drills) {
  const month = drill.date.slice(0, 7);
  const arr = grouped.get(month) ?? [];
  arr.push(drill);
  grouped.set(month, arr);
}

const monthly = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, items]) => {
  const mttr = items.reduce((sum, item) => sum + item.mttr_minutes, 0) / items.length;
  const sev1 = items.filter((i) => i.severity === 'SEV1');
  const sev2 = items.filter((i) => i.severity === 'SEV2');
  const sev1Mttr = sev1.length ? sev1.reduce((s, i) => s + i.mttr_minutes, 0) / sev1.length : null;
  const sev2Mttr = sev2.length ? sev2.reduce((s, i) => s + i.mttr_minutes, 0) / sev2.length : null;
  return {
    month,
    drills: items.length,
    mttr_minutes: Number(mttr.toFixed(1)),
    sev1_mttr_minutes: sev1Mttr === null ? null : Number(sev1Mttr.toFixed(1)),
    sev2_mttr_minutes: sev2Mttr === null ? null : Number(sev2Mttr.toFixed(1)),
    slo_pass: (sev1Mttr === null || sev1Mttr <= sloTargets.sev1_mttr_minutes) &&
      (sev2Mttr === null || sev2Mttr <= sloTargets.sev2_mttr_minutes),
  };
});

const latest = monthly.at(-1);
const scoreRows = drills
  .slice()
  .sort((a, b) => b.date.localeCompare(a.date))
  .map((drill) => {
    const target = drill.severity === 'SEV1' ? sloTargets.sev1_mttr_minutes : sloTargets.sev2_mttr_minutes;
    const status = drill.mttr_minutes <= target ? '✅ Within SLO' : '❌ Missed SLO';
    return `| ${drill.date} | ${drill.scenario} | ${drill.severity} | ${drill.mttr_minutes}m | ${target}m | ${status} |`;
  })
  .join('\n');

const trendRows = monthly
  .map((m) => `| ${m.month} | ${m.drills} | ${m.mttr_minutes}m | ${m.sev1_mttr_minutes ?? 'n/a'} | ${m.sev2_mttr_minutes ?? 'n/a'} | ${m.slo_pass ? '✅' : '❌'} |`)
  .join('\n');

const md = `---
owner: Platform Operations
escalation_path: 'On-call SRE -> Incident Commander -> Head of Engineering'
review_date: '2026-06-30'
---

# On-Call Drill Scorecard

This scorecard tracks drill MTTR against incident SLO targets and is auto-published by CI.

## SLO Targets

- **SEV1 MTTR target:** ${sloTargets.sev1_mttr_minutes} minutes
- **SEV2 MTTR target:** ${sloTargets.sev2_mttr_minutes} minutes

## Latest Status

- **Latest reporting month:** ${latest?.month ?? 'n/a'}
- **Overall SLO status:** ${latest?.slo_pass ? '✅ Within target' : '❌ Needs remediation'}

## Drill Records

| Date | Scenario | Severity | MTTR | SLO Target | Result |
|---|---|---|---:|---:|---|
${scoreRows}

## MTTR Trends by Month

| Month | Drills | Avg MTTR | SEV1 MTTR | SEV2 MTTR | SLO Pass |
|---|---:|---:|---:|---:|---|
${trendRows}
`;

writeFileSync(SCORECARD, md);
writeFileSync(TRENDS, JSON.stringify({ generated_at: new Date().toISOString(), sloTargets, monthly }, null, 2) + '\n');

console.log(`Updated ${SCORECARD} and ${TRENDS}`);
