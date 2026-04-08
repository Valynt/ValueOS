#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { listAllCheckRuns, parseRepository } from './release-manifest-lib.mjs';

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function daysBetween(isoDate, now = new Date()) {
  const then = new Date(`${isoDate}T00:00:00Z`);
  const diff = now.getTime() - then.getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

function parseMinutes(value, field) {
  const match = String(value).trim().match(/^(\d+(?:\.\d+)?)m$/i);
  if (!match) {
    throw new Error(`Unable to parse minute value for ${field}: ${value}`);
  }
  return Number(match[1]);
}

function parseLatestMonthlyMttr(markdownPath) {
  const content = fs.readFileSync(markdownPath, 'utf8');
  const rows = [...content.matchAll(/^\|\s*(\d{4}-\d{2})\s*\|\s*\d+\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*$/gm)]
    .map((match) => ({
      month: match[1],
      avgMttrRaw: match[2].trim(),
      avgSloTargetRaw: match[3].trim(),
      sloAttainmentRaw: match[4].trim(),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  if (rows.length === 0) {
    throw new Error(`No monthly MTTR rows found in ${markdownPath}`);
  }

  const latest = rows[rows.length - 1];
  return {
    month: latest.month,
    avgMttrMinutes: parseMinutes(latest.avgMttrRaw, 'avgMttr'),
    avgSloTargetMinutes: parseMinutes(latest.avgSloTargetRaw, 'avgSloTarget'),
    sloAttainmentRaw: latest.sloAttainmentRaw,
  };
}

function parseLatestDrillDate(markdownPath) {
  const content = fs.readFileSync(markdownPath, 'utf8');
  const matches = [...content.matchAll(/^\|\s*(\d{4}-\d{2}-\d{2})\s*\|/gm)].map((m) => m[1]);
  if (matches.length === 0) {
    throw new Error(`No drill dates found in ${markdownPath}`);
  }

  return matches.sort().reverse()[0];
}

function readThresholdsFromGoNoGoCriteria(markdownPath) {
  const content = fs.readFileSync(markdownPath, 'utf8');
  const match = content.match(/```json\s+release-reliability-thresholds\s*\n([\s\S]*?)```/);
  if (!match) {
    throw new Error(`Missing release-reliability-thresholds JSON block in ${markdownPath}`);
  }

  return JSON.parse(match[1]);
}

function activeSloBurnRateAlerts({ alertmanagerUrl, alertmanagerToken, alertNameRegex }) {
  if (!alertmanagerUrl) {
    throw new Error('ALERTMANAGER_URL is required for SLO burn-rate snapshot evidence');
  }

  const authHeader = alertmanagerToken ? { Authorization: `Bearer ${alertmanagerToken}` } : {};
  const response = fetch(`${alertmanagerUrl.replace(/\/$/, '')}/api/v2/alerts`, {
    headers: authHeader,
  });

  return response.then(async (res) => {
    if (!res.ok) {
      throw new Error(`Alertmanager request failed with ${res.status}`);
    }

    const alerts = await res.json();
    const pattern = new RegExp(alertNameRegex);
    return alerts
      .filter((alert) => alert?.status?.state === 'active')
      .filter((alert) => pattern.test(String(alert?.labels?.alertname ?? '')))
      .map((alert) => ({
        alertname: String(alert?.labels?.alertname ?? 'unknown'),
        severity: String(alert?.labels?.severity ?? 'unknown'),
        summary: String(alert?.annotations?.summary ?? ''),
      }));
  });
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

async function main() {
  const token = requiredEnv('GITHUB_TOKEN');
  const repository = requiredEnv('GITHUB_REPOSITORY');
  const sha = requiredEnv('GITHUB_SHA');
  const alertmanagerUrl = process.env.ALERTMANAGER_URL ?? '';
  const alertmanagerToken = process.env.ALERTMANAGER_TOKEN ?? '';
  const alertNameRegex = process.env.SLO_ALERT_NAME_REGEX ?? '^SLOBurnRate_';

  const thresholdsPath = path.resolve('docs/go-no-go-criteria.md');
  const thresholds = readThresholdsFromGoNoGoCriteria(thresholdsPath);

  const { owner, repo } = parseRepository(repository);
  const checkRuns = await listAllCheckRuns({ owner, repo, sha, token });
  const byName = new Map(checkRuns.map((run) => [run.name, run]));

  const criticalChecks = Array.isArray(thresholds.deployment_health?.critical_checks)
    ? thresholds.deployment_health.critical_checks
    : [];
  if (criticalChecks.length === 0) {
    throw new Error('deployment_health.critical_checks thresholds are required');
  }

  let passedCritical = 0;
  const missingCritical = [];
  for (const name of criticalChecks) {
    const run = byName.get(name);
    if (!run) {
      missingCritical.push(name);
      continue;
    }
    if (run.status === 'completed' && run.conclusion === 'success') {
      passedCritical += 1;
    }
  }

  const consideredCritical = criticalChecks.length - missingCritical.length;
  const criticalPassRatePercent = consideredCritical > 0
    ? Number(((passedCritical / consideredCritical) * 100).toFixed(2))
    : 0;

  const flakeRunName = String(thresholds.deployment_health.flaky_check_name ?? 'flake-gate');
  const flakeRun = byName.get(flakeRunName);
  const flakyRatePercent = flakeRun?.status === 'completed' && flakeRun.conclusion === 'success' ? 0 : 100;

  const latestMonthlyMttr = parseLatestMonthlyMttr(path.resolve('docs/operations/on-call-drill-scorecard.md'));

  const latestDrillDate = parseLatestDrillDate(path.resolve('docs/operations/on-call-drill-scorecard.md'));
  const rollbackDrillAgeDays = daysBetween(latestDrillDate);

  const activeBurnAlerts = await activeSloBurnRateAlerts({
    alertmanagerUrl,
    alertmanagerToken,
    alertNameRegex,
  });

  const summary = {
    generated_at: new Date().toISOString(),
    source: {
      go_no_go_criteria: 'docs/go-no-go-criteria.md',
      drill_scorecard: 'docs/operations/on-call-drill-scorecard.md',
      github_sha: sha,
    },
    thresholds,
    snapshot: {
      slo_burn_rate: {
        active_alert_count: activeBurnAlerts.length,
        alerts: activeBurnAlerts,
      },
      recent_incident_mttr: latestMonthlyMttr,
      deployment_health_checks: {
        critical_checks: criticalChecks,
        missing_critical_checks: missingCritical,
        critical_pass_rate_percent: criticalPassRatePercent,
        flaky_check_name: flakeRunName,
        flaky_rate_percent: flakyRatePercent,
      },
      rollback_drill_status: {
        latest_drill_date: latestDrillDate,
        rollback_drill_age_days: rollbackDrillAgeDays,
      },
    },
    verdict: {
      passed: true,
      failures: [],
    },
  };

  const failures = [];
  if (activeBurnAlerts.length > Number(thresholds.slo_burn_rate.max_active_alerts)) {
    failures.push(
      `Active burn-rate alerts ${activeBurnAlerts.length} exceed max ${thresholds.slo_burn_rate.max_active_alerts}`,
    );
  }

  if (latestMonthlyMttr.avgMttrMinutes > Number(thresholds.recent_incident_mttr.max_avg_mttr_minutes)) {
    failures.push(
      `Recent incident MTTR ${latestMonthlyMttr.avgMttrMinutes}m exceeds max ${thresholds.recent_incident_mttr.max_avg_mttr_minutes}m`,
    );
  }

  if (missingCritical.length > 0) {
    failures.push(`Missing deployment health checks: ${missingCritical.join(', ')}`);
  }

  if (criticalPassRatePercent < Number(thresholds.deployment_health.minimum_critical_pass_rate_percent)) {
    failures.push(
      `Critical pass rate ${criticalPassRatePercent}% below minimum ${thresholds.deployment_health.minimum_critical_pass_rate_percent}%`,
    );
  }

  if (flakyRatePercent > Number(thresholds.deployment_health.maximum_flaky_rate_percent)) {
    failures.push(
      `Flaky rate ${flakyRatePercent}% exceeds max ${thresholds.deployment_health.maximum_flaky_rate_percent}%`,
    );
  }

  if (rollbackDrillAgeDays > Number(thresholds.rollback_drill.max_drill_age_days)) {
    failures.push(
      `Rollback drill age ${rollbackDrillAgeDays}d exceeds max ${thresholds.rollback_drill.max_drill_age_days}d`,
    );
  }

  summary.verdict = {
    passed: failures.length === 0,
    failures,
  };

  const summaryPath = path.resolve('artifacts/reliability/release-reliability-summary.json');
  ensureParentDir(summaryPath);
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.log(`Wrote release reliability summary: ${summaryPath}`);
  if (failures.length > 0) {
    console.error('❌ Release reliability indicators failed:');
    for (const item of failures) {
      console.error(`- ${item}`);
    }
    process.exit(1);
  }

  console.log('✅ Release reliability indicators satisfied.');
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});
