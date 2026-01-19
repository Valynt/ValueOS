/**
 * SOF Target Page Template
 * 
 * Extended Target template with Intervention Designer and Outcome Hypotheses.
 */

import type { SDUIPageDefinition } from '../schema';
import type { InterventionPoint, OutcomeHypothesis, SystemMap } from '../../types/sof';

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
  const sections: SDUIPageDefinition['sections'] = [
    // Header
    {
      type: 'component',
      component: 'PageHeader',
      version: 1,
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
      type: 'component',
      component: 'Card',
      version: 1,
      props: {
        title: 'System Context',
        collapsible: true,
        defaultCollapsed: true,
        children: [
          {
            type: 'component',
            component: 'SystemMapCanvas',
            version: 1,
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
    },

    // Main Content
    {
      type: 'component',
      component: 'Tabs',
      version: 1,
      props: {
        defaultTab: 'interventions',
        children: [
          // Interventions Tab
          {
            type: 'component',
            component: 'TabPanel',
            version: 1,
            props: {
              id: 'interventions',
              label: 'Intervention Design',
              icon: 'target',
              children: [
                {
                  type: 'component',
                  component: 'Stack',
                  version: 1,
                  props: {
                    gap: 4,
                    children: ([
                      // Intervention Designer
                      {
                        type: 'component',
                        component: 'Card',
                        version: 1,
                        props: {
                          title: 'Intervention Designer',
                          description: 'Design high-leverage interventions from system map',
                          children: [
                            {
                              type: 'component',
                              component: 'InterventionDesigner',
                              version: 1,
                              props: {
                                systemMap: data.systemMap,
                                kpis: data.kpis || [],
                              },
                            },
                          ],
                        },
                      },

                      // Intervention Points List
                      data.interventionPoints && data.interventionPoints.length > 0 && {
                        type: 'component',
                        component: 'Card',
                        version: 1,
                        props: {
                          title: 'Designed Interventions',
                          description: `${data.interventionPoints.length} intervention(s) identified`,
                          children: [
                            {
                              type: 'component',
                              component: 'Grid',
                              version: 1,
                              props: {
                                columns: 2,
                                gap: 4,
                                children: data.interventionPoints.map((intervention) => ({
                                  type: 'component',
                                  component: 'InterventionPointCard',
                                  version: 1,
                                  props: {
                                    intervention,
                                    showRisks: true,
                                    showPathways: true,
                                  },
                                })),
                              },
                            },
                          ],
                        },
                      },

                      // Intervention Sequence
                      data.interventionPoints && data.interventionPoints.length > 1 && {
                        type: 'component',
                        component: 'Card',
                        version: 1,
                        props: {
                          title: 'Implementation Sequence',
                          description: 'Recommended order based on dependencies',
                          children: [
                            {
                              type: 'component',
                              component: 'InterventionSequenceTimeline',
                              version: 1,
                              props: {
                                interventions: data.interventionPoints,
                              },
                            },
                          ],
                        },
                      },
                    ].filter(Boolean) as any[]),
                  },
                },
              ],
            },
          },

          // Outcome Hypotheses Tab
          {
            type: 'component',
            component: 'TabPanel',
            version: 1,
            props: {
              id: 'outcomes',
              label: 'Outcome Hypotheses',
              icon: 'lightbulb',
              children: [
                {
                  type: 'component',
                  component: 'Stack',
                  version: 1,
                  props: {
                    gap: 4,
                    children: ([
                      // Outcome Engineer
                      {
                        type: 'component',
                        component: 'Card',
                        version: 1,
                        props: {
                          title: 'Outcome Engineer',
                          description: 'Build systemic outcome hypotheses',
                          children: [
                            {
                              type: 'component',
                              component: 'OutcomeEngineer',
                              version: 1,
                              props: {
                                systemMap: data.systemMap,
                                interventionPoints: data.interventionPoints || [],
                                kpis: data.kpis || [],
                              },
                            },
                          ],
                        },
                      },

                      // Outcome Hypotheses List
                      data.outcomeHypotheses && data.outcomeHypotheses.length > 0 && {
                        type: 'component',
                        component: 'Card',
                        version: 1,
                        props: {
                          title: 'Outcome Hypotheses',
                          description: `${data.outcomeHypotheses.length} hypothesis(es) created`,
                          children: data.outcomeHypotheses.map((hypothesis) => ({
                            type: 'component',
                            component: 'OutcomeHypothesisCard',
                            version: 1,
                            props: {
                              hypothesis,
                              showCausalChain: true,
                              showAssumptions: true,
                            },
                          })),
                        },
                      },

                      // Causal Chain Visualization
                      data.outcomeHypotheses && data.outcomeHypotheses.length > 0 && {
                        type: 'component',
                        component: 'Card',
                        version: 1,
                        props: {
                          title: 'Causal Pathways',
                          description: 'Intervention → System Change → KPI → Value',
                          children: [
                            {
                              type: 'component',
                              component: 'CausalChainVisualization',
                              version: 1,
                              props: {
                                hypotheses: data.outcomeHypotheses,
                              },
                            },
                          ],
                        },
                      },
                    ].filter(Boolean) as any[]),
                  },
                },
              ],
            },
          },

          // KPI Mapping Tab
          {
            type: 'component',
            component: 'TabPanel',
            version: 1,
            props: {
              id: 'kpis',
              label: 'KPI Mapping',
              icon: 'chart',
              children: [
                {
                  type: 'component',
                  component: 'Card',
                  version: 1,
                  props: {
                    title: 'Intervention → KPI Impact Matrix',
                    description: 'Map interventions to expected KPI changes',
                    children: [
                      {
                        type: 'component',
                        component: 'OutcomePathwayMatrix',
                        version: 1,
                        props: {
                          interventions: data.interventionPoints || [],
                          kpis: data.kpis || [],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },

    // Actions Footer
    {
      type: 'component',
      component: 'ActionBar',
      version: 1,
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
    type: 'page',
    version: 1,
    sections,
    metadata: {
      theme: 'dark',
      lifecycle_stage: 'target',
      sofEnabled: true,
      requiresInterventions: true,
      requiresOutcomeHypotheses: true,
    },
  };
}

export default generateSOFTargetPage;
