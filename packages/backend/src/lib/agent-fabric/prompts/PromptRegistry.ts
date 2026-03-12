export type PromptRiskClass = 'low' | 'medium' | 'high' | 'critical';

export interface PromptApprovalMetadata {
  owner: string;
  ticket: string;
  risk_class: PromptRiskClass;
  approved_at: string;
}

export interface PromptTemplateVersion {
  prompt_key: string;
  version: string;
  template: string;
  immutable: true;
  created_at: string;
  status: 'draft' | 'approved' | 'deprecated';
  approval?: PromptApprovalMetadata;
}

export interface PromptVersionReference {
  prompt_key: string;
  version: string;
  owner?: string;
  ticket?: string;
  risk_class?: PromptRiskClass;
}

export interface PromptResolveOptions {
  promptKey: string;
  version?: string;
  environment?: string;
}

const promptRegistry = new Map<string, readonly PromptTemplateVersion[]>();
const activePromptVersions = new Map<string, string>();

function getEnvironment(optionsEnvironment?: string): string {
  return (optionsEnvironment ?? process.env.NODE_ENV ?? 'development').toLowerCase();
}

function isProductionEnvironment(environment: string): boolean {
  return environment === 'production';
}

function assertActivationApproval(approval: PromptApprovalMetadata | undefined): asserts approval is PromptApprovalMetadata {
  if (!approval || !approval.owner || !approval.ticket || !approval.risk_class) {
    throw new Error('Prompt activation requires owner, ticket, and risk class approval metadata.');
  }
}

function registerPromptTemplateVersions(promptKey: string, versions: readonly PromptTemplateVersion[]): void {
  const frozenVersions = Object.freeze(versions.map((version) => Object.freeze({ ...version })));
  promptRegistry.set(promptKey, frozenVersions);
}

export function activatePromptVersion(promptKey: string, version: string, approval: PromptApprovalMetadata): void {
  assertActivationApproval(approval);

  const versions = promptRegistry.get(promptKey);
  if (!versions) {
    throw new Error(`Cannot activate unknown prompt key: ${promptKey}`);
  }

  const match = versions.find((candidate) => candidate.version === version);
  if (!match) {
    throw new Error(`Cannot activate unknown prompt version ${promptKey}@${version}`);
  }

  if (match.status !== 'approved') {
    throw new Error(`Cannot activate unapproved prompt version ${promptKey}@${version}`);
  }

  activePromptVersions.set(promptKey, version);
}

export function resolvePromptTemplate(options: PromptResolveOptions): {
  template: string;
  reference: PromptVersionReference;
} {
  const environment = getEnvironment(options.environment);
  const versions = promptRegistry.get(options.promptKey);

  if (!versions || versions.length === 0) {
    throw new Error(`Unknown prompt key: ${options.promptKey}`);
  }

  const requestedVersion = options.version ?? activePromptVersions.get(options.promptKey);
  const resolved = requestedVersion
    ? versions.find((candidate) => candidate.version === requestedVersion)
    : versions.find((candidate) => candidate.status === 'approved');

  if (!resolved) {
    throw new Error(`No prompt version available for ${options.promptKey}`);
  }

  const approved = resolved.status === 'approved' && !!resolved.approval;
  if (isProductionEnvironment(environment) && !approved) {
    throw new Error(
      `Blocked prompt ${options.promptKey}@${resolved.version} in production because it is not approved.`,
    );
  }

  if (isProductionEnvironment(environment) && options.version && options.version !== resolved.version) {
    throw new Error(`Blocked unknown prompt version ${options.promptKey}@${options.version} in production.`);
  }

  return {
    template: resolved.template,
    reference: {
      prompt_key: resolved.prompt_key,
      version: resolved.version,
      owner: resolved.approval?.owner,
      ticket: resolved.approval?.ticket,
      risk_class: resolved.approval?.risk_class,
    },
  };
}

