// ============================================================
// AGENTIC UI PRO — Recommendation Engine
// Rule-based prompt parsing + pattern/workflow recommendation
// ============================================================

import type {
  PromptIntent,
  Recommendation,
  QualityCheckItem,
  Pattern,
  Workflow,
  DataDensity,
  ComplexityLevel,
  PersonaType,
  WorkflowCategory,
  LayoutArchetype,
} from '@/types';
import { patterns } from '@/data/patterns';
import { workflows } from '@/data/workflows';
import { generateCode } from './codegen';

// ── Keyword maps ──────────────────────────────────────────────

const WORKFLOW_KEYWORDS: Record<WorkflowCategory, string[]> = {
  'ai-approval': ['approv', 'review', 'sign-off', 'sign off', 'validate', 'human-in-the-loop', 'hitl', 'proposal'],
  'proposal-review': ['proposal', 'draft', 'contract', 'document review'],
  'value-hypothesis': ['value hypothesis', 'business case', 'roi hypothesis', 'value assumption'],
  'customer-onboarding': ['onboard', 'setup', 'getting started', 'first time', 'activation'],
  'support-triage': ['support', 'ticket', 'triage', 'help desk', 'customer issue'],
  'incident-investigation': ['incident', 'outage', 'investigation', 'root cause', 'rca', 'postmortem'],
  'agent-monitoring': ['monitor', 'observ', 'run history', 'agent status', 'pipeline', 'orchestrat'],
  'model-governance': ['governance', 'compliance', 'policy', 'model usage', 'cost control', 'budget'],
  'admin-permissions': ['permission', 'access control', 'rbac', 'role', 'admin'],
  'business-review': ['qbr', 'business review', 'quarterly', 'executive review', 'stakeholder'],
};

const PERSONA_KEYWORDS: Record<PersonaType, string[]> = {
  'ai-engineer': ['engineer', 'developer', 'technical', 'debug', 'pipeline', 'model', 'llm', 'agent'],
  'product-manager': ['product', 'roadmap', 'feature', 'adoption', 'metrics', 'pm'],
  'ops-analyst': ['operations', 'ops', 'analyst', 'workflow', 'process', 'sla', 'queue'],
  'customer-success': ['customer success', 'csm', 'churn', 'renewal', 'health score', 'account'],
  'data-scientist': ['data science', 'model evaluation', 'experiment', 'dataset', 'validation'],
  'enterprise-admin': ['admin', 'enterprise', 'compliance', 'audit', 'governance', 'security'],
  'developer': ['developer', 'api', 'integration', 'sdk', 'code', 'build'],
  'executive': ['executive', 'ceo', 'cto', 'vp', 'director', 'roi', 'board', 'strategic'],
};

const DENSITY_KEYWORDS: Record<DataDensity, string[]> = {
  'low': ['simple', 'clean', 'minimal', 'overview', 'summary', 'executive'],
  'medium': ['balanced', 'standard', 'typical'],
  'high': ['detailed', 'comprehensive', 'analytics', 'metrics', 'data'],
  'ultra-dense': ['dense', 'technical', 'debug', 'log', 'trace', 'raw data', 'engineering'],
};

const TRUST_KEYWORDS = [
  'trust', 'explain', 'reasoning', 'confidence', 'evidence', 'transparent', 'audit',
  'compliance', 'governance', 'accountability', 'provenance', 'xai', 'explainable',
  'justify', 'rationale', 'why', 'how did', 'source', 'citation',
];

const AGENTIC_KEYWORDS = [
  'agent', 'ai', 'llm', 'model', 'automated', 'automation', 'orchestrat', 'pipeline',
  'copilot', 'assistant', 'recommendation', 'prediction', 'generate', 'intelligent',
];

// ── Intent Parser ─────────────────────────────────────────────

