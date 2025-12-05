import { SDUIPageDefinition } from './schema';

/**
 * Opportunity Stage Template
 * 
 * Purpose: Discover and frame business problems
 * Key Activities:
 * - Persona research
 * - Value discovery
 * - Feature → Outcome mapping
 * - Initial opportunity modeling
 */
export const OpportunityTemplate: SDUIPageDefinition = {
  type: 'page',
  version: 1,
  sections: [
    {
      type: 'component',
      component: 'InfoBanner',
      version: 1,
      props: {
        title: 'Opportunity Discovery',
        description: 'Identify and frame business problems with potential value',
        tone: 'info',
      },
    },
    {
      type: 'component',
      component: 'DiscoveryCard',
      version: 1,
      props: {
        title: 'Discovery Questions',
        prompt: 'Answer these questions to frame the opportunity',
        questions: [
          'What business problem are we solving?',
          'Who is the primary persona affected?',
          'What are the current pain points?',
          'What KPIs could be improved?',
          'What is the strategic goal?',
          'What capabilities are needed?',
        ],
      },
    },
    {
      type: 'component',
      component: 'ValueTreeCard',
      version: 1,
      props: {
        title: 'Potential Value Drivers',
        nodes: [
          'Revenue Growth',
          'Cost Reduction',
          'Risk Mitigation',
          'Efficiency Gains',
        ],
      },
      hydrateWith: ['/api/opportunity/value-drivers'],
    },
  ],
  metadata: {
    experienceId: 'opportunity-discovery',
  },
};

/**
 * Target Stage Template
 * 
 * Purpose: Define and commit to value targets
 * Key Activities:
 * - ROI modeling
 * - Assumption validation
 * - Business case generation
 * - Executive validation prep
 */
export const TargetTemplate: SDUIPageDefinition = {
  type: 'page',
  version: 1,
  sections: [
    {
      type: 'component',
      component: 'InfoBanner',
      version: 1,
      props: {
        title: 'Target Value Commitment',
        description: 'Define baseline and target values with conservative assumptions',
        tone: 'warning',
      },
    },
    {
      type: 'component',
      component: 'ValueTreeCard',
      version: 1,
      props: {
        title: 'Target Outcomes',
        nodes: [
          'Increase Lead Conversion Rate',
          'Reduce Manual Processing Time',
          'Improve Customer Retention',
        ],
      },
      hydrateWith: ['/api/target/outcomes'],
    },
    {
      type: 'component',
      component: 'ValueCommitForm',
      version: 1,
      props: {
        kpis: [
          'Lead Conversion Rate',
          'Manual Hours Reduced',
          'Customer Retention Rate',
          'Time to Close',
        ],
        onCommit: () => {}, // Will be hydrated with actual handler
        allowCustomKPIs: true,
      },
      hydrateWith: ['/api/target/kpis'],
    },
    {
      type: 'component',
      component: 'InfoBanner',
      version: 1,
      props: {
        title: 'Conservative Quantification',
        description: 'All assumptions must be evidence-based and withstand CFO-level scrutiny',
        tone: 'warning',
      },
    },
  ],
  metadata: {
    experienceId: 'target-commitment',
  },
};

/**
 * Realization Stage Template
 * 
 * Purpose: Track and prove value delivery
 * Key Activities:
 * - Telemetry ingestion
 * - Actual vs. committed tracking
 * - Value realization reports
 * - Renewal risk detection
 */
export const RealizationTemplate: SDUIPageDefinition = {
  type: 'page',
  version: 1,
  sections: [
    {
      type: 'component',
      component: 'InfoBanner',
      version: 1,
      props: {
        title: 'Value Realization Tracking',
        description: 'Monitor actual results against committed targets',
        tone: 'success',
      },
    },
    {
      type: 'component',
      component: 'RealizationDashboard',
      version: 1,
      props: {
        title: 'KPI Performance',
        showDetails: true,
        showTrends: true,
      },
      hydrateWith: ['/api/realization/kpis', '/api/realization/actuals'],
      fallback: {
        message: 'Realization data is being collected. Check back soon.',
        component: 'InfoBanner',
        props: {
          title: 'Data Collection in Progress',
          description: 'Telemetry is being ingested from connected systems',
          tone: 'info',
        },
      },
    },
    {
      type: 'component',
      component: 'DiscoveryCard',
      version: 1,
      props: {
        title: 'Measurement Questions',
        questions: [
          'What is the baseline measurement?',
          'How is uplift being captured?',
          'Which KPI owners are accountable?',
          'What is the measurement frequency?',
          'Are there any data quality issues?',
        ],
      },
    },
  ],
  metadata: {
    experienceId: 'realization-tracking',
  },
};

/**
 * Expansion Stage Template
 * 
 * Purpose: Identify and pursue expansion opportunities
 * Key Activities:
 * - Benchmark comparison
 * - Gap analysis
 * - Expansion ROI modeling
 * - Upsell case building
 */
