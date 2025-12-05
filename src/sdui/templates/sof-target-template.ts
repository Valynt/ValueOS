/**
 * SOF Target Page Template
 * 
 * Extended Target template with Intervention Designer and Outcome Hypotheses.
 */

import type { SDUIPageDefinition } from '../types';
import type { SystemMap, InterventionPoint, OutcomeHypothesis } from '../../types/sof';

/**
 * Generate SOF-enhanced Target page
 */
export function generateSOFTargetPage(data: {
  businessCase: any;
  systemMap: SystemMap;
  interventionPoints?: InterventionPoint[];
  outcomeHypotheses?: OutcomeHypothesis[];
  kpis?: any[];
}): SDUIPageDefinition {
  const components: SDUIPageDefinition['components'] = [
    // Header
    {
      type: 'PageHeader',
      props: {
        title: 'Target Definition',
        subtitle: 'Design interventions and engineer outcomes',
        breadcrumbs: [
          { label: 'Home', href: '/' },
          { label: 'Opportunities', href: '/opportunities' },
          { label: data.businessCase?.name || 'Business Case' },
          { label: 'Target' },
        ],
      },
    },

    // System Map Reference
    {
      type: 'Card',
      props: {
        title: 'System Context',
        collapsible: true,
        defaultCollapsed: true,
      },
      children: [
        {
          type: 'SystemMapCanvas',
          props: {
            entities: data.systemMap.entities,
            relationships: data.systemMap.relationships,
            leveragePoints: data.systemMap.leverage_points,
            constraints: data.systemMap.constraints,
            width: 600,
            height: 400,
            interactive: false,
          },
        },
      ],
    },

    // Main Content
    {
      type: 'Tabs',
      props: {
        defaultTab: 'interventions',
      },
      children: [
        // Interventions Tab
        {
          type: 'TabPanel',
          props: {
            id: 'interventions',
            label: 'Intervention Design',
            icon: 'target',
          },
          children: [
            {
              type: 'Stack',
              props: { gap: 4 },
              children: [
                // Intervention Designer
                {
                  type: 'Card',
                  props: {
                    title: 'Intervention Designer',
                    description: 'Design high-leverage interventions from system map',
                  },
                  children: [
                    {
                      type: 'InterventionDesigner',
                      props: {
                        systemMap: data.systemMap,
                        kpis: data.kpis || [],
                      },
                    },
                  ],
                },

                // Intervention Points List
                data.interventionPoints && data.interventionPoints.length > 0 && {
                  type: 'Card',
                  props: {
                    title: 'Designed Interventions',
                    description: `${data.interventionPoints.length} intervention(s) identified`,
                  },
                  children: [
                    {
                      type: 'Grid',
                      props: {
                        columns: 2,
                        gap: 4,
                      },
                      children: data.interventionPoints.map((intervention) => ({
                        type: 'InterventionPointCard',
                        props: {
                          intervention,
                          showRisks: true,
                          showPathways: true,
                        },
                      })),
                    },
                  ],
                },

                // Intervention Sequence
                data.interventionPoints && data.interventionPoints.length > 1 && {
                  type: 'Card',
                  props: {
                    title: 'Implementation Sequence',
                    description: 'Recommended order based on dependencies',
                  },
                  children: [
                    {
                      type: 'InterventionSequenceTimeline',
                      props: {
                        interventions: data.interventionPoints,
                      },
                    },
                  ],
                },
              ].filter(Boolean),
            },
          ],
        },

        // Outcome Hypotheses Tab
        {
          type: 'TabPanel',
          props: {
            id: 'outcomes',
            label: 'Outcome Hypotheses',
            icon: 'lightbulb',
          },
          children: [
            {
              type: 'Stack',
              props: { gap: 4 },
              children: [
                // Outcome Engineer
                {
                  type: 'Card',
                  props: {
                    title: 'Outcome Engineer',
                    description: 'Build systemic outcome hypotheses',
                  },
                  children: [
                    {
                      type: 'OutcomeEngineer',
                      props: {
                        systemMap: data.systemMap,
                        interventionPoints: data.interventionPoints || [],
                        kpis: data.kpis || [],
                      },
                    },
                  ],
                },

                // Outcome Hypotheses List
                data.outcomeHypotheses && data.outcomeHypotheses.length > 0 && {
                  type: 'Card',
                  props: {
                    title: 'Outcome Hypotheses',
                    description: `${data.outcomeHypotheses.length} hypothesis(es) created`,
                  },
                  children: data.outcomeHypotheses.map((hypothesis) => ({
                    type: 'OutcomeHypothesisCard',
                    props: {
                      hypothesis,
                      showCausalChain: true,
                      showAssumptions: true,
                    },
                  })),
                },

                // Causal Chain Visualization
                data.outcomeHypotheses && data.outcomeHypotheses.length > 0 && {
                  type: 'Card',
                  props: {
                    title: 'Causal Pathways',
                    description: 'Intervention → System Change → KPI → Value',
                  },
                  children: [
                    {
                      type: 'CausalChainVisualization',
                      props: {
                        hypotheses: data.outcomeHypotheses,
                      },
                    },
                  ],
                },
              ].filter(Boolean),
            },
          ],
        },

        // KPI Mapping Tab
        {
          type: 'TabPanel',
          props: {
            id: 'kpis',
            label: 'KPI Mapping',
            icon: 'chart',
          },
          children: [
            {
              type: 'Card',
              props: {
                title: 'Intervention → KPI Impact Matrix',
                description: 'Map interventions to expected KPI changes',
              },
              children: [
                {
                  type: 'OutcomePathwayMatrix',
                  props: {
                    interventions: data.interventionPoints || [],
                    kpis: data.kpis || [],
                  },
                },
              ],
            },
          ],
        },
      ],
    },

    // Actions Footer
    {
      type: 'ActionBar',
      props: {
        actions: [
          {
            label: 'Back to Opportunity',
            variant: 'secondary',
            onClick: 'backToOpportunity',
          },
          {
            label: 'Save Progress',
            variant: 'secondary',
            onClick: 'saveProgress',
          },
          {
            label: 'Continue to Realization',
            variant: 'primary',
            onClick: 'continueToRealization',
            disabled: !data.interventionPoints || data.interventionPoints.length === 0,
          },
        ],
      },
    },
  ];

  return {
    type: 'TargetPage',
    layout: 'default',
    components,
    metadata: {
      stage: 'target',
      sofEnabled: true,
      requiresInterventions: true,
      requiresOutcomeHypotheses: true,
    },
  };
}

export default generateSOFTargetPage;