export function parsePromptIntent(rawPrompt: string): PromptIntent {
  const lower = rawPrompt.toLowerCase();
  const words = lower.split(/\s+/);

  // Detect workflow
  let workflow: WorkflowCategory | null = null;
  let maxWorkflowScore = 0;
  for (const [cat, keywords] of Object.entries(WORKFLOW_KEYWORDS)) {
    const score = keywords.filter(kw => lower.includes(kw)).length;
    if (score > maxWorkflowScore) {
      maxWorkflowScore = score;
      workflow = cat as WorkflowCategory;
    }
  }
  if (maxWorkflowScore === 0) workflow = null;

  // Detect persona
  let persona: PersonaType | null = null;
  let maxPersonaScore = 0;
  for (const [p, keywords] of Object.entries(PERSONA_KEYWORDS)) {
    const score = keywords.filter(kw => lower.includes(kw)).length;
    if (score > maxPersonaScore) {
      maxPersonaScore = score;
      persona = p as PersonaType;
    }
  }
  if (maxPersonaScore === 0) persona = null;

  // Detect density
  let dataDensity: DataDensity = 'medium';
  let maxDensityScore = 0;
  for (const [d, keywords] of Object.entries(DENSITY_KEYWORDS)) {
    const score = keywords.filter(kw => lower.includes(kw)).length;
    if (score > maxDensityScore) {
      maxDensityScore = score;
      dataDensity = d as DataDensity;
    }
  }

  // Detect complexity
  let complexity: ComplexityLevel = 'moderate';
  if (lower.includes('enterprise') || lower.includes('governance') || lower.includes('multi-agent')) {
    complexity = 'enterprise';
  } else if (lower.includes('complex') || lower.includes('advanced') || lower.includes('comprehensive')) {
    complexity = 'complex';
  } else if (lower.includes('simple') || lower.includes('basic') || lower.includes('quick')) {
    complexity = 'simple';
  }

  const trustNeeds = TRUST_KEYWORDS.some(kw => lower.includes(kw));
  const agenticNeeds = AGENTIC_KEYWORDS.some(kw => lower.includes(kw));

  // Extract product context (first sentence or key noun phrase)
  const productContext = rawPrompt.split(/[.!?]/)[0].trim();

  // Extract page intent
  const pageIntent = detectPageIntent(lower);

  // Keywords for scoring
  const keywords = words.filter(w => w.length > 3);

  return {
    rawPrompt,
    productContext,
    workflow,
    persona,
    pageIntent,
    dataDensity,
    complexity,
    trustNeeds,
    agenticNeeds,
    keywords,
  };
}

function detectPageIntent(lower: string): string {
  if (lower.includes('dashboard') || lower.includes('overview') || lower.includes('monitor')) return 'dashboard';
  if (lower.includes('approv') || lower.includes('review') || lower.includes('queue')) return 'approval-review';
  if (lower.includes('onboard') || lower.includes('setup') || lower.includes('wizard')) return 'onboarding';
  if (lower.includes('analytics') || lower.includes('report') || lower.includes('chart')) return 'analytics';
  if (lower.includes('admin') || lower.includes('setting') || lower.includes('config')) return 'settings-admin';
  if (lower.includes('chat') || lower.includes('workspace') || lower.includes('copilot')) return 'agent-workspace';
  if (lower.includes('roi') || lower.includes('value') || lower.includes('business case')) return 'value-roi';
  if (lower.includes('orchestrat') || lower.includes('pipeline') || lower.includes('workflow')) return 'orchestration';
  if (lower.includes('knowledge') || lower.includes('memory') || lower.includes('rag')) return 'knowledge-memory';
  if (lower.includes('explain') || lower.includes('trust') || lower.includes('audit')) return 'trust-explainability';
  return 'dashboard';
}

// ── Pattern Scoring ───────────────────────────────────────────

function scorePatternForIntent(pattern: Pattern, intent: PromptIntent): number {
  let score = 0;
  const lower = intent.rawPrompt.toLowerCase();

  // Category match
  if (pattern.category === intent.pageIntent) score += 15;

  // Persona match
  if (intent.persona && pattern.personaFit.includes(intent.persona)) score += 10;

  // Density match
  if (pattern.dataDensity === intent.dataDensity) score += 5;

  // Complexity match
  if (pattern.complexity === intent.complexity) score += 5;

  // Trust needs
  if (intent.trustNeeds && (
    pattern.category === 'trust-explainability' ||
    pattern.agenticCapabilities.some(c => c.includes('trust') || c.includes('confidence') || c.includes('reasoning'))
  )) score += 8;

  // Agentic needs
  if (intent.agenticNeeds && pattern.agenticCapabilities.length > 0) score += 5;

  // Keyword overlap
  for (const kw of intent.keywords) {
    if (pattern.name.toLowerCase().includes(kw)) score += 3;
    if (pattern.tags.some(t => t.toLowerCase().includes(kw))) score += 2;
    if (pattern.summary.toLowerCase().includes(kw)) score += 1;
    if (pattern.agenticCapabilities.some(c => c.toLowerCase().includes(kw))) score += 2;
  }

  return score;
}

// ── Layout Recommendation ─────────────────────────────────────

function recommendLayout(intent: PromptIntent): LayoutArchetype {
  const { pageIntent, dataDensity, complexity } = intent;

  if (pageIntent === 'orchestration' || (dataDensity === 'ultra-dense' && complexity === 'enterprise')) {
    return 'command-center';
  }
  if (pageIntent === 'agent-workspace') return 'three-column';
  if (pageIntent === 'approval-review') return 'three-column';
  if (pageIntent === 'onboarding') return 'wizard-stepper';
  if (pageIntent === 'settings-admin') return 'sidebar-main';
  if (pageIntent === 'knowledge-memory') return 'three-column';
  if (dataDensity === 'ultra-dense') return 'full-width-dashboard';
  if (pageIntent === 'dashboard' || pageIntent === 'analytics' || pageIntent === 'value-roi') {
    return 'full-width-dashboard';
  }
  return 'sidebar-main';
}

