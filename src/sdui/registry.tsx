import React from 'react';
import {
  DiscoveryCard,
  ExpansionBlock,
  InfoBanner,
  SectionErrorFallback,
  UnknownComponentFallback,
  ValueTreeCard,
  MetricBadge,
  KPIForm,
  ValueCommitForm,
  RealizationDashboard,
  LifecyclePanel,
  IntegrityReviewPanel,
  SideNavigation,
  TabBar,
  Breadcrumbs,
  DataTable,
  ConfidenceIndicator,
  AgentResponseCard,
  AgentWorkflowPanel,
  NarrativeBlock,
  SDUIForm,
  ScenarioSelector,
} from '../components/SDUI';
import {
  VerticalSplit,
  HorizontalSplit,
  Grid,
  DashboardPanel,
} from '../components/SDUI/CanvasLayout';
import { SDUIComponentSection } from './schema';

export interface RegistryEntry {
  component: React.ComponentType<any>;
  versions: number[];
  requiredProps?: string[];
  description?: string;
}

const baseRegistry: Record<string, RegistryEntry> = {
  // Layout components
  VerticalSplit: {
    component: VerticalSplit,
    versions: [1],
    requiredProps: ['ratios', 'children'],
    description: 'Vertical split layout with configurable ratios',
  },
  HorizontalSplit: {
    component: HorizontalSplit,
    versions: [1],
    requiredProps: ['ratios', 'children'],
    description: 'Horizontal split layout with configurable ratios',
  },
  Grid: {
    component: Grid,
    versions: [1],
    requiredProps: ['columns', 'children'],
    description: 'Responsive grid layout with configurable columns',
  },
  DashboardPanel: {
    component: DashboardPanel,
    versions: [1],
    requiredProps: ['children'],
    description: 'Collapsible panel container for dashboard sections',
  },
  
  // Existing components
  InfoBanner: {
    component: InfoBanner,
    versions: [1, 2],
    requiredProps: ['title'],
    description: 'High-level lifecycle banner for SDUI templates.',
  },
  DiscoveryCard: {
    component: DiscoveryCard,
    versions: [1, 2],
    requiredProps: ['questions'],
    description: 'Discovery prompts for opportunity framing.',
  },
  ValueTreeCard: {
    component: ValueTreeCard,
    versions: [1, 2],
    requiredProps: ['title', 'nodes'],
    description: 'Nested value drivers for target outcomes.',
  },
  ExpansionBlock: {
    component: ExpansionBlock,
    versions: [1, 2],
    requiredProps: ['gaps', 'roi'],
    description: 'ROI snapshot for expansion stage.',
  },

  // New components
  MetricBadge: {
    component: MetricBadge,
    versions: [1],
    requiredProps: ['label', 'value'],
    description: 'Displays a KPI label with numeric or percentage value.',
  },
  KPIForm: {
    component: KPIForm,
    versions: [1],
    requiredProps: ['kpiName', 'onSubmit'],
    description: 'Form for entering baseline and target values for a KPI.',
  },
  ValueCommitForm: {
    component: ValueCommitForm,
    versions: [1],
    requiredProps: ['kpis', 'onCommit'],
    description: 'Extended form for multiple KPI entries with assumptions.',
  },
  RealizationDashboard: {
    component: RealizationDashboard,
    versions: [1],
    requiredProps: [],
    description: 'Displays baseline vs. target vs. actual results for realized value.',
  },
  LifecyclePanel: {
    component: LifecyclePanel,
    versions: [1],
    requiredProps: ['stage', 'children'],
    description: 'Generic panel container for each lifecycle stage.',
  },
  IntegrityReviewPanel: {
    component: IntegrityReviewPanel,
    versions: [1],
    requiredProps: ['results'],
    description: 'Displays manifesto rule validation results.',
  },

  // Navigation components
  SideNavigation: {
    component: SideNavigation,
    versions: [1],
    requiredProps: ['items'],
    description: 'Collapsible sidebar navigation with workflow stages.',
  },
  TabBar: {
    component: TabBar,
    versions: [1],
    requiredProps: ['tabs'],
    description: 'Secondary navigation with neon green active indicator.',
  },
  Breadcrumbs: {
    component: Breadcrumbs,
    versions: [1],
    requiredProps: ['items'],
    description: 'Path indicators with separators for navigation hierarchy.',
  },

  // Data display components
  DataTable: {
    component: DataTable,
    versions: [1],
    requiredProps: ['data', 'columns'],
    description: 'Sortable, filterable data grid with pagination and virtual scrolling.',
  },
  ConfidenceIndicator: {
    component: ConfidenceIndicator,
    versions: [1],
    requiredProps: ['value'],
    description: 'Visual confidence meter for AI outputs (0-100%).',
  },

  // Agent-specific components
  AgentResponseCard: {
    component: AgentResponseCard,
    versions: [1],
    requiredProps: ['response'],
    description: 'Displays agent outputs with reasoning transparency and actions.',
  },
  AgentWorkflowPanel: {
    component: AgentWorkflowPanel,
    versions: [1],
    requiredProps: ['agents'],
    description: 'Shows active agents, collaboration status, and communication log.',
  },
  NarrativeBlock: {
    component: NarrativeBlock,
    versions: [1],
    requiredProps: ['title', 'content'],
    description: 'Displays AI-generated narrative content with optional editing and transparency.',
  },
  SDUIForm: {
    component: SDUIForm,
    versions: [1],
    requiredProps: ['id', 'onSubmit'],
    description: 'Dynamic form generation from JSON schema with validation and AI suggestions.',
  },
  ScenarioSelector: {
    component: ScenarioSelector,
    versions: [1],
    requiredProps: ['scenarios', 'onSelect'],
    description: 'Template/scenario selection interface with AI recommendations.',
  },
};

const registry = new Map<string, RegistryEntry>(Object.entries(baseRegistry));

export const RegistryPlaceholderComponent = UnknownComponentFallback;

export function listRegisteredComponents(): RegistryEntry[] {
  return Array.from(registry.values());
}

export function getRegistryEntry(name: string): RegistryEntry | undefined {
  return registry.get(name);
}

export function registerComponent(name: string, entry: RegistryEntry): void {
  registry.set(name, entry);
}

export function resetRegistry(): void {
  registry.clear();
  Object.entries(baseRegistry).forEach(([name, entry]) => registry.set(name, entry));
}

export function hotSwapComponent(name: string, component: React.ComponentType<any>): RegistryEntry | undefined {
  const current = registry.get(name);
  if (!current) return undefined;
  const updated: RegistryEntry = { ...current, component };
  registry.set(name, updated);
  return updated;
}

export function resolveComponent(section: SDUIComponentSection): RegistryEntry | undefined {
  const entry = registry.get(section.component);
  if (!entry) return undefined;
  if (!entry.versions.includes(section.version)) {
    return { ...entry, description: `${entry.description ?? ''} (coerced version)` };
  }
  return entry;
}

export const SectionErrorWrapper: React.FC<{ componentName: string; children: React.ReactNode }> = ({
  componentName,
  children,
}) => (
  <SectionErrorFallback componentName={componentName}>
    {children}
  </SectionErrorFallback>
);
