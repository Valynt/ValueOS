// ============================================================
// AGENTIC UI PRO — Domain Model Types
// Design: Obsidian Enterprise
// ============================================================

export type DataDensity = 'low' | 'medium' | 'high' | 'ultra-dense';

export type InteractionMode =
  | 'read-only'
  | 'command-driven'
  | 'conversational'
  | 'approval-gated'
  | 'form-driven'
  | 'exploratory';

export type ComplexityLevel = 'simple' | 'moderate' | 'complex' | 'enterprise';

export type PatternCategory =
  | 'dashboard'
  | 'agent-workspace'
  | 'approval-review'
  | 'settings-admin'
  | 'onboarding'
  | 'analytics'
  | 'value-roi'
  | 'orchestration'
  | 'knowledge-memory'
  | 'trust-explainability'
  | 'tables-data'
  | 'forms-wizards'
  | 'side-panels'
  | 'command-surfaces';

export type WorkflowCategory =
  | 'ai-approval'
  | 'proposal-review'
  | 'value-hypothesis'
  | 'customer-onboarding'
  | 'support-triage'
  | 'incident-investigation'
  | 'agent-monitoring'
  | 'model-governance'
  | 'admin-permissions'
  | 'business-review';

export type PersonaType =
  | 'ai-engineer'
  | 'product-manager'
  | 'ops-analyst'
  | 'customer-success'
  | 'data-scientist'
  | 'enterprise-admin'
  | 'developer'
  | 'executive';

export type LayoutArchetype =
  | 'full-width-dashboard'
  | 'sidebar-main'
  | 'split-pane'
  | 'command-center'
  | 'wizard-stepper'
  | 'side-panel-overlay'
  | 'three-column'
  | 'full-screen-workspace';

export interface ShadcnComponentMapping {
  component: string;
  usage: string;
}

export interface Pattern {
  id: string;
  name: string;
  summary: string;
  category: PatternCategory;
  tags: string[];
  idealUseCases: string[];
  recommendedComponents: string[];
  layoutStructure: string;
  layoutArchetype: LayoutArchetype;
  interactionNotes: string;
  trustAccessibilityNotes: string;
  shadcnMapping: ShadcnComponentMapping[];
  exampleSections: string[];
  complexity: ComplexityLevel;
  dataDensity: DataDensity;
  personaFit: PersonaType[];
  interactionMode: InteractionMode;
  agenticCapabilities: string[];
  antiPatterns: string[];
  copyGuidance: string;
  implementationNotes: string;
  anatomy: string[];
  whyWhenToUse: string;
}

export interface WorkflowStage {
  id: string;
  name: string;
  description: string;
  patternIds: string[];
  components: string[];
  agentRole: string;
  humanRole: string;
  trustConsiderations: string;
}

export interface Workflow {
  id: string;
  name: string;
  summary: string;
  category: WorkflowCategory;
  tags: string[];
  stages: WorkflowStage[];
  personaFit: PersonaType[];
  complexity: ComplexityLevel;
  agenticCapabilities: string[];
  trustPatterns: string[];
  layoutRecommendation: LayoutArchetype;
  shadcnComponents: string[];
  implementationNotes: string;
  successMetrics: string[];
}

export interface Persona {
  id: PersonaType;
  name: string;
  description: string;
  primaryGoals: string[];
  commonWorkflows: WorkflowCategory[];
  preferredPatterns: PatternCategory[];
  densityPreference: DataDensity;
}

// ============================================================
// Recommendation Engine Types
// ============================================================

export interface PromptIntent {
  rawPrompt: string;
  productContext: string;
  workflow: WorkflowCategory | null;
  persona: PersonaType | null;
  pageIntent: string;
  dataDensity: DataDensity;
  complexity: ComplexityLevel;
  trustNeeds: boolean;
  agenticNeeds: boolean;
  keywords: string[];
}

export interface QualityCheckItem {
  id: string;
  label: string;
  description: string;
  category: 'accessibility' | 'ux' | 'agentic' | 'governance' | 'performance';
  required: boolean;
}

export interface Recommendation {
  id: string;
  promptIntent: PromptIntent;
  pageArchetype: string;
  layoutArchetype: LayoutArchetype;
  recommendedPatterns: Pattern[];
  recommendedWorkflow: Workflow | null;
  componentBundle: string[];
  sections: string[];
  designRationale: string;
  trustSuggestions: string[];
  governanceSuggestions: string[];
  qualityChecklist: QualityCheckItem[];
  generatedCode: string;
  confidence: number; // 0-100
}

export interface CodeTemplate {
  id: string;
  name: string;
  patternId: string;
  layoutArchetype: LayoutArchetype;
  code: string;
  description: string;
  shadcnDependencies: string[];
}

// ============================================================
// Search & Filter Types
// ============================================================

export interface SearchFilters {
  query: string;
  categories: PatternCategory[];
  personas: PersonaType[];
  interactionModes: InteractionMode[];
  densities: DataDensity[];
  agenticCapabilities: string[];
  complexities: ComplexityLevel[];
}

export interface SearchResult {
  patterns: Pattern[];
  workflows: Workflow[];
  totalCount: number;
}