registerPromptTemplateVersions('opportunity.system.base', [{ prompt_key: 'opportunity.system.base', version: '1.0.0', template: `You are a Value Engineering analyst. Your job is to identify specific, measurable value hypotheses for a B2B prospect.

Rules:
- Each hypothesis must have a concrete estimated_impact range (low/high) with units.
- Evidence must reference specific, verifiable facts — not generic claims.
- Confidence scores reflect how well-supported the hypothesis is (0.0–1.0).
- Categories: revenue_growth, cost_reduction, risk_mitigation, operational_efficiency, strategic_advantage.
- KPI targets should be specific metrics the prospect can track.
- Stakeholder roles should map to real buying committee positions.

Respond with valid JSON matching the schema. Do not include markdown fences or commentary.`, immutable: true, created_at: '2026-03-12T00:00:00.000Z', status: 'approved', approval: { owner: 'value-engineering-platform', ticket: 'ENG-8211', risk_class: 'medium', approved_at: '2026-03-12T00:00:00.000Z' } }]);
registerPromptTemplateVersions('opportunity.system.grounding', [{ prompt_key: 'opportunity.system.grounding', version: '1.0.0', template: `

Grounding data for {{ entityName }} ({{ period }}):
{{ metricsStr }}{{ benchmarksSection }}

Use this data to ground your hypotheses. Reference specific metrics and benchmarks in evidence fields.`, immutable: true, created_at: '2026-03-12T00:00:00.000Z', status: 'approved', approval: { owner: 'value-engineering-platform', ticket: 'ENG-8211', risk_class: 'high', approved_at: '2026-03-12T00:00:00.000Z' } }]);
registerPromptTemplateVersions('opportunity.system.benchmarks', [{ prompt_key: 'opportunity.system.benchmarks', version: '1.0.0', template: `

Industry benchmarks:
{{ benchStr }}`, immutable: true, created_at: '2026-03-12T00:00:00.000Z', status: 'approved', approval: { owner: 'value-engineering-platform', ticket: 'ENG-8211', risk_class: 'medium', approved_at: '2026-03-12T00:00:00.000Z' } }]);
registerPromptTemplateVersions('opportunity.user.analysis-request', [{ prompt_key: 'opportunity.user.analysis-request', version: '1.0.0', template: `Analyze this opportunity and generate value hypotheses:

{{query}}

{{additionalContext}}

Generate a JSON object with:
- company_summary: Brief summary of the company/opportunity
- industry_context: Industry dynamics relevant to value creation
- hypotheses: Array of 3-5 value hypotheses with estimated impact, evidence, assumptions, and KPI targets
- stakeholder_roles: Key buying committee roles with their concerns
- recommended_next_steps: 3-5 concrete next actions`, immutable: true, created_at: '2026-03-12T00:00:00.000Z', status: 'approved', approval: { owner: 'value-engineering-platform', ticket: 'ENG-8211', risk_class: 'medium', approved_at: '2026-03-12T00:00:00.000Z' } }]);
registerPromptTemplateVersions('target.system.kpi-generation', [{ prompt_key: 'target.system.kpi-generation', version: '1.0.0', template: `You are a Value Engineering analyst specializing in KPI definition and financial modeling.

Given the following value hypotheses from the Opportunity stage, generate:
1. Measurable KPI definitions with baselines, targets, and measurement methods
2. A value driver tree showing how KPIs roll up to business outcomes
3. Financial model inputs for ROI calculation
4. A measurement plan
5. Key risks

Rules:
- Each KPI must link to a specific hypothesis via hypothesis_id
- Baselines must be realistic and sourced
- Targets must be achievable within the stated timeframe
- Value driver tree uses root/branch/leaf hierarchy
- Financial model inputs must include sensitivity variables
- Respond with valid JSON matching the schema. No markdown fences.

Hypotheses:
{{hypothesisContext}}`, immutable: true, created_at: '2026-03-12T00:00:00.000Z', status: 'approved', approval: { owner: 'value-engineering-platform', ticket: 'ENG-8212', risk_class: 'medium', approved_at: '2026-03-12T00:00:00.000Z' } }]);
registerPromptTemplateVersions('target.user.generate-targets', [{ prompt_key: 'target.user.generate-targets', version: '1.0.0', template: `Generate KPI targets and financial model inputs for these hypotheses.

Hypothesis IDs to reference: {{hypothesisIds}}

{{additionalContext}}

Generate a JSON object with:
- kpi_definitions: Array of KPI definitions with baselines and targets
- value_driver_tree: Hierarchical tree of value drivers (root → branch → leaf)
- financial_model_inputs: Array of model inputs for ROI calculation
- measurement_plan: How to track and verify these KPIs
- risks: Key risks to achieving targets`, immutable: true, created_at: '2026-03-12T00:00:00.000Z', status: 'approved', approval: { owner: 'value-engineering-platform', ticket: 'ENG-8212', risk_class: 'medium', approved_at: '2026-03-12T00:00:00.000Z' } }]);
registerPromptTemplateVersions('compliance.system.audit-summary', [{ prompt_key: 'compliance.system.audit-summary', version: '1.0.0', template: `You are a compliance auditor. Review control evidence counts and observations for tenant {{tenantId}}.\nEvidence counts: {{counts}}\nObservations: {{observations}}\nReturn JSON with summary, control_gaps, control_coverage_score, recommended_actions.`, immutable: true, created_at: '2026-03-12T00:00:00.000Z', status: 'approved', approval: { owner: 'compliance-automation', ticket: 'GRC-447', risk_class: 'high', approved_at: '2026-03-12T00:00:00.000Z' } }]);

activatePromptVersion('opportunity.system.base', '1.0.0', { owner: 'value-engineering-platform', ticket: 'ENG-8211', risk_class: 'medium', approved_at: '2026-03-12T00:00:00.000Z' });
activatePromptVersion('opportunity.system.grounding', '1.0.0', { owner: 'value-engineering-platform', ticket: 'ENG-8211', risk_class: 'high', approved_at: '2026-03-12T00:00:00.000Z' });
activatePromptVersion('opportunity.system.benchmarks', '1.0.0', { owner: 'value-engineering-platform', ticket: 'ENG-8211', risk_class: 'medium', approved_at: '2026-03-12T00:00:00.000Z' });
activatePromptVersion('opportunity.user.analysis-request', '1.0.0', { owner: 'value-engineering-platform', ticket: 'ENG-8211', risk_class: 'medium', approved_at: '2026-03-12T00:00:00.000Z' });
activatePromptVersion('target.system.kpi-generation', '1.0.0', { owner: 'value-engineering-platform', ticket: 'ENG-8212', risk_class: 'medium', approved_at: '2026-03-12T00:00:00.000Z' });
activatePromptVersion('target.user.generate-targets', '1.0.0', { owner: 'value-engineering-platform', ticket: 'ENG-8212', risk_class: 'medium', approved_at: '2026-03-12T00:00:00.000Z' });
activatePromptVersion('compliance.system.audit-summary', '1.0.0', { owner: 'compliance-automation', ticket: 'GRC-447', risk_class: 'high', approved_at: '2026-03-12T00:00:00.000Z' });