export const ExpansionTemplate: SDUIPageDefinition = {
  type: 'page',
  version: 1,
  sections: [
    {
      type: 'component',
      component: 'InfoBanner',
      version: 1,
      props: {
        title: 'Expansion Opportunities',
        description: 'Identify gaps and model additional value potential',
        tone: 'info',
      },
    },
    {
      type: 'component',
      component: 'ExpansionBlock',
      version: 1,
      props: {
        gaps: [
          'Advanced Analytics Capability',
          'Multi-Channel Integration',
          'Automated Workflow Engine',
        ],
        roi: {
          revenue: 150000,
          cost: 25000,
          risk: 10000,
        },
      },
      hydrateWith: ['/api/expansion/gaps', '/api/expansion/roi'],
    },
    {
      type: 'component',
      component: 'ValueTreeCard',
      version: 1,
      props: {
        title: 'Expansion Value Drivers',
        nodes: [
          'Unlock New Use Cases',
          'Scale to Additional Teams',
          'Integrate New Data Sources',
        ],
      },
      hydrateWith: ['/api/expansion/value-drivers'],
    },
    {
      type: 'component',
      component: 'KPIForm',
      version: 1,
      props: {
        kpiName: 'Expansion ROI',
        description: 'Projected return on investment for expansion',
        unit: 'USD',
        onSubmit: () => {}, // Will be hydrated
      },
    },
  ],
  metadata: {
    experienceId: 'expansion-planning',
  },
};

/**
 * Integrity Stage Template
 * 
 * Purpose: Validate manifesto compliance
 * Key Activities:
 * - Manifesto compliance validation
 * - Assumption normalization
 * - Narrative alignment
 * - Conflict resolution
 */
export const IntegrityTemplate: SDUIPageDefinition = {
  type: 'page',
  version: 2,
  sections: [
    {
      type: 'component',
      component: 'InfoBanner',
      version: 1,
      props: {
        title: 'Integrity Check',
        description: 'Validate compliance with VOS Manifesto principles',
        tone: 'warning',
      },
    },
    {
      type: 'component',
      component: 'IntegrityReviewPanel',
      version: 1,
      props: {
        title: 'Manifesto Compliance Review',
        showDetails: true,
        showRemediation: true,
        groupByStatus: true,
        showSummary: true,
      },
      hydrateWith: ['/api/integrity/validation'],
      fallback: {
        message: 'Integrity validation is in progress',
        component: 'InfoBanner',
        props: {
          title: 'Validation Running',
          description: 'Checking all artifacts against manifesto rules',
          tone: 'info',
        },
      },
    },
    {
      type: 'component',
      component: 'DiscoveryCard',
      version: 1,
      props: {
        title: 'Integrity Checklist',
        questions: [
          'Are all outcomes customer-defined?',
          'Are assumptions conservative and evidence-based?',
          'Is the value quantified using Revenue/Cost/Risk?',
          'Are all KPIs from the standard Value Fabric?',
          'Is the ROI calculation using standard methodology?',
          'Are all claims traceable and auditable?',
        ],
      },
    },
  ],
  metadata: {
    experienceId: 'integrity-validation',
    debug: false,
  },
};

/**
 * Complete Lifecycle Template
 * 
 * Shows all stages in a single view with navigation
 */
export const CompleteLifecycleTemplate: SDUIPageDefinition = {
  type: 'page',
  version: 1,
  sections: [
    {
      type: 'component',
      component: 'InfoBanner',
      version: 1,
      props: {
        title: 'Value Operating System',
        description: 'Complete lifecycle view: Opportunity → Target → Realization → Expansion → Integrity',
        tone: 'info',
      },
    },
    // Each stage as a collapsible panel would go here
    // This is a placeholder for a more complex multi-stage view
  ],
  metadata: {
    experienceId: 'complete-lifecycle',
  },
};

/**
 * Template Registry
 * 
 * Maps template names to their definitions
 */
export const SDUITemplates = {
  opportunity: OpportunityTemplate,
  target: TargetTemplate,
  realization: RealizationTemplate,
  expansion: ExpansionTemplate,
  integrity: IntegrityTemplate,
  complete: CompleteLifecycleTemplate,
};

/**
 * Get template by name
 */
export function getTemplate(name: keyof typeof SDUITemplates): SDUIPageDefinition {
  return SDUITemplates[name];
}

/**
 * List all available templates
 */
export function listTemplates(): Array<{
  name: string;
  title: string;
  description: string;
}> {
  return [
    {
      name: 'opportunity',
      title: 'Opportunity Discovery',
      description: 'Discover and frame business problems',
    },
    {
      name: 'target',
      title: 'Target Commitment',
      description: 'Define and commit to value targets',
    },
    {
      name: 'realization',
      title: 'Value Realization',
      description: 'Track and prove value delivery',
    },
    {
      name: 'expansion',
      title: 'Expansion Planning',
      description: 'Identify and pursue expansion opportunities',
    },
    {
      name: 'integrity',
      title: 'Integrity Validation',
      description: 'Validate manifesto compliance',
    },
    {
      name: 'complete',
      title: 'Complete Lifecycle',
      description: 'Full lifecycle view with all stages',
    },
  ];
}
