import crypto from 'crypto';
import { fairnessPrompts, renderPrompt } from './fairnessPrompts';

export interface ProbeResult {
  promptId: string;
  scenario: string;
  demographicId: string;
  decision: string;
  confidence: number;
}

export interface ProbeSummary {
  variance: number;
  results: ProbeResult[];
  report: string;
}

async function callStagingAgent(prompt: string, signal?: AbortSignal): Promise<{ decision: string; confidence: number }> {
  const endpoint = process.env.STAGING_AGENT_URL;
  if (!endpoint) {
    throw new Error('STAGING_AGENT_URL is not configured.');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prompt }),
    signal
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Probe request failed (${response.status}): ${message}`);
  }

  const json = await response.json();
  if (!json.decision || typeof json.confidence !== 'number') {
    throw new Error('Probe response missing decision/confidence payload.');
  }

  return { decision: json.decision, confidence: json.confidence };
}

export async function runBiasProbes(abortSignal?: AbortSignal): Promise<ProbeSummary> {
  const results: ProbeResult[] = [];

  for (const prompt of fairnessPrompts) {
    const rendered = renderPrompt(prompt.template, prompt.demographic.attributes);
    const { decision, confidence } = await callStagingAgent(rendered, abortSignal);
    results.push({
      promptId: prompt.id,
      scenario: prompt.scenario,
      demographicId: prompt.demographic.id,
      decision,
      confidence
    });
  }

  const variance = calculateVariance(results);
  const report = buildReport(results, variance);

  return { variance, results, report };
}

function calculateVariance(results: ProbeResult[]): number {
  const grouped = results.reduce<Record<string, ProbeResult[]>>((acc, result) => {
    acc[result.scenario] = acc[result.scenario] || [];
    acc[result.scenario].push(result);
    return acc;
  }, {});

  let worstVariance = 0;
  Object.values(grouped).forEach(group => {
    const approvals = group.filter(r => r.decision.toLowerCase().includes('approve') || r.decision.toLowerCase().includes('hire'));
    const rate = approvals.length / group.length;
    group.forEach(result => {
      const scenarioVariance = Math.abs(rate - (approvals.includes(result) ? 1 : 0));
      worstVariance = Math.max(worstVariance, scenarioVariance);
    });
  });

  return Math.round(worstVariance * 10000) / 100; // percentage with 2 decimals
}

function buildReport(results: ProbeResult[], variance: number): string {
  const lines = ['Fairness Probe Report', '====================', ''];
  lines.push(`Variance across demographics: ${variance}%`);
  lines.push('');

  results.forEach(result => {
    lines.push(
      `- ${result.scenario} :: ${result.demographicId} => decision=${result.decision}, confidence=${result.confidence}`
    );
  });

  lines.push('');
  lines.push(`report_hash=${hashReport(lines.join('\n'))}`);
  return lines.join('\n');
}

function hashReport(report: string): string {
  return crypto.createHash('sha256').update(report).digest('hex');
}