// ── Page Archetype ────────────────────────────────────────────

function getPageArchetype(intent: PromptIntent): string {
  const map: Record<string, string> = {
    'dashboard': 'Command Center Dashboard',
    'approval-review': 'Human-in-the-Loop Review Queue',
    'onboarding': 'Guided Setup Wizard',
    'analytics': 'Analytics & Observability Dashboard',
    'settings-admin': 'Admin Console',
    'agent-workspace': 'Agent Chat Workspace',
    'value-roi': 'Value Realization Dashboard',
    'orchestration': 'Multi-Agent Orchestration View',
    'knowledge-memory': 'Knowledge & Memory Browser',
    'trust-explainability': 'Explainable AI Output Panel',
  };
  return map[intent.pageIntent] || 'SaaS Dashboard';
}

// ── Quality Checklist ─────────────────────────────────────────

export const qualityChecklist: QualityCheckItem[] = [
  { id: 'qc-1', label: 'Responsive layout', description: 'Works on desktop, tablet, and mobile viewports', category: 'ux', required: true },
  { id: 'qc-2', label: 'Keyboard navigable', description: 'All interactive elements reachable and operable via keyboard', category: 'accessibility', required: true },
  { id: 'qc-3', label: 'Loading states', description: 'All async operations have loading indicators', category: 'ux', required: true },
  { id: 'qc-4', label: 'Empty states', description: 'Meaningful empty states for all list/data views', category: 'ux', required: true },
  { id: 'qc-5', label: 'Error states', description: 'Clear error messages with recovery actions', category: 'ux', required: true },
  { id: 'qc-6', label: 'Destructive action safety', description: 'Destructive actions require confirmation dialog', category: 'ux', required: true },
  { id: 'qc-7', label: 'Auditability', description: 'All significant actions are logged with actor and timestamp', category: 'governance', required: false },
  { id: 'qc-8', label: 'Confidence/explanation surfaces', description: 'AI outputs show confidence level and reasoning', category: 'agentic', required: false },
  { id: 'qc-9', label: 'Role clarity', description: 'User role and permissions are visible in the interface', category: 'governance', required: false },
  { id: 'qc-10', label: 'Accessibility contrast', description: 'Text meets WCAG AA contrast requirements (4.5:1)', category: 'accessibility', required: true },
  { id: 'qc-11', label: 'Consistent CTA hierarchy', description: 'Primary, secondary, and destructive CTAs are visually distinct', category: 'ux', required: true },
  { id: 'qc-12', label: 'Human override available', description: 'Users can always override AI decisions', category: 'agentic', required: false },
  { id: 'qc-13', label: 'Data freshness indicator', description: 'Real-time or cached data shows last updated timestamp', category: 'ux', required: false },
  { id: 'qc-14', label: 'Focus management', description: 'Focus moves correctly after dialogs, drawers, and route changes', category: 'accessibility', required: true },
  { id: 'qc-15', label: 'Performance budget', description: 'Initial load < 3s; interactions < 100ms', category: 'performance', required: false },
];

// ── Main Recommendation Function ──────────────────────────────

export function generateRecommendation(rawPrompt: string): Recommendation {
  const intent = parsePromptIntent(rawPrompt);

  // Score and rank patterns
  const scoredPatterns = patterns
    .map(p => ({ pattern: p, score: scorePatternForIntent(p, intent) }))
    .sort((a, b) => b.score - a.score);

  const recommendedPatterns = scoredPatterns.slice(0, 4).map(r => r.pattern);

  // Find matching workflow
  let recommendedWorkflow: Workflow | null = null;
  if (intent.workflow) {
    recommendedWorkflow = workflows.find(w => w.category === intent.workflow) || null;
  }
  if (!recommendedWorkflow) {
    // Fall back to highest-scoring workflow by keyword overlap
    const scoredWorkflows = workflows
      .map(w => {
        let score = 0;
        for (const kw of intent.keywords) {
          if (w.name.toLowerCase().includes(kw)) score += 3;
          if (w.tags.some(t => t.toLowerCase().includes(kw))) score += 2;
          if (w.summary.toLowerCase().includes(kw)) score += 1;
        }
        return { workflow: w, score };
      })
      .sort((a, b) => b.score - a.score);
    if (scoredWorkflows[0]?.score > 0) {
      recommendedWorkflow = scoredWorkflows[0].workflow;
    }
  }

  // Build component bundle
  const componentBundle = Array.from(new Set(
    recommendedPatterns.flatMap(p => p.shadcnMapping.map(m => m.component))
  )).slice(0, 12);

  // Build sections
  const sections = Array.from(new Set(
    recommendedPatterns.flatMap(p => p.exampleSections)
  )).slice(0, 8);

  // Design rationale
  const rationale = buildRationale(intent, recommendedPatterns);

  // Trust suggestions
  const trustSuggestions = buildTrustSuggestions(intent);

  // Governance suggestions
  const governanceSuggestions = buildGovernanceSuggestions(intent);

  // Confidence score (based on how well intent was parsed)
  const confidence = calculateConfidence(intent, scoredPatterns[0]?.score || 0);

  // Generate code
  const generatedCode = generateCode(intent, recommendedPatterns[0], recommendLayout(intent));

  return {
    id: `rec-${Date.now()}`,
    promptIntent: intent,
    pageArchetype: getPageArchetype(intent),
    layoutArchetype: recommendLayout(intent),
    recommendedPatterns,
    recommendedWorkflow,
    componentBundle,
    sections,
    designRationale: rationale,
    trustSuggestions,
    governanceSuggestions,
    qualityChecklist: qualityChecklist.filter(item =>
      item.required || (intent.trustNeeds && item.category === 'agentic') || (intent.agenticNeeds && item.category === 'agentic')
    ),
    generatedCode,
    confidence,
  };
}

function buildRationale(intent: PromptIntent, topPatterns: Pattern[]): string {
  const parts: string[] = [];

  parts.push(`Based on your prompt, the recommended page archetype is **${getPageArchetype(intent)}** with a **${recommendLayout(intent).replace(/-/g, ' ')}** layout.`);

  if (intent.persona) {
    parts.push(`This is optimized for the **${intent.persona.replace(/-/g, ' ')}** persona, who typically needs ${intent.dataDensity} data density.`);
  }

  if (intent.trustNeeds) {
    parts.push(`Trust and explainability surfaces are recommended because your prompt indicates a need for AI transparency and confidence indicators.`);
  }

  if (topPatterns.length > 0) {
    parts.push(`The top recommended pattern is **${topPatterns[0].name}**, which maps well to your described use case.`);
  }

  if (intent.workflow) {
    parts.push(`The **${intent.workflow.replace(/-/g, ' ')}** workflow blueprint provides a structured multi-step implementation path.`);
  }

  return parts.join(' ');
}

function buildTrustSuggestions(intent: PromptIntent): string[] {
  const suggestions: string[] = [];

  if (intent.trustNeeds || intent.agenticNeeds) {
    suggestions.push('Add confidence indicators to all AI-generated content');
    suggestions.push('Include a reasoning trace panel for complex AI decisions');
    suggestions.push('Provide source citations for all AI recommendations');
  }

  if (intent.pageIntent === 'approval-review') {
    suggestions.push('Show AI confidence score prominently in the review interface');
    suggestions.push('Make the AI reasoning trace accessible without extra clicks');
    suggestions.push('Always provide a human override path');
  }

  if (intent.complexity === 'enterprise' || intent.complexity === 'complex') {
    suggestions.push('Implement an immutable audit log for all AI actions');
    suggestions.push('Show data freshness indicators on all AI-derived metrics');
  }

  if (suggestions.length === 0) {
    suggestions.push('Label all AI-generated content clearly');
    suggestions.push('Provide confidence levels for AI recommendations');
  }

  return suggestions;
}

function buildGovernanceSuggestions(intent: PromptIntent): string[] {
  const suggestions: string[] = [];

  if (intent.complexity === 'enterprise') {
    suggestions.push('Implement role-based access control for all sensitive features');
    suggestions.push('Require two-step confirmation for destructive or high-impact actions');
    suggestions.push('Log all user actions with actor, timestamp, and outcome');
  }

  if (intent.pageIntent === 'settings-admin') {
    suggestions.push('Version all configuration changes with rollback capability');
    suggestions.push('Require approval for policy changes affecting multiple users');
  }

  if (intent.trustNeeds) {
    suggestions.push('Implement an audit trail for all AI decisions');
    suggestions.push('Provide data lineage for all AI-derived insights');
  }

  return suggestions;
}

function calculateConfidence(intent: PromptIntent, topScore: number): number {
  let confidence = 50;

  if (intent.workflow) confidence += 15;
  if (intent.persona) confidence += 10;
  if (topScore > 20) confidence += 15;
  else if (topScore > 10) confidence += 8;
  if (intent.keywords.length > 5) confidence += 5;
  if (intent.trustNeeds || intent.agenticNeeds) confidence += 5;

  return Math.min(confidence, 95);
}
